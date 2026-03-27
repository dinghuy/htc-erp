import { v4 as uuidv4 } from 'uuid';
import type { AuthenticatedUser, ApprovalGateType } from '../../shared/contracts/domain';
import { canUserApproveRequest, resolveApprovalLane } from '../../shared/auth/permissions';
import { normalizeRoleCodes } from '../../shared/auth/roles';
import { canCompleteDelivery, canCreateSalesOrderFromQuotation, canStartLogisticsExecution, canTransitionSalesOrderStatus } from '../../shared/workflow/revenueFlow';
import { createProjectRepository } from './repository';

type CreateProjectWorkspaceServicesDeps = {
  projectHubText: (value: unknown) => string;
  projectHubNumber: (value: unknown, fallback?: number) => number;
  parseProjectHubJson: <T>(value: unknown, fallback: T) => T;
};

export function createProjectWorkspaceServices(deps: CreateProjectWorkspaceServicesDeps) {
  const { projectHubText, projectHubNumber, parseProjectHubJson } = deps;
  const projectRepository = createProjectRepository();

  function normalizeContractLineItems(items: any[] = []) {
    return (Array.isArray(items) ? items : []).map((item: any, index: number) => {
      const itemCode = projectHubText(item?.itemCode || item?.sku);
      const itemName = projectHubText(item?.itemName || item?.name || item?.description) || `Line ${index + 1}`;
      const sourceSeed = projectHubText(item?.sourceLineKey || item?.lineKey || itemCode || itemName).replace(/\s+/g, '-').toLowerCase() || `line-${index + 1}`;
      const contractQty = projectHubNumber(item?.contractQty ?? item?.quantity ?? item?.qty ?? item?.unitCount, 0);
      const unitPrice = projectHubNumber(item?.unitPrice ?? item?.sellUnitPriceVnd ?? item?.price, 0);
      const lineTotal = projectHubNumber(item?.lineTotal, contractQty * unitPrice);
      return {
        sourceLineKey: item?.sourceLineKey || `${sourceSeed}::${index + 1}`,
        itemCode: itemCode || null,
        itemName,
        description: projectHubText(item?.description || itemName) || null,
        unit: projectHubText(item?.unit || item?.uom) || null,
        contractQty,
        unitPrice,
        lineTotal,
        etaDate: projectHubText(item?.etaDate) || null,
        committedDeliveryDate: projectHubText(item?.committedDeliveryDate || item?.deliveryDate) || null,
        note: projectHubText(item?.note) || null,
      };
    });
  }

  function mapProjectContractRow(row: any) {
    if (!row) return null;
    return {
      ...row,
      totalValue: projectHubNumber(row.totalValue, 0),
      lineItems: normalizeContractLineItems(parseProjectHubJson<any[]>(row.lineItems, [])),
    };
  }

  function mapProjectAppendixRow(row: any) {
    if (!row) return null;
    return {
      ...row,
      totalDeltaValue: projectHubNumber(row.totalDeltaValue, 0),
      lineItems: normalizeContractLineItems(parseProjectHubJson<any[]>(row.lineItems, [])),
    };
  }

  function mapProjectBaselineRow(row: any) {
    if (!row) return null;
    return {
      ...row,
      baselineNo: projectHubNumber(row.baselineNo, 0),
      totalValue: projectHubNumber(row.totalValue, 0),
      isCurrent: Number(row.isCurrent || 0) === 1,
      lineItems: normalizeContractLineItems(parseProjectHubJson<any[]>(row.lineItems, [])),
    };
  }

  function mapProjectProcurementLineRow(row: any) {
    if (!row) return null;
    return {
      ...row,
      isActive: Number(row.isActive ?? 1) === 1,
      contractQty: projectHubNumber(row.contractQty, 0),
      orderedQty: projectHubNumber(row.orderedQty, 0),
      receivedQty: projectHubNumber(row.receivedQty, 0),
      deliveredQty: projectHubNumber(row.deliveredQty, 0),
      shortageQty: projectHubNumber(row.shortageQty, 0),
    };
  }

  function mapProjectInboundLineRow(row: any) {
    if (!row) return null;
    return {
      ...row,
      procurementIsActive: Number(row.procurementIsActive ?? 1) === 1,
      receivedQty: projectHubNumber(row.receivedQty, 0),
    };
  }

  function mapProjectDeliveryLineRow(row: any) {
    if (!row) return null;
    return {
      ...row,
      procurementIsActive: Number(row.procurementIsActive ?? 1) === 1,
      deliveredQty: projectHubNumber(row.deliveredQty, 0),
    };
  }

  const GATE_TITLES: Record<ApprovalGateType, string> = {
    quotation_commercial: 'Quotation Commercial Approval',
    sales_order_release: 'Sales Order Release',
    procurement_commitment: 'Procurement Commitment',
    delivery_release: 'Delivery Release',
    delivery_completion: 'Delivery Completion',
  };

  function isBusinessRole(user: Pick<AuthenticatedUser, 'roleCodes' | 'systemRole'> | null | undefined, roles: string[]) {
    const normalized = normalizeRoleCodes(user?.roleCodes, user?.systemRole);
    return normalized.some((role) => roles.includes(role));
  }

  function decorateApprovalForCurrentUser(approval: any, currentUser?: Pick<AuthenticatedUser, 'id' | 'roleCodes' | 'systemRole'> | null) {
    const canDecide = canUserApproveRequest(currentUser, approval);
    return {
      ...approval,
      actionAvailability: {
        lane: resolveApprovalLane(approval),
        canDecide,
        canEdit: ['pending', 'cancelled'].includes(String(approval?.status || '').toLowerCase()),
        canDelete: ['pending', 'cancelled'].includes(String(approval?.status || '').toLowerCase()),
        isRequester: Boolean(currentUser?.id) && String(approval?.requestedBy || '') === currentUser?.id,
        isAssignedApprover: !approval?.approverUserId || String(approval.approverUserId) === currentUser?.id,
        availableDecisions: canDecide ? ['approved', 'rejected', 'changes_requested'] : [],
      },
    };
  }

  function buildApprovalGateStates(input: {
    approvals: any[];
    currentUser?: Pick<AuthenticatedUser, 'id' | 'roleCodes' | 'systemRole'> | null;
    latestQuotation?: any;
    latestSalesOrder?: any;
    deliveryLines?: any[];
  }) {
    const approvals = Array.isArray(input.approvals) ? input.approvals : [];
    const currentUser = input.currentUser;
    const gateTypes: ApprovalGateType[] = [
      'quotation_commercial',
      'sales_order_release',
      'procurement_commitment',
      'delivery_release',
      'delivery_completion',
    ];

    return gateTypes.map((gateType) => {
      const gateApprovals = approvals.filter((approval) => approval?.requestType === gateType);
      const pendingApprovals = gateApprovals.filter((approval) => String(approval?.status || '').toLowerCase() === 'pending');
      const latestApproval = gateApprovals[0] || null;
      const pendingApprovers = pendingApprovals.map((approval) => ({
        approvalId: approval.id,
        approverRole: approval.approverRole || null,
        approverUserId: approval.approverUserId || null,
        approverName: approval.approverName || null,
        requestedBy: approval.requestedBy || null,
        requestedByName: approval.requestedByName || null,
        dueDate: approval.dueDate || null,
        actionAvailability: approval.actionAvailability,
      }));
      const currentUserCanDecide = pendingApprovals.some((approval) => canUserApproveRequest(currentUser, approval));
      let canRequest = false;
      let canExecute = false;
      const blockers: string[] = [];

      if (gateType === 'quotation_commercial') {
        const quotationStatus = String(input.latestQuotation?.status || '').toLowerCase();
        canRequest = isBusinessRole(currentUser, ['sales', 'admin', 'director']) && ['draft', 'revision_required'].includes(quotationStatus) && pendingApprovals.length === 0;
        if (!input.latestQuotation?.id) blockers.push('Latest quotation is required.');
      }

      if (gateType === 'sales_order_release') {
        canRequest = isBusinessRole(currentUser, ['project_manager', 'director', 'admin']) && String(input.latestQuotation?.status || '').toLowerCase() === 'won' && String(input.latestSalesOrder?.status || '').toLowerCase() === 'draft' && pendingApprovals.length === 0;
        if (String(input.latestQuotation?.status || '').toLowerCase() !== 'won') blockers.push('Quotation must be won before requesting sales order release.');
        if (!input.latestSalesOrder?.id) blockers.push('Sales order is required.');
      }

      if (gateType === 'procurement_commitment') {
        canRequest = isBusinessRole(currentUser, ['project_manager', 'director', 'admin']) && canStartLogisticsExecution(input.latestSalesOrder?.status) && pendingApprovals.length === 0;
        if (!canStartLogisticsExecution(input.latestSalesOrder?.status)) blockers.push('Released sales order is required before procurement commitment.');
      }

      if (gateType === 'delivery_release') {
        canRequest = isBusinessRole(currentUser, ['project_manager', 'director', 'admin']) && canStartLogisticsExecution(input.latestSalesOrder?.status) && pendingApprovals.length === 0;
        if (!canStartLogisticsExecution(input.latestSalesOrder?.status)) blockers.push('Released sales order is required before delivery release.');
      }

      if (gateType === 'delivery_completion') {
        const completion = canCompleteDelivery((input.deliveryLines || []).map((line: any) => line.status));
        canRequest = isBusinessRole(currentUser, ['project_manager', 'director', 'admin']) && canStartLogisticsExecution(input.latestSalesOrder?.status) && pendingApprovals.length === 0;
        canExecute = isBusinessRole(currentUser, ['sales', 'director', 'admin']) && Boolean(gateApprovals.find((approval) => String(approval?.status || '').toLowerCase() === 'approved')) && completion.ok;
        if (!canStartLogisticsExecution(input.latestSalesOrder?.status)) blockers.push('Released sales order is required before delivery completion.');
        if (completion.ok === false) blockers.push(completion.failure.message);
      }

      return {
        gateType,
        title: GATE_TITLES[gateType],
        status: pendingApprovals.length > 0 ? 'pending' : latestApproval?.status || 'not_requested',
        latestApprovalId: latestApproval?.id || null,
        pendingCount: pendingApprovals.length,
        pendingApprovers,
        currentUserCanDecide,
        actionAvailability: {
          canRequest,
          canExecute,
          blockers,
        },
      };
    });
  }

  function buildWorkspaceActionAvailability(input: {
    currentUser?: Pick<AuthenticatedUser, 'id' | 'roleCodes' | 'systemRole'> | null;
    quotations?: any[];
    salesOrders?: any[];
    gateStates?: any[];
    deliveryLines?: any[];
  }) {
    const latestQuotation = Array.isArray(input.quotations) ? input.quotations[0] : null;
    const latestSalesOrder = Array.isArray(input.salesOrders) ? input.salesOrders[0] : null;
    const gateStates = Array.isArray(input.gateStates) ? input.gateStates : [];
    const releasedSalesOrder = canStartLogisticsExecution(latestSalesOrder?.status);
    const deliveryCompletionGate = gateStates.find((gate) => gate.gateType === 'delivery_completion');
    const releaseTransition = latestSalesOrder
      ? canTransitionSalesOrderStatus({
          currentStatus: latestSalesOrder.status,
          nextStatus: 'released',
          quotationStatus: latestQuotation?.status,
        })
      : { ok: false, failure: { code: 'SALES_ORDER_REQUIRED', message: 'Sales order is required.' } };

    return {
      quotation: {
        latestQuotationId: latestQuotation?.id || null,
        latestQuotationStatus: latestQuotation?.status || null,
        canCreateSalesOrder: isBusinessRole(input.currentUser, ['sales', 'project_manager', 'director', 'admin']) && Boolean(latestQuotation?.id) && canCreateSalesOrderFromQuotation(latestQuotation?.status),
        canRequestCommercialApproval: Boolean(gateStates.find((gate) => gate.gateType === 'quotation_commercial')?.actionAvailability?.canRequest),
      },
      salesOrder: {
        latestSalesOrderId: latestSalesOrder?.id || null,
        latestSalesOrderStatus: latestSalesOrder?.status || null,
        canReleaseLatest: Boolean(latestSalesOrder?.id) && isBusinessRole(input.currentUser, ['director', 'admin']) && releaseTransition.ok,
        blockers: releaseTransition.ok === false ? [releaseTransition.failure.message] : [],
      },
      project: {
        canRecordLogistics: releasedSalesOrder && isBusinessRole(input.currentUser, ['project_manager', 'procurement', 'sales', 'director', 'admin']),
        canRequestDeliveryCompletionApproval: Boolean(deliveryCompletionGate?.actionAvailability?.canRequest),
        canFinalizeDeliveryCompletion: Boolean(deliveryCompletionGate?.actionAvailability?.canExecute),
        deliveryCompletionApprovalId: deliveryCompletionGate?.latestApprovalId || null,
        blockers: Array.isArray(deliveryCompletionGate?.actionAvailability?.blockers) ? deliveryCompletionGate.actionAvailability.blockers : [],
      },
    };
  }

  async function createProjectTimelineEvent(
    db: any,
    event: {
      projectId: string;
      eventType: string;
      title: string;
      description?: string | null;
      eventDate?: string | null;
      entityType?: string | null;
      entityId?: string | null;
      payload?: any;
      createdBy?: string | null;
    }
  ) {
    const id = uuidv4();
    await projectRepository.insertTimelineEvent({
      id,
      projectId: event.projectId,
      eventType: event.eventType,
      title: event.title,
      description: event.description || null,
      eventDate: event.eventDate || null,
      entityType: event.entityType || null,
      entityId: event.entityId || null,
      payload: event.payload == null ? null : JSON.stringify(event.payload),
      createdBy: event.createdBy || null,
    });
    return projectRepository.findTimelineEventById(id);
  }

  async function recalculateProjectProcurementRollup(db: any, procurementLineId: string) {
    const line = await projectRepository.findProcurementLineById(procurementLineId);
    if (!line) return null;

    const [inboundTotals, deliveryTotals] = await Promise.all([
      projectRepository.findInboundTotalsByProcurementLineId(procurementLineId),
      projectRepository.findDeliveryTotalsByProcurementLineId(procurementLineId),
    ]);

    const contractQty = projectHubNumber(line.contractQty, 0);
    const orderedQty = projectHubNumber(line.orderedQty, 0);
    const receivedQty = projectHubNumber(inboundTotals?.totalQty, 0);
    const deliveredQty = projectHubNumber(deliveryTotals?.totalQty, 0);
    const shortageQty = Math.max(contractQty - Math.max(orderedQty, receivedQty, deliveredQty), 0);

    let shortageStatus = 'pending';
    let status = line.status || 'planned';
    if (deliveredQty >= contractQty && contractQty > 0) {
      shortageStatus = 'fulfilled';
      status = 'delivered';
    } else if (receivedQty > 0 || deliveredQty > 0) {
      shortageStatus = shortageQty > 0 ? 'partial' : 'fulfilled';
      status = 'partial';
    } else if (orderedQty > 0) {
      shortageStatus = shortageQty > 0 ? 'ordered_short' : 'ordered_complete';
      status = 'ordered';
    }

    await projectRepository.updateProcurementLineRollup({
      procurementLineId,
      receivedQty,
      deliveredQty,
      shortageQty,
      shortageStatus,
      status,
      actualReceivedDate: inboundTotals?.actualReceivedDate || null,
      actualDeliveryDate: deliveryTotals?.actualDeliveryDate || null,
    });

    return mapProjectProcurementLineRow(await projectRepository.findProcurementLineById(procurementLineId));
  }

  async function syncProjectProcurementLinesFromBaseline(db: any, projectId: string, baselineId: string) {
    const baseline = mapProjectBaselineRow(await projectRepository.findExecutionBaselineById(baselineId));
    if (!baseline) return [];

    const existingLines = await projectRepository.listProcurementLines(projectId);
    const bySourceKey = new Map<string, any>(existingLines.map((row: any) => [String(row.sourceLineKey), row] as [string, any]));
    const activeSourceKeys = new Set<string>();

    for (const lineItem of baseline.lineItems || []) {
      activeSourceKeys.add(String(lineItem.sourceLineKey));
      const existing: any = bySourceKey.get(String(lineItem.sourceLineKey));
      if (existing) {
        await projectRepository.updateProcurementLineFromBaseline({
          id: existing.id,
          baselineId: baseline.id,
          itemCode: lineItem.itemCode || null,
          itemName: lineItem.itemName || null,
          description: lineItem.description || null,
          unit: lineItem.unit || null,
          contractQty: projectHubNumber(lineItem.contractQty, 0),
          etaDate: lineItem.etaDate || null,
          committedDeliveryDate: lineItem.committedDeliveryDate || null,
          shortageQty: Math.max(
            projectHubNumber(lineItem.contractQty, 0) - Math.max(
              projectHubNumber(existing.orderedQty, 0),
              projectHubNumber(existing.receivedQty, 0),
              projectHubNumber(existing.deliveredQty, 0),
            ),
            0,
          ),
        });
        await recalculateProjectProcurementRollup(db, existing.id);
        continue;
      }

      const id = uuidv4();
      const contractQty = projectHubNumber(lineItem.contractQty, 0);
      await projectRepository.insertProcurementLine({
        id,
        projectId,
        baselineId: baseline.id,
        sourceLineKey: lineItem.sourceLineKey,
        itemCode: lineItem.itemCode || null,
        itemName: lineItem.itemName || null,
        description: lineItem.description || null,
        unit: lineItem.unit || null,
        contractQty,
        shortageQty: contractQty,
        etaDate: lineItem.etaDate || null,
        committedDeliveryDate: lineItem.committedDeliveryDate || null,
      });
      await recalculateProjectProcurementRollup(db, id);
    }

    const supersededAt = new Date().toISOString();
    const retiredLines = existingLines.filter((row: any) => !activeSourceKeys.has(String(row.sourceLineKey)) && Number(row.isActive ?? 1) === 1);
    for (const retired of retiredLines) {
      await projectRepository.retireProcurementLine({
        id: retired.id,
        supersededAt,
        supersededByBaselineId: baseline.id,
      });
      await createProjectTimelineEvent(db, {
        projectId,
        eventType: 'procurement.superseded',
        title: `Line procurement được chuyển sang history: ${retired.itemCode || retired.itemName || retired.description || retired.id}`.trim(),
        description: `Baseline ${baseline.title || baseline.id} không còn line ${retired.sourceLineKey}.`,
        eventDate: baseline.effectiveDate || supersededAt,
        entityType: 'ProjectProcurementLine',
        entityId: retired.id,
        payload: {
          procurementLineId: retired.id,
          sourceLineKey: retired.sourceLineKey,
          supersededByBaselineId: baseline.id,
        },
      });
    }

    return (await projectRepository.listProcurementLines(projectId)).map(mapProjectProcurementLineRow);
  }

  async function createExecutionBaselineFromSource(
    db: any,
    params: {
      projectId: string;
      sourceType: 'main_contract' | 'appendix';
      sourceId: string;
      title: string;
      effectiveDate?: string | null;
      currency?: string | null;
      totalValue?: number | null;
      lineItems?: any[];
      createdBy?: string | null;
    }
  ) {
    const lineItems = normalizeContractLineItems(params.lineItems || []);
    const baselineNoRow = await projectRepository.findMaxBaselineNo(params.projectId);
    const baselineNo = projectHubNumber(baselineNoRow?.maxBaselineNo, 0) + 1;
    const id = uuidv4();

    await projectRepository.clearCurrentExecutionBaseline(params.projectId);
    await projectRepository.insertExecutionBaseline({
      id,
      projectId: params.projectId,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      baselineNo,
      title: params.title,
      effectiveDate: params.effectiveDate || null,
      currency: params.currency || 'VND',
      totalValue: projectHubNumber(params.totalValue, 0),
      lineItems: JSON.stringify(lineItems),
      createdBy: params.createdBy || null,
    });

    await syncProjectProcurementLinesFromBaseline(db, params.projectId, id);
    return mapProjectBaselineRow(await projectRepository.findExecutionBaselineById(id));
  }

  async function getProjectWorkspaceById(db: any, projectId: string, currentUser?: Pick<AuthenticatedUser, 'id' | 'roleCodes' | 'systemRole'> | null) {
    const project = await projectRepository.findProjectSummaryById(projectId);
    if (!project) return null;

    const [
      quotations,
      supplierQuotes,
      tasks,
      activities,
      approvals,
      documents,
      salesOrders,
      qbuRounds,
      mainContractRow,
      appendixRows,
      baselineRows,
      procurementRows,
      inboundRows,
      deliveryRows,
      milestoneRows,
      timelineRows,
    ] = await Promise.all([
      projectRepository.listProjectQuotations(projectId),
      projectRepository.listProjectSupplierQuotes(projectId),
      projectRepository.listProjectTasks(projectId),
      projectRepository.listProjectActivities(projectId),
      projectRepository.listProjectApprovals(projectId),
      projectRepository.listProjectDocuments(projectId),
      projectRepository.listProjectSalesOrders(projectId),
      projectRepository.listProjectQbuRounds(projectId),
      projectRepository.findMainContract(projectId),
      projectRepository.listContractAppendices(projectId),
      projectRepository.listExecutionBaselines(projectId),
      projectRepository.listProcurementLines(projectId),
      projectRepository.listInboundLines(projectId),
      projectRepository.listDeliveryLines(projectId),
      projectRepository.listMilestones(projectId),
      projectRepository.listTimelineEvents(projectId),
    ]);

    const mainContract = mapProjectContractRow(mainContractRow);
    const contractAppendices = appendixRows.map(mapProjectAppendixRow);
    const executionBaselines = baselineRows.map(mapProjectBaselineRow);
    const currentBaseline = executionBaselines.find((item: any) => item.isCurrent) || executionBaselines[executionBaselines.length - 1] || null;
    const decoratedApprovals = approvals.map((approval: any) => decorateApprovalForCurrentUser(approval, currentUser));
    const approvalGateStates = buildApprovalGateStates({
      approvals: decoratedApprovals,
      currentUser,
      latestQuotation: quotations[0] || null,
      latestSalesOrder: salesOrders[0] || null,
      deliveryLines: deliveryRows,
    });
    const actionAvailability = buildWorkspaceActionAvailability({
      currentUser,
      quotations,
      salesOrders,
      gateStates: approvalGateStates,
      deliveryLines: deliveryRows,
    });

    return {
      ...project,
      quotations,
      supplierQuotes,
      tasks,
      activities,
      approvals: decoratedApprovals,
      approvalGateStates,
      pendingApproverState: approvalGateStates.map((gate) => ({
        gateType: gate.gateType,
        title: gate.title,
        status: gate.status,
        pendingCount: gate.pendingCount,
        pendingApprovers: gate.pendingApprovers,
      })),
      actionAvailability,
      documents,
      salesOrders,
      qbuRounds,
      mainContract,
      contractAppendices,
      executionBaselines,
      currentBaseline,
      procurementLines: procurementRows.map(mapProjectProcurementLineRow),
      inboundLines: inboundRows.map(mapProjectInboundLineRow),
      deliveryLines: deliveryRows.map(mapProjectDeliveryLineRow),
      milestones: milestoneRows,
      timeline: timelineRows.map((row: any) => ({
        ...row,
        payload: parseProjectHubJson(row.payload, null),
      })),
    };
  }

  return {
    normalizeContractLineItems,
    mapProjectContractRow,
    mapProjectAppendixRow,
    mapProjectBaselineRow,
    mapProjectProcurementLineRow,
    mapProjectInboundLineRow,
    mapProjectDeliveryLineRow,
    createProjectTimelineEvent,
    recalculateProjectProcurementRollup,
    syncProjectProcurementLinesFromBaseline,
    createExecutionBaselineFromSource,
    getProjectWorkspaceById,
  };
}
