import { API_BASE } from './config';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { showNotify } from './Notification';
import { fetchWithAuth } from './auth';
import { consumeNavContext, setNavContext } from './navContext';
import { tokens } from './ui/tokens';
import { ui } from './ui/styles';
import {
  CalendarIcon,
  CloseIcon,
  PlusIcon,
  SearchIcon,
  TasksIcon,
  WarningIcon,
} from './ui/icons';
import {
  ALL_PROJECT,
  backendStatusFromUi,
  buildTaskPayload,
  isBlocked,
  isDueToday,
  isOverdue,
  matchesTaskSearch,
  normalizePriority,
  normalizeTaskStatus,
  PRIORITY_META,
  sortTasksByUrgency,
  type SurfaceKey,
  type TaskRecord,
  type UiTaskStatus,
  UI_STATUS_META,
} from './features/tasks/taskDomain';
import {
  buildTaskViewPresetPayload,
  collectTaskViewPresets,
  getDefaultTaskViewPreset,
  matchesTaskViewPreset,
  snapshotFromTaskViewPreset,
  type TaskViewPresetRecord,
  type TaskViewSnapshot,
} from './features/tasks/taskViewPresets';
import { buildTaskQuickViews } from './features/tasks/taskQuickViews';
import { type TaskGroupBy } from './features/tasks/taskGrouping';
import { loadTaskWorkspaceData } from './features/tasks/taskData';
import {
  closeDrawerState,
  createClosedDrawerState,
  createOpenDrawerState,
  type TaskDrawerState,
} from './features/tasks/taskDrawerState';
import { buildTaskWorkHubSummary } from './features/tasks/taskWorkHubData';
import {
  KanbanBoard,
  MetricTile,
  SurfaceTab,
  TaskDrawer,
  TaskList,
} from './features/tasks/taskViews';
import { buildTaskAccess } from './features/tasks/taskPermissions';
import { buildTaskWorkflowNavigation } from './features/tasks/taskWorkflowNavigation';
import { requestJsonWithAuth } from './shared/api/client';
import { ConfirmDialog } from './ui/ConfirmDialog';

const API = API_BASE;

const TASKS_POLISH_CSS = `
.tasks-workspace {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.tasks-workspace button,
.tasks-workspace input,
.tasks-workspace select,
.tasks-workspace textarea {
  transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease, background-color .18s ease, opacity .18s ease;
}
.tasks-workspace button:focus-visible,
.tasks-workspace input:focus-visible,
.tasks-workspace select:focus-visible,
.tasks-workspace textarea:focus-visible {
  outline: 0;
  box-shadow: 0 0 0 3px rgba(11, 163, 96, 0.18);
  border-color: var(--ht-green);
}
.tasks-workspace .planner-surface {
  position: relative;
  overflow: hidden;
}
.tasks-workspace .planner-surface::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--surface-sheen);
  pointer-events: none;
}
.tasks-workspace .planner-interactive:hover {
  transform: translateY(-1px);
  box-shadow: 0 16px 32px rgba(15, 23, 42, 0.08);
}
.tasks-workspace .planner-tab:hover {
  box-shadow: 0 10px 20px rgba(15, 23, 42, 0.08);
}
.tasks-workspace .planner-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 999px;
  background: var(--surface-chip-bg);
  border: 1px solid var(--border-color);
  font-size: 12px;
  font-weight: 700;
  color: var(--text-secondary);
}
.tasks-workspace .planner-chip strong {
  color: var(--text-primary);
}
.tasks-workspace .planner-inline-empty {
  padding: 18px 16px;
  border-radius: 16px;
  border: 1px dashed var(--border-color);
  background: var(--surface-empty-bg);
  color: var(--text-secondary);
  font-size: 13px;
}
.tasks-workspace .planner-skeleton {
  position: relative;
  overflow: hidden;
  background: var(--surface-skeleton-bg);
  background-size: 400% 100%;
  animation: plannerShimmer 1.6s ease infinite;
}
@keyframes plannerShimmer {
  0% { background-position: 100% 0; }
  100% { background-position: 0 0; }
}
.tasks-workspace .kanban-drop-target {
  box-shadow: inset 0 0 0 2px rgba(11, 163, 96, 0.3), 0 16px 32px rgba(11, 163, 96, 0.08);
}
.tasks-workspace .drawer-footer {
  position: sticky;
  bottom: 0;
  background: var(--surface-sticky-bg);
  backdrop-filter: blur(12px);
}
`;

const S = {
  page: { display: 'flex', flexDirection: 'column', gap: tokens.spacing.xl } as any,
  card: ui.card.base as any,
  input: { ...ui.input.base, transition: 'all 0.2s ease' } as any,
  select: { ...ui.input.base, transition: 'all 0.2s ease' } as any,
  btnPrimary: { ...ui.btn.primary, justifyContent: 'center' } as any,
  btnOutline: { ...ui.btn.outline, justifyContent: 'center' } as any,
};

function SectionHeader({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: any;
  title: string;
  subtitle: string;
  action?: any;
}) {
  const Icon = icon;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: tokens.spacing.lg }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: tokens.spacing.md }}>
        <div
          style={{
            width: '44px',
            height: '44px',
            display: 'grid',
            placeItems: 'center',
            borderRadius: '14px',
            background: '#e8f4ee',
            color: tokens.colors.primary,
          }}
        >
          <Icon size={20} />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 900, color: tokens.colors.textPrimary }}>{title}</h2>
          <p style={{ margin: '6px 0 0', color: tokens.colors.textSecondary, fontSize: '14px' }}>{subtitle}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

function loadingSkeleton(isMobile?: boolean) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, minmax(0, 1fr))', gap: tokens.spacing.mdPlus }}>
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="planner-skeleton" style={{ ...S.card, minHeight: '124px', borderRadius: tokens.radius.lg }} />
      ))}
    </div>
  );
}

export function Tasks({
  isMobile,
  currentUser,
  onNavigate,
}: {
  isMobile?: boolean;
  currentUser?: any;
  onNavigate?: (route: string) => void;
} = {}) {
  const token = currentUser?.token || '';
  const taskAccess = buildTaskAccess(currentUser?.roleCodes, currentUser?.systemRole || 'viewer');
  const userCanEdit = taskAccess.canEditTask;
  const userCanDelete = taskAccess.canDeleteTask;

  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [userLoadWarning, setUserLoadWarning] = useState('');

  const [search, setSearch] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState(ALL_PROJECT);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [groupBy, setGroupBy] = useState<TaskGroupBy>('none');
  const [surface, setSurface] = useState<SurfaceKey>('kanban');
  const [contextActive, setContextActive] = useState(false);
  const [taskViewPresets, setTaskViewPresets] = useState<TaskViewPresetRecord[]>([]);
  const [taskViewName, setTaskViewName] = useState('');
  const [taskViewIsDefault, setTaskViewIsDefault] = useState(false);
  const [taskViewWarning, setTaskViewWarning] = useState('');
  const [savingTaskView, setSavingTaskView] = useState(false);
  const [deletingTaskViewId, setDeletingTaskViewId] = useState<number | ''>('');
  const [defaultPresetApplied, setDefaultPresetApplied] = useState(false);

  const [drawer, setDrawer] = useState<TaskDrawerState>(() => createClosedDrawerState(currentUser, ALL_PROJECT));
  const [confirmState, setConfirmState] = useState<{ message: string; onConfirm: () => void } | null>(null);

  const [draggingTaskId, setDraggingTaskId] = useState<number | ''>('');
  const [hoveredStatus, setHoveredStatus] = useState<UiTaskStatus | ''>('');
  const [updatingTaskId, setUpdatingTaskId] = useState<number | ''>('');
  const [taskWorkHubSummary, setTaskWorkHubSummary] = useState<any | null>(null);
  const [taskThreadMessages, setTaskThreadMessages] = useState<any[]>([]);
  const [taskThreadDraft, setTaskThreadDraft] = useState('');
  const [taskChecklistItems, setTaskChecklistItems] = useState<any[]>([]);
  const [taskChecklistDraft, setTaskChecklistDraft] = useState('');
  const [taskChecklistEditingId, setTaskChecklistEditingId] = useState<number | ''>('');
  const [taskChecklistEditingTitle, setTaskChecklistEditingTitle] = useState('');
  const [taskSubtasks, setTaskSubtasks] = useState<TaskRecord[]>([]);
  const [taskSubtaskDraft, setTaskSubtaskDraft] = useState('');
  const [taskSubtaskEditingId, setTaskSubtaskEditingId] = useState<number | ''>('');
  const [taskSubtaskEditingTitle, setTaskSubtaskEditingTitle] = useState('');
  const [pendingOpenTaskThread, setPendingOpenTaskThread] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkPriority, setBulkPriority] = useState('');
  const [bulkAssigneeId, setBulkAssigneeId] = useState('');
  const [bulkUpdating, setBulkUpdating] = useState(false);

  const openDrawer = (task?: TaskRecord | null) => {
    setDrawer(createOpenDrawerState(task || null, currentUser, selectedProjectId));
  };

  const closeDrawer = () => {
    setDrawer(closeDrawerState(currentUser, selectedProjectId));
    setTaskWorkHubSummary(null);
    setTaskThreadMessages([]);
    setTaskThreadDraft('');
    setTaskChecklistItems([]);
    setTaskChecklistDraft('');
    setTaskChecklistEditingId('');
    setTaskChecklistEditingTitle('');
    setTaskSubtasks([]);
    setTaskSubtaskDraft('');
    setTaskSubtaskEditingId('');
    setTaskSubtaskEditingTitle('');
    setPendingOpenTaskThread(false);
    setSelectedTaskIds([]);
    setDraggingTaskId('');
    setHoveredStatus('');
  };

  const applyTaskViewSnapshot = (snapshot: TaskViewSnapshot) => {
    setSearch(snapshot.search);
    setSelectedProjectId(snapshot.selectedProjectId);
    setSelectedAssigneeId(snapshot.selectedAssigneeId);
    setSelectedPriority(snapshot.selectedPriority);
    setSelectedStatus(snapshot.selectedStatus);
    setOnlyOverdue(snapshot.onlyOverdue);
    setGroupBy((snapshot.groupBy as TaskGroupBy) || 'none');
    setSurface(snapshot.surface);
  };

  const currentTaskViewSnapshot = useMemo<TaskViewSnapshot>(() => ({
    search,
    selectedProjectId,
    selectedAssigneeId,
    selectedPriority,
    selectedStatus,
    onlyOverdue,
    groupBy,
    surface,
  }), [search, selectedProjectId, selectedAssigneeId, selectedPriority, selectedStatus, onlyOverdue, groupBy, surface]);

  const loadData = async () => {
    setLoading(true);
    setLoadError('');
    setUserLoadWarning('');
    setTaskViewWarning('');
    setDefaultPresetApplied(false);
    try {
      const [snapshot, presetsPayload] = await Promise.all([
        loadTaskWorkspaceData(API, token),
        requestJsonWithAuth<any>(token, `${API}/v1/tasks/views`, {}, 'Không thể tải task views').catch(() => null),
      ]);
      setTasks(snapshot.tasks);
      setProjects(snapshot.projects);
      setUsers(snapshot.users);
      setAccounts(snapshot.accounts);
      setLeads(snapshot.leads);
      setQuotations(snapshot.quotations);
      setUserLoadWarning(snapshot.userLoadWarning);
      if (presetsPayload) {
        setTaskViewPresets(collectTaskViewPresets(presetsPayload));
      } else {
        setTaskViewPresets([]);
        setTaskViewWarning('Không tải được saved views, task board vẫn hoạt động bình thường.');
      }
    } catch {
      setTasks([]);
      setProjects([]);
      setUsers([]);
      setAccounts([]);
      setLeads([]);
      setQuotations([]);
      setTaskViewPresets([]);
      setLoadError('Không tải được dữ liệu công việc. Bạn có thể thử lại mà không mất ngữ cảnh hiện tại.');
      showNotify('Không tải được dữ liệu công việc', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [token]);

  useEffect(() => {
    const ctx = consumeNavContext();
    if (!ctx) return;
    if (ctx.filters?.projectId) setSelectedProjectId(ctx.filters.projectId);
    if (ctx.filters?.priority) setSelectedPriority(normalizePriority(ctx.filters.priority));
    if (ctx.filters?.status) setSelectedStatus(normalizeTaskStatus(ctx.filters.status));
    if (ctx.filters?.overdue) setOnlyOverdue(true);

    if (ctx.filters?.projectId || ctx.filters?.priority || ctx.filters?.status || ctx.filters?.overdue) {
      setContextActive(true);
      setDefaultPresetApplied(true);
    }

    if (ctx.entityType === 'Task' && ctx.entityId && (ctx.autoOpenEdit || ctx.filters?.openThread)) {
      void (async () => {
        try {
          const response = await fetchWithAuth(token, `${API}/tasks/${ctx.entityId}`);
          if (!response.ok) return;
          const payload = await response.json();
          setPendingOpenTaskThread(Boolean(ctx.filters?.openThread));
          openDrawer(payload as TaskRecord);
        } catch {
          // ignore
        }
      })();
    }
  }, [token]);

  useEffect(() => {
    if (loading || contextActive || defaultPresetApplied) return;
    const defaultPreset = getDefaultTaskViewPreset(taskViewPresets);
    if (!defaultPreset) return;
    applyTaskViewSnapshot(snapshotFromTaskViewPreset(defaultPreset));
    setDefaultPresetApplied(true);
  }, [loading, contextActive, defaultPresetApplied, taskViewPresets]);

  useEffect(() => {
    const taskId = drawer.editingTask?.id;
    if (!drawer.open || !taskId || !token) {
      setTaskWorkHubSummary(null);
      setTaskChecklistItems([]);
      setTaskSubtasks([]);
      return;
    }

    let active = true;
    void (async () => {
      try {
        const [dependenciesPayload, worklogsPayload, threadPayload, checklistPayload, subtasksPayload] = await Promise.all([
          requestJsonWithAuth<any>(token, `${API}/v1/tasks/${taskId}/dependencies`, {}, 'Không thể tải dependencies'),
          requestJsonWithAuth<any>(token, `${API}/v1/tasks/${taskId}/worklogs`, {}, 'Không thể tải worklogs'),
          requestJsonWithAuth<any>(token, `${API}/v1/threads?entityType=Task&entityId=${taskId}`, {}, 'Không thể tải task thread').catch(() => ({ items: [] })),
          requestJsonWithAuth<any>(token, `${API}/v1/tasks/${taskId}/checklist`, {}, 'Không thể tải checklist').catch(() => ({ items: [] })),
          requestJsonWithAuth<any>(token, `${API}/v1/tasks/${taskId}/subtasks`, {}, 'Không thể tải subtasks').catch(() => ({ items: [] })),
        ]);
        if (!active) return;
        const summary = buildTaskWorkHubSummary({ dependenciesPayload, worklogsPayload, threadPayload, checklistPayload });
        setTaskWorkHubSummary(summary);
        setTaskChecklistItems(Array.isArray(checklistPayload?.items) ? checklistPayload.items : []);
        setTaskSubtasks(Array.isArray(subtasksPayload?.items) ? subtasksPayload.items : []);
        if (summary.threadId) {
          const messagesPayload = await requestJsonWithAuth<any>(token, `${API}/v1/threads/${summary.threadId}/messages`, {}, 'Không thể tải task thread messages').catch(() => ({ items: [] }));
          if (!active) return;
          setTaskThreadMessages(Array.isArray(messagesPayload?.items) ? messagesPayload.items : []);
        } else {
          setTaskThreadMessages([]);
        }
      } catch {
        if (!active) return;
        setTaskWorkHubSummary(null);
        setTaskThreadMessages([]);
        setTaskChecklistItems([]);
        setTaskSubtasks([]);
      }
    })();

    return () => {
      active = false;
    };
  }, [drawer.open, drawer.editingTask?.id, token]);

  useEffect(() => {
    if (!pendingOpenTaskThread || !drawer.open || !drawer.editingTask?.id) return;
    void (async () => {
      await openTaskThread();
      setPendingOpenTaskThread(false);
    })();
  }, [pendingOpenTaskThread, drawer.open, drawer.editingTask?.id, taskWorkHubSummary?.threadId]);

  const filteredTasks = useMemo(() => {
    return sortTasksByUrgency(
      tasks.filter((task) => {
        if (selectedProjectId !== ALL_PROJECT && String(task.projectId || '') !== selectedProjectId) return false;
        if (selectedAssigneeId && String(task.assigneeId || '') !== selectedAssigneeId) return false;
        if (selectedPriority && normalizePriority(task.priority) !== selectedPriority) return false;
        if (selectedStatus && normalizeTaskStatus(task.status) !== selectedStatus) return false;
        if (onlyOverdue && !isOverdue(task)) return false;
        return matchesTaskSearch(task, search);
      })
    );
  }, [tasks, selectedProjectId, selectedAssigneeId, selectedPriority, selectedStatus, onlyOverdue, search]);

  const toggleSelectedTask = (taskId: number, checked: boolean) => {
    setSelectedTaskIds((prev) => checked ? Array.from(new Set([...prev, taskId])) : prev.filter((id) => id !== taskId));
  };

  const toggleAllVisibleTasks = (checked: boolean) => {
    setSelectedTaskIds(checked ? filteredTasks.map((task) => task.id) : []);
  };

  const metrics = useMemo(() => ({
    overdue: filteredTasks.filter(isOverdue).length,
    blocked: filteredTasks.filter(isBlocked).length,
    highPriority: filteredTasks.filter((task) => normalizePriority(task.priority) === 'high').length,
    dueToday: filteredTasks.filter(isDueToday).length,
  }), [filteredTasks]);

  const selectedProjectName = useMemo(
    () => selectedProjectId === ALL_PROJECT ? 'Tất cả project' : projects.find((project) => project.id === selectedProjectId)?.name || 'Project đã chọn',
    [projects, selectedProjectId]
  );

  const activeFilterCount = [search, selectedAssigneeId, selectedPriority, selectedStatus].filter(Boolean).length
    + (selectedProjectId !== ALL_PROJECT ? 1 : 0)
    + (onlyOverdue ? 1 : 0)
    + (groupBy !== 'none' ? 1 : 0);

  const activeTaskViewPresetId = useMemo(
    () => taskViewPresets.find((preset) => matchesTaskViewPreset(currentTaskViewSnapshot, preset))?.id || '',
    [taskViewPresets, currentTaskViewSnapshot]
  );
  const taskQuickViews = useMemo(
    () => buildTaskQuickViews(tasks, currentUser?.id),
    [tasks, currentUser?.id]
  );

  const resetFilters = () => {
    setSearch('');
    setSelectedProjectId(ALL_PROJECT);
    setSelectedAssigneeId('');
    setSelectedPriority('');
    setSelectedStatus('');
    setOnlyOverdue(false);
    setGroupBy('none');
    setSurface('kanban');
    setContextActive(false);
    setTaskViewIsDefault(false);
  };

  const saveCurrentTaskView = async () => {
    const payload = buildTaskViewPresetPayload(taskViewName, currentTaskViewSnapshot, taskViewIsDefault);
    if (!payload.name) {
      showNotify('Nhập tên view trước khi lưu', 'error');
      return;
    }

    setSavingTaskView(true);
    try {
      const created = await requestJsonWithAuth<any>(token, `${API}/v1/tasks/views`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }, 'Không thể lưu task view');
      const normalized = collectTaskViewPresets({ items: [created] })[0];
      setTaskViewPresets((prev) => {
        const next = payload.isDefault
          ? prev.map((item) => ({ ...item, isDefault: false }))
          : prev;
        return normalized ? [...next, normalized] : next;
      });
      setTaskViewName('');
      setTaskViewIsDefault(false);
      setDefaultPresetApplied(true);
      showNotify('Đã lưu task view', 'success');
    } catch {
      showNotify('Không lưu được task view', 'error');
    } finally {
      setSavingTaskView(false);
    }
  };

  const updateActiveTaskView = async () => {
    const activePreset = taskViewPresets.find((preset) => preset.id === activeTaskViewPresetId);
    if (!activePreset) {
      showNotify('Chọn một saved view trước khi cập nhật', 'error');
      return;
    }
    const payload = buildTaskViewPresetPayload(activePreset.name, currentTaskViewSnapshot, Boolean(activePreset.isDefault));
    setSavingTaskView(true);
    try {
      const updated = await requestJsonWithAuth<any>(token, `${API}/v1/tasks/views/${activePreset.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }, 'Không thể cập nhật task view');
      const normalized = collectTaskViewPresets({ items: [updated] })[0];
      setTaskViewPresets((prev) => prev.map((preset) => {
        if (preset.id === activePreset.id) return normalized || preset;
        if (normalized?.isDefault) return { ...preset, isDefault: false };
        return preset;
      }));
      showNotify('Đã cập nhật task view', 'success');
    } catch {
      showNotify('Không cập nhật được task view', 'error');
    } finally {
      setSavingTaskView(false);
    }
  };

  const deleteTaskViewPreset = async (presetId: number) => {
    setDeletingTaskViewId(presetId);
    try {
      await requestJsonWithAuth<any>(token, `${API}/v1/tasks/views/${presetId}`, { method: 'DELETE' }, 'Không thể xóa task view');
      setTaskViewPresets((prev) => prev.filter((preset) => preset.id !== presetId));
      showNotify('Đã xóa task view', 'success');
    } catch {
      showNotify('Không xóa được task view', 'error');
    } finally {
      setDeletingTaskViewId('');
    }
  };

  const applyTaskViewPreset = (preset: TaskViewPresetRecord) => {
    applyTaskViewSnapshot(snapshotFromTaskViewPreset(preset));
    setContextActive(false);
    setDefaultPresetApplied(true);
    setTaskViewName(preset.name);
    setTaskViewIsDefault(Boolean(preset.isDefault));
  };

  const applyQuickView = (snapshot: TaskViewSnapshot) => {
    applyTaskViewSnapshot(snapshot);
    setContextActive(false);
    setDefaultPresetApplied(true);
    setTaskViewIsDefault(false);
  };

  const applyBulkTaskAction = async () => {
    if (!selectedTaskIds.length) {
      showNotify('Chọn ít nhất một task', 'error');
      return;
    }
    if (!bulkStatus && !bulkPriority && !bulkAssigneeId) {
      showNotify('Chọn ít nhất một thay đổi bulk', 'error');
      return;
    }
    setBulkUpdating(true);
    try {
      const result = await requestJsonWithAuth<any>(token, `${API}/v1/tasks/bulk-update`, {
        method: 'POST',
        body: JSON.stringify({
          taskIds: selectedTaskIds,
          changes: {
            status: bulkStatus ? backendStatusFromUi(bulkStatus as UiTaskStatus) : null,
            priority: bulkPriority || null,
            assigneeId: bulkAssigneeId || null,
          },
        }),
      }, 'Không thể cập nhật hàng loạt task');
      const updatedItems = (Array.isArray(result?.items) ? result.items : []) as TaskRecord[];
      const updatedById = new Map<number, TaskRecord>(updatedItems.map((item) => [item.id, item]));
      setTasks((prev) => prev.map((task) => updatedById.get(task.id) ?? task));
      setSelectedTaskIds([]);
      setBulkStatus('');
      setBulkPriority('');
      setBulkAssigneeId('');
      showNotify(`Đã cập nhật ${Number(result?.updatedCount || 0)} task`, 'success');
    } catch (error: any) {
      showNotify(error?.message || 'Không thể cập nhật hàng loạt task', 'error');
    } finally {
      setBulkUpdating(false);
    }
  };

  const moveProjectTask = async (taskId: number, direction: 'up' | 'down') => {
    if (selectedProjectId === ALL_PROJECT || groupBy !== 'none') return;
    const topLevelTasks = filteredTasks.filter((task) => !task.parentTaskId);
    const currentIndex = topLevelTasks.findIndex((task) => task.id === taskId);
    if (currentIndex < 0) return;
    const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (nextIndex < 0 || nextIndex >= topLevelTasks.length) return;
    const reordered = [...topLevelTasks];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(nextIndex, 0, moved);
    try {
      const result = await requestJsonWithAuth<any>(token, `${API}/v1/projects/${selectedProjectId}/tasks/reorder`, {
        method: 'POST',
        body: JSON.stringify({ orderedTaskIds: reordered.map((task) => task.id) }),
      }, 'Không thể đổi thứ tự task');
      const updatedItems = (Array.isArray(result?.items) ? result.items : []) as TaskRecord[];
      const updatedById = new Map<number, TaskRecord>(updatedItems.map((item) => [item.id, item]));
      setTasks((prev) => prev.map((task) => updatedById.get(task.id) ?? task));
    } catch (error: any) {
      showNotify(error?.message || 'Không thể đổi thứ tự task', 'error');
    }
  };

  const saveTask = async () => {
    if (!taskAccess.canCreateTask) {
      showNotify('Role hiện tại chỉ xem task, không thể lưu thay đổi execution', 'error');
      return;
    }

    if (!drawer.form.name.trim()) {
      showNotify('Tên công việc là bắt buộc', 'error');
      return;
    }

    setDrawer((prev) => ({ ...prev, saving: true }));
    const isEdit = drawer.mode === 'edit' && !!drawer.editingTask;
    const method = isEdit ? 'PUT' : 'POST';
    const url = isEdit ? `${API}/tasks/${drawer.editingTask?.id}` : `${API}/tasks`;

    try {
      const response = await fetchWithAuth(token, url, {
        method,
        body: JSON.stringify(buildTaskPayload(drawer.form)),
      });
      if (!response.ok) throw new Error('save_failed');
      const payload = await response.json();
      const saved = payload as TaskRecord;
      if (!saved?.id) throw new Error('invalid_saved_payload');

      setTasks((prev) => method === 'POST' ? [saved, ...prev] : prev.map((task) => task.id === saved.id ? saved : task));
      showNotify(method === 'POST' ? 'Đã tạo công việc' : 'Đã cập nhật công việc', 'success');
      closeDrawer();
    } catch {
      showNotify('Không lưu được công việc', 'error');
      setDrawer((prev) => ({ ...prev, saving: false }));
    }
  };

  const deleteTask = () => {
    if (!taskAccess.canDeleteTask) {
      showNotify('Role hiện tại không thể xóa task execution', 'error');
      return;
    }
    if (!drawer.editingTask) return;
    const taskId = drawer.editingTask.id;
    setConfirmState({
      message: 'Xóa công việc này?',
      onConfirm: async () => {
        setConfirmState(null);
        const previousTasks = tasks;
        setTasks((prev) => prev.filter((task) => task.id !== taskId));
        try {
          const response = await fetchWithAuth(token, `${API}/tasks/${taskId}`, { method: 'DELETE' });
          if (!response.ok) throw new Error('delete_failed');
          showNotify('Đã xóa công việc', 'success');
          closeDrawer();
        } catch {
          setTasks(previousTasks);
          showNotify('Không xóa được công việc', 'error');
        }
      },
    });
  };

  const updateTaskStatus = async (taskId: number, nextStatus: UiTaskStatus) => {
    if (!taskAccess.canUpdateTaskStatus) {
      showNotify('Role hiện tại chỉ xem task, không thể đổi trạng thái execution', 'error');
      return;
    }

    const currentTask = tasks.find((task) => task.id === taskId);
    if (!currentTask) return;

    const previousTasks = tasks;
    setUpdatingTaskId(taskId);

    const optimistic = {
      ...currentTask,
      status: backendStatusFromUi(nextStatus),
      completionPct: nextStatus === 'complete' ? 100 : Number(currentTask.completionPct || 0),
    };

    setTasks((prev) => prev.map((task) => task.id === taskId ? optimistic : task));

    try {
      const response = await fetchWithAuth(token, `${API}/tasks/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify({ ...currentTask, status: optimistic.status, completionPct: optimistic.completionPct }),
      });
      if (!response.ok) throw new Error('status_failed');
      const saved = await response.json();
      setTasks((prev) => prev.map((task) => task.id === taskId ? saved : task));
    } catch {
      setTasks(previousTasks);
      showNotify('Không cập nhật được trạng thái', 'error');
    } finally {
      setDraggingTaskId('');
      setHoveredStatus('');
      setUpdatingTaskId('');
    }
  };

  const openProjectFromDrawer = () => {
    if (!drawer.form.projectId) return;
    setNavContext({ route: 'Projects', entityType: 'Project', entityId: drawer.form.projectId });
    onNavigate?.('Projects');
  };

  const openWorkflowFromTask = (task: TaskRecord) => {
    const target = buildTaskWorkflowNavigation(task);
    if (target) {
      setNavContext(target.navContext);
      onNavigate?.(target.route);
      return;
    }
    openDrawer(task);
  };

  const openTaskThread = async () => {
    const taskId = drawer.editingTask?.id;
    if (!taskId || !token) return;
    if (!taskWorkHubSummary?.threadId) {
      try {
        const createdThread = await requestJsonWithAuth<any>(token, `${API}/v1/threads`, {
          method: 'POST',
          body: JSON.stringify({
            entityType: 'Task',
            entityId: taskId,
            title: drawer.form.name || 'Task thread',
          }),
        }, 'Không thể tạo task thread');
        setTaskWorkHubSummary((prev: any) => prev ? { ...prev, threadId: createdThread.id, hasActiveThread: true } : prev);
      } catch (error: any) {
        showNotify(error?.message || 'Không thể tạo task thread', 'error');
      }
    }
  };

  const sendTaskThreadMessage = async () => {
    const taskId = drawer.editingTask?.id;
    const content = String(taskThreadDraft || '').trim();
    if (!taskId || !content) return;
    try {
      let threadId = taskWorkHubSummary?.threadId;
      if (!threadId) {
        const createdThread = await requestJsonWithAuth<any>(token, `${API}/v1/threads`, {
          method: 'POST',
          body: JSON.stringify({
            entityType: 'Task',
            entityId: taskId,
            title: drawer.form.name || 'Task thread',
          }),
        }, 'Không thể tạo task thread');
        threadId = createdThread.id;
      }
      await requestJsonWithAuth<any>(token, `${API}/v1/threads/${threadId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      }, 'Không thể gửi task thread message');
      setTaskThreadDraft('');
      const messagesPayload = await requestJsonWithAuth<any>(token, `${API}/v1/threads/${threadId}/messages`, {}, 'Không thể tải task thread messages');
      setTaskThreadMessages(Array.isArray(messagesPayload?.items) ? messagesPayload.items : []);
    } catch (error: any) {
      showNotify(error?.message || 'Không thể gửi task thread message', 'error');
    }
  };

  const refreshTaskChecklist = async (taskId: number) => {
    const payload = await requestJsonWithAuth<any>(token, `${API}/v1/tasks/${taskId}/checklist`, {}, 'Không thể tải checklist');
    setTaskChecklistItems(Array.isArray(payload?.items) ? payload.items : []);
  };

  const addTaskChecklistItem = async () => {
    const taskId = drawer.editingTask?.id;
    const title = String(taskChecklistDraft || '').trim();
    if (!taskId || !title) return;
    try {
      await requestJsonWithAuth<any>(token, `${API}/v1/tasks/${taskId}/checklist`, {
        method: 'POST',
        body: JSON.stringify({ title, priority: 'medium' }),
      }, 'Không thể tạo checklist item');
      setTaskChecklistDraft('');
      await refreshTaskChecklist(taskId);
    } catch (error: any) {
      showNotify(error?.message || 'Không thể tạo checklist item', 'error');
    }
  };

  const toggleTaskChecklistItem = async (item: any, done: boolean) => {
    const taskId = drawer.editingTask?.id;
    if (!taskId || !item?.id) return;
    try {
      await requestJsonWithAuth<any>(token, `${API}/v1/tasks/${taskId}/checklist/${item.id}/${done ? 'done' : 'undone'}`, {
        method: 'POST',
      }, 'Không thể cập nhật checklist item');
      await refreshTaskChecklist(taskId);
    } catch (error: any) {
      showNotify(error?.message || 'Không thể cập nhật checklist item', 'error');
    }
  };

  const deleteTaskChecklistItem = async (itemId: number) => {
    const taskId = drawer.editingTask?.id;
    if (!taskId || !itemId) return;
    try {
      await requestJsonWithAuth<any>(token, `${API}/v1/tasks/${taskId}/checklist/${itemId}`, {
        method: 'DELETE',
      }, 'Không thể xóa checklist item');
      await refreshTaskChecklist(taskId);
    } catch (error: any) {
      showNotify(error?.message || 'Không thể xóa checklist item', 'error');
    }
  };

  const saveTaskChecklistItem = async () => {
    const taskId = drawer.editingTask?.id;
    const itemId = taskChecklistEditingId;
    const title = String(taskChecklistEditingTitle || '').trim();
    if (!taskId || !itemId || !title) return;
    try {
      await requestJsonWithAuth<any>(token, `${API}/v1/tasks/${taskId}/checklist/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify({ title }),
      }, 'Không thể cập nhật checklist item');
      setTaskChecklistEditingId('');
      setTaskChecklistEditingTitle('');
      await refreshTaskChecklist(taskId);
    } catch (error: any) {
      showNotify(error?.message || 'Không thể cập nhật checklist item', 'error');
    }
  };

  const refreshTaskSubtasks = async (taskId: number) => {
    const payload = await requestJsonWithAuth<any>(token, `${API}/v1/tasks/${taskId}/subtasks`, {}, 'Không thể tải subtasks');
    setTaskSubtasks(Array.isArray(payload?.items) ? payload.items : []);
  };

  const addTaskSubtask = async () => {
    const taskId = drawer.editingTask?.id;
    const name = String(taskSubtaskDraft || '').trim();
    if (!taskId || !name) return;
    try {
      await requestJsonWithAuth<any>(token, `${API}/v1/tasks/${taskId}/subtasks`, {
        method: 'POST',
        body: JSON.stringify({
          name,
          priority: 'medium',
        }),
      }, 'Không thể tạo subtask');
      setTaskSubtaskDraft('');
      await refreshTaskSubtasks(taskId);
    } catch (error: any) {
      showNotify(error?.message || 'Không thể tạo subtask', 'error');
    }
  };

  const saveTaskSubtask = async () => {
    const subtaskId = taskSubtaskEditingId;
    const name = String(taskSubtaskEditingTitle || '').trim();
    if (!subtaskId || !name) return;
    const existing = taskSubtasks.find((task) => task.id === subtaskId);
    if (!existing) return;
    try {
      await fetchWithAuth(token, `${API}/tasks/${subtaskId}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...existing,
          name,
        }),
      });
      setTaskSubtaskEditingId('');
      setTaskSubtaskEditingTitle('');
      if (drawer.editingTask?.id) {
        await refreshTaskSubtasks(drawer.editingTask.id);
      }
    } catch (error: any) {
      showNotify(error?.message || 'Không thể cập nhật subtask', 'error');
    }
  };

  const moveTaskSubtask = async (taskId: number, direction: 'up' | 'down') => {
    const parentTaskId = drawer.editingTask?.id;
    if (!parentTaskId) return;
    const currentIndex = taskSubtasks.findIndex((task) => task.id === taskId);
    if (currentIndex < 0) return;
    const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (nextIndex < 0 || nextIndex >= taskSubtasks.length) return;

    const reordered = [...taskSubtasks];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(nextIndex, 0, moved);

    try {
      await requestJsonWithAuth<any>(token, `${API}/v1/tasks/${parentTaskId}/subtasks/reorder`, {
        method: 'POST',
        body: JSON.stringify({ orderedTaskIds: reordered.map((task) => task.id) }),
      }, 'Không thể đổi thứ tự subtask');
      setTaskSubtasks(reordered);
    } catch (error: any) {
      showNotify(error?.message || 'Không thể đổi thứ tự subtask', 'error');
    }
  };

  const deleteTaskSubtask = async (taskId: number) => {
    const parentTaskId = drawer.editingTask?.id;
    if (!parentTaskId || !taskId) return;
    try {
      await requestJsonWithAuth<any>(token, `${API}/v1/tasks/${parentTaskId}/subtasks/${taskId}`, {
        method: 'DELETE',
      }, 'Không thể xóa subtask');
      await refreshTaskSubtasks(parentTaskId);
    } catch (error: any) {
      showNotify(error?.message || 'Không thể xóa subtask', 'error');
    }
  };

  return (
    <div className="tasks-workspace" style={S.page}>
      <style>{TASKS_POLISH_CSS}</style>
      {confirmState && <ConfirmDialog message={confirmState.message} onConfirm={confirmState.onConfirm} onCancel={() => setConfirmState(null)} />}

      <SectionHeader
        icon={TasksIcon}
        title="Công việc"
        subtitle="Balanced planner để điều phối task nhanh, ổn định và bám sát ngữ cảnh project."
        action={
          userCanEdit
            ? <button onClick={() => openDrawer(null)} style={S.btnPrimary} aria-label="Tạo công việc mới"><PlusIcon size={16} /> Thêm công việc</button>
            : null
        }
      />

      <div className="planner-surface" style={{ ...S.card, padding: tokens.spacing.lgPlus, display: 'flex', flexDirection: 'column', gap: tokens.spacing.lg }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: tokens.spacing.mdPlus, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 900, color: tokens.colors.textPrimary }}>Scope bar</div>
            <div style={{ marginTop: '6px', fontSize: '13px', color: tokens.colors.textSecondary }}>
              Chọn phạm vi, owner và mức ưu tiên để board/list chạy cùng một ngữ cảnh.
            </div>
          </div>
          <div style={{ display: 'flex', gap: tokens.spacing.sm, flexWrap: 'wrap' }}>
            {contextActive ? <span style={{ padding: `${tokens.spacing.xsPlus} ${tokens.spacing.smPlus}`, borderRadius: '999px', background: tokens.colors.surfaceSuccessSoft, color: tokens.colors.primary, fontSize: tokens.fontSize.sm, fontWeight: 800 }}>Ngữ cảnh chuyển trang đang bật</span> : null}
            <button onClick={resetFilters} style={S.btnOutline}>Xóa bộ lọc</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: tokens.spacing.sm, flexWrap: 'wrap' }}>
          <div className="planner-chip"><strong>Scope</strong><span>{selectedProjectName}</span></div>
          <div className="planner-chip"><strong>Filters</strong><span>{activeFilterCount > 0 ? `${activeFilterCount} đang bật` : 'Mặc định'}</span></div>
          {search ? <div className="planner-chip"><strong>Search</strong><span>{search}</span></div> : null}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.5fr repeat(5, minmax(0, 1fr))', gap: tokens.spacing.md }}>
          <div style={{ position: 'relative' }}>
            <SearchIcon size={16} style={{ position: 'absolute', top: '50%', left: '14px', transform: 'translateY(-50%)', color: tokens.colors.textMuted }} />
            <input aria-label="Tìm kiếm công việc" style={{ ...S.input, paddingLeft: '42px' }} placeholder="Tìm theo task, project, owner..." value={search} onInput={(event: any) => setSearch(event.target.value)} />
          </div>
          <select style={S.select} value={selectedProjectId} onChange={(event: any) => setSelectedProjectId(event.target.value)}>
            <option value={ALL_PROJECT}>Tất cả project</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
          <select style={S.select} value={selectedAssigneeId} onChange={(event: any) => setSelectedAssigneeId(event.target.value)}>
            <option value="">Tất cả owner</option>
            {users.map((user) => <option key={user.id} value={user.id}>{user.fullName || user.username}</option>)}
          </select>
          <select style={S.select} value={selectedPriority} onChange={(event: any) => setSelectedPriority(event.target.value)}>
            <option value="">Tất cả ưu tiên</option>
            {Object.keys(PRIORITY_META).map((priority) => <option key={priority} value={priority}>{PRIORITY_META[priority as keyof typeof PRIORITY_META].label}</option>)}
          </select>
          <select style={S.select} value={selectedStatus} onChange={(event: any) => setSelectedStatus(event.target.value)}>
            <option value="">Tất cả trạng thái</option>
            {Object.keys(UI_STATUS_META).map((status) => <option key={status} value={status}>{UI_STATUS_META[status as keyof typeof UI_STATUS_META].label}</option>)}
          </select>
          <select style={S.select} value={groupBy} onChange={(event: any) => setGroupBy(event.target.value as TaskGroupBy)}>
            <option value="none">Không group</option>
            <option value="project">Group theo project</option>
            <option value="assignee">Group theo owner</option>
            <option value="department">Group theo department</option>
            <option value="taskType">Group theo task type</option>
            <option value="urgency">Group theo urgency lane</option>
            <option value="hierarchy">Group theo hierarchy</option>
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.sm, ...S.select }}>
            <input type="checkbox" checked={onlyOverdue} onChange={(event: any) => setOnlyOverdue(Boolean(event.target.checked))} />
            Chỉ task quá hạn
          </label>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.md }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: tokens.spacing.md, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 900, color: tokens.colors.textPrimary }}>Saved views</div>
              <div style={{ marginTop: '4px', fontSize: '13px', color: tokens.colors.textSecondary }}>
                Port native từ tư duy tracker của Huly: lưu bộ lọc và surface để vào lại task board nhanh hơn.
              </div>
            </div>
            <div style={{ display: 'flex', gap: tokens.spacing.sm, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                aria-label="Tên task view"
                style={{ ...S.input, minWidth: isMobile ? '100%' : '220px' }}
                placeholder="Tên view hiện tại"
                value={taskViewName}
                onInput={(event: any) => setTaskViewName(event.target.value)}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.xsPlus, ...S.select, minWidth: 'fit-content' }}>
                <input type="checkbox" checked={taskViewIsDefault} onChange={(event: any) => setTaskViewIsDefault(Boolean(event.target.checked))} />
                Mặc định
              </label>
              <button onClick={saveCurrentTaskView} style={S.btnOutline} disabled={savingTaskView}>
                {savingTaskView ? 'Đang lưu...' : 'Lưu view'}
              </button>
              {activeTaskViewPresetId ? (
                <button onClick={updateActiveTaskView} style={S.btnOutline} disabled={savingTaskView}>
                  {savingTaskView ? 'Đang cập nhật...' : 'Cập nhật view'}
                </button>
              ) : null}
            </div>
          </div>

          <div style={{ display: 'flex', gap: tokens.spacing.sm, flexWrap: 'wrap' }}>
            {taskQuickViews.map((view) => {
              const active = matchesTaskViewPreset(currentTaskViewSnapshot, {
                id: Number(view.id),
                name: view.label,
                query: view.snapshot.search,
                projectId: view.snapshot.selectedProjectId === ALL_PROJECT ? null : Number(view.snapshot.selectedProjectId),
                assigneeId: view.snapshot.selectedAssigneeId ? Number(view.snapshot.selectedAssigneeId) : null,
                priority: view.snapshot.selectedPriority || null,
                status: view.snapshot.selectedStatus || null,
                onlyOverdue: view.snapshot.onlyOverdue,
                groupBy: view.snapshot.groupBy || 'none',
                surface: view.snapshot.surface,
                isDefault: false,
              });
              return (
                <button
                  key={view.id}
                  onClick={() => applyQuickView(view.snapshot)}
                  style={{
                    ...S.btnOutline,
                    borderRadius: '999px',
                    background: active ? tokens.colors.primary : tokens.colors.surface,
                    color: active ? tokens.colors.textOnPrimary : tokens.colors.textPrimary,
                    borderColor: active ? tokens.colors.primary : tokens.colors.border,
                  }}
                >
                  {view.label} · {view.count}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: tokens.spacing.sm, flexWrap: 'wrap' }}>
            {taskViewPresets.length === 0 ? (
              <div className="planner-inline-empty" style={{ width: '100%' }}>
                Chưa có saved view nào. Lưu bộ lọc hiện tại để tạo task cockpit riêng theo team hoặc workflow.
              </div>
            ) : (
              taskViewPresets.map((preset) => {
                const active = preset.id === activeTaskViewPresetId;
                return (
                  <div
                    key={preset.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: tokens.spacing.xsPlus,
                      padding: `${tokens.spacing.xsPlus} ${tokens.spacing.smPlus}`,
                      borderRadius: '999px',
                      background: active ? tokens.colors.primary : tokens.colors.surfaceSubtle,
                      color: active ? tokens.colors.textOnPrimary : tokens.colors.textPrimary,
                      border: active ? 'none' : `1px solid ${tokens.colors.border}`,
                    }}
                  >
                    <button
                      onClick={() => applyTaskViewPreset(preset)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: 'inherit',
                        fontSize: tokens.fontSize.sm,
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      {preset.name}
                    </button>
                    {preset.isDefault ? <span style={{ fontSize: tokens.fontSize.xs, fontWeight: 800, opacity: 0.82 }}>Default</span> : null}
                    <button
                      onClick={() => deleteTaskViewPreset(preset.id)}
                      disabled={deletingTaskViewId === preset.id}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: 'inherit',
                        cursor: 'pointer',
                        fontSize: tokens.fontSize.xs,
                        fontWeight: 900,
                        opacity: deletingTaskViewId === preset.id ? 0.5 : 0.8,
                      }}
                      aria-label={`Xóa saved view ${preset.name}`}
                    >
                      ×
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {loadError ? (
          <div className="planner-inline-empty" style={{ borderStyle: 'solid', borderColor: 'var(--error-surface-border)', background: 'var(--error-surface-bg-soft)' }}>
            {loadError}
          </div>
        ) : null}
        {userLoadWarning ? (
          <div className="planner-inline-empty" style={{ borderStyle: 'solid', borderColor: 'var(--warning-surface-border)', background: 'var(--warning-surface-bg-soft)' }}>
            {userLoadWarning}
          </div>
        ) : null}
        {taskViewWarning ? (
          <div className="planner-inline-empty" style={{ borderStyle: 'solid', borderColor: 'var(--warning-surface-border)', background: 'var(--warning-surface-bg-soft)' }}>
            {taskViewWarning}
          </div>
        ) : null}
      </div>

      {loading ? loadingSkeleton(isMobile) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, minmax(0, 1fr))', gap: tokens.spacing.mdPlus }}>
          <MetricTile icon={WarningIcon} label="Quá hạn" value={metrics.overdue} note="Cần xử lý ngay để không làm chậm project." accent="#b42318" />
          <MetricTile icon={CloseIcon} label="Đang bị chặn" value={metrics.blocked} note="Task cần gỡ blocker hoặc ra quyết định." accent="#c06b21" />
          <MetricTile icon={TasksIcon} label="Ưu tiên cao" value={metrics.highPriority} note="Nhóm việc ảnh hưởng lớn đến tiến độ tuần này." accent={tokens.colors.primary} />
          <MetricTile icon={CalendarIcon} label="Đến hạn hôm nay" value={metrics.dueToday} note="Các đầu việc cần được chốt trong ngày." accent="#2563eb" />
        </div>
      )}

      <div className="planner-surface" style={{ ...S.card, padding: tokens.spacing.lgPlus, display: 'flex', flexDirection: 'column', gap: tokens.spacing.lgPlus }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: tokens.spacing.mdPlus, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 900, color: tokens.colors.textPrimary }}>Task board</div>
            <div style={{ marginTop: '6px', fontSize: '13px', color: tokens.colors.textSecondary }}>
              Chuyển nhanh giữa Kanban kéo-thả và danh sách để xử lý task theo ngữ cảnh.
            </div>
          </div>
          <div style={{ display: 'flex', gap: tokens.spacing.sm, flexWrap: 'wrap' }}>
            <SurfaceTab active={surface === 'kanban'} label="Kanban" onClick={() => setSurface('kanban')} />
            <SurfaceTab active={surface === 'list'} label="Danh sách" onClick={() => setSurface('list')} />
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'grid', gap: tokens.spacing.md }}>
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="planner-skeleton" style={{ ...S.card, minHeight: '220px' }} />
            ))}
          </div>
        ) : null}

        {!loading && filteredTasks.length === 0 ? (
          <div className="planner-inline-empty">Không có công việc nào khớp với phạm vi đang chọn. Bạn có thể đổi project hoặc xoá bớt bộ lọc để tiếp tục điều phối.</div>
        ) : null}

        {!loading && filteredTasks.length > 0 ? (
          <div style={{ ...S.card, padding: tokens.spacing.md, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, minmax(0, 1fr)) auto', gap: tokens.spacing.sm, alignItems: 'center' }}>
            <select style={S.select} value={bulkStatus} onChange={(event: any) => setBulkStatus(event.target.value)}>
              <option value="">Bulk status</option>
              {Object.keys(UI_STATUS_META).map((status) => <option key={status} value={status}>{UI_STATUS_META[status as keyof typeof UI_STATUS_META].label}</option>)}
            </select>
            <select style={S.select} value={bulkPriority} onChange={(event: any) => setBulkPriority(event.target.value)}>
              <option value="">Bulk priority</option>
              {Object.keys(PRIORITY_META).map((priority) => <option key={priority} value={priority}>{PRIORITY_META[priority as keyof typeof PRIORITY_META].label}</option>)}
            </select>
            <select style={S.select} value={bulkAssigneeId} onChange={(event: any) => setBulkAssigneeId(event.target.value)}>
              <option value="">Bulk owner</option>
              {users.map((user) => <option key={user.id} value={user.id}>{user.fullName || user.username}</option>)}
            </select>
            <div className="planner-chip"><strong>Selected</strong><span>{selectedTaskIds.length}</span></div>
            <button onClick={applyBulkTaskAction} style={S.btnOutline} disabled={bulkUpdating}>{bulkUpdating ? 'Đang áp dụng...' : 'Áp dụng hàng loạt'}</button>
          </div>
        ) : null}

        {!loading && filteredTasks.length > 0 && surface === 'kanban' ? (
          <KanbanBoard
            tasks={filteredTasks}
            draggingTaskId={draggingTaskId}
            hoveredStatus={hoveredStatus}
            updatingTaskId={updatingTaskId}
            selectedTaskIds={selectedTaskIds}
            canDrag={userCanEdit}
            onDragStart={setDraggingTaskId}
            onHoverStatus={setHoveredStatus}
            onDropStatus={(status) => draggingTaskId && updateTaskStatus(draggingTaskId, status)}
            onToggleTaskSelection={toggleSelectedTask}
            onOpenTask={openDrawer}
            onOpenWorkflow={openWorkflowFromTask}
          />
        ) : null}

        {!loading && filteredTasks.length > 0 && surface === 'list' ? (
          <div style={{ display: 'grid', gap: tokens.spacing.md }}>
            <TaskList
              tasks={filteredTasks}
              groupBy={groupBy}
              isMobile={isMobile}
              selectedTaskIds={selectedTaskIds}
              onToggleTask={toggleSelectedTask}
              onToggleAllTasks={toggleAllVisibleTasks}
              canReorderProjectTasks={selectedProjectId !== ALL_PROJECT && groupBy === 'none'}
              onMoveProjectTask={moveProjectTask}
              onOpenTask={openDrawer}
              onOpenWorkflow={openWorkflowFromTask}
            />
          </div>
        ) : null}
      </div>

      <TaskDrawer
        open={drawer.open}
        mode={drawer.mode}
        form={drawer.form}
        saving={drawer.saving}
        advanced={drawer.advanced}
        canEditTask={userCanEdit}
        canDeleteTask={userCanDelete}
        projects={projects}
        users={users}
        userLoadWarning={userLoadWarning}
        accounts={accounts}
        leads={leads}
        quotations={quotations}
        workHubSummary={taskWorkHubSummary}
        checklistItems={taskChecklistItems}
        checklistDraft={taskChecklistDraft}
        checklistEditingId={taskChecklistEditingId}
        checklistEditingTitle={taskChecklistEditingTitle}
        onChecklistDraftChange={setTaskChecklistDraft}
        onAddChecklistItem={addTaskChecklistItem}
        onToggleChecklistItem={toggleTaskChecklistItem}
        onDeleteChecklistItem={deleteTaskChecklistItem}
        onStartChecklistEdit={(item) => {
          setTaskChecklistEditingId(item.id);
          setTaskChecklistEditingTitle(item.title || '');
        }}
        onChecklistEditingTitleChange={setTaskChecklistEditingTitle}
        onSaveChecklistItem={saveTaskChecklistItem}
        onCancelChecklistEdit={() => {
          setTaskChecklistEditingId('');
          setTaskChecklistEditingTitle('');
        }}
        subtasks={taskSubtasks}
        subtaskDraft={taskSubtaskDraft}
        subtaskEditingId={taskSubtaskEditingId}
        subtaskEditingTitle={taskSubtaskEditingTitle}
        onSubtaskDraftChange={setTaskSubtaskDraft}
        onAddSubtask={addTaskSubtask}
        onMoveSubtask={moveTaskSubtask}
        onDeleteSubtask={deleteTaskSubtask}
        onStartSubtaskEdit={(task) => {
          setTaskSubtaskEditingId(task.id);
          setTaskSubtaskEditingTitle(task.name || '');
        }}
        onSubtaskEditingTitleChange={setTaskSubtaskEditingTitle}
        onSaveSubtask={saveTaskSubtask}
        onCancelSubtaskEdit={() => {
          setTaskSubtaskEditingId('');
          setTaskSubtaskEditingTitle('');
        }}
        threadMessages={taskThreadMessages}
        threadDraft={taskThreadDraft}
        onThreadDraftChange={setTaskThreadDraft}
        onOpenThread={openTaskThread}
        onSendThreadMessage={sendTaskThreadMessage}
        sendingThreadMessage={false}
        onChange={(next) => setDrawer((prev) => ({ ...prev, form: next }))}
        onToggleAdvanced={() => setDrawer((prev) => ({ ...prev, advanced: !prev.advanced }))}
        onClose={closeDrawer}
        onSave={saveTask}
        onDelete={deleteTask}
        onOpenProject={openProjectFromDrawer}
      />
    </div>
  );
}

export default Tasks;
