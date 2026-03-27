import type { Express, Request, Response } from 'express';
import { getDb } from '../../../sqlite-db';

type AsyncRouteFactory = (handler: (req: Request, res: Response) => Promise<unknown>) => any;

type RegisterPlatformReportingRoutesDeps = {
  ah: AsyncRouteFactory;
};

export function registerPlatformReportingRoutes(app: Express, deps: RegisterPlatformReportingRoutesDeps) {
  const { ah } = deps;

  app.get('/api/stats', ah(async (_req: Request, res: Response) => {
    const db = getDb();
    const thisMonthStart = new Date();
    thisMonthStart.setDate(1);
    thisMonthStart.setHours(0, 0, 0, 0);
    const tsMonth = thisMonthStart.toISOString();

    const [accounts, leads, products, suppliers, supplierQuotes, quotations,
      newAccounts, newLeads, activeQuotations, wonLeads,
      pipeline, wonQuotes, projects, tasks, activeTasks,
      erpOutbox] = await Promise.all([
      db.get("SELECT COUNT(*) as c FROM Account WHERE accountType = 'Customer'"),
      db.get('SELECT COUNT(*) as c FROM Lead'),
      db.get('SELECT COUNT(*) as c FROM Product'),
      db.get("SELECT COUNT(*) as c FROM Account WHERE accountType = 'Supplier'"),
      db.get('SELECT COUNT(*) as c FROM SupplierQuote'),
      db.get('SELECT COUNT(*) as c FROM Quotation'),
      db.get("SELECT COUNT(*) as c FROM Account WHERE accountType = 'Customer' AND createdAt >= ?", tsMonth),
      db.get('SELECT COUNT(*) as c FROM Lead WHERE createdAt >= ?', tsMonth),
      db.get("SELECT COUNT(*) as c FROM Quotation WHERE status IN ('draft','sent')"),
      db.get("SELECT COUNT(*) as c FROM Lead WHERE status = 'Won'"),
      db.get("SELECT SUM(grandTotal) as s FROM Quotation WHERE status != 'rejected'"),
      db.get("SELECT COUNT(*) as c FROM Quotation WHERE status = 'accepted'"),
      db.get('SELECT COUNT(*) as c FROM Project'),
      db.get('SELECT COUNT(*) as c FROM Task'),
      db.get("SELECT COUNT(*) as c FROM Task WHERE status = 'active'"),
      db.get(`
        SELECT
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
        FROM ErpOutbox
      `).catch(() => ({ pending: 0, failed: 0 })),
    ]);

    const totalQuotes = quotations?.c ?? 0;
    const winRate = totalQuotes > 0 ? Math.round(((wonQuotes?.c ?? 0) / totalQuotes) * 100) : 0;

    res.json({
      accounts: accounts?.c ?? 0,
      leads: leads?.c ?? 0,
      products: products?.c ?? 0,
      suppliers: suppliers?.c ?? 0,
      supplierQuotes: supplierQuotes?.c ?? 0,
      quotations: totalQuotes,
      newAccountsThisMonth: newAccounts?.c ?? 0,
      newLeadsThisMonth: newLeads?.c ?? 0,
      activeQuotations: activeQuotations?.c ?? 0,
      wonLeads: wonLeads?.c ?? 0,
      pipelineValue: pipeline?.s ?? 0,
      wonDealsCount: wonQuotes?.c ?? 0,
      winRate,
      projects: projects?.c ?? 0,
      tasks: tasks?.c ?? 0,
      activeTasks: activeTasks?.c ?? 0,
      erpOutboxPending: Number((erpOutbox as any)?.pending ?? 0),
      erpOutboxFailed: Number((erpOutbox as any)?.failed ?? 0),
    });
  }));

  app.get('/api/search', ah(async (req: Request, res: Response) => {
    const q = req.query.q as string;
    if (!q || q.length < 2) return res.json({ accounts: [], leads: [], products: [], quotations: [] });
    const db = getDb();
    const p = `%${q}%`;

    const [accs, lds, prds, qts] = await Promise.all([
      db.all("SELECT id, companyName as title, 'Account' as type FROM Account WHERE companyName LIKE ? OR taxCode LIKE ? LIMIT 5", [p, p]),
      db.all("SELECT id, companyName as title, contactName, 'Lead' as type FROM Lead WHERE companyName LIKE ? OR contactName LIKE ? LIMIT 5", [p, p]),
      db.all("SELECT id, name as title, sku, 'Product' as type FROM Product WHERE name LIKE ? OR sku LIKE ? LIMIT 5", [p, p]),
      db.all("SELECT id, quoteNumber as title, subject, 'Quotation' as type FROM Quotation WHERE quoteNumber LIKE ? OR subject LIKE ? LIMIT 5", [p, p]),
    ]);

    res.json({ accounts: accs, leads: lds, products: prds, quotations: qts });
  }));

  app.get('/api/reports/revenue', ah(async (_req: Request, res: Response) => {
    const db = getDb();
    const rows = await db.all(`
      SELECT strftime('%Y-%m', createdAt) as month, SUM(grandTotal) as total
      FROM Quotation
      WHERE status = 'accepted'
      GROUP BY month ORDER BY month DESC LIMIT 6
    `);
    res.json(rows.reverse());
  }));

  app.get('/api/reports/funnel', ah(async (_req: Request, res: Response) => {
    const db = getDb();
    const [leads, qualified, proposal, won] = await Promise.all([
      db.get("SELECT COUNT(*) as c FROM Lead"),
      db.get("SELECT COUNT(*) as c FROM Lead WHERE status != 'New'"),
      db.get("SELECT COUNT(*) as c FROM Quotation"),
      db.get("SELECT COUNT(*) as c FROM Quotation WHERE status = 'accepted'"),
    ]);
    res.json([
      { label: 'Leads', value: leads.c, color: '#1e293b' },
      { label: 'Qualified', value: qualified.c, color: '#334155' },
      { label: 'Proposal', value: proposal.c, color: '#009b6e' },
      { label: 'Won', value: won.c, color: '#16a34a' },
    ]);
  }));

  app.get('/api/ops/summary', ah(async (_req: Request, res: Response) => {
    const db = getDb();
    const [projectStats, taskStats, topAssignees, recentProjects, recentTasks, erpStats] = await Promise.all([
      db.get(`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
          SUM(CASE WHEN status = 'paused' THEN 1 ELSE 0 END) AS paused,
          SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled
        FROM Project
      `),
      db.get(`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
          SUM(CASE WHEN status = 'paused' THEN 1 ELSE 0 END) AS paused,
          SUM(CASE WHEN dueDate IS NOT NULL AND date(dueDate) < date('now') AND status != 'completed' THEN 1 ELSE 0 END) AS overdue,
          SUM(CASE WHEN dueDate IS NOT NULL AND date(dueDate) BETWEEN date('now') AND date('now', '+7 day') AND status != 'completed' THEN 1 ELSE 0 END) AS dueSoon,
          AVG(COALESCE(completionPct, 0)) AS avgCompletionPct
        FROM Task
      `),
      db.all(`
        SELECT
          t.assigneeId,
          COALESCE(u.fullName, 'Unassigned') AS assigneeName,
          COUNT(*) AS taskCount,
          SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) AS completedCount,
          SUM(CASE WHEN t.status = 'active' THEN 1 ELSE 0 END) AS activeCount,
          SUM(CASE WHEN t.dueDate IS NOT NULL AND date(t.dueDate) < date('now') AND t.status != 'completed' THEN 1 ELSE 0 END) AS overdueCount,
          AVG(COALESCE(t.completionPct, 0)) AS avgCompletionPct
        FROM Task t
        LEFT JOIN User u ON t.assigneeId = u.id
        GROUP BY t.assigneeId, u.fullName
        ORDER BY taskCount DESC, overdueCount DESC, avgCompletionPct DESC
        LIMIT 5
      `),
      db.all(`
        SELECT p.*,
               u.fullName AS managerName,
               a.companyName AS accountName,
               (SELECT COUNT(*) FROM Task t WHERE t.projectId = p.id) AS taskCount
        FROM Project p
        LEFT JOIN User u ON p.managerId = u.id
        LEFT JOIN Account a ON p.accountId = a.id
        ORDER BY p.createdAt DESC
        LIMIT 5
      `),
      db.all(`
        SELECT t.*,
               u.fullName AS assigneeName,
               p.name AS projectName,
               a.companyName AS accountName
        FROM Task t
        LEFT JOIN User u ON t.assigneeId = u.id
        LEFT JOIN Project p ON t.projectId = p.id
        LEFT JOIN Account a ON t.accountId = a.id
        ORDER BY t.createdAt DESC
        LIMIT 8
      `),
      db.get(`
        SELECT
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
          SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent
        FROM ErpOutbox
      `).catch(() => ({ pending: 0, failed: 0, sent: 0 })),
    ]);

    const projectTotal = Number((projectStats as any)?.total ?? 0);
    const taskTotal = Number((taskStats as any)?.total ?? 0);
    const completedProjects = Number((projectStats as any)?.completed ?? 0);
    const completedTasks = Number((taskStats as any)?.completed ?? 0);

    res.json({
      projects: {
        total: projectTotal,
        pending: Number((projectStats as any)?.pending ?? 0),
        active: Number((projectStats as any)?.active ?? 0),
        completed: completedProjects,
        paused: Number((projectStats as any)?.paused ?? 0),
        cancelled: Number((projectStats as any)?.cancelled ?? 0),
        completionRate: projectTotal > 0 ? Math.round((completedProjects / projectTotal) * 100) : 0,
      },
      tasks: {
        total: taskTotal,
        pending: Number((taskStats as any)?.pending ?? 0),
        active: Number((taskStats as any)?.active ?? 0),
        completed: completedTasks,
        paused: Number((taskStats as any)?.paused ?? 0),
        overdue: Number((taskStats as any)?.overdue ?? 0),
        dueSoon: Number((taskStats as any)?.dueSoon ?? 0),
        avgCompletionPct: Math.round(Number((taskStats as any)?.avgCompletionPct ?? 0)),
        completionRate: taskTotal > 0 ? Math.round((completedTasks / taskTotal) * 100) : 0,
      },
      workload: {
        topAssignees,
      },
      recentProjects,
      recentTasks,
      erp: {
        pending: Number((erpStats as any)?.pending ?? 0),
        failed: Number((erpStats as any)?.failed ?? 0),
        sent: Number((erpStats as any)?.sent ?? 0),
      },
    });
  }));
}
