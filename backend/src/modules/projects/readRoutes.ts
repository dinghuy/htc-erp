import type { Express, Request, Response } from 'express';
import { getDb } from '../../../sqlite-db';
import type { AuthenticatedRequest } from '../../shared/auth/httpAuth';
import { createProjectRepository } from './repository';

type AsyncRouteFactory = (handler: (req: Request, res: Response) => Promise<unknown>) => any;

type RegisterProjectReadRoutesDeps = {
  ah: AsyncRouteFactory;
  requireAuth: any;
  getProjectWorkspaceById: (db: any, projectId: string, currentUser?: any) => Promise<any>;
};

export function registerProjectReadRoutes(app: Express, deps: RegisterProjectReadRoutesDeps) {
  const {
    ah,
    requireAuth,
    getProjectWorkspaceById,
  } = deps;
  const projectRepository = createProjectRepository();

  app.get('/api/projects', requireAuth, ah(async (req: Request, res: Response) => {
    const { accountId, managerId, status, startDateFrom, startDateTo, endDateFrom, endDateTo } = req.query as Record<string, string | undefined>;
    const db = getDb();
    const rows = await projectRepository.listProjects({
      accountId,
      managerId,
      status,
      startDateFrom,
      startDateTo,
      endDateFrom,
      endDateTo,
    });
    const enrichedRows = await Promise.all(rows.map(async (row: any) => {
      const workspace = await getProjectWorkspaceById(db, row.id, (req as AuthenticatedRequest).user).catch(() => null);
      return {
        ...row,
        approvalGateStates: Array.isArray(workspace?.approvalGateStates) ? workspace.approvalGateStates : [],
        actionAvailability: workspace?.actionAvailability || null,
        pendingApproverState: Array.isArray(workspace?.pendingApproverState) ? workspace.pendingApproverState : [],
      };
    }));
    res.json(enrichedRows);
  }));

  app.get('/api/projects/:id', requireAuth, ah(async (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const projectId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const project = await getProjectWorkspaceById(db, projectId, req.user);
    if (!project) return res.status(404).json({ error: 'Not found' });
    res.json(project);
  }));
}
