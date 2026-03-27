import { describe, expect, it } from 'vitest';

import {
  buildDocumentWorkspaceSummary,
  buildFinanceWorkspaceSummary,
  buildLegalWorkspaceSummary,
} from './workspaceRoleViews';

describe('workspace role views', () => {
  it('builds finance cockpit data from approvals, milestones and documents', () => {
    const summary = buildFinanceWorkspaceSummary({
      workspace: {
        documents: [
          { id: 'doc-1', department: 'Finance', status: 'missing', documentName: 'Invoice package' },
          { id: 'doc-2', department: 'Finance', status: 'approved', documentName: 'VAT invoice' },
        ],
      },
      approvals: [
        { id: 'fin-1', requestType: 'payment-milestone', title: 'Payment milestone', department: 'Finance', status: 'pending' },
        { id: 'fin-2', requestType: 'receivable-followup', title: 'Receivable escalation', department: 'Finance', status: 'approved' },
        { id: 'legal-1', requestType: 'contract-review', department: 'Legal', status: 'pending' },
      ],
      milestones: [
        { id: 'm-1', milestoneType: 'payment', title: 'Deposit received', status: 'pending' },
        { id: 'm-2', milestoneType: 'delivery', title: 'Site delivery', status: 'pending' },
      ],
      overdueDeliveryLines: [{ id: 'line-1' }],
    });

    expect(summary.financeApprovals).toHaveLength(2);
    expect(summary.pendingFinanceApprovals).toHaveLength(1);
    expect(summary.receivableApprovals).toHaveLength(2);
    expect(summary.paymentMilestones).toHaveLength(1);
    expect(summary.pendingPaymentMilestones).toHaveLength(1);
    expect(summary.financeDocuments).toHaveLength(2);
    expect(summary.missingFinanceDocuments).toHaveLength(1);
    expect(summary.deliveryRiskCount).toBe(1);
  });

  it('builds legal cockpit data from contracts, deviations and documents', () => {
    const summary = buildLegalWorkspaceSummary({
      workspace: {
        documents: [
          { id: 'doc-1', department: 'Legal', status: 'missing', documentName: 'Contract draft' },
          { id: 'doc-2', department: 'Sales', status: 'approved', documentName: 'Sales quote' },
        ],
      },
      approvals: [
        { id: 'l-1', requestType: 'contract-review', title: 'Contract review', department: 'Legal', status: 'pending' },
        { id: 'l-2', requestType: 'clause-deviation', title: 'Deviation request', department: 'Legal', status: 'approved' },
      ],
      contractAppendices: [
        { id: 'a-1', status: 'effective' },
        { id: 'a-2', status: 'draft' },
      ],
    });

    expect(summary.legalApprovals).toHaveLength(2);
    expect(summary.pendingLegalApprovals).toHaveLength(1);
    expect(summary.deviationApprovals).toHaveLength(1);
    expect(summary.legalDocuments).toHaveLength(1);
    expect(summary.missingLegalDocuments).toHaveLength(1);
    expect(summary.signedAppendices).toHaveLength(1);
  });

  it('groups document checklist by department and status', () => {
    const summary = buildDocumentWorkspaceSummary({
      workspace: {
        documents: [
          { id: 'doc-1', department: 'Finance', status: 'missing' },
          { id: 'doc-2', department: 'Finance', status: 'approved' },
          { id: 'doc-3', department: 'Legal', status: 'requested' },
        ],
      },
    });

    expect(summary.documents).toHaveLength(3);
    expect(summary.missingDocuments).toHaveLength(2);
    expect(summary.approvedDocuments).toHaveLength(1);
    expect(summary.groupedByDepartment.Finance).toEqual({ total: 2, missing: 1, approved: 1 });
    expect(summary.groupedByDepartment.Legal).toEqual({ total: 1, missing: 1, approved: 0 });
  });
});
