import { getDb } from '../../../sqlite-db';

export function createProjectExecutionRepository() {
  async function listExecutionBaselines(projectId: string) {
    return getDb().all(
      `
        SELECT *
        FROM ProjectExecutionBaseline
        WHERE projectId = ?
        ORDER BY baselineNo ASC, createdAt ASC
      `,
      [projectId]
    );
  }

  async function listProcurementLines(projectId: string) {
    return getDb().all(
      `
        SELECT ppl.*, a.companyName AS supplierName
        FROM ProjectProcurementLine ppl
        LEFT JOIN Account a ON ppl.supplierId = a.id
        WHERE ppl.projectId = ?
        ORDER BY ppl.isActive DESC, ppl.createdAt ASC, ppl.id ASC
      `,
      [projectId]
    );
  }

  async function findProcurementLineById(id: string) {
    return getDb().get(`SELECT * FROM ProjectProcurementLine WHERE id = ?`, [id]);
  }

  async function findProcurementLineByIdForProject(id: string, projectId: string) {
    return getDb().get(
      `SELECT * FROM ProjectProcurementLine WHERE id = ? AND projectId = ?`,
      [id, projectId]
    );
  }

  async function updateProcurementLineById(input: {
    id: string;
    supplierId?: string | null;
    poNumber?: string | null;
    orderedQty: number;
    etaDate?: string | null;
    committedDeliveryDate?: string | null;
    status: string;
    note?: string | null;
  }) {
    await getDb().run(
      `UPDATE ProjectProcurementLine
       SET supplierId = ?, poNumber = ?, orderedQty = ?, etaDate = ?, committedDeliveryDate = ?, status = ?, note = ?, updatedAt = datetime('now')
       WHERE id = ?`,
      [
        input.supplierId || null,
        input.poNumber || null,
        input.orderedQty,
        input.etaDate || null,
        input.committedDeliveryDate || null,
        input.status,
        input.note || null,
        input.id,
      ]
    );
  }

  async function findInboundTotalsByProcurementLineId(procurementLineId: string) {
    return getDb().get(
      `SELECT
         COALESCE(SUM(receivedQty), 0) AS totalQty,
         MAX(actualReceivedDate) AS actualReceivedDate
       FROM ProjectInboundLine
       WHERE procurementLineId = ?`,
      [procurementLineId]
    );
  }

  async function findDeliveryTotalsByProcurementLineId(procurementLineId: string) {
    return getDb().get(
      `SELECT
         COALESCE(SUM(deliveredQty), 0) AS totalQty,
         MAX(actualDeliveryDate) AS actualDeliveryDate
       FROM ProjectDeliveryLine
       WHERE procurementLineId = ?`,
      [procurementLineId]
    );
  }

  async function updateProcurementLineRollup(input: {
    procurementLineId: string;
    receivedQty: number;
    deliveredQty: number;
    shortageQty: number;
    shortageStatus: string;
    status: string;
    actualReceivedDate?: string | null;
    actualDeliveryDate?: string | null;
  }) {
    await getDb().run(
      `UPDATE ProjectProcurementLine
       SET receivedQty = ?, deliveredQty = ?, shortageQty = ?, shortageStatus = ?, status = ?,
           actualReceivedDate = ?, actualDeliveryDate = ?, updatedAt = datetime('now')
       WHERE id = ?`,
      [
        input.receivedQty,
        input.deliveredQty,
        input.shortageQty,
        input.shortageStatus,
        input.status,
        input.actualReceivedDate || null,
        input.actualDeliveryDate || null,
        input.procurementLineId,
      ]
    );
  }

  async function updateProcurementLineFromBaseline(input: {
    id: string;
    baselineId: string;
    itemCode?: string | null;
    itemName?: string | null;
    description?: string | null;
    unit?: string | null;
    contractQty: number;
    etaDate?: string | null;
    committedDeliveryDate?: string | null;
    shortageQty: number;
  }) {
    await getDb().run(
      `UPDATE ProjectProcurementLine
       SET baselineId = ?, isActive = 1, supersededAt = NULL, supersededByBaselineId = NULL,
           itemCode = ?, itemName = ?, description = ?, unit = ?, contractQty = ?,
           etaDate = ?, committedDeliveryDate = ?, shortageQty = ?, updatedAt = datetime('now')
       WHERE id = ?`,
      [
        input.baselineId,
        input.itemCode || null,
        input.itemName || null,
        input.description || null,
        input.unit || null,
        input.contractQty,
        input.etaDate || null,
        input.committedDeliveryDate || null,
        input.shortageQty,
        input.id,
      ]
    );
  }

  async function insertProcurementLine(input: {
    id: string;
    projectId: string;
    baselineId: string;
    sourceLineKey: string;
    itemCode?: string | null;
    itemName?: string | null;
    description?: string | null;
    unit?: string | null;
    contractQty: number;
    shortageQty: number;
    etaDate?: string | null;
    committedDeliveryDate?: string | null;
  }) {
    await getDb().run(
      `INSERT INTO ProjectProcurementLine (
        id, projectId, baselineId, sourceLineKey, isActive, itemCode, itemName, description, unit,
        contractQty, orderedQty, receivedQty, deliveredQty, shortageQty, shortageStatus,
        etaDate, committedDeliveryDate, status, note
      ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, 0, 0, 0, ?, 'pending', ?, ?, 'planned', NULL)`,
      [
        input.id,
        input.projectId,
        input.baselineId,
        input.sourceLineKey,
        input.itemCode || null,
        input.itemName || null,
        input.description || null,
        input.unit || null,
        input.contractQty,
        input.shortageQty,
        input.etaDate || null,
        input.committedDeliveryDate || null,
      ]
    );
  }

  async function retireProcurementLine(input: {
    id: string;
    supersededAt: string;
    supersededByBaselineId: string;
  }) {
    await getDb().run(
      `UPDATE ProjectProcurementLine
       SET isActive = 0, status = 'superseded', supersededAt = ?, supersededByBaselineId = ?, updatedAt = datetime('now')
       WHERE id = ?`,
      [input.supersededAt, input.supersededByBaselineId, input.id]
    );
  }

  async function listInboundLines(projectId: string) {
    return getDb().all(
      `
        SELECT pil.*, ppl.itemCode, ppl.itemName, ppl.description AS procurementDescription,
               ppl.isActive AS procurementIsActive, ppl.supersededAt AS procurementSupersededAt
        FROM ProjectInboundLine pil
        LEFT JOIN ProjectProcurementLine ppl ON pil.procurementLineId = ppl.id
        WHERE pil.projectId = ?
        ORDER BY COALESCE(pil.actualReceivedDate, pil.createdAt) DESC, pil.createdAt DESC
      `,
      [projectId]
    );
  }

  async function findInboundLineById(id: string) {
    return getDb().get(`SELECT * FROM ProjectInboundLine WHERE id = ?`, [id]);
  }

  async function insertInboundLine(input: {
    id: string;
    projectId: string;
    procurementLineId: string;
    baselineId?: string | null;
    sourceLineKey?: string | null;
    receivedQty: number;
    etaDate?: string | null;
    actualReceivedDate?: string | null;
    status: string;
    receiptRef?: string | null;
    note?: string | null;
    createdBy?: string | null;
  }) {
    await getDb().run(
      `INSERT INTO ProjectInboundLine (
        id, projectId, procurementLineId, baselineId, sourceLineKey, receivedQty, etaDate, actualReceivedDate, status, receiptRef, note, createdBy
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.projectId,
        input.procurementLineId,
        input.baselineId || null,
        input.sourceLineKey || null,
        input.receivedQty,
        input.etaDate || null,
        input.actualReceivedDate || null,
        input.status,
        input.receiptRef || null,
        input.note || null,
        input.createdBy || null,
      ]
    );
  }

  async function updateInboundLineById(input: {
    id: string;
    procurementLineId: string;
    baselineId?: string | null;
    sourceLineKey?: string | null;
    receivedQty: number;
    etaDate?: string | null;
    actualReceivedDate?: string | null;
    status: string;
    receiptRef?: string | null;
    note?: string | null;
  }) {
    await getDb().run(
      `UPDATE ProjectInboundLine
       SET procurementLineId = ?, baselineId = ?, sourceLineKey = ?, receivedQty = ?, etaDate = ?, actualReceivedDate = ?,
           status = ?, receiptRef = ?, note = ?, updatedAt = datetime('now')
       WHERE id = ?`,
      [
        input.procurementLineId,
        input.baselineId || null,
        input.sourceLineKey || null,
        input.receivedQty,
        input.etaDate || null,
        input.actualReceivedDate || null,
        input.status,
        input.receiptRef || null,
        input.note || null,
        input.id,
      ]
    );
  }

  async function listDeliveryLines(projectId: string) {
    return getDb().all(
      `
        SELECT pdl.*, ppl.itemCode, ppl.itemName, ppl.description AS procurementDescription,
               ppl.isActive AS procurementIsActive, ppl.supersededAt AS procurementSupersededAt
        FROM ProjectDeliveryLine pdl
        LEFT JOIN ProjectProcurementLine ppl ON pdl.procurementLineId = ppl.id
        WHERE pdl.projectId = ?
        ORDER BY COALESCE(pdl.actualDeliveryDate, pdl.createdAt) DESC, pdl.createdAt DESC
      `,
      [projectId]
    );
  }

  async function findDeliveryLineById(id: string) {
    return getDb().get(`SELECT * FROM ProjectDeliveryLine WHERE id = ?`, [id]);
  }

  async function insertDeliveryLine(input: {
    id: string;
    projectId: string;
    procurementLineId: string;
    baselineId?: string | null;
    sourceLineKey?: string | null;
    deliveredQty: number;
    committedDate?: string | null;
    actualDeliveryDate?: string | null;
    status: string;
    deliveryRef?: string | null;
    note?: string | null;
    createdBy?: string | null;
  }) {
    await getDb().run(
      `INSERT INTO ProjectDeliveryLine (
        id, projectId, procurementLineId, baselineId, sourceLineKey, deliveredQty, committedDate, actualDeliveryDate, status, deliveryRef, note, createdBy
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.projectId,
        input.procurementLineId,
        input.baselineId || null,
        input.sourceLineKey || null,
        input.deliveredQty,
        input.committedDate || null,
        input.actualDeliveryDate || null,
        input.status,
        input.deliveryRef || null,
        input.note || null,
        input.createdBy || null,
      ]
    );
  }

  async function updateDeliveryLineById(input: {
    id: string;
    procurementLineId: string;
    baselineId?: string | null;
    sourceLineKey?: string | null;
    deliveredQty: number;
    committedDate?: string | null;
    actualDeliveryDate?: string | null;
    status: string;
    deliveryRef?: string | null;
    note?: string | null;
  }) {
    await getDb().run(
      `UPDATE ProjectDeliveryLine
       SET procurementLineId = ?, baselineId = ?, sourceLineKey = ?, deliveredQty = ?, committedDate = ?, actualDeliveryDate = ?,
           status = ?, deliveryRef = ?, note = ?, updatedAt = datetime('now')
       WHERE id = ?`,
      [
        input.procurementLineId,
        input.baselineId || null,
        input.sourceLineKey || null,
        input.deliveredQty,
        input.committedDate || null,
        input.actualDeliveryDate || null,
        input.status,
        input.deliveryRef || null,
        input.note || null,
        input.id,
      ]
    );
  }

  async function listMilestones(projectId: string) {
    return getDb().all(
      `
        SELECT *
        FROM ProjectMilestone
        WHERE projectId = ?
        ORDER BY COALESCE(actualDate, plannedDate, createdAt) ASC, createdAt ASC
      `,
      [projectId]
    );
  }

  async function findMilestoneById(id: string) {
    return getDb().get(`SELECT * FROM ProjectMilestone WHERE id = ?`, [id]);
  }

  async function insertMilestone(input: {
    id: string;
    projectId: string;
    milestoneType?: string | null;
    title: string;
    plannedDate?: string | null;
    actualDate?: string | null;
    status: string;
    note?: string | null;
    createdBy?: string | null;
  }) {
    await getDb().run(
      `INSERT INTO ProjectMilestone (
        id, projectId, milestoneType, title, plannedDate, actualDate, status, note, createdBy
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.projectId,
        input.milestoneType || null,
        input.title,
        input.plannedDate || null,
        input.actualDate || null,
        input.status,
        input.note || null,
        input.createdBy || null,
      ]
    );
  }

  async function updateMilestoneById(input: {
    id: string;
    milestoneType?: string | null;
    title: string;
    plannedDate?: string | null;
    actualDate?: string | null;
    status: string;
    note?: string | null;
  }) {
    await getDb().run(
      `UPDATE ProjectMilestone
       SET milestoneType = ?, title = ?, plannedDate = ?, actualDate = ?, status = ?, note = ?, updatedAt = datetime('now')
       WHERE id = ?`,
      [
        input.milestoneType || null,
        input.title,
        input.plannedDate || null,
        input.actualDate || null,
        input.status,
        input.note || null,
        input.id,
      ]
    );
  }

  async function listTimelineEvents(projectId: string) {
    return getDb().all(
      `
        SELECT *
        FROM ProjectTimelineEvent
        WHERE projectId = ?
        ORDER BY COALESCE(eventDate, createdAt) DESC, createdAt DESC
      `,
      [projectId]
    );
  }

  async function insertTimelineEvent(event: {
    id: string;
    projectId: string;
    eventType: string;
    title: string;
    description?: string | null;
    eventDate?: string | null;
    entityType?: string | null;
    entityId?: string | null;
    payload?: string | null;
    createdBy?: string | null;
  }) {
    await getDb().run(
      `INSERT INTO ProjectTimelineEvent (
        id, projectId, eventType, title, description, eventDate, entityType, entityId, payload, createdBy
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event.id,
        event.projectId,
        event.eventType,
        event.title,
        event.description || null,
        event.eventDate || null,
        event.entityType || null,
        event.entityId || null,
        event.payload || null,
        event.createdBy || null,
      ]
    );
  }

  async function findTimelineEventById(id: string) {
    return getDb().get(`SELECT * FROM ProjectTimelineEvent WHERE id = ?`, [id]);
  }

  async function findExecutionBaselineById(id: string) {
    return getDb().get(`SELECT * FROM ProjectExecutionBaseline WHERE id = ?`, [id]);
  }

  async function findMaxBaselineNo(projectId: string) {
    return getDb().get(
      `SELECT COALESCE(MAX(baselineNo), 0) AS maxBaselineNo
       FROM ProjectExecutionBaseline
       WHERE projectId = ?`,
      [projectId]
    );
  }

  async function clearCurrentExecutionBaseline(projectId: string) {
    await getDb().run(
      `UPDATE ProjectExecutionBaseline SET isCurrent = 0, updatedAt = datetime('now') WHERE projectId = ?`,
      [projectId]
    );
  }

  async function insertExecutionBaseline(input: {
    id: string;
    projectId: string;
    sourceType: 'main_contract' | 'appendix';
    sourceId: string;
    baselineNo: number;
    title: string;
    effectiveDate?: string | null;
    currency?: string | null;
    totalValue: number;
    lineItems: string;
    createdBy?: string | null;
  }) {
    await getDb().run(
      `INSERT INTO ProjectExecutionBaseline (
        id, projectId, sourceType, sourceId, baselineNo, title, effectiveDate, currency, totalValue, lineItems, isCurrent, createdBy
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [
        input.id,
        input.projectId,
        input.sourceType,
        input.sourceId,
        input.baselineNo,
        input.title,
        input.effectiveDate || null,
        input.currency || 'VND',
        input.totalValue,
        input.lineItems,
        input.createdBy || null,
      ]
    );
  }

  return {
    listExecutionBaselines,
    listProcurementLines,
    findProcurementLineById,
    findProcurementLineByIdForProject,
    updateProcurementLineById,
    findInboundTotalsByProcurementLineId,
    findDeliveryTotalsByProcurementLineId,
    updateProcurementLineRollup,
    updateProcurementLineFromBaseline,
    insertProcurementLine,
    retireProcurementLine,
    listInboundLines,
    findInboundLineById,
    insertInboundLine,
    updateInboundLineById,
    listDeliveryLines,
    findDeliveryLineById,
    insertDeliveryLine,
    updateDeliveryLineById,
    listMilestones,
    findMilestoneById,
    insertMilestone,
    updateMilestoneById,
    listTimelineEvents,
    insertTimelineEvent,
    findTimelineEventById,
    findExecutionBaselineById,
    findMaxBaselineNo,
    clearCurrentExecutionBaseline,
    insertExecutionBaseline,
  };
}
