import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
import type { AuthenticatedUser } from '../contracts/domain';
import { sendApiError } from '../errors';
import { normalizeRoleCodes, resolvePrimaryRole, userHasAnyRole } from './roles';

let ephemeralJwtSecret: string | null = null;

export function getJwtSecret() {
  const configuredSecret = process.env.JWT_SECRET?.trim();
  if (configuredSecret) {
    return configuredSecret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production');
  }

  if (!ephemeralJwtSecret) {
    ephemeralJwtSecret = randomBytes(32).toString('hex');
    console.warn('[auth] JWT_SECRET is missing. Using an ephemeral in-memory secret until the process restarts.');
  }

  return ephemeralJwtSecret;
}

export type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
};

export const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return sendApiError(res, 401, { error: 'Chưa đăng nhập', code: 'UNAUTHORIZED' });
  }

  try {
    const payload = jwt.verify(auth.slice(7), getJwtSecret()) as AuthenticatedUser;
    const baseRoleCodes = normalizeRoleCodes(payload.roleCodes, payload.systemRole);
    const baseSystemRole = resolvePrimaryRole(baseRoleCodes, payload.systemRole);
    const previewHeader = String(req.headers['x-role-preview'] || '').trim();
    const previewRoleCodes = baseRoleCodes.includes('admin') && previewHeader
      ? normalizeRoleCodes(previewHeader).filter((roleCode) => roleCode !== 'admin')
      : [];
    const previewSystemRole = previewRoleCodes.length > 0
      ? resolvePrimaryRole(previewRoleCodes, previewRoleCodes[0])
      : baseSystemRole;

    req.user = {
      ...payload,
      baseSystemRole,
      baseRoleCodes,
      previewRoleCodes: previewRoleCodes.length > 0 ? previewRoleCodes : undefined,
      isRolePreviewActive: previewRoleCodes.length > 0,
      systemRole: previewSystemRole,
      roleCodes: previewRoleCodes.length > 0 ? previewRoleCodes : baseRoleCodes,
    };
    next();
  } catch {
    return sendApiError(res, 401, { error: 'Token không hợp lệ hoặc đã hết hạn', code: 'INVALID_TOKEN' });
  }
};

export const requireRole = (...roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user || !userHasAnyRole(user, roles)) {
      return sendApiError(res, 403, { error: 'Không có quyền thực hiện thao tác này', code: 'FORBIDDEN' });
    }
    next();
  };
};
