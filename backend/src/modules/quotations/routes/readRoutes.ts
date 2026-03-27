import type { Request, Response } from 'express';
import { getQuotationById, listQuotations } from '../readService';
import type { ExpressApp, RegisterQuotationSubrouteDeps } from './types';

export function registerQuotationReadRoutes(app: ExpressApp, deps: RegisterQuotationSubrouteDeps) {
  const { ah, requireAuth } = deps;

  app.get('/api/quotations', requireAuth, ah(async (req: Request, res: Response) => {
    res.json(await listQuotations((req as any).user));
  }));

  app.get('/api/quotations/:id', requireAuth, ah(async (req: Request, res: Response) => {
    const quotationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const row = await getQuotationById(quotationId, (req as any).user);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  }));
}
