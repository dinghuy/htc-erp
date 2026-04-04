import { describe, expect, it } from 'vitest';

import {
  buildMyWorkApprovalQueueNavigation,
  buildMyWorkProjectWorkspaceNavigation,
} from '../myWorkNavigation';

describe('myWorkNavigation', () => {
  it('opens project workspace with backend workspace tab for my-work tasks', () => {
    expect(buildMyWorkProjectWorkspaceNavigation('project-1', 'procurement')).toEqual({
      route: 'Projects',
      navContext: {
        route: 'Projects',
        entityType: 'Project',
        entityId: 'project-1',
        filters: { workspaceTab: 'procurement' },
      },
    });
  });

  it('omits workspace tab filters when no backend tab is provided', () => {
    expect(buildMyWorkProjectWorkspaceNavigation('project-1', null)).toEqual({
      route: 'Projects',
      navContext: {
        route: 'Projects',
        entityType: 'Project',
        entityId: 'project-1',
        filters: undefined,
      },
    });
  });

  it('opens approvals with lane filter when backend exposes a lane', () => {
    expect(buildMyWorkApprovalQueueNavigation('finance')).toEqual({
      route: 'Approvals',
      navContext: {
        route: 'Approvals',
        filters: { approvalLane: 'finance' },
      },
    });
  });

  it('opens approvals without lane filter when no lane is provided', () => {
    expect(buildMyWorkApprovalQueueNavigation(null)).toEqual({
      route: 'Approvals',
      navContext: {
        route: 'Approvals',
        filters: undefined,
      },
    });
  });

  it('opens approval queue with focused approval thread when approval id is provided', () => {
    expect(buildMyWorkApprovalQueueNavigation('legal', 'approval-22', true)).toEqual({
      route: 'Approvals',
      navContext: {
        route: 'Approvals',
        filters: {
          approvalLane: 'legal',
          approvalId: 'approval-22',
          openThread: true,
        },
      },
    });
  });
});
