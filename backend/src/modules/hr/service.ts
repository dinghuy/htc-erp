import { v4 as uuidv4 } from 'uuid';
import { hrRepository } from './repository';

const VALID_REQUEST_TYPES = ['Vacation', 'Sick', 'PTO', 'PTO2', 'Remote', 'Overtime', 'Overtime2'] as const;
const VALID_REQUEST_STATUSES = ['pending', 'approved', 'rejected'] as const;

export function createHrService() {
  return {
    // ── Department ──────────────────────────────────────────────────────────
    listDepartments() {
      return hrRepository.findAllDepartments();
    },

    getDepartmentById(id: string) {
      return hrRepository.findDepartmentById(id);
    },

    createDepartment(input: Record<string, unknown>) {
      return hrRepository.createDepartment({
        id: uuidv4(),
        name: String(input.name ?? ''),
        description: input.description != null ? String(input.description) : null,
        parentId: input.parentId != null ? String(input.parentId) : null,
        teamLeadId: input.teamLeadId != null ? String(input.teamLeadId) : null,
        sortOrder: Number(input.sortOrder ?? 0),
      });
    },

    async updateDepartment(id: string, input: Record<string, unknown>) {
      const existing = await hrRepository.findDepartmentById(id);
      if (!existing) return null;
      return hrRepository.updateDepartmentById(id, {
        name: input.name != null ? String(input.name) : existing.name,
        description: input.description != null ? String(input.description) : (existing.description ?? null),
        parentId: input.parentId !== undefined
          ? (input.parentId != null ? String(input.parentId) : null)
          : (existing.parentId ?? null),
        teamLeadId: input.teamLeadId !== undefined
          ? (input.teamLeadId != null ? String(input.teamLeadId) : null)
          : (existing.teamLeadId ?? null),
        sortOrder: input.sortOrder != null ? Number(input.sortOrder) : (existing.sortOrder ?? 0),
      });
    },

    deleteDepartment(id: string) {
      return hrRepository.deleteDepartmentById(id);
    },

    // ── HrRequest ───────────────────────────────────────────────────────────
    listHrRequests(filters?: { staffId?: string; departmentId?: string; status?: string }) {
      return hrRepository.findAllHrRequests(filters);
    },

    getHrRequestById(id: string) {
      return hrRepository.findHrRequestById(id);
    },

    createHrRequest(input: Record<string, unknown>) {
      const requestType = String(input.requestType ?? '');
      if (!VALID_REQUEST_TYPES.includes(requestType as any)) {
        throw Object.assign(new Error(`Invalid requestType: ${requestType}`), { status: 400 });
      }
      return hrRepository.createHrRequest({
        id: uuidv4(),
        staffId: String(input.staffId ?? ''),
        departmentId: input.departmentId != null ? String(input.departmentId) : null,
        requestType,
        description: input.description != null ? String(input.description) : null,
        startDate: String(input.startDate ?? ''),
        endDate: String(input.endDate ?? ''),
        status: 'pending',
        decidedBy: null,
        decidedAt: null,
        note: input.note != null ? String(input.note) : null,
      });
    },

    async updateHrRequest(id: string, input: Record<string, unknown>) {
      const existing = await hrRepository.findHrRequestById(id);
      if (!existing) return null;
      const status = input.status != null ? String(input.status) : undefined;
      if (status && !VALID_REQUEST_STATUSES.includes(status as any)) {
        throw Object.assign(new Error(`Invalid status: ${status}`), { status: 400 });
      }
      return hrRepository.updateHrRequestById(id, {
        staffId: input.staffId != null ? String(input.staffId) : undefined,
        departmentId: input.departmentId !== undefined
          ? (input.departmentId != null ? String(input.departmentId) : null)
          : undefined,
        requestType: input.requestType != null ? String(input.requestType) : undefined,
        description: input.description !== undefined
          ? (input.description != null ? String(input.description) : null)
          : undefined,
        startDate: input.startDate != null ? String(input.startDate) : undefined,
        endDate: input.endDate != null ? String(input.endDate) : undefined,
        status,
        decidedBy: input.decidedBy !== undefined
          ? (input.decidedBy != null ? String(input.decidedBy) : null)
          : undefined,
        decidedAt: input.decidedAt !== undefined
          ? (input.decidedAt != null ? String(input.decidedAt) : null)
          : undefined,
        note: input.note !== undefined
          ? (input.note != null ? String(input.note) : null)
          : undefined,
      });
    },

    deleteHrRequest(id: string) {
      return hrRepository.deleteHrRequestById(id);
    },

    // ── PublicHoliday ───────────────────────────────────────────────────────
    listPublicHolidays(departmentId?: string) {
      return hrRepository.findAllPublicHolidays(departmentId);
    },

    getPublicHolidayById(id: string) {
      return hrRepository.findPublicHolidayById(id);
    },

    createPublicHoliday(input: Record<string, unknown>) {
      return hrRepository.createPublicHoliday({
        id: uuidv4(),
        title: String(input.title ?? ''),
        description: input.description != null ? String(input.description) : null,
        holidayDate: String(input.holidayDate ?? ''),
        departmentId: input.departmentId != null ? String(input.departmentId) : null,
      });
    },

    deletePublicHoliday(id: string) {
      return hrRepository.deletePublicHolidayById(id);
    },
  };
}
