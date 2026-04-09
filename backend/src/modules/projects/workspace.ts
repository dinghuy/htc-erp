import type { AuthenticatedUser, ApprovalGateType } from '../../shared/contracts/domain';
import { canUserApproveRequest, resolveApprovalLane } from '../../shared/auth/permissions';
import { normalizeRoleCodes } from '../../shared/auth/roles';
import { canCompleteDelivery, canCreateSalesOrderFromQuotation, canStartLogisticsExecution, canTransitionSalesOrderStatus, resolveHandoffActivation } from '../../shared/workflow/revenueFlow';
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
        isRequester: Boolean(currentUser?.id) && String(approval?.requestedBy || '') === String(currentUser?.id || ''),
        isAssignedApprover: !approval?.approverUserId || String(approval.approverUserId) === String(currentUser?.id || ''),
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
    documents?: any[];
  }) {
    const latestQuotation = Array.isArray(input.quotations) ? input.quotations[0] : null;
    const latestSalesOrder = Array.isArray(input.salesOrders) ? input.salesOrders[0] : null;
    const gateStates = Array.isArray(input.gateStates) ? input.gateStates : [];
    const documents = Array.isArray(input.documents) ? input.documents : [];
    const releasedSalesOrder = canStartLogisticsExecution(latestSalesOrder?.status);
    const deliveryCompletionGate = gateStates.find((gate) => gate.gateType === 'delivery_completion');
    const quotationCommercialGate = gateStates.find((gate) => gate.gateType === 'quotation_commercial');
    const salesOrderReleaseGate = gateStates.find((gate) => gate.gateType === 'sales_order_release');
    const procurementCommitmentGate = gateStates.find((gate) => gate.gateType === 'procurement_commitment');
    const deliveryReleaseGate = gateStates.find((gate) => gate.gateType === 'delivery_release');
    const releaseTransition = latestSalesOrder
      ? canTransitionSalesOrderStatus({
          currentStatus: latestSalesOrder.status,
          nextStatus: 'released',
          quotationStatus: latestQuotation?.status,
        })
      : { ok: false, failure: { code: 'SALES_ORDER_REQUIRED', message: 'Sales order is required.' } };
    const commercialDocumentBlockers = documents
      .filter((document) => ['missing', 'requested'].includes(String(document?.status || '').toLowerCase()) && ['quoting', 'negotiating', 'commercial_approved', 'won', 'order_released', 'procurement_active'].includes(String(document?.requiredAtStage || '').toLowerCase()))
      .slice(0, 3)
      .map((document) => `${document.documentName || document.documentCode || 'Commercial document'} đang ở trạng thái ${String(document.status || 'missing')}.`);
    const executionDocumentBlockers = documents
      .filter((document) => ['missing', 'requested'].includes(String(document?.status || '').toLowerCase()) && ['order_released', 'procurement_active', 'delivery_active', 'delivery', 'delivery_completed'].includes(String(document?.requiredAtStage || '').toLowerCase()))
      .slice(0, 3)
      .map((document) => `${document.documentName || document.documentCode || 'Execution document'} đang ở trạng thái ${String(document.status || 'missing')}.`);
    const quotationBlockers = [
      ...(!latestQuotation?.id ? ['Latest quotation is required before creating sales order.'] : []),
      ...(canCreateSalesOrderFromQuotation(latestQuotation?.status) ? [] : ['Quotation must be approved or won before creating a sales order.']),
      ...(Array.isArray(quotationCommercialGate?.actionAvailability?.blockers) ? quotationCommercialGate.actionAvailability.blockers : []),
      ...commercialDocumentBlockers,
    ];
    const salesOrderReleaseBlockers = [
      ...(releaseTransition.ok === false ? [releaseTransition.failure.message] : []),
      ...(Array.isArray(salesOrderReleaseGate?.actionAvailability?.blockers) ? salesOrderReleaseGate.actionAvailability.blockers : []),
      ...(salesOrderReleaseGate?.status === 'approved' ? [] : ['Sales order release gate must be approved before releasing the order.']),
      ...executionDocumentBlockers,
    ];
    const logisticsBlockers = [
      ...(releasedSalesOrder ? [] : ['Released sales order is required before logistics execution.']),
      ...(Array.isArray(procurementCommitmentGate?.actionAvailability?.blockers) ? procurementCommitmentGate.actionAvailability.blockers : []),
      ...(Array.isArray(deliveryReleaseGate?.actionAvailability?.blockers) ? deliveryReleaseGate.actionAvailability.blockers : []),
      ...(procurementCommitmentGate?.status === 'approved' ? [] : ['Procurement commitment gate must be approved before recording procurement or inbound activity.']),
      ...(deliveryReleaseGate?.status === 'approved' ? [] : ['Delivery release gate must be approved before recording delivery activity.']),
      ...executionDocumentBlockers,
    ];

    return {
      quotation: {
        latestQuotationId: latestQuotation?.id || null,
        latestQuotationStatus: latestQuotation?.status || null,
        canCreateSalesOrder: isBusinessRole(input.currentUser, ['sales', 'project_manager', 'director', 'admin']) && Boolean(latestQuotation?.id) && canCreateSalesOrderFromQuotation(latestQuotation?.status),
        canRequestCommercialApproval: Boolean(gateStates.find((gate) => gate.gateType === 'quotation_commercial')?.actionAvailability?.canRequest),
        blockers: Array.from(new Set(quotationBlockers)).filter(Boolean),
      },
      salesOrder: {
        latestSalesOrderId: latestSalesOrder?.id || null,
        latestSalesOrderStatus: latestSalesOrder?.status || null,
        canRequestReleaseApproval:
          Boolean(latestSalesOrder?.id) &&
          isBusinessRole(input.currentUser, ['project_manager', 'director', 'admin']) &&
          releaseTransition.ok &&
          Number(salesOrderReleaseGate?.pendingCount || 0) === 0 &&
          salesOrderReleaseGate?.status !== 'approved',
        canReleaseLatest:
          Boolean(latestSalesOrder?.id) &&
          isBusinessRole(input.currentUser, ['director', 'admin']) &&
          releaseTransition.ok &&
          salesOrderReleaseGate?.status === 'approved',
        blockers: Array.from(new Set(salesOrderReleaseBlockers)).filter(Boolean),
      },
      project: {
        canRecordLogistics:
          isBusinessRole(input.currentUser, ['project_manager', 'procurement', 'sales', 'director', 'admin']) &&
          Array.from(new Set(logisticsBlockers)).filter(Boolean).length === 0,
        logisticsBlockers: Array.from(new Set(logisticsBlockers)).filter(Boolean),
        canRequestDeliveryCompletionApproval: Boolean(deliveryCompletionGate?.actionAvailability?.canRequest),
        canFinalizeDeliveryCompletion: Boolean(deliveryCompletionGate?.actionAvailability?.canExecute),
        deliveryCompletionApprovalId: deliveryCompletionGate?.latestApprovalId || null,
        blockers: Array.isArray(deliveryCompletionGate?.actionAvailability?.blockers) ? deliveryCompletionGate.actionAvailability.blockers : [],
      },
    };
  }

  function buildWorkspacePhaseControl(input: {
    projectStage?: string | null;
    actionAvailability?: any;
    gateStates?: any[];
    documents?: any[];
    procurementLines?: any[];
    milestones?: any[];
    taskCount?: number;
    openTaskCount?: number;
    overdueTaskCount?: number;
    deliveryLines?: any[];
  }) {
    const stage = String(input.projectStage || 'new').trim().toLowerCase();
    const gateStates = Array.isArray(input.gateStates) ? input.gateStates : [];
    const documents = Array.isArray(input.documents) ? input.documents : [];
    const procurementLines = Array.isArray(input.procurementLines) ? input.procurementLines : [];
    const milestones = Array.isArray(input.milestones) ? input.milestones : [];
    const deliveryLines = Array.isArray(input.deliveryLines) ? input.deliveryLines : [];

    const quotationGate = gateStates.find((gate) => gate.gateType === 'quotation_commercial');
    const deliveryCompletionGate = gateStates.find((gate) => gate.gateType === 'delivery_completion');
    const missingDocuments = documents.filter((document) => ['missing', 'requested'].includes(String(document?.status || '').toLowerCase()));
    const overdueEtaCount = procurementLines.filter((line) => {
      const etaDate = projectHubText(line?.etaDate);
      if (!etaDate) return false;
      const deliveredEnough = projectHubNumber(line?.receivedQty, 0) >= Math.max(projectHubNumber(line?.orderedQty, 0), projectHubNumber(line?.contractQty, 0));
      return !deliveredEnough && etaDate.slice(0, 10) < new Date().toISOString().slice(0, 10);
    }).length;
    const shortageCount = procurementLines.filter((line) => projectHubNumber(line?.shortageQty, 0) > 0).length;
    const unorderedCount = procurementLines.filter((line) => projectHubNumber(line?.orderedQty, 0) < projectHubNumber(line?.contractQty, 0)).length;
    const overdueDeliveryCount = procurementLines.filter((line) => {
      const committed = projectHubText(line?.committedDeliveryDate);
      if (!committed) return false;
      const deliveredEnough = projectHubNumber(line?.deliveredQty, 0) >= projectHubNumber(line?.contractQty, 0);
      return !deliveredEnough && committed.slice(0, 10) < new Date().toISOString().slice(0, 10);
    }).length;
    const pendingMilestoneCount = milestones.filter((milestone) => String(milestone?.status || '').toLowerCase() !== 'completed').length;
    const openTaskCount = projectHubNumber(input.openTaskCount, 0);
    const overdueTaskCount = projectHubNumber(input.overdueTaskCount, 0);

    const items = [
      {
        id: 'commercial-gate',
        label: 'Commercial gate',
        status: quotationGate?.status === 'approved' ? 'ready' : quotationGate?.status === 'pending' || quotationGate?.status === 'changes_requested' ? 'warning' : 'blocked',
        detail: quotationGate
          ? `Quotation commercial đang ở trạng thái ${String(quotationGate.status || 'not_requested')}.`
          : 'Chưa có commercial gate phù hợp cho project này.',
        action: 'openApprovals',
      },
      {
        id: 'document-checklist',
        label: 'Document checklist',
        status: missingDocuments.length === 0 ? 'ready' : missingDocuments.length > 2 ? 'blocked' : 'warning',
        detail: missingDocuments.length === 0 ? 'Không còn hồ sơ thiếu hoặc requested.' : `${missingDocuments.length} hồ sơ đang thiếu hoặc mới chỉ requested.`,
        action: 'openDocuments',
      },
      {
        id: 'execution-queue',
        label: 'Execution queue',
        status: overdueTaskCount > 0 ? 'blocked' : openTaskCount > 0 || pendingMilestoneCount > 0 ? 'warning' : 'ready',
        detail: overdueTaskCount > 0 ? `${overdueTaskCount} task overdue đang chặn execution.` : `${openTaskCount} task mở · ${pendingMilestoneCount} milestone pending.`,
        action: 'openTasks',
      },
      {
        id: 'supply-readiness',
        label: 'Supply readiness',
        status: shortageCount > 0 || overdueEtaCount > 0 ? 'blocked' : unorderedCount > 0 ? 'warning' : 'ready',
        detail: shortageCount > 0 || overdueEtaCount > 0 ? `${shortageCount} line thiếu · ${overdueEtaCount} ETA trễ.` : unorderedCount > 0 ? `${unorderedCount} line chưa đặt mua đủ.` : 'Không có shortage hoặc ETA trễ đáng chú ý.',
        action: 'openProcurement',
      },
      {
        id: 'delivery-close',
        label: 'Delivery completion',
        status: overdueDeliveryCount > 0 ? 'blocked' : deliveryCompletionGate?.status === 'approved' ? 'ready' : deliveryCompletionGate?.status === 'pending' || deliveryCompletionGate?.status === 'changes_requested' ? 'warning' : 'blocked',
        detail: overdueDeliveryCount > 0 ? `${overdueDeliveryCount} line đã quá committed delivery date.` : deliveryCompletionGate ? `Delivery completion gate đang ở trạng thái ${String(deliveryCompletionGate.status || 'not_requested')}.` : 'Chưa có delivery completion gate.',
        action: overdueDeliveryCount > 0 ? 'openDelivery' : 'openApprovals',
      },
    ];

    const blockers = [
      ...gateStates.flatMap((gate: any) =>
        (Array.isArray(gate?.actionAvailability?.blockers) ? gate.actionAvailability.blockers : []).map((blocker: string, index: number) => ({
          id: `${gate.gateType}-blocker-${index}`,
          tone: 'danger',
          title: gate.title || gate.gateType || 'Workflow gate',
          detail: blocker,
          action: 'openApprovals',
        })),
      ),
      ...missingDocuments.slice(0, 3).map((document: any) => ({
        id: `document-${document.id}`,
        tone: 'warning',
        title: document.documentName || document.title || 'Document missing',
        detail: `${document.department || 'cross-functional'} · required at ${document.requiredAtStage || 'any stage'}`,
        action: 'openDocuments',
      })),
    ];

    if (shortageCount > 0) {
      blockers.push({
        id: 'shortage-lines',
        tone: 'danger',
        title: 'Procurement shortage',
        detail: `${shortageCount} line đang thiếu so với contract/ordered quantity.`,
        action: 'openProcurement',
      });
    }
    if (overdueTaskCount > 0) {
      blockers.push({
        id: 'overdue-tasks',
        tone: 'warning',
        title: 'Execution overdue',
        detail: `${overdueTaskCount} task overdue cần kéo lại ngay.`,
        action: 'openTasks',
      });
    }
    if (overdueDeliveryCount > 0) {
      blockers.push({
        id: 'delivery-overdue',
        tone: 'danger',
        title: 'Delivery pressure',
        detail: `${overdueDeliveryCount} line đã quá committed delivery date.`,
        action: 'openDelivery',
      });
    }

    const readyCount = items.filter((item) => item.status === 'ready').length;
    const readinessScore = Math.round((readyCount / Math.max(items.length, 1)) * 100);
    const readinessTone = readinessScore >= 80 ? 'good' : readinessScore >= 50 ? 'warn' : 'bad';
    const nextStepLabel =
      ['quoting', 'negotiating', 'internal-review'].includes(stage)
        ? 'Commercial approval / sales order'
        : ['commercial_approved', 'won', 'order_released', 'procurement_active'].includes(stage)
          ? 'Procurement readiness'
          : ['delivery_active', 'delivery'].includes(stage)
            ? 'Delivery completion'
            : 'Project close / operating review';

    return {
      stageLabel: stage,
      nextStepLabel,
      readinessScore,
      readinessTone,
      summary:
        readinessTone === 'good'
          ? `Project đang khá sạch để đi tiếp sang bước ${nextStepLabel.toLowerCase()}.`
          : readinessTone === 'warn'
            ? `Project có thể đi tiếp nhưng nên dọn một số warning trước khi sang ${nextStepLabel.toLowerCase()}.`
            : `Project chưa sẵn sàng cho bước ${nextStepLabel.toLowerCase()}; cần xử lý blockers trước.`,
      items,
      blockers: blockers.slice(0, 6),
    };
  }

  function buildWorkspaceBlockerRegister(input: {
    phaseControl?: any;
    gateStates?: any[];
    actionAvailability?: any;
    documents?: any[];
    tasks?: any[];
    manualBlockers?: any[];
  }) {
    const phaseBlockers = Array.isArray(input.phaseControl?.blockers) ? input.phaseControl.blockers : [];
    const gateStates = Array.isArray(input.gateStates) ? input.gateStates : [];
    const documents = Array.isArray(input.documents) ? input.documents : [];
    const tasks = Array.isArray(input.tasks) ? input.tasks : [];
    const salesOrderBlockers = Array.isArray(input.actionAvailability?.salesOrder?.blockers) ? input.actionAvailability.salesOrder.blockers : [];
    const logisticsBlockers = Array.isArray(input.actionAvailability?.project?.logisticsBlockers) ? input.actionAvailability.project.logisticsBlockers : [];
    const overdueTasks = tasks.filter((task) => {
      const dueDate = projectHubText(task?.dueDate);
      return Boolean(dueDate) && dueDate.slice(0, 10) < new Date().toISOString().slice(0, 10) && String(task?.status || '').toLowerCase() !== 'completed';
    });
    const manualBlockers = Array.isArray(input.manualBlockers) ? input.manualBlockers : [];

    const register = [
      ...manualBlockers.map((blocker: any) => ({
        id: blocker.id,
        source: blocker.source || 'manual',
        category: blocker.category || 'workflow',
        tone: blocker.tone || 'warning',
        title: blocker.title || 'Manual blocker',
        detail: blocker.detail || 'Manual blocker',
        action: blocker.action || null,
        owner: blocker.ownerRole || blocker.createdByName || null,
        ownerRole: blocker.ownerRole || null,
        status: blocker.status || 'open',
        linkedEntityType: blocker.linkedEntityType || null,
        linkedEntityId: blocker.linkedEntityId || null,
        isManual: true,
        createdAt: blocker.createdAt || null,
        resolvedAt: blocker.resolvedAt || null,
      })),
      ...phaseBlockers.map((blocker: any, index: number) => ({
        id: blocker.id || `phase-control-${index}`,
        source: 'phase_control',
        category: 'workflow',
        tone: blocker.tone || 'warning',
        title: blocker.title || 'Blocker giai đoạn',
        detail: blocker.detail || blocker.description || 'Project chưa sẵn sàng để đi tiếp.',
        action: blocker.action || null,
        owner: 'cross-functional',
      })),
      ...gateStates.flatMap((gate: any) =>
        (Array.isArray(gate?.actionAvailability?.blockers) ? gate.actionAvailability.blockers : []).map((detail: string, index: number) => ({
          id: `${gate.gateType}-gate-${index}`,
          source: 'approval_gate',
          category: 'approval',
          tone: gate.gateType === 'delivery_completion' ? 'danger' : 'warning',
          title: gate.title || gate.gateType || 'Approval gate',
          detail,
          action: 'openApprovals',
          owner: gate.pendingApprovers?.[0]?.approverRole || null,
          ownerRole: gate.pendingApprovers?.[0]?.approverRole || null,
        })),
      ),
      ...salesOrderBlockers.map((detail: string, index: number) => ({
        id: `sales-order-${index}`,
        source: 'sales_order',
        category: 'commercial',
        tone: 'warning',
        title: 'Sales order release',
        detail,
        action: 'openCommercial',
        owner: 'project_manager',
        ownerRole: 'project_manager',
      })),
      ...logisticsBlockers.map((detail: string, index: number) => ({
        id: `logistics-${index}`,
        source: 'logistics',
        category: 'execution',
        tone: 'danger',
        title: 'Logistics / delivery',
        detail,
        action: 'openDelivery',
        owner: 'procurement',
        ownerRole: 'procurement',
      })),
      ...documents
        .filter((document) => ['missing', 'requested', 'rejected'].includes(String(document?.status || '').toLowerCase()))
        .slice(0, 6)
        .map((document) => ({
          id: `document-${document.id}`,
          source: 'document_checklist',
          category: 'documents',
          tone: String(document.status || '').toLowerCase() === 'rejected' ? 'danger' : 'warning',
          title: document.documentName || document.documentCode || 'Checklist document',
          detail: `${document.department || 'cross-functional'} · required at ${document.requiredAtStage || 'any stage'} · status ${String(document.status || 'missing')}.`,
          action: 'openDocuments',
          owner: document.department || null,
          ownerRole: document.department || null,
        })),
      ...overdueTasks.slice(0, 6).map((task: any) => ({
        id: `task-${task.id}`,
        source: 'task',
        category: 'execution',
        tone: 'warning',
        title: task.title || 'Task overdue',
        detail: `Due ${projectHubText(task.dueDate) || 'n/a'} · owner ${projectHubText(task.assigneeName || task.assigneeId) || 'unassigned'}.`,
        action: 'openTasks',
        owner: task.assigneeId || null,
        ownerRole: null,
      })),
    ];

    return register
      .filter((item) => String(item.status || 'open').toLowerCase() !== 'resolved')
      .slice(0, 16);
  }

  function buildWorkspaceAuditTrail(input: {
    approvals?: any[];
    timeline?: any[];
    activities?: any[];
  }) {
    const approvals = Array.isArray(input.approvals) ? input.approvals : [];
    const timeline = Array.isArray(input.timeline) ? input.timeline : [];
    const activities = Array.isArray(input.activities) ? input.activities : [];

    return [
      ...approvals.map((approval: any) => ({
        id: `approval-${approval.id}`,
        source: 'approval',
        category: resolveApprovalLane(approval),
        title: approval.title || approval.requestType || approval.id,
        detail: approval.note || approval.description || 'Approval request',
        status: approval.status || 'pending',
        actor: approval.approverName || approval.approverRole || approval.requestedByName || null,
        entityType: 'ApprovalRequest',
        entityId: approval.id,
        linkedEntityType: approval.quotationId ? 'Quotation' : 'Project',
        linkedEntityId: approval.quotationId || approval.projectId || null,
        eventDate: approval.updatedAt || approval.createdAt || null,
      })),
      ...timeline.map((event: any) => ({
        id: `timeline-${event.id}`,
        source: 'timeline',
        category: event.eventType || 'timeline',
        title: event.title || event.eventType || event.id,
        detail: event.description || 'Timeline event',
        status: null,
        actor: event.createdBy || null,
        entityType: event.entityType || 'ProjectTimelineEvent',
        entityId: event.entityId || event.id,
        linkedEntityType: event.entityType || null,
        linkedEntityId: event.entityId || null,
        eventDate: event.eventDate || event.createdAt || null,
      })),
      ...activities.map((activity: any) => ({
        id: `activity-${activity.id}`,
        source: 'activity',
        category: activity.entityType || 'activity',
        title: activity.action || activity.entityType || activity.id,
        detail: activity.description || activity.note || 'Activity log',
        status: null,
        actor: activity.actorDisplayName || activity.userName || activity.actorRoles || 'system',
        entityType: activity.entityType || 'Activity',
        entityId: activity.entityId || activity.id,
        linkedEntityType: activity.entityType || null,
        linkedEntityId: activity.entityId || null,
        actorRoles: activity.actorRoles || null,
        actingCapability: activity.actingCapability || null,
        eventDate: activity.timestamp || activity.createdAt || null,
      })),
    ]
      .sort((left, right) => String(right.eventDate || '').localeCompare(String(left.eventDate || '')))
      .slice(0, 16);
  }

  async function createProjectTimelineEvent(
    db: any,
    event: {
      projectId: number | string;
      eventType: string;
      title: string;
      description?: string | null;
      eventDate?: string | null;
      entityType?: string | null;
      entityId?: number | string | null;
      payload?: any;
      createdBy?: number | string | null;
    }
  ) {
    const result = await projectRepository.insertTimelineEvent({
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
    return projectRepository.findTimelineEventById(result.lastID);
  }

  async function recalculateProjectProcurementRollup(db: any, procurementLineId: number | string) {
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

  async function syncProjectProcurementLinesFromBaseline(db: any, projectId: number | string, baselineId: number | string) {
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

      const contractQty = projectHubNumber(lineItem.contractQty, 0);
      const result = await projectRepository.insertProcurementLine({
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
      await recalculateProjectProcurementRollup(db, result.lastID);
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
      projectId: number | string;
      sourceType: 'main_contract' | 'appendix';
      sourceId: number | string;
      title: string;
      effectiveDate?: string | null;
      currency?: string | null;
      totalValue?: number | null;
      lineItems?: any[];
      createdBy?: number | string | null;
    }
  ) {
    const lineItems = normalizeContractLineItems(params.lineItems || []);
    const baselineNoRow = await projectRepository.findMaxBaselineNo(params.projectId);
    const baselineNo = projectHubNumber(baselineNoRow?.maxBaselineNo, 0) + 1;

    await projectRepository.clearCurrentExecutionBaseline(params.projectId);
    const result = await projectRepository.insertExecutionBaseline({
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

    const id = result.lastID;
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
      manualBlockers,
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
      projectRepository.listProjectBlockers(projectId),
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
      documents,
    });
    const salesOrderReleaseGate = approvalGateStates.find((gate: any) => gate.gateType === 'sales_order_release');
    const handoffActivation = resolveHandoffActivation({
      quotationId: quotations[0]?.id || null,
      quotationStatus: quotations[0]?.status || null,
      salesOrderId: salesOrders[0]?.id || null,
      salesOrderStatus: salesOrders[0]?.status || null,
      releaseGateStatus: salesOrderReleaseGate?.status || null,
      canCreateSalesOrder: actionAvailability?.quotation?.canCreateSalesOrder,
      canRequestReleaseApproval: actionAvailability?.salesOrder?.canRequestReleaseApproval,
      canReleaseSalesOrder: actionAvailability?.salesOrder?.canReleaseLatest,
      quotationBlockers: actionAvailability?.quotation?.blockers,
      salesOrderBlockers: actionAvailability?.salesOrder?.blockers,
    });
    const phaseControl = buildWorkspacePhaseControl({
      projectStage: project.projectStage,
      actionAvailability,
      gateStates: approvalGateStates,
      documents,
      procurementLines: procurementRows,
      milestones: milestoneRows,
      taskCount: tasks.length,
      openTaskCount: tasks.filter((task: any) => String(task?.status || '').toLowerCase() !== 'completed').length,
      overdueTaskCount: tasks.filter((task: any) => {
        const dueDate = projectHubText(task?.dueDate);
        return Boolean(dueDate) && dueDate.slice(0, 10) < new Date().toISOString().slice(0, 10) && String(task?.status || '').toLowerCase() !== 'completed';
      }).length,
      deliveryLines: deliveryRows,
    });
    const blockerRegister = buildWorkspaceBlockerRegister({
      phaseControl,
      gateStates: approvalGateStates,
      actionAvailability,
      documents,
      manualBlockers,
      tasks,
    });
    const auditTrail = buildWorkspaceAuditTrail({
      approvals: decoratedApprovals,
      timeline: timelineRows.map((row: any) => ({
        ...row,
        payload: parseProjectHubJson(row.payload, null),
      })),
      activities,
    });
    const normalizedTimeline = timelineRows.map((row: any) => ({
      ...row,
      payload: parseProjectHubJson(row.payload, null),
    }));

    return {
      ...project,
      quotations,
      supplierQuotes,
      tasks,
      activities,
      approvals: decoratedApprovals,
      approvalGateStates,
      handoffActivation,
      pendingApproverState: approvalGateStates.map((gate) => ({
        gateType: gate.gateType,
        title: gate.title,
        status: gate.status,
        pendingCount: gate.pendingCount,
        pendingApprovers: gate.pendingApprovers,
      })),
      actionAvailability,
      phaseControl,
      blockerRegister,
      auditTrail,
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
      timeline: normalizedTimeline,
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
    buildWorkspacePhaseControl,
    createProjectTimelineEvent,
    recalculateProjectProcurementRollup,
    syncProjectProcurementLinesFromBaseline,
    createExecutionBaselineFromSource,
    getProjectWorkspaceById,
  };
}
