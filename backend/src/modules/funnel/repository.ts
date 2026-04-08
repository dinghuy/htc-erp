import { getDb } from '../../../sqlite-db';

export type FunnelRow = {
  id?: number | string;
  name: string;
  description?: string | null;
  isDefault?: number;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
};

export function createFunnelRepository() {
  return {
    findAll() {
      return getDb().all<FunnelRow>(
        'SELECT * FROM Funnel ORDER BY sortOrder ASC, name ASC'
      );
    },

    findById(id: number | string) {
      return getDb().get<FunnelRow>('SELECT * FROM Funnel WHERE id = ?', [id]);
    },

    async create(input: FunnelRow) {
      const result = await getDb().run(
        `INSERT INTO Funnel (name, description, isDefault, sortOrder, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [
          input.name,
          input.description ?? null,
          input.isDefault ?? 0,
          input.sortOrder ?? 0,
        ]
      );
      return this.findById(result.lastID);
    },

    async updateById(id: number | string, input: Omit<FunnelRow, 'id' | 'createdAt'>) {
      await getDb().run(
        `UPDATE Funnel SET name = ?, description = ?, isDefault = ?, sortOrder = ?, updatedAt = datetime('now')
         WHERE id = ?`,
        [
          input.name,
          input.description ?? null,
          input.isDefault ?? 0,
          input.sortOrder ?? 0,
          id,
        ]
      );
      return this.findById(id);
    },

    deleteById(id: number | string) {
      return getDb().run('DELETE FROM Funnel WHERE id = ?', [id]);
    },
  };
}

export const funnelRepository = createFunnelRepository();
