import type { Express, Request, Response } from 'express';
import {
  todoRepository,
  VALID_TODO_PRIORITIES,
  VALID_TODO_VISIBILITIES,
  type ToDoPriority,
  type ToDoVisibility,
} from './todoRepository';

type AsyncRouteFactory = (handler: (req: Request, res: Response) => Promise<unknown>) => any;

type RegisterTodoRoutesDeps = {
  ah: AsyncRouteFactory;
  requireAuth?: any;
  getCurrentUserId?: (req: Request) => string | null;
};

export function registerTodoRoutes(app: Express, deps: RegisterTodoRoutesDeps) {
  const { ah, getCurrentUserId } = deps;
  const repo = todoRepository;
  const getSingleParam = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

  // List todos for a user
  app.get('/api/todos', ah(async (req: Request, res: Response) => {
    const userId = (req.query.userId as string | undefined)
      ?? (getCurrentUserId ? (getCurrentUserId(req) ?? undefined) : undefined);
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    const doneParam = req.query.done as string | undefined;
    const done = doneParam === 'true' ? true : doneParam === 'false' ? false : undefined;
    const entityType = req.query.entityType as string | undefined;
    const entityId = req.query.entityId as string | undefined;
    res.json(await repo.findByUserId(userId, { done, entityType, entityId }));
  }));

  // Get single todo
  app.get('/api/todos/:id', ah(async (req: Request, res: Response) => {
    const id = getSingleParam(req.params.id);
    if (!id) return res.status(400).json({ error: 'id is required' });
    const row = await repo.findById(id);
    if (!row) return res.status(404).json({ error: 'ToDo not found' });
    res.json(row);
  }));

  // Create todo
  app.post('/api/todos', ah(async (req: Request, res: Response) => {
    const { userId, title, description, dueDate, priority, visibility, entityType, entityId } = req.body;
    const resolvedUserId = userId
      ?? (getCurrentUserId ? getCurrentUserId(req) : null);
    if (!resolvedUserId) return res.status(400).json({ error: 'userId is required' });
    if (!title) return res.status(400).json({ error: 'title is required' });
    if (priority && !VALID_TODO_PRIORITIES.includes(priority as ToDoPriority)) {
      return res.status(400).json({ error: `Invalid priority. Must be one of: ${VALID_TODO_PRIORITIES.join(', ')}` });
    }
    if (visibility && !VALID_TODO_VISIBILITIES.includes(visibility as ToDoVisibility)) {
      return res.status(400).json({ error: `Invalid visibility. Must be one of: ${VALID_TODO_VISIBILITIES.join(', ')}` });
    }
    const row = await repo.create({
      userId: String(resolvedUserId),
      title: String(title),
      description: description != null ? String(description) : null,
      dueDate: dueDate != null ? String(dueDate) : null,
      priority: (priority as ToDoPriority | undefined) ?? 'no_priority',
      visibility: (visibility as ToDoVisibility | undefined) ?? 'private',
      entityType: entityType != null ? String(entityType) : null,
      entityId: entityId != null ? String(entityId) : null,
    });
    res.status(201).json(row);
  }));

  // Update todo
  app.put('/api/todos/:id', ah(async (req: Request, res: Response) => {
    const id = getSingleParam(req.params.id);
    if (!id) return res.status(400).json({ error: 'id is required' });
    const { title, description, dueDate, priority, visibility, doneAt, entityType, entityId } = req.body;
    if (priority && !VALID_TODO_PRIORITIES.includes(priority as ToDoPriority)) {
      return res.status(400).json({ error: `Invalid priority. Must be one of: ${VALID_TODO_PRIORITIES.join(', ')}` });
    }
    if (visibility && !VALID_TODO_VISIBILITIES.includes(visibility as ToDoVisibility)) {
      return res.status(400).json({ error: `Invalid visibility. Must be one of: ${VALID_TODO_VISIBILITIES.join(', ')}` });
    }
    const row = await repo.updateById(id, {
      title: title != null ? String(title) : undefined,
      description: description !== undefined ? (description != null ? String(description) : null) : undefined,
      dueDate: dueDate !== undefined ? (dueDate != null ? String(dueDate) : null) : undefined,
      priority: priority as ToDoPriority | undefined,
      visibility: visibility as ToDoVisibility | undefined,
      doneAt: doneAt !== undefined ? (doneAt != null ? String(doneAt) : null) : undefined,
      entityType: entityType !== undefined ? (entityType != null ? String(entityType) : null) : undefined,
      entityId: entityId !== undefined ? (entityId != null ? String(entityId) : null) : undefined,
    });
    if (!row) return res.status(404).json({ error: 'ToDo not found' });
    res.json(row);
  }));

  // Mark done
  app.post('/api/todos/:id/done', ah(async (req: Request, res: Response) => {
    const id = getSingleParam(req.params.id);
    if (!id) return res.status(400).json({ error: 'id is required' });
    const row = await repo.markDone(id, req.body.doneAt);
    if (!row) return res.status(404).json({ error: 'ToDo not found' });
    res.json(row);
  }));

  // Mark undone
  app.post('/api/todos/:id/undone', ah(async (req: Request, res: Response) => {
    const id = getSingleParam(req.params.id);
    if (!id) return res.status(400).json({ error: 'id is required' });
    const row = await repo.markUndone(id);
    if (!row) return res.status(404).json({ error: 'ToDo not found' });
    res.json(row);
  }));

  // Delete todo
  app.delete('/api/todos/:id', ah(async (req: Request, res: Response) => {
    const id = getSingleParam(req.params.id);
    if (!id) return res.status(400).json({ error: 'id is required' });
    await repo.deleteById(id);
    res.json({ success: true });
  }));

  // ── WorkSlot routes ──────────────────────────────────────────────────────
  app.get('/api/todos/:todoId/workslots', ah(async (req: Request, res: Response) => {
    const todoId = getSingleParam(req.params.todoId);
    if (!todoId) return res.status(400).json({ error: 'todoId is required' });
    res.json(await repo.findWorkSlotsByTodoId(todoId));
  }));

  app.get('/api/workslots/:id', ah(async (req: Request, res: Response) => {
    const id = getSingleParam(req.params.id);
    if (!id) return res.status(400).json({ error: 'id is required' });
    const row = await repo.findWorkSlotById(id);
    if (!row) return res.status(404).json({ error: 'WorkSlot not found' });
    res.json(row);
  }));

  app.post('/api/todos/:todoId/workslots', ah(async (req: Request, res: Response) => {
    const todoId = getSingleParam(req.params.todoId);
    if (!todoId) return res.status(400).json({ error: 'todoId is required' });
    const { startDate, endDate } = req.body;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }
    const row = await repo.createWorkSlot({
      todoId,
      startDate: String(startDate),
      endDate: String(endDate),
    });
    res.status(201).json(row);
  }));

  app.put('/api/workslots/:id', ah(async (req: Request, res: Response) => {
    const id = getSingleParam(req.params.id);
    if (!id) return res.status(400).json({ error: 'id is required' });
    const row = await repo.updateWorkSlotById(id, {
      startDate: req.body.startDate != null ? String(req.body.startDate) : undefined,
      endDate: req.body.endDate != null ? String(req.body.endDate) : undefined,
    });
    if (!row) return res.status(404).json({ error: 'WorkSlot not found' });
    res.json(row);
  }));

  app.delete('/api/workslots/:id', ah(async (req: Request, res: Response) => {
    const id = getSingleParam(req.params.id);
    if (!id) return res.status(400).json({ error: 'id is required' });
    await repo.deleteWorkSlotById(id);
    res.json({ success: true });
  }));
}
