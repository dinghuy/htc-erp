import type { Express, Request, Response } from 'express';
import { milestoneRepository, VALID_MILESTONE_STATUSES, type MilestoneStatus } from './milestoneRepository';

type AsyncRouteFactory = (handler: (req: Request, res: Response) => Promise<unknown>) => any;

type RegisterMilestoneRoutesDeps = {
  ah: AsyncRouteFactory;
  requireAuth?: any;
};

export function registerMilestoneRoutes(app: Express, deps: RegisterMilestoneRoutesDeps) {
  const { ah } = deps;
  const repo = milestoneRepository;
  const getSingleParam = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

  // List milestones for a project
  app.get('/api/projects/:projectId/milestones', ah(async (req: Request, res: Response) => {
    const projectId = getSingleParam(req.params.projectId);
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });
    res.json(await repo.findByProjectId(projectId));
  }));

  // Get single milestone
  app.get('/api/milestones/:id', ah(async (req: Request, res: Response) => {
    const id = getSingleParam(req.params.id);
    if (!id) return res.status(400).json({ error: 'id is required' });
    const row = await repo.findById(id);
    if (!row) return res.status(404).json({ error: 'Milestone not found' });
    res.json(row);
  }));

  // Create milestone for project
  app.post('/api/projects/:projectId/milestones', ah(async (req: Request, res: Response) => {
    const projectId = getSingleParam(req.params.projectId);
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });
    const { label, description, status, targetDate } = req.body;
    if (!label) return res.status(400).json({ error: 'label is required' });
    if (status && !VALID_MILESTONE_STATUSES.includes(status as MilestoneStatus)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_MILESTONE_STATUSES.join(', ')}` });
    }
    const row = await repo.create({
      projectId,
      label: String(label),
      description: description != null ? String(description) : null,
      status: (status as MilestoneStatus | undefined) ?? 'planned',
      targetDate: targetDate != null ? String(targetDate) : null,
    });
    res.status(201).json(row);
  }));

  // Update milestone
  app.put('/api/milestones/:id', ah(async (req: Request, res: Response) => {
    const id = getSingleParam(req.params.id);
    if (!id) return res.status(400).json({ error: 'id is required' });
    const { label, description, status, targetDate } = req.body;
    if (status && !VALID_MILESTONE_STATUSES.includes(status as MilestoneStatus)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_MILESTONE_STATUSES.join(', ')}` });
    }
    const row = await repo.updateById(id, {
      label: label != null ? String(label) : undefined,
      description: description !== undefined ? (description != null ? String(description) : null) : undefined,
      status: status as MilestoneStatus | undefined,
      targetDate: targetDate !== undefined ? (targetDate != null ? String(targetDate) : null) : undefined,
    });
    if (!row) return res.status(404).json({ error: 'Milestone not found' });
    res.json(row);
  }));

  // Delete milestone
  app.delete('/api/milestones/:id', ah(async (req: Request, res: Response) => {
    const id = getSingleParam(req.params.id);
    if (!id) return res.status(400).json({ error: 'id is required' });
    await repo.deleteById(id);
    res.json({ success: true });
  }));
}
