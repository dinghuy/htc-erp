import { API_BASE } from './config';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { showNotify } from './Notification';
import { fetchWithAuth } from './auth';
import { consumeNavContext, setNavContext } from './navContext';
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
  sortTasksByUrgency,
  type SurfaceKey,
  type TaskRecord,
  type UiTaskStatus,
} from './features/tasks/taskDomain';
import {
  collectTaskViewPresets, getDefaultTaskViewPreset, matchesTaskViewPreset, snapshotFromTaskViewPreset, type TaskViewPresetRecord, type TaskViewSnapshot,
} from './features/tasks/taskViewPresets';
import { buildTaskQuickViews } from './features/tasks/taskQuickViews';
import { type TaskGroupBy } from './features/tasks/taskGrouping';
import { loadTaskWorkspaceData } from './features/tasks/taskData';
import {
  createClosedDrawerState,
  type TaskDrawerState,
} from './features/tasks/taskDrawerState';
import { buildTaskWorkHubSummary } from './features/tasks/taskWorkHubData';
import { buildTaskAccess } from './features/tasks/taskPermissions';
import {
  applyTaskViewSnapshot,
  buildCurrentTaskViewSnapshot,
  closeTaskDrawer,
  openTaskDrawer,
  resetTaskFilters,
} from './features/tasks/taskPageState';
import { createTaskViewActions } from './features/tasks/taskViewActions';
import { buildTaskWorkflowNavigation } from './features/tasks/taskWorkflowNavigation';
import { TasksWorkspaceShell } from './features/tasks/TasksWorkspaceShell';
import { requestJsonWithAuth } from './shared/api/client';

const API = API_BASE;

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
  const [deletingTaskViewId, setDeletingTaskViewId] = useState('');
  const [defaultPresetApplied, setDefaultPresetApplied] = useState(false);

  const [drawer, setDrawer] = useState<TaskDrawerState>(() => createClosedDrawerState(currentUser, ALL_PROJECT));
  const [confirmState, setConfirmState] = useState<{ message: string; onConfirm: () => void } | null>(null);

  const [draggingTaskId, setDraggingTaskId] = useState('');
  const [hoveredStatus, setHoveredStatus] = useState<UiTaskStatus | ''>('');
  const [updatingTaskId, setUpdatingTaskId] = useState('');
  const [taskWorkHubSummary, setTaskWorkHubSummary] = useState<any | null>(null);
  const [taskThreadMessages, setTaskThreadMessages] = useState<any[]>([]);
  const [taskThreadDraft, setTaskThreadDraft] = useState('');
  const [taskChecklistItems, setTaskChecklistItems] = useState<any[]>([]);
  const [taskChecklistDraft, setTaskChecklistDraft] = useState('');
  const [taskChecklistEditingId, setTaskChecklistEditingId] = useState('');
  const [taskChecklistEditingTitle, setTaskChecklistEditingTitle] = useState('');
  const [taskSubtasks, setTaskSubtasks] = useState<TaskRecord[]>([]);
  const [taskSubtaskDraft, setTaskSubtaskDraft] = useState('');
  const [taskSubtaskEditingId, setTaskSubtaskEditingId] = useState('');
  const [taskSubtaskEditingTitle, setTaskSubtaskEditingTitle] = useState('');
  const [pendingOpenTaskThread, setPendingOpenTaskThread] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkPriority, setBulkPriority] = useState('');
  const [bulkAssigneeId, setBulkAssigneeId] = useState('');
  const [bulkUpdating, setBulkUpdating] = useState(false);

  const openDrawer = (task?: TaskRecord | null) => {
    openTaskDrawer(task || null, currentUser, selectedProjectId, setDrawer);
  };

  const closeDrawer = () => {
    closeTaskDrawer(currentUser, selectedProjectId, setDrawer, {
      setTaskWorkHubSummary,
      setTaskThreadMessages,
      setTaskThreadDraft,
      setTaskChecklistItems,
      setTaskChecklistDraft,
      setTaskChecklistEditingId,
      setTaskChecklistEditingTitle,
      setTaskSubtasks,
      setTaskSubtaskDraft,
      setTaskSubtaskEditingId,
      setTaskSubtaskEditingTitle,
      setPendingOpenTaskThread,
      setSelectedTaskIds,
      setDraggingTaskId,
      setHoveredStatus,
    });
  };

  const currentTaskViewSnapshot = useMemo<TaskViewSnapshot>(
    () => buildCurrentTaskViewSnapshot({ search, selectedProjectId, selectedAssigneeId, selectedPriority, selectedStatus, onlyOverdue, groupBy, surface }),
    [search, selectedProjectId, selectedAssigneeId, selectedPriority, selectedStatus, onlyOverdue, groupBy, surface]
  );

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
    applyTaskViewSnapshot(snapshotFromTaskViewPreset(defaultPreset), {
      setSearch,
      setSelectedProjectId,
      setSelectedAssigneeId,
      setSelectedPriority,
      setSelectedStatus,
      setOnlyOverdue,
      setGroupBy,
      setSurface,
    });
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
        if (selectedProjectId !== ALL_PROJECT && task.projectId !== selectedProjectId) return false;
        if (selectedAssigneeId && task.assigneeId !== selectedAssigneeId) return false;
        if (selectedPriority && normalizePriority(task.priority) !== selectedPriority) return false;
        if (selectedStatus && normalizeTaskStatus(task.status) !== selectedStatus) return false;
        if (onlyOverdue && !isOverdue(task)) return false;
        return matchesTaskSearch(task, search);
      })
    );
  }, [tasks, selectedProjectId, selectedAssigneeId, selectedPriority, selectedStatus, onlyOverdue, search]);

  const toggleSelectedTask = (taskId: string, checked: boolean) => {
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
    resetTaskFilters({
      setSearch,
      setSelectedProjectId,
      setSelectedAssigneeId,
      setSelectedPriority,
      setSelectedStatus,
      setOnlyOverdue,
      setGroupBy,
      setSurface,
      setContextActive,
      setTaskViewIsDefault,
    });
  };

  const taskViewSetters = { setSearch, setSelectedProjectId, setSelectedAssigneeId, setSelectedPriority, setSelectedStatus, setOnlyOverdue, setGroupBy, setSurface };

  const {
    saveCurrentTaskView,
    updateActiveTaskView,
    deleteTaskViewPreset,
    applyTaskViewPreset,
    applyQuickView,
  } = createTaskViewActions({
    token,
    api: API,
    currentTaskViewSnapshot,
    taskViewName,
    taskViewIsDefault,
    taskViewPresets,
    activeTaskViewPresetId,
    setSavingTaskView,
    setTaskViewPresets,
    setTaskViewName,
    setTaskViewIsDefault,
    setDefaultPresetApplied,
    setDeletingTaskViewId,
    setContextActive,
    taskViewSetters,
  });

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
      const updatedById = new Map<string, TaskRecord>(updatedItems.map((item) => [item.id, item]));
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

  const moveProjectTask = async (taskId: string, direction: 'up' | 'down') => {
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
      const updatedById = new Map<string, TaskRecord>(updatedItems.map((item) => [item.id, item]));
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

  const updateTaskStatus = async (taskId: string, nextStatus: UiTaskStatus) => {
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

  const refreshTaskChecklist = async (taskId: string) => {
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

  const deleteTaskChecklistItem = async (itemId: string) => {
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

  const refreshTaskSubtasks = async (taskId: string) => {
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

  const moveTaskSubtask = async (taskId: string, direction: 'up' | 'down') => {
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

  const deleteTaskSubtask = async (taskId: string) => {
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
    <TasksWorkspaceShell
      isMobile={isMobile}
      confirmState={confirmState}
      setConfirmState={setConfirmState}
      userCanEdit={userCanEdit}
      openDrawer={openDrawer}
      contextActive={contextActive}
      resetFilters={resetFilters}
      selectedProjectName={selectedProjectName}
      activeFilterCount={activeFilterCount}
      search={search}
      setSearch={setSearch}
      selectedProjectId={selectedProjectId}
      setSelectedProjectId={setSelectedProjectId}
      projects={projects}
      selectedAssigneeId={selectedAssigneeId}
      setSelectedAssigneeId={setSelectedAssigneeId}
      users={users}
      selectedPriority={selectedPriority}
      setSelectedPriority={setSelectedPriority}
      selectedStatus={selectedStatus}
      setSelectedStatus={setSelectedStatus}
      groupBy={groupBy}
      setGroupBy={setGroupBy}
      onlyOverdue={onlyOverdue}
      setOnlyOverdue={setOnlyOverdue}
      taskViewName={taskViewName}
      setTaskViewName={setTaskViewName}
      taskViewIsDefault={taskViewIsDefault}
      setTaskViewIsDefault={setTaskViewIsDefault}
      saveCurrentTaskView={saveCurrentTaskView}
      savingTaskView={savingTaskView}
      activeTaskViewPresetId={activeTaskViewPresetId}
      updateActiveTaskView={updateActiveTaskView}
      taskQuickViews={taskQuickViews}
      currentTaskViewSnapshot={currentTaskViewSnapshot}
      applyQuickView={applyQuickView}
      taskViewPresets={taskViewPresets}
      applyTaskViewPreset={applyTaskViewPreset}
      deleteTaskViewPreset={deleteTaskViewPreset}
      deletingTaskViewId={deletingTaskViewId}
      loadError={loadError}
      userLoadWarning={userLoadWarning}
      taskViewWarning={taskViewWarning}
      loading={loading}
      metrics={metrics}
      filteredTasks={filteredTasks}
      surface={surface}
      setSurface={setSurface}
      bulkStatus={bulkStatus}
      setBulkStatus={setBulkStatus}
      bulkPriority={bulkPriority}
      setBulkPriority={setBulkPriority}
      bulkAssigneeId={bulkAssigneeId}
      setBulkAssigneeId={setBulkAssigneeId}
      selectedTaskIds={selectedTaskIds}
      applyBulkTaskAction={applyBulkTaskAction}
      bulkUpdating={bulkUpdating}
      draggingTaskId={draggingTaskId}
      setDraggingTaskId={setDraggingTaskId}
      hoveredStatus={hoveredStatus}
      setHoveredStatus={setHoveredStatus}
      updatingTaskId={updatingTaskId}
      updateTaskStatus={updateTaskStatus}
      toggleSelectedTask={toggleSelectedTask}
      openWorkflowFromTask={openWorkflowFromTask}
      toggleAllVisibleTasks={toggleAllVisibleTasks}
      moveProjectTask={moveProjectTask}
      drawer={drawer}
      userCanDelete={userCanDelete}
      accounts={accounts}
      leads={leads}
      quotations={quotations}
      taskWorkHubSummary={taskWorkHubSummary}
      taskChecklistItems={taskChecklistItems}
      taskChecklistDraft={taskChecklistDraft}
      taskChecklistEditingId={taskChecklistEditingId}
      taskChecklistEditingTitle={taskChecklistEditingTitle}
      setTaskChecklistDraft={setTaskChecklistDraft}
      addTaskChecklistItem={addTaskChecklistItem}
      toggleTaskChecklistItem={toggleTaskChecklistItem}
      deleteTaskChecklistItem={deleteTaskChecklistItem}
      setTaskChecklistEditingId={setTaskChecklistEditingId}
      setTaskChecklistEditingTitle={setTaskChecklistEditingTitle}
      saveTaskChecklistItem={saveTaskChecklistItem}
      taskSubtasks={taskSubtasks}
      taskSubtaskDraft={taskSubtaskDraft}
      taskSubtaskEditingId={taskSubtaskEditingId}
      taskSubtaskEditingTitle={taskSubtaskEditingTitle}
      setTaskSubtaskDraft={setTaskSubtaskDraft}
      setTaskSubtaskEditingId={setTaskSubtaskEditingId}
      setTaskSubtaskEditingTitle={setTaskSubtaskEditingTitle}
      addTaskSubtask={addTaskSubtask}
      moveTaskSubtask={moveTaskSubtask}
      deleteTaskSubtask={deleteTaskSubtask}
      saveTaskSubtask={saveTaskSubtask}
      taskThreadMessages={taskThreadMessages}
      taskThreadDraft={taskThreadDraft}
      setTaskThreadDraft={setTaskThreadDraft}
      openTaskThread={openTaskThread}
      sendTaskThreadMessage={sendTaskThreadMessage}
      setDrawer={setDrawer}
      closeDrawer={closeDrawer}
      saveTask={saveTask}
      deleteTask={deleteTask}
      openProjectFromDrawer={openProjectFromDrawer}
    />

  );
}
export default Tasks;
