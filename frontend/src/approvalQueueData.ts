type ApprovalQueueItem = {
  id?: number | string;
  approvalRequestId?: number | string;
  lane?: string | null;
  status?: string | null;
  title?: string | null;
  requestType?: string | null;
  projectId?: number | string | null;
  taskId?: number | string | null;
  projectCode?: string | null;
  projectName?: string | null;
  requestedByName?: string | null;
  requestedBy?: number | string | null;
  department?: string | null;
  approverRole?: string | null;
  approverUserId?: number | string | null;
  dueAt?: string | null;
  note?: string | null;
  actionAvailability?: {
    lane?: string | null;
    canDecide?: boolean;
    isRequester?: boolean;
    isAssignedApprover?: boolean;
    availableDecisions?: string[];
  } | null;
};

type ApprovalQueuePayload = {
  persona?: {
    primaryRole?: string;
    roleCodes?: string[];
    mode?: string;
  };
  items?: ApprovalQueueItem[];
};

type LegacyApprovalsCopy = {
  title: string;
  description: string;
};

export function buildApprovalQueueCards(summary?: {
  pendingCount?: number;
  financeCount?: number;
  legalCount?: number;
  executiveCount?: number;
  procurementCount?: number;
  deliveryCount?: number;
}) {
  const safe = summary || {};
  const cards = [
    { label: 'Pending approvals', value: Number(safe.pendingCount || 0), tone: 'warn' as const },
    { label: 'Finance + Legal', value: Number(safe.financeCount || 0) + Number(safe.legalCount || 0), tone: 'info' as const },
    { label: 'Executive lane', value: Number(safe.executiveCount || 0), tone: 'bad' as const },
  ];

  if (Number(safe.deliveryCount || 0) > 0) {
    cards.push({ label: 'Delivery lane', value: Number(safe.deliveryCount || 0), tone: 'info' as const });
  }

  return cards;
}

export function mapApprovalQueuePayload(payload: ApprovalQueuePayload, fallbackView: LegacyApprovalsCopy) {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const summary = items.reduce(
    (acc, item) => {
      const lane = String(item.lane || item.actionAvailability?.lane || '').trim().toLowerCase();
      if (String(item.status || '').trim().toLowerCase() === 'pending') {
        acc.pendingCount += 1;
      }
      if (lane === 'finance') acc.financeCount += 1;
      if (lane === 'legal') acc.legalCount += 1;
      if (lane === 'executive') acc.executiveCount += 1;
      if (lane === 'procurement') acc.procurementCount += 1;
      if (lane === 'delivery') acc.deliveryCount += 1;
      return acc;
    },
    {
      totalCount: items.length,
      pendingCount: 0,
      executiveCount: 0,
      financeCount: 0,
      legalCount: 0,
      procurementCount: 0,
      deliveryCount: 0,
    },
  );

  const approvals = items.map((item) => ({
    id: Number(item.approvalRequestId || item.id || 0),
    title: item.title || item.requestType || 'Approval request',
    requestType: item.requestType || 'approval',
    status: item.status || 'pending',
    note: item.note ?? null,
    dueDate: item.dueAt ?? null,
    projectCode: item.projectCode ?? null,
    projectName: item.projectName ?? null,
    requestedByName: item.requestedByName ?? null,
    requestedBy: item.requestedBy ? Number(item.requestedBy) : null,
    department: item.department ?? null,
    approverRole: item.approverRole ?? null,
    approverUserId: item.approverUserId ? Number(item.approverUserId) : null,
    actionAvailability: {
      lane: item.actionAvailability?.lane || item.lane || null,
      canDecide: Boolean(item.actionAvailability?.canDecide),
      isRequester: Boolean(item.actionAvailability?.isRequester),
      isAssignedApprover: item.actionAvailability?.isAssignedApprover ?? true,
      availableDecisions: Array.isArray(item.actionAvailability?.availableDecisions)
        ? item.actionAvailability.availableDecisions
        : [],
    },
  }));

  return {
    persona: payload?.persona || undefined,
    summary,
    view: fallbackView,
    cards: buildApprovalQueueCards(summary),
    approvals,
  };
}
