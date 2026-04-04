import type { Express, Request, Response } from 'express';
import { createProjectRepository } from './repository';
import { createSupplierQuote } from './supplierQuoteService';

type AsyncRouteFactory = (handler: (req: Request, res: Response) => Promise<unknown>) => any;

type RegisterProjectSupplierQuoteRoutesDeps = {
  ah: AsyncRouteFactory;
  requireAuth: any;
  requireRole: (...roles: string[]) => any;
};

export function registerProjectSupplierQuoteRoutes(app: Express, deps: RegisterProjectSupplierQuoteRoutesDeps) {
  const {
    ah,
    requireAuth,
    requireRole,
  } = deps;
  const projectRepository = createProjectRepository();

  app.post('/api/projects/:id/supplier-quotes', requireAuth, requireRole('admin', 'manager', 'sales'), ah(async (req: Request, res: Response) => {
    const projectId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const project = await projectRepository.findProjectSummaryById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const { supplierId, linkedQuotationId, category, quoteDate, validUntil, items, attachments, changeReason, status = 'active' } = req.body;
    const created = await createSupplierQuote(null, {
      supplierId,
      projectId,
      linkedQuotationId,
      category,
      quoteDate,
      validUntil,
      items,
      attachments,
      changeReason,
      status,
    });
    res.status(201).json(created);
  }));
}
