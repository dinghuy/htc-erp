import { getDb } from '../../../sqlite-db';

export type SalespersonRow = {
  id?: number | string;
  name: string;
  email?: string | null;
  phone?: string | null;
};

export function createSalespersonRepository() {
  return {
    findAll() {
      return getDb().all('SELECT * FROM SalesPerson ORDER BY name') as Promise<SalespersonRow[]>;
    },

    findById(id: number | string) {
      return getDb().get<SalespersonRow>('SELECT * FROM SalesPerson WHERE id = ?', [id]);
    },

    async create(input: SalespersonRow) {
      const result = await getDb().run('INSERT INTO SalesPerson (name, email, phone) VALUES (?, ?, ?)', [
        input.name,
        input.email,
        input.phone,
      ]);
      return this.findById(result.lastID);
    },

    deleteById(id: number | string) {
      return getDb().run('DELETE FROM SalesPerson WHERE id = ?', [id]);
    },
  };
}

export const salespersonRepository = createSalespersonRepository();
