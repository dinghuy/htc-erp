import { getDb } from '../../../sqlite-db';

export function createSalesOrderRepository() {
  async function listDetailed(limit: number) {
    return getDb().all(
      `SELECT so.*,
              a.companyName AS accountName,
              q.projectId AS projectId,
              q.quoteNumber AS quotationNumber,
              q.subject AS quotationSubject,
              q.status AS quotationStatus
       FROM SalesOrder so
       LEFT JOIN Account a ON so.accountId = a.id
       LEFT JOIN Quotation q ON so.quotationId = q.id
       ORDER BY so.createdAt DESC, so.id DESC
       LIMIT ?`,
      [limit],
    );
  }

  async function listReleaseApprovalsByProjectIds(projectIds: Array<number | string>) {
    if (!projectIds.length) return [];
    const placeholders = projectIds.map(() => '?').join(', ');
    return getDb().all(
      `SELECT ar.*,
              approver.fullName AS approverName,
              requester.fullName AS requestedByName
       FROM ApprovalRequest ar
       LEFT JOIN User approver ON ar.approverUserId = approver.id
       LEFT JOIN User requester ON ar.requestedBy = requester.id
       WHERE ar.requestType = 'sales_order_release'
         AND ar.projectId IN (${placeholders})
       ORDER BY ar.createdAt DESC, ar.id DESC`,
      projectIds,
    );
  }

  async function findDetailedById(id: number | string) {
    return getDb().get(
      `SELECT so.*,
              a.companyName AS accountName,
              q.projectId AS projectId,
              q.quoteNumber AS quotationNumber,
              q.subject AS quotationSubject,
              q.status AS quotationStatus
       FROM SalesOrder so
       LEFT JOIN Account a ON so.accountId = a.id
       LEFT JOIN Quotation q ON so.quotationId = q.id
       WHERE so.id = ?`,
      [id],
    );
  }

  async function findById(id: number | string) {
    return getDb().get(`SELECT * FROM SalesOrder WHERE id = ?`, [id]);
  }

  async function findQuotationSummaryById(id: number | string) {
    return getDb().get(`SELECT id, projectId FROM Quotation WHERE id = ?`, [id]);
  }

  async function findReleaseApprovalContextBySalesOrderId(id: number | string) {
    return getDb().get(
      `SELECT so.id,
              so.status,
              so.orderNumber,
              so.quotationId,
              q.projectId AS projectId,
              q.status AS quotationStatus
       FROM SalesOrder so
       LEFT JOIN Quotation q ON q.id = so.quotationId
       WHERE so.id = ?`,
      [id],
    );
  }

  async function findPendingReleaseApproval(projectId: number | string | null, quotationId: number | string | null, title: string) {
    return getDb().get(
      `SELECT * FROM ApprovalRequest
       WHERE requestType = 'sales_order_release'
         AND projectId = ?
         AND quotationId = ?
         AND title = ?
         AND status = 'pending'
       ORDER BY createdAt DESC, id DESC
       LIMIT 1`,
      [projectId, quotationId, title],
    );
  }

  async function findActiveDirectorUser() {
    return getDb().get(
      `SELECT id
       FROM User
       WHERE accountStatus = 'active'
         AND (systemRole = 'director' OR role = 'director')
       ORDER BY rowid DESC
       LIMIT 1`,
    );
  }

  async function createReleaseApproval(input: {
    projectId: number | string | null;
    quotationId: number | string | null;
    requestedBy: number | string | null;
    approverUserId: number | string | null;
    title: string;
    note: string | null;
  }) {
    const result = await getDb().run(
      `INSERT INTO ApprovalRequest (
        projectId, quotationId, requestType, title, department, requestedBy, approverRole, approverUserId, status, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.projectId,
        input.quotationId,
        'sales_order_release',
        input.title,
        'Operations',
        input.requestedBy,
        'director',
        input.approverUserId,
        'pending',
        input.note,
      ],
    );
    return findApprovalRequestById(result.lastID);
  }

  async function findApprovalRequestById(id: number | string) {
    return getDb().get(`SELECT * FROM ApprovalRequest WHERE id = ?`, [id]);
  }

  async function findUpdateContextBySalesOrderId(id: number | string) {
    return getDb().get(
      `SELECT so.id, so.status, q.projectId AS projectId, q.status AS quotationStatus
       FROM SalesOrder so
       LEFT JOIN Quotation q ON so.quotationId = q.id
       WHERE so.id = ?`,
      [id],
    );
  }

  async function updateStatusAndNotes(id: number | string, status: string, notes: string | null) {
    await getDb().run(
      `UPDATE SalesOrder
       SET status = ?, notes = COALESCE(?, notes), updatedAt = datetime('now')
       WHERE id = ?`,
      [status, notes, id],
    );
    return findById(id);
  }

  async function promoteProjectStageAfterRelease(projectId: number | string) {
    return getDb().run(
      `UPDATE Project
       SET projectStage = CASE WHEN projectStage IN ('delivery_active', 'delivery_completed', 'closed') THEN projectStage ELSE 'order_released' END,
           updatedAt = datetime('now')
       WHERE id = ?`,
      [projectId],
    );
  }

  return {
    listDetailed,
    listReleaseApprovalsByProjectIds,
    findDetailedById,
    findById,
    findQuotationSummaryById,
    findReleaseApprovalContextBySalesOrderId,
    findPendingReleaseApproval,
    findActiveDirectorUser,
    createReleaseApproval,
    findApprovalRequestById,
    findUpdateContextBySalesOrderId,
    updateStatusAndNotes,
    promoteProjectStageAfterRelease,
  };
}

