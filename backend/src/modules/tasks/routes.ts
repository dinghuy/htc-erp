import type { Express, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../../../sqlite-db';

type AsyncRouteFactory = (handler: (req: Request, res: Response) => Promise<unknown>) => any;

type RegisterTaskRoutesDeps = {
  ah: AsyncRouteFactory;
  requireAuth: any;
  requireRole: (...roles: string[]) => any;
  appendDateRangeFilter: (
    conditions: string[],
    params: unknown[],
    fieldName: string,
    from: unknown,
    to: unknown
  ) => void;
  getCurrentUserId: (req: Request) => string | null;
  resolveAssigneeId: (
    db: any,
    preferredAssigneeId: unknown,
    salesperson: unknown,
    fallbackUserId: string | null
  ) => Promise<string | null>;
  getTaskWithLinksById: (db: any, taskId: string) => Promise<any>;
};

export function registerTaskRoutes(app: Express, deps: RegisterTaskRoutesDeps) {
  const {
    ah,
    requireAuth,
    requireRole,
    appendDateRangeFilter,
    getCurrentUserId,
    resolveAssigneeId,
    getTaskWithLinksById,
  } = deps;

  app.get('/api/tasks', ah(async (req: Request, res: Response) => {
    const db = getDb();
    const {
      projectId,
      assigneeId,
      accountId,
      leadId,
      quotationId,
      status,
      taskType,
      department,
      blocked,
      startDateFrom,
      startDateTo,
      dueDateFrom,
      dueDateTo,
    } = req.query as Record<string, string | undefined>;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (projectId) {
      conditions.push('t.projectId = ?');
      params.push(projectId);
    }
    if (assigneeId) {
      conditions.push('t.assigneeId = ?');
      params.push(assigneeId);
    }
    if (accountId) {
      conditions.push('t.accountId = ?');
      params.push(accountId);
    }
    if (leadId) {
      conditions.push('t.leadId = ?');
      params.push(leadId);
    }
    if (quotationId) {
      conditions.push('t.quotationId = ?');
      params.push(quotationId);
    }
    if (status) {
      conditions.push('t.status = ?');
      params.push(status);
    }
    if (taskType) {
      conditions.push('t.taskType = ?');
      params.push(taskType);
    }
    if (department) {
      conditions.push('t.department = ?');
      params.push(department);
    }
    if (blocked === 'true') {
      conditions.push(`t.blockedReason IS NOT NULL AND TRIM(t.blockedReason) <> ''`);
    }
    if (blocked === 'false') {
      conditions.push(`(t.blockedReason IS NULL OR TRIM(t.blockedReason) = '')`);
    }

    appendDateRangeFilter(conditions, params, 't.startDate', startDateFrom, startDateTo);
    appendDateRangeFilter(conditions, params, 't.dueDate', dueDateFrom, dueDateTo);

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await db.all(
      `
        SELECT t.*,
               u.fullName AS assigneeName,
               p.name AS projectName,
               a.companyName AS accountName,
               l.companyName AS leadCompanyName,
               l.contactName AS leadContactName,
               q.quoteNumber AS quotationNumber,
               q.subject AS quotationSubject,
               q.status AS quotationStatus
        FROM Task t
        LEFT JOIN User u ON t.assigneeId = u.id
        LEFT JOIN Project p ON t.projectId = p.id
        LEFT JOIN Account a ON t.accountId = a.id
        LEFT JOIN Lead l ON t.leadId = l.id
        LEFT JOIN Quotation q ON t.quotationId = q.id
        ${where}
        ORDER BY t.createdAt DESC
      `,
      params
    );
    res.json(rows);
  }));

  app.get('/api/tasks/:id', ah(async (req: Request, res: Response) => {
    const db = getDb();
    const taskId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const row = await db.get(
      `
        SELECT t.*,
               u.fullName AS assigneeName,
               p.name AS projectName,
               a.companyName AS accountName,
               l.companyName AS leadCompanyName,
               l.contactName AS leadContactName,
               q.quoteNumber AS quotationNumber,
               q.subject AS quotationSubject,
               q.status AS quotationStatus
        FROM Task t
        LEFT JOIN User u ON t.assigneeId = u.id
        LEFT JOIN Project p ON t.projectId = p.id
        LEFT JOIN Account a ON t.accountId = a.id
        LEFT JOIN Lead l ON t.leadId = l.id
        LEFT JOIN Quotation q ON t.quotationId = q.id
        WHERE t.id = ?
      `,
      [taskId]
    );
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  }));

  app.post('/api/tasks', requireAuth, requireRole('admin', 'manager', 'sales'), ah(async (req: Request, res: Response) => {
    const db = getDb();
    const id = uuidv4();
    const {
      projectId,
      name,
      description,
      assigneeId,
      status = 'pending',
      priority = 'medium',
      startDate,
      dueDate,
      completionPct = 0,
      notes,
      accountId,
      leadId,
      quotationId,
      target,
      resultLinks,
      output,
      reportDate,
      taskType,
      department,
      blockedReason,
    } = req.body ?? {};

    if (!name) return res.status(400).json({ error: 'name is required' });

    await db.run(
      `INSERT INTO Task (
        id, projectId, name, description, assigneeId, status, priority, startDate, dueDate,
        completionPct, notes, accountId, leadId, quotationId, target, resultLinks, output,
        reportDate, taskType, department, blockedReason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        projectId || null,
        name,
        description || null,
        assigneeId || null,
        status,
        priority,
        startDate || null,
        dueDate || null,
        completionPct ?? 0,
        notes || null,
        accountId || null,
        leadId || null,
        quotationId || null,
        target || null,
        resultLinks || null,
        output || null,
        reportDate || null,
        taskType || null,
        department || null,
        blockedReason || null,
      ]
    );

    res.status(201).json(await getTaskWithLinksById(db, id));
  }));

  app.post('/api/tasks/from-quotation', requireAuth, requireRole('admin', 'manager', 'sales'), ah(async (req: Request, res: Response) => {
    const db = getDb();
    const actorUserId = getCurrentUserId(req);
    const quotationId = typeof req.body?.quotationId === 'string' ? req.body.quotationId.trim() : '';
    if (!quotationId) return res.status(400).json({ error: 'quotationId is required' });

    const quotation = await db.get(
      `SELECT q.*, a.companyName AS accountName
       FROM Quotation q
       LEFT JOIN Account a ON q.accountId = a.id
       WHERE q.id = ?`,
      [quotationId]
    );
    if (!quotation) return res.status(404).json({ error: 'Quotation not found' });

    const projectId = typeof req.body?.projectId === 'string' && req.body.projectId.trim() ? req.body.projectId.trim() : null;
    const leadId = typeof req.body?.leadId === 'string' && req.body.leadId.trim()
      ? req.body.leadId.trim()
      : (quotation.opportunityId || null);
    const assigneeId = await resolveAssigneeId(
      db,
      req.body?.assigneeId,
      req.body?.salesperson ?? quotation.salesperson,
      actorUserId
    );

    const taskName = typeof req.body?.name === 'string' && req.body.name.trim()
      ? req.body.name.trim()
      : `Follow up quotation ${quotation.quoteNumber || quotation.id}`;
    const dedupeDescription = typeof req.body?.description === 'string' && req.body.description.trim()
      ? req.body.description.trim()
      : `Linked task for quotation ${quotation.quoteNumber || quotation.id}`;
    const notes = typeof req.body?.notes === 'string' && req.body.notes.trim() ? req.body.notes.trim() : null;
    const target = typeof req.body?.target === 'string' && req.body.target.trim() ? req.body.target.trim() : `quotation:${quotation.id}`;

    const existing = await db.get(
      `SELECT id FROM Task
       WHERE quotationId = ? AND (
         id = ? OR
         (name = ? AND COALESCE(projectId, '') = COALESCE(?, '') AND COALESCE(assigneeId, '') = COALESCE(?, ''))
       )`,
      [quotation.id, req.body?.id || '', taskName, projectId, assigneeId || '']
    );
    if (existing) {
      return res.json(await getTaskWithLinksById(db, existing.id));
    }

    const id = typeof req.body?.id === 'string' && req.body.id.trim() ? req.body.id.trim() : uuidv4();
    const status = typeof req.body?.status === 'string' && req.body.status.trim() ? req.body.status.trim() : 'pending';
    const priority = typeof req.body?.priority === 'string' && req.body.priority.trim() ? req.body.priority.trim() : 'medium';
    const startDate = typeof req.body?.startDate === 'string' && req.body.startDate.trim()
      ? req.body.startDate.trim()
      : new Date().toISOString().slice(0, 10);
    const dueDate = typeof req.body?.dueDate === 'string' && req.body.dueDate.trim() ? req.body.dueDate.trim() : null;
    const completionPct = Number.isFinite(Number(req.body?.completionPct)) ? Number(req.body.completionPct) : 0;
    const taskType = typeof req.body?.taskType === 'string' && req.body.taskType.trim() ? req.body.taskType.trim() : 'follow_up';
    const department = typeof req.body?.department === 'string' && req.body.department.trim() ? req.body.department.trim() : 'Sales';
    const accountId = typeof req.body?.accountId === 'string' && req.body.accountId.trim()
      ? req.body.accountId.trim()
      : (quotation.accountId || null);

    await db.run(
      `INSERT INTO Task (
        id, projectId, name, description, assigneeId, status, priority, startDate, dueDate, completionPct,
        notes, accountId, leadId, quotationId, target, resultLinks, output, reportDate, taskType, department, blockedReason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        projectId,
        taskName,
        dedupeDescription,
        assigneeId || null,
        status,
        priority,
        startDate,
        dueDate,
        completionPct,
        notes,
        accountId,
        leadId,
        quotation.id,
        target,
        typeof req.body?.resultLinks === 'string' ? req.body.resultLinks : null,
        typeof req.body?.output === 'string' ? req.body.output : null,
        typeof req.body?.reportDate === 'string' ? req.body.reportDate : null,
        taskType,
        department,
        typeof req.body?.blockedReason === 'string' ? req.body.blockedReason : null,
      ]
    );

    res.status(201).json(await getTaskWithLinksById(db, id));
  }));

  app.put('/api/tasks/:id', requireAuth, requireRole('admin', 'manager', 'sales'), ah(async (req: Request, res: Response) => {
    const db = getDb();
    const taskId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const existing = await db.get('SELECT id FROM Task WHERE id = ?', [taskId]);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const {
      projectId,
      name,
      description,
      assigneeId,
      status,
      priority,
      startDate,
      dueDate,
      completionPct,
      notes,
      accountId,
      leadId,
      quotationId,
      target,
      resultLinks,
      output,
      reportDate,
      taskType,
      department,
      blockedReason,
    } = req.body ?? {};

    await db.run(
      `UPDATE Task
       SET projectId = ?, name = ?, description = ?, assigneeId = ?, status = ?, priority = ?,
           startDate = ?, dueDate = ?, completionPct = ?, notes = ?, accountId = ?, leadId = ?,
           quotationId = ?, target = ?, resultLinks = ?, output = ?, reportDate = ?, taskType = ?,
           department = ?, blockedReason = ?, updatedAt = datetime('now')
       WHERE id = ?`,
      [
        projectId || null,
        name,
        description || null,
        assigneeId || null,
        status,
        priority,
        startDate || null,
        dueDate || null,
        completionPct ?? 0,
        notes || null,
        accountId || null,
        leadId || null,
        quotationId || null,
        target || null,
        resultLinks || null,
        output || null,
        reportDate || null,
        taskType || null,
        department || null,
        blockedReason || null,
        taskId,
      ]
    );

    res.json(await getTaskWithLinksById(db, taskId));
  }));

  app.delete('/api/tasks/:id', requireAuth, requireRole('admin', 'manager'), ah(async (req: Request, res: Response) => {
    const taskId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    await getDb().run('DELETE FROM Task WHERE id = ?', [taskId]);
    res.json({ success: true });
  }));
}
