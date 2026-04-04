import { describe, expect, it } from 'vitest';

import {
  buildApprovalQueueCards,
  mapApprovalQueuePayload,
} from './approvalQueueData';

describe('approvalQueueData', () => {
  it('maps v1 approval queue payload into approvals screen shape', () => {
    const payload = mapApprovalQueuePayload(
      {
        persona: {
          primaryRole: 'project_manager',
          roleCodes: ['project_manager'],
          mode: 'project_manager',
        },
        items: [
          {
            approvalRequestId: 'ap-1',
            lane: 'delivery',
            status: 'pending',
            title: 'Delivery release',
            requestType: 'delivery_release',
            projectId: 'p-1',
            projectCode: 'PRJ-001',
            projectName: 'Bridge rollout',
            department: 'Operations',
            requestedByName: 'Ops Owner',
            approverUserId: 'u-1',
            dueAt: '2026-03-30',
            actionAvailability: {
              canDecide: true,
              availableDecisions: ['approved', 'rejected'],
            },
          },
          {
            approvalRequestId: 'ap-2',
            lane: 'legal',
            status: 'approved',
            title: 'Legal deviation',
            requestType: 'contract-review',
            projectId: 'p-2',
            projectName: 'Contract cleanup',
            department: 'Legal',
          },
        ],
      },
      {
        title: 'Commercial + Execution Approvals',
        description: 'fallback copy',
      },
    );

    expect(payload.persona?.mode).toBe('project_manager');
    expect(payload.summary?.pendingCount).toBe(1);
    expect(payload.summary?.legalCount).toBe(1);
    expect(payload.summary?.deliveryCount).toBe(1);
    expect(payload.approvals?.[0]).toMatchObject({
      id: 'ap-1',
      title: 'Delivery release',
      projectCode: 'PRJ-001',
      dueDate: '2026-03-30',
    });
    expect(payload.approvals?.[0].actionAvailability?.lane).toBe('delivery');
    expect(payload.approvals?.[0].actionAvailability?.canDecide).toBe(true);
  });

  it('builds cards from summary counts', () => {
    const cards = buildApprovalQueueCards({
      pendingCount: 4,
      financeCount: 2,
      legalCount: 1,
      executiveCount: 3,
      procurementCount: 0,
      deliveryCount: 5,
    });

    expect(cards).toEqual([
      { label: 'Pending approvals', value: 4, tone: 'warn' },
      { label: 'Finance + Legal', value: 3, tone: 'info' },
      { label: 'Executive lane', value: 3, tone: 'bad' },
      { label: 'Delivery lane', value: 5, tone: 'info' },
    ]);
  });
});
