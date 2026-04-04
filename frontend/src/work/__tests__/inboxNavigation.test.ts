import { describe, expect, it } from 'vitest';

import { buildInboxProjectWorkspaceNavigation } from '../inboxNavigation';

describe('inboxNavigation', () => {
  it('opens project workspace with backend workspace tab from inbox items', () => {
    expect(buildInboxProjectWorkspaceNavigation({
      projectId: 'project-1',
      actionAvailability: {
        workspaceTab: 'documents',
      },
    } as any)).toEqual({
      route: 'Projects',
      navContext: {
        route: 'Projects',
        entityType: 'Project',
        entityId: 'project-1',
        filters: { workspaceTab: 'documents' },
      },
    });
  });

  it('includes document thread focus for project document inbox items', () => {
    expect(buildInboxProjectWorkspaceNavigation({
      projectId: 'project-2',
      entityType: 'ProjectDocument',
      entityId: 'doc-22',
      actionAvailability: {
        workspaceTab: 'documents',
      },
    } as any)).toEqual({
      route: 'Projects',
      navContext: {
        route: 'Projects',
        entityType: 'Project',
        entityId: 'project-2',
        filters: {
          workspaceTab: 'documents',
          documentId: 'doc-22',
          openThread: true,
        },
      },
    });
  });

  it('returns null when inbox item cannot open a project workspace', () => {
    expect(buildInboxProjectWorkspaceNavigation({
      projectId: null,
      actionAvailability: {
        workspaceTab: 'documents',
      },
    } as any)).toBeNull();
  });
});
