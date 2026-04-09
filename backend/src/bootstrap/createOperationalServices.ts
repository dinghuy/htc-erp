import type { Request } from 'express';
import { createVcbExchangeRateServices } from '../shared/exchange-rate/vcb';
import { createActivityServices } from '../shared/activity/service';
import { createCollaborationServices } from '../modules/collaboration/service';
import { createTaskServices } from '../modules/tasks/service';
import { createProjectOrchestrationServices } from '../modules/projects/orchestration';
import { createProjectWorkspaceServices } from '../modules/projects/workspace';
import { createNotificationServices } from '../shared/notifications/service';
import { createQuotationAutomationServices } from '../modules/quotations/automation';

type CreateOperationalServicesDeps = {
  getDb: () => any;
  createId: () => string;
  supportTicketStatuses: readonly string[];
  projectStageValues: readonly string[];
  taskTemplateLibrary: Record<string, Array<{ name: string; taskType: string; department: string; priority: string; dueInDays: number; description: string }>>;
  approvalTemplateLibrary: Record<string, Array<{ requestType: string; title: string; department: string; approverRole: string; dueInDays: number }>>;
  documentTemplateLibrary: Record<string, Array<{ documentCode: string; documentName: string; category: string; department: string; requiredAtStage: string }>>;
};

export type PlatformReportingServices = {
  getStats: () => Promise<any>;
  searchCatalog: (query: string) => Promise<{ accounts: any[]; leads: any[]; products: any[]; quotations: any[] }>;
  getRevenueReport: () => Promise<any[]>;
  getFunnelReport: () => Promise<Array<{ label: string; value: number; color: string }>>;
  getOpsSummary: () => Promise<any>;
  getHandoffActivationReport: () => Promise<any>;
};

export type PlatformWorkspaceServices = {
  getHomeSummary: (userId: number | string, globalAccess: boolean) => Promise<any>;
  listHighlights: (userId: number | string, globalAccess: boolean, currentUser?: any) => Promise<any[]>;
  listApprovals: (userId: number | string, globalAccess: boolean, limit?: number) => Promise<any[]>;
  getMyWork: (userId: number | string, globalAccess: boolean) => Promise<{ tasks: any[]; approvals: any[]; projects: any[] }>;
  getInboxItems: (userId: number | string, globalAccess: boolean) => Promise<{ documentItems: any[]; notificationItems: any[]; blockedTasks: any[] }>;
};

export function createOperationalServices(deps: CreateOperationalServicesDeps) {
  const {
    getDb,
    createId,
    supportTicketStatuses,
    projectStageValues,
    taskTemplateLibrary,
    approvalTemplateLibrary,
    documentTemplateLibrary,
  } = deps;

  let vcbExchangeRateServicesCache: ReturnType<typeof createVcbExchangeRateServices> | null = null;
  let activityServicesCache: ReturnType<typeof createActivityServices> | null = null;
  let taskServicesCache: ReturnType<typeof createTaskServices> | null = null;
  let collaborationServicesCache: ReturnType<typeof createCollaborationServices> | null = null;
  let projectOrchestrationServicesCache: ReturnType<typeof createProjectOrchestrationServices> | null = null;
  let projectWorkspaceServicesCache: ReturnType<typeof createProjectWorkspaceServices> | null = null;
  let notificationServicesCache: ReturnType<typeof createNotificationServices> | null = null;
  let quotationAutomationServicesCache: ReturnType<typeof createQuotationAutomationServices> | null = null;

  function getVcbExchangeRateServices() {
    if (!vcbExchangeRateServicesCache) {
      vcbExchangeRateServicesCache = createVcbExchangeRateServices({ getDb, createId });
    }
    return vcbExchangeRateServicesCache;
  }

  function getActivityServices() {
    if (!activityServicesCache) {
      activityServicesCache = createActivityServices({ getDb, createId });
    }
    return activityServicesCache;
  }

  function getTaskServices() {
    if (!taskServicesCache) {
      taskServicesCache = createTaskServices();
    }
    return taskServicesCache;
  }

  function getCollaborationServices() {
    if (!collaborationServicesCache) {
      collaborationServicesCache = createCollaborationServices({ supportTicketStatuses });
    }
    return collaborationServicesCache;
  }

  function normalizeProjectStage(value: unknown, fallback = 'new') {
    const stage = typeof value === 'string' ? value.trim().toLowerCase() : '';
    return projectStageValues.includes(stage) ? stage : fallback;
  }

  function getProjectWorkspaceServices() {
    if (!projectWorkspaceServicesCache) {
      projectWorkspaceServicesCache = createProjectWorkspaceServices({
        projectHubText,
        projectHubNumber,
        parseProjectHubJson,
      });
    }
    return projectWorkspaceServicesCache;
  }

  function getNotificationServices() {
    if (!notificationServicesCache) {
      notificationServicesCache = createNotificationServices({
        allowedEntityTypes: ['Task', 'Quotation', 'Account', 'Lead', 'SupportTicket'],
        allowedLinks: ['Sales', 'Tasks', 'Accounts', 'Leads', 'Projects', 'Ops Overview', 'Ops Chat', 'Support'],
      });
    }
    return notificationServicesCache;
  }

  const logAct = (...args: Parameters<ReturnType<typeof createActivityServices>['logAct']>) =>
    getActivityServices().logAct(...args);

  function resolveAssigneeId(db: any, preferredAssigneeId: unknown, salesperson: unknown, fallbackUserId: number | string | null) {
    return getTaskServices().resolveAssigneeId(db, preferredAssigneeId, salesperson, fallbackUserId);
  }

  function getTaskWithLinksById(db: any, id: number | string) {
    return getTaskServices().getTaskWithLinksById(db, id);
  }

  function getProjectOrchestrationServices() {
    if (!projectOrchestrationServicesCache) {
      projectOrchestrationServicesCache = createProjectOrchestrationServices({
        TASK_TEMPLATE_LIBRARY: taskTemplateLibrary,
        APPROVAL_TEMPLATE_LIBRARY: approvalTemplateLibrary,
        DOCUMENT_TEMPLATE_LIBRARY: documentTemplateLibrary,
        resolveAssigneeId,
        getTaskWithLinksById,
        normalizeProjectStage,
      });
    }
    return projectOrchestrationServicesCache;
  }

  function ensureNotification(
    db: any,
    userId: number | string | null,
    content: string,
    meta: { entityType?: string | null; entityId?: number | string | null; link?: string | null } = {}
  ) {
    return getNotificationServices().ensureNotification(db, userId, content, meta);
  }

  function getQuotationAutomationServices() {
    if (!quotationAutomationServicesCache) {
      quotationAutomationServicesCache = createQuotationAutomationServices({
        ensureNotification,
        resolveAssigneeId,
        getTaskWithLinksById,
        logAct,
      });
    }
    return quotationAutomationServicesCache;
  }

  function getCurrentUserId(req: Request) {
    return (req as any).user?.id || null;
  }

  const appendDateRangeFilter = (conditions: string[], params: any[], column: string, from: unknown, to: unknown) => {
    const start = typeof from === 'string' ? from.trim() : '';
    const end = typeof to === 'string' ? to.trim() : '';
    if (start) {
      conditions.push(`${column} >= ?`);
      params.push(start);
    }
    if (end) {
      conditions.push(`${column} <= ?`);
      params.push(end);
    }
  };

  function projectHubText(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function projectHubNumber(value: unknown, fallback = 0) {
    const next = Number(value);
    return Number.isFinite(next) ? next : fallback;
  }

  function parseProjectHubJson<T>(value: unknown, fallback: T): T {
    if (typeof value !== 'string' || !value.trim()) return fallback;
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }

  function buildWorkspaceProjectAggregateCtes(options: { includeScope: boolean }) {
    const ctes = [
      `task_project_rollups AS (
        SELECT
          projectId,
          SUM(CASE WHEN status != 'completed' THEN 1 ELSE 0 END) AS openTaskCount,
          SUM(CASE WHEN taskType = 'handoff' AND status != 'completed' THEN 1 ELSE 0 END) AS handoffPending,
          SUM(CASE WHEN blockedReason IS NOT NULL AND trim(blockedReason) != '' AND status != 'completed' THEN 1 ELSE 0 END) AS blockers
        FROM Task
        WHERE projectId IS NOT NULL
        GROUP BY projectId
      )`,
      `approval_project_rollups AS (
        SELECT
          projectId,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pendingApprovalCount,
          SUM(CASE WHEN department = 'Finance' AND status = 'pending' THEN 1 ELSE 0 END) AS receivableRisk,
          SUM(CASE WHEN department = 'Legal' AND status = 'pending' THEN 1 ELSE 0 END) AS legalPending
        FROM ApprovalRequest
        WHERE projectId IS NOT NULL
        GROUP BY projectId
      )`,
      `document_project_rollups AS (
        SELECT
          projectId,
          SUM(CASE WHEN status IN ('missing', 'requested') THEN 1 ELSE 0 END) AS missingDocumentCount
        FROM ProjectDocument
        WHERE projectId IS NOT NULL
        GROUP BY projectId
      )`,
      `procurement_project_rollups AS (
        SELECT
          projectId,
          SUM(CASE WHEN shortageQty > 0 THEN 1 ELSE 0 END) AS shortages,
          SUM(CASE WHEN etaDate IS NOT NULL AND date(etaDate) < date('now') AND COALESCE(receivedQty, 0) < CASE WHEN COALESCE(orderedQty, 0) > COALESCE(contractQty, 0) THEN COALESCE(orderedQty, 0) ELSE COALESCE(contractQty, 0) END THEN 1 ELSE 0 END) AS overdueEta,
          SUM(CASE WHEN orderedQty < contractQty THEN 1 ELSE 0 END) AS procurementPending
        FROM ProjectProcurementLine
        WHERE projectId IS NOT NULL
          AND COALESCE(isActive, 1) = 1
        GROUP BY projectId
      )`,
      `sales_order_project_rollups AS (
        SELECT
          q.projectId AS projectId,
          SUM(CASE WHEN so.status = 'processing' THEN 1 ELSE 0 END) AS paymentDue
        FROM SalesOrder so
        LEFT JOIN Quotation q ON q.id = so.quotationId
        WHERE q.projectId IS NOT NULL
        GROUP BY q.projectId
      )`,
      `erp_project_rollups AS (
        SELECT
          entityId AS projectId,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS erpFailed
        FROM ErpOutbox
        WHERE entityId IS NOT NULL
        GROUP BY entityId
      )`,
    ];

    if (options.includeScope) {
      ctes.unshift(`workspace_project_scope AS (
        SELECT id AS projectId
        FROM Project
        WHERE managerId = ?
        UNION
        SELECT projectId
        FROM Task
        WHERE assigneeId = ? AND projectId IS NOT NULL
        UNION
        SELECT projectId
        FROM ApprovalRequest
        WHERE projectId IS NOT NULL AND (requestedBy = ? OR approverUserId = ?)
      )`);
    }

    return `WITH ${ctes.join(',\n')}`;
  }

  function buildWorkspaceProjectScopeCte() {
    return `WITH workspace_project_scope AS (
      SELECT id AS projectId
      FROM Project
      WHERE managerId = ?
      UNION
      SELECT projectId
      FROM Task
      WHERE assigneeId = ? AND projectId IS NOT NULL
      UNION
      SELECT projectId
      FROM ApprovalRequest
      WHERE projectId IS NOT NULL AND (requestedBy = ? OR approverUserId = ?)
    )`;
  }

  async function queryWorkspaceHighlights(userId: string, globalAccess = false) {
    const db = getDb();
    const ctes = buildWorkspaceProjectAggregateCtes({ includeScope: !globalAccess });
    const sharedSelect = `
      SELECT
        p.id AS projectId,
        p.code AS projectCode,
        p.name AS projectName,
        p.projectStage,
        p.status AS projectStatus,
        a.companyName AS accountName,
        COALESCE(tpr.openTaskCount, 0) AS openTaskCount,
        COALESCE(apr.pendingApprovalCount, 0) AS pendingApprovalCount,
        COALESCE(dpr.missingDocumentCount, 0) AS missingDocumentCount
      FROM Project p
      LEFT JOIN Account a ON a.id = p.accountId
      LEFT JOIN task_project_rollups tpr ON tpr.projectId = p.id
      LEFT JOIN approval_project_rollups apr ON apr.projectId = p.id
      LEFT JOIN document_project_rollups dpr ON dpr.projectId = p.id
    `;

    if (globalAccess) {
      return db.all(
        `
          ${ctes}
          ${sharedSelect}
          ORDER BY COALESCE(p.updatedAt, p.createdAt) DESC
          LIMIT 8
        `,
      );
    }

    return db.all(
      `
        ${ctes}
        ${sharedSelect}
        INNER JOIN workspace_project_scope wps ON wps.projectId = p.id
        ORDER BY COALESCE(p.updatedAt, p.createdAt) DESC
        LIMIT 8
      `,
      [userId, userId, userId, userId],
    );
  }

  async function queryWorkspaceApprovals(userId: string, globalAccess = false, limit = 50) {
    const db = getDb();
    return db.all(
      `
        SELECT
          ar.*,
          p.name AS projectName,
          p.code AS projectCode,
          q.quoteNumber AS quotationNumber,
          approver.fullName AS approverName,
          requester.fullName AS requestedByName
        FROM ApprovalRequest ar
        LEFT JOIN Project p ON p.id = ar.projectId
        LEFT JOIN Quotation q ON q.id = ar.quotationId
        LEFT JOIN User approver ON approver.id = ar.approverUserId
        LEFT JOIN User requester ON requester.id = ar.requestedBy
        ${globalAccess ? '' : 'WHERE ar.approverUserId = ? OR ar.requestedBy = ?'}
        ORDER BY CASE WHEN ar.status = 'pending' THEN 0 ELSE 1 END, ar.dueDate ASC, ar.createdAt DESC
        LIMIT ${Math.max(1, Math.floor(limit))}
      `,
      globalAccess ? [] : [userId, userId],
    );
  }

  const platformWorkspaceServices: PlatformWorkspaceServices = {
    async getHomeSummary(userId: string, globalAccess: boolean) {
      const db = getDb();
      const ctes = buildWorkspaceProjectAggregateCtes({ includeScope: !globalAccess });
      return db.get(
        `
          ${ctes}
          SELECT
            SUM(CASE WHEN p.status = 'active' THEN 1 ELSE 0 END) AS activeProjects,
            SUM(COALESCE(tpr.handoffPending, 0)) AS handoffPending,
            SUM(COALESCE(tpr.blockers, 0)) AS blockers,
            SUM(COALESCE(apr.pendingApprovalCount, 0)) AS pendingApprovals,
            SUM(COALESCE(dpr.missingDocumentCount, 0)) AS missingDocuments,
            SUM(COALESCE(ppr.shortages, 0)) AS shortages,
            SUM(COALESCE(ppr.overdueEta, 0)) AS overdueEta,
            SUM(COALESCE(ppr.procurementPending, 0)) AS procurementPending,
            SUM(COALESCE(sopr.paymentDue, 0)) AS paymentDue,
            SUM(COALESCE(epr.erpFailed, 0)) AS erpFailed,
            SUM(COALESCE(apr.receivableRisk, 0)) AS receivableRisk,
            SUM(COALESCE(apr.legalPending, 0)) AS legalPending,
            SUM(
              CASE
                WHEN p.projectStage IN ('won', 'order_released', 'procurement_active', 'delivery_active', 'delivery', 'delivery_completed')
                  AND (COALESCE(apr.pendingApprovalCount, 0) > 0 OR COALESCE(dpr.missingDocumentCount, 0) > 0)
                THEN 1
                ELSE 0
              END
            ) AS executiveRiskProjects
          FROM Project p
          LEFT JOIN task_project_rollups tpr ON tpr.projectId = p.id
          LEFT JOIN approval_project_rollups apr ON apr.projectId = p.id
          LEFT JOIN document_project_rollups dpr ON dpr.projectId = p.id
          LEFT JOIN procurement_project_rollups ppr ON ppr.projectId = p.id
          LEFT JOIN sales_order_project_rollups sopr ON sopr.projectId = p.id
          LEFT JOIN erp_project_rollups epr ON epr.projectId = p.id
          ${globalAccess ? '' : 'INNER JOIN workspace_project_scope wps ON wps.projectId = p.id'}
        `,
        globalAccess ? [] : [userId, userId, userId, userId],
      ).catch(() => ({
        handoffPending: 0,
        activeProjects: 0,
        blockers: 0,
        pendingApprovals: 0,
        missingDocuments: 0,
        shortages: 0,
        overdueEta: 0,
        procurementPending: 0,
        paymentDue: 0,
        erpFailed: 0,
        receivableRisk: 0,
        legalPending: 0,
        executiveRiskProjects: 0,
      }));
    },
    async listHighlights(userId: string, globalAccess: boolean, currentUser?: any) {
      const db = getDb();
      const highlights = await queryWorkspaceHighlights(userId, globalAccess);
      if (!currentUser) return highlights;
      return Promise.all((Array.isArray(highlights) ? highlights : []).map(async (highlight) => {
        const projectId = String(highlight?.projectId || '').trim();
        if (!projectId) return highlight;
        const workspace = await getProjectWorkspaceServices().getProjectWorkspaceById(db, projectId, currentUser).catch(() => null);
        return {
          ...highlight,
          approvalGateStates: Array.isArray(workspace?.approvalGateStates) ? workspace.approvalGateStates : [],
          actionAvailability: workspace?.actionAvailability || null,
          handoffActivation: workspace?.handoffActivation || null,
          pendingApproverState: Array.isArray(workspace?.pendingApproverState) ? workspace.pendingApproverState : [],
        };
      }));
    },
    listApprovals(userId: string, globalAccess: boolean, limit = 50) {
      return queryWorkspaceApprovals(userId, globalAccess, limit);
    },
    async getMyWork(userId: string, globalAccess: boolean) {
      const db = getDb();
      const [tasks, approvals, projects] = await Promise.all([
        db.all(
          `
            SELECT
              t.*,
              p.name AS projectName,
              p.code AS projectCode,
              p.projectStage,
              q.quoteNumber AS quotationNumber
            FROM Task t
            LEFT JOIN Project p ON p.id = t.projectId
            LEFT JOIN Quotation q ON q.id = t.quotationId
            ${globalAccess ? '' : 'WHERE t.assigneeId = ?'}
            ORDER BY
              CASE WHEN t.status = 'active' THEN 0 WHEN t.status = 'pending' THEN 1 ELSE 2 END,
              CASE WHEN t.dueDate IS NULL THEN 1 ELSE 0 END,
              t.dueDate ASC,
              t.createdAt DESC
            LIMIT 24
          `,
          globalAccess ? [] : [userId],
        ),
        queryWorkspaceApprovals(userId, globalAccess, 24),
        queryWorkspaceHighlights(userId, globalAccess),
      ]);

      return { tasks, approvals, projects };
    },
    async getInboxItems(userId: string, globalAccess: boolean) {
      const db = getDb();
      const [documentItems, notificationItems, blockedTasks] = await Promise.all([
        db.all(
          `
            ${globalAccess ? '' : `${buildWorkspaceProjectScopeCte()}`}
            SELECT
              pd.id AS entityId,
              'ProjectDocument' AS entityType,
              pd.documentName AS title,
              pd.status,
              pd.department,
              pd.requiredAtStage,
              pd.updatedAt AS createdAt,
              p.id AS projectId,
              p.name AS projectName
            FROM ProjectDocument pd
            INNER JOIN Project p ON p.id = pd.projectId
            ${globalAccess ? '' : 'INNER JOIN workspace_project_scope wps ON wps.projectId = p.id'}
            WHERE pd.status IN ('missing', 'requested')
            ORDER BY pd.updatedAt DESC, pd.createdAt DESC
            LIMIT 20
          `,
          globalAccess ? [] : [userId, userId, userId, userId],
        ),
        db.all(
          `
            SELECT
              n.id AS entityId,
              COALESCE(n.entityType, 'Notification') AS entityType,
              n.content AS title,
              n.link,
              n.createdAt
            FROM Notification n
            WHERE n.userId = ?
            ORDER BY n.createdAt DESC
            LIMIT 20
          `,
          [userId],
        ),
        db.all(
          `
            SELECT
              t.id AS entityId,
              'Task' AS entityType,
              t.name AS title,
              t.blockedReason AS description,
              t.updatedAt AS createdAt,
              p.id AS projectId,
              p.name AS projectName
            FROM Task t
            LEFT JOIN Project p ON p.id = t.projectId
            WHERE ${globalAccess ? '1 = 1 AND' : 't.assigneeId = ? AND'} t.blockedReason IS NOT NULL
              AND trim(t.blockedReason) != ''
              AND t.status != 'completed'
            ORDER BY t.updatedAt DESC, t.createdAt DESC
            LIMIT 20
          `,
          globalAccess ? [] : [userId],
        ),
      ]);

      return { documentItems, notificationItems, blockedTasks };
    },
  };

  const platformReportingServices: PlatformReportingServices = {
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

  return {
    parseExchangeRatePair: (pairRaw: unknown) => getVcbExchangeRateServices().parseExchangeRatePair(pairRaw),
    getLatestExchangeRatePayload: (baseCurrency: string, quoteCurrency: string) => getVcbExchangeRateServices().getLatestExchangeRatePayload(baseCurrency, quoteCurrency),
    refreshVcbRates: () => getVcbExchangeRateServices().refreshVcbRates(),
    scheduleDailyVcbRefresh: () => getVcbExchangeRateServices().scheduleDailyVcbRefresh(),
    listActivities: getActivityServices().listActivities,
    createActivity: getActivityServices().createActivity,
    logAct,
    getCurrentUserId,
    appendDateRangeFilter,
    resolveAssigneeId,
    getTaskWithLinksById,
    normalizeSupportTicketStatus: (value: unknown) => getCollaborationServices().normalizeSupportTicketStatus(value),
    getSupportTicketById: (db: any, id: string) => getCollaborationServices().getSupportTicketById(db, id),
    autoCreateProjectForQuotation: (db: any, payload: any, actorUserId: string | null) => getProjectOrchestrationServices().autoCreateProjectForQuotation(db, payload, actorUserId),
    createProjectTasksFromTemplate: (db: any, params: any) => getProjectOrchestrationServices().createProjectTasksFromTemplate(db, params),
    createApprovalRequestsFromTemplate: (db: any, params: any) => getProjectOrchestrationServices().createApprovalRequestsFromTemplate(db, params),
    createProjectDocumentsFromTemplate: (db: any, params: any) => getProjectOrchestrationServices().createProjectDocumentsFromTemplate(db, params),
    createSalesOrderFromQuotation: (db: any, quotationId: string) => getProjectOrchestrationServices().createSalesOrderFromQuotation(db, quotationId),
    resolveProjectHandoffQuotation: (db: any, projectId: string, preferredQuotationId?: string | null) => getProjectOrchestrationServices().resolveProjectHandoffQuotation(db, projectId, preferredQuotationId),
    projectHubText,
    projectHubNumber,
    parseProjectHubJson,
    normalizeContractLineItems: (items: any[] = []) => getProjectWorkspaceServices().normalizeContractLineItems(items),
    mapProjectContractRow: (row: any) => getProjectWorkspaceServices().mapProjectContractRow(row),
    mapProjectAppendixRow: (row: any) => getProjectWorkspaceServices().mapProjectAppendixRow(row),
    mapProjectInboundLineRow: (row: any) => getProjectWorkspaceServices().mapProjectInboundLineRow(row),
    mapProjectDeliveryLineRow: (row: any) => getProjectWorkspaceServices().mapProjectDeliveryLineRow(row),
    createProjectTimelineEvent: (db: any, event: any) => getProjectWorkspaceServices().createProjectTimelineEvent(db, event),
    recalculateProjectProcurementRollup: (db: any, procurementLineId: string) => getProjectWorkspaceServices().recalculateProjectProcurementRollup(db, procurementLineId),
    createExecutionBaselineFromSource: (db: any, params: any) => getProjectWorkspaceServices().createExecutionBaselineFromSource(db, params),
    getProjectWorkspaceById: (db: any, projectId: string, currentUser?: any) => getProjectWorkspaceServices().getProjectWorkspaceById(db, projectId, currentUser),
    ensureNotification,
    platformReportingServices,
    platformWorkspaceServices,
    triggerQuotationAutomation: (db: any, quotation: any, status: 'submitted_for_approval' | 'won', actorUserId: string | null, extra: { triggerSource?: string; projectId?: string | null; leadId?: string | null } = {}) =>
      getQuotationAutomationServices().triggerQuotationAutomation(db, quotation, status, actorUserId, extra),
  };
}
