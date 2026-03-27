import type { Express, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createProjectRepository } from './repository';

type AsyncRouteFactory = (handler: (req: Request, res: Response) => Promise<unknown>) => any;

type RegisterProjectWriteRoutesDeps = {
  ah: AsyncRouteFactory;
  requireAuth: any;
  requireRole: (...roles: string[]) => any;
  normalizeProjectStage: (value: unknown, fallback?: string) => string;
};

export function registerProjectWriteRoutes(app: Express, deps: RegisterProjectWriteRoutesDeps) {
  const {
    ah,
    requireAuth,
    requireRole,
    normalizeProjectStage,
  } = deps;
  const projectRepository = createProjectRepository();

  app.post('/api/projects', requireAuth, requireRole('admin', 'manager'), ah(async (req: Request, res: Response) => {
    const id = uuidv4();
    const { code, name, description, managerId, accountId, startDate, endDate, status = 'pending', projectStage = 'new' } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    await projectRepository.insertProject({
      id,
      code,
      name,
      description,
      managerId,
      accountId,
      projectStage: normalizeProjectStage(projectStage, 'new'),
      startDate,
      endDate,
      status,
    });
    res.status(201).json(await projectRepository.findProjectSummaryById(id));
  }));

  app.put('/api/projects/:id', requireAuth, requireRole('admin', 'manager'), ah(async (req: Request, res: Response) => {
    const projectId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const existing = await projectRepository.findProjectSummaryById(projectId);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const { code, name, description, managerId, accountId, projectStage, startDate, endDate, status } = req.body;
    await projectRepository.updateProjectById({
      id: projectId,
      code,
      name,
      description,
      managerId,
      accountId,
      projectStage: normalizeProjectStage(projectStage, existing.projectStage || 'new'),
      startDate,
      endDate,
      status,
    });
    res.json(await projectRepository.findProjectSummaryById(projectId));
  }));

  app.delete('/api/projects/:id', requireAuth, requireRole('admin'), ah(async (req: Request, res: Response) => {
    const projectId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    await projectRepository.deleteTasksByProjectId(projectId);
    await projectRepository.deleteProjectById(projectId);
    res.json({ success: true });
  }));
}
