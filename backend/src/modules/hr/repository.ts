import { getDb } from '../../../sqlite-db';

export type DepartmentRow = {
  id?: number | string;
  name: string;
  description?: string | null;
  parentId?: number | string | null;
  teamLeadId?: number | string | null;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type HrRequestRow = {
  id?: number | string;
  staffId: number | string;
  departmentId?: number | string | null;
  requestType: string;
  description?: string | null;
  startDate: string;
  endDate: string;
  status?: string;
  decidedBy?: number | string | null;
  decidedAt?: string | null;
  note?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type PublicHolidayRow = {
  id?: number | string;
  title: string;
  description?: string | null;
  holidayDate: string;
  departmentId?: number | string | null;
  createdAt?: string;
};

export function createHrRepository() {
  return {
    // ── Department ──────────────────────────────────────────────────────────
    findAllDepartments() {
      return getDb().all<DepartmentRow>(
        'SELECT * FROM Department ORDER BY sortOrder ASC, name ASC'
      );
    },

    findDepartmentById(id: number | string) {
      return getDb().get<DepartmentRow>('SELECT * FROM Department WHERE id = ?', [id]);
    },

    async createDepartment(input: DepartmentRow) {
      const result = await getDb().run(
        `INSERT INTO Department (name, description, parentId, teamLeadId, sortOrder, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [
          input.name,
          input.description ?? null,
          input.parentId ?? null,
          input.teamLeadId ?? null,
          input.sortOrder ?? 0,
        ]
      );
      return this.findDepartmentById(result.lastID);
    },

    async updateDepartmentById(id: number | string, input: Omit<DepartmentRow, 'id' | 'createdAt'>) {
      await getDb().run(
        `UPDATE Department SET name = ?, description = ?, parentId = ?, teamLeadId = ?, sortOrder = ?, updatedAt = datetime('now')
         WHERE id = ?`,
        [
          input.name,
          input.description ?? null,
          input.parentId ?? null,
          input.teamLeadId ?? null,
          input.sortOrder ?? 0,
          id,
        ]
      );
      return this.findDepartmentById(id);
    },

    deleteDepartmentById(id: number | string) {
      return getDb().run('DELETE FROM Department WHERE id = ?', [id]);
    },

    // ── HrRequest ───────────────────────────────────────────────────────────
    findAllHrRequests(filters?: { staffId?: number | string; departmentId?: number | string; status?: string }) {
      const conditions: string[] = [];
      const params: unknown[] = [];
      if (filters?.staffId) {
        conditions.push('staffId = ?');
        params.push(filters.staffId);
      }
      if (filters?.departmentId) {
        conditions.push('departmentId = ?');
        params.push(filters.departmentId);
      }
      if (filters?.status) {
        conditions.push('status = ?');
        params.push(filters.status);
      }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      return getDb().all<HrRequestRow>(
        `SELECT * FROM HrRequest ${where} ORDER BY createdAt DESC`,
        params
      );
    },

    findHrRequestById(id: number | string) {
      return getDb().get<HrRequestRow>('SELECT * FROM HrRequest WHERE id = ?', [id]);
    },

    async createHrRequest(input: HrRequestRow) {
      const result = await getDb().run(
        `INSERT INTO HrRequest (staffId, departmentId, requestType, description, startDate, endDate, status, decidedBy, decidedAt, note, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [
          input.staffId,
          input.departmentId ?? null,
          input.requestType,
          input.description ?? null,
          input.startDate,
          input.endDate,
          input.status ?? 'pending',
          input.decidedBy ?? null,
          input.decidedAt ?? null,
          input.note ?? null,
        ]
      );
      return this.findHrRequestById(result.lastID);
    },

    async updateHrRequestById(id: number | string, input: Partial<Omit<HrRequestRow, 'id' | 'createdAt'>>) {
      const existing = await this.findHrRequestById(id);
      if (!existing) return null;
      await getDb().run(
        `UPDATE HrRequest SET staffId = ?, departmentId = ?, requestType = ?, description = ?,
         startDate = ?, endDate = ?, status = ?, decidedBy = ?, decidedAt = ?, note = ?, updatedAt = datetime('now')
         WHERE id = ?`,
        [
          input.staffId ?? existing.staffId,
          input.departmentId !== undefined ? (input.departmentId ?? null) : (existing.departmentId ?? null),
          input.requestType ?? existing.requestType,
          input.description !== undefined ? (input.description ?? null) : (existing.description ?? null),
          input.startDate ?? existing.startDate,
          input.endDate ?? existing.endDate,
          input.status ?? existing.status,
          input.decidedBy !== undefined ? (input.decidedBy ?? null) : (existing.decidedBy ?? null),
          input.decidedAt !== undefined ? (input.decidedAt ?? null) : (existing.decidedAt ?? null),
          input.note !== undefined ? (input.note ?? null) : (existing.note ?? null),
          id,
        ]
      );
      return this.findHrRequestById(id);
    },

    deleteHrRequestById(id: number | string) {
      return getDb().run('DELETE FROM HrRequest WHERE id = ?', [id]);
    },

    // ── Public Holiday ───────────────────────────────────────────────────────
    findAllPublicHolidays(departmentId?: number | string) {
      return departmentId
        ? getDb().all<PublicHolidayRow>(
            'SELECT * FROM PublicHoliday WHERE departmentId = ? OR departmentId IS NULL ORDER BY holidayDate ASC',
            [departmentId]
          )
        : getDb().all<PublicHolidayRow>('SELECT * FROM PublicHoliday ORDER BY holidayDate ASC');
    },

    findPublicHolidayById(id: number | string) {
      return getDb().get<PublicHolidayRow>('SELECT * FROM PublicHoliday WHERE id = ?', [id]);
    },

    async createPublicHoliday(input: PublicHolidayRow) {
      const result = await getDb().run(
        `INSERT INTO PublicHoliday (title, description, holidayDate, departmentId, createdAt)
         VALUES (?, ?, ?, ?, datetime('now'))`,
        [
          input.title,
          input.description ?? null,
          input.holidayDate,
          input.departmentId ?? null,
        ]
      );
      return this.findPublicHolidayById(result.lastID);
    },

    deletePublicHolidayById(id: number | string) {
      return getDb().run('DELETE FROM PublicHoliday WHERE id = ?', [id]);
    },
  };
}

export const hrRepository = createHrRepository();
