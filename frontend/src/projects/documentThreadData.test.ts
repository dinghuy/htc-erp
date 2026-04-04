import { describe, expect, it } from 'vitest';

import { buildDocumentThreadSummary } from './documentThreadData';

describe('documentThreadData', () => {
  it('builds compact summary from thread and message payloads', () => {
    const summary = buildDocumentThreadSummary({
      threadPayload: {
        items: [
          {
            id: 'thread-1',
            entityType: 'ProjectDocument',
            entityId: 'doc-1',
            status: 'active',
            messageCount: 2,
          },
        ],
      },
      messagesPayload: {
        items: [
          {
            id: 'msg-1',
            content: 'Please update clause 4',
            authorName: 'Legal Reviewer',
          },
          {
            id: 'msg-2',
            content: 'Updated draft attached',
            authorName: 'PM',
          },
        ],
      },
    });

    expect(summary.threadId).toBe('thread-1');
    expect(summary.messageCount).toBe(2);
    expect(summary.latestMessage?.content).toBe('Please update clause 4');
    expect(summary.hasActiveThread).toBe(true);
  });

  it('stays empty when no thread exists yet', () => {
    const summary = buildDocumentThreadSummary({
      threadPayload: { items: [] },
      messagesPayload: { items: [] },
    });

    expect(summary.threadId).toBeNull();
    expect(summary.messageCount).toBe(0);
    expect(summary.latestMessage).toBeNull();
    expect(summary.hasActiveThread).toBe(false);
  });
});
