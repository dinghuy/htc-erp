import { getDb } from '../../../sqlite-db';

export const VALID_TODO_PRIORITIES = ['no_priority', 'urgent', 'high', 'medium', 'low'] as const;
export const VALID_TODO_VISIBILITIES = ['private', 'public'] as const;

export type ToDoPriority = typeof VALID_TODO_PRIORITIES[number];
export type ToDoVisibility = typeof VALID_TODO_VISIBILITIES[number];

export type ToDoRow = {
  id: number;
  userId: number | string;
  title: string;
  description?: string | null;
  dueDate?: string | null;
  priority?: ToDoPriority;
  visibility?: ToDoVisibility;
  doneAt?: string | null;
  entityType?: string | null;
  entityId?: number | string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type WorkSlotRow = {
  id: number;
  todoId: number | string;
  startDate: string;
  endDate: string;
  createdAt?: string;
};

export function createTodoRepository() {
  return {
    // ── ToDo ────────────────────────────────────────────────────────────────
    findByUserId(userId: number | string, filters?: { done?: boolean; entityType?: string; entityId?: number | string }) {
      const conditions = ['userId = ?'];
      const params: unknown[] = [userId];
      if (filters?.done === true) {
        conditions.push('doneAt IS NOT NULL');
      } else if (filters?.done === false) {
        conditions.push('doneAt IS NULL');
      }
      if (filters?.entityType) {
        conditions.push('entityType = ?');
        params.push(filters.entityType);
      }
      if (filters?.entityId) {
        conditions.push('entityId = ?');
        params.push(filters.entityId);
      }
      return getDb().all<ToDoRow>(
        `SELECT * FROM ToDo WHERE ${conditions.join(' AND ')} ORDER BY doneAt IS NULL DESC, priority ASC, createdAt DESC`,
        params
      );
    },

    findById(id: number | string) {
      return getDb().get<ToDoRow>('SELECT * FROM ToDo WHERE id = ?', [id]);
    },

    findByEntity(entityType: string, entityId: number | string) {
      return getDb().all<ToDoRow>(
        `SELECT * FROM ToDo WHERE entityType = ? AND entityId = ? ORDER BY doneAt IS NULL DESC, priority ASC, createdAt ASC`,
        [entityType, entityId]
      );
    },

    async findByIdForEntity(id: number | string, entityType: string, entityId: number | string) {
      return getDb().get<ToDoRow>(
        `SELECT * FROM ToDo WHERE id = ? AND entityType = ? AND entityId = ?`,
        [id, entityType, entityId]
      );
    },

    async create(input: {
      userId: number | string;
      title: string;
      description?: string | null;
      dueDate?: string | null;
      priority?: ToDoPriority;
      visibility?: ToDoVisibility;
      entityType?: string | null;
      entityId?: number | string | null;
    }) {
      const result = await getDb().run(
        `INSERT INTO ToDo (userId, title, description, dueDate, priority, visibility, doneAt, entityType, entityId, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, datetime('now'), datetime('now'))`,
        [
          input.userId,
          input.title,
          input.description ?? null,
          input.dueDate ?? null,
          input.priority ?? 'no_priority',
          input.visibility ?? 'private',
          input.entityType ?? null,
          input.entityId ?? null,
        ]
      );
      const id = result.lastID;
      return this.findById(id);
    },

    async updateById(id: number | string, input: Partial<Omit<ToDoRow, 'id' | 'userId' | 'createdAt'>>) {
      const existing = await this.findById(id);
      if (!existing) return null;
      await getDb().run(
        `UPDATE ToDo SET title = ?, description = ?, dueDate = ?, priority = ?, visibility = ?, doneAt = ?, entityType = ?, entityId = ?, updatedAt = datetime('now')
         WHERE id = ?`,
        [
          input.title ?? existing.title,
          input.description !== undefined ? (input.description ?? null) : (existing.description ?? null),
          input.dueDate !== undefined ? (input.dueDate ?? null) : (existing.dueDate ?? null),
          input.priority ?? existing.priority,
          input.visibility ?? existing.visibility,
          input.doneAt !== undefined ? (input.doneAt ?? null) : (existing.doneAt ?? null),
          input.entityType !== undefined ? (input.entityType ?? null) : (existing.entityType ?? null),
          input.entityId !== undefined ? (input.entityId ?? null) : (existing.entityId ?? null),
          id,
        ]
      );
      return this.findById(id);
    },

    async markDone(id: number | string, doneAt?: string) {
      const ts = doneAt ?? new Date().toISOString();
      await getDb().run(
        `UPDATE ToDo SET doneAt = ?, updatedAt = datetime('now') WHERE id = ?`,
        [ts, id]
      );
      return this.findById(id);
    },

    async markUndone(id: number | string) {
      await getDb().run(
        `UPDATE ToDo SET doneAt = NULL, updatedAt = datetime('now') WHERE id = ?`,
        [id]
      );
      return this.findById(id);
    },

    deleteById(id: number | string) {
      return getDb().run('DELETE FROM ToDo WHERE id = ?', [id]);
    },

    // ── WorkSlot ────────────────────────────────────────────────────────────
    findWorkSlotsByTodoId(todoId: number | string) {
      return getDb().all<WorkSlotRow>(
        'SELECT * FROM WorkSlot WHERE todoId = ? ORDER BY startDate ASC',
        [todoId]
      );
    },

    findWorkSlotById(id: number | string) {
      return getDb().get<WorkSlotRow>('SELECT * FROM WorkSlot WHERE id = ?', [id]);
    },

    async createWorkSlot(input: { todoId: number | string; startDate: string; endDate: string }) {
      const result = await getDb().run(
        `INSERT INTO WorkSlot (todoId, startDate, endDate, createdAt)
         VALUES (?, ?, ?, datetime('now'))`,
        [input.todoId, input.startDate, input.endDate]
      );
      const id = result.lastID;
      return this.findWorkSlotById(id);
    },

    async updateWorkSlotById(id: number | string, input: { startDate?: string; endDate?: string }) {
      const existing = await this.findWorkSlotById(id);
      if (!existing) return null;
      await getDb().run(
        `UPDATE WorkSlot SET startDate = ?, endDate = ? WHERE id = ?`,
        [input.startDate ?? existing.startDate, input.endDate ?? existing.endDate, id]
      );
      return this.findWorkSlotById(id);
    },

    deleteWorkSlotById(id: number | string) {
      return getDb().run('DELETE FROM WorkSlot WHERE id = ?', [id]);
    },

    deleteWorkSlotsByTodoId(todoId: number | string) {
      return getDb().run('DELETE FROM WorkSlot WHERE todoId = ?', [todoId]);
    },
  };
}

export const todoRepository = createTodoRepository();
