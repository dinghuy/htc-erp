import { describe, expect, it } from 'vitest';

import { buildTaskWorkflowNavigation } from '../taskWorkflowNavigation';

describe('taskWorkflowNavigation', () => {
  it('opens project workflow with workspace tab from backend action availability', () => {
    expect(buildTaskWorkflowNavigation({
      id: 'task-1',
      projectId: 'project-1',
      quotationId: null,
      actionAvailability: {
        workspaceTab: 'delivery',
        canOpenProject: true,
      },
    } as any)).toEqual({
      route: 'Projects',
      navContext: {
        route: 'Projects',
        entityType: 'Project',
        entityId: 'project-1',
        filters: { workspaceTab: 'delivery' },
      },
    });
  });

  it('falls back to quotation workflow when backend exposes quotation navigation only', () => {
    expect(buildTaskWorkflowNavigation({
      id: 'task-2',
      projectId: 'project-1',
      quotationId: 'quotation-1',
      actionAvailability: {
        canOpenProject: false,
        canOpenQuotation: true,
      },
    } as any)).toEqual({
      route: 'Quotations',
      navContext: {
        route: 'Quotations',
        entityType: 'Quotation',
        entityId: 'quotation-1',
      },
    });
  });

  it('returns null when backend does not expose workflow navigation', () => {
    expect(buildTaskWorkflowNavigation({
      id: 'task-3',
      projectId: null,
      quotationId: null,
      actionAvailability: {
        canOpenProject: false,
        canOpenQuotation: false,
      },
    } as any)).toBeNull();
  });
});
