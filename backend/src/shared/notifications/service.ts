type CreateNotificationServicesDeps = {
  allowedEntityTypes: readonly string[];
  allowedLinks: readonly string[];
};

export function createNotificationServices(deps: CreateNotificationServicesDeps) {
  const allowedEntityTypes = new Set(deps.allowedEntityTypes);
  const allowedLinks = new Set(deps.allowedLinks);

  async function ensureNotification(
    db: any,
    userId: number | string | null,
    content: string,
    meta: { entityType?: string | null; entityId?: number | string | null; link?: string | null } = {}
  ) {
    if (!userId || !content.trim()) return { created: false, row: null };

    const entityType =
      meta.entityType && allowedEntityTypes.has(String(meta.entityType))
        ? String(meta.entityType)
        : null;
    const entityId = meta.entityId === 0 || meta.entityId
      ? String(meta.entityId).trim() || null
      : null;
    const link = meta.link && allowedLinks.has(String(meta.link)) ? String(meta.link) : null;

    const et = entityType ?? '';
    const eid = entityId ?? '';
    const existing = await db.get(
      `SELECT id FROM Notification
       WHERE userId = ? AND content = ?
         AND IFNULL(entityType, '') = ?
         AND IFNULL(entityId, '') = ?`,
      [userId, content, et, eid]
    );
    if (existing) return { created: false, row: existing };

    const result = await db.run(
      `INSERT INTO Notification (userId, content, entityType, entityId, link, readAt)
       VALUES (?, ?, ?, ?, ?, NULL)`,
      [userId, content, entityType, entityId, link]
    );

    return { created: true, row: await db.get('SELECT * FROM Notification WHERE id = ?', [result.lastID]) };
  }

  return {
    ensureNotification,
  };
}
