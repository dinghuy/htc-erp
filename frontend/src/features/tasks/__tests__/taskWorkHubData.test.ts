import { describe, expect, it } from 'vitest';

import { buildTaskWorkHubSummary } from '../taskWorkHubData';

describe('taskWorkHubData', () => {
  it('builds dependency and worklog summary for task drawer', () => {
    const summary = buildTaskWorkHubSummary({
      dependenciesPayload: {
        items: [
          {
            id: 'dep-1',
            kind: 'blocked_by',
            note: 'Need supplier sign-off',
            context: {
              taskName: 'Supplier approval',
            },
          },
          {
            id: 'dep-2',
            kind: 'relates_to',
            context: {
              taskName: 'Warehouse prep',
            },
          },
        ],
      },
      worklogsPayload: {
        items: [
          {
            id: 'wl-1',
            durationMinutes: 120,
            summary: 'Checked contract pack',
            authorUserId: 'u-1',
          },
          {
            id: 'wl-2',
            durationMinutes: 30,
            summary: 'Updated handoff note',
            authorUserId: 'u-2',
          },
        ],
      },
      threadPayload: {
        items: [
          {
            id: 'thread-1',
            status: 'active',
            messageCount: 2,
          },
        ],
      },
      checklistPayload: {
        items: [
          { id: 'c-1', doneAt: null },
          { id: 'c-2', doneAt: '2026-03-30T10:00:00.000Z' },
        ],
      },
    });

    expect(summary.dependencyCount).toBe(2);
    expect(summary.blockedByCount).toBe(1);
    expect(summary.worklogCount).toBe(2);
    expect(summary.totalLoggedMinutes).toBe(150);
    expect(summary.latestWorklog?.summary).toBe('Checked contract pack');
    expect(summary.threadId).toBe('thread-1');
    expect(summary.threadMessageCount).toBe(2);
    expect(summary.hasActiveThread).toBe(true);
    expect(summary.checklistCount).toBe(2);
    expect(summary.checklistCompletedCount).toBe(1);
  });

  it('stays stable for missing payloads', () => {
    const summary = buildTaskWorkHubSummary({});

    expect(summary.dependencyCount).toBe(0);
    expect(summary.blockedByCount).toBe(0);
    expect(summary.worklogCount).toBe(0);
    expect(summary.totalLoggedMinutes).toBe(0);
    expect(summary.latestWorklog).toBeNull();
    expect(summary.threadId).toBeNull();
    expect(summary.threadMessageCount).toBe(0);
    expect(summary.hasActiveThread).toBe(false);
    expect(summary.checklistCount).toBe(0);
    expect(summary.checklistCompletedCount).toBe(0);
  });
});
