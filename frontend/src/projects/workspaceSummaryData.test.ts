import { describe, expect, it } from 'vitest';

import { buildWorkspaceSummaryKpis, mergeWorkspaceSummary } from './workspaceSummaryData';

describe('workspaceSummaryData', () => {
  it('merges work hub summary onto legacy workspace payload', () => {
    const merged = mergeWorkspaceSummary(
      {
        id: 'p-1',
        name: 'Legacy workspace',
        quotations: [{ id: 'q-1' }],
      },
      {
        projectId: 'p-1',
        activeTab: 'delivery',
        taskSummary: {
          total: 12,
          active: 4,
          blocked: 2,
          overdue: 1,
        },
        approvalSummary: {
          pending: 3,
        },
        milestoneSummary: {
          total: 5,
          completed: 2,
          overdue: 1,
        },
        recentActivities: [{ id: 'act-1', title: 'Delivery updated' }],
      },
    );

    expect(merged.workHubSummary?.projectId).toBe('p-1');
    expect(merged.workHubSummary?.activeTab).toBe('delivery');
    expect(merged.workHubSummary?.taskSummary?.blocked).toBe(2);
  });

  it('builds KPI overrides from work hub summary', () => {
    const kpis = buildWorkspaceSummaryKpis({
      projectId: 'p-1',
      taskSummary: {
        total: 12,
        active: 4,
        blocked: 2,
        overdue: 1,
      },
      approvalSummary: {
        pending: 3,
      },
      milestoneSummary: {
        total: 5,
        completed: 2,
        overdue: 1,
      },
      recentActivities: [{ id: 'act-1' }, { id: 'act-2' }],
    });

    expect(kpis).toEqual([
      { label: 'Task active', value: 4, accentToken: 'info' },
      { label: 'Task blocked', value: 2, accentToken: 'danger' },
      { label: 'Approvals pending', value: 3, accentToken: 'warning' },
      { label: 'Milestones overdue', value: 1, accentToken: 'danger' },
      { label: 'Recent activity', value: 2, accentToken: 'success' },
    ]);
  });
});
