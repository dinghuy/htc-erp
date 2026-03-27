import type { Express, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { parse } from 'csv-parse/sync';
import { getDb } from '../../../sqlite-db';
import { normalizeGender } from '../../../gender';
import { roleCodesToJson } from '../../shared/auth/roles';

type AsyncRouteFactory = (handler: (req: Request, res: Response) => Promise<unknown>) => any;

type RegisterUserRoutesDeps = {
  ah: AsyncRouteFactory;
  requireAuth: any;
  requireRole: (...roles: string[]) => any;
  upload: any;
  avatarUploadDir: string;
  mapGenderRecord: <T extends { gender?: unknown } | null | undefined>(row: T) => T;
  mapGenderRecords: <T extends Array<{ gender?: unknown }>>(rows: T) => T;
};

export function registerUserRoutes(app: Express, deps: RegisterUserRoutesDeps) {
  const {
    ah,
    requireAuth,
    requireRole,
    upload,
    avatarUploadDir,
    mapGenderRecord,
    mapGenderRecords,
  } = deps;

  app.get('/api/users', requireAuth, ah(async (_req: Request, res: Response) => {
    const rows = await getDb().all(
      'SELECT id, fullName, gender, email, phone, role, department, status, username, systemRole, roleCodes, employeeCode, dateOfBirth, avatar, address, startDate, lastLoginAt, accountStatus, mustChangePassword, language FROM User ORDER BY fullName'
    );
    res.json(mapGenderRecords(rows));
  }));

  app.get('/api/users/:id', requireAuth, ah(async (req: Request, res: Response) => {
    const row = await getDb().get(
      'SELECT id, fullName, gender, email, phone, role, department, status, username, systemRole, roleCodes, employeeCode, dateOfBirth, avatar, address, startDate, lastLoginAt, accountStatus, mustChangePassword, language FROM User WHERE id = ?',
      req.params.id
    );
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(mapGenderRecord(row));
  }));

  app.post('/api/users', requireAuth, requireRole('admin', 'manager'), ah(async (req: Request, res: Response) => {
    const db = getDb();
    const id = uuidv4();
    const {
      fullName, gender, email, phone, role, department, status, username, password, systemRole,
      roleCodes, employeeCode, dateOfBirth, address, startDate, accountStatus, language,
    } = req.body;
    const normalizedGender = normalizeGender(gender);
    const normalizedLanguage = typeof language === 'string' && ['vi', 'en'].includes(language.trim().toLowerCase())
      ? language.trim().toLowerCase()
      : 'vi';
    let passwordHash: string | null = null;
    if (password) {
      passwordHash = await bcrypt.hash(password, 10);
    }
    await db.run(
      `INSERT INTO User (id, fullName, gender, email, phone, role, department, status, username, passwordHash, systemRole, employeeCode, dateOfBirth, avatar, address, startDate, accountStatus, mustChangePassword, language)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, fullName, normalizedGender, email, phone, role, department, status || 'Active',
        username || null, passwordHash, systemRole || 'viewer', roleCodesToJson(roleCodes, systemRole),
        employeeCode || null, dateOfBirth || null, null, address || null, startDate || null,
        accountStatus || 'active', 1, normalizedLanguage,
      ]
    );
    res.status(201).json(mapGenderRecord(await db.get(
      'SELECT id, fullName, gender, email, phone, role, department, status, username, systemRole, roleCodes, employeeCode, dateOfBirth, avatar, address, startDate, lastLoginAt, accountStatus, mustChangePassword, language FROM User WHERE id = ?',
      id
    )));
  }));

  app.put('/api/users/:id', requireAuth, requireRole('admin', 'manager'), ah(async (req: Request, res: Response) => {
    const db = getDb();
    const {
      fullName, gender, email, phone, role, department, status, username, password, systemRole,
      roleCodes, employeeCode, dateOfBirth, address, startDate, accountStatus, mustChangePassword, language,
    } = req.body;
    const normalizedGender = normalizeGender(gender);
    const normalizedLanguage = typeof language === 'string' && ['vi', 'en'].includes(language.trim().toLowerCase())
      ? language.trim().toLowerCase()
      : undefined;
    const existing = await db.get('SELECT passwordHash FROM User WHERE id = ?', req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    let passwordHash = existing?.passwordHash ?? null;
    if (password) {
      passwordHash = await bcrypt.hash(password, 10);
    }
    await db.run(
      `UPDATE User SET fullName=?, gender=?, email=?, phone=?, role=?, department=?, status=?, username=?, passwordHash=?, systemRole=?, roleCodes=?,
        employeeCode=?, dateOfBirth=?, address=?, startDate=?, accountStatus=?, mustChangePassword=?, language=COALESCE(?, language) WHERE id=?`,
      [
        fullName, normalizedGender, email, phone, role, department, status, username || null, passwordHash, systemRole || 'viewer', roleCodesToJson(roleCodes, systemRole),
        employeeCode ?? null, dateOfBirth ?? null, address ?? null, startDate ?? null,
        accountStatus ?? 'active', mustChangePassword != null ? (mustChangePassword ? 1 : 0) : undefined,
        normalizedLanguage ?? null,
        req.params.id,
      ]
    );
    res.json(mapGenderRecord(await db.get(
      'SELECT id, fullName, gender, email, phone, role, department, status, username, systemRole, roleCodes, employeeCode, dateOfBirth, avatar, address, startDate, lastLoginAt, accountStatus, mustChangePassword, language FROM User WHERE id = ?',
      req.params.id
    )));
  }));

  app.delete('/api/users/:id', requireAuth, requireRole('admin'), ah(async (req: Request, res: Response) => {
    const u = (req as any).user;
    if (u.id === req.params.id) return res.status(400).json({ error: 'Không thể xóa tài khoản đang đăng nhập' });
    await getDb().run('DELETE FROM User WHERE id = ?', req.params.id);
    res.json({ success: true });
  }));

  app.post('/api/users/:id/avatar', requireAuth, upload.single('avatar'), ah(async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const db = getDb();
    const existing = await db.get('SELECT id FROM User WHERE id = ?', req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    fs.mkdirSync(avatarUploadDir, { recursive: true });
    const ext = path.extname(req.file.originalname) || '.jpg';
    const filename = `${req.params.id}${ext}`;
    const filePath = path.join(avatarUploadDir, filename);
    fs.writeFileSync(filePath, req.file.buffer);
    const avatarUrl = `/uploads/avatars/${filename}`;
    await db.run('UPDATE User SET avatar = ? WHERE id = ?', [avatarUrl, req.params.id]);
    res.json({ avatar: avatarUrl });
  }));

  app.post('/api/users/:id/lock', requireAuth, requireRole('admin'), ah(async (req: Request, res: Response) => {
    const db = getDb();
    const existing = await db.get('SELECT id FROM User WHERE id = ?', req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await db.run("UPDATE User SET accountStatus = 'locked' WHERE id = ?", [req.params.id]);
    res.json(mapGenderRecord(await db.get(
      'SELECT id, fullName, gender, email, phone, role, department, status, username, systemRole, roleCodes, employeeCode, dateOfBirth, avatar, address, startDate, lastLoginAt, accountStatus, mustChangePassword, language FROM User WHERE id = ?',
      req.params.id
    )));
  }));

  app.post('/api/users/:id/unlock', requireAuth, requireRole('admin'), ah(async (req: Request, res: Response) => {
    const db = getDb();
    const existing = await db.get('SELECT id FROM User WHERE id = ?', req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await db.run("UPDATE User SET accountStatus = 'active' WHERE id = ?", [req.params.id]);
    res.json(mapGenderRecord(await db.get(
      'SELECT id, fullName, gender, email, phone, role, department, status, username, systemRole, roleCodes, employeeCode, dateOfBirth, avatar, address, startDate, lastLoginAt, accountStatus, mustChangePassword, language FROM User WHERE id = ?',
      req.params.id
    )));
  }));

  app.post('/api/users/import', requireAuth, requireRole('admin'), upload.single('file'), ah(async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const records = parse(req.file.buffer.toString('utf-8'), { columns: true, skip_empty_lines: true, trim: true });
    const db = getDb();
    let inserted = 0;
    let skipped = 0;
    for (const row of records as any[]) {
      try {
        await db.run(
          `INSERT INTO User (id, fullName, gender, email, phone, role, department, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(),
            row.fullName || row['Họ tên'] || '',
            normalizeGender(row.gender || row['Danh xưng']),
            row.email || '',
            row.phone || '',
            row.role || row['Chức vụ'] || '',
            row.department || row['Phòng ban'] || '',
            row.status || row['Trạng thái'] || 'Active',
          ]
        );
        inserted++;
      } catch {
        skipped++;
      }
    }
    res.json({ inserted, skipped, total: records.length });
  }));
}
