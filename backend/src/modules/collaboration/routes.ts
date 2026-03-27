import type { Express, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../../../sqlite-db';

type AsyncRouteFactory = (handler: (req: Request, res: Response) => Promise<unknown>) => any;

type RegisterCollaborationRoutesDeps = {
  ah: AsyncRouteFactory;
  requireAuth: any;
  requireRole: (...roles: string[]) => any;
  parseLimitParam: (value: string | undefined, defaultValue: number, maxValue: number) => number;
  getCurrentUserId: (req: Request) => string;
  ensureNotification: (
    db: any,
    userId: string | null,
    content: string,
    meta?: { entityType?: string | null; entityId?: string | null; link?: string | null }
  ) => Promise<{ created: boolean; row: any }>;
  getSupportTicketById: (db: any, id: string) => Promise<any>;
  normalizeSupportTicketStatus: (value: unknown) => string | null;
  supportTicketStatuses: readonly string[];
  listActivities: (options: { entityId?: string; limit: number }) => Promise<any[]>;
  createActivity: (input: {
    title: string;
    description?: string | null;
    category?: string | null;
    icon?: string | null;
    color?: string | null;
    iconColor?: string | null;
    entityId?: string | null;
    entityType?: string | null;
    link?: string | null;
  }) => Promise<any>;
  logAct: (...args: any[]) => Promise<void>;
};

export function registerCollaborationRoutes(app: Express, deps: RegisterCollaborationRoutesDeps) {
  const {
    ah,
    requireAuth,
    requireRole,
    parseLimitParam,
    getCurrentUserId,
    ensureNotification,
    getSupportTicketById,
    normalizeSupportTicketStatus,
    supportTicketStatuses,
    listActivities,
    createActivity,
    logAct,
  } = deps;

  app.get('/api/activities', ah(async (req: Request, res: Response) => {
    const limit = parseLimitParam(typeof req.query?.limit === 'string' ? req.query.limit : undefined, 20, 200);
    const entityId = typeof req.query?.entityId === 'string' ? req.query.entityId.trim() : '';
    res.json(await listActivities({ entityId: entityId || undefined, limit }));
  }));

  app.post('/api/activities', requireAuth, requireRole('admin', 'manager'), ah(async (req: Request, res: Response) => {
    const row = await createActivity({
      title: req.body?.title,
      description: req.body?.description,
      category: req.body?.category,
      icon: req.body?.icon,
      color: req.body?.color,
      iconColor: req.body?.iconColor,
      entityId: req.body?.entityId,
      entityType: req.body?.entityType,
      link: req.body?.link,
    });
    res.status(201).json(row);
  }));

  app.get('/api/chat/messages', requireAuth, ah(async (req: Request, res: Response) => {
    const db = getDb();
    const limit = parseLimitParam((req.query as Record<string, string | undefined>).limit, 50, 200);
    const rows = await db.all(
      `SELECT cm.id, cm.userId, cm.content, cm.readAt, cm.createdAt,
              u.fullName AS userName, u.username
       FROM ChatMessage cm
       LEFT JOIN User u ON cm.userId = u.id
       ORDER BY cm.createdAt DESC, cm.id DESC
       LIMIT ?`,
      [limit]
    );
    res.json({ items: rows });
  }));

  app.post('/api/chat/messages', requireAuth, ah(async (req: Request, res: Response) => {
    const db = getDb();
    const userId = getCurrentUserId(req);
    const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
    if (!content) return res.status(400).json({ error: 'content is required' });
    const id = uuidv4();
    await db.run(
      `INSERT INTO ChatMessage (id, userId, content, readAt) VALUES (?, ?, ?, NULL)`,
      [id, userId, content]
    );
    const row = await db.get(
      `SELECT cm.id, cm.userId, cm.content, cm.readAt, cm.createdAt,
              u.fullName AS userName, u.username
       FROM ChatMessage cm
       LEFT JOIN User u ON cm.userId = u.id
       WHERE cm.id = ?`,
      [id]
    );
    res.status(201).json(row);
  }));

  app.get('/api/support/tickets', requireAuth, ah(async (req: Request, res: Response) => {
    const db = getDb();
    const user = (req as any).user || {};
    const userId = getCurrentUserId(req);
    const role = String(user.systemRole || '').toLowerCase();
    const isPrivileged = role === 'admin' || role === 'manager';
    const requestedScope = typeof req.query?.scope === 'string' ? req.query.scope.trim().toLowerCase() : '';
    const effectiveScope = isPrivileged && requestedScope === 'all' ? 'all' : (isPrivileged && requestedScope !== 'mine' ? 'all' : 'mine');
    const limit = parseLimitParam((req.query as Record<string, string | undefined>).limit, 100, 500);

    const conditions: string[] = [];
    const params: any[] = [];
    if (effectiveScope !== 'all') {
      conditions.push('st.createdBy = ?');
      params.push(userId);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const items = await db.all(
      `SELECT st.id,
              st.category,
              st.subject,
              st.description,
              st.status,
              st.responseNote,
              st.createdBy,
              creator.fullName AS createdByName,
              st.updatedBy,
              updater.fullName AS updatedByName,
              st.createdAt,
              st.updatedAt
       FROM SupportTicket st
       LEFT JOIN User creator ON st.createdBy = creator.id
       LEFT JOIN User updater ON st.updatedBy = updater.id
       ${whereClause}
       ORDER BY st.createdAt DESC, st.id DESC
       LIMIT ?`,
      [...params, limit]
    );

    res.json({ items, scope: effectiveScope });
  }));

  app.post('/api/support/tickets', requireAuth, ah(async (req: Request, res: Response) => {
    const db = getDb();
    const category = typeof req.body?.category === 'string' ? req.body.category.trim() : '';
    const subject = typeof req.body?.subject === 'string' ? req.body.subject.trim() : '';
    const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
    const fields: Record<string, string> = {};

    if (!category) fields.category = 'category is required';
    if (!subject) fields.subject = 'subject is required';
    if (!description) fields.description = 'description is required';

    if (Object.keys(fields).length > 0) {
      return res.status(400).json({ error: 'Validation failed', fields });
    }

    const createdBy = getCurrentUserId(req);
    const id = uuidv4();
    await db.run(
      `INSERT INTO SupportTicket (
        id, category, subject, description, status, responseNote, createdBy, updatedBy
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, category.toLowerCase(), subject, description, 'open', null, createdBy, null]
    );

    const ticket = await getSupportTicketById(db, id);
    const recipients = await db.all(
      `SELECT id
       FROM User
       WHERE LOWER(systemRole) IN ('admin', 'manager')
         AND LOWER(COALESCE(accountStatus, 'active')) = 'active'
         AND id <> ?`,
      [createdBy]
    );

    await Promise.all(
      recipients.map((recipient: any) =>
        ensureNotification(db, recipient.id, `New support ticket: ${subject}`, {
          entityType: 'SupportTicket',
          entityId: id,
          link: 'Support',
        })
      )
    );

    await logAct(
      'Support ticket submitted',
      `${ticket?.createdByName || 'User'} submitted support ticket "${subject}".`,
      'Support',
      '🛟',
      '#eff6ff',
      '#2563eb',
      id,
      'SupportTicket',
      'Support'
    );

    res.status(201).json(ticket);
  }));

  app.patch('/api/support/tickets/:id', requireAuth, requireRole('admin', 'manager'), ah(async (req: Request, res: Response) => {
    const db = getDb();
    const id = String(req.params.id || '');
    const ticket = await getSupportTicketById(db, id);
    if (!ticket) return res.status(404).json({ error: 'Support ticket not found' });

    const nextStatus = req.body?.status === undefined ? undefined : normalizeSupportTicketStatus(req.body.status);
    const responseNoteProvided = Object.prototype.hasOwnProperty.call(req.body || {}, 'responseNote');
    const responseNote = responseNoteProvided
      ? (typeof req.body?.responseNote === 'string' ? req.body.responseNote.trim() || null : req.body?.responseNote ?? null)
      : undefined;

    if (req.body?.status !== undefined && !nextStatus) {
      return res.status(400).json({
        error: 'Validation failed',
        fields: { status: `status must be one of: ${supportTicketStatuses.join(', ')}` },
      });
    }
    if (responseNoteProvided && responseNote !== null && typeof responseNote !== 'string') {
      return res.status(400).json({
        error: 'Validation failed',
        fields: { responseNote: 'responseNote must be a string or null' },
      });
    }
    if (nextStatus === undefined && responseNoteProvided === false) {
      return res.status(400).json({
        error: 'Validation failed',
        fields: { status: 'status or responseNote is required' },
      });
    }

    const updates: string[] = ['updatedBy = ?', "updatedAt = datetime('now')"];
    const params: any[] = [getCurrentUserId(req)];
    if (nextStatus !== undefined) {
      updates.push('status = ?');
      params.push(nextStatus);
    }
    if (responseNoteProvided) {
      updates.push('responseNote = ?');
      params.push(responseNote);
    }
    params.push(id);

    await db.run(`UPDATE SupportTicket SET ${updates.join(', ')} WHERE id = ?`, params);
    const updated = await getSupportTicketById(db, id);
    res.json(updated);
  }));

  app.get('/api/notifications', requireAuth, ah(async (req: Request, res: Response) => {
    const db = getDb();
    const userId = getCurrentUserId(req);
    const limit = parseLimitParam((req.query as Record<string, string | undefined>).limit, 50, 200);
    const [items, unreadRow] = await Promise.all([
      db.all(
        `SELECT id, userId, content, entityType, entityId, link, readAt, createdAt
         FROM Notification
         WHERE userId = ?
         ORDER BY createdAt DESC, id DESC
         LIMIT ?`,
        [userId, limit]
      ),
      db.get(
        `SELECT COUNT(*) AS c
         FROM Notification
         WHERE userId = ? AND readAt IS NULL`,
        [userId]
      ),
    ]);
    res.json({ items, unreadCount: Number((unreadRow as any)?.c ?? 0) });
  }));

  app.post('/api/notifications/mark-read', requireAuth, ah(async (req: Request, res: Response) => {
    const db = getDb();
    const userId = getCurrentUserId(req);
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((id: unknown) => typeof id === 'string' && id.trim()) : [];

    let result;
    if (ids.length > 0) {
      const placeholders = ids.map(() => '?').join(', ');
      result = await db.run(
        `UPDATE Notification
         SET readAt = COALESCE(readAt, datetime('now'))
         WHERE userId = ? AND readAt IS NULL AND id IN (${placeholders})`,
        [userId, ...ids]
      );
    } else {
      result = await db.run(
        `UPDATE Notification
         SET readAt = COALESCE(readAt, datetime('now'))
         WHERE userId = ? AND readAt IS NULL`,
        [userId]
      );
    }

    res.json({ success: true, updated: Number((result as any)?.changes ?? 0) });
  }));
}
