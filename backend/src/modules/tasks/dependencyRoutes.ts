import type { Express, Request, Response } from 'express';
import { createTaskRepository } from './repository';

type AsyncRouteFactory = (handler: (req: Request, res: Response) => Promise<unknown>) => any;

type RegisterTaskDependencyRoutesDeps = {
  ah: AsyncRouteFactory;
  requireAuth?: any;
  getCurrentUserId?: (req: Request) => number | string | null;
};

const VALID_DEPENDENCY_KINDS = new Set(['blocks', 'blocked_by', 'relates_to']);

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function mapDependencyRow(row: any) {
  return {
    id: row.id,
    taskId: row.taskId,
    relatedTaskId: row.relatedTaskId,
    kind: row.kind,
    note: row.note ?? null,
    createdBy: row.createdBy ?? null,
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
    context: {
      taskName: row.relatedTaskName ?? null,
      taskStatus: row.relatedTaskStatus ?? null,
      taskPriority: row.relatedTaskPriority ?? null,
      projectId: row.relatedTaskProjectId ?? null,
    },
  };
}

export function registerTaskDependencyRoutes(app: Express, deps: RegisterTaskDependencyRoutesDeps) {
  const { ah, requireAuth, getCurrentUserId } = deps;
  const repo = createTaskRepository();

  app.get('/api/v1/tasks/:taskId/dependencies', requireAuth, ah(async (req: Request, res: Response) => {
    const taskId = getSingleParam(req.params.taskId);
    if (!taskId) return res.status(400).json({ error: 'taskId is required' });
    const items = await repo.listTaskDependencies(taskId);
    res.json({ items: items.map(mapDependencyRow) });
  }));

  app.post('/api/v1/tasks/:taskId/dependencies', requireAuth, ah(async (req: Request, res: Response) => {
    const taskId = getSingleParam(req.params.taskId);
    if (!taskId) return res.status(400).json({ error: 'taskId is required' });
    if (!await repo.taskExists(taskId)) return res.status(404).json({ error: 'Task not found' });

    const relatedTaskId = typeof req.body?.relatedTaskId === 'string' ? req.body.relatedTaskId.trim() : '';
    const kind = typeof req.body?.kind === 'string' ? req.body.kind.trim() : '';
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : null;

    if (!relatedTaskId) return res.status(400).json({ error: 'relatedTaskId is required' });
    if (!await repo.taskExists(relatedTaskId)) return res.status(404).json({ error: 'Related task not found' });
    if (!VALID_DEPENDENCY_KINDS.has(kind)) {
      return res.status(400).json({ error: 'kind must be one of: blocks, blocked_by, relates_to' });
    }

    const created = await repo.createTaskDependency(taskId, {
      relatedTaskId,
      kind,
      note,
      createdBy: getCurrentUserId ? getCurrentUserId(req) : null,
    });
    res.status(201).json(mapDependencyRow(created));
  }));

  app.delete('/api/v1/tasks/:taskId/dependencies/:dependencyId', requireAuth, ah(async (req: Request, res: Response) => {
    const taskId = getSingleParam(req.params.taskId);
    const dependencyId = getSingleParam(req.params.dependencyId);
    if (!taskId || !dependencyId) return res.status(400).json({ error: 'taskId and dependencyId are required' });
    await repo.deleteTaskDependency(taskId, dependencyId);
    res.json({ success: true });
  }));
}
