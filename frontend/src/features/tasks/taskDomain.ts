import {
  departmentValueOptions,
  taskTypeValueOptions,
} from '../../ops/workflowOptions';

export const ALL_PROJECT = '__all__';

export type BackendTaskStatus = 'pending' | 'active' | 'completed' | 'paused' | 'cancelled';
export type UiTaskStatus = 'not_started' | 'in_progress' | 'complete' | 'on_hold' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high';
export type SurfaceKey = 'kanban' | 'list';
export type DrawerMode = 'create' | 'edit';

export type TaskRecord = {
  id: number;
  projectId?: number | null;
  parentTaskId?: number | null;
  parentTaskName?: string | null;
  sortOrder?: number | null;
  subtaskCount?: number | null;
  completedSubtaskCount?: number | null;
  checklistCount?: number | null;
  checklistCompletedCount?: number | null;
  rollupCompletionPct?: number | null;
  projectName?: string | null;
  name: string;
  description?: string | null;
  assigneeId?: number | null;
  assigneeName?: string | null;
  status?: string | null;
  priority?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  completionPct?: number | null;
  notes?: string | null;
  accountId?: number | null;
  accountName?: string | null;
  leadId?: number | null;
  leadCompanyName?: string | null;
  leadContactName?: string | null;
  quotationId?: number | null;
  quotationNumber?: string | null;
  quotationSubject?: string | null;
  target?: string | null;
  resultLinks?: string | null;
  output?: string | null;
  reportDate?: string | null;
  taskType?: string | null;
  department?: string | null;
  blockedReason?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  actionAvailability?: {
    workspaceTab?: string | null;
    canOpenTask?: boolean;
    canOpenProject?: boolean;
    canOpenQuotation?: boolean;
    primaryActionLabel?: string | null;
    blockers?: string[];
  } | null;
};

export type TaskFormState = {
  name: string;
  description: string;
  projectId: string;
  assigneeId: string;
  uiStatus: UiTaskStatus;
  priority: TaskPriority;
  startDate: string;
  dueDate: string;
  completionPct: number;
  notes: string;
  blockedReason: string;
  taskType: string;
  department: string;
  accountId: string;
  leadId: string;
  quotationId: string;
  target: string;
  resultLinks: string;
  output: string;
  reportDate: string;
};

export const UI_STATUS_META: Record<UiTaskStatus, { label: string; accent: string; soft: string }> = {
  not_started: { label: 'Chưa bắt đầu', accent: '#9a7a10', soft: '#f7efc7' },
  in_progress: { label: 'Đang triển khai', accent: '#0ba360', soft: '#e7f5ee' },
  complete: { label: 'Hoàn tất', accent: '#2563eb', soft: '#eaf1ff' },
  on_hold: { label: 'Tạm dừng', accent: tokens.colors.warningSurfaceText, soft: tokens.colors.warningStrongBg },
  cancelled: { label: 'Đã hủy', accent: '#5f6b7a', soft: tokens.colors.surfaceSubtle },
};

export const PRIORITY_META: Record<TaskPriority, { label: string; accent: string; soft: string }> = {
  high: { label: 'Cao', accent: '#b42318', soft: '#fdecea' },
  medium: { label: 'Trung bình', accent: tokens.colors.warningSurfaceText, soft: tokens.colors.warningStrongBg },
  low: { label: 'Thấp', accent: '#4b5563', soft: tokens.colors.surfaceSubtle },
};

function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function toDateKey(value?: string | null) {
  if (!value) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  return raw.length >= 10 ? raw.slice(0, 10) : raw;
}

export function parseDateKey(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export function formatDate(value?: string | null) {
  const key = toDateKey(value);
  if (!key) return 'Chưa đặt';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parseDateKey(key));
}

export function normalizeTaskStatus(value?: string | null): UiTaskStatus {
  switch (String(value || '').trim().toLowerCase()) {
    case 'active':
      return 'in_progress';
    case 'completed':
      return 'complete';
    case 'paused':
      return 'on_hold';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'not_started';
  }
}

export function backendStatusFromUi(value: UiTaskStatus): BackendTaskStatus {
  switch (value) {
    case 'in_progress':
      return 'active';
    case 'complete':
      return 'completed';
    case 'on_hold':
      return 'paused';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'pending';
  }
}

export function normalizePriority(value?: string | null): TaskPriority {
  switch (String(value || '').trim().toLowerCase()) {
    case 'high':
    case 'urgent':
      return 'high';
    case 'low':
      return 'low';
    default:
      return 'medium';
  }
}

export function taskStartDate(task: TaskRecord) {
  return toDateKey(task.startDate) || toDateKey(task.dueDate);
}

export function taskDueDate(task: TaskRecord) {
  return toDateKey(task.dueDate) || toDateKey(task.startDate);
}

export function isBlocked(task: TaskRecord) {
  return !!String(task.blockedReason || '').trim();
}

function isClosed(task: TaskRecord) {
  const status = normalizeTaskStatus(task.status);
  return status === 'complete' || status === 'cancelled';
}

export function isOverdue(task: TaskRecord) {
  const due = taskDueDate(task);
  return !!due && !isClosed(task) && due < todayKey();
}

export function isDueToday(task: TaskRecord) {
  return !!taskDueDate(task) && taskDueDate(task) === todayKey();
}

function taskScore(task: TaskRecord) {
  let score = 0;
  if (isOverdue(task)) score += 120;
  if (isBlocked(task)) score += 90;
  if (normalizePriority(task.priority) === 'high') score += 70;
  if (isDueToday(task)) score += 60;
  if (normalizeTaskStatus(task.status) === 'in_progress') score += 25;
  score += Math.max(0, 100 - Number(task.completionPct || 0));
  return score;
}

export function sortTasksByUrgency(tasks: TaskRecord[]) {
  return [...tasks].sort((left, right) => taskScore(right) - taskScore(left));
}

export function taskUrgencyReasons(task: TaskRecord) {
  const reasons: string[] = [];
  if (isOverdue(task)) reasons.push('Overdue');
  if (isBlocked(task)) reasons.push('Blocked');
  if (normalizePriority(task.priority) === 'high') reasons.push('High priority');
  if (isDueToday(task)) reasons.push('Due today');
  return reasons;
}

export function buildTaskForm(task: TaskRecord | null, currentUser?: any, selectedProjectId?: string): TaskFormState {
  return {
    name: task?.name || '',
    description: task?.description || '',
    projectId: task?.projectId ? String(task.projectId) : (selectedProjectId && selectedProjectId !== ALL_PROJECT ? String(selectedProjectId) : ''),
    assigneeId: task?.assigneeId ? String(task.assigneeId) : (currentUser?.id ? String(currentUser.id) : ''),
    uiStatus: task ? normalizeTaskStatus(task.status) : 'not_started',
    priority: task ? normalizePriority(task.priority) : 'medium',
    startDate: task ? taskStartDate(task) : todayKey(),
    dueDate: task ? taskDueDate(task) : '',
    completionPct: Number(task?.completionPct || 0),
    notes: task?.notes || '',
    blockedReason: task?.blockedReason || '',
    taskType: task?.taskType || taskTypeValueOptions()[0]?.value || 'follow_up',
    department: task?.department || departmentValueOptions()[0] || 'Sales',
    accountId: task?.accountId ? String(task.accountId) : '',
    leadId: task?.leadId ? String(task.leadId) : '',
    quotationId: task?.quotationId ? String(task.quotationId) : '',
    target: task?.target || '',
    resultLinks: task?.resultLinks || '',
    output: task?.output || '',
    reportDate: toDateKey(task?.reportDate),
  };
}

export function buildTaskPayload(form: TaskFormState) {
  return {
    name: form.name.trim(),
    description: form.description.trim() || null,
    projectId: form.projectId ? Number(form.projectId) : null,
    assigneeId: form.assigneeId ? Number(form.assigneeId) : null,
    status: backendStatusFromUi(form.uiStatus),
    priority: form.priority,
    startDate: form.startDate || null,
    dueDate: form.dueDate || null,
    completionPct: form.uiStatus === 'complete' ? 100 : Number(form.completionPct || 0),
    notes: form.notes.trim() || null,
    blockedReason: form.blockedReason.trim() || null,
    taskType: form.taskType || null,
    department: form.department || null,
    accountId: form.accountId ? Number(form.accountId) : null,
    leadId: form.leadId ? Number(form.leadId) : null,
    quotationId: form.quotationId ? Number(form.quotationId) : null,
    target: form.target.trim() || null,
    resultLinks: form.resultLinks.trim() || null,
    output: form.output.trim() || null,
    reportDate: form.reportDate || null,
  };
}

export function ensureArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function matchesTaskSearch(task: TaskRecord, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [
    task.name,
    task.description,
    task.projectName,
    task.assigneeName,
    task.department,
    task.taskType,
    task.target,
    task.output,
  ].some((value) => String(value || '').toLowerCase().includes(q));
}
import { tokens } from '../../ui/tokens';
