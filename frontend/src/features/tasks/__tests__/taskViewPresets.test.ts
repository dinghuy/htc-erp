import { describe, expect, it } from 'vitest';
import {
  buildTaskViewPresetPayload,
  collectTaskViewPresets,
  getDefaultTaskViewPreset,
  matchesTaskViewPreset,
  snapshotFromTaskViewPreset,
} from '../taskViewPresets';

describe('taskViewPresets helpers', () => {
  it('collects presets from items payload and normalizes flags', () => {
    const result = collectTaskViewPresets({
      items: [
        {
          id: 'preset-1',
          name: 'Ops overdue',
          query: 'delivery',
          onlyOverdue: 1,
          groupBy: 'department',
          surface: 'list',
          isDefault: 1,
        },
      ],
    });

    expect(result).toEqual([
      {
        id: 'preset-1',
        name: 'Ops overdue',
        query: 'delivery',
        projectId: null,
        assigneeId: null,
        priority: null,
        status: null,
        onlyOverdue: true,
        groupBy: 'department',
        surface: 'list',
        isDefault: true,
      },
    ]);
  });

  it('builds payload and snapshot with all-project fallback', () => {
    const payload = buildTaskViewPresetPayload(
      'Legal queue',
      {
        search: '',
        selectedProjectId: '__all__',
        selectedAssigneeId: '',
        selectedPriority: '',
        selectedStatus: 'on_hold',
        onlyOverdue: false,
        groupBy: 'urgency',
        surface: 'kanban',
      },
      true,
    );

    expect(payload).toEqual({
      name: 'Legal queue',
      query: null,
      projectId: null,
      assigneeId: null,
      priority: null,
      status: 'on_hold',
      onlyOverdue: false,
      groupBy: 'urgency',
      surface: 'kanban',
      isDefault: true,
    });
  });

  it('finds default preset and matches snapshots accurately', () => {
    const presets = collectTaskViewPresets([
      { id: 'preset-1', name: 'Ops overdue', query: 'delivery', onlyOverdue: true, surface: 'kanban', isDefault: 0 },
      { id: 'preset-2', name: 'Legal queue', status: 'on_hold', surface: 'list', isDefault: 1 },
    ]);

    const defaultPreset = getDefaultTaskViewPreset(presets);
    expect(defaultPreset?.id).toBe('preset-2');

    expect(
      matchesTaskViewPreset(
        snapshotFromTaskViewPreset(defaultPreset!),
        defaultPreset!,
      ),
    ).toBe(true);

    expect(
      matchesTaskViewPreset(
        {
          ...snapshotFromTaskViewPreset(defaultPreset!),
          search: 'other',
        },
        defaultPreset!,
      ),
    ).toBe(false);
  });
});
