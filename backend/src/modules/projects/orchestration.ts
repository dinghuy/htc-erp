import { v4 as uuidv4 } from 'uuid';
import { canCreateSalesOrderFromQuotation } from '../../shared/workflow/revenueFlow';

type TaskTemplate = {
  name: string;
  taskType: string;
  department: string;
  priority: string;
  dueInDays: number;
  description: string;
};

type ApprovalTemplate = {
  requestType: string;
  title: string;
  department: string;
  approverRole: string;
  dueInDays: number;
};

type DocumentTemplate = {
  documentCode: string;
  documentName: string;
  category: string;
  department: string;
  requiredAtStage: string;
};

type CreateProjectOrchestrationServicesDeps = {
  TASK_TEMPLATE_LIBRARY: Record<string, TaskTemplate[]>;
  APPROVAL_TEMPLATE_LIBRARY: Record<string, ApprovalTemplate[]>;
  DOCUMENT_TEMPLATE_LIBRARY: Record<string, DocumentTemplate[]>;
  resolveAssigneeId: (db: any, preferredAssigneeId: unknown, salesperson: unknown, fallbackUserId: string | null) => Promise<string | null>;
  getTaskWithLinksById: (db: any, id: string) => Promise<any>;
  normalizeProjectStage: (value: unknown, fallback?: string) => string;
};

function dueDateFromDays(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function createProjectOrchestrationServices(deps: CreateProjectOrchestrationServicesDeps) {
  const {
    TASK_TEMPLATE_LIBRARY,
    APPROVAL_TEMPLATE_LIBRARY,
    DOCUMENT_TEMPLATE_LIBRARY,
    resolveAssigneeId,
    getTaskWithLinksById,
    normalizeProjectStage,
  } = deps;

  async function autoCreateProjectForQuotation(db: any, payload: any, actorUserId: string | null) {
    const id = uuidv4();
    const nameSource = String(payload.subject || payload.quoteNumber || 'Untitled project').trim() || 'Untitled project';
    const projectStage = normalizeProjectStage(payload.projectStage, 'quoting');
    const managerId = await resolveAssigneeId(db, payload.managerId, payload.salesperson, actorUserId);
    await db.run(
      `INSERT INTO Project (id, code, name, description, managerId, accountId, projectStage, startDate, endDate, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        payload.projectCode || payload.quoteNumber || null,
        nameSource,
        payload.projectDescription || payload.subject || null,
        managerId || null,
        payload.accountId || null,
        projectStage,
        payload.quoteDate || new Date().toISOString().slice(0, 10),
        null,
        payload.projectStatus || 'pending',
      ]
    );
    return id;
  }

  async function createProjectTasksFromTemplate(
    db: any,
    params: {
      projectId: string;
      templateKey: string;
      quotation: any | null;
      actorUserId: string | null;
      requestedAssigneeId?: unknown;
    }
  ) {
    const templates = TASK_TEMPLATE_LIBRARY[params.templateKey] || [];
    const createdTasks: any[] = [];
    for (const template of templates) {
      const dueDate = dueDateFromDays(template.dueInDays);
      const notes = `AUTO:project-template:${params.templateKey};projectId=${params.projectId};quotationId=${params.quotation?.id || ''};task=${template.taskType}`;
      const existing = await db.get(`SELECT id FROM Task WHERE projectId = ? AND notes = ?`, [params.projectId, notes]);
      if (existing?.id) {
        const row = await getTaskWithLinksById(db, existing.id);
        if (row) createdTasks.push(row);
        continue;
      }
      const assigneeId = await resolveAssigneeId(
        db,
        params.requestedAssigneeId,
        params.quotation?.salesperson,
        params.actorUserId
      );
      const id = uuidv4();
      await db.run(
        `INSERT INTO Task (
          id, projectId, name, description, assigneeId, status, priority, startDate, dueDate, completionPct,
          notes, accountId, leadId, quotationId, target, resultLinks, output, reportDate, taskType, department, blockedReason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          params.projectId,
          template.name,
          template.description,
          assigneeId || null,
          'pending',
          template.priority,
          new Date().toISOString().slice(0, 10),
          dueDate,
          0,
          notes,
          params.quotation?.accountId || null,
          params.quotation?.opportunityId || null,
          params.quotation?.id || null,
          `Project template ${params.templateKey}`,
          null,
          null,
          null,
          template.taskType,
          template.department,
          null,
        ]
      );
      const row = await getTaskWithLinksById(db, id);
      if (row) createdTasks.push(row);
    }
    return createdTasks;
  }

  async function createApprovalRequestsFromTemplate(
    db: any,
    params: {
      projectId: string;
      templateKey: string;
      quotation: any | null;
      actorUserId: string | null;
    }
  ) {
    const templates = APPROVAL_TEMPLATE_LIBRARY[params.templateKey] || [];
    const created: any[] = [];
    for (const template of templates) {
      const dedupeKey = `${template.requestType}:${params.projectId}:${params.quotation?.id || ''}:${template.approverRole}`;
      const existing = await db.get(
        `SELECT * FROM ApprovalRequest
         WHERE projectId = ? AND IFNULL(quotationId, '') = IFNULL(?, '') AND requestType = ? AND approverRole = ?`,
        [params.projectId, params.quotation?.id || null, template.requestType, template.approverRole]
      );
      if (existing) {
        created.push(existing);
        continue;
      }
      const approverUser = await db.get(
        `SELECT id, fullName FROM User WHERE LOWER(systemRole) = ? ORDER BY createdAt ASC LIMIT 1`,
        [String(template.approverRole).toLowerCase()]
      );
      const id = uuidv4();
      await db.run(
        `INSERT INTO ApprovalRequest (
          id, projectId, quotationId, requestType, title, department, requestedBy, approverRole, approverUserId, status, dueDate, note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          params.projectId,
          params.quotation?.id || null,
          template.requestType,
          template.title,
          template.department,
          params.actorUserId || null,
          template.approverRole,
          approverUser?.id || null,
          'pending',
          dueDateFromDays(template.dueInDays),
          `AUTO:${dedupeKey}`,
        ]
      );
      const row = await db.get(`SELECT * FROM ApprovalRequest WHERE id = ?`, [id]);
      if (row) created.push(row);
    }
    return created;
  }

  async function createProjectDocumentsFromTemplate(
    db: any,
    params: {
      projectId: string;
      templateKey: string;
      quotation: any | null;
    }
  ) {
    const templates = DOCUMENT_TEMPLATE_LIBRARY[params.templateKey] || [];
    const created: any[] = [];
    for (const template of templates) {
      const existing = await db.get(
        `SELECT * FROM ProjectDocument
         WHERE projectId = ? AND documentCode = ? AND IFNULL(quotationId, '') = IFNULL(?, '')`,
        [params.projectId, template.documentCode, params.quotation?.id || null]
      );
      if (existing) {
        created.push(existing);
        continue;
      }
      const id = uuidv4();
      await db.run(
        `INSERT INTO ProjectDocument (
          id, projectId, quotationId, documentCode, documentName, category, department, status, requiredAtStage, note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          params.projectId,
          params.quotation?.id || null,
          template.documentCode,
          template.documentName,
          template.category,
          template.department,
          'missing',
          template.requiredAtStage,
          null,
        ]
      );
      const row = await db.get(`SELECT * FROM ProjectDocument WHERE id = ?`, [id]);
      if (row) created.push(row);
    }
    return created;
  }

  async function createSalesOrderFromQuotation(db: any, quotationId: string) {
    const quotation = await db.get(`SELECT * FROM Quotation WHERE id = ?`, [quotationId]);
    if (!quotation) {
      const err: any = new Error('Quotation not found');
      err.status = 404;
      throw err;
    }

    if (!canCreateSalesOrderFromQuotation(quotation.status)) {
      const err: any = new Error('Quotation must be approved or won before creating sales order');
      err.status = 409;
      throw err;
    }

    const existing = await db.get(`SELECT id FROM SalesOrder WHERE quotationId = ?`, [quotationId]);
    if (existing?.id) {
      const salesOrder = await db.get(`SELECT * FROM SalesOrder WHERE id = ?`, [existing.id]);
      return { created: false, salesOrder };
    }

    const id = uuidv4();
    const orderNumber = `SO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${id.slice(0, 6).toUpperCase()}`;
    await db.run(
      `INSERT INTO SalesOrder (
        id, orderNumber, quotationId, accountId, status, currency, items, subtotal, taxTotal, grandTotal, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        orderNumber,
        quotationId,
        quotation.accountId || null,
        'draft',
        quotation.currency || 'VND',
        quotation.items || '[]',
        quotation.subtotal || 0,
        quotation.taxTotal || 0,
        quotation.grandTotal || 0,
        `Created from quotation ${quotation.quoteNumber || quotationId}`,
      ]
    );
    const salesOrder = await db.get(`SELECT * FROM SalesOrder WHERE id = ?`, [id]);
    return { created: true, salesOrder };
  }

  async function resolveProjectHandoffQuotation(db: any, projectId: string, preferredQuotationId?: string | null) {
    if (preferredQuotationId) {
      const requested = await db.get(`SELECT * FROM Quotation WHERE id = ? AND projectId = ?`, [preferredQuotationId, projectId]);
      if (requested) return requested;
    }

    const winning = await db.get(
      `SELECT *
       FROM Quotation
       WHERE projectId = ? AND isWinningVersion = 1
       ORDER BY COALESCE(revisionNo, 0) DESC, COALESCE(quoteDate, createdAt) DESC
       LIMIT 1`,
      [projectId]
    );
    if (winning) return winning;

    const accepted = await db.get(
      `SELECT *
       FROM Quotation
       WHERE projectId = ? AND LOWER(IFNULL(status, '')) IN ('won', 'accepted')
       ORDER BY COALESCE(revisionNo, 0) DESC, COALESCE(quoteDate, createdAt) DESC
       LIMIT 1`,
      [projectId]
    );
    if (accepted) return accepted;

    return db.get(
      `SELECT *
       FROM Quotation
       WHERE projectId = ?
       ORDER BY COALESCE(revisionNo, 0) DESC, COALESCE(quoteDate, createdAt) DESC
       LIMIT 1`,
      [projectId]
    );
  }

  return {
    autoCreateProjectForQuotation,
    createProjectTasksFromTemplate,
    createApprovalRequestsFromTemplate,
    createProjectDocumentsFromTemplate,
    createSalesOrderFromQuotation,
    resolveProjectHandoffQuotation,
  };
}
