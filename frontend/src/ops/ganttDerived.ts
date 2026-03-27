import {
  buildTimelineRange,
  calcProjectProgress,
  calcTaskProgress,
  isRangeOverlappingMonth,
  normalizeSearch,
  parseDate,
  projectMatchesQuery,
  taskMatchesQuery,
  type GanttProject,
  type GanttTask,
  type TimelineRange,
} from './ganttUtils';

export const RiskState = Object.freeze({
  Critical: 'Critical',
  Warning: 'Warning',
  Watch: 'Watch',
  Healthy: 'Healthy',
} as const);

export type RiskState = (typeof RiskState)[keyof typeof RiskState];

export const COMMAND_METRIC_KEYS = ['overdue', 'dueSoon', 'overloadedOwners', 'avgProgress'] as const;
export type CommandMetricKey = (typeof COMMAND_METRIC_KEYS)[number];

export const GANTT_PRESET_KEYS = [
  'all',
  'overdue',
  'dueSoon',
  'riskOnly',
  'overloadedOwners',
  'urgentHigh',
  'missingTimeline',
] as const;
export type GanttPresetKey = (typeof GANTT_PRESET_KEYS)[number];

export const GANTT_LENS_KEYS = ['project', 'owner', 'priority'] as const;
export type GanttLensKey = (typeof GANTT_LENS_KEYS)[number];

export type LoadSnapshot = {
  activeCount: number;
  urgentHighCount: number;
  isOverloaded: boolean;
};

export type CommandMetric = {
  key: CommandMetricKey;
  label: string;
  value: string;
  count: number;
  tone: 'neutral' | 'warn' | 'bad' | 'good';
};

export type DerivedProjectRow = {
  kind: 'project';
  id: string;
  projectId: string;
  label: string;
  subtitle: string;
  status?: string | null;
  risk: RiskState | null;
  progress: number;
  taskCount: number;
  visibleTaskCount: number;
  overdueTaskCount: number;
  timelineRange: TimelineRange | null;
};

export type DerivedTaskRow = {
  kind: 'task';
  id: string;
  projectId: string;
  label: string;
  subtitle: string;
  status?: string | null;
  priority?: string | null;
  assigneeName?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  risk: RiskState;
  progress: number;
  overdue: boolean;
  dueSoon: boolean;
  timelineMissing: boolean;
  timelineRange: TimelineRange | null;
  isFallbackRow: boolean;
  assigneeLoad: LoadSnapshot;
};

export type DerivedVisibleRow = DerivedProjectRow | DerivedTaskRow;

export type DerivedLensGroup = {
  key: string;
  label: string;
  lens: Exclude<GanttLensKey, 'project'>;
  risk: RiskState | null;
  taskCount: number;
  overdueCount: number;
  overloaded: boolean;
  tasks: DerivedTaskRow[];
};

export type BuildGanttDerivedStateInput = {
  projects: GanttProject[];
  tasks: GanttTask[];
  selectedMonth: Date;
  today: Date;
  searchQuery?: string;
  selectedPresetKey?: GanttPresetKey;
  selectedAssignee?: string;
  selectedPriority?: string;
  manualExpandedProjectIds?: Iterable<string>;
};

export type DerivedGanttState = {
  safeMode: boolean;
  error?: string;
  presetKeys: readonly GanttPresetKey[];
  commandMetricKeys: readonly CommandMetricKey[];
  selectedPresetKey: GanttPresetKey;
  commandMetrics: CommandMetric[];
  visibleRows: DerivedVisibleRow[];
  fallbackRows: DerivedTaskRow[];
  effectiveAutoExpandedProjectIds: Set<string>;
};

type TaskRiskInput = Pick<
  GanttTask,
  'status' | 'priority' | 'startDate' | 'dueDate' | 'completionPct' | 'assigneeName'
>;

type ClassifyTaskRiskOptions = {
  today: Date;
  assigneeLoad?: Map<string, LoadSnapshot> | LoadSnapshot;
};

type DerivedTaskMeta = {
  row: DerivedTaskRow;
  projectId: string;
  projectMatchesQuery: boolean;
  taskMatchesQuery: boolean;
  matchesMonth: boolean;
  matchesPreset: boolean;
  visible: boolean;
  isRisky: boolean;
};

type ProjectSummary = {
  project: GanttProject;
  visibleTaskRows: DerivedTaskRow[];
  allDerivedTasks: DerivedTaskMeta[];
  risk: RiskState | null;
  visible: boolean;
};

const ACTIVE_TASK_STATUSES = ['active', 'pending', 'paused', 'in_progress', 'in progress', 'doing'];
const ASSIGNEE_LOAD_STATUSES = ['active', 'pending', 'in_progress', 'in progress', 'doing'];
const CLOSED_TASK_STATUSES = ['completed', 'cancelled', 'canceled', 'done'];

function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function normalizeStatus(status?: string | null): string {
  return (status || '').trim().toLowerCase();
}

function normalizePriority(priority?: string | null): string {
  return (priority || '').trim().toLowerCase();
}

function isCompletedStatus(status?: string | null): boolean {
  const normalized = normalizeStatus(status);
  return normalized.includes('completed') || normalized.includes('done') || normalized.includes('hoan') || CLOSED_TASK_STATUSES.includes(normalized);
}

function isCancelledStatus(status?: string | null): boolean {
  const normalized = normalizeStatus(status);
  return normalized.includes('cancel') || normalized.includes('huy');
}

function isPausedStatus(status?: string | null): boolean {
  const normalized = normalizeStatus(status);
  return normalized.includes('paused') || normalized.includes('tam');
}

function isActiveStatus(status?: string | null): boolean {
  const normalized = normalizeStatus(status);
  if (!normalized) return true;
  if (isCompletedStatus(normalized) || isCancelledStatus(normalized)) return false;
  return ACTIVE_TASK_STATUSES.includes(normalized) || normalized.includes('active') || normalized.includes('dang') || normalized.includes('pending');
}

function countsTowardAssigneeLoad(status?: string | null): boolean {
  const normalized = normalizeStatus(status);
  if (!normalized) return true;
  if (isCompletedStatus(normalized) || isCancelledStatus(normalized) || isPausedStatus(normalized)) return false;
  return ASSIGNEE_LOAD_STATUSES.includes(normalized) || normalized.includes('active') || normalized.includes('dang') || normalized.includes('pending');
}

function isUrgentHighPriority(priority?: string | null): boolean {
  const normalized = normalizePriority(priority);
  return normalized === 'urgent' || normalized === 'high';
}

function daysBetween(start: Date, end: Date): number {
  return Math.round((startOfDay(end).getTime() - startOfDay(start).getTime()) / (24 * 60 * 60 * 1000));
}

function getAssigneeKey(task: Pick<GanttTask, 'assigneeName'>): string | null {
  const value = task.assigneeName?.trim();
  return value ? value : null;
}

function getLoadSnapshot(
  assigneeLoad: ClassifyTaskRiskOptions['assigneeLoad'],
  task: Pick<GanttTask, 'assigneeName'>,
): LoadSnapshot {
  if (!assigneeLoad) {
    return { activeCount: 0, urgentHighCount: 0, isOverloaded: false };
  }
  if (assigneeLoad instanceof Map) {
    const key = getAssigneeKey(task);
    return (key && assigneeLoad.get(key)) || { activeCount: 0, urgentHighCount: 0, isOverloaded: false };
  }
  return assigneeLoad;
}

function calculateElapsedSchedulePercent(task: Pick<GanttTask, 'startDate' | 'dueDate'>, today: Date): number | null {
  const start = parseDate(task.startDate);
  const due = parseDate(task.dueDate);
  if (!start || !due || due < start) return null;

  const totalDays = daysBetween(start, due);
  if (totalDays <= 0) return null;

  const elapsedDays = daysBetween(start, today);
  const elapsedPct = Math.round((elapsedDays / totalDays) * 100);
  return Math.max(0, Math.min(100, elapsedPct));
}

function getDueDateDelta(task: Pick<GanttTask, 'dueDate'>, today: Date): number | null {
  const dueDate = parseDate(task.dueDate);
  if (!dueDate) return null;
  return daysBetween(today, dueDate);
}

function getProjectSubtitle(project: GanttProject, taskCount: number): string {
  const parts = [
    project.code,
    project.accountName,
    project.managerName,
    `${taskCount} công việc`,
  ].filter(Boolean);
  return parts.join(' · ');
}

function getTaskSubtitle(task: GanttTask): string {
  return [
    task.projectName,
    task.accountName,
    task.assigneeName,
  ].filter(Boolean).join(' · ');
}

function normalizePresetKey(key?: string): GanttPresetKey {
  return (GANTT_PRESET_KEYS as readonly string[]).includes(key || '') ? (key as GanttPresetKey) : 'all';
}

function normalizeFilterValue(value?: string | null): string {
  return (value || '').trim().toLowerCase();
}

function getRiskRank(risk: RiskState | null | undefined): number {
  if (risk === RiskState.Critical) return 4;
  if (risk === RiskState.Warning) return 3;
  if (risk === RiskState.Watch) return 2;
  if (risk === RiskState.Healthy) return 1;
  return 0;
}

function getPriorityRank(priority?: string | null): number {
  const normalized = normalizePriority(priority);
  if (normalized === 'urgent') return 4;
  if (normalized === 'high') return 3;
  if (normalized === 'medium') return 2;
  if (normalized === 'low') return 1;
  return 0;
}

function formatPriorityGroupLabel(priority?: string | null): string {
  const normalized = normalizePriority(priority);
  if (normalized === 'urgent') return 'Ưu tiên khẩn cấp';
  if (normalized === 'high') return 'Ưu tiên cao';
  if (normalized === 'medium') return 'Ưu tiên trung bình';
  if (normalized === 'low') return 'Ưu tiên thấp';
  return 'Chưa phân loại ưu tiên';
}

export function getAssigneeLoad(tasks: GanttTask[]): Map<string, LoadSnapshot> {
  const load = new Map<string, LoadSnapshot>();

  for (const task of tasks) {
    const key = getAssigneeKey(task);
    if (!key || !countsTowardAssigneeLoad(task.status)) continue;

    const current = load.get(key) || { activeCount: 0, urgentHighCount: 0, isOverloaded: false };
    current.activeCount += 1;
    if (isUrgentHighPriority(task.priority)) {
      current.urgentHighCount += 1;
    }
    current.isOverloaded = current.activeCount > 8 || current.urgentHighCount >= 3;
    load.set(key, current);
  }

  return load;
}

export function isTimelineMissing(task: Pick<GanttTask, 'startDate' | 'dueDate'>): boolean {
  return !parseDate(task.startDate) || !parseDate(task.dueDate);
}

export function classifyTaskRisk(task: TaskRiskInput, input: ClassifyTaskRiskOptions): RiskState {
  const today = startOfDay(input.today);
  const dueDelta = getDueDateDelta(task, today);
  const assigneeLoad = getLoadSnapshot(input.assigneeLoad, task);
  const completion = calcTaskProgress(task);

  if (isCompletedStatus(task.status) || isCancelledStatus(task.status)) {
    return RiskState.Healthy;
  }

  if (dueDelta !== null && dueDelta < 0) {
    return RiskState.Critical;
  }

  if (dueDelta !== null && dueDelta <= 7) {
    return RiskState.Warning;
  }

  if (assigneeLoad.isOverloaded) {
    return RiskState.Warning;
  }

  const elapsedPct = calculateElapsedSchedulePercent(task, today);
  if (elapsedPct !== null && elapsedPct >= 60 && completion <= elapsedPct - 20) {
    return RiskState.Warning;
  }

  if (dueDelta !== null && dueDelta <= 14) {
    return RiskState.Watch;
  }

  if (isPausedStatus(task.status) && isUrgentHighPriority(task.priority)) {
    return RiskState.Watch;
  }

  if (isActiveStatus(task.status) && isTimelineMissing(task)) {
    return RiskState.Watch;
  }

  return RiskState.Healthy;
}

export function classifyProjectRisk(taskRisks: RiskState[]): RiskState | null {
  if (taskRisks.length === 0) return null;
  if (taskRisks.includes(RiskState.Critical)) return RiskState.Critical;
  if (taskRisks.includes(RiskState.Warning)) return RiskState.Warning;
  if (taskRisks.includes(RiskState.Watch)) return RiskState.Watch;
  return RiskState.Healthy;
}

export function buildCommandMetrics(input: {
  taskRows: DerivedTaskRow[];
  assigneeLoad: Map<string, LoadSnapshot>;
}): CommandMetric[] {
  const overdueCount = input.taskRows.filter(task => task.overdue).length;
  const dueSoonCount = input.taskRows.filter(task => task.dueSoon).length;
  const overloadedOwnersCount = Array.from(input.assigneeLoad.values()).filter(load => load.isOverloaded).length;
  const avgProgress = input.taskRows.length
    ? Math.round(input.taskRows.reduce((sum, task) => sum + task.progress, 0) / input.taskRows.length)
    : 0;

  return [
    {
      key: 'overdue',
      label: 'Overdue',
      value: String(overdueCount),
      count: overdueCount,
      tone: overdueCount > 0 ? 'bad' : 'neutral',
    },
    {
      key: 'dueSoon',
      label: 'Due Soon',
      value: String(dueSoonCount),
      count: dueSoonCount,
      tone: dueSoonCount > 0 ? 'warn' : 'neutral',
    },
    {
      key: 'overloadedOwners',
      label: 'Owners Overloaded',
      value: String(overloadedOwnersCount),
      count: overloadedOwnersCount,
      tone: overloadedOwnersCount > 0 ? 'warn' : 'neutral',
    },
    {
      key: 'avgProgress',
      label: 'Avg Progress',
      value: `${avgProgress}%`,
      count: avgProgress,
      tone: avgProgress >= 80 ? 'good' : avgProgress >= 50 ? 'neutral' : 'warn',
    },
  ];
}

export function getPresetMatch(input: {
  presetKey?: GanttPresetKey;
  row: DerivedTaskRow;
}): boolean {
  const presetKey = normalizePresetKey(input.presetKey);

  switch (presetKey) {
    case 'all':
      return true;
    case 'overdue':
      return input.row.overdue;
    case 'dueSoon':
      return input.row.dueSoon;
    case 'riskOnly':
      return input.row.risk !== RiskState.Healthy;
    case 'overloadedOwners':
      return input.row.assigneeLoad.isOverloaded;
    case 'urgentHigh':
      return isUrgentHighPriority(input.row.priority);
    case 'missingTimeline':
      return input.row.timelineMissing;
    default:
      return true;
  }
}

export function buildLensGroups(
  taskRows: DerivedTaskRow[],
  lens: Exclude<GanttLensKey, 'project'>,
): DerivedLensGroup[] {
  const grouped = new Map<string, DerivedTaskRow[]>();

  for (const taskRow of taskRows) {
    const key =
      lens === 'owner'
        ? taskRow.assigneeName?.trim() || 'unassigned'
        : normalizePriority(taskRow.priority) || 'unclassified';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(taskRow);
  }

  return Array.from(grouped.entries())
    .map(([key, tasks]) => {
      const orderedTasks = [...tasks].sort((left, right) => {
        const riskDiff = getRiskRank(right.risk) - getRiskRank(left.risk);
        if (riskDiff !== 0) return riskDiff;
        const priorityDiff = getPriorityRank(right.priority) - getPriorityRank(left.priority);
        if (priorityDiff !== 0) return priorityDiff;
        return left.label.localeCompare(right.label);
      });

      return {
        key,
        label: lens === 'owner' ? (orderedTasks[0]?.assigneeName?.trim() || 'Chưa gán assignee') : formatPriorityGroupLabel(key),
        lens,
        risk: classifyProjectRisk(orderedTasks.map(task => task.risk)),
        taskCount: orderedTasks.length,
        overdueCount: orderedTasks.filter(task => task.overdue).length,
        overloaded: orderedTasks.some(task => task.assigneeLoad.isOverloaded),
        tasks: orderedTasks,
      };
    })
    .sort((left, right) => {
      if (lens === 'owner') {
        if (left.overloaded !== right.overloaded) return Number(right.overloaded) - Number(left.overloaded);
      } else {
        const priorityDiff = getPriorityRank(right.tasks[0]?.priority) - getPriorityRank(left.tasks[0]?.priority);
        if (priorityDiff !== 0) return priorityDiff;
      }

      const riskDiff = getRiskRank(right.risk) - getRiskRank(left.risk);
      if (riskDiff !== 0) return riskDiff;

      if (right.taskCount !== left.taskCount) return right.taskCount - left.taskCount;
      return left.label.localeCompare(right.label);
    });
}

export function getAutoExpandedProjectIds(input: {
  projectSummaries: ProjectSummary[];
  selectedPresetKey?: GanttPresetKey;
  searchQuery?: string;
  manualExpandedProjectIds?: Iterable<string>;
}): Set<string> {
  const searchQuery = normalizeSearch(input.searchQuery || '');
  const selectedPresetKey = normalizePresetKey(input.selectedPresetKey);
  if (input.manualExpandedProjectIds) {
    return new Set(input.manualExpandedProjectIds);
  }

  const autoExpanded = new Set<string>();
  const forceVisibleByFilter = selectedPresetKey !== 'all' || Boolean(searchQuery);

  for (const projectSummary of input.projectSummaries) {
    if (!projectSummary.visible) continue;

    if (forceVisibleByFilter) {
      if (projectSummary.visibleTaskRows.length > 0) {
        autoExpanded.add(projectSummary.project.id);
      }
      continue;
    }

    if (projectSummary.risk && projectSummary.risk !== RiskState.Healthy) {
      autoExpanded.add(projectSummary.project.id);
    }
  }

  return autoExpanded;
}

function buildTaskRow(task: GanttTask, input: {
  selectedMonth: Date;
  today: Date;
  assigneeLoad: Map<string, LoadSnapshot>;
}): DerivedTaskRow {
  const timelineMissing = isTimelineMissing(task);
  const timelineRange = timelineMissing ? null : buildTimelineRange(task.startDate, task.dueDate, input.selectedMonth);
  const risk = classifyTaskRisk(task, { today: input.today, assigneeLoad: input.assigneeLoad });
  const dueDelta = getDueDateDelta(task, input.today);
  const isClosed = isCompletedStatus(task.status) || isCancelledStatus(task.status);
  const overdue = dueDelta !== null && dueDelta < 0 && !isClosed;
  const dueSoon = dueDelta !== null && dueDelta >= 0 && dueDelta <= 7 && !isClosed;
  const assigneeLoad = getLoadSnapshot(input.assigneeLoad, task);

  return {
    kind: 'task',
    id: task.id,
    projectId: task.projectId || '',
    label: task.name || 'Untitled Task',
    subtitle: getTaskSubtitle(task),
    status: task.status,
    priority: task.priority,
    assigneeName: task.assigneeName,
    startDate: task.startDate,
    dueDate: task.dueDate,
    risk,
    progress: calcTaskProgress(task),
    overdue,
    dueSoon,
    timelineMissing,
    timelineRange,
    isFallbackRow: timelineMissing,
    assigneeLoad,
  };
}

function buildBaseFallbackRows(projects: GanttProject[], tasks: GanttTask[], selectedMonth: Date): DerivedVisibleRow[] {
  const tasksByProject = new Map<string, GanttTask[]>();
  for (const task of tasks) {
    const projectId = task.projectId || '';
    if (!tasksByProject.has(projectId)) tasksByProject.set(projectId, []);
    tasksByProject.get(projectId)!.push(task);
  }

  return projects.flatMap(project => {
    const projectTasks = tasksByProject.get(project.id) || [];
    const projectRow: DerivedProjectRow = {
      kind: 'project',
      id: project.id,
      projectId: project.id,
      label: project.name || 'Untitled Project',
      subtitle: getProjectSubtitle(project, projectTasks.length),
      status: project.status,
      risk: null,
      progress: calcProjectProgress(projectTasks),
      taskCount: projectTasks.length,
      visibleTaskCount: projectTasks.length,
      overdueTaskCount: 0,
      timelineRange: buildTimelineRange(project.startDate, project.endDate, selectedMonth),
    };

    const taskRows = projectTasks.map<DerivedTaskRow>(task => ({
      kind: 'task',
      id: task.id,
      projectId: project.id,
      label: task.name || 'Untitled Task',
      subtitle: getTaskSubtitle(task),
      status: task.status,
      priority: task.priority,
      assigneeName: task.assigneeName,
      startDate: task.startDate,
      dueDate: task.dueDate,
      risk: RiskState.Healthy,
      progress: calcTaskProgress(task),
      overdue: false,
      dueSoon: false,
      timelineMissing: isTimelineMissing(task),
      timelineRange: buildTimelineRange(task.startDate, task.dueDate, selectedMonth),
      isFallbackRow: isTimelineMissing(task),
      assigneeLoad: { activeCount: 0, urgentHighCount: 0, isOverloaded: false },
    }));

    return [projectRow, ...taskRows];
  });
}

export function buildGanttDerivedState(input: BuildGanttDerivedStateInput): DerivedGanttState {
  try {
    const today = startOfDay(input.today);
    const selectedPresetKey = normalizePresetKey(input.selectedPresetKey);
    const searchQuery = normalizeSearch(input.searchQuery || '');
    const selectedAssignee = normalizeFilterValue(input.selectedAssignee);
    const selectedPriority = normalizeFilterValue(input.selectedPriority);
    const assigneeLoad = getAssigneeLoad(input.tasks);

    const derivedTaskMeta: DerivedTaskMeta[] = input.tasks.map(task => {
      const row = buildTaskRow(task, {
        selectedMonth: input.selectedMonth,
        today,
        assigneeLoad,
      });
      const projectId = task.projectId || '';
      const project = input.projects.find(candidate => candidate.id === projectId);
      const projectMatches = project ? projectMatchesQuery(project, searchQuery) : false;
      const taskSearchMatch = taskMatchesQuery(task, searchQuery);
      const matchesMonth = row.timelineMissing || isRangeOverlappingMonth(task.startDate, task.dueDate, input.selectedMonth);
      const matchesPreset = getPresetMatch({ presetKey: selectedPresetKey, row });
      const matchesSearch = !searchQuery || projectMatches || taskSearchMatch;
      const matchesAssignee = !selectedAssignee || normalizeFilterValue(row.assigneeName) === selectedAssignee;
      const matchesPriority = !selectedPriority || normalizePriority(row.priority) === selectedPriority;
      const visible = matchesMonth && matchesPreset && matchesSearch && matchesAssignee && matchesPriority;

      return {
        row,
        projectId,
        projectMatchesQuery: projectMatches,
        taskMatchesQuery: taskSearchMatch,
        matchesMonth,
        matchesPreset,
        visible,
        isRisky: row.risk !== RiskState.Healthy,
      };
    });

    const visibleTaskRows = derivedTaskMeta
      .filter(task => task.visible)
      .map(task => task.row);

    const projectSummaries: ProjectSummary[] = input.projects.map(project => {
      const projectTasks = derivedTaskMeta.filter(task => task.projectId === project.id);
      const visibleProjectTasks = projectTasks.filter(task => task.visible).map(task => task.row);
      const projectTimelineVisible = isRangeOverlappingMonth(project.startDate, project.endDate, input.selectedMonth);
      const projectMatchesActiveSearch = searchQuery ? projectMatchesQuery(project, searchQuery) : true;
      const projectVisible = searchQuery
        ? projectMatchesActiveSearch || visibleProjectTasks.length > 0
        : projectTimelineVisible || visibleProjectTasks.length > 0;
      const projectRisk = classifyProjectRisk(visibleProjectTasks.map(task => task.risk));

      return {
        project,
        visibleTaskRows: visibleProjectTasks,
        allDerivedTasks: projectTasks,
        risk: projectRisk,
        visible: projectVisible,
      };
    });

    const visibleRows: DerivedVisibleRow[] = [];
    const fallbackRows: DerivedTaskRow[] = [];

    for (const projectSummary of projectSummaries) {
      if (!projectSummary.visible) continue;

      const projectRow: DerivedProjectRow = {
        kind: 'project',
        id: projectSummary.project.id,
        projectId: projectSummary.project.id,
        label: projectSummary.project.name || 'Untitled Project',
        subtitle: getProjectSubtitle(projectSummary.project, projectSummary.allDerivedTasks.length),
        status: projectSummary.project.status,
        risk: projectSummary.risk,
        progress: calcProjectProgress(projectSummary.allDerivedTasks.map(task => ({
          status: task.row.status,
          completionPct: task.row.progress,
        }))),
        taskCount: projectSummary.allDerivedTasks.length,
        visibleTaskCount: projectSummary.visibleTaskRows.length,
        overdueTaskCount: projectSummary.visibleTaskRows.filter(task => task.overdue).length,
        timelineRange: buildTimelineRange(
          projectSummary.project.startDate,
          projectSummary.project.endDate,
          input.selectedMonth,
        ),
      };

      visibleRows.push(projectRow);

      for (const taskRow of projectSummary.visibleTaskRows) {
        visibleRows.push(taskRow);
        if (taskRow.timelineMissing) {
          fallbackRows.push(taskRow);
        }
      }
    }

    return {
      safeMode: false,
      presetKeys: GANTT_PRESET_KEYS,
      commandMetricKeys: COMMAND_METRIC_KEYS,
      selectedPresetKey,
      commandMetrics: buildCommandMetrics({ taskRows: visibleTaskRows, assigneeLoad }),
      visibleRows,
      fallbackRows,
      effectiveAutoExpandedProjectIds: getAutoExpandedProjectIds({
        projectSummaries,
        selectedPresetKey,
        searchQuery,
        manualExpandedProjectIds: input.manualExpandedProjectIds,
      }),
    };
  } catch (error: any) {
    return {
      safeMode: true,
      error: error?.message || 'Unable to derive gantt state',
      presetKeys: GANTT_PRESET_KEYS,
      commandMetricKeys: COMMAND_METRIC_KEYS,
      selectedPresetKey: normalizePresetKey(input.selectedPresetKey),
      commandMetrics: buildCommandMetrics({ taskRows: [], assigneeLoad: new Map() }),
      visibleRows: buildBaseFallbackRows(input.projects, input.tasks, input.selectedMonth),
      fallbackRows: [],
      effectiveAutoExpandedProjectIds: input.manualExpandedProjectIds ? new Set(input.manualExpandedProjectIds) : new Set(),
    };
  }
}
