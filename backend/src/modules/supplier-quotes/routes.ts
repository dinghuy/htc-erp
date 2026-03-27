import type { Express, Request, Response } from 'express';
import { getDb } from '../../../sqlite-db';

type AsyncRouteFactory = (handler: (req: Request, res: Response) => Promise<unknown>) => any;

type RegisterSupplierQuoteRoutesDeps = {
  ah: AsyncRouteFactory;
  createSupplierQuote: (db: any, input: any) => Promise<any>;
};

export function registerSupplierQuoteRoutes(app: Express, deps: RegisterSupplierQuoteRoutesDeps) {
  const { ah, createSupplierQuote } = deps;

  app.get('/api/supplier-quotes', ah(async (req: Request, res: Response) => {
    const { category, projectId, linkedQuotationId } = req.query as Record<string, string | undefined>;
    const conditions: string[] = [];
    const params: any[] = [];
    if (category) {
      conditions.push('sq.category = ?');
      params.push(category);
    }
    if (projectId) {
      conditions.push('sq.projectId = ?');
      params.push(projectId);
    }
    if (linkedQuotationId) {
      conditions.push('sq.linkedQuotationId = ?');
      params.push(linkedQuotationId);
    }
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await getDb().all(
      `SELECT sq.*, a.companyName as supplierName, p.name AS projectName, q.quoteNumber AS linkedQuotationNumber
       FROM SupplierQuote sq
       LEFT JOIN Account a ON sq.supplierId = a.id
       LEFT JOIN Project p ON sq.projectId = p.id
       LEFT JOIN Quotation q ON sq.linkedQuotationId = q.id
       ${whereClause}
       ORDER BY sq.quoteDate DESC, sq.createdAt DESC`,
      params
    );
    res.json(rows);
  }));

  app.post('/api/supplier-quotes', ah(async (req: Request, res: Response) => {
    const db = getDb();
    const { supplierId, projectId, linkedQuotationId, category, quoteDate, validUntil, items, attachments, changeReason, status = 'active' } = req.body;
    const created = await createSupplierQuote(db, {
      supplierId,
      projectId: projectId || null,
      linkedQuotationId,
      category,
      quoteDate,
      validUntil,
      items,
      attachments,
      changeReason,
      status,
    });
    res.status(201).json(created);
  }));

  app.put('/api/supplier-quotes/:id', ah(async (req: Request, res: Response) => {
    const db = getDb();
    const { supplierId, projectId, linkedQuotationId, category, quoteDate, validUntil, items, attachments, changeReason, status } = req.body;
    await db.run(
      `UPDATE SupplierQuote SET supplierId=?, projectId=?, linkedQuotationId=?, category=?, quoteDate=?, validUntil=?, items=?, attachments=?, changeReason=?, status=? WHERE id=?`,
      [supplierId, projectId || null, linkedQuotationId || null, category, quoteDate, validUntil, JSON.stringify(items || []), JSON.stringify(attachments || []), changeReason || null, status, req.params.id]
    );
    res.json(await db.get('SELECT * FROM SupplierQuote WHERE id = ?', req.params.id));
  }));

  app.delete('/api/supplier-quotes/:id', ah(async (req: Request, res: Response) => {
    await getDb().run('DELETE FROM SupplierQuote WHERE id = ?', req.params.id);
    res.json({ success: true });
  }));
}
