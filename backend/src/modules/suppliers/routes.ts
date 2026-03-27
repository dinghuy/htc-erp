import type { Express, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { parse } from 'csv-parse/sync';
import { getDb } from '../../../sqlite-db';

type AsyncRouteFactory = (handler: (req: Request, res: Response) => Promise<unknown>) => any;

type RegisterSupplierRoutesDeps = {
  ah: AsyncRouteFactory;
  requireAuth: any;
  requireRole: (...roles: string[]) => any;
  upload: any;
  serializeSupplierTags: (raw: unknown) => string;
  hydrateSupplier: (row: any) => any;
};

export function registerSupplierRoutes(app: Express, deps: RegisterSupplierRoutesDeps) {
  const {
    ah,
    requireAuth,
    requireRole,
    upload,
    serializeSupplierTags,
    hydrateSupplier,
  } = deps;

  app.get('/api/suppliers', ah(async (_req: Request, res: Response) => {
    res.json((await getDb().all("SELECT * FROM Account WHERE accountType = 'Supplier' ORDER BY companyName")).map(hydrateSupplier));
  }));

  app.post('/api/suppliers', ah(async (req: Request, res: Response) => {
    const db = getDb();
    const id = uuidv4();
    const { code, company, description, tag, productTags, country, status = 'active' } = req.body;
    const normalizedTagString = serializeSupplierTags(productTags ?? tag);
    await db.run(
      `INSERT INTO Account (id, companyName, code, description, tag, country, status, accountType) VALUES (?, ?, ?, ?, ?, ?, ?, 'Supplier')`,
      [id, company, code, description, normalizedTagString, country, status]
    );
    res.status(201).json(hydrateSupplier(await db.get('SELECT * FROM Account WHERE id = ?', id)));
  }));

  app.put('/api/suppliers/:id', ah(async (req: Request, res: Response) => {
    const db = getDb();
    const { code, company, description, tag, productTags, country, status } = req.body;
    const normalizedTagString = serializeSupplierTags(productTags ?? tag);
    await db.run(
      `UPDATE Account SET companyName=?, code=?, description=?, tag=?, country=?, status=? WHERE id=? AND accountType='Supplier'`,
      [company, code, description, normalizedTagString, country, status, req.params.id]
    );
    res.json(hydrateSupplier(await db.get('SELECT * FROM Account WHERE id = ?', req.params.id)));
  }));

  app.delete('/api/suppliers/:id', ah(async (req: Request, res: Response) => {
    await getDb().run('DELETE FROM Account WHERE id = ? AND accountType="Supplier"', req.params.id);
    res.json({ success: true });
  }));

  app.post('/api/suppliers/import', requireAuth, requireRole('admin', 'manager'), upload.single('file'), ah(async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const records = parse(req.file.buffer.toString('utf-8'), { columns: true, skip_empty_lines: true, trim: true });
    const db = getDb();
    let inserted = 0;
    let skipped = 0;
    for (const row of records as any[]) {
      try {
        await db.run(
          `INSERT INTO Account (id, code, companyName, description, tag, country, status, accountType) VALUES (?, ?, ?, ?, ?, ?, ?, 'Supplier')`,
          [
            uuidv4(),
            row.code || row['Mã'] || '',
            row.company || row['Tên NCC'] || '',
            row.description || row['Mô tả'] || '',
            serializeSupplierTags(row.productTags || row.tag || row['Ngành hàng'] || ''),
            row.country || row['Quốc gia'] || '',
            row.status || row['Trạng thái'] || 'active',
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
