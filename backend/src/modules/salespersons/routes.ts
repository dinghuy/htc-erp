import type { Express, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../../../sqlite-db';

type AsyncRouteFactory = (handler: (req: Request, res: Response) => Promise<unknown>) => any;

type RegisterSalespersonRoutesDeps = {
  ah: AsyncRouteFactory;
};

export function registerSalespersonRoutes(app: Express, deps: RegisterSalespersonRoutesDeps) {
  const { ah } = deps;

  app.get('/api/salespersons', ah(async (_req: Request, res: Response) => {
    res.json(await getDb().all('SELECT * FROM SalesPerson ORDER BY name'));
  }));

  app.post('/api/salespersons', ah(async (req: Request, res: Response) => {
    const db = getDb();
    const id = uuidv4();
    const { name, email, phone } = req.body;
    await db.run(`INSERT INTO SalesPerson (id, name, email, phone) VALUES (?, ?, ?, ?)`, [id, name, email, phone]);
    res.status(201).json(await db.get('SELECT * FROM SalesPerson WHERE id = ?', id));
  }));

  app.delete('/api/salespersons/:id', ah(async (req: Request, res: Response) => {
    await getDb().run('DELETE FROM SalesPerson WHERE id = ?', req.params.id);
    res.json({ success: true });
  }));
}
