import { describe, expect, it } from 'vitest';

import { buildNotificationNavigationTarget } from './notificationNavigation';

describe('notificationNavigation', () => {
  it('deep-links task notifications into task thread', () => {
    expect(buildNotificationNavigationTarget({
      link: 'Tasks',
      entityType: 'Task',
      entityId: 'task-1',
    } as any)).toEqual({
      route: 'Tasks',
      navContext: {
        route: 'Tasks',
        entityType: 'Task',
        entityId: 'task-1',
        autoOpenEdit: true,
        filters: {
          openThread: true,
        },
      },
    });
  });

  it('deep-links approval notifications into approval thread', () => {
    expect(buildNotificationNavigationTarget({
      link: 'Approvals',
      entityType: 'ApprovalRequest',
      entityId: 'approval-7',
    } as any)).toEqual({
      route: 'Approvals',
      navContext: {
        route: 'Approvals',
        filters: {
          approvalId: 'approval-7',
          openThread: true,
        },
      },
    });
  });

  it('keeps legacy behavior for quotation/account/lead notifications', () => {
    expect(buildNotificationNavigationTarget({
      link: 'Sales',
      entityType: 'Quotation',
      entityId: 'quotation-9',
    } as any)).toEqual({
      route: 'Sales',
      navContext: {
        route: 'Sales',
        entityType: 'Quotation',
        entityId: 'quotation-9',
        autoOpenEdit: true,
        filters: { quotationId: 'quotation-9' },
      },
    });
  });
});
