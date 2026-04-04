import {
  type TaskRecord,
  isBlocked,
  isDueToday,
  isOverdue,
  normalizeTaskStatus,
  sortTasksByUrgency,
} from './taskDomain';

export type TaskGroupBy = 'none' | 'project' | 'assignee' | 'department' | 'taskType' | 'urgency' | 'hierarchy';

export type TaskGroupSection = {
  key: string;
  label: string;
  tasks: Array<TaskRecord & { depth?: number }>;
};

function urgencyLabel(task: TaskRecord) {
  if (isBlocked(task)) return 'Blocked';
  if (isOverdue(task)) return 'Overdue';
  if (isDueToday(task)) return 'Due today';
  if (normalizeTaskStatus(task.status) === 'in_progress') return 'In progress';
  return 'Backlog';
}

export function groupTasks(tasks: TaskRecord[], groupBy: TaskGroupBy): TaskGroupSection[] {
  if (groupBy === 'none') {
    return [{ key: 'all', label: 'All tasks', tasks: sortTasksByUrgency(tasks) }];
  }

  if (groupBy === 'hierarchy') {
    const byParent = new Map<string, TaskRecord[]>();
    const roots: TaskRecord[] = [];
    const taskMap = new Map(tasks.map((task) => [task.id, task]));

    for (const task of tasks) {
      if (task.parentTaskId && taskMap.has(task.parentTaskId)) {
        if (!byParent.has(task.parentTaskId)) byParent.set(task.parentTaskId, []);
        byParent.get(task.parentTaskId)!.push(task);
      } else {
        roots.push(task);
      }
    }

    const visit = (task: TaskRecord, depth: number, rows: Array<TaskRecord & { depth?: number }>) => {
      rows.push({ ...task, depth });
      const children = sortTasksByUrgency(byParent.get(task.id) || []);
      for (const child of children) visit(child, depth + 1, rows);
    };

    return sortTasksByUrgency(roots).map((root) => {
      const rows: Array<TaskRecord & { depth?: number }> = [];
      visit(root, 0, rows);
      return {
        key: `hierarchy:${root.id}`,
        label: root.name,
        tasks: rows,
      };
    });
  }

  const groups = new Map<string, TaskRecord[]>();
  for (const task of tasks) {
    const label = groupBy === 'project'
      ? (task.projectName || 'Chưa gắn project')
      : groupBy === 'assignee'
        ? (task.assigneeName || 'Chưa phân công')
        : groupBy === 'department'
          ? (task.department || 'Chưa có department')
          : groupBy === 'taskType'
            ? (task.taskType || 'Chưa có task type')
            : urgencyLabel(task);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(task);
  }

  return Array.from(groups.entries())
    .map(([label, groupedTasks]) => ({
      key: `${groupBy}:${label}`,
      label,
      tasks: sortTasksByUrgency(groupedTasks),
    }))
    .sort((left, right) => right.tasks.length - left.tasks.length || left.label.localeCompare(right.label));
}
