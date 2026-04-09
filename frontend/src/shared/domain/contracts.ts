import {
  LEGACY_ROLE_ALIASES,
  ROLE_ACTION_PERMISSIONS,
  ROLE_PRIORITY,
  SYSTEM_ROLES,
} from './generatedContracts';
import type {
  ActionPermissionKey,
  ApprovalLane,
  ProjectWorkspaceTabKey,
  SystemRole,
} from './generatedContracts';

export {
  ACTION_PERMISSION_KEYS,
  APPROVAL_LANES,
  APPROVAL_DECISIONS,
  APPROVAL_GATE_TYPES,
  APPROVAL_STATUSES,
  DELIVERY_LINE_STATUSES,
  DOCUMENT_REVIEW_STATUSES,
  INBOUND_LINE_STATUSES,
  PROJECT_STAGES,
  PROCUREMENT_LINE_STATUSES,
  QUOTATION_STATUSES,
  ROLE_ACTION_PERMISSIONS,
  SALES_ORDER_STATUSES,
  SYSTEM_ROLES,
  TASK_DEPENDENCY_KINDS,
  THREAD_STATUSES,
  WORKSPACE_TAB_KEYS,
} from './generatedContracts';
export type {
  AccountType,
  ActionPermissionKey,
  ApprovalLane,
  ApprovalDecision,
  ApprovalGateType,
  ApprovalStatus,
  DocumentReviewState,
  DocumentReviewStatus,
  DeliveryLineStatus,
  EntityThread,
  ErpEventStatus,
  ErpOutboxEventContract,
  FilterQuery,
  Pagination,
  ProcurementLineStatus,
  ProjectActivityItem,
  ProjectStage,
  ProjectDocument,
  ProjectWorkspaceSummary,
  ProjectWorkspaceTabKey,
  QuotationStatus,
  SalesOrderStatus,
  SystemRole,
  TaskContextRef,
  TaskDependency,
  TaskDependencyKind,
  TaskStatus,
  ThreadMessage,
  ThreadStatus,
  WorklogEntry,
} from './generatedContracts';

const LEGACY_ROLE_ALIAS_MAP: Partial<Record<SystemRole, SystemRole>> = LEGACY_ROLE_ALIASES;
const ROLE_PRIORITY_ORDER: readonly SystemRole[] = ROLE_PRIORITY;
const ROLE_ACTION_PERMISSION_MAP: Record<SystemRole, readonly ActionPermissionKey[]> =
  ROLE_ACTION_PERMISSIONS as Record<SystemRole, readonly ActionPermissionKey[]>;

export const APP_MODULES = [
  'Home',
  'My Work',
  'Inbox',
  'Approvals',
  'Projects',
  'Tasks',
  'ERP Orders',
  'Reports',
  'Leads',
  'Accounts',
  'Contacts',
  'Equipment',
  'Suppliers',
  'Partners',
  'Sales',
  'Ops Overview',
  'Gantt',
  'Ops Staff',
  'Ops Chat',
  'EventLog',
  'Users',
  'Settings',
  'Support',
] as const;

export type AppModule = (typeof APP_MODULES)[number];
export type AppModulePhaseOneExposure = 'core' | 'maintenance' | 'admin';

export const PHASE_ONE_MAINTENANCE_MODULES: AppModule[] = [
  'Partners',
  'Suppliers',
  'Ops Overview',
  'Gantt',
  'Ops Staff',
  'Ops Chat',
  'Reports',
  'EventLog',
  'Support',
];

export const APP_MODULE_PHASE_ONE_EXPOSURE: Record<AppModule, AppModulePhaseOneExposure> = APP_MODULES.reduce(
  (acc, moduleName) => {
    acc[moduleName] = PHASE_ONE_MAINTENANCE_MODULES.includes(moduleName) ? 'maintenance' : 'core';
    return acc;
  },
  {} as Record<AppModule, AppModulePhaseOneExposure>,
);

APP_MODULE_PHASE_ONE_EXPOSURE.Users = 'admin';
APP_MODULE_PHASE_ONE_EXPOSURE.Settings = 'admin';

export type RolePersonaMode =
  | 'sales'
  | 'project_manager'
  | 'procurement'
  | 'accounting'
  | 'legal'
  | 'director'
  | 'admin'
  | 'viewer';

export type RoleProfile = {
  roleCodes: SystemRole[];
  primaryRole: SystemRole;
  personaMode: RolePersonaMode;
  allowedModules: AppModule[];
};

export type ApprovalOwnerRole = Extract<SystemRole, 'sales' | 'project_manager' | 'procurement' | 'accounting' | 'legal' | 'director'>;

export type WorkflowGuardFailure = {
  code: string;
  message: string;
};

export type WorkflowTransitionResult =
  | { ok: true }
  | { ok: false; failure: WorkflowGuardFailure };

export type ApprovalRequestLike = {
  id?: number | string;
  requestType?: string | null;
  department?: string | null;
  approverRole?: string | null;
  approverUserId?: number | string | null;
  status?: string | null;
  requestedBy?: number | string | null;
};

const BUSINESS_ROLE_LABELS: Partial<Record<SystemRole, string>> = {
  admin: 'Admin',
  sales: 'Sales',
  project_manager: 'Project Manager',
  procurement: 'Procurement',
  accounting: 'Accounting',
  legal: 'Legal',
  director: 'Director',
  manager: 'Manager',
  viewer: 'Viewer',
};

export const ROLE_MODULE_ACCESS: Record<SystemRole, AppModule[]> = {
  admin: [...APP_MODULES],
  sales: ['Home', 'My Work', 'Inbox', 'Approvals', 'Projects', 'Leads', 'Accounts', 'Contacts', 'Equipment', 'Partners', 'Sales'],
  project_manager: ['Home', 'My Work', 'Inbox', 'Approvals', 'Projects', 'Tasks', 'ERP Orders', 'Ops Overview', 'Gantt', 'Ops Staff'],
  procurement: ['Home', 'My Work', 'Inbox', 'Approvals', 'Projects', 'Tasks', 'ERP Orders', 'Suppliers', 'Equipment', 'Reports'],
  accounting: ['Home', 'My Work', 'Inbox', 'Approvals', 'Projects', 'ERP Orders', 'Reports'],
  legal: ['Home', 'My Work', 'Inbox', 'Approvals', 'Projects', 'Reports'],
  director: ['Home', 'My Work', 'Inbox', 'Approvals', 'Projects', 'Reports', 'EventLog'],
  manager: ['Home', 'My Work', 'Inbox', 'Approvals', 'Projects', 'Tasks', 'Reports'],
  viewer: ['Home', 'My Work', 'Inbox', 'Projects', 'Reports', 'Support'],
};

const WORKSPACE_TAB_META: Array<{ key: ProjectWorkspaceTabKey; label: string; roles: SystemRole[] }> = [
  { key: 'overview', label: 'Overview', roles: [...SYSTEM_ROLES] },
  { key: 'commercial', label: 'Commercial', roles: ['admin', 'sales', 'project_manager', 'manager', 'director', 'viewer'] },
  { key: 'procurement', label: 'Procurement', roles: ['admin', 'sales', 'project_manager', 'procurement', 'manager', 'director'] },
  { key: 'delivery', label: 'Delivery', roles: ['admin', 'sales', 'project_manager', 'procurement', 'accounting', 'manager', 'director', 'viewer'] },
  { key: 'finance', label: 'Quản lý chi phí', roles: ['admin', 'accounting', 'director'] },
  { key: 'legal', label: 'Legal', roles: ['admin', 'legal', 'director'] },
  { key: 'tasks', label: 'Tasks', roles: ['admin', 'sales', 'project_manager', 'procurement', 'accounting', 'legal', 'director', 'manager', 'viewer'] },
  { key: 'timeline', label: 'Timeline', roles: ['admin', 'sales', 'project_manager', 'procurement', 'accounting', 'legal', 'director', 'manager', 'viewer'] },
  { key: 'documents', label: 'Documents', roles: ['admin', 'sales', 'project_manager', 'procurement', 'accounting', 'legal', 'director', 'manager', 'viewer'] },
];

export const ROLE_WORKSPACE_TABS: Record<SystemRole, ProjectWorkspaceTabKey[]> = SYSTEM_ROLES.reduce((acc, roleCode) => {
  acc[roleCode] = WORKSPACE_TAB_META
    .filter((tab) => tab.roles.includes(roleCode))
    .map((tab) => tab.key);
  return acc;
}, {} as Record<SystemRole, ProjectWorkspaceTabKey[]>);

export const APPROVAL_PERMISSION_MAP: Record<ApprovalLane, SystemRole[]> = {
  commercial: ['sales', 'project_manager', 'director', 'manager'],
  procurement: ['procurement', 'director'],
  finance: ['accounting'],
  legal: ['legal'],
  executive: ['director'],
};

export const ROLE_LABELS: Record<SystemRole, string> = SYSTEM_ROLES.reduce((acc, roleCode) => {
  acc[roleCode] = BUSINESS_ROLE_LABELS[roleCode] || roleCode;
  return acc;
}, {} as Record<SystemRole, string>);

export function normalizeRoleCodes(roleCodes: unknown, legacyRole?: unknown): SystemRole[] {
  const values: string[] = Array.isArray(roleCodes)
    ? roleCodes.map((value) => String(value || '').trim())
    : typeof roleCodes === 'string' && roleCodes.trim()
      ? (() => {
          try {
            const parsed = JSON.parse(roleCodes);
            if (Array.isArray(parsed)) {
              return parsed.map((value) => String(value || '').trim());
            }
          } catch {
            return roleCodes.split(',').map((value) => value.trim());
          }
          return [];
        })()
      : [];

  const normalized = values
    .map((value) => value.toLowerCase() as SystemRole)
    .map((value) => LEGACY_ROLE_ALIAS_MAP[value] || value)
    .filter((value): value is SystemRole => SYSTEM_ROLES.includes(value));

  if (normalized.length === 0 && typeof legacyRole === 'string') {
    const fallback = (LEGACY_ROLE_ALIAS_MAP[legacyRole as SystemRole] || legacyRole) as SystemRole;
    if (SYSTEM_ROLES.includes(fallback)) {
      normalized.push(fallback);
    }
  }

  if (normalized.length === 0) {
    normalized.push('viewer');
  }

  return Array.from(new Set(normalized));
}

export function resolvePrimaryRole(roleCodes: SystemRole[], legacyRole?: unknown): SystemRole {
  if (typeof legacyRole === 'string') {
    const candidate = (LEGACY_ROLE_ALIAS_MAP[legacyRole as SystemRole] || legacyRole) as SystemRole;
    if (roleCodes.includes(candidate)) {
      return candidate;
    }
  }

  if (roleCodes.includes('project_manager') && roleCodes.includes('sales')) {
    return 'project_manager';
  }

  for (const roleCode of ROLE_PRIORITY_ORDER) {
    if (roleCodes.includes(roleCode)) {
      return roleCode;
    }
  }

  return 'viewer';
}

function dedupeModules(modules: AppModule[]): AppModule[] {
  return Array.from(new Set(modules));
}

export function buildRoleProfile(roleCodes: unknown, legacyRole?: unknown): RoleProfile {
  const normalizedRoles = normalizeRoleCodes(roleCodes, legacyRole);
  const primaryRole = resolvePrimaryRole(normalizedRoles, legacyRole);
  const allowedModules = dedupeModules(
    normalizedRoles.flatMap((roleCode) => ROLE_MODULE_ACCESS[roleCode] || []),
  );

  let personaMode: RolePersonaMode = primaryRole as RolePersonaMode;
  if (primaryRole === 'admin') {
    personaMode = 'admin';
  } else if (primaryRole === 'viewer') {
    personaMode = 'viewer';
  }

  return {
    roleCodes: normalizedRoles,
    primaryRole,
    personaMode,
    allowedModules,
  };
}

export function canAccessModule(profileOrRoles: RoleProfile | unknown, moduleName: AppModule, legacyRole?: unknown) {
  const profile = isRoleProfile(profileOrRoles) ? profileOrRoles : buildRoleProfile(profileOrRoles, legacyRole);
  return profile.allowedModules.includes(moduleName);
}

export function getAppModulePhaseOneExposure(moduleName: AppModule): AppModulePhaseOneExposure {
  return APP_MODULE_PHASE_ONE_EXPOSURE[moduleName];
}

export function isMaintenanceOnlyModule(moduleName: AppModule) {
  return getAppModulePhaseOneExposure(moduleName) === 'maintenance';
}

function isRoleProfile(value: unknown): value is RoleProfile {
  return !!value && typeof value === 'object' && Array.isArray((value as RoleProfile).allowedModules);
}

export function hasAnyRole(roleCodes: unknown, targetRoles: SystemRole[], legacyRole?: unknown) {
  const normalizedRoles = normalizeRoleCodes(roleCodes, legacyRole);
  if (normalizedRoles.includes('admin')) return true;
  return targetRoles.some((roleCode) => normalizedRoles.includes(roleCode));
}

export function canEdit(roleCodes: unknown, legacyRole?: unknown) {
  return !normalizeRoleCodes(roleCodes, legacyRole).every((roleCode) => roleCode === 'viewer');
}

export function canDelete(roleCodes: unknown, legacyRole?: unknown) {
  return hasAnyRole(roleCodes, ['admin', 'project_manager'], legacyRole);
}

export function canManageUsers(roleCodes: unknown, legacyRole?: unknown) {
  return hasAnyRole(roleCodes, ['admin'], legacyRole);
}

export function canAccessSettings(roleCodes: unknown, legacyRole?: unknown) {
  return hasAnyRole(roleCodes, ['admin'], legacyRole);
}

export function getProjectWorkspaceTabsForRoles(roleCodes: unknown, legacyRole?: unknown) {
  const normalizedRoles = normalizeRoleCodes(roleCodes, legacyRole);
  return WORKSPACE_TAB_META.filter((tab) => tab.roles.some((roleCode) => normalizedRoles.includes(roleCode)));
}

export function canPerformAction(roleCodes: unknown, actionKey: ActionPermissionKey, legacyRole?: unknown) {
  const normalizedRoles = normalizeRoleCodes(roleCodes, legacyRole);
  return normalizedRoles.some((roleCode) => ROLE_ACTION_PERMISSION_MAP[roleCode].includes(actionKey));
}

function includesAny(haystack: string, needles: string[]) {
  return needles.some((needle) => haystack.includes(needle));
}

export function resolveApprovalLane(approval: ApprovalRequestLike): ApprovalLane {
  const requestType = String(approval.requestType || '').trim().toLowerCase();
  const department = String(approval.department || '').trim().toLowerCase();
  const approverRole = String(approval.approverRole || '').trim().toLowerCase();

  if (
    ['procurement', 'purchase'].includes(department) ||
    includesAny(requestType, ['procurement', 'supplier', 'purchase', 'po-approval']) ||
    approverRole === 'procurement'
  ) {
    return 'procurement';
  }

  if (
    department === 'legal' ||
    includesAny(requestType, ['legal', 'contract', 'clause', 'deviation']) ||
    approverRole === 'legal'
  ) {
    return 'legal';
  }

  if (
    ['bod', 'executive'].includes(department) ||
    includesAny(requestType, ['executive', 'margin-exception', 'profit-risk']) ||
    ['director', 'ceo', 'executive'].includes(approverRole)
  ) {
    return 'executive';
  }

  if (
    department === 'finance' ||
    includesAny(requestType, ['finance', 'payment', 'invoice', 'receivable']) ||
    ['finance', 'accounting', 'cfo'].includes(approverRole)
  ) {
    return 'finance';
  }

  return 'commercial';
}

export function canApproveRequest(
  roleCodes: unknown,
  approval: ApprovalRequestLike,
  legacyRole?: unknown,
  currentUserId?: number | string | null,
) {
  const normalizedRoles = normalizeRoleCodes(roleCodes, legacyRole);
  if (String(approval.status || '').trim().toLowerCase() !== 'pending') {
    return false;
  }
  if (currentUserId && String(approval.requestedBy || '').trim() === String(currentUserId).trim()) {
    return false;
  }
  const assignedUserId = String(approval.approverUserId || '').trim();
  if (assignedUserId && currentUserId && assignedUserId !== String(currentUserId).trim()) {
    return false;
  }
  const lane = resolveApprovalLane(approval);
  return normalizedRoles.some((roleCode) => APPROVAL_PERMISSION_MAP[lane].includes(roleCode));
}
