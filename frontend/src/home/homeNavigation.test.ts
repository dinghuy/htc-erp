import { describe, expect, it } from 'vitest';

import { buildHomeHighlightNavigation, buildHomePriorityNavigation } from './homeNavigation';

describe('homeNavigation', () => {
  it('routes priority metrics to the correct queue surface', () => {
    expect(buildHomePriorityNavigation('pending_approvals', 'project_manager')).toEqual({ route: 'Approvals' });
    expect(buildHomePriorityNavigation('blockers_margin_schedule', 'project_manager')).toEqual({ route: 'Inbox' });
    expect(buildHomePriorityNavigation('handoff_pending', 'project_manager')).toEqual({ route: 'My Work' });
    expect(buildHomePriorityNavigation('deals_need_close', 'sales')).toEqual({ route: 'Sales' });
    expect(buildHomePriorityNavigation('active_projects', 'director')).toEqual({ route: 'Projects' });
  });

  it('opens a specific project highlight inside the shared workspace flow', () => {
    expect(buildHomeHighlightNavigation('project-123')).toEqual({
      route: 'Projects',
      navContext: {
        route: 'Projects',
        entityType: 'Project',
        entityId: 'project-123',
      },
    });
  });
});
