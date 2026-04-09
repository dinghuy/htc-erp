export type PlatformReportingServices = {
  getStats: () => Promise<any>;
  searchCatalog: (query: string) => Promise<{ accounts: any[]; leads: any[]; products: any[]; quotations: any[] }>;
  getRevenueReport: () => Promise<any[]>;
  getFunnelReport: () => Promise<Array<{ label: string; value: number; color: string }>>;
  getOpsSummary: () => Promise<any>;
  getHandoffActivationReport: () => Promise<any>;
};

export function createPlatformReportingServices(deps: { getDb: () => any }): PlatformReportingServices {
  const { getDb } = deps;
  return {
    async getStats() {
      const db = getDb();
      const thisMonthStart = new Date();
      thisMonthStart.setDate(1);
      thisMonthStart.setHours(0, 0, 0, 0);
      const tsMonth = thisMonthStart.toISOString();

      const [accountStats, leadStats, productStats, supplierQuoteStats, quotationStats, projectStats, taskStats,
        erpOutbox] = await Promise.all([
        db.get(
          `SELECT
             SUM(CASE WHEN accountType = 'Customer' THEN 1 ELSE 0 END) AS customerCount,
             SUM(CASE WHEN accountType = 'Customer' AND createdAt >= ? THEN 1 ELSE 0 END) AS newCustomerCount,
             SUM(CASE WHEN accountType = 'Supplier' THEN 1 ELSE 0 END) AS supplierCount
           FROM Account`,
          [tsMonth]
        ),
        db.get(
          `SELECT
             COUNT(*) AS total,
             SUM(CASE WHEN createdAt >= ? THEN 1 ELSE 0 END) AS newCount,
             SUM(CASE WHEN status = 'Won' THEN 1 ELSE 0 END) AS wonCount
           FROM Lead`,
          [tsMonth]
        ),
        db.get('SELECT COUNT(*) AS total FROM Product'),
        db.get('SELECT COUNT(*) AS total FROM SupplierQuote'),
        db.get(
          `SELECT
             COUNT(*) AS total,
             SUM(CASE WHEN status IN ('draft', 'sent') THEN 1 ELSE 0 END) AS activeCount,
             SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) AS acceptedCount,
             SUM(CASE WHEN status != 'rejected' THEN COALESCE(grandTotal, 0) ELSE 0 END) AS pipelineValue
           FROM Quotation`
        ),
        db.get('SELECT COUNT(*) AS total FROM Project'),
        db.get(
          `SELECT
             COUNT(*) AS total,
             SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS activeCount
           FROM Task`
        ),
        db.get(`
          SELECT
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
          FROM ErpOutbox
        `).catch(() => ({ pending: 0, failed: 0 })),
      ]);

      const totalQuotes = Number((quotationStats as any)?.total ?? 0);
      const wonDealsCount = Number((quotationStats as any)?.acceptedCount ?? 0);
      const winRate = totalQuotes > 0 ? Math.round((wonDealsCount / totalQuotes) * 100) : 0;

      return {
        accounts: Number((accountStats as any)?.customerCount ?? 0),
        leads: Number((leadStats as any)?.total ?? 0),
        products: Number((productStats as any)?.total ?? 0),
        suppliers: Number((accountStats as any)?.supplierCount ?? 0),
        supplierQuotes: Number((supplierQuoteStats as any)?.total ?? 0),
        quotations: totalQuotes,
        newAccountsThisMonth: Number((accountStats as any)?.newCustomerCount ?? 0),
        newLeadsThisMonth: Number((leadStats as any)?.newCount ?? 0),
        activeQuotations: Number((quotationStats as any)?.activeCount ?? 0),
        wonLeads: Number((leadStats as any)?.wonCount ?? 0),
        pipelineValue: Number((quotationStats as any)?.pipelineValue ?? 0),
        wonDealsCount,
        winRate,
        projects: Number((projectStats as any)?.total ?? 0),
        tasks: Number((taskStats as any)?.total ?? 0),
        activeTasks: Number((taskStats as any)?.activeCount ?? 0),
        erpOutboxPending: Number((erpOutbox as any)?.pending ?? 0),
        erpOutboxFailed: Number((erpOutbox as any)?.failed ?? 0),
      };
    },
    async searchCatalog(query: string) {
      if (!query || query.length < 2) return { accounts: [], leads: [], products: [], quotations: [] };

      const db = getDb();
      const pattern = `%${query}%`;
      const [accounts, leads, products, quotations] = await Promise.all([
        db.all("SELECT id, companyName as title, 'Account' as type FROM Account WHERE companyName LIKE ? OR taxCode LIKE ? LIMIT 5", [pattern, pattern]),
        db.all("SELECT id, companyName as title, contactName, 'Lead' as type FROM Lead WHERE companyName LIKE ? OR contactName LIKE ? LIMIT 5", [pattern, pattern]),
        db.all("SELECT id, name as title, sku, 'Product' as type FROM Product WHERE name LIKE ? OR sku LIKE ? LIMIT 5", [pattern, pattern]),
        db.all("SELECT id, quoteNumber as title, subject, 'Quotation' as type FROM Quotation WHERE quoteNumber LIKE ? OR subject LIKE ? LIMIT 5", [pattern, pattern]),
      ]);

      return { accounts, leads, products, quotations };
    },
    async getRevenueReport() {
      const db = getDb();
      const rows = await db.all(`
        SELECT strftime('%Y-%m', createdAt) as month, SUM(grandTotal) as total
        FROM Quotation
        WHERE status = 'accepted'
        GROUP BY month ORDER BY month DESC LIMIT 6
      `);
      return rows.reverse();
    },
    async getFunnelReport() {
      const db = getDb();
      const [leadStats, quotationStats] = await Promise.all([
        db.get(
          `SELECT
             COUNT(*) AS total,
             SUM(CASE WHEN status != 'New' THEN 1 ELSE 0 END) AS qualifiedCount
           FROM Lead`
        ),
        db.get(
          `SELECT
             COUNT(*) AS total,
             SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) AS wonCount
           FROM Quotation`
        ),
      ]);

      return [
        { label: 'Leads', value: Number((leadStats as any)?.total ?? 0), color: '#1e293b' },
        { label: 'Qualified', value: Number((leadStats as any)?.qualifiedCount ?? 0), color: '#334155' },
        { label: 'Proposal', value: Number((quotationStats as any)?.total ?? 0), color: '#009b6e' },
        { label: 'Won', value: Number((quotationStats as any)?.wonCount ?? 0), color: '#16a34a' },
      ];
    },
    async getOpsSummary() {
      const db = getDb();
      const recentProjectSummaryCte = `WITH project_task_counts AS (
        SELECT projectId, COUNT(*) AS taskCount
        FROM Task
        WHERE projectId IS NOT NULL
        GROUP BY projectId
      )`;
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
          ${recentProjectSummaryCte}
          SELECT p.*,
                 u.fullName AS managerName,
                 a.companyName AS accountName,
                 COALESCE(ptc.taskCount, 0) AS taskCount
          FROM Project p
          LEFT JOIN User u ON p.managerId = u.id
          LEFT JOIN Account a ON p.accountId = a.id
          LEFT JOIN project_task_counts ptc ON ptc.projectId = p.id
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

      return {
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
      };
    },
    async getHandoffActivationReport() {
      const db = getDb();
      const rows = await db.all(`
        WITH latest_start AS (
          SELECT
            projectId,
            MAX(COALESCE(eventDate, createdAt)) AS startedAt
          FROM ProjectTimelineEvent
          WHERE eventType = 'handoff_started'
          GROUP BY projectId
        ),
        first_activation AS (
          SELECT
            ls.projectId,
            MIN(COALESCE(pte.eventDate, pte.createdAt)) AS activatedAt
          FROM latest_start ls
          LEFT JOIN ProjectTimelineEvent pte
            ON pte.projectId = ls.projectId
           AND pte.eventType = 'handoff_activated'
           AND COALESCE(pte.eventDate, pte.createdAt) >= ls.startedAt
          GROUP BY ls.projectId
        )
        SELECT
          ls.projectId,
          p.code AS projectCode,
          p.name AS projectName,
          a.companyName AS accountName,
          q.quoteNumber AS quotationNumber,
          ls.startedAt,
          fa.activatedAt
        FROM latest_start ls
        LEFT JOIN first_activation fa ON fa.projectId = ls.projectId
        LEFT JOIN Project p ON p.id = ls.projectId
        LEFT JOIN Account a ON a.id = p.accountId
        LEFT JOIN Quotation q ON q.projectId = ls.projectId AND LOWER(IFNULL(q.status, '')) = 'won'
        ORDER BY ls.startedAt DESC
      `);

      const items = (Array.isArray(rows) ? rows : []).map((row: any) => {
        const startedMs = Date.parse(String(row.startedAt || ''));
        const activatedMs = Date.parse(String(row.activatedAt || ''));
        const elapsedMs = Number.isFinite(startedMs) && Number.isFinite(activatedMs) ? Math.max(activatedMs - startedMs, 0) : null;
        const withinSla = typeof elapsedMs === 'number' ? elapsedMs <= 4 * 60 * 60 * 1000 : false;
        return {
          projectId: row.projectId,
          projectCode: row.projectCode || null,
          projectName: row.projectName || null,
          accountName: row.accountName || null,
          quotationNumber: row.quotationNumber || null,
          startedAt: row.startedAt || null,
          activatedAt: row.activatedAt || null,
          elapsedMinutes: typeof elapsedMs === 'number' ? Math.round(elapsedMs / 60000) : null,
          withinSla,
          status: row.activatedAt ? (withinSla ? 'within_sla' : 'breached_sla') : 'pending_activation',
        };
      });

      return {
        summary: {
          totalStarted: items.length,
          activated: items.filter((item: any) => item.activatedAt).length,
          withinSla: items.filter((item: any) => item.status === 'within_sla').length,
          breachedSla: items.filter((item: any) => item.status === 'breached_sla').length,
          pendingActivation: items.filter((item: any) => item.status === 'pending_activation').length,
          slaHours: 4,
          clockMode: 'elapsed_hours',
        },
        items,
      };
    },
  };
}
