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
import { applyRolePreviewToUser } from './authRolePreview';
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
  baseSystemRole?: SystemRole;
  baseRoleCodes?: SystemRole[];
  previewRoleCodes?: SystemRole[];
  isRolePreviewActive?: boolean;
  token: string;
  mustChangePassword?: boolean;
  accountStatus?: string;
  employeeCode?: string;
  avatar?: string;
  language?: 'vi' | 'en';
}

export { ROLE_LABELS, canEdit, canDelete, canManageUsers, canAccessSettings, normalizeRoleCodes, buildRoleProfile };
export type { SystemRole };

export function saveSession(user: CurrentUser) {
  const previewedUser = applyRolePreviewToUser(user);
  persistSession(previewedUser);
}

export function loadSession(): CurrentUser | null {
  const session = loadPersistedSession<CurrentUser>();
  if (!session) return null;
  return applyRolePreviewToUser(session);
}

export function clearSession() {
  clearPersistedSession();
}

export { authHeaders };

export async function fetchWithAuth(token: string, url: string, options: RequestInit = {}): Promise<Response> {
  return fetchWithSessionAuth(token, url, options);
}
