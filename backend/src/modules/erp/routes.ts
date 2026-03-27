import type { Express, Request, Response } from 'express';
import { ERP_OUTBOX_MAX_ATTEMPTS, buildErpOutboxStats, mapErpOutboxRow } from './outboxContract';

type RouteDeps = {
  requireAuth: any;
  requireRole: (...roles: string[]) => any;
  ah: (fn: (req: Request, res: Response) => Promise<unknown> | unknown) => any;
  getDb: () => any;
  parseLimitParam: (raw: unknown, fallback?: number, max?: number) => number;
  runErpOutboxOnce: (db: any, opts?: { limit?: number }) => Promise<unknown>;
};

async function buildOutboxPayload(
  db: any,
  options: {
    status?: string;
    limit: number;
  },
) {
  const conditions: string[] = [];
  const params: any[] = [];

  if (options.status === 'dead-letter') {
    conditions.push('status = ?');
    conditions.push('attempts >= ?');
    params.push('failed', ERP_OUTBOX_MAX_ATTEMPTS);
  } else if (options.status) {
    conditions.push('status = ?');
    params.push(options.status);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const items = await db.all(
    `SELECT id, dedupeKey, eventType, entityType, entityId, status, attempts, lastError, nextRunAt, sentAt, createdAt, updatedAt
     FROM ErpOutbox
     ${where}
     ORDER BY createdAt DESC, id DESC
     LIMIT ?`,
    [...params, options.limit],
  );
  const stats = await db.get(
    `SELECT
       SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
       SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
       SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent,
       SUM(CASE WHEN status = 'failed' AND attempts >= ? THEN 1 ELSE 0 END) AS deadLetter
     FROM ErpOutbox`,
    [ERP_OUTBOX_MAX_ATTEMPTS],
  );

  return {
    items: (items as any[]).map((row) => mapErpOutboxRow(row)),
    stats: buildErpOutboxStats(stats as Record<string, unknown> | undefined),
  };
}

export function registerErpRoutes(app: Express, deps: RouteDeps) {
  const outboxHandler = deps.ah(async (req: Request, res: Response) => {
    const db = deps.getDb();
    const { status } = req.query as Record<string, string | undefined>;
    const limit = deps.parseLimitParam((req.query as Record<string, string | undefined>).limit, 50, 500);
    res.json(await buildOutboxPayload(db, { status, limit }));
  });

  const syncHandler = deps.ah(async (req: Request, res: Response) => {
    const db = deps.getDb();
    const limit = deps.parseLimitParam((req.query as Record<string, string | undefined>).limit, 20, 200);
    const result = await deps.runErpOutboxOnce(db, { limit });
    res.json(result);
  });

  app.get('/api/erp/outbox', deps.requireAuth, deps.requireRole('admin', 'manager'), outboxHandler);
  app.post('/api/erp/sync/run', deps.requireAuth, deps.requireRole('admin', 'manager'), syncHandler);
}
