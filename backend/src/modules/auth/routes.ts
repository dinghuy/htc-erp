import type { Express, Response } from 'express';
import type { AuthenticatedRequest } from '../../shared/auth/httpAuth';
import { requireAuth } from '../../shared/auth/httpAuth';
import { asyncHandler } from '../../shared/http/asyncHandler';
import {
  changePassword,
  getAuthenticatedUserProfile,
  loginWithCredentials,
  requestPasswordReset,
  resetPasswordWithToken,
  updateLanguagePreference,
} from './service';

type AuthRouteDependencies = {
  mapGenderRecord: <T>(row: T) => T;
};

export function registerAuthRoutes(app: Express, deps: AuthRouteDependencies) {
  app.post('/api/auth/login', asyncHandler(async (req, res: Response) => {
    const { username, password } = req.body ?? {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Thiếu thông tin đăng nhập' });
    }

    const result = await loginWithCredentials(username, password);
    if ('error' in result) {
      return res.status(result.error.status).json({ error: result.error.message });
    }

    return res.json({
      token: result.token,
      user: deps.mapGenderRecord(result.user),
    });
  }));

  app.get('/api/auth/me', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = await getAuthenticatedUserProfile(req);
    if (!user) {
      return res.status(404).json({ error: 'Không tìm thấy user' });
    }

    return res.json(deps.mapGenderRecord(user));
  }));

  app.patch('/api/me/preferences', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { language } = req.body || {};
    const normalized = typeof language === 'string' ? language.trim().toLowerCase() : '';
    if (normalized !== 'vi' && normalized !== 'en') {
      return res.status(400).json({ error: 'Ngôn ngữ không hợp lệ' });
    }

    const updated = await updateLanguagePreference(req, normalized);
    if (!updated) {
      return res.status(404).json({ error: 'Không tìm thấy user' });
    }

    return res.json({ ok: true, user: deps.mapGenderRecord(updated) });
  }));

  app.post('/api/auth/change-password', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await changePassword(req, req.body ?? {});
    if ('error' in result) {
      return res.status(result.error.status).json({ error: result.error.message });
    }

    return res.json({
      ok: true,
      token: result.token,
      user: deps.mapGenderRecord(result.user),
    });
  }));

  app.post('/api/auth/forgot-password', asyncHandler(async (req, res: Response) => {
    const result = await requestPasswordReset({
      identifier: req.body?.identifier,
      requestedByIp: req.ip,
    });
    if ('error' in result) {
      return res.status(result.error.status).json({ error: result.error.message });
    }
    return res.json(result);
  }));

  app.post('/api/auth/reset-password', asyncHandler(async (req, res: Response) => {
    const result = await resetPasswordWithToken(req.body ?? {});
    if ('error' in result) {
      return res.status(result.error.status).json({ error: result.error.message });
    }
    return res.json({
      ok: true,
      token: result.token,
      user: deps.mapGenderRecord(result.user),
    });
  }));
}
