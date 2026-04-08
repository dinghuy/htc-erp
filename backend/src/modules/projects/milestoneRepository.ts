import { getDb } from '../../../sqlite-db';

export const VALID_MILESTONE_STATUSES = ['planned', 'in_progress', 'completed', 'cancelled'] as const;
export type MilestoneStatus = typeof VALID_MILESTONE_STATUSES[number];

export type MilestoneRow = {
  id: number;
  projectId: number | string;
  label: string;
  description?: string | null;
  status?: MilestoneStatus;
  targetDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export function createMilestoneRepository() {
  return {
    findByProjectId(projectId: number | string) {
      return getDb().all<MilestoneRow>(
        'SELECT * FROM Milestone WHERE projectId = ? ORDER BY targetDate ASC, createdAt ASC',
        [projectId]
      );
    },

    findById(id: number | string) {
      return getDb().get<MilestoneRow>('SELECT * FROM Milestone WHERE id = ?', [id]);
    },

    async create(input: { projectId: number | string; label: string; description?: string | null; status?: MilestoneStatus; targetDate?: string | null }) {
      const result = await getDb().run(
        `INSERT INTO Milestone (projectId, label, description, status, targetDate, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [
          input.projectId,
          input.label,
          input.description ?? null,
          input.status ?? 'planned',
          input.targetDate ?? null,
        ]
      );
      const id = result.lastID;
      return this.findById(id);
    },

    async updateById(id: number | string, input: Partial<Omit<MilestoneRow, 'id' | 'projectId' | 'createdAt'>>) {
      const existing = await this.findById(id);
      if (!existing) return null;
      await getDb().run(
        `UPDATE Milestone SET label = ?, description = ?, status = ?, targetDate = ?, updatedAt = datetime('now')
         WHERE id = ?`,
        [
          input.label ?? existing.label,
          input.description !== undefined ? (input.description ?? null) : (existing.description ?? null),
          input.status ?? existing.status,
          input.targetDate !== undefined ? (input.targetDate ?? null) : (existing.targetDate ?? null),
          id,
        ]
      );
      return this.findById(id);
    },

    deleteById(id: number | string) {
      return getDb().run('DELETE FROM Milestone WHERE id = ?', [id]);
    },

    deleteByProjectId(projectId: number | string) {
      return getDb().run('DELETE FROM Milestone WHERE projectId = ?', [projectId]);
    },
  };
}

export const milestoneRepository = createMilestoneRepository();
