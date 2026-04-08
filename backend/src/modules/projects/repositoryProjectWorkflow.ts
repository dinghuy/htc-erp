import { getDb } from '../../../sqlite-db';

export function createProjectWorkflowRepository(projectDocumentThreadRollupsJoin: string) {
  async function listProjectApprovals(projectId: string) {
    return getDb().all(
      `
        SELECT ar.*, u.fullName AS approverName, rq.fullName AS requestedByName
        FROM ApprovalRequest ar
        LEFT JOIN User u ON ar.approverUserId = u.id
        LEFT JOIN User rq ON ar.requestedBy = rq.id
        WHERE ar.projectId = ?
        ORDER BY CASE ar.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 WHEN 'rejected' THEN 2 ELSE 3 END, ar.createdAt DESC
      `,
      [projectId]
    );
  }

  async function findApprovalRequestById(id: string) {
    return getDb().get(`SELECT * FROM ApprovalRequest WHERE id = ?`, [id]);
  }

  async function insertApprovalRequest(input: {
    id: string;
    projectId: string;
    quotationId?: string | null;
    requestType: string;
    title: string;
    department?: string | null;
    requestedBy?: string | null;
    approverRole?: string | null;
    approverUserId?: string | null;
    status: string;
    dueDate?: string | null;
    note?: string | null;
  }) {
    await getDb().run(
      `INSERT INTO ApprovalRequest (
        id, projectId, quotationId, requestType, title, department, requestedBy, approverRole, approverUserId, status, dueDate, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.projectId,
        input.quotationId || null,
        input.requestType,
        input.title,
        input.department || null,
        input.requestedBy || null,
        input.approverRole || null,
        input.approverUserId || null,
        input.status,
        input.dueDate || null,
        input.note || null,
      ]
    );
  }

  async function updateApprovalRequestById(input: {
    id: string;
    requestType: string;
    title: string;
    department?: string | null;
    approverRole?: string | null;
    approverUserId?: string | null;
    status: string;
    dueDate?: string | null;
    note?: string | null;
  }) {
    await getDb().run(
      `UPDATE ApprovalRequest
       SET requestType = ?, title = ?, department = ?, approverRole = ?, approverUserId = ?, status = ?, dueDate = ?, note = ?,
           decidedAt = CASE WHEN ? = 'pending' THEN NULL ELSE decidedAt END,
           decidedBy = CASE WHEN ? = 'pending' THEN NULL ELSE decidedBy END,
           updatedAt = datetime('now')
       WHERE id = ?`,
      [
        input.requestType,
        input.title,
        input.department || null,
        input.approverRole || null,
        input.approverUserId || null,
        input.status,
        input.dueDate || null,
        input.note || null,
        input.status,
        input.status,
        input.id,
      ]
    );
  }

  async function decideApprovalRequestById(input: {
    id: string;
    status: string;
    note?: string | null;
    decidedAt: string;
    decidedBy?: string | null;
  }) {
    await getDb().run(
      `UPDATE ApprovalRequest
       SET status = ?, note = ?, decidedAt = ?, decidedBy = ?, updatedAt = datetime('now')
       WHERE id = ?`,
      [
        input.status,
        input.note || null,
        input.decidedAt,
        input.decidedBy || null,
        input.id,
      ]
    );
  }

  async function findLatestApprovalRequest(projectId: string, requestType: string, status?: string | null) {
    const conditions = ['projectId = ?', 'requestType = ?'];
    const params: any[] = [projectId, requestType];
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }
    return getDb().get(
      `
        SELECT *
        FROM ApprovalRequest
        WHERE ${conditions.join(' AND ')}
        ORDER BY COALESCE(decidedAt, updatedAt, createdAt) DESC
        LIMIT 1
      `,
      params
    );
  }

  async function deleteApprovalRequestById(id: string) {
    await getDb().run('DELETE FROM ApprovalRequest WHERE id = ?', [id]);
  }

  async function listProjectDocuments(projectId: string) {
    return getDb().all(
      `
        SELECT pd.*,
               COALESCE(pdtr.threadMessageCount, 0) AS threadMessageCount,
               pdtr.threadLastMessageAt AS threadLastMessageAt
        FROM ProjectDocument pd
        ${projectDocumentThreadRollupsJoin}
        WHERE pd.projectId = ?
        ORDER BY pd.department ASC, pd.documentCode ASC, pd.createdAt DESC
      `,
      [projectId]
    );
  }

  async function findProjectDocumentById(id: string) {
    return getDb().get(
      `SELECT pd.*,
              COALESCE(pdtr.threadMessageCount, 0) AS threadMessageCount,
              pdtr.threadLastMessageAt AS threadLastMessageAt
       FROM ProjectDocument pd
       ${projectDocumentThreadRollupsJoin}
       WHERE pd.id = ?`,
      [id]
    );
  }

  async function findProjectDocumentByIdForProject(id: string, projectId: string) {
    return getDb().get(
      `SELECT pd.*,
              COALESCE(pdtr.threadMessageCount, 0) AS threadMessageCount,
              pdtr.threadLastMessageAt AS threadLastMessageAt
       FROM ProjectDocument pd
       ${projectDocumentThreadRollupsJoin}
       WHERE pd.id = ? AND pd.projectId = ?`,
      [id, projectId]
    );
  }

  async function insertProjectDocument(input: {
    id: string;
    projectId: string;
    quotationId?: string | null;
    documentCode?: string | null;
    documentName?: string | null;
    category?: string | null;
    department?: string | null;
    status: string;
    requiredAtStage?: string | null;
    note?: string | null;
    receivedAt?: string | null;
  }) {
    await getDb().run(
      `INSERT INTO ProjectDocument (
        id, projectId, quotationId, documentCode, documentName, category, department, status, requiredAtStage, note, receivedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.projectId,
        input.quotationId || null,
        input.documentCode || null,
        input.documentName || null,
        input.category || null,
        input.department || null,
        input.status,
        input.requiredAtStage || null,
        input.note || null,
        input.receivedAt || null,
      ]
    );
  }

  async function updateProjectDocumentById(input: {
    id: string;
    quotationId?: string | null;
    documentCode?: string | null;
    documentName?: string | null;
    category?: string | null;
    department?: string | null;
    status: string;
    requiredAtStage?: string | null;
    note?: string | null;
    receivedAt?: string | null;
  }) {
    await getDb().run(
      `UPDATE ProjectDocument
       SET quotationId = ?, documentCode = ?, documentName = ?, category = ?, department = ?, status = ?,
           requiredAtStage = ?, note = ?, receivedAt = ?, updatedAt = datetime('now')
       WHERE id = ?`,
      [
        input.quotationId || null,
        input.documentCode || null,
        input.documentName || null,
        input.category || null,
        input.department || null,
        input.status,
        input.requiredAtStage || null,
        input.note || null,
        input.receivedAt || null,
        input.id,
      ]
    );
  }

  async function updateProjectDocumentReviewStateById(input: {
    id: string;
    reviewStatus: string;
    reviewerUserId?: string | null;
    reviewedAt?: string | null;
    reviewNote?: string | null;
    storageKey?: string | null;
    threadId?: string | null;
  }) {
    await getDb().run(
      `UPDATE ProjectDocument
       SET reviewStatus = ?, reviewerUserId = ?, reviewedAt = ?, reviewNote = ?, storageKey = ?, threadId = ?, updatedAt = datetime('now')
       WHERE id = ?`,
      [
        input.reviewStatus,
        input.reviewerUserId || null,
        input.reviewedAt || null,
        input.reviewNote || null,
        input.storageKey || null,
        input.threadId || null,
        input.id,
      ]
    );
  }

  async function deleteProjectDocumentById(id: string) {
    await getDb().run('DELETE FROM ProjectDocument WHERE id = ?', [id]);
  }

  async function listProjectBlockers(projectId: string) {
    return getDb().all(
      `
        SELECT pb.*, cu.fullName AS createdByName, ru.fullName AS resolvedByName
        FROM ProjectBlocker pb
        LEFT JOIN User cu ON pb.createdBy = cu.id
        LEFT JOIN User ru ON pb.resolvedBy = ru.id
        WHERE pb.projectId = ?
        ORDER BY CASE pb.status WHEN 'open' THEN 0 WHEN 'watch' THEN 1 WHEN 'resolved' THEN 2 ELSE 3 END, pb.updatedAt DESC, pb.createdAt DESC
      `,
      [projectId]
    );
  }

  async function findProjectBlockerById(id: string) {
    return getDb().get(`SELECT * FROM ProjectBlocker WHERE id = ?`, [id]);
  }

  async function insertProjectBlocker(input: {
    id: string;
    projectId: string;
    source?: string | null;
    category?: string | null;
    ownerRole?: string | null;
    status: string;
    tone: string;
    title: string;
    detail?: string | null;
    action?: string | null;
    linkedEntityType?: string | null;
    linkedEntityId?: string | null;
    createdBy?: string | null;
  }) {
    await getDb().run(
      `INSERT INTO ProjectBlocker (
        id, projectId, source, category, ownerRole, status, tone, title, detail, action, linkedEntityType, linkedEntityId, createdBy
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.projectId,
        input.source || 'manual',
        input.category || 'workflow',
        input.ownerRole || null,
        input.status,
        input.tone,
        input.title,
        input.detail || null,
        input.action || null,
        input.linkedEntityType || null,
        input.linkedEntityId || null,
        input.createdBy || null,
      ]
    );
  }

  async function updateProjectBlockerById(input: {
    id: string;
    source?: string | null;
    category?: string | null;
    ownerRole?: string | null;
    status: string;
    tone: string;
    title: string;
    detail?: string | null;
    action?: string | null;
    linkedEntityType?: string | null;
    linkedEntityId?: string | null;
    resolvedAt?: string | null;
    resolvedBy?: string | null;
  }) {
    await getDb().run(
      `UPDATE ProjectBlocker
       SET source = ?, category = ?, ownerRole = ?, status = ?, tone = ?, title = ?, detail = ?, action = ?,
           linkedEntityType = ?, linkedEntityId = ?, resolvedAt = ?, resolvedBy = ?, updatedAt = datetime('now')
       WHERE id = ?`,
      [
        input.source || 'manual',
        input.category || 'workflow',
        input.ownerRole || null,
        input.status,
        input.tone,
        input.title,
        input.detail || null,
        input.action || null,
        input.linkedEntityType || null,
        input.linkedEntityId || null,
        input.resolvedAt || null,
        input.resolvedBy || null,
        input.id,
      ]
    );
  }

  return {
    listProjectApprovals,
    findApprovalRequestById,
    insertApprovalRequest,
    updateApprovalRequestById,
    decideApprovalRequestById,
    findLatestApprovalRequest,
    deleteApprovalRequestById,
    listProjectDocuments,
    listProjectBlockers,
    findProjectDocumentById,
    findProjectDocumentByIdForProject,
    insertProjectDocument,
    updateProjectDocumentById,
    updateProjectDocumentReviewStateById,
    deleteProjectDocumentById,
    findProjectBlockerById,
    insertProjectBlocker,
    updateProjectBlockerById,
  };
}
