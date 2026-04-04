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
  getHomeSummary: (userId: string, globalAccess: boolean) => Promise<any>;
  listHighlights: (userId: string, globalAccess: boolean, currentUser?: any) => Promise<any[]>;
  listApprovals: (userId: string, globalAccess: boolean, limit?: number) => Promise<any[]>;
  getMyWork: (userId: string, globalAccess: boolean) => Promise<{ tasks: any[]; approvals: any[]; projects: any[] }>;
  getInboxItems: (userId: string, globalAccess: boolean) => Promise<{ documentItems: any[]; notificationItems: any[]; blockedTasks: any[] }>;
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

  function resolveAssigneeId(db: any, preferredAssigneeId: unknown, salesperson: unknown, fallbackUserId: string | null) {
    return getTaskServices().resolveAssigneeId(db, preferredAssigneeId, salesperson, fallbackUserId);
  }

  function getTaskWithLinksById(db: any, id: string) {
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
    userId: string | null,
    content: string,
    meta: { entityType?: string | null; entityId?: string | null; link?: string | null } = {}
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
    return String((req as any).user?.id || '');
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

  async function queryWorkspaceHighlights(userId: string, globalAccess = false) {
    const db = getDb();
    const sharedSelect = `
      SELECT
        p.id AS projectId,
        p.code AS projectCode,
        p.name AS projectName,
        p.projectStage,
        p.status AS projectStatus,
        a.companyName AS accountName,
        (
          SELECT COUNT(*) FROM Task t
          WHERE t.projectId = p.id AND t.status != 'completed'
        ) AS openTaskCount,
        (
          SELECT COUNT(*) FROM ApprovalRequest ar
          WHERE ar.projectId = p.id AND ar.status = 'pending'
        ) AS pendingApprovalCount,
        (
          SELECT COUNT(*) FROM ProjectDocument pd
          WHERE pd.projectId = p.id AND pd.status IN ('missing', 'requested')
        ) AS missingDocumentCount
      FROM Project p
      LEFT JOIN Account a ON a.id = p.accountId
    `;

    if (globalAccess) {
      return db.all(
        `
          ${sharedSelect}
          ORDER BY COALESCE(p.updatedAt, p.createdAt) DESC
          LIMIT 8
        `,
      );
    }

    return db.all(
      `
        ${sharedSelect}
        WHERE p.managerId = ?
           OR EXISTS (
             SELECT 1 FROM Task t
             WHERE t.projectId = p.id AND t.assigneeId = ?
           )
           OR EXISTS (
             SELECT 1 FROM ApprovalRequest ar
             WHERE ar.projectId = p.id AND (ar.requestedBy = ? OR ar.approverUserId = ?)
           )
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
      return db.get(
        `
          SELECT
            SUM(CASE WHEN t.taskType = 'handoff' AND t.status != 'completed' THEN 1 ELSE 0 END) AS handoffPending,
            SUM(CASE WHEN p.status = 'active' THEN 1 ELSE 0 END) AS activeProjects,
            SUM(CASE WHEN t.blockedReason IS NOT NULL AND trim(t.blockedReason) != '' AND t.status != 'completed' THEN 1 ELSE 0 END) AS blockers,
            SUM(CASE WHEN ar.status = 'pending' THEN 1 ELSE 0 END) AS pendingApprovals,
            SUM(CASE WHEN pd.status IN ('missing', 'requested') THEN 1 ELSE 0 END) AS missingDocuments,
            SUM(CASE WHEN ppl.shortageQty > 0 THEN 1 ELSE 0 END) AS shortages,
            SUM(CASE WHEN ppl.etaDate IS NOT NULL AND date(ppl.etaDate) < date('now') AND COALESCE(ppl.receivedQty, 0) < MAX(COALESCE(ppl.orderedQty, 0), COALESCE(ppl.contractQty, 0)) THEN 1 ELSE 0 END) AS overdueEta,
            SUM(CASE WHEN ppl.orderedQty < ppl.contractQty THEN 1 ELSE 0 END) AS procurementPending,
            SUM(CASE WHEN so.status = 'processing' THEN 1 ELSE 0 END) AS paymentDue,
            SUM(CASE WHEN eo.status = 'failed' THEN 1 ELSE 0 END) AS erpFailed,
            SUM(CASE WHEN ar.department = 'Finance' AND ar.status = 'pending' THEN 1 ELSE 0 END) AS receivableRisk,
            SUM(CASE WHEN ar.department = 'Legal' AND ar.status = 'pending' THEN 1 ELSE 0 END) AS legalPending,
            SUM(CASE WHEN p.projectStage IN ('won', 'order_released', 'procurement_active', 'delivery_active', 'delivery', 'delivery_completed') AND ((SELECT COUNT(*) FROM ApprovalRequest ap WHERE ap.projectId = p.id AND ap.status = 'pending') > 0 OR (SELECT COUNT(*) FROM ProjectDocument doc WHERE doc.projectId = p.id AND doc.status IN ('missing', 'requested')) > 0) THEN 1 ELSE 0 END) AS executiveRiskProjects
          FROM Project p
          LEFT JOIN Task t ON t.projectId = p.id
          LEFT JOIN ApprovalRequest ar ON ar.projectId = p.id
          LEFT JOIN ProjectDocument pd ON pd.projectId = p.id
          LEFT JOIN ProjectProcurementLine ppl ON ppl.projectId = p.id AND COALESCE(ppl.isActive, 1) = 1
          LEFT JOIN SalesOrder so ON so.projectId = p.id
          LEFT JOIN ErpOutbox eo ON eo.entityId = p.id
          ${globalAccess ? '' : `WHERE p.managerId = ?
             OR EXISTS (SELECT 1 FROM Task ownTask WHERE ownTask.projectId = p.id AND ownTask.assigneeId = ?)
             OR EXISTS (SELECT 1 FROM ApprovalRequest ownApproval WHERE ownApproval.projectId = p.id AND (ownApproval.requestedBy = ? OR ownApproval.approverUserId = ?))`}
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
            WHERE pd.status IN ('missing', 'requested')
              ${globalAccess ? '' : `AND (
                p.managerId = ?
                OR EXISTS (SELECT 1 FROM Task t WHERE t.projectId = p.id AND t.assigneeId = ?)
                OR EXISTS (SELECT 1 FROM ApprovalRequest ar WHERE ar.projectId = p.id AND (ar.requestedBy = ? OR ar.approverUserId = ?))
              )`}
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

      return {
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
      const [leads, qualified, proposal, won] = await Promise.all([
        db.get("SELECT COUNT(*) as c FROM Lead"),
        db.get("SELECT COUNT(*) as c FROM Lead WHERE status != 'New'"),
        db.get("SELECT COUNT(*) as c FROM Quotation"),
        db.get("SELECT COUNT(*) as c FROM Quotation WHERE status = 'accepted'"),
      ]);

      return [
        { label: 'Leads', value: leads.c, color: '#1e293b' },
        { label: 'Qualified', value: qualified.c, color: '#334155' },
        { label: 'Proposal', value: proposal.c, color: '#009b6e' },
        { label: 'Won', value: won.c, color: '#16a34a' },
      ];
    },
    async getOpsSummary() {
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
