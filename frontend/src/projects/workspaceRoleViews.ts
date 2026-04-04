import { resolveApprovalLane } from '../shared/domain/contracts';

function ensureArray<T = any>(value: any): T[] {
  return Array.isArray(value) ? value : [];
}

function matchesKeyword(value: any, keywords: string[]) {
  const text = String(value || '').toLowerCase();
  return keywords.some((keyword) => text.includes(keyword));
}

export function buildFinanceWorkspaceSummary(input: {
  workspace?: any;
  approvals?: any[];
  milestones?: any[];
  overdueDeliveryLines?: any[];
}) {
  const approvals = ensureArray(input.approvals);
  const milestones = ensureArray(input.milestones);
  const documents = ensureArray(input.workspace?.documents);
  const financeApprovals = approvals.filter((approval) => resolveApprovalLane(approval) === 'finance');
  const pendingFinanceApprovals = financeApprovals.filter((approval) => String(approval.status || '').toLowerCase() === 'pending');
  const receivableApprovals = financeApprovals.filter((approval) =>
    matchesKeyword(approval.requestType, ['receivable', 'payment', 'invoice']) ||
    matchesKeyword(approval.title, ['receivable', 'payment', 'invoice']),
  );
  const paymentMilestones = milestones.filter((milestone) =>
    matchesKeyword(milestone.milestoneType, ['payment', 'invoice', 'finance']) ||
    matchesKeyword(milestone.title, ['payment', 'invoice', 'deposit']),
  );
  const pendingPaymentMilestones = paymentMilestones.filter((milestone) => String(milestone.status || '').toLowerCase() !== 'completed');
  const financeDocuments = documents.filter((document) =>
    matchesKeyword(document.department, ['finance', 'accounting']) ||
    matchesKeyword(document.category, ['finance', 'invoice', 'vat']) ||
    matchesKeyword(document.documentName, ['invoice', 'vat', 'payment']),
  );
  const missingFinanceDocuments = financeDocuments.filter((document) => ['missing', 'requested'].includes(String(document.status || '').toLowerCase()));

  return {
    financeApprovals,
    pendingFinanceApprovals,
    receivableApprovals,
    paymentMilestones,
    pendingPaymentMilestones,
    financeDocuments,
    missingFinanceDocuments,
    deliveryRiskCount: ensureArray(input.overdueDeliveryLines).length,
  };
}

export function buildLegalWorkspaceSummary(input: {
  workspace?: any;
  approvals?: any[];
  contractAppendices?: any[];
}) {
  const approvals = ensureArray(input.approvals);
  const documents = ensureArray(input.workspace?.documents);
  const appendices = ensureArray(input.contractAppendices);
  const legalApprovals = approvals.filter((approval) => resolveApprovalLane(approval) === 'legal');
  const pendingLegalApprovals = legalApprovals.filter((approval) => String(approval.status || '').toLowerCase() === 'pending');
  const deviationApprovals = legalApprovals.filter((approval) =>
    matchesKeyword(approval.requestType, ['deviation', 'clause']) ||
    matchesKeyword(approval.title, ['deviation', 'exception', 'clause']),
  );
  const legalDocuments = documents.filter((document) =>
    matchesKeyword(document.department, ['legal']) ||
    matchesKeyword(document.category, ['contract', 'legal']) ||
    matchesKeyword(document.documentName, ['contract', 'appendix', 'legal']),
  );
  const missingLegalDocuments = legalDocuments.filter((document) => ['missing', 'requested'].includes(String(document.status || '').toLowerCase()));
  const signedAppendices = appendices.filter((appendix) => ['signed', 'effective'].includes(String(appendix.status || '').toLowerCase()));

  return {
    legalApprovals,
    pendingLegalApprovals,
    deviationApprovals,
    legalDocuments,
    missingLegalDocuments,
    signedAppendices,
  };
}

export function buildDocumentWorkspaceSummary(input: { workspace?: any }) {
  const documents = ensureArray(input.workspace?.documents);
  const approvals = ensureArray(input.workspace?.approvals);
  const activities = ensureArray(input.workspace?.activities);
  const timeline = ensureArray(input.workspace?.timeline);
  const blockerRegister = ensureArray(input.workspace?.blockerRegister);
  const auditTrail = ensureArray(input.workspace?.auditTrail);
  const phaseControlBlockers = ensureArray(input.workspace?.phaseControl?.blockers).map((blocker: any, index: number) => ({
    id: blocker.id || `phase-${index}`,
    source: 'phase_control',
    title: blocker.title || 'Blocker giai đoạn',
    detail: blocker.detail || blocker.description || 'Cần xử lý trước khi đi tiếp.',
    tone: blocker.tone || 'warning',
    action: blocker.action || null,
  }));
  const salesOrderBlockers = ensureArray(input.workspace?.actionAvailability?.salesOrder?.blockers).map((detail: string, index: number) => ({
    id: `sales-order-${index}`,
    source: 'sales_order',
    title: 'Gate sales order / release',
    detail,
    tone: 'warning',
    action: 'openCommercial',
  }));
  const logisticsBlockers = ensureArray(input.workspace?.actionAvailability?.project?.logisticsBlockers).map((detail: string, index: number) => ({
    id: `logistics-${index}`,
    source: 'logistics',
    title: 'Gate logistics / delivery',
    detail,
    tone: 'danger',
    action: 'openDelivery',
  }));
  const approvalWatchlist = approvals.slice(0, 6).map((approval) => ({
    id: approval.id,
    type: 'approval',
    title: approval.title || approval.requestType || approval.id,
    detail: approval.note || approval.description || 'Approval item',
    meta: `${resolveApprovalLane(approval)} · ${approval.status || 'pending'}`,
    eventDate: approval.updatedAt || approval.createdAt || null,
  }));
  const timelineEvents = timeline.slice(0, 6).map((event) => ({
    id: `timeline-${event.id}`,
    type: 'timeline',
    title: event.title || event.eventType || event.id,
    detail: event.description || 'Timeline event',
    meta: event.eventType || 'timeline',
    eventDate: event.eventDate || event.createdAt || null,
  }));
  const activityEvents = activities.slice(0, 6).map((activity) => ({
    id: `activity-${activity.id}`,
    type: 'activity',
    title: activity.action || activity.entityType || activity.id,
    detail: activity.description || activity.note || 'Activity log',
    meta: `${activity.actorDisplayName || activity.userName || activity.actorRoles || 'system'}`,
    eventDate: activity.timestamp || activity.createdAt || null,
  }));
  const groupedByDepartment = documents.reduce((acc, document) => {
    const key = String(document.department || 'cross-functional');
    acc[key] = acc[key] || { total: 0, missing: 0, approved: 0 };
    acc[key].total += 1;
    const status = String(document.status || '').toLowerCase();
    if (['missing', 'requested'].includes(status)) acc[key].missing += 1;
    if (status === 'approved') acc[key].approved += 1;
    return acc;
  }, {} as Record<string, { total: number; missing: number; approved: number }>);

  const reviewStateCounts = documents.reduce((acc, document) => {
    const reviewStatus = String(document.reviewStatus || 'draft').toLowerCase();
    if (Object.prototype.hasOwnProperty.call(acc, reviewStatus)) {
      acc[reviewStatus as keyof typeof acc] += 1;
    }
    return acc;
  }, {
    draft: 0,
    in_review: 0,
    approved: 0,
    changes_requested: 0,
    archived: 0,
  });

  const documentsWithThreads = documents.filter((document) => String(document.threadId || '').trim()).length;
  const totalThreadMessages = documents.reduce((sum, document) => sum + Number(document.threadMessageCount || 0), 0);

  return {
    documents,
    groupedByDepartment,
    missingDocuments: documents.filter((document) => ['missing', 'requested'].includes(String(document.status || '').toLowerCase())),
    approvedDocuments: documents.filter((document) => String(document.status || '').toLowerCase() === 'approved'),
    reviewStateCounts,
    documentsWithThreads,
    totalThreadMessages,
    blockers: blockerRegister.length
      ? blockerRegister
      : [...phaseControlBlockers, ...salesOrderBlockers, ...logisticsBlockers],
    auditItems: auditTrail.length
      ? auditTrail
      : [...approvalWatchlist, ...timelineEvents, ...activityEvents]
          .sort((left, right) => String(right.eventDate || '').localeCompare(String(left.eventDate || '')))
          .slice(0, 10),
  };
}
