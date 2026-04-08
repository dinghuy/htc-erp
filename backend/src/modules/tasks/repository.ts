import { getDb } from '../../../sqlite-db';

type AppendDateRangeFilter = (
  conditions: string[],
  params: unknown[],
  fieldName: string,
  from: unknown,
  to: unknown
) => void;

type CreateTaskRepositoryDeps = {
  getDb?: () => any;
  appendDateRangeFilter?: AppendDateRangeFilter;
};

type TaskListFilters = {
  projectId?: number | string;
  parentTaskId?: number | string;
  assigneeId?: number | string;
  accountId?: number | string;
  leadId?: number | string;
  quotationId?: number | string;
  status?: string;
  taskType?: string;
  department?: string;
  blocked?: string;
  startDateFrom?: string;
  startDateTo?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
};

type TaskWriteInput = {
  projectId?: unknown;
  parentTaskId?: unknown;
  sortOrder?: unknown;
  name?: unknown;
  description?: unknown;
  assigneeId?: unknown;
  status?: unknown;
  priority?: unknown;
  startDate?: unknown;
  dueDate?: unknown;
  completionPct?: unknown;
  notes?: unknown;
  accountId?: unknown;
  leadId?: unknown;
  quotationId?: unknown;
  target?: unknown;
  resultLinks?: unknown;
  output?: unknown;
  reportDate?: unknown;
  taskType?: unknown;
  department?: unknown;
  blockedReason?: unknown;
};

type TaskDependencyWriteInput = {
  relatedTaskId: number | string;
  kind: string;
  note?: string | null;
  createdBy?: number | string | null;
};

type TaskViewPresetWriteInput = {
  name: string;
  query?: string | null;
  projectId?: number | string | null;
  assigneeId?: number | string | null;
  priority?: string | null;
  status?: string | null;
  onlyOverdue: boolean;
  groupBy: string;
  surface: string;
  isDefault: boolean;
};

const TASK_ROUTE_SELECT = `
  SELECT t.*,
         pt.name AS parentTaskName,
         (
           SELECT COUNT(*)
           FROM Task child
           WHERE child.parentTaskId = t.id
         ) AS subtaskCount,
         (
           SELECT COUNT(*)
           FROM Task child
           WHERE child.parentTaskId = t.id
             AND LOWER(COALESCE(child.status, '')) = 'completed'
         ) AS completedSubtaskCount,
         (
           SELECT COUNT(*)
           FROM ToDo todo
           WHERE todo.entityType = 'Task'
             AND todo.entityId = t.id
         ) AS checklistCount,
         (
           SELECT COUNT(*)
           FROM ToDo todo
           WHERE todo.entityType = 'Task'
             AND todo.entityId = t.id
             AND todo.doneAt IS NOT NULL
         ) AS checklistCompletedCount,
         CASE
           WHEN (
             (SELECT COUNT(*) FROM Task child WHERE child.parentTaskId = t.id) +
             (SELECT COUNT(*) FROM ToDo todo WHERE todo.entityType = 'Task' AND todo.entityId = t.id)
           ) = 0 THEN NULL
           ELSE ROUND(
             (
               (SELECT COUNT(*) FROM Task child WHERE child.parentTaskId = t.id AND LOWER(COALESCE(child.status, '')) = 'completed') +
               (SELECT COUNT(*) FROM ToDo todo WHERE todo.entityType = 'Task' AND todo.entityId = t.id AND todo.doneAt IS NOT NULL)
             ) * 100.0 /
             (
               (SELECT COUNT(*) FROM Task child WHERE child.parentTaskId = t.id) +
               (SELECT COUNT(*) FROM ToDo todo WHERE todo.entityType = 'Task' AND todo.entityId = t.id)
             )
           )
         END AS rollupCompletionPct,
         u.fullName AS assigneeName,
         p.name AS projectName,
         a.companyName AS accountName,
         l.companyName AS leadCompanyName,
         l.contactName AS leadContactName,
         q.quoteNumber AS quotationNumber,
         q.subject AS quotationSubject,
         q.status AS quotationStatus
  FROM Task t
  LEFT JOIN Task pt ON t.parentTaskId = pt.id
  LEFT JOIN User u ON t.assigneeId = u.id
  LEFT JOIN Project p ON t.projectId = p.id
  LEFT JOIN Account a ON t.accountId = a.id
  LEFT JOIN Lead l ON t.leadId = l.id
  LEFT JOIN Quotation q ON t.quotationId = q.id
`;

const TASK_WITH_LINKS_SELECT = `
  SELECT t.*,
         pt.name AS parentTaskName,
         (
           SELECT COUNT(*)
           FROM Task child
           WHERE child.parentTaskId = t.id
         ) AS subtaskCount,
         (
           SELECT COUNT(*)
           FROM Task child
           WHERE child.parentTaskId = t.id
             AND LOWER(COALESCE(child.status, '')) = 'completed'
         ) AS completedSubtaskCount,
         (
           SELECT COUNT(*)
           FROM ToDo todo
           WHERE todo.entityType = 'Task'
             AND todo.entityId = t.id
         ) AS checklistCount,
         (
           SELECT COUNT(*)
           FROM ToDo todo
           WHERE todo.entityType = 'Task'
             AND todo.entityId = t.id
             AND todo.doneAt IS NOT NULL
         ) AS checklistCompletedCount,
         CASE
           WHEN (
             (SELECT COUNT(*) FROM Task child WHERE child.parentTaskId = t.id) +
             (SELECT COUNT(*) FROM ToDo todo WHERE todo.entityType = 'Task' AND todo.entityId = t.id)
           ) = 0 THEN NULL
           ELSE ROUND(
             (
               (SELECT COUNT(*) FROM Task child WHERE child.parentTaskId = t.id AND LOWER(COALESCE(child.status, '')) = 'completed') +
               (SELECT COUNT(*) FROM ToDo todo WHERE todo.entityType = 'Task' AND todo.entityId = t.id AND todo.doneAt IS NOT NULL)
             ) * 100.0 /
             (
               (SELECT COUNT(*) FROM Task child WHERE child.parentTaskId = t.id) +
               (SELECT COUNT(*) FROM ToDo todo WHERE todo.entityType = 'Task' AND todo.entityId = t.id)
             )
           )
         END AS rollupCompletionPct,
         u.fullName AS assigneeName,
         p.name AS projectName,
         p.projectStage AS projectStage,
         a.companyName AS accountName,
         l.companyName AS leadCompanyName,
         l.contactName AS leadContactName,
         q.quoteNumber AS quotationNumber,
         q.subject AS quotationSubject,
         q.status AS quotationStatus
  FROM Task t
  LEFT JOIN Task pt ON t.parentTaskId = pt.id
  LEFT JOIN User u ON t.assigneeId = u.id
  LEFT JOIN Project p ON t.projectId = p.id
  LEFT JOIN Account a ON t.accountId = a.id
  LEFT JOIN Lead l ON t.leadId = l.id
  LEFT JOIN Quotation q ON t.quotationId = q.id
`;

function defaultAppendDateRangeFilter(
  conditions: string[],
  params: unknown[],
  fieldName: string,
  from: unknown,
  to: unknown
) {
  const start = typeof from === 'string' ? from.trim() : '';
  const end = typeof to === 'string' ? to.trim() : '';
  if (start) {
    conditions.push(`${fieldName} >= ?`);
    params.push(start);
  }
  if (end) {
    conditions.push(`${fieldName} <= ?`);
    params.push(end);
  }
}

function normalizeLookupText(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function toNullableValue(value: unknown) {
  return value || null;
}

export function createTaskRepository(deps: CreateTaskRepositoryDeps = {}) {
  const getDbInstance = deps.getDb ?? getDb;
  const appendDateRangeFilter = deps.appendDateRangeFilter ?? defaultAppendDateRangeFilter;

  async function listTasks(filters: TaskListFilters = {}) {
    const db = getDbInstance();
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.projectId) {
      conditions.push('t.projectId = ?');
      params.push(filters.projectId);
    }
    if (filters.parentTaskId) {
      conditions.push('t.parentTaskId = ?');
      params.push(filters.parentTaskId);
    }
    if (filters.assigneeId) {
      conditions.push('t.assigneeId = ?');
      params.push(filters.assigneeId);
    }
    if (filters.accountId) {
      conditions.push('t.accountId = ?');
      params.push(filters.accountId);
    }
    if (filters.leadId) {
      conditions.push('t.leadId = ?');
      params.push(filters.leadId);
    }
    if (filters.quotationId) {
      conditions.push('t.quotationId = ?');
      params.push(filters.quotationId);
    }
    if (filters.status) {
      conditions.push('t.status = ?');
      params.push(filters.status);
    }
    if (filters.taskType) {
      conditions.push('t.taskType = ?');
      params.push(filters.taskType);
    }
    if (filters.department) {
      conditions.push('t.department = ?');
      params.push(filters.department);
    }
    if (filters.blocked === 'true') {
      conditions.push(`t.blockedReason IS NOT NULL AND TRIM(t.blockedReason) <> ''`);
    }
    if (filters.blocked === 'false') {
      conditions.push(`(t.blockedReason IS NULL OR TRIM(t.blockedReason) = '')`);
    }

    appendDateRangeFilter(conditions, params, 't.startDate', filters.startDateFrom, filters.startDateTo);
    appendDateRangeFilter(conditions, params, 't.dueDate', filters.dueDateFrom, filters.dueDateTo);

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return db.all(
      `
        ${TASK_ROUTE_SELECT}
        ${where}
        ORDER BY COALESCE(t.sortOrder, 0) DESC, t.createdAt DESC
      `,
      params
    );
  }

  async function getTaskById(id: number | string) {
    const db = getDbInstance();
    return db.get(
      `
        ${TASK_ROUTE_SELECT}
        WHERE t.id = ?
      `,
      [id]
    );
  }

  async function getTaskWithLinksById(id: number | string) {
    const db = getDbInstance();
    return db.get(
      `
        ${TASK_WITH_LINKS_SELECT}
        WHERE t.id = ?
      `,
      [id]
    );
  }

  async function findUserByIdentifier(identifier: unknown) {
    const db = getDbInstance();
    const normalized = normalizeLookupText(identifier);
    if (!normalized) return null;
    return db.get(
      `SELECT id, fullName, username, email
       FROM User
       WHERE LOWER(TRIM(id)) = ?
          OR LOWER(TRIM(fullName)) = ?
          OR LOWER(TRIM(username)) = ?
          OR LOWER(TRIM(email)) = ?
       ORDER BY CASE
         WHEN LOWER(TRIM(fullName)) = ? THEN 0
         WHEN LOWER(TRIM(username)) = ? THEN 1
         WHEN LOWER(TRIM(email)) = ? THEN 2
         ELSE 3
       END
       LIMIT 1`,
      [normalized, normalized, normalized, normalized, normalized, normalized, normalized]
    );
  }

  async function getQuotationWithAccountName(quotationId: number | string) {
    const db = getDbInstance();
    return db.get(
      `SELECT q.*, a.companyName AS accountName
       FROM Quotation q
       LEFT JOIN Account a ON q.accountId = a.id
       WHERE q.id = ?`,
      [quotationId]
    );
  }

  async function findExistingTaskForQuotation(
    quotationId: number | string,
    requestedTaskId: number | string | null,
    taskName: string,
    projectId: number | string | null,
    assigneeId: number | string | null
  ) {
    const db = getDbInstance();
    return db.get(
      `SELECT id FROM Task
       WHERE quotationId = ? AND (
         id = ? OR
         (name = ? AND COALESCE(projectId, '') = COALESCE(?, '') AND COALESCE(assigneeId, '') = COALESCE(?, ''))
       )`,
      [quotationId, requestedTaskId, taskName, projectId, assigneeId || '']
    );
  }

  async function createTask(input: TaskWriteInput) {
    const db = getDbInstance();
    return db.run(
      `INSERT INTO Task (
        projectId, parentTaskId, sortOrder, name, description, assigneeId, status, priority, startDate, dueDate,
        completionPct, notes, accountId, leadId, quotationId, target, resultLinks, output,
        reportDate, taskType, department, blockedReason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        toNullableValue(input.projectId),
        toNullableValue(input.parentTaskId),
        input.sortOrder ?? Date.now(),
        input.name,
        toNullableValue(input.description),
        toNullableValue(input.assigneeId),
        input.status,
        input.priority,
        toNullableValue(input.startDate),
        toNullableValue(input.dueDate),
        input.completionPct ?? 0,
        toNullableValue(input.notes),
        toNullableValue(input.accountId),
        toNullableValue(input.leadId),
        toNullableValue(input.quotationId),
        toNullableValue(input.target),
        toNullableValue(input.resultLinks),
        toNullableValue(input.output),
        toNullableValue(input.reportDate),
        toNullableValue(input.taskType),
        toNullableValue(input.department),
        toNullableValue(input.blockedReason),
      ]
    );
  }

  async function taskExists(id: number | string) {
    const db = getDbInstance();
    return db.get('SELECT id FROM Task WHERE id = ?', [id]);
  }

  async function updateTask(id: number | string, input: TaskWriteInput) {
    const db = getDbInstance();
    await db.run(
      `UPDATE Task
       SET projectId = ?, parentTaskId = ?, sortOrder = COALESCE(?, sortOrder), name = ?, description = ?, assigneeId = ?, status = ?, priority = ?,
           startDate = ?, dueDate = ?, completionPct = ?, notes = ?, accountId = ?, leadId = ?,
           quotationId = ?, target = ?, resultLinks = ?, output = ?, reportDate = ?, taskType = ?,
           department = ?, blockedReason = ?, updatedAt = datetime('now')
       WHERE id = ?`,
      [
        toNullableValue(input.projectId),
        toNullableValue(input.parentTaskId),
        input.sortOrder ?? null,
        input.name,
        toNullableValue(input.description),
        toNullableValue(input.assigneeId),
        input.status,
        input.priority,
        toNullableValue(input.startDate),
        toNullableValue(input.dueDate),
        input.completionPct ?? 0,
        toNullableValue(input.notes),
        toNullableValue(input.accountId),
        toNullableValue(input.leadId),
        toNullableValue(input.quotationId),
        toNullableValue(input.target),
        toNullableValue(input.resultLinks),
        toNullableValue(input.output),
        toNullableValue(input.reportDate),
        toNullableValue(input.taskType),
        toNullableValue(input.department),
        toNullableValue(input.blockedReason),
        id,
      ]
    );
  }

  async function deleteTask(id: number | string) {
    const db = getDbInstance();
    await db.run('DELETE FROM Task WHERE id = ?', [id]);
  }

  async function listTasksByIds(taskIds: Array<number | string>) {
    const db = getDbInstance();
    if (taskIds.length === 0) return [];
    const placeholders = taskIds.map(() => '?').join(', ');
    return db.all(
      `
        ${TASK_WITH_LINKS_SELECT}
        WHERE t.id IN (${placeholders})
        ORDER BY COALESCE(t.sortOrder, 0) DESC, t.createdAt DESC
      `,
      taskIds
    );
  }

  async function bulkUpdateTasks(taskIds: Array<number | string>, changes: {
    status?: string | null;
    priority?: string | null;
    assigneeId?: number | string | null;
  }) {
    const db = getDbInstance();
    if (taskIds.length === 0) return [];
    const placeholders = taskIds.map(() => '?').join(', ');
    await db.run(
      `UPDATE Task
       SET status = COALESCE(?, status),
           priority = COALESCE(?, priority),
           assigneeId = CASE WHEN ? IS NULL THEN assigneeId ELSE ? END,
           updatedAt = datetime('now')
       WHERE id IN (${placeholders})`,
      [
        changes.status ?? null,
        changes.priority ?? null,
        changes.assigneeId === undefined ? null : changes.assigneeId,
        changes.assigneeId === undefined ? null : changes.assigneeId,
        ...taskIds,
      ]
    );
    return listTasksByIds(taskIds);
  }

  async function reorderSiblingTasks(parentTaskId: number | string, orderedTaskIds: Array<number | string>) {
    const db = getDbInstance();
    let sortValue = orderedTaskIds.length;
    for (const taskId of orderedTaskIds) {
      await db.run(
        `UPDATE Task SET sortOrder = ?, updatedAt = datetime('now') WHERE id = ? AND parentTaskId = ?`,
        [sortValue, taskId, parentTaskId]
      );
      sortValue -= 1;
    }
    return listTasks({ parentTaskId });
  }

  async function reorderProjectTasks(projectId: number | string, orderedTaskIds: Array<number | string>) {
    const db = getDbInstance();
    let sortValue = orderedTaskIds.length;
    for (const taskId of orderedTaskIds) {
      await db.run(
        `UPDATE Task SET sortOrder = ?, updatedAt = datetime('now') WHERE id = ? AND projectId = ? AND parentTaskId IS NULL`,
        [sortValue, taskId, projectId]
      );
      sortValue -= 1;
    }
    return listTasks({ projectId });
  }

  async function listTaskViewPresets(userId: number | string) {
    const db = getDbInstance();
    return db.all(
      `
        SELECT id, userId, name, query, projectId, assigneeId, priority, status, onlyOverdue, groupBy, surface, isDefault, createdAt, updatedAt
        FROM TaskViewPreset
        WHERE userId = ?
        ORDER BY isDefault DESC, createdAt ASC, id ASC
      `,
      [userId]
    );
  }

  async function findTaskViewPresetByIdForUser(id: number | string, userId: number | string) {
    const db = getDbInstance();
    return db.get(
      `
        SELECT id, userId, name, query, projectId, assigneeId, priority, status, onlyOverdue, groupBy, surface, isDefault, createdAt, updatedAt
        FROM TaskViewPreset
        WHERE id = ? AND userId = ?
      `,
      [id, userId]
    );
  }

  async function clearDefaultTaskViewPreset(userId: number | string) {
    const db = getDbInstance();
    await db.run(
      `UPDATE TaskViewPreset SET isDefault = 0, updatedAt = datetime('now') WHERE userId = ? AND isDefault = 1`,
      [userId]
    );
  }

  async function createTaskViewPreset(userId: number | string, input: TaskViewPresetWriteInput) {
    const db = getDbInstance();
    if (input.isDefault) {
      await clearDefaultTaskViewPreset(userId);
    }
    return db.run(
      `INSERT INTO TaskViewPreset (
        userId, name, query, projectId, assigneeId, priority, status, onlyOverdue, groupBy, surface, isDefault, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        userId,
        input.name,
        input.query ?? null,
        input.projectId ?? null,
        input.assigneeId ?? null,
        input.priority ?? null,
        input.status ?? null,
        input.onlyOverdue ? 1 : 0,
        input.groupBy,
        input.surface,
        input.isDefault ? 1 : 0,
      ]
    );
  }

  async function updateTaskViewPreset(id: number | string, userId: number | string, input: TaskViewPresetWriteInput) {
    const db = getDbInstance();
    if (input.isDefault) {
      await clearDefaultTaskViewPreset(userId);
    }
    await db.run(
      `UPDATE TaskViewPreset
       SET name = ?, query = ?, projectId = ?, assigneeId = ?, priority = ?, status = ?,
           onlyOverdue = ?, groupBy = ?, surface = ?, isDefault = ?, updatedAt = datetime('now')
       WHERE id = ? AND userId = ?`,
      [
        input.name,
        input.query ?? null,
        input.projectId ?? null,
        input.assigneeId ?? null,
        input.priority ?? null,
        input.status ?? null,
        input.onlyOverdue ? 1 : 0,
        input.groupBy,
        input.surface,
        input.isDefault ? 1 : 0,
        id,
        userId,
      ]
    );
  }

  async function deleteTaskViewPreset(id: number | string, userId: number | string) {
    const db = getDbInstance();
    await db.run(`DELETE FROM TaskViewPreset WHERE id = ? AND userId = ?`, [id, userId]);
  }

  async function listTaskDependencies(taskId: number | string) {
    const db = getDbInstance();
    return db.all(
      `
        SELECT td.*,
               rt.name AS relatedTaskName,
               rt.status AS relatedTaskStatus,
               rt.priority AS relatedTaskPriority,
               rt.projectId AS relatedTaskProjectId
        FROM TaskDependency td
        INNER JOIN Task rt ON rt.id = td.relatedTaskId
        WHERE td.taskId = ?
        ORDER BY td.createdAt DESC, td.id DESC
      `,
      [taskId]
    );
  }

  async function createTaskDependency(taskId: number | string, input: TaskDependencyWriteInput) {
    const db = getDbInstance();
    const result = await db.run(
      `INSERT INTO TaskDependency (taskId, relatedTaskId, kind, note, createdBy, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [taskId, input.relatedTaskId, input.kind, input.note ?? null, input.createdBy ?? null]
    );
    const id = result.lastID;
    return db.get(
      `
        SELECT td.*,
               rt.name AS relatedTaskName,
               rt.status AS relatedTaskStatus,
               rt.priority AS relatedTaskPriority,
               rt.projectId AS relatedTaskProjectId
        FROM TaskDependency td
        INNER JOIN Task rt ON rt.id = td.relatedTaskId
        WHERE td.id = ?
      `,
      [id]
    );
  }

  async function deleteTaskDependency(taskId: number | string, dependencyId: number | string) {
    const db = getDbInstance();
    await db.run('DELETE FROM TaskDependency WHERE id = ? AND taskId = ?', [dependencyId, taskId]);
  }

  return {
    listTasks,
    getTaskById,
    getTaskWithLinksById,
    findUserByIdentifier,
    getQuotationWithAccountName,
    findExistingTaskForQuotation,
    createTask,
    taskExists,
    updateTask,
    deleteTask,
    listTasksByIds,
    bulkUpdateTasks,
    reorderSiblingTasks,
    reorderProjectTasks,
    listTaskViewPresets,
    findTaskViewPresetByIdForUser,
    createTaskViewPreset,
    updateTaskViewPreset,
    deleteTaskViewPreset,
    listTaskDependencies,
    createTaskDependency,
    deleteTaskDependency,
  };
}
