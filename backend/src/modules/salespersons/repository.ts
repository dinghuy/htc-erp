import { getDb } from '../../../sqlite-db';

export type SalespersonRow = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
};

export function createSalespersonRepository() {
  return {
    findAll() {
      return getDb().all('SELECT * FROM SalesPerson ORDER BY name') as Promise<SalespersonRow[]>;
    },

    findById(id: string) {
      return getDb().get<SalespersonRow>('SELECT * FROM SalesPerson WHERE id = ?', [id]);
    },

    async create(input: SalespersonRow) {
      await getDb().run('INSERT INTO SalesPerson (id, name, email, phone) VALUES (?, ?, ?, ?)', [
        input.id,
        input.name,
        input.email,
        input.phone,
      ]);
      return this.findById(input.id);
    },

    deleteById(id: string) {
      return getDb().run('DELETE FROM SalesPerson WHERE id = ?', [id]);
    },
  };
}

export const salespersonRepository = createSalespersonRepository();
