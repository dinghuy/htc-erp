import type { Express, Request, Response } from 'express';
import type { PlatformReportingServices } from '../../bootstrap/createOperationalServices';

type AsyncRouteFactory = (handler: (req: Request, res: Response) => Promise<unknown>) => any;

type RegisterPlatformReportingRoutesDeps = {
  ah: AsyncRouteFactory;
  requireAuth: any;
  reportingServices: PlatformReportingServices;
};

export function registerPlatformReportingRoutes(app: Express, deps: RegisterPlatformReportingRoutesDeps) {
  const { ah, requireAuth, reportingServices } = deps;

  app.get('/api/stats', requireAuth, ah(async (_req: Request, res: Response) => {
    res.json(await reportingServices.getStats());
  }));

  app.get('/api/search', requireAuth, ah(async (req: Request, res: Response) => {
    const q = req.query.q as string;
    res.json(await reportingServices.searchCatalog(q));
  }));

  app.get('/api/reports/revenue', requireAuth, ah(async (_req: Request, res: Response) => {
    res.json(await reportingServices.getRevenueReport());
  }));

  app.get('/api/reports/funnel', requireAuth, ah(async (_req: Request, res: Response) => {
    res.json(await reportingServices.getFunnelReport());
  }));

  app.get('/api/ops/summary', requireAuth, ah(async (_req: Request, res: Response) => {
    res.json(await reportingServices.getOpsSummary());
  }));

  app.get('/api/reports/handoff-activation', requireAuth, ah(async (_req: Request, res: Response) => {
    res.json(await reportingServices.getHandoffActivationReport());
  }));
}
