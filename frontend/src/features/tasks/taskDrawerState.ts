import { ALL_PROJECT, buildTaskForm, type DrawerMode, type TaskFormState, type TaskRecord } from './taskDomain';

export type TaskDrawerState = {
  open: boolean;
  mode: DrawerMode;
  editingTask: TaskRecord | null;
  form: TaskFormState;
  advanced: boolean;
  saving: boolean;
};

export function createClosedDrawerState(currentUser?: any, selectedProjectId: string = ALL_PROJECT): TaskDrawerState {
  return {
    open: false,
    mode: 'create',
    editingTask: null,
    form: buildTaskForm(null, currentUser, selectedProjectId),
    advanced: false,
    saving: false,
  };
}

export function createOpenDrawerState(
  task: TaskRecord | null,
  currentUser?: any,
  selectedProjectId: string = ALL_PROJECT
): TaskDrawerState {
  return {
    open: true,
    mode: task ? 'edit' : 'create',
    editingTask: task || null,
    form: buildTaskForm(task || null, currentUser, selectedProjectId),
    advanced: false,
    saving: false,
  };
}

export function closeDrawerState(
  currentUser?: any,
  selectedProjectId: string = ALL_PROJECT
): TaskDrawerState {
  return createClosedDrawerState(currentUser, selectedProjectId);
}

