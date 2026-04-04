import type { Express, Request, Response } from 'express';
import { createFunnelService } from './service';

type AsyncRouteFactory = (handler: (req: Request, res: Response) => Promise<unknown>) => any;

type RegisterFunnelRoutesDeps = {
  ah: AsyncRouteFactory;
  requireAuth?: any;
};

export function registerFunnelRoutes(app: Express, deps: RegisterFunnelRoutesDeps) {
  const { ah } = deps;
  const funnelService = createFunnelService();
  const getSingleParam = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

  app.get('/api/funnels', ah(async (_req: Request, res: Response) => {
    res.json(await funnelService.listFunnels());
  }));

  app.get('/api/funnels/:id', ah(async (req: Request, res: Response) => {
    const id = getSingleParam(req.params.id);
    if (!id) return res.status(400).json({ error: 'id is required' });
    const row = await funnelService.getFunnelById(id);
    if (!row) return res.status(404).json({ error: 'Funnel not found' });
    res.json(row);
  }));

  app.post('/api/funnels', ah(async (req: Request, res: Response) => {
    const row = await funnelService.createFunnel(req.body);
    res.status(201).json(row);
  }));

  app.put('/api/funnels/:id', ah(async (req: Request, res: Response) => {
    const id = getSingleParam(req.params.id);
    if (!id) return res.status(400).json({ error: 'id is required' });
    const row = await funnelService.updateFunnel(id, req.body);
    if (!row) return res.status(404).json({ error: 'Funnel not found' });
    res.json(row);
  }));

  app.delete('/api/funnels/:id', ah(async (req: Request, res: Response) => {
    const id = getSingleParam(req.params.id);
    if (!id) return res.status(400).json({ error: 'id is required' });
    await funnelService.deleteFunnel(id);
    res.json({ success: true });
  }));
}
