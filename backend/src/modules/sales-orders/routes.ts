import type { Express, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { getDb } from '../../../sqlite-db';
import { enqueueErpEvent } from '../../../erp-sync';
import { userHasAnyRole } from '../../shared/auth/roles';
import { canTransitionSalesOrderStatus } from '../../shared/workflow/revenueFlow';

type AsyncRouteFactory = (handler: (req: Request, res: Response) => Promise<unknown>) => any;

type RegisterSalesOrderRoutesDeps = {
  ah: AsyncRouteFactory;
  requireAuth: any;
  requireRole: (...roles: string[]) => any;
  parseLimitParam: (value: string | undefined, defaultValue: number, maxValue: number) => number;
  createSalesOrderFromQuotation: (db: any, quotationId: string) => Promise<{ created: boolean; salesOrder: any }>;
};

export function registerSalesOrderRoutes(app: Express, deps: RegisterSalesOrderRoutesDeps) {
  const {
    ah,
    requireAuth,
    requireRole,
    parseLimitParam,
    createSalesOrderFromQuotation,
  } = deps;

  function mapPendingApprovers(rows: any[] = []) {
    return rows.map((row) => ({
      approvalId: row.id,
      approverRole: row.approverRole || null,
      approverUserId: row.approverUserId || null,
      approverName: row.approverName || null,
      requestedBy: row.requestedBy || null,
      requestedByName: row.requestedByName || null,
      dueDate: row.dueDate || null,
      status: row.status || null,
    }));
  }

  function buildSalesOrderReleaseGateState(approvalRows: any[] = []) {
    const pendingRows = approvalRows.filter((row) => String(row?.status || '').toLowerCase() === 'pending');
    const latestApproval = approvalRows[0] || null;
    return {
      gateType: 'sales_order_release',
      status: pendingRows.length > 0 ? 'pending' : latestApproval?.status || 'not_requested',
      latestApprovalId: latestApproval?.id || null,
      pendingCount: pendingRows.length,
      pendingApprovers: mapPendingApprovers(pendingRows),
    };
  }

  function buildSalesOrderActionAvailability(row: any, currentUser: any, gateState: any) {
    const releaseTransition = canTransitionSalesOrderStatus({
      currentStatus: row?.status,
      nextStatus: 'released',
      quotationStatus: row?.quotationStatus,
    });
    return {
      canRelease: userHasAnyRole(currentUser, ['director']) && releaseTransition.ok,
      canRequestReleaseApproval: userHasAnyRole(currentUser, ['project_manager', 'director']) && String(row?.status || '').toLowerCase() === 'draft' && Number(gateState?.pendingCount || 0) === 0,
      canOpenQuotation: Boolean(row?.quotationId),
      canOpenProject: Boolean(row?.projectId),
      blockers: releaseTransition.ok === false ? [releaseTransition.failure.message] : [],
    };
  }

  app.get('/api/sales-orders', requireAuth, ah(async (req: Request, res: Response) => {
    const db = getDb();
    const limit = parseLimitParam((req.query as Record<string, string | undefined>).limit, 100, 500);
    const rows = await db.all(
      `SELECT so.*,
              a.companyName AS accountName,
              q.projectId AS projectId,
              q.quoteNumber AS quotationNumber,
              q.subject AS quotationSubject,
              q.status AS quotationStatus
       FROM SalesOrder so
       LEFT JOIN Account a ON so.accountId = a.id
       LEFT JOIN Quotation q ON so.quotationId = q.id
       ORDER BY so.createdAt DESC, so.id DESC
       LIMIT ?`,
      [limit]
    );
    const projectIds = Array.from(new Set(rows.map((row: any) => String(row?.projectId || '').trim()).filter(Boolean)));
    let approvalRows: any[] = [];
    if (projectIds.length > 0) {
      const placeholders = projectIds.map(() => '?').join(', ');
      approvalRows = await db.all(
        `SELECT ar.*,
                approver.fullName AS approverName,
                requester.fullName AS requestedByName
         FROM ApprovalRequest ar
         LEFT JOIN User approver ON ar.approverUserId = approver.id
         LEFT JOIN User requester ON ar.requestedBy = requester.id
         WHERE ar.requestType = 'sales_order_release'
           AND ar.projectId IN (${placeholders})
         ORDER BY ar.createdAt DESC, ar.id DESC`,
        projectIds,
      );
    }

    const approvalsByProjectId = new Map<string, any[]>();
    for (const approval of approvalRows) {
      const projectId = String(approval?.projectId || '').trim();
      if (!projectId) continue;
      const bucket = approvalsByProjectId.get(projectId) || [];
      bucket.push(approval);
      approvalsByProjectId.set(projectId, bucket);
    }

    const enrichedRows = rows.map((row: any) => {
      const gateState = buildSalesOrderReleaseGateState(approvalsByProjectId.get(String(row?.projectId || '').trim()) || []);
      return {
        ...row,
        approvalGateState: gateState,
        actionAvailability: buildSalesOrderActionAvailability(row, (req as any).user, gateState),
      };
    });

    res.json(enrichedRows);
  }));

  app.get('/api/sales-orders/:id', requireAuth, ah(async (req: Request, res: Response) => {
    const db = getDb();
    const row = await db.get(
      `SELECT so.*,
              a.companyName AS accountName,
              q.projectId AS projectId,
              q.quoteNumber AS quotationNumber,
              q.subject AS quotationSubject,
              q.status AS quotationStatus
       FROM SalesOrder so
       LEFT JOIN Account a ON so.accountId = a.id
       LEFT JOIN Quotation q ON so.quotationId = q.id
       WHERE so.id = ?`,
      [req.params.id]
    );
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  }));

  app.post('/api/sales-orders/from-quotation/:quotationId', requireAuth, requireRole('admin', 'manager', 'sales', 'project_manager', 'director'), ah(async (req: Request, res: Response) => {
    const db = getDb();
    const quotationId = Array.isArray(req.params.quotationId) ? req.params.quotationId[0] : req.params.quotationId;
    const result = await createSalesOrderFromQuotation(db, quotationId);
    res.status(result.created ? 201 : 200).json(result);
  }));

  app.post('/api/sales-orders/:id/release-approval', requireAuth, requireRole('admin', 'project_manager', 'director'), ah(async (req: Request, res: Response) => {
    const db = getDb();
    const salesOrderId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const salesOrder = await db.get(
      `SELECT so.id,
              so.status,
              so.orderNumber,
              so.quotationId,
              q.projectId AS projectId,
              q.status AS quotationStatus
       FROM SalesOrder so
       LEFT JOIN Quotation q ON q.id = so.quotationId
       WHERE so.id = ?`,
      [salesOrderId],
    );
    if (!salesOrder) return res.status(404).json({ error: 'Sales order not found' });

    const transition = canTransitionSalesOrderStatus({
      currentStatus: salesOrder.status,
      nextStatus: 'released',
      quotationStatus: salesOrder.quotationStatus,
    });
    if (!transition.ok) {
      const failure = 'failure' in transition ? transition.failure : { code: 'INVALID_TRANSITION', message: 'Sales order transition blocked' };
      return res.status(409).json({ error: failure.message, code: failure.code });
    }

    const approvalTitle = `Release ${salesOrder.orderNumber || salesOrder.id}`;
    const existingPending = await db.get(
      `SELECT * FROM ApprovalRequest
       WHERE requestType = 'sales_order_release'
         AND projectId = ?
         AND quotationId = ?
         AND title = ?
         AND status = 'pending'
       ORDER BY createdAt DESC, id DESC
       LIMIT 1`,
      [salesOrder.projectId || null, salesOrder.quotationId || null, approvalTitle],
    );
    if (existingPending) return res.status(200).json(existingPending);

    const directorUser = await db.get(
      `SELECT id
       FROM User
       WHERE accountStatus = 'active'
         AND (systemRole = 'director' OR role = 'director')
       ORDER BY rowid DESC
       LIMIT 1`,
    );

    const approvalId = randomUUID();
    const note = typeof req.body?.note === 'string' && req.body.note.trim() ? req.body.note.trim() : null;
    await db.run(
      `INSERT INTO ApprovalRequest (
        id, projectId, quotationId, requestType, title, department, requestedBy, approverRole, approverUserId, status, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        approvalId,
        salesOrder.projectId || null,
        salesOrder.quotationId || null,
        'sales_order_release',
        approvalTitle,
        'Operations',
        String((req as any).user?.id || '').trim() || null,
        'director',
        directorUser?.id || null,
        'pending',
        note,
      ],
    );
    const created = await db.get(`SELECT * FROM ApprovalRequest WHERE id = ?`, [approvalId]);
    res.status(201).json(created);
  }));

  app.put('/api/sales-orders/:id', requireAuth, requireRole('admin', 'manager', 'sales', 'project_manager', 'director'), ah(async (req: Request, res: Response) => {
    const db = getDb();
    const { status, notes } = req.body ?? {};
    const current = await db.get(
      `SELECT so.id, so.status, q.projectId AS projectId, q.status AS quotationStatus
       FROM SalesOrder so
       LEFT JOIN Quotation q ON so.quotationId = q.id
       WHERE so.id = ?`,
      [req.params.id],
    );
    if (!current) return res.status(404).json({ error: 'Not found' });
    const nextStatus = typeof status === 'string' && status.trim() ? status.trim() : String(current.status || 'draft');
    const nextNotes = typeof notes === 'string' ? notes : null;
    const transition = canTransitionSalesOrderStatus({
      currentStatus: current.status,
      nextStatus,
      quotationStatus: current.quotationStatus,
    });
    if (!transition.ok) {
      const failure = 'failure' in transition ? transition.failure : { code: 'INVALID_TRANSITION', message: 'Sales order transition blocked' };
      return res.status(409).json({ error: failure.message, code: failure.code });
    }

    const roleCodes = Array.isArray((req as any).user?.roleCodes) ? (req as any).user.roleCodes.map(String) : [];
    const systemRole = String((req as any).user?.systemRole || '').trim();
    const userRoles = new Set([...roleCodes, systemRole]);
    if (String(nextStatus).trim() === 'released' && !['admin', 'director'].some((role) => userRoles.has(role))) {
      return res.status(403).json({ error: 'Only director can release a sales order' });
    }
    if (String(nextStatus).trim() === 'locked_for_execution' && !['admin', 'director', 'project_manager'].some((role) => userRoles.has(role))) {
      return res.status(403).json({ error: 'Only project manager or director can lock execution' });
    }

    await db.run(
      `UPDATE SalesOrder
       SET status = ?, notes = COALESCE(?, notes), updatedAt = datetime('now')
       WHERE id = ?`,
      [nextStatus, nextNotes, req.params.id]
    );
    const updated = await db.get(`SELECT * FROM SalesOrder WHERE id = ?`, [req.params.id]);
    if (String(nextStatus).trim() === 'released') {
      if (current.projectId) {
        await db.run(
          `UPDATE Project
           SET projectStage = CASE WHEN projectStage IN ('delivery_active', 'delivery_completed', 'closed') THEN projectStage ELSE 'order_released' END,
               updatedAt = datetime('now')
           WHERE id = ?`,
          [current.projectId],
        );
      }
      await enqueueErpEvent(db, {
        eventType: 'sales_order.released',
        entityType: 'SalesOrder',
        entityId: Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
        payload: { salesOrderId: Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, status: nextStatus },
      });
    }
    res.json(updated);
  }));
}
