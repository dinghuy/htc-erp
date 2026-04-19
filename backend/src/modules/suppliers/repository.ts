import { getDb } from '../../../sqlite-db';

export type SupplierRow = {
  id: string;
  companyName: string;
  code?: string | null;
  description?: string | null;
  tag?: string | null;
  country?: string | null;
  status?: string | null;
};

export type SupplierWriteInput = {
  id?: string;
  companyName: string;
  code?: string;
  description?: string;
  tag?: string;
  country?: string;
  status?: string;
};

export function createSupplierRepository() {
  return {
    findAll() {
      return getDb().all("SELECT * FROM Account WHERE accountType = 'Supplier' ORDER BY companyName") as Promise<SupplierRow[]>;
    },

    findById(id: string) {
      return getDb().get<SupplierRow>('SELECT * FROM Account WHERE id = ?', [id]);
    },

    async create(input: SupplierWriteInput) {
      await getDb().run(
        `INSERT INTO Account (id, companyName, code, description, tag, country, status, accountType) VALUES (?, ?, ?, ?, ?, ?, ?, 'Supplier')`,
        [input.id, input.companyName, input.code, input.description, input.tag, input.country, input.status],
      );
      return this.findById(input.id);
    },

    async update(id: string, input: Omit<SupplierWriteInput, 'id'>) {
      await getDb().run(
        `UPDATE Account SET companyName=?, code=?, description=?, tag=?, country=?, status=? WHERE id=? AND accountType='Supplier'`,
        [input.companyName, input.code, input.description, input.tag, input.country, input.status, id],
      );
      return this.findById(id);
    },

    deleteById(id: string) {
      return getDb().run('DELETE FROM Account WHERE id = ? AND accountType="Supplier"', [id]);
    },

    insertImportedSupplier(input: SupplierWriteInput) {
      return getDb().run(
        `INSERT INTO Account (code, companyName, description, tag, country, status, accountType) VALUES (?, ?, ?, ?, ?, ?, 'Supplier')`,
        [input.code, input.companyName, input.description, input.tag, input.country, input.status],
      );
    },
  };
}

export const supplierRepository = createSupplierRepository();
