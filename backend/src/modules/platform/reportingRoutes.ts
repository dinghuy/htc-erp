import type { Express, Request, Response } from 'express';
import type { PlatformReportingServices } from '../../bootstrap/createOperationalServices';

type AsyncRouteFactory = (handler: (req: Request, res: Response) => Promise<unknown>) => any;

type RegisterPlatformReportingRoutesDeps = {
  ah: AsyncRouteFactory;
  reportingServices: PlatformReportingServices;
};

export function registerPlatformReportingRoutes(app: Express, deps: RegisterPlatformReportingRoutesDeps) {
  const { ah, reportingServices } = deps;

  app.get('/api/stats', ah(async (_req: Request, res: Response) => {
    res.json(await reportingServices.getStats());
  }));

  app.get('/api/search', ah(async (req: Request, res: Response) => {
    const q = req.query.q as string;
    res.json(await reportingServices.searchCatalog(q));
  }));

  app.get('/api/reports/revenue', ah(async (_req: Request, res: Response) => {
    res.json(await reportingServices.getRevenueReport());
  }));

  app.get('/api/reports/funnel', ah(async (_req: Request, res: Response) => {
    res.json(await reportingServices.getFunnelReport());
  }));

  app.get('/api/ops/summary', ah(async (_req: Request, res: Response) => {
    res.json(await reportingServices.getOpsSummary());
  }));

  app.get('/api/reports/handoff-activation', ah(async (_req: Request, res: Response) => {
    res.json(await reportingServices.getHandoffActivationReport());
  }));
}
