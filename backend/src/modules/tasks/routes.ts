import type { Express, Request, Response } from 'express';
import { createTaskRepository } from './repository';
import { todoRepository, VALID_TODO_PRIORITIES, type ToDoPriority } from './todoRepository';

type AsyncRouteFactory = (handler: (req: Request, res: Response) => Promise<unknown>) => any;

type RegisterTaskRoutesDeps = {
  ah: AsyncRouteFactory;
  requireAuth: any;
  requireRole: (...roles: string[]) => any;
  appendDateRangeFilter: (
    conditions: string[],
    params: unknown[],
    fieldName: string,
    from: unknown,
    to: unknown
  ) => void;
  getCurrentUserId: (req: Request) => string | null;
  resolveAssigneeId: (
    db: any,
    preferredAssigneeId: unknown,
    salesperson: unknown,
    fallbackUserId: string | null
  ) => Promise<string | null>;
  getTaskWithLinksById: (db: any, taskId: string) => Promise<any>;
};

function resolveWorkspaceTabForTask(task: any) {
  const taskType = String(task?.taskType || '').trim().toLowerCase();
  const department = String(task?.department || '').trim().toLowerCase();
  const quotationStatus = String(task?.quotationStatus || '').trim().toLowerCase();
  if (taskType.includes('handoff') || taskType.includes('quotation') || taskType.includes('commercial')) return 'commercial';
  if (taskType.includes('procurement') || taskType.includes('supplier') || department.includes('procurement')) return 'procurement';
  if (taskType.includes('delivery') || taskType.includes('inbound') || department.includes('logistics')) return 'delivery';
  if (taskType.includes('document') || taskType.includes('contract') || department.includes('legal')) return 'documents';
  if (quotationStatus === 'submitted_for_approval' || quotationStatus === 'revision_required') return 'commercial';
  return 'timeline';
}

function decorateTaskRow(task: any) {
  const workspaceTab = resolveWorkspaceTabForTask(task);
  const blockers = String(task?.blockedReason || '').trim() ? [String(task.blockedReason).trim()] : [];
  return {
    ...task,
    actionAvailability: {
      workspaceTab,
      canOpenTask: true,
      canOpenProject: Boolean(task?.projectId),
      canOpenQuotation: Boolean(task?.quotationId),
      primaryActionLabel: blockers.length > 0 ? 'Gỡ blocker' : (task?.projectId ? 'Mở workspace' : (task?.quotationId ? 'Mở báo giá' : 'Mở task')),
      blockers,
    },
  };
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function optionalString(value: unknown) {
  const normalized = stringValue(value);
  return normalized || null;
}

function normalizeTaskViewSurface(value: unknown) {
  return stringValue(value).toLowerCase() === 'list' ? 'list' : 'kanban';
}

function normalizeTaskViewGroupBy(value: unknown) {
  const normalized = stringValue(value).toLowerCase();
  return ['none', 'project', 'assignee', 'department', 'tasktype', 'urgency', 'hierarchy'].includes(normalized)
    ? (normalized === 'tasktype' ? 'taskType' : normalized)
    : 'none';
}

function normalizeTaskViewPresetRow(row: any) {
  return {
    ...row,
    onlyOverdue: Boolean(row?.onlyOverdue),
    groupBy: normalizeTaskViewGroupBy(row?.groupBy),
    isDefault: Boolean(row?.isDefault),
    surface: normalizeTaskViewSurface(row?.surface),
  };
}

export function registerTaskRoutes(app: Express, deps: RegisterTaskRoutesDeps) {
  const {
    ah,
    requireAuth,
    requireRole,
    appendDateRangeFilter,
    getCurrentUserId,
    resolveAssigneeId,
  } = deps;
  const taskRepository = createTaskRepository({ appendDateRangeFilter });
  const checklistRepository = todoRepository;
  const taskViewListPaths = ['/api/tasks/views', '/api/v1/tasks/views'];

  const listTaskViewPresetsHandler = ah(async (req: Request, res: Response) => {
    const userId = getCurrentUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const rows = await taskRepository.listTaskViewPresets(userId);
    res.json({ items: rows.map((row: any) => normalizeTaskViewPresetRow(row)) });
  });

  const createTaskViewPresetHandler = ah(async (req: Request, res: Response) => {
    const userId = getCurrentUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const name = stringValue(req.body?.name);
    if (!name) return res.status(400).json({ error: 'name is required' });

    const result = await taskRepository.createTaskViewPreset(userId, {
      name,
      query: optionalString(req.body?.query),
      projectId: optionalString(req.body?.projectId),
      assigneeId: optionalString(req.body?.assigneeId),
      priority: optionalString(req.body?.priority),
      status: optionalString(req.body?.status),
      onlyOverdue: Boolean(req.body?.onlyOverdue),
      groupBy: normalizeTaskViewGroupBy(req.body?.groupBy),
      surface: normalizeTaskViewSurface(req.body?.surface),
      isDefault: Boolean(req.body?.isDefault),
    });

    const id = result.lastID;
    const created = await taskRepository.findTaskViewPresetByIdForUser(id, userId);
    res.status(201).json(normalizeTaskViewPresetRow(created));
  });

  const deleteTaskViewPresetHandler = ah(async (req: Request, res: Response) => {
    const userId = getCurrentUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const presetId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const existing = await taskRepository.findTaskViewPresetByIdForUser(presetId, userId);
    if (!existing) return res.status(404).json({ error: 'Task view preset not found' });
    await taskRepository.deleteTaskViewPreset(presetId, userId);
    res.json({ success: true });
  });

  const updateTaskViewPresetHandler = ah(async (req: Request, res: Response) => {
    const userId = getCurrentUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const presetId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const existing = await taskRepository.findTaskViewPresetByIdForUser(presetId, userId);
    if (!existing) return res.status(404).json({ error: 'Task view preset not found' });

    const name = stringValue(req.body?.name ?? existing.name);
    if (!name) return res.status(400).json({ error: 'name is required' });

    await taskRepository.updateTaskViewPreset(presetId, userId, {
      name,
      query: optionalString(req.body?.query ?? existing.query),
      projectId: optionalString(req.body?.projectId ?? existing.projectId),
      assigneeId: optionalString(req.body?.assigneeId ?? existing.assigneeId),
      priority: optionalString(req.body?.priority ?? existing.priority),
      status: optionalString(req.body?.status ?? existing.status),
      onlyOverdue: req.body?.onlyOverdue === undefined ? Boolean(existing.onlyOverdue) : Boolean(req.body?.onlyOverdue),
      groupBy: req.body?.groupBy === undefined ? normalizeTaskViewGroupBy(existing.groupBy) : normalizeTaskViewGroupBy(req.body?.groupBy),
      surface: req.body?.surface === undefined ? normalizeTaskViewSurface(existing.surface) : normalizeTaskViewSurface(req.body?.surface),
      isDefault: req.body?.isDefault === undefined ? Boolean(existing.isDefault) : Boolean(req.body?.isDefault),
    });

    const updated = await taskRepository.findTaskViewPresetByIdForUser(presetId, userId);
    res.json(normalizeTaskViewPresetRow(updated));
  });

  for (const pathname of taskViewListPaths) {
    app.get(pathname, requireAuth, listTaskViewPresetsHandler);
    app.post(pathname, requireAuth, createTaskViewPresetHandler);
    app.patch(`${pathname}/:id`, requireAuth, updateTaskViewPresetHandler);
    app.delete(`${pathname}/:id`, requireAuth, deleteTaskViewPresetHandler);
  }

  app.get('/api/v1/tasks/:taskId/checklist', requireAuth, ah(async (req: Request, res: Response) => {
    const taskId = Array.isArray(req.params.taskId) ? req.params.taskId[0] : req.params.taskId;
    res.json({ items: await checklistRepository.findByEntity('Task', taskId) });
  }));

  app.post('/api/v1/tasks/:taskId/checklist', requireAuth, ah(async (req: Request, res: Response) => {
    const taskId = Array.isArray(req.params.taskId) ? req.params.taskId[0] : req.params.taskId;
    const userId = getCurrentUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const title = stringValue(req.body?.title);
    const priority = stringValue(req.body?.priority) || 'no_priority';
    if (!title) return res.status(400).json({ error: 'title is required' });
    if (!VALID_TODO_PRIORITIES.includes(priority as ToDoPriority)) {
      return res.status(400).json({ error: `Invalid priority. Must be one of: ${VALID_TODO_PRIORITIES.join(', ')}` });
    }
    const created = await checklistRepository.create({
      userId,
      title,
      description: optionalString(req.body?.description),
      dueDate: optionalString(req.body?.dueDate),
      priority: priority as ToDoPriority,
      visibility: 'public',
      entityType: 'Task',
      entityId: taskId,
    });
    res.status(201).json(created);
  }));

  app.patch('/api/v1/tasks/:taskId/checklist/:itemId', requireAuth, ah(async (req: Request, res: Response) => {
    const taskId = Array.isArray(req.params.taskId) ? req.params.taskId[0] : req.params.taskId;
    const itemId = Array.isArray(req.params.itemId) ? req.params.itemId[0] : req.params.itemId;
    const existing = await checklistRepository.findByIdForEntity(itemId, 'Task', taskId);
    if (!existing) return res.status(404).json({ error: 'Checklist item not found' });
    const priority = req.body?.priority === undefined ? existing.priority : stringValue(req.body?.priority);
    if (priority && !VALID_TODO_PRIORITIES.includes(priority as ToDoPriority)) {
      return res.status(400).json({ error: `Invalid priority. Must be one of: ${VALID_TODO_PRIORITIES.join(', ')}` });
    }
    const updated = await checklistRepository.updateById(itemId, {
      title: req.body?.title !== undefined ? stringValue(req.body?.title) : undefined,
      description: req.body?.description !== undefined ? optionalString(req.body?.description) : undefined,
      dueDate: req.body?.dueDate !== undefined ? optionalString(req.body?.dueDate) : undefined,
      priority: priority as ToDoPriority | undefined,
      visibility: 'public',
      entityType: 'Task',
      entityId: taskId,
    });
    res.json(updated);
  }));

  app.post('/api/v1/tasks/:taskId/checklist/:itemId/done', requireAuth, ah(async (req: Request, res: Response) => {
    const taskId = Array.isArray(req.params.taskId) ? req.params.taskId[0] : req.params.taskId;
    const itemId = Array.isArray(req.params.itemId) ? req.params.itemId[0] : req.params.itemId;
    const existing = await checklistRepository.findByIdForEntity(itemId, 'Task', taskId);
    if (!existing) return res.status(404).json({ error: 'Checklist item not found' });
    res.json(await checklistRepository.markDone(itemId));
  }));

  app.post('/api/v1/tasks/:taskId/checklist/:itemId/undone', requireAuth, ah(async (req: Request, res: Response) => {
    const taskId = Array.isArray(req.params.taskId) ? req.params.taskId[0] : req.params.taskId;
    const itemId = Array.isArray(req.params.itemId) ? req.params.itemId[0] : req.params.itemId;
    const existing = await checklistRepository.findByIdForEntity(itemId, 'Task', taskId);
    if (!existing) return res.status(404).json({ error: 'Checklist item not found' });
    res.json(await checklistRepository.markUndone(itemId));
  }));

  app.delete('/api/v1/tasks/:taskId/checklist/:itemId', requireAuth, ah(async (req: Request, res: Response) => {
    const taskId = Array.isArray(req.params.taskId) ? req.params.taskId[0] : req.params.taskId;
    const itemId = Array.isArray(req.params.itemId) ? req.params.itemId[0] : req.params.itemId;
    const existing = await checklistRepository.findByIdForEntity(itemId, 'Task', taskId);
    if (!existing) return res.status(404).json({ error: 'Checklist item not found' });
    await checklistRepository.deleteById(itemId);
    res.json({ success: true });
  }));

  app.get('/api/v1/tasks/:taskId/subtasks', requireAuth, ah(async (req: Request, res: Response) => {
    const taskId = Array.isArray(req.params.taskId) ? req.params.taskId[0] : req.params.taskId;
    const rows = await taskRepository.listTasks({ parentTaskId: taskId });
    res.json({ items: rows.map((row: any) => decorateTaskRow(row)) });
  }));

  app.post('/api/v1/tasks/:taskId/subtasks', requireAuth, requireRole('admin', 'manager', 'sales'), ah(async (req: Request, res: Response) => {
    const parentTaskId = Array.isArray(req.params.taskId) ? req.params.taskId[0] : req.params.taskId;
    const parentTask = await taskRepository.getTaskWithLinksById(parentTaskId);
    if (!parentTask) return res.status(404).json({ error: 'Parent task not found' });
    const name = stringValue(req.body?.name);
    if (!name) return res.status(400).json({ error: 'name is required' });

    const result = await taskRepository.createTask({
      projectId: req.body?.projectId ?? parentTask.projectId ?? null,
      parentTaskId,
      name,
      description: req.body?.description,
      assigneeId: req.body?.assigneeId ?? parentTask.assigneeId ?? null,
      status: req.body?.status ?? 'pending',
      priority: req.body?.priority ?? 'medium',
      startDate: req.body?.startDate ?? null,
      dueDate: req.body?.dueDate ?? parentTask.dueDate ?? null,
      completionPct: req.body?.completionPct ?? 0,
      notes: req.body?.notes,
      accountId: req.body?.accountId ?? parentTask.accountId ?? null,
      leadId: req.body?.leadId,
      quotationId: req.body?.quotationId ?? parentTask.quotationId ?? null,
      target: req.body?.target,
      resultLinks: req.body?.resultLinks,
      output: req.body?.output,
      reportDate: req.body?.reportDate,
      taskType: req.body?.taskType ?? parentTask.taskType ?? null,
      department: req.body?.department ?? parentTask.department ?? null,
      blockedReason: req.body?.blockedReason,
    });
    const id = result.lastID;
    res.status(201).json(await taskRepository.getTaskWithLinksById(id));
  }));

  app.post('/api/v1/tasks/:taskId/subtasks/reorder', requireAuth, requireRole('admin', 'manager', 'sales'), ah(async (req: Request, res: Response) => {
    const parentTaskId = Array.isArray(req.params.taskId) ? req.params.taskId[0] : req.params.taskId;
    const orderedTaskIds = Array.isArray(req.body?.orderedTaskIds)
      ? req.body.orderedTaskIds.map((value: unknown) => stringValue(value)).filter(Boolean)
      : [];
    if (!orderedTaskIds.length) return res.status(400).json({ error: 'orderedTaskIds is required' });
    const items = await taskRepository.reorderSiblingTasks(parentTaskId, orderedTaskIds);
    res.json({ items: items.map((row: any) => decorateTaskRow(row)) });
  }));

  app.delete('/api/v1/tasks/:taskId/subtasks/:subtaskId', requireAuth, requireRole('admin', 'manager', 'sales'), ah(async (req: Request, res: Response) => {
    const parentTaskId = Array.isArray(req.params.taskId) ? req.params.taskId[0] : req.params.taskId;
    const subtaskId = Array.isArray(req.params.subtaskId) ? req.params.subtaskId[0] : req.params.subtaskId;
    const subtask = await taskRepository.getTaskWithLinksById(subtaskId);
    if (!subtask || subtask.parentTaskId !== parentTaskId) {
      return res.status(404).json({ error: 'Subtask not found' });
    }
    await taskRepository.deleteTask(subtaskId);
    res.json({ success: true });
  }));

  app.get('/api/tasks', ah(async (req: Request, res: Response) => {
    const rows = await taskRepository.listTasks(req.query as Record<string, string | undefined>);
    res.json(rows.map((row: any) => decorateTaskRow(row)));
  }));

  app.post('/api/v1/tasks/bulk-update', requireAuth, requireRole('admin', 'manager', 'sales'), ah(async (req: Request, res: Response) => {
    const taskIds = Array.isArray(req.body?.taskIds)
      ? req.body.taskIds.map((value: unknown) => stringValue(value)).filter(Boolean)
      : [];
    if (!taskIds.length) return res.status(400).json({ error: 'taskIds is required' });

    const changes = {
      status: req.body?.changes?.status !== undefined ? optionalString(req.body?.changes?.status) : null,
      priority: req.body?.changes?.priority !== undefined ? optionalString(req.body?.changes?.priority) : null,
      assigneeId: req.body?.changes?.assigneeId !== undefined ? optionalString(req.body?.changes?.assigneeId) : undefined,
    };

    const items = await taskRepository.bulkUpdateTasks(taskIds, changes);
    res.json({
      updatedCount: items.length,
      items: items.map((row: any) => decorateTaskRow(row)),
    });
  }));

  app.post('/api/v1/projects/:projectId/tasks/reorder', requireAuth, requireRole('admin', 'manager', 'sales'), ah(async (req: Request, res: Response) => {
    const projectId = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
    const orderedTaskIds = Array.isArray(req.body?.orderedTaskIds)
      ? req.body.orderedTaskIds.map((value: unknown) => stringValue(value)).filter(Boolean)
      : [];
    if (!orderedTaskIds.length) return res.status(400).json({ error: 'orderedTaskIds is required' });
    const items = await taskRepository.reorderProjectTasks(projectId, orderedTaskIds);
    res.json({ items: items.map((row: any) => decorateTaskRow(row)) });
  }));

  app.get('/api/tasks/:id', ah(async (req: Request, res: Response) => {
    const taskId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const row = await taskRepository.getTaskById(taskId);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(decorateTaskRow(row));
  }));

  app.post('/api/tasks', requireAuth, requireRole('admin', 'manager', 'sales'), ah(async (req: Request, res: Response) => {
    const {
      projectId,
      parentTaskId,
      name,
      description,
      assigneeId,
      status = 'pending',
      priority = 'medium',
      startDate,
      dueDate,
      completionPct = 0,
      notes,
      accountId,
      leadId,
      quotationId,
      target,
      resultLinks,
      output,
      reportDate,
      taskType,
      department,
      blockedReason,
    } = req.body ?? {};

    if (!name) return res.status(400).json({ error: 'name is required' });

    const result = await taskRepository.createTask({
      projectId,
      parentTaskId,
      name,
      description,
      assigneeId,
      status,
      priority,
      startDate,
      dueDate,
      completionPct,
      notes,
      accountId,
      leadId,
      quotationId,
      target,
      resultLinks,
      output,
      reportDate,
      taskType,
      department,
      blockedReason,
    });
    const id = result.lastID;
    res.status(201).json(await taskRepository.getTaskWithLinksById(id));
  }));

  app.post('/api/tasks/from-quotation', requireAuth, requireRole('admin', 'manager', 'sales'), ah(async (req: Request, res: Response) => {
    const actorUserId = getCurrentUserId(req);
    const quotationId = typeof req.body?.quotationId === 'string' ? req.body.quotationId.trim() : '';
    if (!quotationId) return res.status(400).json({ error: 'quotationId is required' });

    const quotation = await taskRepository.getQuotationWithAccountName(quotationId);
    if (!quotation) return res.status(404).json({ error: 'Quotation not found' });

    const projectId = typeof req.body?.projectId === 'string' && req.body.projectId.trim() ? req.body.projectId.trim() : null;
    const leadId = typeof req.body?.leadId === 'string' && req.body.leadId.trim()
      ? req.body.leadId.trim()
      : (quotation.opportunityId || null);
    const assigneeId = await resolveAssigneeId(
      null,
      req.body?.assigneeId,
      req.body?.salesperson ?? quotation.salesperson,
      actorUserId
    );

    const taskName = typeof req.body?.name === 'string' && req.body.name.trim()
      ? req.body.name.trim()
      : `Follow up quotation ${quotation.quoteNumber || quotation.id}`;
    const dedupeDescription = typeof req.body?.description === 'string' && req.body.description.trim()
      ? req.body.description.trim()
      : `Linked task for quotation ${quotation.quoteNumber || quotation.id}`;
    const notes = typeof req.body?.notes === 'string' && req.body.notes.trim() ? req.body.notes.trim() : null;
    const target = typeof req.body?.target === 'string' && req.body.target.trim() ? req.body.target.trim() : `quotation:${quotation.id}`;

    const existing = await taskRepository.findExistingTaskForQuotation(
      quotation.id,
      req.body?.id || '',
      taskName,
      projectId,
      assigneeId
    );
    if (existing) {
      return res.json(await taskRepository.getTaskWithLinksById(existing.id));
    }

    const status = typeof req.body?.status === 'string' && req.body.status.trim() ? req.body.status.trim() : 'pending';
    const priority = typeof req.body?.priority === 'string' && req.body.priority.trim() ? req.body.priority.trim() : 'medium';
    const startDate = typeof req.body?.startDate === 'string' && req.body.startDate.trim()
      ? req.body.startDate.trim()
      : new Date().toISOString().slice(0, 10);
    const dueDate = typeof req.body?.dueDate === 'string' && req.body.dueDate.trim() ? req.body.dueDate.trim() : null;
    const completionPct = Number.isFinite(Number(req.body?.completionPct)) ? Number(req.body.completionPct) : 0;
    const taskType = typeof req.body?.taskType === 'string' && req.body.taskType.trim() ? req.body.taskType.trim() : 'follow_up';
    const department = typeof req.body?.department === 'string' && req.body.department.trim() ? req.body.department.trim() : 'Sales';
    const accountId = typeof req.body?.accountId === 'string' && req.body.accountId.trim()
      ? req.body.accountId.trim()
      : (quotation.accountId || null);

    const result = await taskRepository.createTask({
      projectId,
      name: taskName,
      description: dedupeDescription,
      assigneeId,
      status,
      priority,
      startDate,
      dueDate,
      completionPct,
      notes,
      accountId,
      leadId,
      quotationId: quotation.id,
      target,
      resultLinks: typeof req.body?.resultLinks === 'string' ? req.body.resultLinks : null,
      output: typeof req.body?.output === 'string' ? req.body.output : null,
      reportDate: typeof req.body?.reportDate === 'string' ? req.body.reportDate : null,
      taskType,
      department,
      blockedReason: typeof req.body?.blockedReason === 'string' ? req.body.blockedReason : null,
    });
    const id = result.lastID;
    res.status(201).json(await taskRepository.getTaskWithLinksById(id));
  }));

  app.put('/api/tasks/:id', requireAuth, requireRole('admin', 'manager', 'sales'), ah(async (req: Request, res: Response) => {
    const taskId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const existing = await taskRepository.taskExists(taskId);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const {
      projectId,
      parentTaskId,
      name,
      description,
      assigneeId,
      status,
      priority,
      startDate,
      dueDate,
      completionPct,
      notes,
      accountId,
      leadId,
      quotationId,
      target,
      resultLinks,
      output,
      reportDate,
      taskType,
      department,
      blockedReason,
    } = req.body ?? {};

    await taskRepository.updateTask(taskId, {
      projectId,
      parentTaskId,
      name,
      description,
      assigneeId,
      status,
      priority,
      startDate,
      dueDate,
      completionPct,
      notes,
      accountId,
      leadId,
      quotationId,
      target,
      resultLinks,
      output,
      reportDate,
      taskType,
      department,
      blockedReason,
    });

    res.json(await taskRepository.getTaskWithLinksById(taskId));
  }));

  app.delete('/api/tasks/:id', requireAuth, requireRole('admin', 'manager'), ah(async (req: Request, res: Response) => {
    const taskId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    await taskRepository.deleteTask(taskId);
    res.json({ success: true });
  }));
}
