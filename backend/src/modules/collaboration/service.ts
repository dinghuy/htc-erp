type CreateCollaborationServicesDeps = {
  supportTicketStatuses: readonly string[];
};

export function createCollaborationServices(deps: CreateCollaborationServicesDeps) {
  const supportTicketStatuses = new Set(deps.supportTicketStatuses);

  function normalizeSupportTicketStatus(value: unknown): string | null {
    const status = typeof value === 'string' ? value.trim().toLowerCase() : '';
    return supportTicketStatuses.has(status) ? status : null;
  }

  async function getSupportTicketById(db: any, id: string) {
    return db.get(
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
       WHERE st.id = ?`,
      [id]
    );
  }

  return {
    normalizeSupportTicketStatus,
    getSupportTicketById,
  };
}
