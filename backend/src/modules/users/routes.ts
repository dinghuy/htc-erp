import type { Express, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { parseTabularRowsFromFile } from '../../shared/imports/tabular';
import { optimizeUploadedImage } from '../../shared/uploads/imageOptimizer';
import { sendApiError } from '../../shared/errors/apiError';
import { parseCreateUserBody, parseUpdateUserBody } from './schemas';
import { usersService } from './service';

type AsyncRouteFactory = (handler: (req: Request, res: Response) => Promise<unknown>) => any;

type RegisterUserRoutesDeps = {
  ah: AsyncRouteFactory;
  requireAuth: any;
  requireRole: (...roles: string[]) => any;
  upload: any;
  avatarUpload: any;
  avatarUploadDir: string;
  mapGenderRecord: <T extends { gender?: unknown } | null | undefined>(row: T) => T;
  mapGenderRecords: <T extends Array<{ gender?: unknown }>>(rows: T) => T;
};

function routeParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

export function registerUserRoutes(app: Express, deps: RegisterUserRoutesDeps) {
  const {
    ah,
    requireAuth,
    requireRole,
    upload,
    avatarUpload,
    avatarUploadDir,
    mapGenderRecord,
    mapGenderRecords,
  } = deps;

  app.get('/api/users', requireAuth, requireRole('admin'), ah(async (_req: Request, res: Response) => {
    const rows = await usersService.listUsers();
    res.json(mapGenderRecords(rows));
  }));

  app.get('/api/users/directory', requireAuth, ah(async (_req: Request, res: Response) => {
    const rows = await usersService.listUserDirectory();
    res.json(rows);
  }));

  app.get('/api/users/:id', requireAuth, ah(async (req: Request, res: Response) => {
    const userId = routeParam(req.params.id);
    const currentUser = (req as any).user;
    const isSelf = String(currentUser?.id || '') === userId;
    const isAdmin = Array.isArray(currentUser?.roleCodes)
      ? currentUser.roleCodes.includes('admin')
      : false;
    if (!isSelf && !isAdmin) {
      return res.status(403).json({ error: 'Không có quyền thực hiện thao tác này' });
    }
    const row = await usersService.getUserById(userId);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(mapGenderRecord(row));
  }));

  app.get('/api/users/:id/directory', requireAuth, ah(async (req: Request, res: Response) => {
    const userId = routeParam(req.params.id);
    const row = await usersService.getUserDirectoryById(userId);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  }));

  app.get('/api/users/directory/by-ids', requireAuth, ah(async (req: Request, res: Response) => {
    const rawIds = String(req.query.ids || '').trim();
    const ids = rawIds.split(',').map((value) => value.trim()).filter(Boolean);
    const rows = await usersService.listUserDirectoryByIds(Array.from(new Set(ids)));
    res.json(rows);
  }));

  app.post('/api/users', requireAuth, requireRole('admin'), ah(async (req: Request, res: Response) => {
    const parsed = parseCreateUserBody(req.body);
    if (parsed.ok === false) return sendApiError(res, parsed.httpStatus, parsed.payload);
    const row = await usersService.createUser(parsed.normalizedBody);
    res.status(201).json(mapGenderRecord(row));
  }));

  app.put('/api/users/:id', requireAuth, requireRole('admin'), ah(async (req: Request, res: Response) => {
    const userId = routeParam(req.params.id);
    const parsed = parseUpdateUserBody(req.body);
    if (parsed.ok === false) return sendApiError(res, parsed.httpStatus, parsed.payload);
    const row = await usersService.updateUser(userId, parsed.normalizedBody);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(mapGenderRecord(row));
  }));

  app.delete('/api/users/:id', requireAuth, requireRole('admin'), ah(async (req: Request, res: Response) => {
    const u = (req as any).user;
    const userId = routeParam(req.params.id);
    if (u.id === userId) return res.status(400).json({ error: 'Không thể xóa tài khoản đang đăng nhập' });
    await usersService.deleteUser(userId);
    res.json({ success: true });
  }));

  app.post('/api/users/:id/avatar', requireAuth, avatarUpload.single('avatar'), ah(async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const userId = routeParam(req.params.id);
    const currentUser = (req as any).user;
    const isSelf = String(currentUser?.id || '') === userId;
    const isAdmin = Array.isArray(currentUser?.roleCodes)
      ? currentUser.roleCodes.includes('admin')
      : false;
    if (!isSelf && !isAdmin) {
      return res.status(403).json({ error: 'Không có quyền thực hiện thao tác này' });
    }
    const existing = await usersService.getUserById(userId);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (!String(req.file.mimetype || '').startsWith('image/')) {
      return res.status(400).json({ error: 'Avatar must be an image file' });
    }
    const optimized = await optimizeUploadedImage(req.file, 'avatar');
    fs.mkdirSync(avatarUploadDir, { recursive: true });
    for (const candidate of fs.readdirSync(avatarUploadDir)) {
      if (candidate === `${userId}${optimized.extension}`) continue;
      if (candidate.startsWith(`${userId}.`)) {
        fs.rmSync(path.join(avatarUploadDir, candidate), { force: true });
      }
    }
    const ext = optimized.extension || '.jpg';
    const filename = `${userId}${ext}`;
    const filePath = path.join(avatarUploadDir, filename);
    fs.writeFileSync(filePath, optimized.buffer);
    const avatarUrl = `/uploads/avatars/${filename}`;
    await usersService.updateAvatar(userId, avatarUrl);
    res.json({
      avatar: avatarUrl,
      fileName: optimized.downloadFileName,
      mimeType: optimized.mimeType,
      size: optimized.size,
    });
  }));

  app.post('/api/users/:id/lock', requireAuth, requireRole('admin'), ah(async (req: Request, res: Response) => {
    const userId = routeParam(req.params.id);
    const row = await usersService.setAccountStatus(userId, 'locked');
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(mapGenderRecord(row));
  }));

  app.post('/api/users/:id/unlock', requireAuth, requireRole('admin'), ah(async (req: Request, res: Response) => {
    const userId = routeParam(req.params.id);
    const row = await usersService.setAccountStatus(userId, 'active');
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(mapGenderRecord(row));
  }));

  app.post('/api/users/import', requireAuth, requireRole('admin'), upload.single('file'), ah(async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const rows = parseTabularRowsFromFile(req.file);
    res.json(await usersService.importUsers(rows));
  }));

  app.post('/api/users/normalize-project-managers', requireAuth, requireRole('admin'), ah(async (_req: Request, res: Response) => {
    res.json(await usersService.normalizeProjectManagers());
  }));
}
