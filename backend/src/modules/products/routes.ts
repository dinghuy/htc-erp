import type { Express, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { parse } from 'csv-parse/sync';
import { getDb } from '../../../sqlite-db';

type AsyncRouteFactory = (handler: (req: Request, res: Response) => Promise<unknown>) => any;

type RegisterProductRoutesDeps = {
  ah: AsyncRouteFactory;
  requireAuth: any;
  requireRole: (...roles: string[]) => any;
  upload: any;
  serializeProductRow: (row: any) => any;
  parseJsonObject: <T extends Record<string, any> | null>(raw: unknown, fallback: T) => T;
  stringifyNormalizedJson: (value: unknown) => string;
  getLatestExchangeRatePayload: (baseCurrency: string, quoteCurrency: string) => Promise<any>;
};

export function registerProductRoutes(app: Express, deps: RegisterProductRoutesDeps) {
  const {
    ah,
    requireAuth,
    requireRole,
    upload,
    serializeProductRow,
    parseJsonObject,
    stringifyNormalizedJson,
    getLatestExchangeRatePayload,
  } = deps;

  app.get('/api/products', ah(async (req: Request, res: Response) => {
    const db = getDb();
    const { category } = req.query;
    const rows = category
      ? await db.all('SELECT * FROM Product WHERE category = ? ORDER BY name', category)
      : await db.all('SELECT * FROM Product ORDER BY name');

    res.json(rows.map(serializeProductRow));
  }));

  app.get('/api/products/:id', ah(async (req: Request, res: Response) => {
    const row = await getDb().get('SELECT * FROM Product WHERE id = ?', req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(serializeProductRow(row));
  }));

  app.post('/api/products', ah(async (req: Request, res: Response) => {
    const db = getDb();
    const id = uuidv4();
    const { sku, name, category, unit = 'Chiếc', basePrice, currency = 'USD', specifications, technicalSpecs, media, qbuData, status = 'available' } = req.body;
    await db.run(
      `INSERT INTO Product (id, sku, name, category, unit, basePrice, currency, specifications, technicalSpecs, media, qbuData, qbuUpdatedAt, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, sku, name, category, unit, basePrice, currency, JSON.stringify(specifications || {}), technicalSpecs || '', JSON.stringify(media || []), JSON.stringify(qbuData || {}), qbuData ? new Date().toISOString() : null, status]
    );
    res.status(201).json(serializeProductRow(await db.get('SELECT * FROM Product WHERE id = ?', id)));
  }));

  app.put('/api/products/:id', ah(async (req: Request, res: Response) => {
    const db = getDb();
    const { sku, name, category, unit, basePrice, currency, specifications, technicalSpecs, media, qbuData, status } = req.body;
    const currentProduct = await db.get(
      'SELECT qbuData, qbuUpdatedAt, qbuRateSource, qbuRateDate, qbuRateValue FROM Product WHERE id = ?',
      req.params.id
    );
    if (!currentProduct) return res.status(404).json({ error: 'Not found' });
    const hasQbuData = Object.prototype.hasOwnProperty.call(req.body, 'qbuData');
    if (hasQbuData && (qbuData === null || typeof qbuData !== 'object' || Array.isArray(qbuData))) {
      return res.status(400).json({ error: 'Invalid qbuData. Expected an object.' });
    }
    const currentQbuData = parseJsonObject(currentProduct?.qbuData, null);
    const nextQbuData = hasQbuData && qbuData && typeof qbuData === 'object' && !Array.isArray(qbuData)
      ? qbuData
      : currentQbuData;
    const qbuDataChanged = hasQbuData && stringifyNormalizedJson(nextQbuData) !== stringifyNormalizedJson(currentQbuData);

    let nextQbuDataStr = currentProduct?.qbuData ?? null;
    let nextQbuUpdatedAt = currentProduct?.qbuUpdatedAt ?? null;
    let nextQbuRateSource = currentProduct?.qbuRateSource ?? null;
    let nextQbuRateDate = currentProduct?.qbuRateDate ?? null;
    let nextQbuRateValue = currentProduct?.qbuRateValue ?? null;

    if (qbuDataChanged) {
      const latestRate = await getLatestExchangeRatePayload('USD', 'VND');
      const latestHasSnapshot = latestRate.warnings?.includes('RATE_MISSING') !== true
        && latestRate.rate !== null
        && latestRate.effectiveDate !== null;

      nextQbuUpdatedAt = new Date().toISOString();
      if (latestHasSnapshot) {
        nextQbuRateSource = latestRate.source;
        nextQbuRateDate = latestRate.effectiveDate;
        nextQbuRateValue = latestRate.rate;
        nextQbuDataStr = JSON.stringify({
          ...nextQbuData,
          rateSnapshot: {
            source: latestRate.source,
            date: latestRate.effectiveDate,
            rate: latestRate.rate,
          },
        });
      } else {
        nextQbuRateSource = null;
        nextQbuRateDate = null;
        nextQbuRateValue = null;
        nextQbuDataStr = JSON.stringify({
          ...nextQbuData,
          rateSnapshot: null,
        });
      }
    }

    await db.run(
      `UPDATE Product SET sku=?, name=?, category=?, unit=?, basePrice=?, currency=?, specifications=?, technicalSpecs=?, media=?, qbuData=?, qbuUpdatedAt=?, qbuRateSource=?, qbuRateDate=?, qbuRateValue=?, status=? WHERE id=?`,
      [
        sku,
        name,
        category,
        unit,
        basePrice,
        currency,
        JSON.stringify(specifications || {}),
        technicalSpecs,
        JSON.stringify(media || []),
        nextQbuDataStr,
        nextQbuUpdatedAt,
        nextQbuRateSource,
        nextQbuRateDate,
        nextQbuRateValue,
        status,
        req.params.id,
      ]
    );
    res.json(serializeProductRow(await db.get('SELECT * FROM Product WHERE id = ?', req.params.id)));
  }));

  app.delete('/api/products/:id', ah(async (req: Request, res: Response) => {
    await getDb().run('DELETE FROM Product WHERE id = ?', req.params.id);
    res.json({ success: true });
  }));

  app.post('/api/products/import', requireAuth, requireRole('admin', 'manager'), upload.single('file'), ah(async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const records = parse(req.file.buffer.toString('utf-8'), { columns: true, skip_empty_lines: true, trim: true });
    const db = getDb();
    let inserted = 0;
    let skipped = 0;
    for (const row of records as any[]) {
      const sku = row.sku || row['SKU'] || row['Mã sản phẩm'];
      if (!sku) {
        skipped++;
        continue;
      }
      const existing = await db.get('SELECT id FROM Product WHERE sku = ?', sku);
      if (existing) {
        skipped++;
        continue;
      }
      try {
        await db.run(
          `INSERT INTO Product (id, sku, name, category, unit, basePrice, currency, technicalSpecs, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(),
            sku,
            row.name || row['Tên sản phẩm'] || '',
            row.category || row['Danh mục'] || '',
            row.unit || row['Đơn vị'] || 'Chiếc',
            parseFloat(row.basePrice || row['Giá'] || '0'),
            row.currency || 'USD',
            row.technicalSpecs || row['Thông số'] || '',
            row.status || row['Trạng thái'] || 'available',
          ]
        );
        inserted++;
      } catch {
        skipped++;
      }
    }
    res.json({ inserted, skipped, total: (records as any[]).length });
  }));
}
