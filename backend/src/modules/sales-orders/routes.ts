import type { Express, Request, Response } from 'express';
import { getDb } from '../../../sqlite-db';
import { enqueueErpEvent } from '../../../erp-sync';
import { canTransitionSalesOrderStatus } from '../../shared/workflow/revenueFlow';

type AsyncRouteFactory = (handler: (req: Request, res: Response) => Promise<unknown>) => any;

type RegisterSalesOrderRoutesDeps = {
  ah: AsyncRouteFactory;
  requireAuth: any;
  requireRole: (...roles: string[]) => any;
  parseLimitParam: (value: string | undefined, defaultValue: number, maxValue: number) => number;
  createSalesOrderFromQuotation: (db: any, quotationId: string) => Promise<{ created: boolean; salesOrder: any }>;
};

export function registerSalesOrderRoutes(app: Express, deps: RegisterSalesOrderRoutesDeps) {
  const {
    ah,
    requireAuth,
    requireRole,
    parseLimitParam,
    createSalesOrderFromQuotation,
  } = deps;

  app.get('/api/sales-orders', requireAuth, ah(async (req: Request, res: Response) => {
    const db = getDb();
    const limit = parseLimitParam((req.query as Record<string, string | undefined>).limit, 100, 500);
    const rows = await db.all(
      `SELECT so.*,
              a.companyName AS accountName,
              q.quoteNumber AS quotationNumber,
              q.subject AS quotationSubject,
              q.status AS quotationStatus
       FROM SalesOrder so
       LEFT JOIN Account a ON so.accountId = a.id
       LEFT JOIN Quotation q ON so.quotationId = q.id
       ORDER BY so.createdAt DESC, so.id DESC
       LIMIT ?`,
      [limit]
    );
    res.json(rows);
  }));

  app.get('/api/sales-orders/:id', requireAuth, ah(async (req: Request, res: Response) => {
    const db = getDb();
    const row = await db.get(
      `SELECT so.*,
              a.companyName AS accountName,
              q.quoteNumber AS quotationNumber,
              q.subject AS quotationSubject,
              q.status AS quotationStatus
       FROM SalesOrder so
       LEFT JOIN Account a ON so.accountId = a.id
       LEFT JOIN Quotation q ON so.quotationId = q.id
       WHERE so.id = ?`,
      [req.params.id]
    );
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  }));

  app.post('/api/sales-orders/from-quotation/:quotationId', requireAuth, requireRole('admin', 'manager', 'sales'), ah(async (req: Request, res: Response) => {
    const db = getDb();
    const quotationId = Array.isArray(req.params.quotationId) ? req.params.quotationId[0] : req.params.quotationId;
    const result = await createSalesOrderFromQuotation(db, quotationId);
    res.status(result.created ? 201 : 200).json(result);
  }));

  app.put('/api/sales-orders/:id', requireAuth, requireRole('admin', 'manager', 'sales'), ah(async (req: Request, res: Response) => {
    const db = getDb();
    const { status, notes } = req.body ?? {};
    const current = await db.get(
      `SELECT so.id, so.status, q.status AS quotationStatus
       FROM SalesOrder so
       LEFT JOIN Quotation q ON so.quotationId = q.id
       WHERE so.id = ?`,
      [req.params.id],
    );
    if (!current) return res.status(404).json({ error: 'Not found' });
    const nextStatus = typeof status === 'string' && status.trim() ? status.trim() : String(current.status || 'draft');
    const nextNotes = typeof notes === 'string' ? notes : null;
    const transition = canTransitionSalesOrderStatus({
      currentStatus: current.status,
      nextStatus,
      quotationStatus: current.quotationStatus,
    });
    if (!transition.ok) {
      const failure = 'failure' in transition ? transition.failure : { code: 'INVALID_TRANSITION', message: 'Sales order transition blocked' };
      return res.status(409).json({ error: failure.message, code: failure.code });
    }

    const roleCodes = Array.isArray((req as any).user?.roleCodes) ? (req as any).user.roleCodes.map(String) : [];
    const systemRole = String((req as any).user?.systemRole || '').trim();
    const userRoles = new Set([...roleCodes, systemRole]);
    if (String(nextStatus).trim() === 'released' && !['admin', 'director'].some((role) => userRoles.has(role))) {
      return res.status(403).json({ error: 'Only director can release a sales order' });
    }
    if (String(nextStatus).trim() === 'locked_for_execution' && !['admin', 'director', 'project_manager'].some((role) => userRoles.has(role))) {
      return res.status(403).json({ error: 'Only project manager or director can lock execution' });
    }

    await db.run(
      `UPDATE SalesOrder
       SET status = ?, notes = COALESCE(?, notes), updatedAt = datetime('now')
       WHERE id = ?`,
      [nextStatus, nextNotes, req.params.id]
    );
    const updated = await db.get(`SELECT * FROM SalesOrder WHERE id = ?`, [req.params.id]);
    if (String(nextStatus).trim() === 'released') {
      await enqueueErpEvent(db, {
        eventType: 'sales_order.released',
        entityType: 'SalesOrder',
        entityId: Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
        payload: { salesOrderId: Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, status: nextStatus },
      });
    }
    res.json(updated);
  }));
}
