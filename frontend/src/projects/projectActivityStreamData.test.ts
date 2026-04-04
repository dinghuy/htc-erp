import { describe, expect, it } from 'vitest';
import { collectProjectActivityStream, countProjectActivityStreamBySource } from './projectActivityStreamData';

describe('projectActivityStreamData', () => {
  it('collects normalized project activity stream items and counts by source', () => {
    const items = collectProjectActivityStream({
      items: [
        { id: 'a-1', source: 'activity', title: 'Task updated', actor: 'manager' },
        { id: 'a-2', source: 'timeline', activityType: 'delivery.release_requested' },
        { id: 'a-3', source: 'approval', title: 'Approval pending' },
      ],
    });

    expect(items).toHaveLength(3);
    expect(items[1].title).toBe('delivery.release_requested');
    expect(countProjectActivityStreamBySource(items)).toEqual({
      activity: 1,
      timeline: 1,
      approval: 1,
    });
  });
});
