import { describe, expect, it } from 'vitest';
import { groupTasks } from '../taskGrouping';

describe('taskGrouping', () => {
  it('groups tasks by urgency lanes and project', () => {
    const tasks = [
      { id: 't-1', name: 'Blocked', projectName: 'Alpha', assigneeName: 'A', department: 'Ops', taskType: 'delivery', blockedReason: 'wait', status: 'pending' },
      { id: 't-2', name: 'Overdue', projectName: 'Beta', assigneeName: 'B', department: 'Ops', taskType: 'delivery', blockedReason: '', status: 'active', dueDate: '2020-01-01' },
      { id: 't-3', name: 'Backlog', projectName: 'Alpha', assigneeName: 'C', department: 'Legal', taskType: 'review', blockedReason: '', status: 'pending' },
    ] as any;

    const urgencyGroups = groupTasks(tasks, 'urgency');
    expect(urgencyGroups.map((group) => group.label)).toContain('Blocked');
    expect(urgencyGroups.map((group) => group.label)).toContain('Overdue');

    const projectGroups = groupTasks(tasks, 'project');
    expect(projectGroups[0].label).toBe('Alpha');
    expect(projectGroups[0].tasks).toHaveLength(2);
  });

  it('builds hierarchy sections with nested depth', () => {
    const tasks = [
      { id: 'parent-1', name: 'Parent', status: 'active', blockedReason: '' },
      { id: 'child-1', name: 'Child', parentTaskId: 'parent-1', status: 'pending', blockedReason: '' },
      { id: 'child-2', name: 'Child 2', parentTaskId: 'parent-1', status: 'pending', blockedReason: '' },
    ] as any;

    const hierarchy = groupTasks(tasks, 'hierarchy');
    expect(hierarchy).toHaveLength(1);
    expect(hierarchy[0].label).toBe('Parent');
    expect(hierarchy[0].tasks.map((task) => [task.id, task.depth])).toEqual([
      ['parent-1', 0],
      ['child-1', 1],
      ['child-2', 1],
    ]);
  });
});
