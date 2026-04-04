import { getDb } from '../../../sqlite-db';

export type DepartmentRow = {
  id: string;
  name: string;
  description?: string | null;
  parentId?: string | null;
  teamLeadId?: string | null;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type HrRequestRow = {
  id: string;
  staffId: string;
  departmentId?: string | null;
  requestType: string;
  description?: string | null;
  startDate: string;
  endDate: string;
  status?: string;
  decidedBy?: string | null;
  decidedAt?: string | null;
  note?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type PublicHolidayRow = {
  id: string;
  title: string;
  description?: string | null;
  holidayDate: string;
  departmentId?: string | null;
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

    findDepartmentById(id: string) {
      return getDb().get<DepartmentRow>('SELECT * FROM Department WHERE id = ?', [id]);
    },

    async createDepartment(input: DepartmentRow) {
      await getDb().run(
        `INSERT INTO Department (id, name, description, parentId, teamLeadId, sortOrder, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [
          input.id,
          input.name,
          input.description ?? null,
          input.parentId ?? null,
          input.teamLeadId ?? null,
          input.sortOrder ?? 0,
        ]
      );
      return this.findDepartmentById(input.id);
    },

    async updateDepartmentById(id: string, input: Omit<DepartmentRow, 'id' | 'createdAt'>) {
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

    deleteDepartmentById(id: string) {
      return getDb().run('DELETE FROM Department WHERE id = ?', [id]);
    },

    // ── HrRequest ───────────────────────────────────────────────────────────
    findAllHrRequests(filters?: { staffId?: string; departmentId?: string; status?: string }) {
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

    findHrRequestById(id: string) {
      return getDb().get<HrRequestRow>('SELECT * FROM HrRequest WHERE id = ?', [id]);
    },

    async createHrRequest(input: HrRequestRow) {
      await getDb().run(
        `INSERT INTO HrRequest (id, staffId, departmentId, requestType, description, startDate, endDate, status, decidedBy, decidedAt, note, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [
          input.id,
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
      return this.findHrRequestById(input.id);
    },

    async updateHrRequestById(id: string, input: Partial<Omit<HrRequestRow, 'id' | 'createdAt'>>) {
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

    deleteHrRequestById(id: string) {
      return getDb().run('DELETE FROM HrRequest WHERE id = ?', [id]);
    },

    // ── PublicHoliday ───────────────────────────────────────────────────────
    findAllPublicHolidays(departmentId?: string) {
      return departmentId
        ? getDb().all<PublicHolidayRow>(
            'SELECT * FROM PublicHoliday WHERE departmentId = ? OR departmentId IS NULL ORDER BY holidayDate ASC',
            [departmentId]
          )
        : getDb().all<PublicHolidayRow>('SELECT * FROM PublicHoliday ORDER BY holidayDate ASC');
    },

    findPublicHolidayById(id: string) {
      return getDb().get<PublicHolidayRow>('SELECT * FROM PublicHoliday WHERE id = ?', [id]);
    },

    async createPublicHoliday(input: PublicHolidayRow) {
      await getDb().run(
        `INSERT INTO PublicHoliday (id, title, description, holidayDate, departmentId, createdAt)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`,
        [
          input.id,
          input.title,
          input.description ?? null,
          input.holidayDate,
          input.departmentId ?? null,
        ]
      );
      return this.findPublicHolidayById(input.id);
    },

    deletePublicHolidayById(id: string) {
      return getDb().run('DELETE FROM PublicHoliday WHERE id = ?', [id]);
    },
  };
}

export const hrRepository = createHrRepository();
