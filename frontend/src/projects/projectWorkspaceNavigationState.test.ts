import { describe, expect, it } from 'vitest';

import { buildProjectWorkspaceNavigationState } from './projectWorkspaceNavigationState';

describe('buildProjectWorkspaceNavigationState', () => {
  it('preserves open-thread and document focus from navigation filters', () => {
    expect(
      buildProjectWorkspaceNavigationState('overview', {
        workspaceTab: 'documents',
        documentId: 'doc-1',
        openThread: true,
      }),
    ).toEqual({
      initialTab: 'documents',
      focusDocumentId: 'doc-1',
      openThread: true,
    });
  });

  it('falls back to the caller tab when filters omit workspaceTab', () => {
    expect(buildProjectWorkspaceNavigationState('timeline', {})).toEqual({
      initialTab: 'timeline',
      focusDocumentId: undefined,
      openThread: false,
    });
  });

  it('ignores invalid workspace tabs from navigation filters', () => {
    expect(
      buildProjectWorkspaceNavigationState('timeline', {
        workspaceTab: 'invalid-tab',
        openThread: true,
      }),
    ).toEqual({
      initialTab: 'timeline',
      focusDocumentId: undefined,
      openThread: true,
    });
  });
});
