import {
  buildApprovalQueueNavigation,
  buildProjectWorkspaceNavigation,
} from '../shared/workflow/workflowNavigation';

export function buildMyWorkProjectWorkspaceNavigation(projectId?: string | null, workspaceTab?: string | null) {
  return buildProjectWorkspaceNavigation(projectId, workspaceTab);
}

export function buildMyWorkApprovalQueueNavigation(approvalLane?: string | null, approvalId?: string | null, openThread = false) {
  const target = buildApprovalQueueNavigation(approvalLane);
  if (!approvalId) return target;
  return {
    ...target,
    navContext: {
      ...target.navContext,
      filters: {
        ...(target.navContext.filters || {}),
        approvalId,
        openThread,
      },
    },
  };
}
