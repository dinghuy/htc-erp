import type { Express, Request, Response } from 'express';
import { createHrService } from './service';

type AsyncRouteFactory = (handler: (req: Request, res: Response) => Promise<unknown>) => any;

type RegisterHrRoutesDeps = {
  ah: AsyncRouteFactory;
  requireAuth?: any;
};

export function registerHrRoutes(app: Express, deps: RegisterHrRoutesDeps) {
  const { ah } = deps;
  const hrService = createHrService();
  const getSingleParam = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

  // ── Department routes ────────────────────────────────────────────────────
  app.get('/api/hr/departments', ah(async (_req: Request, res: Response) => {
    res.json(await hrService.listDepartments());
  }));

  app.get('/api/hr/departments/:id', ah(async (req: Request, res: Response) => {
    const id = getSingleParam(req.params.id);
    if (!id) return res.status(400).json({ error: 'id is required' });
    const row = await hrService.getDepartmentById(id);
    if (!row) return res.status(404).json({ error: 'Department not found' });
    res.json(row);
  }));

  app.post('/api/hr/departments', ah(async (req: Request, res: Response) => {
    const row = await hrService.createDepartment(req.body);
    res.status(201).json(row);
  }));

  app.put('/api/hr/departments/:id', ah(async (req: Request, res: Response) => {
    const id = getSingleParam(req.params.id);
    if (!id) return res.status(400).json({ error: 'id is required' });
    const row = await hrService.updateDepartment(id, req.body);
    if (!row) return res.status(404).json({ error: 'Department not found' });
    res.json(row);
  }));

  app.delete('/api/hr/departments/:id', ah(async (req: Request, res: Response) => {
    const id = getSingleParam(req.params.id);
    if (!id) return res.status(400).json({ error: 'id is required' });
    await hrService.deleteDepartment(id);
    res.json({ success: true });
  }));

  // ── HrRequest routes ─────────────────────────────────────────────────────
  app.get('/api/hr/requests', ah(async (req: Request, res: Response) => {
    const filters = {
      staffId: req.query.staffId as string | undefined,
      departmentId: req.query.departmentId as string | undefined,
      status: req.query.status as string | undefined,
    };
    res.json(await hrService.listHrRequests(filters));
  }));

  app.get('/api/hr/requests/:id', ah(async (req: Request, res: Response) => {
    const id = getSingleParam(req.params.id);
    if (!id) return res.status(400).json({ error: 'id is required' });
    const row = await hrService.getHrRequestById(id);
    if (!row) return res.status(404).json({ error: 'HR request not found' });
    res.json(row);
  }));

  app.post('/api/hr/requests', ah(async (req: Request, res: Response) => {
    const row = await hrService.createHrRequest(req.body);
    res.status(201).json(row);
  }));

  app.put('/api/hr/requests/:id', ah(async (req: Request, res: Response) => {
    const id = getSingleParam(req.params.id);
    if (!id) return res.status(400).json({ error: 'id is required' });
    const row = await hrService.updateHrRequest(id, req.body);
    if (!row) return res.status(404).json({ error: 'HR request not found' });
    res.json(row);
  }));

  app.delete('/api/hr/requests/:id', ah(async (req: Request, res: Response) => {
    const id = getSingleParam(req.params.id);
    if (!id) return res.status(400).json({ error: 'id is required' });
    await hrService.deleteHrRequest(id);
    res.json({ success: true });
  }));

  // ── PublicHoliday routes ─────────────────────────────────────────────────
  app.get('/api/hr/holidays', ah(async (req: Request, res: Response) => {
    const departmentId = req.query.departmentId as string | undefined;
    res.json(await hrService.listPublicHolidays(departmentId));
  }));

  app.get('/api/hr/holidays/:id', ah(async (req: Request, res: Response) => {
    const id = getSingleParam(req.params.id);
    if (!id) return res.status(400).json({ error: 'id is required' });
    const row = await hrService.getPublicHolidayById(id);
    if (!row) return res.status(404).json({ error: 'Public holiday not found' });
    res.json(row);
  }));

  app.post('/api/hr/holidays', ah(async (req: Request, res: Response) => {
    const row = await hrService.createPublicHoliday(req.body);
    res.status(201).json(row);
  }));

  app.delete('/api/hr/holidays/:id', ah(async (req: Request, res: Response) => {
    const id = getSingleParam(req.params.id);
    if (!id) return res.status(400).json({ error: 'id is required' });
    await hrService.deletePublicHoliday(id);
    res.json({ success: true });
  }));
}
