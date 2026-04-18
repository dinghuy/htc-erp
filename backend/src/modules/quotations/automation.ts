type CreateQuotationAutomationServicesDeps = {
  ensureNotification: (
    db: any,
    userId: string | null,
    content: string,
    meta?: { entityType?: string | null; entityId?: string | null; link?: string | null }
  ) => Promise<{ created: boolean; row: any }>;
  resolveAssigneeId: (
    db: any,
    preferredAssigneeId: unknown,
    salesperson: unknown,
    fallbackUserId: string | null
  ) => Promise<string | null>;
  getTaskWithLinksById: (db: any, id: string | number) => Promise<any>;
  logAct: (...args: any[]) => Promise<void>;
};

export function createQuotationAutomationServices(deps: CreateQuotationAutomationServicesDeps) {
  const {
    ensureNotification,
    resolveAssigneeId,
    getTaskWithLinksById,
    logAct,
  } = deps;

  function buildQuotationAutomationNotes(quotationId: string, status: 'submitted_for_approval' | 'won') {
    return `AUTO:quotation-status:${status};quotationId=${quotationId}`;
  }

  async function triggerQuotationAutomation(
    db: any,
    quotation: any,
    status: 'submitted_for_approval' | 'won',
    actorUserId: string | null,
    extra: { triggerSource?: string; projectId?: string | null; leadId?: string | null } = {}
  ) {
    if (!quotation?.id || !['submitted_for_approval', 'won'].includes(status)) {
      return { taskCreated: false, notificationCreated: false, task: null };
    }

    const assigneeId = await resolveAssigneeId(
      db,
      quotation.salespersonId || quotation.assigneeId,
      quotation.salesperson,
      actorUserId
    );
    const taskLabel = status === 'won' ? 'Process won quotation' : 'Follow up approval-submitted quotation';
    const ref = quotation.quoteNumber || quotation.id;
    const dueDays = status === 'won' ? 1 : 2;
    const dueDate = new Date(Date.now() + dueDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const existingNotes = buildQuotationAutomationNotes(quotation.id, status);
    const existingTask = await db.get(
      `SELECT id FROM Task
       WHERE quotationId = ? AND notes = ? AND name = ?`,
      [quotation.id, existingNotes, `${taskLabel} ${ref}`]
    );
    let taskCreated = false;
    let taskRow = existingTask ? await getTaskWithLinksById(db, existingTask.id) : null;

    if (!existingTask) {
      const taskStatus = status === 'won' ? 'active' : 'pending';
      const taskPriority = status === 'won' ? 'high' : 'medium';
      const insertResult = await db.run(
        `INSERT INTO Task (
          projectId, name, description, assigneeId, status, priority,
          startDate, dueDate, completionPct, notes, accountId, leadId, quotationId,
          target, resultLinks, output, reportDate
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          extra.projectId || null,
          `${taskLabel} ${ref}`,
          status === 'won'
            ? `Quotation ${ref} has been accepted. Prepare handoff, delivery, or implementation follow-up.`
            : `Quotation ${ref} was submitted for approval. Follow up with approvers and keep the opportunity moving.`,
          assigneeId || actorUserId || null,
          taskStatus,
          taskPriority,
          new Date().toISOString().slice(0, 10),
          dueDate,
          0,
          existingNotes,
          quotation.accountId || null,
          extra.leadId || quotation.leadId || quotation.opportunityId || null,
          quotation.id,
          `Quotation lifecycle automation: ${status}`,
          null,
          null,
          null,
        ]
      );
      taskRow = await getTaskWithLinksById(db, insertResult.lastID);
      taskCreated = true;
    }

    const notificationContent =
      status === 'won'
        ? `Quotation ${ref} was accepted and a follow-up task has been created.`
        : `Quotation ${ref} was submitted for approval and a follow-up task has been created.`;
    const notification = await ensureNotification(db, assigneeId || actorUserId, notificationContent, {
      entityType: 'Quotation',
      entityId: quotation.id,
      link: 'Sales',
    });

    const taskNotification = taskRow?.id
      ? await ensureNotification(db, assigneeId || actorUserId, `New task created: ${taskRow.name}`, {
          entityType: 'Task',
          entityId: taskRow.id,
          link: 'Tasks',
        })
      : { created: false, row: null };

    if (taskCreated) {
      await logAct(
        status === 'won' ? 'Quotation won automation' : 'Quotation approval submission automation',
        `${ref} -> task created for ${taskRow?.assigneeName || assigneeId || 'unassigned'}`,
        'Task',
        '⚙️',
        '#f1f5f9',
        '#475569',
        taskRow?.id,
        'Task'
      );
    }

    return {
      taskCreated,
      notificationCreated: notification.created || taskNotification.created,
      task: taskRow,
      assigneeId: assigneeId || actorUserId || null,
    };
  }

  return {
    buildQuotationAutomationNotes,
    triggerQuotationAutomation,
  };
}
