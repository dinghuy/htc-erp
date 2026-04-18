import type { Express, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createCollaborationRepository } from './repository';

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

function decorateSupportTicketRow(ticket: any, options: { isPrivileged: boolean }) {
  const status = String(ticket?.status || '').trim().toLowerCase();
  const blockers: string[] = [];
  if (status === 'open') blockers.push('Chưa có phản hồi kỹ thuật');
  if (status === 'in_progress') blockers.push('Đang chờ xử lý hoặc xác nhận');
  return {
    ...ticket,
    actionAvailability: {
      supportTab: 'Ticket',
      canOpenTicket: true,
      canManageTicket: options.isPrivileged,
      primaryActionLabel: options.isPrivileged ? 'Review ticket' : 'Theo dõi ticket',
      blockers,
    },
  };
}

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function mapThreadRow(row: any) {
  return {
    id: row.id,
    entityType: row.entityType,
    entityId: row.entityId,
    title: row.title ?? null,
    status: row.status || 'active',
    messageCount: Number(row.messageCount || 0),
    lastMessageAt: row.lastMessageAt ?? null,
    createdBy: row.createdBy ?? null,
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
  };
}

function mapThreadMessageRow(row: any) {
  return {
    id: row.id,
    threadId: row.threadId,
    authorUserId: row.authorUserId ?? null,
    authorName: row.authorName ?? null,
    content: row.content,
    contentType: row.contentType ?? 'text/plain',
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
  };
}

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
  const collaborationRepository = createCollaborationRepository();

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
    const limit = parseLimitParam((req.query as Record<string, string | undefined>).limit, 50, 200);
    res.json({ items: await collaborationRepository.listChatMessages(limit) });
  }));

  app.post('/api/chat/messages', requireAuth, ah(async (req: Request, res: Response) => {
    const userId = getCurrentUserId(req);
    const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
    if (!content) return res.status(400).json({ error: 'content is required' });
    const id = uuidv4();
    await collaborationRepository.createChatMessage({ id, userId, content });
    res.status(201).json(await collaborationRepository.findChatMessageById(id));
  }));

  app.get('/api/support/tickets', requireAuth, ah(async (req: Request, res: Response) => {
    const user = (req as any).user || {};
    const userId = getCurrentUserId(req);
    const role = String(user.systemRole || '').toLowerCase();
    const isPrivileged = role === 'admin' || role === 'manager';
    const requestedScope = typeof req.query?.scope === 'string' ? req.query.scope.trim().toLowerCase() : '';
    const effectiveScope = isPrivileged && requestedScope === 'all' ? 'all' : (isPrivileged && requestedScope !== 'mine' ? 'all' : 'mine');
    const limit = parseLimitParam((req.query as Record<string, string | undefined>).limit, 100, 500);

    const items = await collaborationRepository.listSupportTickets({
      createdBy: effectiveScope === 'all' ? undefined : userId,
      limit,
    });

    res.json({
      items: items.map((item: any) => decorateSupportTicketRow(item, { isPrivileged })),
      scope: effectiveScope,
    });
  }));

  app.post('/api/support/tickets', requireAuth, ah(async (req: Request, res: Response) => {
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
    await collaborationRepository.createSupportTicket({
      id,
      category: category.toLowerCase(),
      subject,
      description,
      createdBy,
    });

    const ticket = await collaborationRepository.withDb((db) => getSupportTicketById(db, id));
    const recipients = await collaborationRepository.listSupportTicketRecipients(createdBy);

    await Promise.all(
      recipients.map((recipient: any) =>
        collaborationRepository.withDb((db) =>
          ensureNotification(db, recipient.id, `New support ticket: ${subject}`, {
            entityType: 'SupportTicket',
            entityId: id,
            link: 'Support',
          })
        )
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

    res.status(201).json(decorateSupportTicketRow(ticket, {
      isPrivileged: ['admin', 'manager'].includes(String((req as any).user?.systemRole || '').toLowerCase()),
    }));
  }));

  app.patch('/api/support/tickets/:id', requireAuth, requireRole('admin', 'manager'), ah(async (req: Request, res: Response) => {
    const id = String(req.params.id || '');
    const ticket = await collaborationRepository.withDb((db) => getSupportTicketById(db, id));
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

    await collaborationRepository.updateSupportTicketById(id, {
      updatedBy: getCurrentUserId(req),
      status: nextStatus,
      responseNoteProvided,
      responseNote,
    });
    const updated = await collaborationRepository.withDb((db) => getSupportTicketById(db, id));
    res.json(decorateSupportTicketRow(updated, {
      isPrivileged: ['admin', 'manager'].includes(String((req as any).user?.systemRole || '').toLowerCase()),
    }));
  }));

  app.get('/api/notifications', requireAuth, ah(async (req: Request, res: Response) => {
    const userId = getCurrentUserId(req);
    const limit = parseLimitParam((req.query as Record<string, string | undefined>).limit, 50, 200);
    const [items, unreadRow] = await Promise.all([
      collaborationRepository.listNotifications(userId, limit),
      collaborationRepository.countUnreadNotifications(userId),
    ]);
    res.json({ items, unreadCount: Number((unreadRow as any)?.c ?? 0) });
  }));

  app.post('/api/notifications/mark-read', requireAuth, ah(async (req: Request, res: Response) => {
    const userId = getCurrentUserId(req);
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((id: unknown) => typeof id === 'string' && id.trim()) : [];
    const result = await collaborationRepository.markNotificationsRead(userId, ids);
    res.json({ success: true, updated: Number((result as any)?.changes ?? 0) });
  }));

  app.get('/api/v1/threads', requireAuth, ah(async (req: Request, res: Response) => {
    const limit = parseLimitParam((req.query as Record<string, string | undefined>).limit, 50, 200);
    const entityType = typeof req.query?.entityType === 'string' ? req.query.entityType.trim() : '';
    const entityId = typeof req.query?.entityId === 'string' ? req.query.entityId.trim() : '';
    const items = await collaborationRepository.listEntityThreads({
      entityType: entityType || undefined,
      entityId: entityId || undefined,
      limit,
    });
    res.json({ items: items.map(mapThreadRow) });
  }));

  app.post('/api/v1/threads', requireAuth, ah(async (req: Request, res: Response) => {
    const entityType = typeof req.body?.entityType === 'string' ? req.body.entityType.trim() : '';
    const entityId =
      typeof req.body?.entityId === 'string'
        ? req.body.entityId.trim()
        : typeof req.body?.entityId === 'number'
          ? String(req.body.entityId).trim()
          : '';
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    if (!entityType) return res.status(400).json({ error: 'entityType is required' });
    if (!entityId) return res.status(400).json({ error: 'entityId is required' });

    const id = await collaborationRepository.createEntityThread({
      entityType,
      entityId,
      title: title || null,
      status: 'active',
      createdBy: getCurrentUserId(req),
    });
    res.status(201).json(mapThreadRow(await collaborationRepository.findEntityThreadById(id)));
  }));

  app.get('/api/v1/threads/:id/messages', requireAuth, ah(async (req: Request, res: Response) => {
    const id = getSingleParam(req.params.id);
    if (!id) return res.status(400).json({ error: 'id is required' });
    const limit = parseLimitParam((req.query as Record<string, string | undefined>).limit, 100, 500);
    const thread = await collaborationRepository.findEntityThreadById(id);
    if (!thread) return res.status(404).json({ error: 'Thread not found' });
    const items = await collaborationRepository.listEntityThreadMessages(id, limit);
    res.json({ items: items.map(mapThreadMessageRow) });
  }));

  app.post('/api/v1/threads/:id/messages', requireAuth, ah(async (req: Request, res: Response) => {
    const id = getSingleParam(req.params.id);
    if (!id) return res.status(400).json({ error: 'id is required' });
    const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
    if (!content) return res.status(400).json({ error: 'content is required' });
    const thread = await collaborationRepository.findEntityThreadById(id);
    if (!thread) return res.status(404).json({ error: 'Thread not found' });

    const messageId = await collaborationRepository.createEntityThreadMessage({
      threadId: id,
      authorUserId: getCurrentUserId(req),
      content,
      contentType: typeof req.body?.contentType === 'string' ? req.body.contentType.trim() : 'text/plain',
    });
    res.status(201).json(mapThreadMessageRow(await collaborationRepository.findEntityThreadMessageById(messageId)));
  }));
}
