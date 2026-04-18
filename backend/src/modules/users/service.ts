import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { normalizeGender } from '../../../gender';
import { normalizeRoleCodes, resolvePrimaryRole, roleCodesToJson } from '../../shared/auth/roles';
import { createImportReport, type ParsedImportRow } from '../../shared/imports/tabular';
import { normalizeCreateMustChangePassword } from './createPayload';
import { createUsersRepository, usersRepository } from './repository';

type CreateUsersServiceDeps = {
  repository?: ReturnType<typeof createUsersRepository>;
  createId?: () => string;
  hashPassword?: (value: string) => Promise<string>;
};

type UserWritePayload = {
  fullName?: unknown;
  gender?: unknown;
  email?: unknown;
  phone?: unknown;
  role?: unknown;
  department?: unknown;
  status?: unknown;
  username?: unknown;
  password?: unknown;
  systemRole?: unknown;
  roleCodes?: unknown;
  employeeCode?: unknown;
  dateOfBirth?: unknown;
  address?: unknown;
  startDate?: unknown;
  accountStatus?: unknown;
  mustChangePassword?: unknown;
  language?: unknown;
};

const VIET_MAP: Record<string, string> = {
  'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a',
  'ă': 'a', 'ắ': 'a', 'ặ': 'a', 'ằ': 'a', 'ẳ': 'a', 'ẵ': 'a',
  'ấ': 'a', 'ậ': 'a', 'ầ': 'a', 'ẩ': 'a', 'ẫ': 'a',
  'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e',
  'ề': 'e', 'ế': 'e', 'ệ': 'e', 'ể': 'e', 'ễ': 'e',
  'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i', 'ị': 'i', 'ỉ': 'i', 'ĩ': 'i',
  'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o',
  'ơ': 'o', 'ớ': 'o', 'ợ': 'o', 'ờ': 'o', 'ở': 'o', 'ỡ': 'o',
  'ồ': 'o', 'ố': 'o', 'ộ': 'o', 'ổ': 'o', 'ỗ': 'o',
  'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u',
  'ư': 'u', 'ứ': 'u', 'ự': 'u', 'ừ': 'u', 'ử': 'u', 'ữ': 'u',
  'ỳ': 'y', 'ý': 'y', 'ỵ': 'y', 'ỷ': 'y', 'ỹ': 'y',
  'đ': 'd',
};

/** "Nguyễn Văn An" → "nguyen.an" (họ.tên) */
function toUsernameHoTen(fullName: string): string {
  const slug = fullName
    .toLowerCase()
    .split('')
    .map(c => VIET_MAP[c] ?? c)
    .join('')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .split(/\s+/);
  if (slug.length === 1) return slug[0];
  return `${slug[0]}.${slug[slug.length - 1]}`;
}

function normalizeCreateLanguage(value: unknown): string {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return normalized === 'vi' || normalized === 'en' ? normalized : 'vi';
}

function normalizeOptionalLanguage(value: unknown): string | undefined {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return normalized === 'vi' || normalized === 'en' ? normalized : undefined;
}

export function createUsersService(deps: CreateUsersServiceDeps = {}) {
  const repository = deps.repository ?? usersRepository;
  const createId = deps.createId ?? uuidv4;
  const hashPassword = deps.hashPassword ?? ((value: string) => bcrypt.hash(value, 10));

  async function listUsers() {
    return repository.listUsers();
  }

  async function getUserById(id: string) {
    return repository.findUserById(id);
  }

  async function createUser(payload: UserWritePayload) {
    const id = createId();
    const normalizedRoles = normalizeRoleCodes(payload.roleCodes, payload.systemRole);
    const persistedSystemRole = resolvePrimaryRole(normalizedRoles, payload.systemRole);
    let passwordHash: string | null = null;

    if (payload.password) {
      passwordHash = await hashPassword(String(payload.password));
    }

    await repository.createUser({
      id,
      fullName: payload.fullName,
      gender: normalizeGender(payload.gender),
      email: payload.email,
      phone: payload.phone,
      role: payload.role,
      department: payload.department,
      status: payload.status || 'Active',
      username: payload.username ? String(payload.username) : null,
      passwordHash,
      systemRole: persistedSystemRole,
      roleCodesJson: JSON.stringify(normalizedRoles),
      employeeCode: payload.employeeCode ? String(payload.employeeCode) : null,
      dateOfBirth: payload.dateOfBirth ? String(payload.dateOfBirth) : null,
      avatar: null,
      address: payload.address ? String(payload.address) : null,
      startDate: payload.startDate ? String(payload.startDate) : null,
      accountStatus: payload.accountStatus || 'active',
      mustChangePassword: normalizeCreateMustChangePassword(payload.mustChangePassword),
      language: normalizeCreateLanguage(payload.language),
    });

    return repository.findUserById(id);
  }

  async function updateUser(id: string, payload: UserWritePayload) {
    const existing = await repository.findUserPasswordHashById(id);
    if (!existing) {
      return null;
    }

    let passwordHash = existing.passwordHash ?? null;
    if (payload.password) {
      passwordHash = await hashPassword(String(payload.password));
    }

    const normalizedRoles = normalizeRoleCodes(payload.roleCodes, payload.systemRole);
    const persistedSystemRole = resolvePrimaryRole(normalizedRoles, payload.systemRole);

    await repository.updateUser(id, {
      fullName: payload.fullName,
      gender: normalizeGender(payload.gender),
      email: payload.email,
      phone: payload.phone,
      role: payload.role,
      department: payload.department,
      status: payload.status,
      username: payload.username ? String(payload.username) : null,
      passwordHash,
      systemRole: persistedSystemRole,
      roleCodesJson: JSON.stringify(normalizedRoles),
      employeeCode: payload.employeeCode == null ? null : String(payload.employeeCode),
      dateOfBirth: payload.dateOfBirth == null ? null : String(payload.dateOfBirth),
      address: payload.address == null ? null : String(payload.address),
      startDate: payload.startDate == null ? null : String(payload.startDate),
      accountStatus: payload.accountStatus ?? 'active',
      mustChangePassword: payload.mustChangePassword != null ? (payload.mustChangePassword ? 1 : 0) : undefined,
      language: normalizeOptionalLanguage(payload.language) ?? null,
    });

    return repository.findUserById(id);
  }

  async function deleteUser(id: string) {
    return repository.deleteUser(id);
  }

  async function updateAvatar(id: string, avatar: string) {
    const existing = await repository.findUserIdentityById(id);
    if (!existing) {
      return null;
    }

    await repository.updateUserAvatar(id, avatar);
    return { avatar };
  }

  async function setAccountStatus(id: string, accountStatus: string) {
    const existing = await repository.findUserIdentityById(id);
    if (!existing) {
      return null;
    }

    await repository.updateUserAccountStatus(id, accountStatus);
    return repository.findUserById(id);
  }

  async function importUsers(rows: ParsedImportRow[]) {
    const report = createImportReport(rows.length);

    for (const row of rows) {
      const fullName = row.values.fullName || row.values['Họ tên'] || '';
      if (!fullName.trim()) {
        report.errors += 1;
        report.rows.push({
          rowNumber: row.rowNumber,
          key: null,
          action: 'error',
          messages: ['Thiếu họ tên'],
        });
        continue;
      }

      try {
        const rawUsername = (row.values.username || row.values['Username'] || '').trim();
        const generatedUsername = rawUsername || toUsernameHoTen(fullName.trim());
        const rawPassword = (row.values.password || row.values['Mật khẩu'] || '').trim();
        const passwordHash = rawPassword ? await hashPassword(rawPassword) : null;
        const rawSystemRole = (row.values.systemRole || row.values['systemRole'] || row.values['Phân quyền'] || 'viewer').trim();

        await repository.createImportedUser({
          id: createId(),
          fullName: fullName.trim(),
          gender: normalizeGender(row.values.gender || row.values['Danh xưng']),
          email: row.values.email || '',
          phone: row.values.phone || '',
          role: row.values.role || row.values['Chức vụ'] || '',
          department: row.values.department || row.values['Phòng ban'] || '',
          status: row.values.status || row.values['Trạng thái'] || 'Active',
          username: generatedUsername,
          passwordHash,
          systemRole: rawSystemRole,
          employeeCode: (row.values.employeeCode || row.values['Mã NV'] || '').trim() || null,
          accountStatus: 'active',
          mustChangePassword: 1,
        });

        const usernameNote = rawUsername ? '' : ` (username tự động: ${generatedUsername})`;
        report.created += 1;
        report.rows.push({
          rowNumber: row.rowNumber,
          key: fullName.trim(),
          action: 'created',
          messages: [`Đã tạo user mới${usernameNote}`],
        });
      } catch (error: any) {
        report.errors += 1;
        report.rows.push({
          rowNumber: row.rowNumber,
          key: fullName.trim(),
          action: 'error',
          messages: [error?.message || 'Không thể import user'],
        });
      }
    }

    return report;
  }

  async function normalizeProjectManagers() {
    const rows = await repository.listUsersForProjectManagerNormalization();
    let updated = 0;

    for (const row of rows as Array<{ id: string; systemRole: string; roleCodes: string | null }>) {
      const normalizedJson = roleCodesToJson(row.roleCodes, row.systemRole);
      const normalizedRoles = JSON.parse(normalizedJson) as string[];
      const hasProjectManager = normalizedRoles.includes('project_manager');
      const rawRoleCodes = typeof row.roleCodes === 'string' ? row.roleCodes : '';
      const hasLegacySalesProjectManager =
        rawRoleCodes.includes('"sales"') &&
        rawRoleCodes.includes('"project_manager"');

      if (!hasProjectManager || !hasLegacySalesProjectManager) {
        continue;
      }

      await repository.updateUserRoleAssignments(
        row.id,
        normalizedJson,
        row.systemRole === 'sales' ? 'project_manager' : row.systemRole,
      );
      updated += 1;
    }

    return { updated };
  }

  return {
    listUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser,
    updateAvatar,
    setAccountStatus,
    importUsers,
    normalizeProjectManagers,
  };
}

export const usersService = createUsersService();
