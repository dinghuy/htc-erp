import type { Express, Request, Response } from 'express';
import { createSalesOrderService } from './service';

type AsyncRouteFactory = (handler: (req: Request, res: Response) => Promise<unknown>) => any;

type RegisterSalesOrderRoutesDeps = {
  ah: AsyncRouteFactory;
  requireAuth: any;
  requireRole: (...roles: string[]) => any;
  parseLimitParam: (value: string | undefined, defaultValue: number, maxValue: number) => number;
  createSalesOrderFromQuotation: (db: any, quotationId: string) => Promise<{ created: boolean; salesOrder: any }>;
  getProjectWorkspaceById: (db: any, projectId: string, currentUser?: any) => Promise<any>;
  createProjectTimelineEvent: (db: any, event: any) => Promise<any>;
};

function routeParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

export function registerSalesOrderRoutes(app: Express, deps: RegisterSalesOrderRoutesDeps) {
  const {
    ah,
    requireAuth,
    requireRole,
    parseLimitParam,
    createSalesOrderFromQuotation,
    getProjectWorkspaceById,
    createProjectTimelineEvent,
  } = deps;
  const salesOrderService = createSalesOrderService({
    createSalesOrderFromQuotation,
    getProjectWorkspaceById,
    createProjectTimelineEvent,
  });

  app.get('/api/sales-orders', requireAuth, ah(async (req: Request, res: Response) => {
    const limit = parseLimitParam((req.query as Record<string, string | undefined>).limit, 100, 500);
    const rows = await salesOrderService.listSalesOrders({ limit, currentUser: (req as any).user });
    res.json(rows);
  }));

  app.get('/api/sales-orders/:id', requireAuth, ah(async (req: Request, res: Response) => {
    const salesOrderId = routeParam(req.params.id);
    const row = await salesOrderService.getSalesOrderById(salesOrderId);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  }));

  app.post('/api/sales-orders/from-quotation/:quotationId', requireAuth, requireRole('admin', 'manager', 'sales', 'project_manager', 'director'), ah(async (req: Request, res: Response) => {
    const quotationId = routeParam(req.params.quotationId);
    const result = await salesOrderService.createFromQuotation({ quotationId, currentUser: (req as any).user });
    res.status(result.status).json(result.body);
  }));

  app.post('/api/sales-orders/:id/release-approval', requireAuth, requireRole('admin', 'project_manager', 'director'), ah(async (req: Request, res: Response) => {
    const salesOrderId = routeParam(req.params.id);
    const result = await salesOrderService.requestReleaseApproval({
      salesOrderId,
      note: req.body?.note,
      currentUser: (req as any).user,
    });
    res.status(result.status).json(result.body);
  }));

  app.put('/api/sales-orders/:id', requireAuth, requireRole('admin', 'manager', 'sales', 'project_manager', 'director'), ah(async (req: Request, res: Response) => {
    const body = req.body ?? {};
    const salesOrderId = routeParam(req.params.id);
    const result = await salesOrderService.updateSalesOrder({
      salesOrderId,
      status: body.status,
      notes: body.notes,
      currentUser: (req as any).user,
    });
    res.status(result.status).json(result.body);
  }));
}
