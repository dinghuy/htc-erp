import type { Express, Request, Response } from 'express';
import { createSupplierService } from './service';

type AsyncRouteFactory = (handler: (req: Request, res: Response) => Promise<unknown>) => any;

type RegisterSupplierRoutesDeps = {
  ah: AsyncRouteFactory;
  requireAuth: any;
  requireRole: (...roles: string[]) => any;
  upload: any;
  serializeSupplierTags: (raw: unknown) => string;
  hydrateSupplier: (row: any) => any;
};

export function registerSupplierRoutes(app: Express, deps: RegisterSupplierRoutesDeps) {
  const {
    ah,
    requireAuth,
    requireRole,
    upload,
    serializeSupplierTags,
    hydrateSupplier,
  } = deps;
  const supplierService = createSupplierService({ hydrateSupplier, serializeSupplierTags });

  app.get('/api/suppliers', ah(async (_req: Request, res: Response) => {
    res.json(await supplierService.listSuppliers());
  }));

  app.post('/api/suppliers', ah(async (req: Request, res: Response) => {
    res.status(201).json(await supplierService.createSupplier(req.body));
  }));

  app.put('/api/suppliers/:id', ah(async (req: Request, res: Response) => {
    const supplierId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    res.json(await supplierService.updateSupplier(supplierId, req.body));
  }));

  app.delete('/api/suppliers/:id', ah(async (req: Request, res: Response) => {
    const supplierId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    await supplierService.deleteSupplier(supplierId);
    res.json({ success: true });
  }));

  app.post('/api/suppliers/import', requireAuth, requireRole('admin', 'manager'), upload.single('file'), ah(async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json(await supplierService.importSuppliers(req.file));
  }));
}
