import type { Express, Request, Response } from 'express';
import { getDb } from '../../../sqlite-db';
import { createProjectRepository } from './repository';

type AsyncRouteFactory = (handler: (req: Request, res: Response) => Promise<unknown>) => any;

type RegisterProjectReadRoutesDeps = {
  ah: AsyncRouteFactory;
  requireAuth: any;
  getProjectWorkspaceById: (db: any, projectId: string) => Promise<any>;
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
    res.json(await projectRepository.listProjects({
      accountId,
      managerId,
      status,
      startDateFrom,
      startDateTo,
      endDateFrom,
      endDateTo,
    }));
  }));

  app.get('/api/projects/:id', requireAuth, ah(async (req: Request, res: Response) => {
    const db = getDb();
    const projectId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const project = await getProjectWorkspaceById(db, projectId);
    if (!project) return res.status(404).json({ error: 'Not found' });
    res.json(project);
  }));
}
