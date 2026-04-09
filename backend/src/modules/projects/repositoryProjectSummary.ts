import { getDb } from '../../../sqlite-db';

export type ListProjectsFilters = {
  accountId?: number | string;
  managerId?: number | string;
  status?: string;
  startDateFrom?: string;
  startDateTo?: string;
  endDateFrom?: string;
  endDateTo?: string;
};

function appendDateRangeFilter(
  conditions: string[],
  params: any[],
  column: string,
  from?: string,
  to?: string,
) {
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
}

const PROJECT_SUMMARY_JOINS = `
  LEFT JOIN (
    SELECT
      projectId,
      COUNT(*) AS taskCount,
      SUM(CASE WHEN status != 'completed' THEN 1 ELSE 0 END) AS openTaskCount,
      SUM(CASE WHEN dueDate IS NOT NULL AND date(dueDate) < date('now') AND status != 'completed' THEN 1 ELSE 0 END) AS overdueTaskCount
    FROM Task
    GROUP BY projectId
  ) ts ON ts.projectId = p.id
  LEFT JOIN (
    SELECT projectId, COUNT(*) AS quotationCount
    FROM Quotation
    GROUP BY projectId
  ) qs ON qs.projectId = p.id
  LEFT JOIN (
    SELECT projectId, COUNT(*) AS supplierQuoteCount
    FROM SupplierQuote
    GROUP BY projectId
  ) sqs ON sqs.projectId = p.id
  LEFT JOIN (
    SELECT projectId, id AS latestQuotationId, status AS latestQuotationStatus, quoteNumber AS latestQuotationNumber
    FROM (
      SELECT
        projectId,
        id,
        status,
        quoteNumber,
        ROW_NUMBER() OVER (
          PARTITION BY projectId
          ORDER BY COALESCE(quoteDate, createdAt) DESC, COALESCE(revisionNo, 0) DESC, createdAt DESC
        ) AS rowNo
      FROM Quotation
    ) latestQuotation
    WHERE rowNo = 1
  ) lq ON lq.projectId = p.id
`;

export function createProjectSummaryRepository() {
  async function insertProject(input: {
    code?: string | null;
    name: string;
    description?: string | null;
    managerId?: number | string | null;
    accountId?: number | string | null;
    projectStage: string;
    startDate?: string | null;
    endDate?: string | null;
    status?: string | null;
  }) {
    return getDb().run(
      `INSERT INTO Project (code, name, description, managerId, accountId, projectStage, startDate, endDate, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.code || null,
        input.name,
        input.description || null,
        input.managerId || null,
        input.accountId || null,
        input.projectStage,
        input.startDate || null,
        input.endDate || null,
        input.status || null,
      ]
    );
  }

  async function updateProjectById(input: {
    id: number | string;
    code?: string | null;
    name: string;
    description?: string | null;
    managerId?: number | string | null;
    accountId?: number | string | null;
    projectStage: string;
    startDate?: string | null;
    endDate?: string | null;
    status?: string | null;
  }) {
    await getDb().run(
      `UPDATE Project
       SET code = ?, name = ?, description = ?, managerId = ?, accountId = ?, projectStage = ?,
           startDate = ?, endDate = ?, status = ?, updatedAt = datetime('now')
       WHERE id = ?`,
      [
        input.code || null,
        input.name,
        input.description || null,
        input.managerId || null,
        input.accountId || null,
        input.projectStage,
        input.startDate || null,
        input.endDate || null,
        input.status || null,
        input.id,
      ]
    );
  }

  async function deleteTasksByProjectId(projectId: number | string) {
    await getDb().run('DELETE FROM Task WHERE projectId = ?', [projectId]);
  }

  async function deleteProjectById(projectId: number | string) {
    await getDb().run('DELETE FROM Project WHERE id = ?', [projectId]);
  }

  async function listProjects(filters: ListProjectsFilters) {
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters.accountId) {
      conditions.push('p.accountId = ?');
      params.push(filters.accountId);
    }
    if (filters.managerId) {
      conditions.push('p.managerId = ?');
      params.push(filters.managerId);
    }
    if (filters.status) {
      conditions.push('p.status = ?');
      params.push(filters.status);
    }
    appendDateRangeFilter(conditions, params, 'p.startDate', filters.startDateFrom, filters.startDateTo);
    appendDateRangeFilter(conditions, params, 'p.endDate', filters.endDateFrom, filters.endDateTo);

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return getDb().all(
      `
        SELECT p.*,
               u.fullName AS managerName,
               a.companyName AS accountName,
               COALESCE(ts.taskCount, 0) AS taskCount,
               COALESCE(qs.quotationCount, 0) AS quotationCount,
               COALESCE(sqs.supplierQuoteCount, 0) AS supplierQuoteCount,
               COALESCE(ts.openTaskCount, 0) AS openTaskCount,
               COALESCE(ts.overdueTaskCount, 0) AS overdueTaskCount,
               lq.latestQuotationId,
               lq.latestQuotationStatus,
               lq.latestQuotationNumber
        FROM Project p
        LEFT JOIN User u ON p.managerId = u.id
        LEFT JOIN Account a ON p.accountId = a.id
        ${PROJECT_SUMMARY_JOINS}
        ${whereClause}
        ORDER BY p.createdAt DESC
      `,
      params
    );
  }

  async function findProjectSummaryById(projectId: number | string) {
    return getDb().get(
      `
        SELECT p.*,
               u.fullName AS managerName,
               a.companyName AS accountName,
               lq.latestQuotationId,
               lq.latestQuotationStatus,
               lq.latestQuotationNumber,
               COALESCE(qs.quotationCount, 0) AS quotationCount,
               COALESCE(sqs.supplierQuoteCount, 0) AS supplierQuoteCount,
               COALESCE(ts.taskCount, 0) AS taskCount,
               COALESCE(ts.openTaskCount, 0) AS openTaskCount,
               COALESCE(ts.overdueTaskCount, 0) AS overdueTaskCount
        FROM Project p
        LEFT JOIN User u ON p.managerId = u.id
        LEFT JOIN Account a ON p.accountId = a.id
        ${PROJECT_SUMMARY_JOINS}
        WHERE p.id = ?
      `,
      [projectId]
    );
  }

  async function listProjectTasks(projectId: string) {
    return getDb().all(
      `
        SELECT t.*,
               u.fullName AS assigneeName,
               p.name AS projectName,
               a.companyName AS accountName,
               q.quoteNumber AS quotationNumber,
               q.status AS quotationStatus
        FROM Task t
        LEFT JOIN User u ON t.assigneeId = u.id
        LEFT JOIN Project p ON t.projectId = p.id
        LEFT JOIN Account a ON t.accountId = a.id
        LEFT JOIN Quotation q ON t.quotationId = q.id
        WHERE t.projectId = ?
        ORDER BY CASE WHEN t.dueDate IS NULL THEN 1 ELSE 0 END, t.dueDate ASC, t.createdAt DESC
      `,
      [projectId]
    );
  }

  async function listProjectActivities(projectId: string) {
    return getDb().all(
      `
        SELECT *
        FROM Activity
        WHERE entityId = ?
           OR entityId IN (SELECT id FROM Quotation WHERE projectId = ?)
           OR entityId IN (SELECT id FROM Task WHERE projectId = ?)
        ORDER BY createdAt DESC
        LIMIT 50
      `,
      [projectId, projectId, projectId]
    );
  }

  return {
    insertProject,
    updateProjectById,
    deleteTasksByProjectId,
    deleteProjectById,
    listProjects,
    findProjectSummaryById,
    listProjectTasks,
    listProjectActivities,
  };
}
