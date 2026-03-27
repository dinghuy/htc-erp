import { v4 as uuidv4 } from 'uuid';
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

  async function getProjectWorkspaceById(db: any, projectId: string) {
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

    return {
      ...project,
      quotations,
      supplierQuotes,
      tasks,
      activities,
      approvals,
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
