import type { Express, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { parse } from 'csv-parse/sync';
import { getDb } from '../../../sqlite-db';
import { normalizeGender } from '../../../gender';

type AsyncRouteFactory = (handler: (req: Request, res: Response) => Promise<unknown>) => any;

type RegisterCrmRoutesDeps = {
  ah: AsyncRouteFactory;
  requireAuth: any;
  requireRole: (...roles: string[]) => any;
  upload: any;
  mapGenderRecord: <T extends { gender?: unknown } | null | undefined>(row: T) => T;
  mapGenderRecords: <T extends Array<{ gender?: unknown }>>(rows: T) => T;
  logAct: (...args: any[]) => Promise<void>;
};

export function registerCrmRoutes(app: Express, deps: RegisterCrmRoutesDeps) {
  const {
    ah,
    requireAuth,
    requireRole,
    upload,
    mapGenderRecord,
    mapGenderRecords,
    logAct,
  } = deps;

  app.get('/api/accounts', ah(async (req: Request, res: Response) => {
    const { type } = req.query;
    const rows = type
      ? await getDb().all('SELECT * FROM Account WHERE accountType = ? ORDER BY createdAt DESC', type)
      : await getDb().all('SELECT * FROM Account ORDER BY createdAt DESC');
    res.json(rows);
  }));

  app.get('/api/accounts/:id', ah(async (req: Request, res: Response) => {
    const row = await getDb().get('SELECT * FROM Account WHERE id = ?', req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  }));

  app.post('/api/accounts', ah(async (req: Request, res: Response) => {
    const db = getDb();
    const id = uuidv4();
    const { companyName, region, industry, website, taxCode, address, assignedTo, status = 'active', accountType = 'Customer', code, shortName, description, tag, country } = req.body;
    await db.run(
      `INSERT INTO Account (id, companyName, region, industry, website, taxCode, address, assignedTo, status, accountType, code, shortName, description, tag, country)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, companyName, region, industry, website, taxCode, address, assignedTo, status, accountType, code, shortName, description, tag, country]
    );
    await logAct('Tạo khách hàng mới', `Đã thêm ${companyName} vào danh sách ${accountType}`, 'Account', '🏢', '#e0f2fe', '#0284c7', id, 'Account');
    res.status(201).json(await db.get('SELECT * FROM Account WHERE id = ?', id));
  }));

  app.put('/api/accounts/:id', ah(async (req: Request, res: Response) => {
    const db = getDb();
    const { companyName, region, industry, website, taxCode, address, assignedTo, status, accountType, code, shortName, description, tag, country } = req.body;
    await db.run(
      `UPDATE Account SET companyName=?, region=?, industry=?, website=?, taxCode=?, address=?, assignedTo=?, status=?, accountType=?, code=?, shortName=?, description=?, tag=?, country=? WHERE id=?`,
      [companyName, region, industry, website, taxCode, address, assignedTo, status, accountType, code, shortName, description, tag, country, req.params.id]
    );
    res.json(await db.get('SELECT * FROM Account WHERE id = ?', req.params.id));
  }));

  app.delete('/api/accounts/:id', ah(async (req: Request, res: Response) => {
    await getDb().run('DELETE FROM Account WHERE id = ?', req.params.id);
    res.json({ success: true });
  }));

  app.post('/api/accounts/import', requireAuth, requireRole('admin', 'manager'), upload.single('file'), ah(async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const records = parse(req.file.buffer.toString('utf-8'), { columns: true, skip_empty_lines: true, trim: true });
    const db = getDb();
    let inserted = 0;
    let skipped = 0;
    for (const row of records as any[]) {
      try {
        const id = uuidv4();
        const accountType = (row.accountType || row['Phân loại'] || row['Loại'] || 'Customer').trim();
        const status = row.status || row['Trạng thái'] || 'active';
        await db.run(
          `INSERT INTO Account (id, companyName, region, industry, website, taxCode, address, status, accountType, code, shortName, description, tag, country)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            row.companyName || row['Tên công ty'] || row['Công ty'] || '',
            row.region || row['Khu vực'] || '',
            row.industry || row['Lĩnh vực'] || '',
            row.website || row['Website'] || '',
            row.taxCode || row['Mã số thuế'] || row['MST'] || '',
            row.address || row['Địa chỉ'] || '',
            status,
            accountType || 'Customer',
            row.code || row['Mã'] || '',
            row.shortName || row['Tên viết tắt'] || '',
            row.description || row['Mô tả'] || '',
            row.tag || row['Ngành hàng'] || '',
            row.country || row['Quốc gia'] || '',
          ]
        );
        inserted++;
      } catch {
        skipped++;
      }
    }
    res.json({ inserted, skipped, total: (records as any[]).length });
  }));

  app.get('/api/contacts', ah(async (req: Request, res: Response) => {
    const { accountId } = req.query;
    const rows = accountId
      ? await getDb().all('SELECT * FROM Contact WHERE accountId = ?', accountId)
      : await getDb().all('SELECT * FROM Contact');
    res.json(mapGenderRecords(rows));
  }));

  app.post('/api/contacts', ah(async (req: Request, res: Response) => {
    const db = getDb();
    const id = uuidv4();
    const { accountId, lastName, firstName, department, jobTitle, gender, email, phone, isPrimaryContact = false } = req.body;
    const normalizedGender = normalizeGender(gender);
    await db.run(
      `INSERT INTO Contact (id, accountId, lastName, firstName, department, jobTitle, gender, email, phone, isPrimaryContact) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, accountId, lastName, firstName, department, jobTitle, normalizedGender, email, phone, isPrimaryContact ? 1 : 0]
    );
    res.status(201).json(mapGenderRecord(await db.get('SELECT * FROM Contact WHERE id = ?', id)));
  }));

  app.put('/api/contacts/:id', ah(async (req: Request, res: Response) => {
    const db = getDb();
    const { lastName, firstName, department, jobTitle, gender, email, phone, isPrimaryContact } = req.body;
    const normalizedGender = normalizeGender(gender);
    await db.run(
      `UPDATE Contact SET lastName=?, firstName=?, department=?, jobTitle=?, gender=?, email=?, phone=?, isPrimaryContact=? WHERE id=?`,
      [lastName, firstName, department, jobTitle, normalizedGender, email, phone, isPrimaryContact ? 1 : 0, req.params.id]
    );
    res.json(mapGenderRecord(await db.get('SELECT * FROM Contact WHERE id = ?', req.params.id)));
  }));

  app.delete('/api/contacts/:id', ah(async (req: Request, res: Response) => {
    await getDb().run('DELETE FROM Contact WHERE id = ?', req.params.id);
    res.json({ success: true });
  }));

  app.get('/api/leads', ah(async (_req: Request, res: Response) => {
    res.json(await getDb().all('SELECT * FROM Lead ORDER BY createdAt DESC'));
  }));

  app.get('/api/leads/:id', ah(async (req: Request, res: Response) => {
    const row = await getDb().get('SELECT * FROM Lead WHERE id = ?', req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  }));

  app.post('/api/leads', ah(async (req: Request, res: Response) => {
    const db = getDb();
    const id = uuidv4();
    const { companyName, contactName, email, phone, status = 'New', source } = req.body;
    await db.run(
      `INSERT INTO Lead (id, companyName, contactName, email, phone, status, source) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, companyName, contactName, email, phone, status, source]
    );
    await logAct('Tạo Lead mới', `Khách tiềm năng: ${companyName}`, 'Lead', '🎯', '#fce7f3', '#db2777', id, 'Lead');
    res.status(201).json(await db.get('SELECT * FROM Lead WHERE id = ?', id));
  }));

  app.put('/api/leads/:id', ah(async (req: Request, res: Response) => {
    const db = getDb();
    const { companyName, contactName, email, phone, status, source } = req.body;
    await db.run(
      `UPDATE Lead SET companyName=?, contactName=?, email=?, phone=?, status=?, source=? WHERE id=?`,
      [companyName, contactName, email, phone, status, source, req.params.id]
    );
    res.json(await db.get('SELECT * FROM Lead WHERE id = ?', req.params.id));
  }));

  app.delete('/api/leads/:id', ah(async (req: Request, res: Response) => {
    await getDb().run('DELETE FROM Lead WHERE id = ?', req.params.id);
    res.json({ success: true });
  }));

  app.post('/api/leads/import', requireAuth, requireRole('admin', 'manager'), upload.single('file'), ah(async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const records = parse(req.file.buffer.toString('utf-8'), { columns: true, skip_empty_lines: true, trim: true });
    const db = getDb();
    let inserted = 0;
    let skipped = 0;
    for (const row of records as any[]) {
      try {
        await db.run(
          `INSERT INTO Lead (id, companyName, contactName, email, phone, status, source) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(),
            row.companyName || row['Công ty'] || '',
            row.contactName || row['Liên hệ'] || '',
            row.email || '',
            row.phone || '',
            row.status || row['Trạng thái'] || 'New',
            row.source || row['Nguồn'] || 'CSV Import',
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
