import { describe, expect, it } from 'vitest';
import type { GanttProject, GanttTask } from '../ganttUtils';
import {
  buildGanttDerivedState,
  buildLensGroups,
  classifyTaskRisk,
  COMMAND_METRIC_KEYS,
  type DerivedTaskRow,
  GANTT_PRESET_KEYS,
  getAssigneeLoad,
  RiskState,
} from '../ganttDerived';

const TODAY = new Date('2026-03-26T00:00:00');
const MARCH_2026 = new Date('2026-03-01T00:00:00');

function makeProject(overrides: Partial<GanttProject> = {}): GanttProject {
  return {
    id: overrides.id ?? 'project-1',
    name: overrides.name ?? 'Project Alpha',
    status: overrides.status ?? 'active',
    startDate: overrides.startDate ?? '2026-03-01',
    endDate: overrides.endDate ?? '2026-03-31',
    ...overrides,
  };
}

function makeTask(overrides: Partial<GanttTask> = {}): GanttTask {
  return {
    id: overrides.id ?? 'task-1',
    projectId: overrides.projectId ?? 'project-1',
    projectName: overrides.projectName ?? 'Project Alpha',
    assigneeName: overrides.assigneeName ?? 'Alice',
    name: overrides.name ?? 'Task Alpha',
    status: overrides.status ?? 'active',
    priority: overrides.priority ?? 'medium',
    startDate: overrides.startDate ?? '2026-03-20',
    dueDate: overrides.dueDate ?? '2026-03-31',
    completionPct: overrides.completionPct ?? 40,
    ...overrides,
  };
}

describe('ganttDerived', () => {
  it('builds a stable derived-state contract for command metrics and visible rows', () => {
    const project = makeProject();
    const task = makeTask({
      dueDate: '2026-04-15',
    });

    const derived = buildGanttDerivedState({
      projects: [project],
      tasks: [task],
      selectedMonth: MARCH_2026,
      today: TODAY,
      selectedPresetKey: 'all',
    });

    expect(derived.safeMode).toBe(false);
    expect(derived.presetKeys).toEqual(GANTT_PRESET_KEYS);
    expect(derived.commandMetricKeys).toEqual(COMMAND_METRIC_KEYS);
    expect(Array.from(derived.effectiveAutoExpandedProjectIds)).toEqual([]);
    expect(derived.commandMetrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'overdue' }),
        expect.objectContaining({ key: 'dueSoon' }),
        expect.objectContaining({ key: 'overloadedOwners' }),
        expect.objectContaining({ key: 'avgProgress' }),
      ]),
    );
    expect(derived.visibleRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'project', id: project.id }),
        expect.objectContaining({ kind: 'task', id: task.id, projectId: project.id }),
      ]),
    );
    expect(derived.fallbackRows).toEqual([]);
  });

  it('marks due-in-7-days tasks as warning', () => {
    const result = classifyTaskRisk(
      makeTask({
        dueDate: '2026-04-02',
        completionPct: 25,
      }),
      { today: TODAY },
    );

    expect(result).toBe(RiskState.Warning);
  });

  it('marks paused urgent tasks as watch', () => {
    const result = classifyTaskRisk(
      makeTask({
        status: 'paused',
        priority: 'urgent',
        dueDate: '2026-04-20',
      }),
      { today: TODAY },
    );

    expect(result).toBe(RiskState.Watch);
  });

  it('marks overloaded assignee tasks as warning', () => {
    const tasks = Array.from({ length: 3 }, (_, index) =>
      makeTask({
        id: `task-${index + 1}`,
        assigneeName: 'Overloaded Owner',
        priority: index === 2 ? 'urgent' : 'high',
        dueDate: '2026-04-20',
      }),
    );
    const assigneeLoad = getAssigneeLoad(tasks);

    expect(assigneeLoad.get('Overloaded Owner')).toEqual(
      expect.objectContaining({
        activeCount: 3,
        urgentHighCount: 3,
        isOverloaded: true,
      }),
    );
    expect(classifyTaskRisk(tasks[1], { today: TODAY, assigneeLoad })).toBe(RiskState.Warning);
  });

  it('does not count paused tasks toward assignee overload thresholds', () => {
    const tasks = Array.from({ length: 3 }, (_, index) =>
      makeTask({
        id: `paused-${index + 1}`,
        assigneeName: 'Paused Owner',
        status: 'paused',
        priority: 'high',
        dueDate: '2026-04-20',
      }),
    );
    const assigneeLoad = getAssigneeLoad(tasks);

    expect(assigneeLoad.get('Paused Owner')).toBeUndefined();
    expect(classifyTaskRisk(tasks[0], { today: TODAY, assigneeLoad })).toBe(RiskState.Watch);
  });

  it('keeps active tasks with missing dates visible in fallback state and marks them as watch', () => {
    const project = makeProject();
    const task = makeTask({
      id: 'task-missing',
      startDate: null,
      dueDate: null,
    });

    const derived = buildGanttDerivedState({
      projects: [project],
      tasks: [task],
      selectedMonth: MARCH_2026,
      today: TODAY,
      selectedPresetKey: 'all',
    });

    const taskRow = derived.visibleRows.find(
      row => row.kind === 'task' && row.id === task.id,
    );

    expect(classifyTaskRisk(task, { today: TODAY })).toBe(RiskState.Watch);
    expect(taskRow).toEqual(
      expect.objectContaining({
        kind: 'task',
        id: task.id,
        risk: RiskState.Watch,
        timelineMissing: true,
        isFallbackRow: true,
      }),
    );
    expect(derived.fallbackRows).toEqual([
      expect.objectContaining({
        kind: 'task',
        id: task.id,
        timelineMissing: true,
      }),
    ]);
  });

  it('auto-expands only risky projects when no manual filter is active', () => {
    const riskyProject = makeProject({ id: 'project-risky', name: 'Risky Project' });
    const healthyProject = makeProject({ id: 'project-healthy', name: 'Healthy Project' });
    const riskyTask = makeTask({
      id: 'task-risky',
      projectId: riskyProject.id,
      projectName: riskyProject.name,
      dueDate: '2026-03-28',
    });
    const healthyTask = makeTask({
      id: 'task-healthy',
      projectId: healthyProject.id,
      projectName: healthyProject.name,
      dueDate: '2026-04-25',
      completionPct: 80,
    });

    const derived = buildGanttDerivedState({
      projects: [riskyProject, healthyProject],
      tasks: [riskyTask, healthyTask],
      selectedMonth: MARCH_2026,
      today: TODAY,
      selectedPresetKey: 'all',
    });

    expect(Array.from(derived.effectiveAutoExpandedProjectIds)).toEqual([riskyProject.id]);
  });

  it('keeps a project visible when only the child task matches the search query', () => {
    const project = makeProject({
      id: 'project-search',
      name: 'Infrastructure Rollout',
    });
    const task = makeTask({
      id: 'task-search',
      projectId: project.id,
      projectName: project.name,
      name: 'Deploy Hanoi warehouse checklist',
      dueDate: '2026-04-10',
    });

    const derived = buildGanttDerivedState({
      projects: [project],
      tasks: [task],
      selectedMonth: MARCH_2026,
      today: TODAY,
      searchQuery: 'warehouse',
      selectedPresetKey: 'all',
    });

    expect(derived.visibleRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'project', id: project.id }),
        expect.objectContaining({ kind: 'task', id: task.id }),
      ]),
    );
  });

  it('keeps healthy project/task rows visible inside the wider timeline window', () => {
    const project = makeProject({
      id: 'project-neutral',
      name: 'Neutral Project',
    });
    const task = makeTask({
      id: 'task-april',
      projectId: project.id,
      projectName: project.name,
      startDate: '2026-04-05',
      dueDate: '2026-04-20',
    });

    const derived = buildGanttDerivedState({
      projects: [project],
      tasks: [task],
      selectedMonth: MARCH_2026,
      today: TODAY,
      searchQuery: 'neutral',
      selectedPresetKey: 'all',
    });

    expect(derived.visibleRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'project',
          id: project.id,
          risk: RiskState.Healthy,
        }),
        expect.objectContaining({
          kind: 'task',
          id: task.id,
          risk: RiskState.Healthy,
        }),
      ]),
    );
  });

  it('does not count cancelled tasks in overdue or due soon metrics', () => {
    const project = makeProject();
    const cancelledTask = makeTask({
      id: 'task-cancelled',
      status: 'cancelled',
      dueDate: '2026-03-25',
    });

    const derived = buildGanttDerivedState({
      projects: [project],
      tasks: [cancelledTask],
      selectedMonth: MARCH_2026,
      today: TODAY,
      selectedPresetKey: 'all',
    });

    const overdueMetric = derived.commandMetrics.find(metric => metric.key === 'overdue');
    const dueSoonMetric = derived.commandMetrics.find(metric => metric.key === 'dueSoon');
    const taskRow = derived.visibleRows.find(row => row.kind === 'task' && row.id === cancelledTask.id);

    expect(overdueMetric?.count).toBe(0);
    expect(dueSoonMetric?.count).toBe(0);
    expect(taskRow).toEqual(
      expect.objectContaining({
        kind: 'task',
        id: cancelledTask.id,
        overdue: false,
        dueSoon: false,
      }),
    );
  });

  it('falls back to status-derived progress when completion percentage is missing', () => {
    const project = makeProject();
    const completedTask = makeTask({
      id: 'task-completed-no-pct',
      status: 'completed',
      completionPct: null,
      dueDate: '2026-03-29',
    });

    const derived = buildGanttDerivedState({
      projects: [project],
      tasks: [completedTask],
      selectedMonth: MARCH_2026,
      today: TODAY,
      selectedPresetKey: 'all',
    });

    const taskRow = derived.visibleRows.find(row => row.kind === 'task' && row.id === completedTask.id);
    const avgProgressMetric = derived.commandMetrics.find(metric => metric.key === 'avgProgress');

    expect(taskRow).toEqual(
      expect.objectContaining({
        kind: 'task',
        id: completedTask.id,
        progress: 100,
      }),
    );
    expect(avgProgressMetric?.value).toBe('100%');
  });

  it('groups owner lens by assignee and surfaces overloaded owners first', () => {
    const overloadedTasks = Array.from({ length: 3 }, (_, index) =>
      makeTask({
        id: `owner-overload-${index + 1}`,
        assigneeName: 'Bao',
        priority: 'high',
        dueDate: '2026-04-08',
      }),
    );
    const healthyTask = makeTask({
      id: 'owner-healthy',
      assigneeName: 'Lan',
      dueDate: '2026-04-20',
    });
    const assigneeLoad = getAssigneeLoad([...overloadedTasks, healthyTask]);
    const ownerRows: DerivedTaskRow[] = [...overloadedTasks, healthyTask].map(task => ({
      ...(buildGanttDerivedState({
        projects: [makeProject({ id: task.projectId!, name: task.projectName! })],
        tasks: [task],
        selectedMonth: MARCH_2026,
        today: TODAY,
        selectedPresetKey: 'all',
      }).visibleRows.find((row): row is DerivedTaskRow => row.kind === 'task' && row.id === task.id)!),
      assigneeLoad: assigneeLoad.get(task.assigneeName!)!,
    }));

    const groups = buildLensGroups(ownerRows, 'owner');

    expect(groups[0]).toEqual(
      expect.objectContaining({
        label: 'Bao',
        overloaded: true,
        taskCount: 3,
      }),
    );
    expect(groups[1]).toEqual(expect.objectContaining({ label: 'Lan' }));
  });

  it('groups priority lens by severity order', () => {
    const rows: DerivedTaskRow[] = [
      makeTask({ id: 'priority-medium', priority: 'medium', assigneeName: 'Mai' }),
      makeTask({ id: 'priority-urgent', priority: 'urgent', assigneeName: 'Minh', dueDate: '2026-03-27' }),
      makeTask({ id: 'priority-high', priority: 'high', assigneeName: 'Nam' }),
    ].map(task =>
      buildGanttDerivedState({
        projects: [makeProject({ id: task.projectId!, name: task.projectName! })],
        tasks: [task],
        selectedMonth: MARCH_2026,
        today: TODAY,
        selectedPresetKey: 'all',
      }).visibleRows.find((row): row is DerivedTaskRow => row.kind === 'task' && row.id === task.id)!,
    );

    const groups = buildLensGroups(rows, 'priority');

    expect(groups.map(group => group.key)).toEqual(['urgent', 'high', 'medium']);
    expect(groups[0].label).toBe('Ưu tiên khẩn cấp');
  });

  it('filters visible rows by selected assignee', () => {
    const project = makeProject();
    const tasks = [
      makeTask({ id: 'owner-a', assigneeName: 'An', dueDate: '2026-04-08' }),
      makeTask({ id: 'owner-b', assigneeName: 'Binh', dueDate: '2026-04-08' }),
    ];

    const derived = buildGanttDerivedState({
      projects: [project],
      tasks,
      selectedMonth: MARCH_2026,
      today: TODAY,
      selectedPresetKey: 'all',
      selectedAssignee: 'Binh',
    });

    expect(derived.visibleRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'project', id: project.id }),
        expect.objectContaining({ kind: 'task', id: 'owner-b', assigneeName: 'Binh' }),
      ]),
    );
    expect(derived.visibleRows.find(row => row.kind === 'task' && row.id === 'owner-a')).toBeUndefined();
  });

  it('filters visible rows by selected priority', () => {
    const project = makeProject();
    const tasks = [
      makeTask({ id: 'priority-low-only', priority: 'low', assigneeName: 'An', dueDate: '2026-04-08' }),
      makeTask({ id: 'priority-urgent-only', priority: 'urgent', assigneeName: 'Binh', dueDate: '2026-03-28' }),
    ];

    const derived = buildGanttDerivedState({
      projects: [project],
      tasks,
      selectedMonth: MARCH_2026,
      today: TODAY,
      selectedPresetKey: 'all',
      selectedPriority: 'urgent',
    });

    expect(derived.visibleRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'project', id: project.id }),
        expect.objectContaining({ kind: 'task', id: 'priority-urgent-only', priority: 'urgent' }),
      ]),
    );
    expect(derived.visibleRows.find(row => row.kind === 'task' && row.id === 'priority-low-only')).toBeUndefined();
  });

  it('clips timeline ranges within the selected month', () => {
    const project = makeProject({
      startDate: '2026-02-20',
      endDate: '2026-04-10',
    });
    const spanningTask = makeTask({
      id: 'task-spanning',
      startDate: '2026-02-25',
      dueDate: '2026-04-03',
    });

    const derived = buildGanttDerivedState({
      projects: [project],
      tasks: [spanningTask],
      selectedMonth: MARCH_2026,
      today: TODAY,
      selectedPresetKey: 'all',
    });

    const taskRow = derived.visibleRows.find(
      row => row.kind === 'task' && row.id === spanningTask.id,
    );

    expect(taskRow).toEqual(
      expect.objectContaining({
        kind: 'task',
        id: spanningTask.id,
        timelineRange: {
          startIndex: 24,
          endIndex: 61,
          span: 38,
        },
      }),
    );
  });

  it('keeps tasks in the previous month visible inside the 3-month window', () => {
    const project = makeProject();
    const previousMonthTask = makeTask({
      id: 'task-feb',
      startDate: '2026-02-18',
      dueDate: '2026-02-24',
    });

    const derived = buildGanttDerivedState({
      projects: [project],
      tasks: [previousMonthTask],
      selectedMonth: MARCH_2026,
      today: TODAY,
      selectedPresetKey: 'all',
    });

    expect(derived.visibleRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'task', id: previousMonthTask.id }),
      ]),
    );
  });

  it('hides tasks outside the 3-month timeline window', () => {
    const project = makeProject();
    const futureTask = makeTask({
      id: 'task-may',
      startDate: '2026-05-05',
      dueDate: '2026-05-10',
    });

    const derived = buildGanttDerivedState({
      projects: [project],
      tasks: [futureTask],
      selectedMonth: MARCH_2026,
      today: TODAY,
      selectedPresetKey: 'all',
    });

    expect(derived.visibleRows).toEqual([
      expect.objectContaining({
        kind: 'project',
        id: project.id,
      }),
    ]);
  });
});
