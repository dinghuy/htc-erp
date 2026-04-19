export const QBU_PROCUREMENT_REQUEST_TYPE = 'pricing-qbu-procurement';
export const QBU_FINANCE_REQUEST_TYPE = 'pricing-qbu-finance';

type QbuWorkflowContext = {
  pricingQuotationId: string;
  projectId: string;
  batchNo: number;
  actorUserId?: string | null;
  projectCode?: string | null;
};

function batchLabel(batchNo: number) {
  return batchNo > 0 ? `Bo sung dot ${batchNo}` : 'QBU goc';
}

function stringifySnapshot(payload: unknown) {
  return JSON.stringify(payload);
}

async function selectApproverUser(db: any, department: string) {
  const normalizedDepartment = String(department || '').trim().toLowerCase();
  const roleCandidates =
    normalizedDepartment === 'procurement'
      ? ['procurement', 'manager', 'admin']
      : normalizedDepartment === 'finance'
        ? ['accounting', 'manager', 'admin']
        : normalizedDepartment === 'legal'
          ? ['legal', 'manager', 'admin']
          : ['manager', 'admin'];
  return db.get(
    `SELECT id
     FROM User
     WHERE LOWER(COALESCE(department, '')) = LOWER(?)
        OR LOWER(COALESCE(systemRole, '')) IN (${roleCandidates.map(() => '?').join(', ')})
     ORDER BY
       CASE
         WHEN LOWER(COALESCE(department, '')) = LOWER(?) THEN 0
         WHEN LOWER(COALESCE(systemRole, '')) = ? THEN 1
         ELSE 2
       END,
       createdAt ASC
     LIMIT 1`,
    [department, ...roleCandidates, department, roleCandidates[0]]
  );
}

async function createTaskIfMissing(
  db: any,
  params: {
    projectId: string;
    pricingQuotationId: string;
    department: string;
    taskType: string;
    name: string;
    description: string;
  }
) {
  const existing = await db.get(
    `SELECT id
     FROM Task
     WHERE projectId = ? AND department = ? AND taskType = ? AND notes = ?`,
    [params.projectId, params.department, params.taskType, `QBU:${params.pricingQuotationId}:${params.taskType}`]
  );
  if (existing) return existing;
  const result = await db.run(
    `INSERT INTO Task (
      projectId, name, description, status, priority, startDate, dueDate, completionPct,
      notes, taskType, department, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [
      params.projectId,
      params.name,
      params.description,
      'pending',
      'high',
      new Date().toISOString().slice(0, 10),
      new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      0,
      `QBU:${params.pricingQuotationId}:${params.taskType}`,
      params.taskType,
      params.department,
    ]
  );
  return db.get('SELECT * FROM Task WHERE id = ?', [result.lastID]);
}

export async function createQbuApprovalStage(
  db: any,
  params: QbuWorkflowContext & {
    requestType: string;
    department: 'Procurement' | 'Finance';
    title: string;
    lineItems: any[];
  }
) {
  const existing = await db.get(
    `SELECT *
     FROM ApprovalRequest
     WHERE projectId = ? AND pricingQuotationId = ? AND requestType = ?`,
    [params.projectId, params.pricingQuotationId, params.requestType]
  );
  if (existing) return existing;

  const approver = await selectApproverUser(db, params.department);
  const taskType = params.department === 'Procurement' ? 'supplier_quote' : 'internal_review';
  await createTaskIfMissing(db, {
    projectId: params.projectId,
    pricingQuotationId: params.pricingQuotationId,
    department: params.department,
    taskType,
    name: params.title,
    description: stringifySnapshot({
      projectCode: params.projectCode || null,
      batchNo: params.batchNo,
      requestType: params.requestType,
      items: params.lineItems,
    }),
  });

  const result = await db.run(
    `INSERT INTO ApprovalRequest (
      projectId, pricingQuotationId, quotationId, requestType, title, department,
      requestedBy, approverRole, approverUserId, status, dueDate, note, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [
      params.projectId,
      params.pricingQuotationId,
      null,
      params.requestType,
      params.title,
      params.department,
      params.actorUserId || null,
      'manager',
      approver?.id || null,
      'pending',
      new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      stringifySnapshot({
        kind: 'pricing-qbu',
        pricingQuotationId: params.pricingQuotationId,
        batchNo: params.batchNo,
        items: params.lineItems,
      }),
    ]
  );
  return db.get('SELECT * FROM ApprovalRequest WHERE id = ?', [result.lastID]);
}

export async function handleQbuApprovalDecision(db: any, approval: any) {
  if (!approval?.pricingQuotationId) return null;
  if (approval.status !== 'approved') return null;
  if (![QBU_PROCUREMENT_REQUEST_TYPE, QBU_FINANCE_REQUEST_TYPE].includes(String(approval.requestType || ''))) return null;

  const qbu = await db.get('SELECT * FROM PricingQuotation WHERE id = ?', [approval.pricingQuotationId]);
  if (!qbu) return null;

  const lineItems = await db.all(
    `SELECT id, description, section, costRoutingType, buyUnitPriceVnd, buyUnitPriceUsd, sellUnitPriceVnd, unitCount
     FROM PricingLineItem
     WHERE quotationId = ?
     ORDER BY sortOrder ASC, createdAt ASC`,
    [approval.pricingQuotationId]
  );

  if (approval.requestType === QBU_PROCUREMENT_REQUEST_TYPE) {
    const financeItems = lineItems.filter((item: any) => item.costRoutingType === 'OTHER_COST');
    if (!financeItems.length) {
      await db.run(
        `UPDATE PricingQuotation
         SET qbuWorkflowStage = 'completed', qbuCompletedAt = COALESCE(qbuCompletedAt, ?), updatedAt = datetime('now')
         WHERE id = ?`,
        [new Date().toISOString(), approval.pricingQuotationId]
      );
      return { stage: 'completed' };
    }

    await createQbuApprovalStage(db, {
      pricingQuotationId: approval.pricingQuotationId,
      projectId: qbu.projectId,
      batchNo: Number(qbu.batchNo || 0),
      actorUserId: approval.decidedBy || approval.requestedBy || null,
      projectCode: qbu.projectCode || null,
      requestType: QBU_FINANCE_REQUEST_TYPE,
      department: 'Finance',
      title: `QBU Finance Review - ${batchLabel(Number(qbu.batchNo || 0))}`,
      lineItems: financeItems,
    });
    await db.run(
      `UPDATE PricingQuotation
       SET qbuWorkflowStage = 'finance_review', updatedAt = datetime('now')
       WHERE id = ?`,
      [approval.pricingQuotationId]
    );
    return { stage: 'finance_review' };
  }

  await db.run(
    `UPDATE PricingQuotation
     SET qbuWorkflowStage = 'completed', qbuCompletedAt = COALESCE(qbuCompletedAt, ?), updatedAt = datetime('now')
     WHERE id = ?`,
    [new Date().toISOString(), approval.pricingQuotationId]
  );
  return { stage: 'completed' };
}
