import { describe, expect, it } from 'vitest';

import { buildThreadCountIndex } from './threadIndexData';

describe('threadIndexData', () => {
  it('builds a lookup map from entity id to thread counts', () => {
    const index = buildThreadCountIndex({
      items: [
        { id: 'thread-1', entityId: 'task-1', messageCount: 3 },
        { id: 'thread-2', entityId: 'approval-1', messageCount: 1 },
        { id: 'thread-3', entityId: 'task-2', messageCount: 0 },
      ],
    });

    expect(index['task-1']).toEqual({ threadId: 'thread-1', messageCount: 3 });
    expect(index['approval-1']).toEqual({ threadId: 'thread-2', messageCount: 1 });
    expect(index['task-2']).toEqual({ threadId: 'thread-3', messageCount: 0 });
  });

  it('returns empty index for invalid payloads', () => {
    expect(buildThreadCountIndex(undefined)).toEqual({});
    expect(buildThreadCountIndex({ items: [] })).toEqual({});
  });
});
