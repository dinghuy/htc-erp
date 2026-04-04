type InboxItemLike = {
  entityType?: string | null;
  entityId?: string | null;
  projectId?: string | null;
  actionAvailability?: {
    workspaceTab?: string | null;
  } | null;
};
import { buildProjectWorkspaceNavigation } from '../shared/workflow/workflowNavigation';

export function buildInboxProjectWorkspaceNavigation(item: InboxItemLike) {
  const target = buildProjectWorkspaceNavigation(item.projectId, item.actionAvailability?.workspaceTab || null);
  if (!target) return null;
  if (item.entityType === 'ProjectDocument' && item.entityId) {
    return {
      ...target,
      navContext: {
        ...target.navContext,
        filters: {
          ...(target.navContext.filters || {}),
          documentId: item.entityId,
          openThread: true,
        },
      },
    };
  }
  return target;
}
