type NotificationLike = {
  link?: string | null;
  entityType?: string | null;
  entityId?: string | null;
};

export function buildNotificationNavigationTarget(item: NotificationLike) {
  const route = String(item.link || '').trim();
  const entityType = String(item.entityType || '').trim();
  const entityId = String(item.entityId || '').trim();
  if (!route) return null;

  if (route === 'Tasks' && entityType === 'Task' && entityId) {
    return {
      route,
      navContext: {
        route,
        entityType: 'Task' as const,
        entityId,
        autoOpenEdit: true,
        filters: {
          openThread: true,
        },
      },
    };
  }

  if (route === 'Approvals' && entityType === 'ApprovalRequest' && entityId) {
    return {
      route,
      navContext: {
        route,
        filters: {
          approvalId: entityId,
          openThread: true,
        },
      },
    };
  }

  if (route === 'Projects' && entityType === 'ProjectDocument' && entityId) {
    return {
      route,
      navContext: {
        route,
        entityType: 'Project' as const,
        filters: {
          workspaceTab: 'documents',
          documentId: entityId,
          openThread: true,
        },
      },
    };
  }

  if (route === 'Sales' && entityType === 'Quotation' && entityId) {
    return {
      route,
      navContext: {
        route,
        entityType: 'Quotation' as const,
        entityId,
        autoOpenEdit: true,
        filters: {
          quotationId: entityId,
        },
      },
    };
  }

  if (route === 'Accounts' && entityType === 'Account' && entityId) {
    return {
      route,
      navContext: {
        route,
        entityType: 'Account' as const,
        entityId,
        autoOpenEdit: true,
        filters: {
          accountId: entityId,
        },
      },
    };
  }

  if (route === 'Leads' && entityType === 'Lead' && entityId) {
    return {
      route,
      navContext: {
        route,
        entityType: 'Lead' as const,
        entityId,
        autoOpenEdit: true,
        filters: {
          leadId: entityId,
        },
      },
    };
  }

  return {
    route,
    navContext: {
      route,
    },
  };
}
