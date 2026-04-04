import type { NavContext } from './navContext';
import { buildRoleProfile, normalizeRoleCodes, type AppModule, type SystemRole } from './shared/domain/contracts';

type PreviewableUser = {
  systemRole: SystemRole;
  roleCodes?: SystemRole[];
  previewRoleCodes?: SystemRole[];
  baseSystemRole?: SystemRole;
  baseRoleCodes?: SystemRole[];
  isRolePreviewActive?: boolean;
};

export function normalizePreviewRoleCodes(roleCodes: unknown): SystemRole[] {
  if (roleCodes == null || roleCodes === '') return [];
  return normalizeRoleCodes(roleCodes).filter((roleCode) => roleCode !== 'admin');
}

export const ROLE_PREVIEW_PRESETS: Array<{ key: string; label: string; roleCodes?: SystemRole[] }> = [
  { key: 'sales', label: 'View as Sales', roleCodes: ['sales'] },
  { key: 'project_manager', label: 'View as PM', roleCodes: ['project_manager'] },
  { key: 'sales_pm_combined', label: 'View as Sales + PM', roleCodes: ['sales', 'project_manager'] },
  { key: 'procurement', label: 'View as Procurement', roleCodes: ['procurement'] },
  { key: 'accounting', label: 'View as Accounting', roleCodes: ['accounting'] },
  { key: 'legal', label: 'View as Legal', roleCodes: ['legal'] },
  { key: 'director', label: 'View as Director', roleCodes: ['director'] },
  { key: 'viewer', label: 'View as Viewer', roleCodes: ['viewer'] },
];

export type RolePreviewNavigation = {
  route: AppModule;
  navContext?: NavContext;
};

export function getRolePreviewPresetNavigation(presetKey: string): RolePreviewNavigation {
  switch (presetKey) {
    case 'sales':
      return { route: 'My Work', navContext: { route: 'My Work', filters: { workFocus: 'commercial' } } };
    case 'project_manager':
      return { route: 'My Work', navContext: { route: 'My Work', filters: { workFocus: 'execution' } } };
    case 'sales_pm_combined':
      return { route: 'My Work', navContext: { route: 'My Work', filters: { workFocus: 'combined' } } };
    case 'procurement':
      return { route: 'Inbox', navContext: { route: 'Inbox', filters: { department: 'procurement' } } };
    case 'accounting':
      return { route: 'Approvals', navContext: { route: 'Approvals', filters: { approvalLane: 'finance' } } };
    case 'legal':
      return { route: 'Approvals', navContext: { route: 'Approvals', filters: { approvalLane: 'legal' } } };
    case 'director':
      return { route: 'Approvals', navContext: { route: 'Approvals', filters: { approvalLane: 'executive' } } };
    case 'viewer':
      return { route: 'Home' };
    default:
      return { route: 'Settings' };
  }
}

export function getRolePreviewWorkspaceNavigation(roleCodes: unknown, legacyRole?: unknown): RolePreviewNavigation {
  const normalizedRoleCodes = normalizeRoleCodes(roleCodes, legacyRole);
  if (normalizedRoleCodes.includes('sales') && normalizedRoleCodes.includes('project_manager')) {
    return { route: 'Projects', navContext: { route: 'Projects', filters: { projectStage: 'won', workspaceTab: 'commercial', openRepresentative: true } } };
  }

  const profile = buildRoleProfile(normalizedRoleCodes, legacyRole);

  switch (profile.personaMode) {
    case 'sales':
      return { route: 'Projects', navContext: { route: 'Projects', filters: { projectStage: 'quoting', workspaceTab: 'commercial', openRepresentative: true } } };
    case 'project_manager':
      return { route: 'Projects', navContext: { route: 'Projects', filters: { projectStage: 'delivery', workspaceTab: 'commercial', openRepresentative: true } } };
    case 'procurement':
      return { route: 'Projects', navContext: { route: 'Projects', filters: { projectStage: 'delivery', workspaceTab: 'procurement', openRepresentative: true } } };
    case 'accounting':
      return { route: 'Projects', navContext: { route: 'Projects', filters: { projectStage: 'delivery', workspaceTab: 'finance', openRepresentative: true } } };
    case 'legal':
      return { route: 'Projects', navContext: { route: 'Projects', filters: { projectStage: 'won', workspaceTab: 'legal', openRepresentative: true } } };
    case 'director':
      return { route: 'Projects', navContext: { route: 'Projects', filters: { projectStage: 'won', workspaceTab: 'overview', openRepresentative: true } } };
    case 'viewer':
      return { route: 'Projects', navContext: { route: 'Projects', filters: { workspaceTab: 'overview', openRepresentative: true } } };
    case 'admin':
    default:
      return { route: 'Projects', navContext: { route: 'Projects', filters: { workspaceTab: 'overview', openRepresentative: true } } };
  }
}

export function isRolePreviewPresetActive(currentRoleCodes: unknown, presetRoleCodes?: SystemRole[]) {
  const current = normalizePreviewRoleCodes(currentRoleCodes);
  const preset = normalizePreviewRoleCodes(presetRoleCodes);
  if (preset.length === 0) return false;
  if (current.length !== preset.length) return false;
  return current.every((roleCode, index) => roleCode === preset[index]);
}

export function applyRolePreviewToUser<T extends PreviewableUser>(user: T): T & {
  baseSystemRole: SystemRole;
  baseRoleCodes: SystemRole[];
  previewRoleCodes?: SystemRole[];
  isRolePreviewActive: boolean;
} {
  const baseRoleCodes = normalizeRoleCodes(user.baseRoleCodes ?? user.roleCodes, user.baseSystemRole ?? user.systemRole);
  const baseProfile = buildRoleProfile(baseRoleCodes, user.baseSystemRole ?? user.systemRole);
  const previewRoleCodes = normalizePreviewRoleCodes(user.previewRoleCodes);

  if (!baseRoleCodes.includes('admin') || previewRoleCodes.length === 0) {
    return {
      ...user,
      systemRole: baseProfile.primaryRole,
      roleCodes: baseRoleCodes,
      baseSystemRole: baseProfile.primaryRole,
      baseRoleCodes,
      previewRoleCodes: undefined,
      isRolePreviewActive: false,
    };
  }

  return {
    ...user,
    systemRole: previewRoleCodes[0],
    roleCodes: previewRoleCodes,
    baseSystemRole: baseProfile.primaryRole,
    baseRoleCodes,
    previewRoleCodes,
    isRolePreviewActive: true,
  };
}
