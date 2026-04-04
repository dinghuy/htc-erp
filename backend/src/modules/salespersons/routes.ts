import type { Express, Request, Response } from 'express';
import { createSalespersonService } from './service';

type AsyncRouteFactory = (handler: (req: Request, res: Response) => Promise<unknown>) => any;

type RegisterSalespersonRoutesDeps = {
  ah: AsyncRouteFactory;
};

export function registerSalespersonRoutes(app: Express, deps: RegisterSalespersonRoutesDeps) {
  const { ah } = deps;
  const salespersonService = createSalespersonService();

  app.get('/api/salespersons', ah(async (_req: Request, res: Response) => {
    res.json(await salespersonService.listSalespersons());
  }));

  app.post('/api/salespersons', ah(async (req: Request, res: Response) => {
    res.status(201).json(await salespersonService.createSalesperson(req.body));
  }));

  app.delete('/api/salespersons/:id', ah(async (req: Request, res: Response) => {
    const salespersonId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    await salespersonService.deleteSalesperson(salespersonId);
    res.json({ success: true });
  }));
}
