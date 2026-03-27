import { describe, expect, it } from 'vitest';

import { buildExecutiveCockpitSummary } from './executiveCockpit';

describe('buildExecutiveCockpitSummary', () => {
  it('extracts pending executive approvals and ranks top risk projects', () => {
    const summary = buildExecutiveCockpitSummary({
      highlights: [
        {
          projectId: 'p-1',
          projectCode: 'PRJ-001',
          projectName: 'Margin Rescue',
          pendingApprovalCount: 3,
          missingDocumentCount: 2,
          openTaskCount: 4,
        },
        {
          projectId: 'p-2',
          projectCode: 'PRJ-002',
          projectName: 'Clean Project',
          pendingApprovalCount: 1,
          missingDocumentCount: 0,
          openTaskCount: 1,
        },
      ],
      approvals: [
        {
          id: 'ap-1',
          title: 'Margin exception',
          requestType: 'margin-exception',
          status: 'pending',
          department: 'BOD',
        },
        {
          id: 'ap-2',
          title: 'Legal deviation',
          requestType: 'contract-review',
          status: 'pending',
          department: 'Legal',
        },
      ],
    });

    expect(summary.pendingExecutiveApprovals).toBe(1);
    expect(summary.topRiskProjects[0]).toMatchObject({
      projectId: 'p-1',
      riskScore: 17,
    });
    expect(summary.totalOpenTasks).toBe(5);
    expect(summary.totalMissingDocuments).toBe(2);
  });

  it('aggregates pending approval bottlenecks by department', () => {
    const summary = buildExecutiveCockpitSummary({
      approvals: [
        { id: '1', title: 'Finance A', requestType: 'payment-milestone', status: 'pending', department: 'Finance' },
        { id: '2', title: 'Finance B', requestType: 'invoice-release', status: 'pending', department: 'Finance' },
        { id: '3', title: 'Procurement A', requestType: 'po-approval', status: 'pending', department: 'Procurement' },
        { id: '4', title: 'Done', requestType: 'margin-exception', status: 'approved', department: 'BOD' },
      ],
    });

    expect(summary.bottlenecksByDepartment).toEqual([
      { department: 'Finance', count: 2 },
      { department: 'Procurement', count: 1 },
    ]);
  });
});
