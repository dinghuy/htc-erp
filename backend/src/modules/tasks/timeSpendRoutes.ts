import type { Express, Request, Response } from 'express';
import { timeSpendRepository } from './timeSpendRepository';

type AsyncRouteFactory = (handler: (req: Request, res: Response) => Promise<unknown>) => any;

type RegisterTimeSpendRoutesDeps = {
  ah: AsyncRouteFactory;
  requireAuth?: any;
  getCurrentUserId?: (req: Request) => string | null;
};

export function registerTimeSpendRoutes(app: Express, deps: RegisterTimeSpendRoutesDeps) {
  const { ah, getCurrentUserId } = deps;
  const repo = timeSpendRepository;

  const getSingleParam = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const parseNumericId = (value: string | undefined) => {
    if (!value) return null;
    const numericId = Number(value);
    return Number.isInteger(numericId) ? numericId : null;
  };
  const mapWorklogRow = (row: any) => ({
    id: row.id,
    projectId: row.projectId ?? null,
    taskId: row.taskId,
    authorUserId: row.userId,
    startedAt: row.reportDate ?? null,
    endedAt: null,
    durationMinutes: Math.round(Number(row.hours || 0) * 60),
    summary: row.description ?? `Logged ${Number(row.hours || 0)}h`,
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
  });

  // List time reports for a task
  app.get('/api/tasks/:taskId/time-reports', ah(async (req: Request, res: Response) => {
    const taskId = getSingleParam(req.params.taskId);
    if (!taskId) return res.status(400).json({ error: 'taskId is required' });
    res.json(await repo.findByTaskId(taskId));
  }));

  // List time reports for a user
  app.get('/api/time-reports', ah(async (req: Request, res: Response) => {
    const userId = (req.query.userId as string | undefined)
      ?? (getCurrentUserId ? (getCurrentUserId(req) ?? undefined) : undefined);
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    res.json(await repo.findByUserId(userId, from, to));
  }));

  // Get single time report
  app.get('/api/time-reports/:id', ah(async (req: Request, res: Response) => {
    const id = parseNumericId(getSingleParam(req.params.id));
    if (id == null) return res.status(400).json({ error: 'id is required' });
    const row = await repo.findById(id);
    if (!row) return res.status(404).json({ error: 'Time report not found' });
    res.json(row);
  }));

  // Create time report for task
  app.post('/api/tasks/:taskId/time-reports', ah(async (req: Request, res: Response) => {
    const { userId, reportDate, hours, description } = req.body;
    const resolvedUserId = userId
      ?? (getCurrentUserId ? getCurrentUserId(req) : null);
    if (!resolvedUserId) return res.status(400).json({ error: 'userId is required' });
    if (!reportDate) return res.status(400).json({ error: 'reportDate is required' });
    if (hours == null || isNaN(Number(hours))) return res.status(400).json({ error: 'hours must be a number' });
    const row = await repo.create({
      taskId: getSingleParam(req.params.taskId),
      userId: String(resolvedUserId),
      reportDate: String(reportDate),
      hours: Number(hours),
      description: description != null ? String(description) : null,
    });
    res.status(201).json(row);
  }));

  // Update time report
  app.put('/api/time-reports/:id', ah(async (req: Request, res: Response) => {
    const id = parseNumericId(getSingleParam(req.params.id));
    if (id == null) return res.status(400).json({ error: 'id is required' });
    const { reportDate, hours, description } = req.body;
    const row = await repo.updateById(id, {
      reportDate: reportDate != null ? String(reportDate) : undefined,
      hours: hours != null ? Number(hours) : undefined,
      description: description !== undefined ? (description != null ? String(description) : null) : undefined,
    });
    if (!row) return res.status(404).json({ error: 'Time report not found' });
    res.json(row);
  }));

  // Delete time report
  app.delete('/api/time-reports/:id', ah(async (req: Request, res: Response) => {
    const id = parseNumericId(getSingleParam(req.params.id));
    if (id == null) return res.status(400).json({ error: 'id is required' });
    await repo.deleteById(id);
    res.json({ success: true });
  }));

  // Sum hours for task
  app.get('/api/tasks/:taskId/time-reports/summary', ah(async (req: Request, res: Response) => {
    const taskId = getSingleParam(req.params.taskId);
    if (!taskId) return res.status(400).json({ error: 'taskId is required' });
    const result = await repo.sumHoursByTaskId(taskId);
    res.json({ taskId, totalHours: result?.totalHours ?? 0 });
  }));

  app.get('/api/v1/tasks/:taskId/worklogs', ah(async (req: Request, res: Response) => {
    const taskId = getSingleParam(req.params.taskId);
    if (!taskId) return res.status(400).json({ error: 'taskId is required' });
    const items = await repo.findByTaskId(taskId);
    res.json({ items: items.map(mapWorklogRow) });
  }));

  app.post('/api/v1/tasks/:taskId/worklogs', ah(async (req: Request, res: Response) => {
    const taskId = getSingleParam(req.params.taskId);
    if (!taskId) return res.status(400).json({ error: 'taskId is required' });
    const { userId, reportDate, hours, description } = req.body;
    const resolvedUserId = userId ?? (getCurrentUserId ? getCurrentUserId(req) : null);
    if (!resolvedUserId) return res.status(400).json({ error: 'userId is required' });
    if (!reportDate) return res.status(400).json({ error: 'reportDate is required' });
    if (hours == null || isNaN(Number(hours))) return res.status(400).json({ error: 'hours must be a number' });

    const row = await repo.create({
      taskId,
      userId: String(resolvedUserId),
      reportDate: String(reportDate),
      hours: Number(hours),
      description: description != null ? String(description) : null,
    });
    res.status(201).json(mapWorklogRow(row));
  }));
}
