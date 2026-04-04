import { getDb } from '../../../sqlite-db';

type ListSupportTicketsOptions = {
  createdBy?: string;
  limit: number;
};

type ListThreadsOptions = {
  entityType?: string;
  entityId?: string;
  limit: number;
};

export function createCollaborationRepository() {
  async function withDb<T>(operation: (db: any) => Promise<T>) {
    return operation(getDb());
  }

  function listChatMessages(limit: number) {
    return getDb().all(
      `SELECT cm.id, cm.userId, cm.content, cm.readAt, cm.createdAt,
              u.fullName AS userName, u.username
       FROM ChatMessage cm
       LEFT JOIN User u ON cm.userId = u.id
       ORDER BY cm.createdAt DESC, cm.id DESC
       LIMIT ?`,
      [limit]
    );
  }

  async function createChatMessage(input: { id: string; userId: string; content: string }) {
    await getDb().run(
      `INSERT INTO ChatMessage (id, userId, content, readAt) VALUES (?, ?, ?, NULL)`,
      [input.id, input.userId, input.content]
    );
  }

  function findChatMessageById(id: string) {
    return getDb().get(
      `SELECT cm.id, cm.userId, cm.content, cm.readAt, cm.createdAt,
              u.fullName AS userName, u.username
       FROM ChatMessage cm
       LEFT JOIN User u ON cm.userId = u.id
       WHERE cm.id = ?`,
      [id]
    );
  }

  function listSupportTickets(options: ListSupportTicketsOptions) {
    const conditions: string[] = [];
    const params: any[] = [];
    if (options.createdBy) {
      conditions.push('st.createdBy = ?');
      params.push(options.createdBy);
    }
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    return getDb().all(
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
      [...params, options.limit]
    );
  }

  async function createSupportTicket(input: {
    id: string;
    category: string;
    subject: string;
    description: string;
    createdBy: string;
  }) {
    await getDb().run(
      `INSERT INTO SupportTicket (
        id, category, subject, description, status, responseNote, createdBy, updatedBy
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [input.id, input.category, input.subject, input.description, 'open', null, input.createdBy, null]
    );
  }

  function listSupportTicketRecipients(excludedUserId: string) {
    return getDb().all(
      `SELECT id
       FROM User
       WHERE LOWER(systemRole) IN ('admin', 'manager')
         AND LOWER(COALESCE(accountStatus, 'active')) = 'active'
         AND id <> ?`,
      [excludedUserId]
    );
  }

  async function updateSupportTicketById(
    id: string,
    input: {
      updatedBy: string;
      status?: string;
      responseNoteProvided: boolean;
      responseNote?: string | null;
    }
  ) {
    const updates: string[] = ['updatedBy = ?', "updatedAt = datetime('now')"];
    const params: any[] = [input.updatedBy];

    if (input.status !== undefined) {
      updates.push('status = ?');
      params.push(input.status);
    }
    if (input.responseNoteProvided) {
      updates.push('responseNote = ?');
      params.push(input.responseNote ?? null);
    }
    params.push(id);

    await getDb().run(`UPDATE SupportTicket SET ${updates.join(', ')} WHERE id = ?`, params);
  }

  function listEntityThreads(options: ListThreadsOptions) {
    const conditions: string[] = [];
    const params: any[] = [];
    if (options.entityType) {
      conditions.push('et.entityType = ?');
      params.push(options.entityType);
    }
    if (options.entityId) {
      conditions.push('et.entityId = ?');
      params.push(options.entityId);
    }
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    return getDb().all(
      `SELECT et.*,
              (
                SELECT COUNT(*)
                FROM EntityThreadMessage etm
                WHERE etm.threadId = et.id
              ) AS messageCount,
              (
                SELECT MAX(createdAt)
                FROM EntityThreadMessage etm
                WHERE etm.threadId = et.id
              ) AS lastMessageAt
       FROM EntityThread et
       ${whereClause}
       ORDER BY et.updatedAt DESC, et.createdAt DESC
       LIMIT ?`,
      [...params, options.limit]
    );
  }

  async function createEntityThread(input: {
    id: string;
    entityType: string;
    entityId: string;
    title?: string | null;
    status?: string | null;
    createdBy?: string | null;
  }) {
    await getDb().run(
      `INSERT INTO EntityThread (id, entityType, entityId, title, status, createdBy, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [input.id, input.entityType, input.entityId, input.title ?? null, input.status ?? 'active', input.createdBy ?? null]
    );
  }

  function findEntityThreadById(id: string) {
    return getDb().get(
      `SELECT et.*,
              (
                SELECT COUNT(*)
                FROM EntityThreadMessage etm
                WHERE etm.threadId = et.id
              ) AS messageCount,
              (
                SELECT MAX(createdAt)
                FROM EntityThreadMessage etm
                WHERE etm.threadId = et.id
              ) AS lastMessageAt
       FROM EntityThread et
       WHERE et.id = ?`,
      [id]
    );
  }

  function listEntityThreadMessages(threadId: string, limit: number) {
    return getDb().all(
      `SELECT etm.*,
              u.fullName AS authorName
       FROM EntityThreadMessage etm
       LEFT JOIN User u ON u.id = etm.authorUserId
       WHERE etm.threadId = ?
       ORDER BY etm.createdAt DESC, etm.id DESC
       LIMIT ?`,
      [threadId, limit]
    );
  }

  async function createEntityThreadMessage(input: {
    id: string;
    threadId: string;
    authorUserId?: string | null;
    content: string;
    contentType?: string | null;
  }) {
    await getDb().run(
      `INSERT INTO EntityThreadMessage (id, threadId, authorUserId, content, contentType, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [input.id, input.threadId, input.authorUserId ?? null, input.content, input.contentType ?? 'text/plain']
    );
    await getDb().run(`UPDATE EntityThread SET updatedAt = datetime('now') WHERE id = ?`, [input.threadId]);
  }

  function findEntityThreadMessageById(id: string) {
    return getDb().get(
      `SELECT etm.*,
              u.fullName AS authorName
       FROM EntityThreadMessage etm
       LEFT JOIN User u ON u.id = etm.authorUserId
       WHERE etm.id = ?`,
      [id]
    );
  }

  function listNotifications(userId: string, limit: number) {
    return getDb().all(
      `SELECT id, userId, content, entityType, entityId, link, readAt, createdAt
       FROM Notification
       WHERE userId = ?
       ORDER BY createdAt DESC, id DESC
       LIMIT ?`,
      [userId, limit]
    );
  }

  function countUnreadNotifications(userId: string) {
    return getDb().get(
      `SELECT COUNT(*) AS c
       FROM Notification
       WHERE userId = ? AND readAt IS NULL`,
      [userId]
    );
  }

  async function markNotificationsRead(userId: string, ids: string[]) {
    if (ids.length > 0) {
      const placeholders = ids.map(() => '?').join(', ');
      return getDb().run(
        `UPDATE Notification
         SET readAt = COALESCE(readAt, datetime('now'))
         WHERE userId = ? AND readAt IS NULL AND id IN (${placeholders})`,
        [userId, ...ids]
      );
    }

    return getDb().run(
      `UPDATE Notification
       SET readAt = COALESCE(readAt, datetime('now'))
       WHERE userId = ? AND readAt IS NULL`,
      [userId]
    );
  }

  return {
    withDb,
    listChatMessages,
    createChatMessage,
    findChatMessageById,
    listSupportTickets,
    createSupportTicket,
    listSupportTicketRecipients,
    updateSupportTicketById,
    listEntityThreads,
    createEntityThread,
    findEntityThreadById,
    listEntityThreadMessages,
    createEntityThreadMessage,
    findEntityThreadMessageById,
    listNotifications,
    countUnreadNotifications,
    markNotificationsRead,
  };
}
