export type GanttProject = {
  id: string;
  code?: string | null;
  name?: string | null;
  description?: string | null;
  managerName?: string | null;
  accountName?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: string | null;
  taskCount?: number | string | null;
  createdAt?: string | null;
};

export type GanttTask = {
  id: string;
  projectId?: string | null;
  projectName?: string | null;
  accountName?: string | null;
  assigneeName?: string | null;
  name?: string | null;
  description?: string | null;
  status?: string | null;
  priority?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  completionPct?: number | string | null;
  notes?: string | null;
  reportDate?: string | null;
  createdAt?: string | null;
};

export type MonthDay = {
  key: string;
  date: Date;
  dayNumber: number;
  weekdayLabel: string;
  monthKey: string;
  monthLabelShort: string;
  isMonthStart: boolean;
  isCenterMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
};

export type TimelineRange = {
  startIndex: number;
  endIndex: number;
  span: number;
};

const dayMs = 24 * 60 * 60 * 1000;

export function toLocalDateKey(value?: string | null): string | null {
  if (!value) return null;
  const parsed = parseDate(value);
  if (!parsed) return null;
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const normalized = value.includes('T') ? value : `${value}T00:00:00`;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function buildMonthDays(viewDate: Date, todayKey: string | null, centerMonthKey: string) {
  const totalDays = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthKey = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}`;
  const monthLabelShort = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(viewDate);

  return Array.from({ length: totalDays }, (_, index) => {
    const current = new Date(viewDate.getFullYear(), viewDate.getMonth(), index + 1);
    const key = toLocalDateKey(current.toISOString()) || '';
    return {
      key,
      date: current,
      dayNumber: index + 1,
      weekdayLabel: weekdayLabels[current.getDay()],
      monthKey,
      monthLabelShort,
      isMonthStart: index === 0,
      isCenterMonth: monthKey === centerMonthKey,
      isToday: key === todayKey,
      isWeekend: current.getDay() === 0 || current.getDay() === 6,
    } satisfies MonthDay;
  });
}

export function createMonthDays(viewDate: Date): MonthDay[] {
  const todayKey = toLocalDateKey(new Date().toISOString());
  const centerMonthKey = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}`;
  return buildMonthDays(viewDate, todayKey, centerMonthKey);
}

export function createTimelineWindowDays(viewDate: Date): MonthDay[] {
  const todayKey = toLocalDateKey(new Date().toISOString());
  const centerMonthKey = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}`;

  return [
    ...buildMonthDays(addMonths(viewDate, -1), todayKey, centerMonthKey),
    ...buildMonthDays(viewDate, todayKey, centerMonthKey),
    ...buildMonthDays(addMonths(viewDate, 1), todayKey, centerMonthKey),
  ];
}

export function formatMonthLabel(date: Date): string {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
}

export function formatCompactDate(value?: string | null): string {
  const parsed = parseDate(value);
  if (!parsed) return '—';
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(parsed);
}

export function formatShortDate(value?: string | null): string {
  const parsed = parseDate(value);
  if (!parsed) return '—';
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' }).format(parsed);
}

export function countWeekdays(days: MonthDay[]): number {
  return days.filter(day => !day.isWeekend).length;
}

export function isRangeOverlappingMonth(startValue?: string | null, endValue?: string | null, monthDate?: Date): boolean {
  if (!monthDate) return true;
  const monthStart = startOfMonth(monthDate);
  const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  const start = parseDate(startValue);
  const end = parseDate(endValue) ?? start;
  if (!start || !end) return false;
  return end >= monthStart && start <= monthEnd;
}

function getTimelineWindowBounds(centerMonthDate: Date) {
  const windowStart = startOfMonth(addMonths(centerMonthDate, -1));
  const windowEnd = new Date(centerMonthDate.getFullYear(), centerMonthDate.getMonth() + 2, 0);
  return { windowStart, windowEnd };
}

export function isRangeOverlappingTimelineWindow(
  startValue?: string | null,
  endValue?: string | null,
  centerMonthDate?: Date,
): boolean {
  if (!centerMonthDate) return true;
  const { windowStart, windowEnd } = getTimelineWindowBounds(centerMonthDate);
  const start = parseDate(startValue);
  const end = parseDate(endValue) ?? start;
  if (!start || !end) return false;
  return end >= windowStart && start <= windowEnd;
}

export function buildTimelineRange(
  startValue: string | null | undefined,
  endValue: string | null | undefined,
  monthDate: Date,
): TimelineRange | null {
  const monthStart = startOfMonth(monthDate);
  const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  const start = parseDate(startValue);
  const end = parseDate(endValue) ?? start;
  if (!start || !end) return null;

  const clippedStart = start < monthStart ? monthStart : start;
  const clippedEnd = end > monthEnd ? monthEnd : end;
  if (clippedEnd < clippedStart) return null;

  const startIndex = Math.floor((clippedStart.getTime() - monthStart.getTime()) / dayMs);
  const endIndex = Math.floor((clippedEnd.getTime() - monthStart.getTime()) / dayMs);

  return {
    startIndex,
    endIndex,
    span: Math.max(1, endIndex - startIndex + 1),
  };
}

export function buildTimelineWindowRange(
  startValue: string | null | undefined,
  endValue: string | null | undefined,
  centerMonthDate: Date,
): TimelineRange | null {
  const { windowStart, windowEnd } = getTimelineWindowBounds(centerMonthDate);
  const start = parseDate(startValue);
  const end = parseDate(endValue) ?? start;
  if (!start || !end) return null;

  const clippedStart = start < windowStart ? windowStart : start;
  const clippedEnd = end > windowEnd ? windowEnd : end;
  if (clippedEnd < clippedStart) return null;

  const startIndex = Math.floor((clippedStart.getTime() - windowStart.getTime()) / dayMs);
  const endIndex = Math.floor((clippedEnd.getTime() - windowStart.getTime()) / dayMs);

  return {
    startIndex,
    endIndex,
    span: Math.max(1, endIndex - startIndex + 1),
  };
}

export function isTaskOverdue(task: Pick<GanttTask, 'status' | 'dueDate'>, todayInput = new Date()): boolean {
  const dueDate = parseDate(task.dueDate);
  if (!dueDate) return false;
  const today = new Date(todayInput);
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);
  return task.status !== 'completed' && dueDate < today;
}

export function calcTaskProgress(task: Pick<GanttTask, 'status' | 'completionPct'>): number {
  if (task.completionPct != null && task.completionPct !== '') {
    const pct = Number(task.completionPct);
    if (Number.isFinite(pct)) return Math.max(0, Math.min(100, pct));
  }
  if (task.status === 'completed') return 100;
  if (task.status === 'active') return 50;
  return 0;
}

export function calcProjectProgress(tasks: Array<Pick<GanttTask, 'status' | 'completionPct'>>): number {
  if (tasks.length === 0) return 0;
  const total = tasks.reduce((sum, task) => sum + calcTaskProgress(task), 0);
  return Math.round(total / tasks.length);
}

export function normalizeSearch(value: string): string {
  return value.trim().toLowerCase();
}

export function matchesSearch(text: string | null | undefined, query: string): boolean {
  if (!query) return true;
  return Boolean(text && text.toLowerCase().includes(query));
}

export function projectMatchesQuery(project: GanttProject, query: string): boolean {
  if (!query) return true;
  return [
    project.code,
    project.name,
    project.description,
    project.managerName,
    project.accountName,
    project.status,
  ].some(value => matchesSearch(value, query));
}

export function taskMatchesQuery(task: GanttTask, query: string): boolean {
  if (!query) return true;
  return [
    task.name,
    task.description,
    task.assigneeName,
    task.status,
    task.priority,
    task.notes,
    task.projectName,
    task.accountName,
  ].some(value => matchesSearch(value, query));
}
