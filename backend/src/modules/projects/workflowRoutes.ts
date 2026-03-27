import type { Express, Request, Response } from 'express';
import { getDb } from '../../../sqlite-db';

type AsyncRouteFactory = (handler: (req: Request, res: Response) => Promise<unknown>) => any;

type WorkflowPackDefinition = {
  taskTemplateKeys: string[];
  approvalTemplateKeys: string[];
  documentTemplateKey: string;
  projectStage?: string;
};

type RegisterProjectWorkflowRoutesDeps = {
  ah: AsyncRouteFactory;
  requireAuth: any;
  requireRole: (...roles: string[]) => any;
  getCurrentUserId: (req: Request) => string;
  WORKFLOW_PACK_LIBRARY: Record<string, WorkflowPackDefinition>;
  createProjectTasksFromTemplate: (db: any, params: any) => Promise<any>;
  createApprovalRequestsFromTemplate: (db: any, params: any) => Promise<any>;
  createProjectDocumentsFromTemplate: (db: any, params: any) => Promise<any>;
};

export function registerProjectWorkflowRoutes(app: Express, deps: RegisterProjectWorkflowRoutesDeps) {
  const {
    ah,
    requireAuth,
    requireRole,
    getCurrentUserId,
    WORKFLOW_PACK_LIBRARY,
    createProjectTasksFromTemplate,
    createApprovalRequestsFromTemplate,
    createProjectDocumentsFromTemplate,
  } = deps;

  app.post('/api/projects/:id/task-templates', requireAuth, requireRole('admin', 'manager', 'sales'), ah(async (req: Request, res: Response) => {
    const db = getDb();
    const projectId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const project = await db.get('SELECT * FROM Project WHERE id = ?', [projectId]);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const quotationId = typeof req.body?.quotationId === 'string' && req.body.quotationId.trim() ? req.body.quotationId.trim() : null;
    const quotation = quotationId ? await db.get('SELECT * FROM Quotation WHERE id = ?', [quotationId]) : null;
    const templateKey = typeof req.body?.templateKey === 'string' && req.body.templateKey.trim()
      ? req.body.templateKey.trim()
      : 'quotation-sent';
    const tasks = await createProjectTasksFromTemplate(db, {
      projectId,
      templateKey,
      quotation,
      actorUserId: getCurrentUserId(req),
      requestedAssigneeId: req.body?.assigneeId,
    });
    res.status(201).json({ projectId, templateKey, tasks });
  }));

  app.post('/api/projects/:id/workflow-pack', requireAuth, requireRole('admin', 'manager', 'sales'), ah(async (req: Request, res: Response) => {
    const db = getDb();
    const projectId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const project = await db.get('SELECT * FROM Project WHERE id = ?', [projectId]);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const packKey = typeof req.body?.packKey === 'string' && req.body.packKey.trim()
      ? req.body.packKey.trim()
      : 'sales-finance-procurement-warehouse';
    const pack = WORKFLOW_PACK_LIBRARY[packKey];
    if (!pack) return res.status(400).json({ error: 'Unknown workflow pack' });
    const quotationId = typeof req.body?.quotationId === 'string' && req.body.quotationId.trim() ? req.body.quotationId.trim() : null;
    const quotation = quotationId ? await db.get('SELECT * FROM Quotation WHERE id = ?', [quotationId]) : null;
    const actorUserId = getCurrentUserId(req);

    const taskGroups = await Promise.all(
      pack.taskTemplateKeys.map(templateKey =>
        createProjectTasksFromTemplate(db, { projectId, templateKey, quotation, actorUserId })
      )
    );
    const approvalGroups = await Promise.all(
      pack.approvalTemplateKeys.map(templateKey =>
        createApprovalRequestsFromTemplate(db, { projectId, templateKey, quotation, actorUserId })
      )
    );
    const documents = await createProjectDocumentsFromTemplate(db, {
      projectId,
      templateKey: pack.documentTemplateKey,
      quotation,
    });
    if (pack.projectStage) {
      await db.run(`UPDATE Project SET projectStage = ?, updatedAt = datetime('now') WHERE id = ?`, [pack.projectStage, projectId]);
    }
    res.status(201).json({
      projectId,
      packKey,
      tasks: taskGroups.flat(),
      approvals: approvalGroups.flat(),
      documents,
    });
  }));
}
