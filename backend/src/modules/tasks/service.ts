type CreateTaskServicesDeps = {};

export function createTaskServices(_deps: CreateTaskServicesDeps = {}) {
  function normalizeLookupText(value: unknown): string {
    return String(value ?? '').trim().toLowerCase();
  }

  async function findUserByIdentifier(db: any, identifier: unknown) {
    const normalized = normalizeLookupText(identifier);
    if (!normalized) return null;
    return db.get(
      `SELECT id, fullName, username, email
       FROM User
       WHERE LOWER(TRIM(id)) = ?
          OR LOWER(TRIM(fullName)) = ?
          OR LOWER(TRIM(username)) = ?
          OR LOWER(TRIM(email)) = ?
       ORDER BY CASE
         WHEN LOWER(TRIM(fullName)) = ? THEN 0
         WHEN LOWER(TRIM(username)) = ? THEN 1
         WHEN LOWER(TRIM(email)) = ? THEN 2
         ELSE 3
       END
       LIMIT 1`,
      [normalized, normalized, normalized, normalized, normalized, normalized, normalized]
    );
  }

  async function resolveAssigneeId(
    db: any,
    preferredAssigneeId: unknown,
    salesperson: unknown,
    fallbackUserId: string | null
  ) {
    if (typeof preferredAssigneeId === 'string' && preferredAssigneeId.trim()) {
      const direct = await findUserByIdentifier(db, preferredAssigneeId);
      if (direct?.id) return direct.id;
    }

    const salespersonUser = await findUserByIdentifier(db, salesperson);
    if (salespersonUser?.id) return salespersonUser.id;

    if (fallbackUserId) {
      const fallbackUser = await findUserByIdentifier(db, fallbackUserId);
      if (fallbackUser?.id) return fallbackUser.id;
      return fallbackUserId;
    }

    return null;
  }

  async function getTaskWithLinksById(db: any, id: string) {
    return db.get(
      `
        SELECT t.*,
               u.fullName AS assigneeName,
               p.name AS projectName,
               p.projectStage AS projectStage,
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
      [id]
    );
  }

  return {
    findUserByIdentifier,
    resolveAssigneeId,
    getTaskWithLinksById,
  };
}
