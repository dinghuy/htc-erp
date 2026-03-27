import { canPerformAction } from '../../shared/domain/contracts';

export type TaskAccess = {
  canCreateTask: boolean;
  canEditTask: boolean;
  canDeleteTask: boolean;
  canUpdateTaskStatus: boolean;
};

export function buildTaskAccess(roleCodes: unknown, legacyRole?: unknown): TaskAccess {
  const canEditExecution = canPerformAction(roleCodes, 'edit_execution', legacyRole);

  return {
    canCreateTask: canEditExecution,
    canEditTask: canEditExecution,
    canDeleteTask: canEditExecution,
    canUpdateTaskStatus: canEditExecution,
  };
}
