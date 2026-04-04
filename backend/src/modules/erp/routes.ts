import type { Express, Request, Response } from 'express';
import { createErpOutboxRepository } from './repository';
import { createErpOutboxService } from './service';

type RouteDeps = {
  requireAuth: any;
  requireRole: (...roles: string[]) => any;
  ah: (fn: (req: Request, res: Response) => Promise<unknown> | unknown) => any;
  getDb: () => any;
  parseLimitParam: (raw: unknown, fallback?: number, max?: number) => number;
  runErpOutboxOnce: (db: any, opts?: { limit?: number }) => Promise<unknown>;
};

export function registerErpRoutes(app: Express, deps: RouteDeps) {
  const repository = createErpOutboxRepository({ getDb: deps.getDb });
  const service = createErpOutboxService({
    repository,
    getDb: deps.getDb,
    runErpOutboxOnce: deps.runErpOutboxOnce,
  });

  const outboxHandler = deps.ah(async (req: Request, res: Response) => {
    const { status } = req.query as Record<string, string | undefined>;
    const limit = deps.parseLimitParam((req.query as Record<string, string | undefined>).limit, 50, 500);
    res.json(await service.getOutboxPayload({ status, limit }));
  });

  const syncHandler = deps.ah(async (req: Request, res: Response) => {
    const limit = deps.parseLimitParam((req.query as Record<string, string | undefined>).limit, 20, 200);
    res.json(await service.runSync(limit));
  });

  app.get('/api/erp/outbox', deps.requireAuth, deps.requireRole('admin', 'manager'), outboxHandler);
  app.get('/api/integrations/erp/outbox', deps.requireAuth, deps.requireRole('admin', 'manager'), outboxHandler);
  app.get('/api/v1/integrations/erp/outbox', deps.requireAuth, deps.requireRole('admin', 'manager'), outboxHandler);
  app.post('/api/erp/sync/run', deps.requireAuth, deps.requireRole('admin', 'manager'), syncHandler);
  app.post('/api/integrations/erp/outbox/run', deps.requireAuth, deps.requireRole('admin', 'manager'), syncHandler);
  app.post('/api/v1/integrations/erp/outbox/run', deps.requireAuth, deps.requireRole('admin', 'manager'), syncHandler);
}
