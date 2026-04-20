import { normalizeRoleCodes } from './auth';
import type { SystemRole } from './shared/domain/contracts';

export type UserRecord = {
  id: string;
  fullName?: string;
  gender?: string;
  email?: string;
  phone?: string;
  role?: string;
  department?: string;
  employeeCode?: string;
  dateOfBirth?: string;
  username?: string;
  avatar?: string;
  status?: string;
  accountStatus?: string;
  lastLoginAt?: string;
  mustChangePassword?: boolean | number | null;
  systemRole?: SystemRole;
  roleCodes?: unknown;
  address?: string;
  startDate?: string;
  language?: string;
};

export function supportsUserBulkFileActions(canManageUsersView: boolean) {
  return canManageUsersView;
}

export function cloneUpdatedViewingUser(current: UserRecord | null, updated: UserRecord) {
  if (!current || current.id !== updated.id) return current;
  return {
    ...current,
    ...updated,
    roleCodes: normalizeRoleCodes(updated.roleCodes, updated.systemRole),
  };
}
