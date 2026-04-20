import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHash, randomUUID } from 'node:crypto';
import { getJwtSecret, type AuthenticatedRequest } from '../../shared/auth/httpAuth';
import { normalizeRoleCodes, resolvePrimaryRole, roleCodesToJson } from '../../shared/auth/roles';
import { authRepository, type UserRecord } from './repository';
import { buildPasswordResetUrl, isPasswordResetMailerConfigured, sendPasswordResetEmail } from './passwordResetMailer';

export type SessionUser = {
  id: number;
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

function hashResetToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function isNonProductionRuntime() {
  return (process.env.NODE_ENV || 'development') !== 'production';
}

export async function requestPasswordReset(payload: { identifier?: string; requestedByIp?: string | null }) {
  const identifier = typeof payload.identifier === 'string' ? payload.identifier.trim() : '';
  if (!identifier) {
    return { error: { status: 400, message: 'Vui lòng nhập username hoặc email' } } as const;
  }

  const user = await authRepository.findUserByIdentifier(identifier);
  if (!user) {
    return { ok: true } as const;
  }

  const rawToken = randomUUID();
  const tokenHash = hashResetToken(rawToken);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  await authRepository.createPasswordResetToken({
    id: randomUUID(),
    userId: String(user.id),
    tokenHash,
    expiresAt,
    requestedByIp: payload.requestedByIp ?? null,
  });

  if (isNonProductionRuntime()) {
    return {
      ok: true,
      debugResetToken: rawToken,
      debugResetUrl: buildPasswordResetUrl(rawToken),
      expiresAt,
    } as const;
  }

  if (!isPasswordResetMailerConfigured()) {
    return { error: { status: 500, message: 'Password reset email delivery is not configured' } } as const;
  }
  if (!user.email) {
    return { error: { status: 400, message: 'Tài khoản chưa có email để gửi link đặt lại mật khẩu' } } as const;
  }

  const resetUrl = buildPasswordResetUrl(rawToken);
  await sendPasswordResetEmail({
    to: user.email,
    fullName: user.fullName,
    resetUrl,
  });

  return { ok: true, expiresAt } as const;
}

export async function resetPasswordWithToken(payload: { token?: string; newPassword?: string }) {
  const token = typeof payload.token === 'string' ? payload.token.trim() : '';
  if (!token) {
    return { error: { status: 400, message: 'Thiếu reset token' } } as const;
  }
  if (!payload.newPassword || payload.newPassword.length < 8) {
    return { error: { status: 400, message: 'Mật khẩu mới phải có ít nhất 8 ký tự' } } as const;
  }

  const tokenHash = hashResetToken(token);
  const record = await authRepository.findLatestPasswordResetTokenByHash(tokenHash);
  if (!record) {
    return { error: { status: 400, message: 'Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn' } } as const;
  }
  if (record.usedAt) {
    return { error: { status: 400, message: 'Link đặt lại mật khẩu đã được sử dụng' } } as const;
  }
  if (new Date(record.expiresAt).getTime() < Date.now()) {
    return { error: { status: 400, message: 'Link đặt lại mật khẩu đã hết hạn' } } as const;
  }

  const user = await authRepository.findUserById(record.userId);
  if (!user) {
    return { error: { status: 404, message: 'Không tìm thấy user' } } as const;
  }

  const passwordHash = await bcrypt.hash(payload.newPassword, 10);
  await authRepository.updatePasswordAndClearMustChange(user.id, passwordHash);
  await authRepository.markPasswordResetTokenUsed(record.id);
  const updated = await authRepository.findSessionUserById(user.id);
  if (!updated) {
    return { error: { status: 404, message: 'Không tìm thấy user' } } as const;
  }

  return {
    ok: true,
    token: issueSessionToken(updated, false),
    user: mapSessionUser(updated, false),
  } as const;
}
