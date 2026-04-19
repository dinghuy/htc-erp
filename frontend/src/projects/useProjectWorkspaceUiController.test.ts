import { describe, expect, it } from 'vitest';

import {
  initialProjectWorkspaceUiState,
  projectWorkspaceUiReducer,
} from './useProjectWorkspaceUiController';

describe('projectWorkspaceUiReducer', () => {
  it('sets a specific field without disturbing unrelated UI state', () => {
    const nextState = projectWorkspaceUiReducer(initialProjectWorkspaceUiState, {
      type: 'set',
      field: 'contractEditor',
      value: { id: 'contract-1' },
    });

    expect(nextState.contractEditor).toEqual({ id: 'contract-1' });
    expect(nextState.documentThread).toBeNull();
    expect(nextState.documentThreadDraft).toBe('');
  });

  it('resets thread state together', () => {
    const seededState = {
      ...initialProjectWorkspaceUiState,
      documentThread: { id: 'thread-1' },
      documentThreadMessages: [{ id: 'message-1' }],
      documentThreadDraft: 'draft',
    };

    const nextState = projectWorkspaceUiReducer(seededState, {
      type: 'resetDocumentThread',
    });

    expect(nextState.documentThread).toBeNull();
    expect(nextState.documentThreadMessages).toEqual([]);
    expect(nextState.documentThreadDraft).toBe('');
  });

  it('resets project thread state together', () => {
    const seededState = {
      ...initialProjectWorkspaceUiState,
      projectThread: { id: 'thread-2' },
      projectThreadMessages: [{ id: 'message-2' }],
      projectThreadDraft: 'project draft',
    };

    const nextState = projectWorkspaceUiReducer(seededState, {
      type: 'resetProjectThread',
    });

    expect(nextState.projectThread).toBeNull();
    expect(nextState.projectThreadMessages).toEqual([]);
    expect(nextState.projectThreadDraft).toBe('');
  });
});
