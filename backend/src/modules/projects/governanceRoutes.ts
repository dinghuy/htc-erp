import type { Express, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { enqueueErpEvent } from '../../../erp-sync';
import { getDb } from '../../../sqlite-db';
import type { AuthenticatedRequest } from '../../shared/auth/httpAuth';
import { canUserApproveRequest, resolveApprovalActingCapability } from '../../shared/auth/permissions';
import { normalizeRoleCodes } from '../../shared/auth/roles';

type AsyncRouteFactory = (handler: (req: Request, res: Response) => Promise<unknown>) => any;

type RegisterProjectGovernanceRoutesDeps = {
  ah: AsyncRouteFactory;
  requireAuth: any;
  requireRole: (...roles: string[]) => any;
  getCurrentUserId: (req: Request) => string;
  handleQbuApprovalDecision: (db: any, approvalRequest: any) => Promise<unknown>;
  logAct: (
    title: string,
    description: string,
    category: string,
    icon: string,
    color: string,
    iconColor: string,
    entityId?: string,
    entityType?: string,
    link?: string,
    audit?: {
      actorUserId?: string | null;
      actorRoles?: string | null;
      actingCapability?: string | null;
      action?: string | null;
      timestamp?: string | null;
    }
  ) => Promise<unknown>;
  resolveProjectHandoffQuotation: (db: any, projectId: string, preferredQuotationId?: string | null) => Promise<any>;
  markWinningQuotation: (db: any, quotationId: string, projectId: string | null, isWinning: boolean) => Promise<unknown>;
  createSalesOrderFromQuotation: (db: any, quotationId: string) => Promise<any>;
  createProjectTasksFromTemplate: (db: any, input: any) => Promise<any>;
};

export function registerProjectGovernanceRoutes(app: Express, deps: RegisterProjectGovernanceRoutesDeps) {
  const {
    ah,
    requireAuth,
    requireRole,
    getCurrentUserId,
    handleQbuApprovalDecision,
    logAct,
    resolveProjectHandoffQuotation,
    markWinningQuotation,
    createSalesOrderFromQuotation,
    createProjectTasksFromTemplate,
  } = deps;

  app.post('/api/projects/:id/approval-requests', requireAuth, requireRole('admin', 'manager', 'sales'), ah(async (req: Request, res: Response) => {
    const db = getDb();
    const projectId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const project = await db.get('SELECT id FROM Project WHERE id = ?', [projectId]);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const quotationId = typeof req.body?.quotationId === 'string' && req.body.quotationId.trim() ? req.body.quotationId.trim() : null;
    if (quotationId) {
      const quote = await db.get('SELECT id FROM Quotation WHERE id = ? AND projectId = ?', [quotationId, projectId]);
      if (!quote) return res.status(400).json({ error: 'Quotation does not belong to this project' });
    }

    const requestType = typeof req.body?.requestType === 'string' && req.body.requestType.trim() ? req.body.requestType.trim() : '';
    const title = typeof req.body?.title === 'string' && req.body.title.trim() ? req.body.title.trim() : '';
    if (!requestType || !title) return res.status(400).json({ error: 'requestType and title are required' });

    const id = uuidv4();
    const approverRole = typeof req.body?.approverRole === 'string' && req.body.approverRole.trim() ? req.body.approverRole.trim() : 'manager';
    const approverUserId = typeof req.body?.approverUserId === 'string' && req.body.approverUserId.trim() ? req.body.approverUserId.trim() : null;
    const department = typeof req.body?.department === 'string' ? req.body.department.trim() : null;
    const dueDate = typeof req.body?.dueDate === 'string' && req.body.dueDate.trim() ? req.body.dueDate.trim() : null;
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : null;
    const status = typeof req.body?.status === 'string' && ['pending', 'approved', 'rejected', 'changes_requested'].includes(req.body.status.trim())
      ? req.body.status.trim()
      : 'pending';

    await db.run(
      `INSERT INTO ApprovalRequest (
        id, projectId, quotationId, requestType, title, department, requestedBy, approverRole, approverUserId, status, dueDate, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        projectId,
        quotationId,
        requestType,
        title,
        department,
        getCurrentUserId(req) || null,
        approverRole,
        approverUserId,
        status,
        dueDate,
        note,
      ]
    );
    const row = await db.get(`SELECT * FROM ApprovalRequest WHERE id = ?`, [id]);
    await logAct('Create approval request', `${title} (${requestType})`, 'Project', '🧾', '#f8fafc', '#475569', projectId, 'Project');
    res.status(201).json(row);
  }));

  app.put('/api/approval-requests/:id', requireAuth, requireRole('admin', 'manager', 'sales'), ah(async (req: Request, res: Response) => {
    const db = getDb();
    const approvalId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const approval = await db.get('SELECT * FROM ApprovalRequest WHERE id = ?', [approvalId]);
    if (!approval) return res.status(404).json({ error: 'Approval request not found' });

    const title = typeof req.body?.title === 'string' && req.body.title.trim() ? req.body.title.trim() : approval.title;
    const requestType = typeof req.body?.requestType === 'string' && req.body.requestType.trim() ? req.body.requestType.trim() : approval.requestType;
    const department = typeof req.body?.department === 'string' ? req.body.department.trim() : approval.department;
    const approverRole = typeof req.body?.approverRole === 'string' && req.body.approverRole.trim() ? req.body.approverRole.trim() : approval.approverRole;
    const approverUserId = typeof req.body?.approverUserId === 'string' ? (req.body.approverUserId.trim() || null) : approval.approverUserId;
    const dueDate = typeof req.body?.dueDate === 'string' ? (req.body.dueDate.trim() || null) : approval.dueDate;
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : approval.note;
    const status = typeof req.body?.status === 'string' && ['pending', 'approved', 'rejected', 'changes_requested'].includes(req.body.status.trim())
      ? req.body.status.trim()
      : approval.status;

    await db.run(
      `UPDATE ApprovalRequest
       SET requestType = ?, title = ?, department = ?, approverRole = ?, approverUserId = ?, status = ?, dueDate = ?, note = ?, updatedAt = datetime('now')
       WHERE id = ?`,
      [requestType, title, department || null, approverRole || null, approverUserId, status, dueDate, note || null, approvalId]
    );
    const updated = await db.get('SELECT * FROM ApprovalRequest WHERE id = ?', [approvalId]);
    if (approval.projectId) {
      await logAct('Update approval request', `${title} (${requestType})`, 'Project', '📝', '#f8fafc', '#475569', approval.projectId, 'Project');
    }
    res.json(updated);
  }));

  app.post('/api/approval-requests/:id/decision', requireAuth, ah(async (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const approvalId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const approval = await db.get('SELECT * FROM ApprovalRequest WHERE id = ?', [approvalId]);
    if (!approval) return res.status(404).json({ error: 'Approval request not found' });
    if (!canUserApproveRequest(req.user, approval)) {
      return res.status(403).json({ error: 'Không có quyền phê duyệt approval này' });
    }
    const decision = typeof req.body?.decision === 'string' ? req.body.decision.trim().toLowerCase() : '';
    if (!['approved', 'rejected', 'changes_requested'].includes(decision)) {
      return res.status(400).json({ error: 'decision must be approved, rejected or changes_requested' });
    }
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
    await db.run(
      `UPDATE ApprovalRequest
       SET status = ?, note = ?, decidedAt = ?, decidedBy = ?, updatedAt = datetime('now')
       WHERE id = ?`,
      [decision, note || approval.note || null, new Date().toISOString(), getCurrentUserId(req) || null, approvalId]
    );
    const updated = await db.get('SELECT * FROM ApprovalRequest WHERE id = ?', [approvalId]);
    await handleQbuApprovalDecision(db, updated);
    if (updated?.quotationId && updated?.requestType === 'quotation_commercial') {
      const quotationStatus =
        decision === 'approved'
          ? 'approved'
          : decision === 'changes_requested'
            ? 'revision_required'
            : 'rejected';
      await db.run(`UPDATE Quotation SET status = ?, updatedAt = datetime('now') WHERE id = ?`, [quotationStatus, updated.quotationId]);
      if (updated.projectId) {
        const nextProjectStage = quotationStatus === 'approved'
          ? 'commercial_approved'
          : quotationStatus === 'revision_required'
            ? 'negotiating'
            : 'lost';
        await db.run(`UPDATE Project SET projectStage = ?, updatedAt = datetime('now') WHERE id = ?`, [nextProjectStage, updated.projectId]);
      }
    }
    if (updated?.projectId && updated?.requestType === 'delivery_completion' && decision === 'approved') {
      await db.run(`UPDATE Project SET projectStage = ?, updatedAt = datetime('now') WHERE id = ?`, ['delivery_completed', updated.projectId]);
      await enqueueErpEvent(db, {
        eventType: 'project.delivery_completed',
        entityType: 'Project',
        entityId: updated.projectId,
        payload: { projectId: updated.projectId, sourceApprovalId: updated.id },
      });
    }
    if (updated?.projectId) {
      const actorRoles = normalizeRoleCodes(req.user?.roleCodes, req.user?.systemRole);
      const actingCapability = resolveApprovalActingCapability(req.user, updated);
      await logAct(
        'Approval decision',
        `${updated.title || updated.requestType}: ${decision}`,
        'Project',
        '✅',
        '#f1f5f9',
        '#0f766e',
        updated.projectId,
        'Project',
        undefined,
        {
          actorUserId: getCurrentUserId(req) || null,
          actorRoles: JSON.stringify(actorRoles),
          actingCapability,
          action: 'approval_decision',
          timestamp: new Date().toISOString(),
        }
      );
    }
    res.json(updated);
  }));

  app.delete('/api/approval-requests/:id', requireAuth, requireRole('admin', 'manager', 'sales'), ah(async (req: Request, res: Response) => {
    const db = getDb();
    const approvalId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const approval = await db.get('SELECT * FROM ApprovalRequest WHERE id = ?', [approvalId]);
    if (!approval) return res.status(404).json({ error: 'Approval request not found' });
    await db.run('DELETE FROM ApprovalRequest WHERE id = ?', [approvalId]);
    if (approval.projectId) {
      await logAct('Delete approval request', `${approval.title || approval.requestType}`, 'Project', '🗑️', '#fef2f2', '#b91c1c', approval.projectId, 'Project');
    }
    res.json({ success: true, id: approvalId });
  }));

  app.post('/api/projects/:id/project-documents', requireAuth, requireRole('admin', 'manager', 'sales'), ah(async (req: Request, res: Response) => {
    const db = getDb();
    const projectId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const project = await db.get('SELECT id FROM Project WHERE id = ?', [projectId]);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const quotationId = typeof req.body?.quotationId === 'string' && req.body.quotationId.trim() ? req.body.quotationId.trim() : null;
    if (quotationId) {
      const quote = await db.get('SELECT id FROM Quotation WHERE id = ? AND projectId = ?', [quotationId, projectId]);
      if (!quote) return res.status(400).json({ error: 'Quotation does not belong to this project' });
    }

    const documentCode = typeof req.body?.documentCode === 'string' && req.body.documentCode.trim() ? req.body.documentCode.trim() : '';
    const documentName = typeof req.body?.documentName === 'string' && req.body.documentName.trim() ? req.body.documentName.trim() : '';
    if (!documentCode || !documentName) return res.status(400).json({ error: 'documentCode and documentName are required' });

    const id = uuidv4();
    const category = typeof req.body?.category === 'string' ? req.body.category.trim() : null;
    const department = typeof req.body?.department === 'string' ? req.body.department.trim() : null;
    const allowedStatuses = new Set(['missing', 'requested', 'received', 'approved']);
    const status = typeof req.body?.status === 'string' && allowedStatuses.has(req.body.status.trim()) ? req.body.status.trim() : 'missing';
    const requiredAtStage = typeof req.body?.requiredAtStage === 'string' ? req.body.requiredAtStage.trim() : null;
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : null;
    const receivedAt = status === 'received' || status === 'approved' ? new Date().toISOString() : null;

    await db.run(
      `INSERT INTO ProjectDocument (
        id, projectId, quotationId, documentCode, documentName, category, department, status, requiredAtStage, note, receivedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, projectId, quotationId, documentCode, documentName, category, department, status, requiredAtStage, note, receivedAt]
    );
    const row = await db.get(`SELECT * FROM ProjectDocument WHERE id = ?`, [id]);
    await logAct('Create project document', `${documentCode} - ${documentName}`, 'Project', '📎', '#f8fafc', '#0369a1', projectId, 'Project');
    res.status(201).json(row);
  }));

  app.patch('/api/project-documents/:id', requireAuth, requireRole('admin', 'manager', 'sales'), ah(async (req: Request, res: Response) => {
    const db = getDb();
    const documentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const document = await db.get('SELECT * FROM ProjectDocument WHERE id = ?', [documentId]);
    if (!document) return res.status(404).json({ error: 'Project document not found' });
    const allowedStatuses = new Set(['missing', 'requested', 'received', 'approved']);
    const status = typeof req.body?.status === 'string' && allowedStatuses.has(req.body.status.trim()) ? req.body.status.trim() : document.status;
    const documentCode = typeof req.body?.documentCode === 'string' && req.body.documentCode.trim() ? req.body.documentCode.trim() : document.documentCode;
    const documentName = typeof req.body?.documentName === 'string' && req.body.documentName.trim() ? req.body.documentName.trim() : document.documentName;
    const category = typeof req.body?.category === 'string' ? req.body.category.trim() : document.category;
    const department = typeof req.body?.department === 'string' ? req.body.department.trim() : document.department;
    const requiredAtStage = typeof req.body?.requiredAtStage === 'string' ? req.body.requiredAtStage.trim() : document.requiredAtStage;
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : document.note;
    const receivedAt = status === 'received' || status === 'approved'
      ? (typeof req.body?.receivedAt === 'string' && req.body.receivedAt.trim() ? req.body.receivedAt.trim() : new Date().toISOString())
      : (typeof req.body?.receivedAt === 'string' ? (req.body.receivedAt.trim() || null) : null);
    await db.run(
      `UPDATE ProjectDocument
       SET documentCode = ?, documentName = ?, category = ?, department = ?, status = ?, requiredAtStage = ?, note = ?, receivedAt = ?, updatedAt = datetime('now')
       WHERE id = ?`,
      [documentCode, documentName, category || null, department || null, status, requiredAtStage || null, note || null, receivedAt, documentId]
    );
    const updated = await db.get('SELECT * FROM ProjectDocument WHERE id = ?', [documentId]);
    if (document.projectId) {
      await logAct('Update project document', `${updated.documentCode} - ${updated.documentName}`, 'Project', '📎', '#f8fafc', '#0369a1', document.projectId, 'Project');
    }
    res.json(updated);
  }));

  app.delete('/api/project-documents/:id', requireAuth, requireRole('admin', 'manager', 'sales'), ah(async (req: Request, res: Response) => {
    const db = getDb();
    const documentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const document = await db.get('SELECT * FROM ProjectDocument WHERE id = ?', [documentId]);
    if (!document) return res.status(404).json({ error: 'Project document not found' });
    await db.run('DELETE FROM ProjectDocument WHERE id = ?', [documentId]);
    if (document.projectId) {
      await logAct('Delete project document', `${document.documentCode} - ${document.documentName}`, 'Project', '🗑️', '#fef2f2', '#b91c1c', document.projectId, 'Project');
    }
    res.json({ success: true, id: documentId });
  }));

  app.post('/api/projects/:id/handoff', requireAuth, requireRole('admin', 'manager', 'sales'), ah(async (req: Request, res: Response) => {
    const db = getDb();
    const actorUserId = getCurrentUserId(req);
    const projectId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const project = await db.get('SELECT * FROM Project WHERE id = ?', [projectId]);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const quotation = await resolveProjectHandoffQuotation(
      db,
      projectId,
      typeof req.body?.quotationId === 'string' && req.body.quotationId.trim() ? req.body.quotationId.trim() : null
    );
    if (!quotation) return res.status(400).json({ error: 'No quotation available for project handoff' });
    if (!['won', 'accepted'].includes(String(quotation.status || '').toLowerCase()) && !quotation.isWinningVersion) {
      return res.status(400).json({ error: 'Project handoff requires a won or winning quotation' });
    }

    await markWinningQuotation(db, quotation.id, projectId, true);
    const salesOrderResult = await createSalesOrderFromQuotation(db, quotation.id);
    const tasks = await createProjectTasksFromTemplate(db, {
      projectId,
      templateKey: 'delivery-handoff',
      quotation,
      actorUserId,
      requestedAssigneeId: req.body?.assigneeId,
    });
    await db.run(`UPDATE Project SET projectStage = ?, updatedAt = datetime('now') WHERE id = ?`, ['delivery', projectId]);
    await logAct(
      'Project handoff to delivery',
      `${project.name || project.code || projectId} -> ${salesOrderResult.salesOrder?.orderNumber || 'sales order'}`,
      'Project',
      '🚚',
      '#eff6ff',
      '#1d4ed8',
      projectId,
      'Project'
    );
    res.status(201).json({
      projectId,
      projectStage: 'delivery',
      quotationId: quotation.id,
      salesOrder: salesOrderResult.salesOrder,
      salesOrderCreated: salesOrderResult.created,
      tasks,
    });
  }));
}
