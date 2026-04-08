import { getDb } from '../../../sqlite-db';

export type SalespersonRow = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
};

type DirectorySalespersonCreateInput = SalespersonRow;

export function createSalespersonRepository() {
  return {
    findAll() {
      return getDb().all(
        `SELECT id, fullName AS name, email, phone
         FROM User
         WHERE LOWER(COALESCE(systemRole, '')) = 'sales'
           AND username IS NULL
         ORDER BY fullName`
      ) as Promise<SalespersonRow[]>;
    },

    findById(id: string) {
      return getDb().get<SalespersonRow>(
        `SELECT id, fullName AS name, email, phone
         FROM User
         WHERE id = ?
           AND LOWER(COALESCE(systemRole, '')) = 'sales'
           AND username IS NULL`,
        [id]
      );
    },

    async create(input: DirectorySalespersonCreateInput) {
      await getDb().run(
        `INSERT INTO User (
          id, fullName, gender, email, phone, role, department, status,
          username, passwordHash, systemRole, roleCodes, accountStatus, mustChangePassword, language
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.id,
          input.name,
          'unknown',
          input.email ?? null,
          input.phone ?? null,
          'Salesperson',
          'Sales',
          'Active',
          null,
          null,
          'sales',
          '["sales"]',
          'active',
          0,
          'vi',
        ]
      );
      return this.findById(input.id);
    },

    deleteById(id: string) {
      return getDb().run(
        `DELETE FROM User
         WHERE id = ?
           AND LOWER(COALESCE(systemRole, '')) = 'sales'
           AND username IS NULL`,
        [id]
      );
    },
  };
}

export const salespersonRepository = createSalespersonRepository();
