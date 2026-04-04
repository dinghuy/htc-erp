import {
  type TaskRecord,
  isBlocked,
  isDueToday,
  isOverdue,
  normalizeTaskStatus,
} from './taskDomain';
import type { TaskViewSnapshot } from './taskViewPresets';

export type TaskQuickView = {
  id: string;
  label: string;
  count: number;
  snapshot: TaskViewSnapshot;
};

export function buildTaskQuickViews(tasks: TaskRecord[], currentUserId?: string | null): TaskQuickView[] {
  const views: TaskQuickView[] = [
    {
      id: 'blocked',
      label: 'Blocked',
      count: tasks.filter((task) => isBlocked(task)).length,
      snapshot: {
        search: '',
        selectedProjectId: '__all__',
        selectedAssigneeId: '',
        selectedPriority: '',
        selectedStatus: '',
        onlyOverdue: false,
        groupBy: 'none',
        surface: 'kanban',
      },
    },
    {
      id: 'due-today',
      label: 'Due today',
      count: tasks.filter((task) => isDueToday(task)).length,
      snapshot: {
        search: '',
        selectedProjectId: '__all__',
        selectedAssigneeId: '',
        selectedPriority: '',
        selectedStatus: '',
        onlyOverdue: false,
        groupBy: 'none',
        surface: 'list',
      },
    },
    {
      id: 'overdue',
      label: 'Overdue',
      count: tasks.filter((task) => isOverdue(task)).length,
      snapshot: {
        search: '',
        selectedProjectId: '__all__',
        selectedAssigneeId: '',
        selectedPriority: '',
        selectedStatus: '',
        onlyOverdue: true,
        groupBy: 'none',
        surface: 'list',
      },
    },
    {
      id: 'in-progress',
      label: 'In progress',
      count: tasks.filter((task) => normalizeTaskStatus(task.status) === 'in_progress').length,
      snapshot: {
        search: '',
        selectedProjectId: '__all__',
        selectedAssigneeId: '',
        selectedPriority: '',
        selectedStatus: 'in_progress',
        onlyOverdue: false,
        groupBy: 'none',
        surface: 'kanban',
      },
    },
  ];

  if (currentUserId) {
    views.unshift({
      id: 'assigned-to-me',
      label: 'Assigned to me',
      count: tasks.filter((task) => task.assigneeId === currentUserId).length,
      snapshot: {
        search: '',
        selectedProjectId: '__all__',
        selectedAssigneeId: currentUserId,
        selectedPriority: '',
        selectedStatus: '',
        onlyOverdue: false,
        groupBy: 'none',
        surface: 'kanban',
      },
    });
  }

  return views;
}
