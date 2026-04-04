import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getJwtSecret, type AuthenticatedRequest } from '../../shared/auth/httpAuth';
import { normalizeRoleCodes, resolvePrimaryRole, roleCodesToJson } from '../../shared/auth/roles';
import { authRepository, type UserRecord } from './repository';

export type SessionUser = {
  id: string;
  username: string;
  fullName: string;
  systemRole: string;
  roleCodes: string[];
  email: string;
  gender?: string | null;
  mustChangePassword: boolean;
  accountStatus?: string;
  language: string;
  isSalesProjectManager?: boolean;
};

export function issueSessionToken(user: Pick<UserRecord, 'id' | 'username' | 'fullName' | 'systemRole' | 'roleCodes' | 'email'>, mustChangePassword: boolean) {
  const roleCodes = normalizeRoleCodes(user.roleCodes, user.systemRole);
  const systemRole = resolvePrimaryRole(roleCodes, user.systemRole);
  const isSalesProjectManager = roleCodes.includes('sales') && roleCodes.includes('project_manager');
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      systemRole,
      roleCodes,
      email: user.email,
      mustChangePassword,
      isSalesProjectManager,
    },
    getJwtSecret(),
    { expiresIn: '8h' },
  );
}

export function mapSessionUser(user: UserRecord, mustChangePassword: boolean): SessionUser {
  const roleCodes = normalizeRoleCodes(user.roleCodes, user.systemRole);
  const systemRole = resolvePrimaryRole(roleCodes, user.systemRole);
  const isSalesProjectManager = roleCodes.includes('sales') && roleCodes.includes('project_manager');
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    systemRole,
    roleCodes,
    email: user.email,
    gender: user.gender ?? null,
    mustChangePassword,
    accountStatus: user.accountStatus || 'active',
    language: user.language || 'vi',
    isSalesProjectManager,
  };
}

export async function loginWithCredentials(username: string, password: string) {
  const user = await authRepository.findUserByUsername(username);
  if (!user || !user.passwordHash) {
    return { error: { status: 401, message: 'Tên đăng nhập hoặc mật khẩu không đúng' } } as const;
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return { error: { status: 401, message: 'Tên đăng nhập hoặc mật khẩu không đúng' } } as const;
  }

  const accountStatus = user.accountStatus || 'active';
  if (accountStatus === 'locked' || accountStatus === 'suspended') {
    return { error: { status: 403, message: 'Tài khoản đã bị khóa' } } as const;
  }

  await authRepository.touchLastLoginAt(user.id);
  const mustChangePassword = user.mustChangePassword === 1 || user.mustChangePassword === true;

  return {
    token: issueSessionToken(user, mustChangePassword),
    user: mapSessionUser({ ...user, accountStatus }, mustChangePassword),
  } as const;
}

export async function getAuthenticatedUserProfile(request: AuthenticatedRequest) {
  const authUser = request.user;
  if (!authUser) {
    return null;
  }

  return authRepository.findAuthenticatedUserProfileById(authUser.id);
}

export async function updateLanguagePreference(request: AuthenticatedRequest, language: string) {
  const authUser = request.user;
  if (!authUser) {
    return null;
  }

  await authRepository.updateLanguagePreference(authUser.id, language);
  const updated = await authRepository.findSessionUserById(authUser.id);

  if (!updated) {
    return null;
  }

  const mustChangePassword = updated.mustChangePassword === 1 || updated.mustChangePassword === true;
  return mapSessionUser(updated, mustChangePassword);
}

export async function changePassword(request: AuthenticatedRequest, payload: { currentPassword?: string; newPassword?: string; forceChange?: boolean }) {
  const authUser = request.user;
  if (!authUser) {
    return { error: { status: 401, message: 'Chưa đăng nhập' } } as const;
  }

  const user = await authRepository.findUserById(authUser.id);
  if (!user || !user.passwordHash) {
    return { error: { status: 400, message: 'Tài khoản không có mật khẩu' } } as const;
  }

  const mustChangePassword = user.mustChangePassword === 1 || user.mustChangePassword === true || authUser.mustChangePassword === true;
  const isForcedChange = payload.forceChange === true && mustChangePassword;

  if (!isForcedChange) {
    if (typeof payload.currentPassword !== 'string' || !payload.currentPassword) {
      return { error: { status: 400, message: 'Vui lòng nhập mật khẩu hiện tại' } } as const;
    }

    const match = await bcrypt.compare(payload.currentPassword, user.passwordHash);
    if (!match) {
      return { error: { status: 401, message: 'Mật khẩu hiện tại không đúng' } } as const;
    }
  }

  if (!payload.newPassword || payload.newPassword.length < 6) {
    return { error: { status: 400, message: 'Mật khẩu mới phải có ít nhất 6 ký tự' } } as const;
  }

  const passwordHash = await bcrypt.hash(payload.newPassword, 10);
  await authRepository.updatePasswordAndClearMustChange(authUser.id, passwordHash);
  const updated = await authRepository.findSessionUserById(authUser.id);

  if (!updated) {
    return { error: { status: 404, message: 'Không tìm thấy user' } } as const;
  }

  return {
    token: issueSessionToken(user, false),
    user: mapSessionUser(updated, false),
  } as const;
}
