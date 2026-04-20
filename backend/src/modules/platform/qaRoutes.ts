import type { Express, Response } from 'express';
import { getDb } from '../../../sqlite-db';
import type { AuthenticatedRequest } from '../../shared/auth/httpAuth';
import { buildUxSeedContract, resetUxRegressionSeed } from './qaSeed';

type AsyncRouteFactory = (handler: (req: any, res: Response) => Promise<unknown>) => any;

type RegisterPlatformQaRoutesDeps = {
  ah: AsyncRouteFactory;
  requireAuth: any;
};

const QA_BOOTSTRAP_HEADER = 'x-qa-bootstrap';
const QA_BOOTSTRAP_SECRET = process.env.QA_BOOTSTRAP_SECRET?.trim() || 'ux-seed-local-only';

function canAccessQaRoute(req: AuthenticatedRequest) {
  const activeRoles = Array.isArray(req.user?.roleCodes) ? req.user?.roleCodes : [];
  return activeRoles.includes('admin');
}

function assertQaRouteAvailable(req: AuthenticatedRequest, res: Response) {
  if (process.env.NODE_ENV === 'production') {
    res.status(404).json({ error: 'QA routes are disabled in production' });
    return false;
  }
  if (!canAccessQaRoute(req)) {
    res.status(403).json({ error: 'Admin access required for QA routes' });
    return false;
  }
  return true;
}

function assertBootstrapRouteAvailable(req: any, res: Response) {
  if (process.env.NODE_ENV === 'production') {
    res.status(404).json({ error: 'QA routes are disabled in production' });
    return false;
  }
  const bootstrapHeader = typeof req.header === 'function' ? req.header(QA_BOOTSTRAP_HEADER) : undefined;
  if (bootstrapHeader !== QA_BOOTSTRAP_SECRET) {
    res.status(403).json({ error: 'QA bootstrap header is missing or invalid' });
    return false;
  }
  return true;
}

export function registerPlatformQaRoutes(app: Express, deps: RegisterPlatformQaRoutesDeps) {
  const { ah, requireAuth } = deps;

  app.post('/api/qa/bootstrap-ux-seed', ah(async (req: any, res: Response) => {
    if (!assertBootstrapRouteAvailable(req, res)) return;
    const contract = await resetUxRegressionSeed(getDb());
    res.json({
      ok: true,
      contract,
      bootstrap: true,
    });
  }));

  app.get('/api/qa/ux-seed-contract', requireAuth, ah(async (req: AuthenticatedRequest, res: Response) => {
    if (!assertQaRouteAvailable(req, res)) return;
    res.json(buildUxSeedContract());
  }));

  app.post('/api/qa/reset-ux-seed', requireAuth, ah(async (req: AuthenticatedRequest, res: Response) => {
    if (!assertQaRouteAvailable(req, res)) return;
    const contract = await resetUxRegressionSeed(getDb());
    res.json({
      ok: true,
      contract,
    });
  }));
}
