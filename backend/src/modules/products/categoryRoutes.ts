import type { Express, Request, Response } from 'express';
import { productCategoryRepository } from './categoryRepository';

type AsyncRouteFactory = (handler: (req: Request, res: Response) => Promise<unknown>) => any;

type RegisterProductCategoryRoutesDeps = {
  ah: AsyncRouteFactory;
  requireAuth?: any;
};

export function registerProductCategoryRoutes(app: Express, deps: RegisterProductCategoryRoutesDeps) {
  const { ah } = deps;
  const repo = productCategoryRepository;
  const getSingleParam = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

  app.get('/api/product-categories', ah(async (_req: Request, res: Response) => {
    res.json(await repo.findAll());
  }));

  app.get('/api/product-categories/:id', ah(async (req: Request, res: Response) => {
    const id = getSingleParam(req.params.id);
    if (!id) return res.status(400).json({ error: 'id is required' });
    const row = await repo.findById(id);
    if (!row) return res.status(404).json({ error: 'Product category not found' });
    res.json(row);
  }));

  app.post('/api/product-categories', ah(async (req: Request, res: Response) => {
    const { name, parentId, sortOrder } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const row = await repo.create({
      name: String(name),
      parentId: parentId != null ? String(parentId) : null,
      sortOrder: sortOrder != null ? Number(sortOrder) : 0,
    });
    res.status(201).json(row);
  }));

  app.put('/api/product-categories/:id', ah(async (req: Request, res: Response) => {
    const id = getSingleParam(req.params.id);
    if (!id) return res.status(400).json({ error: 'id is required' });
    const row = await repo.updateById(id, {
      name: req.body.name != null ? String(req.body.name) : undefined,
      parentId: req.body.parentId !== undefined
        ? (req.body.parentId != null ? String(req.body.parentId) : null)
        : undefined,
      sortOrder: req.body.sortOrder != null ? Number(req.body.sortOrder) : undefined,
    });
    if (!row) return res.status(404).json({ error: 'Product category not found' });
    res.json(row);
  }));

  app.delete('/api/product-categories/:id', ah(async (req: Request, res: Response) => {
    const id = getSingleParam(req.params.id);
    if (!id) return res.status(400).json({ error: 'id is required' });
    await repo.deleteById(id);
    res.json({ success: true });
  }));
}
