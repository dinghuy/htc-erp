export type PlatformWorkspaceServices = {
  getHomeSummary: (userId: number | string, globalAccess: boolean) => Promise<any>;
  listHighlights: (userId: number | string, globalAccess: boolean, currentUser?: any) => Promise<any[]>;
  listApprovals: (userId: number | string, globalAccess: boolean, limit?: number) => Promise<any[]>;
  getMyWork: (userId: number | string, globalAccess: boolean) => Promise<{ tasks: any[]; approvals: any[]; projects: any[] }>;
  getInboxItems: (userId: number | string, globalAccess: boolean) => Promise<{ documentItems: any[]; notificationItems: any[]; blockedTasks: any[] }>;
};

type PlatformWorkspaceServicesDeps = {
  getDb: () => any;
  getProjectWorkspaceById: (db: any, projectId: string, currentUser?: any) => Promise<any>;
};

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

async function queryWorkspaceHighlights(db: any, userId: string, globalAccess = false) {
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

async function queryWorkspaceApprovals(db: any, userId: string, globalAccess = false, limit = 50) {
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

export function createPlatformWorkspaceServices(deps: PlatformWorkspaceServicesDeps): PlatformWorkspaceServices {
  const { getDb, getProjectWorkspaceById } = deps;

  return {
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
      const highlights = await queryWorkspaceHighlights(db, userId, globalAccess);
      if (!currentUser) return highlights;
      return Promise.all((Array.isArray(highlights) ? highlights : []).map(async (highlight) => {
        const projectId = String(highlight?.projectId || '').trim();
        if (!projectId) return highlight;
        const workspace = await getProjectWorkspaceById(db, projectId, currentUser).catch(() => null);
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
      return queryWorkspaceApprovals(getDb(), userId, globalAccess, limit);
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
        queryWorkspaceApprovals(db, userId, globalAccess, 24),
        queryWorkspaceHighlights(db, userId, globalAccess),
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
}
