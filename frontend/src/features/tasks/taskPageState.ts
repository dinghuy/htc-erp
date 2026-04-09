import { ALL_PROJECT, type TaskRecord } from './taskDomain';
import { closeDrawerState, createOpenDrawerState, type TaskDrawerState } from './taskDrawerState';
import type { TaskGroupBy } from './taskGrouping';
import type { TaskViewSnapshot } from './taskViewPresets';

export function openTaskDrawer(
  task: TaskRecord | null | undefined,
  currentUser: any,
  selectedProjectId: string,
  setDrawer: (value: TaskDrawerState) => void,
) {
  setDrawer(createOpenDrawerState(task || null, currentUser, selectedProjectId));
}

export function closeTaskDrawer(
  currentUser: any,
  selectedProjectId: string,
  setDrawer: (value: TaskDrawerState) => void,
  resets: {
    setTaskWorkHubSummary: (value: any) => void;
    setTaskThreadMessages: (value: any[]) => void;
    setTaskThreadDraft: (value: string) => void;
    setTaskChecklistItems: (value: any[]) => void;
    setTaskChecklistDraft: (value: string) => void;
    setTaskChecklistEditingId: (value: string) => void;
    setTaskChecklistEditingTitle: (value: string) => void;
    setTaskSubtasks: (value: TaskRecord[]) => void;
    setTaskSubtaskDraft: (value: string) => void;
    setTaskSubtaskEditingId: (value: string) => void;
    setTaskSubtaskEditingTitle: (value: string) => void;
    setPendingOpenTaskThread: (value: boolean) => void;
    setSelectedTaskIds: (value: string[]) => void;
    setDraggingTaskId: (value: string) => void;
    setHoveredStatus: (value: any) => void;
  },
) {
  setDrawer(closeDrawerState(currentUser, selectedProjectId));
  resets.setTaskWorkHubSummary(null);
  resets.setTaskThreadMessages([]);
  resets.setTaskThreadDraft('');
  resets.setTaskChecklistItems([]);
  resets.setTaskChecklistDraft('');
  resets.setTaskChecklistEditingId('');
  resets.setTaskChecklistEditingTitle('');
  resets.setTaskSubtasks([]);
  resets.setTaskSubtaskDraft('');
  resets.setTaskSubtaskEditingId('');
  resets.setTaskSubtaskEditingTitle('');
  resets.setPendingOpenTaskThread(false);
  resets.setSelectedTaskIds([]);
  resets.setDraggingTaskId('');
  resets.setHoveredStatus('');
}

export function applyTaskViewSnapshot(
  snapshot: TaskViewSnapshot,
  setters: {
    setSearch: (value: string) => void;
    setSelectedProjectId: (value: string) => void;
    setSelectedAssigneeId: (value: string) => void;
    setSelectedPriority: (value: string) => void;
    setSelectedStatus: (value: string) => void;
    setOnlyOverdue: (value: boolean) => void;
    setGroupBy: (value: TaskGroupBy) => void;
    setSurface: (value: any) => void;
  },
) {
  setters.setSearch(snapshot.search);
  setters.setSelectedProjectId(snapshot.selectedProjectId);
  setters.setSelectedAssigneeId(snapshot.selectedAssigneeId);
  setters.setSelectedPriority(snapshot.selectedPriority);
  setters.setSelectedStatus(snapshot.selectedStatus);
  setters.setOnlyOverdue(snapshot.onlyOverdue);
  setters.setGroupBy((snapshot.groupBy as TaskGroupBy) || 'none');
  setters.setSurface(snapshot.surface);
}

export function buildCurrentTaskViewSnapshot(input: {
  search: string;
  selectedProjectId: string;
  selectedAssigneeId: string;
  selectedPriority: string;
  selectedStatus: string;
  onlyOverdue: boolean;
  groupBy: TaskGroupBy;
  surface: any;
}): TaskViewSnapshot {
  return {
    search: input.search,
    selectedProjectId: input.selectedProjectId,
    selectedAssigneeId: input.selectedAssigneeId,
    selectedPriority: input.selectedPriority,
    selectedStatus: input.selectedStatus,
    onlyOverdue: input.onlyOverdue,
    groupBy: input.groupBy,
    surface: input.surface,
  };
}

export function resetTaskFilters(setters: {
  setSearch: (value: string) => void;
  setSelectedProjectId: (value: string) => void;
  setSelectedAssigneeId: (value: string) => void;
  setSelectedPriority: (value: string) => void;
  setSelectedStatus: (value: string) => void;
  setOnlyOverdue: (value: boolean) => void;
  setGroupBy: (value: TaskGroupBy) => void;
  setSurface: (value: any) => void;
  setContextActive: (value: boolean) => void;
  setTaskViewIsDefault: (value: boolean) => void;
}) {
  setters.setSearch('');
  setters.setSelectedProjectId(ALL_PROJECT);
  setters.setSelectedAssigneeId('');
  setters.setSelectedPriority('');
  setters.setSelectedStatus('');
  setters.setOnlyOverdue(false);
  setters.setGroupBy('none');
  setters.setSurface('kanban');
  setters.setContextActive(false);
  setters.setTaskViewIsDefault(false);
}
