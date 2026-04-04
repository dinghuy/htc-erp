import { describe, expect, it } from 'vitest';

import {
  APPROVAL_PERMISSION_MAP,
  buildRoleProfile,
  canAccessModule,
  canApproveRequest,
  canPerformAction,
  getProjectWorkspaceTabsForRoles,
  normalizeRoleCodes,
  ROLE_ACTION_PERMISSIONS,
  ROLE_MODULE_ACCESS,
  ROLE_WORKSPACE_TABS,
} from './contracts';

describe('role access composition', () => {
  it('normalizes and deduplicates multi-role assignments', () => {
    expect(normalizeRoleCodes(['sales', 'project_manager', 'sales'])).toEqual(['sales', 'project_manager']);
    expect(normalizeRoleCodes([], 'manager')).toEqual(['project_manager']);
  });

  it('lets PM inherit the combined commercial + execution surface', () => {
    const profile = buildRoleProfile(['sales', 'project_manager']);

    expect(profile.personaMode).toBe('project_manager');
    expect(profile.primaryRole).toBe('project_manager');
    expect(profile.allowedModules).toContain('Home');
    expect(profile.allowedModules).toContain('My Work');
    expect(profile.allowedModules).toContain('Inbox');
    expect(profile.allowedModules).toContain('Approvals');
    expect(canAccessModule(profile, 'Projects')).toBe(true);
    expect(canAccessModule(profile, 'Sales')).toBe(true);
    expect(canAccessModule(profile, 'Ops Overview')).toBe(true);
    expect(canAccessModule(profile, 'Users')).toBe(false);
  });

  it('exposes finance, legal and procurement tabs only to matching roles', () => {
    expect(getProjectWorkspaceTabsForRoles(['sales', 'project_manager']).map((tab) => tab.key)).toEqual([
      'overview',
      'commercial',
      'procurement',
      'delivery',
      'tasks',
      'timeline',
      'documents',
    ]);

    expect(getProjectWorkspaceTabsForRoles(['accounting']).map((tab) => tab.key)).toContain('finance');
    expect(getProjectWorkspaceTabsForRoles(['legal']).map((tab) => tab.key)).toContain('legal');
    expect(getProjectWorkspaceTabsForRoles(['director']).map((tab) => tab.key)).toContain('legal');
  });

  it('publishes explicit module, tab and action permission maps', () => {
    expect(ROLE_MODULE_ACCESS.admin).toContain('Users');
    expect(ROLE_MODULE_ACCESS.sales).toContain('Leads');
    expect(ROLE_MODULE_ACCESS.project_manager).toContain('Ops Overview');
    expect(ROLE_MODULE_ACCESS.project_manager).not.toContain('Pricing');
    expect(ROLE_MODULE_ACCESS.sales).not.toContain('Users');
    expect(ROLE_MODULE_ACCESS.sales).not.toContain('Support');
    expect(ROLE_MODULE_ACCESS.project_manager).not.toContain('Leads');
    expect(ROLE_MODULE_ACCESS.director).not.toContain('Users');
    expect(ROLE_MODULE_ACCESS.viewer).toContain('Support');
    expect(ROLE_WORKSPACE_TABS.accounting).toContain('finance');
    expect(ROLE_WORKSPACE_TABS.legal).toContain('legal');
    expect(ROLE_ACTION_PERMISSIONS.admin).toContain('manage_settings');
    expect(ROLE_ACTION_PERMISSIONS.sales).toContain('edit_commercial');
    expect(ROLE_ACTION_PERMISSIONS.project_manager).toContain('edit_execution');
    expect(ROLE_ACTION_PERMISSIONS.project_manager).toContain('edit_commercial');
    expect(ROLE_ACTION_PERMISSIONS.procurement).toContain('edit_procurement');
  });

  it('keeps finance as the only cost-management tab with the new label', () => {
    const accountingTabs = getProjectWorkspaceTabsForRoles(['accounting']);
    expect(accountingTabs.find((tab) => tab.key === 'finance')).toMatchObject({ label: 'Quản lý chi phí' });
    expect(accountingTabs.map((tab) => tab.key)).not.toContain('pricing');
  });

  it('keeps admin system-only for business approvals by default', () => {
    expect(APPROVAL_PERMISSION_MAP.finance).toContain('accounting');
    expect(APPROVAL_PERMISSION_MAP.finance).not.toContain('admin');
    expect(APPROVAL_PERMISSION_MAP.legal).toContain('legal');
    expect(APPROVAL_PERMISSION_MAP.executive).toContain('director');
    expect(canPerformAction(['admin'], 'approve_finance')).toBe(false);
    expect(canPerformAction(['admin'], 'approve_legal')).toBe(false);
    expect(canPerformAction(['admin'], 'approve_executive')).toBe(false);
    expect(buildRoleProfile(['admin']).personaMode).toBe('admin');
  });

  it('grants business approvals only to matching roles', () => {
    const financeApproval = {
      id: 'fin-1',
      requestType: 'payment-milestone',
      department: 'Finance',
      approverRole: 'accounting',
      status: 'pending',
    };
    const legalApproval = {
      id: 'legal-1',
      requestType: 'contract-review',
      department: 'Legal',
      approverRole: 'legal',
      status: 'pending',
    };
    const executiveApproval = {
      id: 'exec-1',
      requestType: 'margin-exception',
      department: 'BOD',
      approverRole: 'director',
      status: 'pending',
    };
    const procurementApproval = {
      id: 'proc-1',
      requestType: 'po-approval',
      department: 'Procurement',
      approverRole: 'procurement',
      status: 'pending',
    };

    expect(canApproveRequest(['admin'], financeApproval)).toBe(false);
    expect(canApproveRequest(['accounting'], financeApproval)).toBe(true);
    expect(canApproveRequest(['legal'], financeApproval)).toBe(false);

    expect(canApproveRequest(['legal'], legalApproval)).toBe(true);
    expect(canApproveRequest(['director'], legalApproval)).toBe(false);

    expect(canApproveRequest(['director'], executiveApproval)).toBe(true);
    expect(canApproveRequest(['sales'], executiveApproval)).toBe(false);

    expect(canApproveRequest(['procurement'], procurementApproval)).toBe(true);
    expect(canApproveRequest(['project_manager'], procurementApproval)).toBe(false);
  });

  it('keeps handoff-bridging mixed roles inside the commercial lane only', () => {
    const commercialApproval = {
      id: 'comm-1',
      requestType: 'quotation_commercial',
      department: 'Sales',
      approverRole: 'sales',
      status: 'pending',
    };
    const financeApproval = {
      id: 'fin-3',
      requestType: 'payment-milestone',
      department: 'Finance',
      approverRole: 'accounting',
      status: 'pending',
    };
    const legalApproval = {
      id: 'leg-3',
      requestType: 'contract-review',
      department: 'Legal',
      approverRole: 'legal',
      status: 'pending',
    };

    expect(canApproveRequest(['sales', 'project_manager'], commercialApproval)).toBe(true);
    expect(canApproveRequest(['sales', 'project_manager'], financeApproval)).toBe(false);
    expect(canApproveRequest(['sales', 'project_manager'], legalApproval)).toBe(false);
  });

  it('blocks self-approval and mismatched assignee in the frontend gate helper', () => {
    const financeApproval = {
      id: 'fin-2',
      requestType: 'payment-milestone',
      department: 'Finance',
      approverRole: 'accounting',
      approverUserId: 'user-accounting',
      requestedBy: 'user-requester',
      status: 'pending',
    };

    expect(canApproveRequest(['accounting'], financeApproval, undefined, 'user-accounting')).toBe(true);
    expect(canApproveRequest(['accounting'], financeApproval, undefined, 'user-requester')).toBe(false);
    expect(canApproveRequest(['accounting'], financeApproval, undefined, 'another-user')).toBe(false);
    expect(canApproveRequest(['accounting'], { ...financeApproval, status: 'approved' }, undefined, 'user-accounting')).toBe(false);
  });
});
