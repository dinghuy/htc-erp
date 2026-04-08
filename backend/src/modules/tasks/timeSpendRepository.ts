import { getDb } from '../../../sqlite-db';

export type TimeSpendReportRow = {
  id: number;
  taskId: number | string;
  userId: number | string;
  reportDate: string;
  hours: number;
  description?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export function createTimeSpendRepository() {
  return {
    findByTaskId(taskId: number | string): Promise<Array<TimeSpendReportRow & { projectId?: number | string | null }>> {
      return getDb().all(
        `SELECT tsr.*, t.projectId
         FROM TimeSpendReport tsr
         LEFT JOIN Task t ON t.id = tsr.taskId
         WHERE tsr.taskId = ?
         ORDER BY tsr.reportDate DESC, tsr.createdAt DESC`,
        [taskId]
      ) as Promise<Array<TimeSpendReportRow & { projectId?: string | null }>>;
    },

    findByUserId(userId: number | string, from?: string, to?: string) {
      const conditions = ['userId = ?'];
      const params: unknown[] = [userId];
      if (from) { conditions.push('reportDate >= ?'); params.push(from); }
      if (to) { conditions.push('reportDate <= ?'); params.push(to); }
      return getDb().all<TimeSpendReportRow>(
        `SELECT * FROM TimeSpendReport WHERE ${conditions.join(' AND ')} ORDER BY reportDate DESC`,
        params
      );
    },

    findById(id: number | string) {
      return getDb().get<TimeSpendReportRow>('SELECT * FROM TimeSpendReport WHERE id = ?', [id]);
    },

    async create(input: { taskId: number | string; userId: number | string; reportDate: string; hours: number; description?: string | null }) {
      const result = await getDb().run(
        `INSERT INTO TimeSpendReport (taskId, userId, reportDate, hours, description, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [input.taskId, input.userId, input.reportDate, input.hours, input.description ?? null]
      );
      const id = result.lastID;
      return this.findById(id);
    },

    async updateById(id: number | string, input: Partial<Pick<TimeSpendReportRow, 'reportDate' | 'hours' | 'description'>>) {
      const existing = await this.findById(id);
      if (!existing) return null;
      await getDb().run(
        `UPDATE TimeSpendReport SET reportDate = ?, hours = ?, description = ?, updatedAt = datetime('now')
         WHERE id = ?`,
        [
          input.reportDate ?? existing.reportDate,
          input.hours != null ? Number(input.hours) : existing.hours,
          input.description !== undefined ? (input.description ?? null) : (existing.description ?? null),
          id,
        ]
      );
      return this.findById(id);
    },

    deleteById(id: number | string) {
      return getDb().run('DELETE FROM TimeSpendReport WHERE id = ?', [id]);
    },

    deleteByTaskId(taskId: number | string) {
      return getDb().run('DELETE FROM TimeSpendReport WHERE taskId = ?', [taskId]);
    },

    sumHoursByTaskId(taskId: number | string): Promise<{ totalHours: number } | undefined> {
      return getDb().get<{ totalHours: number }>(
        'SELECT COALESCE(SUM(hours), 0) as totalHours FROM TimeSpendReport WHERE taskId = ?',
        [taskId]
      );
    },
  };
}

export const timeSpendRepository = createTimeSpendRepository();
