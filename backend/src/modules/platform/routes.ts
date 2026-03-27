import type { Express } from 'express';
import { createApiV1AliasMiddleware } from './apiV1Aliases';

export function registerPlatformRoutes(app: Express) {
  app.use(createApiV1AliasMiddleware(app as unknown as { handle: (req: any, res: any, next: (error?: unknown) => void) => void }));
  app.get('/api/health', (_req, res) => res.json({ status: 'ok', ts: new Date() }));
}
