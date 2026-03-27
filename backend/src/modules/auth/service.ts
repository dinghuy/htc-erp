import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from '../../../sqlite-db';
import { JWT_SECRET, type AuthenticatedRequest } from '../../shared/auth/httpAuth';
import { normalizeRoleCodes, resolvePrimaryRole, roleCodesToJson } from '../../shared/auth/roles';

type UserRecord = {
  id: string;
  username: string;
  fullName: string;
  systemRole: string;
  roleCodes?: string | null;
  email: string;
  gender?: string | null;
  role?: string | null;
  department?: string | null;
  accountStatus?: string | null;
  mustChangePassword?: number | boolean | null;
  passwordHash?: string | null;
  language?: string | null;
};

export type SessionUser = {
  id: string;
  username: string;
  fullName: string;
  systemRole: string;
  roleCodes: string[];
  isSalesProjectManager: boolean;
  email: string;
  gender?: string | null;
  mustChangePassword: boolean;
  accountStatus?: string;
  language: string;
};

export function issueSessionToken(user: Pick<UserRecord, 'id' | 'username' | 'fullName' | 'systemRole' | 'roleCodes' | 'email'>, mustChangePassword: boolean) {
  const roleCodes = normalizeRoleCodes(user.roleCodes, user.systemRole);
  const systemRole = resolvePrimaryRole(roleCodes, user.systemRole);
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      systemRole,
      roleCodes,
      email: user.email,
      mustChangePassword,
    },
    JWT_SECRET,
    { expiresIn: '8h' },
  );
}

export function mapSessionUser(user: UserRecord, mustChangePassword: boolean): SessionUser {
  const roleCodes = normalizeRoleCodes(user.roleCodes, user.systemRole);
  const systemRole = resolvePrimaryRole(roleCodes, user.systemRole);
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    systemRole,
    roleCodes,
    isSalesProjectManager: roleCodes.includes('sales') && roleCodes.includes('project_manager'),
    email: user.email,
    gender: user.gender ?? null,
    mustChangePassword,
    accountStatus: user.accountStatus || 'active',
    language: user.language || 'vi',
  };
}

export async function loginWithCredentials(username: string, password: string) {
  const db = getDb();
  const user = await db.get<UserRecord>("SELECT * FROM User WHERE username = ?", [username]);
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

  await db.run("UPDATE User SET lastLoginAt = datetime('now') WHERE id = ?", [user.id]);
  const mustChangePassword = user.mustChangePassword === 1 || user.mustChangePassword === true;

  return {
    token: issueSessionToken(user, mustChangePassword),
    user: mapSessionUser({ ...user, accountStatus }, mustChangePassword),
  } as const;
}

export async function getAuthenticatedUserProfile(request: AuthenticatedRequest) {
  const db = getDb();
  const authUser = request.user;
  if (!authUser) {
    return null;
  }

  return db.get<UserRecord>(
    "SELECT id, username, fullName, systemRole, roleCodes, email, gender, role, department, language FROM User WHERE id = ?",
    [authUser.id],
  );
}

export async function updateLanguagePreference(request: AuthenticatedRequest, language: string) {
  const db = getDb();
  const authUser = request.user;
  if (!authUser) {
    return null;
  }

  await db.run('UPDATE User SET language = ? WHERE id = ?', [language, authUser.id]);
  const updated = await db.get<UserRecord>(
    'SELECT id, username, fullName, systemRole, roleCodes, email, gender, role, department, accountStatus, mustChangePassword, language FROM User WHERE id = ?',
    [authUser.id],
  );

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

  const db = getDb();
  const user = await db.get<UserRecord>("SELECT * FROM User WHERE id = ?", [authUser.id]);
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
  await db.run("UPDATE User SET passwordHash = ?, mustChangePassword = 0 WHERE id = ?", [passwordHash, authUser.id]);

  const updated = await db.get<UserRecord>(
    'SELECT id, username, fullName, systemRole, roleCodes, email, gender, role, department, accountStatus, mustChangePassword, language FROM User WHERE id = ?',
    [authUser.id],
  );

  if (!updated) {
    return { error: { status: 404, message: 'Không tìm thấy user' } } as const;
  }

  return {
    token: issueSessionToken(user, false),
    user: mapSessionUser(updated, false),
  } as const;
}
