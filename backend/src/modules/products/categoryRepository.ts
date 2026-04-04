import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../../../sqlite-db';

export type ProductCategoryRow = {
  id: string;
  name: string;
  parentId?: string | null;
  sortOrder?: number;
  createdAt?: string;
};

export function createProductCategoryRepository() {
  return {
    findAll() {
      return getDb().all<ProductCategoryRow>(
        'SELECT * FROM ProductCategory ORDER BY sortOrder ASC, name ASC'
      );
    },

    findById(id: string) {
      return getDb().get<ProductCategoryRow>('SELECT * FROM ProductCategory WHERE id = ?', [id]);
    },

    async create(input: { name: string; parentId?: string | null; sortOrder?: number }) {
      const id = uuidv4();
      await getDb().run(
        `INSERT INTO ProductCategory (id, name, parentId, sortOrder, createdAt)
         VALUES (?, ?, ?, ?, datetime('now'))`,
        [id, input.name, input.parentId ?? null, input.sortOrder ?? 0]
      );
      return this.findById(id);
    },

    async updateById(id: string, input: { name?: string; parentId?: string | null; sortOrder?: number }) {
      const existing = await this.findById(id);
      if (!existing) return null;
      await getDb().run(
        `UPDATE ProductCategory SET name = ?, parentId = ?, sortOrder = ? WHERE id = ?`,
        [
          input.name ?? existing.name,
          input.parentId !== undefined ? (input.parentId ?? null) : (existing.parentId ?? null),
          input.sortOrder != null ? Number(input.sortOrder) : (existing.sortOrder ?? 0),
          id,
        ]
      );
      return this.findById(id);
    },

    deleteById(id: string) {
      return getDb().run('DELETE FROM ProductCategory WHERE id = ?', [id]);
    },
  };
}

export const productCategoryRepository = createProductCategoryRepository();
