import { describe, expect, it } from 'vitest';

import { applyRolePreviewToUser, getRolePreviewPresetNavigation, getRolePreviewWorkspaceNavigation, isRolePreviewPresetActive, ROLE_PREVIEW_PRESETS } from './authRolePreview';

describe('authRolePreview', () => {
  it('applies admin preview as effective role while preserving base admin identity', () => {
    const user = applyRolePreviewToUser({
      id: 'u-1',
      username: 'admin',
      fullName: 'Admin',
      email: 'admin@example.com',
      token: 'token',
      systemRole: 'admin',
      roleCodes: ['admin'],
      previewRoleCodes: ['sales', 'project_manager'],
    });

    expect(user.baseSystemRole).toBe('admin');
    expect(user.baseRoleCodes).toEqual(['admin']);
    expect(user.systemRole).toBe('sales');
    expect(user.roleCodes).toEqual(['sales', 'project_manager']);
    expect(user.isRolePreviewActive).toBe(true);
  });

  it('falls back to the base session when preview is missing or invalid', () => {
    const user = applyRolePreviewToUser({
      id: 'u-2',
      username: 'finance',
      fullName: 'Finance',
      email: 'finance@example.com',
      token: 'token',
      systemRole: 'accounting',
      roleCodes: ['accounting'],
      previewRoleCodes: ['admin'],
    });

    expect(user.baseSystemRole).toBe('accounting');
    expect(user.baseRoleCodes).toEqual(['accounting']);
    expect(user.systemRole).toBe('accounting');
    expect(user.roleCodes).toEqual(['accounting']);
    expect(user.isRolePreviewActive).toBe(false);
  });

  it('publishes stable one-click presets and can detect the active preset', () => {
    expect(ROLE_PREVIEW_PRESETS.find((preset) => preset.key === 'project_manager')?.roleCodes).toEqual(['project_manager']);
    expect(ROLE_PREVIEW_PRESETS.find((preset) => preset.key === 'viewer')?.roleCodes).toEqual(['viewer']);
    expect(ROLE_PREVIEW_PRESETS.find((preset) => preset.key === 'admin')).toBeUndefined();
    expect(isRolePreviewPresetActive(['sales', 'project_manager'], ['sales', 'project_manager'])).toBe(true);
    expect(isRolePreviewPresetActive(['viewer'], ['viewer'])).toBe(true);
    expect(isRolePreviewPresetActive(['sales'], ['sales', 'project_manager'])).toBe(false);
    expect(isRolePreviewPresetActive(undefined, undefined)).toBe(false);
  });

  it('routes presets to the primary QA screen for each persona', () => {
    expect(getRolePreviewPresetNavigation('sales')).toMatchObject({ route: 'My Work', navContext: { filters: { workFocus: 'commercial' } } });
    expect(getRolePreviewPresetNavigation('project_manager')).toMatchObject({ route: 'My Work', navContext: { filters: { workFocus: 'execution' } } });
    expect(getRolePreviewPresetNavigation('procurement')).toMatchObject({ route: 'Inbox', navContext: { filters: { department: 'procurement' } } });
    expect(getRolePreviewPresetNavigation('accounting')).toMatchObject({ route: 'Approvals', navContext: { filters: { approvalLane: 'finance' } } });
    expect(getRolePreviewPresetNavigation('legal')).toMatchObject({ route: 'Approvals', navContext: { filters: { approvalLane: 'legal' } } });
    expect(getRolePreviewPresetNavigation('director')).toMatchObject({ route: 'Approvals', navContext: { filters: { approvalLane: 'executive' } } });
    expect(getRolePreviewPresetNavigation('viewer')).toMatchObject({ route: 'Home' });
  });

  it('builds representative project workspace navigation without expanding permissions', () => {
    expect(getRolePreviewWorkspaceNavigation(['sales'])).toMatchObject({ route: 'Projects', navContext: { filters: { projectStage: 'quoting', openRepresentative: true, workspaceTab: 'commercial' } } });
    expect(getRolePreviewWorkspaceNavigation(['project_manager'])).toMatchObject({ route: 'Projects', navContext: { filters: { projectStage: 'delivery', openRepresentative: true, workspaceTab: 'commercial' } } });
    expect(getRolePreviewWorkspaceNavigation(['procurement'])).toMatchObject({ route: 'Projects', navContext: { filters: { projectStage: 'delivery', openRepresentative: true, workspaceTab: 'procurement' } } });
    expect(getRolePreviewWorkspaceNavigation(['accounting'])).toMatchObject({ route: 'Projects', navContext: { filters: { projectStage: 'delivery', openRepresentative: true, workspaceTab: 'finance' } } });
    expect(getRolePreviewWorkspaceNavigation(['legal'])).toMatchObject({ route: 'Projects', navContext: { filters: { projectStage: 'won', openRepresentative: true, workspaceTab: 'legal' } } });
    expect(getRolePreviewWorkspaceNavigation(undefined)).toMatchObject({ route: 'Projects', navContext: { filters: { openRepresentative: true, workspaceTab: 'overview' } } });
  });
});
