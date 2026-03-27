import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { AuthenticatedUser } from '../contracts/domain';
import { normalizeRoleCodes, resolvePrimaryRole, userHasAnyRole } from './roles';

export const JWT_SECRET = process.env.JWT_SECRET || 'htg-crm-secret-2026';

export type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
};

export const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Chưa đăng nhập' });
  }

  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as AuthenticatedUser;
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
    res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
  }
};

export const requireRole = (...roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user || !userHasAnyRole(user, roles)) {
      return res.status(403).json({ error: 'Không có quyền thực hiện thao tác này' });
    }
    next();
  };
};
