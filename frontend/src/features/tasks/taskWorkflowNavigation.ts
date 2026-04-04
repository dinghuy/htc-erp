import type { TaskRecord } from './taskDomain';
import {
  buildProjectWorkspaceNavigation,
  buildQuotationWorkflowNavigation,
  type WorkflowNavigationTarget,
} from '../../shared/workflow/workflowNavigation';

export function buildTaskWorkflowNavigation(task: TaskRecord): WorkflowNavigationTarget | null {
  const workspaceTab = String(task.actionAvailability?.workspaceTab || '').trim();
  if (task.actionAvailability?.canOpenProject && task.projectId) {
    return buildProjectWorkspaceNavigation(task.projectId, workspaceTab || null);
  }

  if (task.actionAvailability?.canOpenQuotation && task.quotationId) {
    return buildQuotationWorkflowNavigation(task.quotationId);
  }

  return null;
}
