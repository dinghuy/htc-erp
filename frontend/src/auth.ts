import {
  buildRoleProfile,
  canAccessSettings,
  canDelete,
  canEdit,
  canManageUsers,
  normalizeRoleCodes,
  ROLE_LABELS,
  type SystemRole,
} from './shared/domain/contracts';
import {
  authHeaders,
  clearPersistedSession,
  fetchWithSessionAuth,
  loadPersistedSession,
  persistSession,
} from './core/session';

export interface CurrentUser {
  id: string;
  username: string;
  fullName: string;
  email: string;
  gender?: string;
  systemRole: SystemRole;
  roleCodes?: SystemRole[];
  token: string;
  mustChangePassword?: boolean;
  accountStatus?: string;
  employeeCode?: string;
  avatar?: string;
  language?: 'vi' | 'en';
  runtimeSettings?: Record<string, unknown>;
}

export { ROLE_LABELS, canEdit, canDelete, canManageUsers, canAccessSettings, normalizeRoleCodes, buildRoleProfile };
export type { SystemRole };

export function saveSession(user: CurrentUser) {
  persistSession(user);
}

export function loadSession(): CurrentUser | null {
  return loadPersistedSession<CurrentUser>();
}

export function clearSession() {
  clearPersistedSession();
}

export { authHeaders };

export async function fetchWithAuth(token: string, url: string, options: RequestInit = {}): Promise<Response> {
  return fetchWithSessionAuth(token, url, options);
}
