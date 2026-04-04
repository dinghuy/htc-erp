import { describe, expect, it } from 'vitest';

import {
  buildApprovalQueueNavigation,
  buildErpOrdersNavigation,
  buildProjectListNavigation,
  buildProjectWorkspaceNavigation,
  buildQuotationWorkflowNavigation,
  buildSalesQuotationNavigation,
  buildSupportTicketNavigation,
  buildTasksNavigation,
} from './workflowNavigation';

describe('workflowNavigation', () => {
  it('builds project workspace navigation with optional workspace tab', () => {
    expect(buildProjectWorkspaceNavigation('project-1', 'delivery')).toEqual({
      route: 'Projects',
      navContext: {
        route: 'Projects',
        entityType: 'Project',
        entityId: 'project-1',
        filters: { workspaceTab: 'delivery' },
      },
    });
    expect(buildProjectWorkspaceNavigation('project-1', null)).toEqual({
      route: 'Projects',
      navContext: {
        route: 'Projects',
        entityType: 'Project',
        entityId: 'project-1',
        filters: undefined,
      },
    });
  });

  it('builds quotation and approval queue navigation targets', () => {
    expect(buildQuotationWorkflowNavigation('quotation-1')).toEqual({
      route: 'Quotations',
      navContext: {
        route: 'Quotations',
        entityType: 'Quotation',
        entityId: 'quotation-1',
      },
    });
    expect(buildApprovalQueueNavigation('legal')).toEqual({
      route: 'Approvals',
      navContext: {
        route: 'Approvals',
        filters: { approvalLane: 'legal' },
      },
    });
    expect(buildSalesQuotationNavigation('quotation-2')).toEqual({
      route: 'Sales',
      navContext: {
        route: 'Sales',
        entityType: 'Quotation',
        entityId: 'quotation-2',
        filters: { quotationId: 'quotation-2' },
        autoOpenEdit: true,
      },
    });
  });

  it('builds support ticket navigation defaults', () => {
    expect(buildSupportTicketNavigation()).toEqual({
      label: 'Theo dõi ticket',
      route: 'Support',
      tab: 'Ticket',
    });
  });

  it('builds list/filter navigation targets for projects, tasks, and erp orders', () => {
    expect(buildProjectListNavigation({ workspaceTab: 'finance' })).toEqual({
      route: 'Projects',
      navContext: {
        route: 'Projects',
        filters: { workspaceTab: 'finance' },
        entityType: 'Project',
      },
    });
    expect(buildTasksNavigation({ projectId: 'project-1', status: 'active' }, 'task-1')).toEqual({
      route: 'Tasks',
      navContext: {
        route: 'Tasks',
        filters: { projectId: 'project-1', status: 'active' },
        entityType: 'Task',
        entityId: 'task-1',
      },
    });
    expect(buildErpOrdersNavigation({ projectId: 'project-1' }, 'project-1')).toEqual({
      route: 'ERP Orders',
      navContext: {
        route: 'ERP Orders',
        filters: { projectId: 'project-1' },
        entityType: 'Project',
        entityId: 'project-1',
      },
    });
  });
});
