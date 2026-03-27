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
  const groupedByDepartment = documents.reduce((acc, document) => {
    const key = String(document.department || 'cross-functional');
    acc[key] = acc[key] || { total: 0, missing: 0, approved: 0 };
    acc[key].total += 1;
    const status = String(document.status || '').toLowerCase();
    if (['missing', 'requested'].includes(status)) acc[key].missing += 1;
    if (status === 'approved') acc[key].approved += 1;
    return acc;
  }, {} as Record<string, { total: number; missing: number; approved: number }>);

  return {
    documents,
    groupedByDepartment,
    missingDocuments: documents.filter((document) => ['missing', 'requested'].includes(String(document.status || '').toLowerCase())),
    approvedDocuments: documents.filter((document) => String(document.status || '').toLowerCase() === 'approved'),
  };
}
