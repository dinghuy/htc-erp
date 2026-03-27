type CreateActivityServicesDeps = {
  getDb: () => any;
  createId: () => string;
};

type ActivityAuditMetadata = {
  actorUserId?: string | null;
  actorRoles?: string | null;
  actingCapability?: string | null;
  action?: string | null;
  timestamp?: string | null;
};

export function createActivityServices(deps: CreateActivityServicesDeps) {
  const { getDb, createId } = deps;

  async function listActivities(options: { entityId?: string; limit: number }) {
    const db = getDb();
    const params: any[] = [];
    let query = `
      SELECT Activity.*,
             Account.companyName as accName,
             Account.shortName as accShortName,
             Contact.firstName as conFirst,
             Contact.lastName as conLast,
             Contact.gender as conGender,
             ContactAccount.companyName as conAccName,
             ContactAccount.shortName as conAccShortName,
             ActorUser.fullName as actorName,
             ActorUser.username as actorUsername
      FROM Activity
      LEFT JOIN Account ON Activity.entityType = 'Account' AND Activity.entityId = Account.id
      LEFT JOIN Contact ON Activity.entityType = 'Contact' AND Activity.entityId = Contact.id
      LEFT JOIN Account as ContactAccount ON Contact.accountId = ContactAccount.id
      LEFT JOIN User as ActorUser ON Activity.actorUserId = ActorUser.id
    `;

    if (options.entityId) {
      query += ' WHERE Activity.entityId = ?';
      params.push(options.entityId);
    }

    query += ' ORDER BY Activity.createdAt DESC LIMIT ?';
    params.push(options.limit);

    const rows = await db.all(query, params);
    return rows.map((row: any) => {
      let entityDisplay = '';
      if (row.entityType === 'Account') {
        entityDisplay = row.accShortName || row.accName || '';
      } else if (row.entityType === 'Contact') {
        const name = `${row.conLast || ''} ${row.conFirst || ''}`.trim();
        const company = row.conAccShortName || row.conAccName || '';
        entityDisplay = company ? `${name} - ${company}` : name;
      }
      const actorDisplay = row.actorName || row.actorUsername || '';
      return { ...row, entityDisplay, actorDisplay };
    });
  }

  async function createActivity(input: {
    title: string;
    description?: string | null;
    category?: string | null;
    icon?: string | null;
    color?: string | null;
    iconColor?: string | null;
    entityId?: string | null;
    entityType?: string | null;
    link?: string | null;
    actorUserId?: string | null;
    actorRoles?: string | null;
    actingCapability?: string | null;
    action?: string | null;
    timestamp?: string | null;
  }) {
    const db = getDb();
    const id = createId();
    await db.run(
      `INSERT INTO Activity (
        id, title, description, category, icon, color, iconColor, entityId, entityType, link,
        actorUserId, actorRoles, actingCapability, action, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.title,
        input.description || null,
        input.category || null,
        input.icon || null,
        input.color || null,
        input.iconColor || null,
        input.entityId || null,
        input.entityType || null,
        input.link || null,
        input.actorUserId || null,
        input.actorRoles || null,
        input.actingCapability || null,
        input.action || null,
        input.timestamp || new Date().toISOString(),
      ]
    );
    return db.get('SELECT * FROM Activity WHERE id = ?', [id]);
  }

  async function logAct(
    title: string,
    description: string,
    category: string,
    icon: string,
    color: string,
    iconColor: string,
    entityId?: string,
    entityType?: string,
    link?: string,
    audit?: ActivityAuditMetadata
  ) {
    try {
      const db = getDb();
      await db.run(
        `INSERT INTO Activity (
          id, title, description, category, icon, color, iconColor, entityId, entityType, link,
          actorUserId, actorRoles, actingCapability, action, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          createId(),
          title,
          description,
          category,
          icon,
          color,
          iconColor,
          entityId || null,
          entityType || null,
          link || null,
          audit?.actorUserId || null,
          audit?.actorRoles || null,
          audit?.actingCapability || null,
          audit?.action || null,
          audit?.timestamp || new Date().toISOString(),
        ]
      );
    } catch (err) {
      console.error('Log failed', err);
    }
  }

  return {
    listActivities,
    createActivity,
    logAct,
  };
}
