import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../../../sqlite-db';

export const VALID_MILESTONE_STATUSES = ['planned', 'in_progress', 'completed', 'cancelled'] as const;
export type MilestoneStatus = typeof VALID_MILESTONE_STATUSES[number];

export type MilestoneRow = {
  id: string;
  projectId: string;
  label: string;
  description?: string | null;
  status?: MilestoneStatus;
  targetDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export function createMilestoneRepository() {
  return {
    findByProjectId(projectId: string) {
      return getDb().all<MilestoneRow>(
        'SELECT * FROM Milestone WHERE projectId = ? ORDER BY targetDate ASC, createdAt ASC',
        [projectId]
      );
    },

    findById(id: string) {
      return getDb().get<MilestoneRow>('SELECT * FROM Milestone WHERE id = ?', [id]);
    },

    async create(input: { projectId: string; label: string; description?: string | null; status?: MilestoneStatus; targetDate?: string | null }) {
      const id = uuidv4();
      await getDb().run(
        `INSERT INTO Milestone (id, projectId, label, description, status, targetDate, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [
          id,
          input.projectId,
          input.label,
          input.description ?? null,
          input.status ?? 'planned',
          input.targetDate ?? null,
        ]
      );
      return this.findById(id);
    },

    async updateById(id: string, input: Partial<Omit<MilestoneRow, 'id' | 'projectId' | 'createdAt'>>) {
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

    deleteById(id: string) {
      return getDb().run('DELETE FROM Milestone WHERE id = ?', [id]);
    },

    deleteByProjectId(projectId: string) {
      return getDb().run('DELETE FROM Milestone WHERE projectId = ?', [projectId]);
    },
  };
}

export const milestoneRepository = createMilestoneRepository();
