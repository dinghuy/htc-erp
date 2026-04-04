import { describe, expect, it } from 'vitest';
import { buildTaskQuickViews } from '../taskQuickViews';

describe('taskQuickViews', () => {
  it('builds tracker-like system views with counts', () => {
    const views = buildTaskQuickViews(
      [
        { id: 't-1', name: 'Mine', assigneeId: 'user-1', status: 'active', blockedReason: '' },
        { id: 't-2', name: 'Blocked', assigneeId: 'user-2', status: 'pending', blockedReason: 'waiting' },
        { id: 't-3', name: 'Done', assigneeId: 'user-1', status: 'completed', blockedReason: '' },
      ] as any,
      'user-1',
    );

    expect(views[0]).toMatchObject({ id: 'assigned-to-me', count: 2 });
    expect(views.find((view) => view.id === 'blocked')).toMatchObject({ count: 1 });
    expect(views.find((view) => view.id === 'in-progress')).toMatchObject({ count: 1 });
  });
});
