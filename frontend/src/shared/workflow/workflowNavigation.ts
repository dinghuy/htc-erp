export type WorkflowRoute = 'Projects' | 'Quotations' | 'Approvals' | 'Support' | 'Sales' | 'Tasks' | 'ERP Orders';

export type WorkflowNavigationTarget = {
  route: WorkflowRoute;
  navContext: {
    route: WorkflowRoute;
    entityType?: 'Project' | 'Quotation' | 'Task';
    entityId?: string;
    filters?: Record<string, string>;
  };
};

export function buildProjectWorkspaceNavigation(projectId?: string | null, workspaceTab?: string | null): WorkflowNavigationTarget | null {
  if (!projectId) return null;
  return {
    route: 'Projects',
    navContext: {
      route: 'Projects',
      entityType: 'Project',
      entityId: projectId,
      filters: workspaceTab ? { workspaceTab } : undefined,
    },
  };
}

export function buildProjectListNavigation(filters?: Record<string, unknown>): WorkflowNavigationTarget {
  return {
    route: 'Projects',
    navContext: {
      route: 'Projects',
      filters: filters as Record<string, string> | undefined,
      entityType: 'Project',
    },
  };
}

export function buildQuotationWorkflowNavigation(quotationId?: string | null): WorkflowNavigationTarget | null {
  if (!quotationId) return null;
  return {
    route: 'Quotations',
    navContext: {
      route: 'Quotations',
      entityType: 'Quotation',
      entityId: quotationId,
    },
  };
}

export function buildSalesQuotationNavigation(quotationId?: string | null): WorkflowNavigationTarget | null {
  if (!quotationId) return null;
  return {
    route: 'Sales',
    navContext: {
      route: 'Sales',
      entityType: 'Quotation',
      entityId: quotationId,
      filters: { quotationId },
      autoOpenEdit: true,
    } as WorkflowNavigationTarget['navContext'] & { autoOpenEdit: true },
  };
}

export function buildApprovalQueueNavigation(approvalLane?: string | null): WorkflowNavigationTarget {
  return {
    route: 'Approvals',
    navContext: {
      route: 'Approvals',
      filters: approvalLane ? { approvalLane } : undefined,
    },
  };
}

export function buildTasksNavigation(filters?: Record<string, unknown>, entityId?: string, entityType: 'Task' | 'Project' = 'Task'): WorkflowNavigationTarget {
  return {
    route: 'Tasks',
    navContext: {
      route: 'Tasks',
      filters: filters as Record<string, string> | undefined,
      entityType,
      entityId,
    },
  };
}

export function buildErpOrdersNavigation(filters?: Record<string, unknown>, entityId?: string): WorkflowNavigationTarget {
  return {
    route: 'ERP Orders',
    navContext: {
      route: 'ERP Orders',
      filters: filters as Record<string, string> | undefined,
      entityType: 'Project',
      entityId,
    },
  };
}

export function buildSupportTicketNavigation(tab: 'Ticket' = 'Ticket'): {
  label: string;
  route: 'Support';
  tab: 'Ticket';
} {
  return {
    label: 'Theo dõi ticket',
    route: 'Support',
    tab,
  };
}
