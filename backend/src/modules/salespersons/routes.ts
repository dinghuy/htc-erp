import type { Express, Request, Response } from 'express';
import { createSalespersonService } from './service';

type AsyncRouteFactory = (handler: (req: Request, res: Response) => Promise<unknown>) => any;

type RegisterSalespersonRoutesDeps = {
  ah: AsyncRouteFactory;
  requireAuth: any;
  requireRole: (...roles: string[]) => any;
};

export function registerSalespersonRoutes(app: Express, deps: RegisterSalespersonRoutesDeps) {
  const { ah, requireAuth, requireRole } = deps;
  const salespersonService = createSalespersonService();

  app.get('/api/salespersons', requireAuth, ah(async (_req: Request, res: Response) => {
    res.json(await salespersonService.listSalespersons());
  }));

  app.post('/api/salespersons', requireAuth, requireRole('admin', 'manager'), ah(async (req: Request, res: Response) => {
    res.status(201).json(await salespersonService.createSalesperson(req.body));
  }));

  app.delete('/api/salespersons/:id', requireAuth, requireRole('admin', 'manager'), ah(async (req: Request, res: Response) => {
    const salespersonId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    await salespersonService.deleteSalesperson(salespersonId);
    res.json({ success: true });
  }));
}
