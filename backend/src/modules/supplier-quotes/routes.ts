import type { Express, Request, Response } from 'express';
import { createSupplierQuoteService } from './service';

type AsyncRouteFactory = (handler: (req: Request, res: Response) => Promise<unknown>) => any;

type RegisterSupplierQuoteRoutesDeps = {
  ah: AsyncRouteFactory;
  createSupplierQuote: (db: any, input: any) => Promise<any>;
};

export function registerSupplierQuoteRoutes(app: Express, deps: RegisterSupplierQuoteRoutesDeps) {
  const { ah, createSupplierQuote } = deps;
  const supplierQuoteService = createSupplierQuoteService({ createSupplierQuote });

  app.get('/api/supplier-quotes', ah(async (req: Request, res: Response) => {
    res.json(await supplierQuoteService.listSupplierQuotes(req.query as Record<string, string | undefined>));
  }));

  app.post('/api/supplier-quotes', ah(async (req: Request, res: Response) => {
    res.status(201).json(await supplierQuoteService.createSupplierQuote(req.body));
  }));

  app.put('/api/supplier-quotes/:id', ah(async (req: Request, res: Response) => {
    const supplierQuoteId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    res.json(await supplierQuoteService.updateSupplierQuote(supplierQuoteId, req.body));
  }));

  app.delete('/api/supplier-quotes/:id', ah(async (req: Request, res: Response) => {
    const supplierQuoteId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    await supplierQuoteService.deleteSupplierQuote(supplierQuoteId);
    res.json({ success: true });
  }));
}
