export const SYSTEM_ROLES = [
  'admin',
  'sales',
  'project_manager',
  'procurement',
  'accounting',
  'legal',
  'director',
  'manager',
  'viewer',
] as const;

export type SystemRole = (typeof SYSTEM_ROLES)[number];

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
  'Pricing',
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

export type ProjectWorkspaceTabKey =
  | 'overview'
  | 'commercial'
  | 'procurement'
  | 'delivery'
  | 'finance'
  | 'legal'
  | 'tasks'
  | 'timeline'
  | 'documents';

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

export const ACTION_PERMISSION_KEYS = [
  'manage_users',
  'manage_settings',
  'view_all_projects',
  'edit_project_shell',
  'edit_commercial',
  'edit_execution',
  'edit_procurement',
  'approve_finance',
  'approve_legal',
  'approve_executive',
  'review_documents',
] as const;

export type ActionPermissionKey = (typeof ACTION_PERMISSION_KEYS)[number];

export const APPROVAL_LANES = [
  'commercial',
  'procurement',
  'finance',
  'legal',
  'executive',
] as const;

export type ApprovalLane = (typeof APPROVAL_LANES)[number];

export const QUOTATION_STATUSES = [
  'draft',
  'submitted_for_approval',
  'revision_required',
  'approved',
  'rejected',
  'won',
  'lost',
] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

export const APPROVAL_STATUSES = ['pending', 'approved', 'rejected', 'changes_requested', 'cancelled'] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const SALES_ORDER_STATUSES = ['draft', 'released', 'locked_for_execution', 'cancelled'] as const;
export type SalesOrderStatus = (typeof SALES_ORDER_STATUSES)[number];

export const PROCUREMENT_LINE_STATUSES = ['planned', 'ordered', 'partially_received', 'received', 'cancelled'] as const;
export type ProcurementLineStatus = (typeof PROCUREMENT_LINE_STATUSES)[number];

export const INBOUND_LINE_STATUSES = ['pending', 'received', 'closed'] as const;
export type InboundLineStatus = (typeof INBOUND_LINE_STATUSES)[number];

export const DELIVERY_LINE_STATUSES = ['pending', 'scheduled', 'partially_delivered', 'delivered', 'blocked', 'closed'] as const;
export type DeliveryLineStatus = (typeof DELIVERY_LINE_STATUSES)[number];

export const PROJECT_STAGES = [
  'new',
  'quoting',
  'negotiating',
  'internal-review',
  'commercial_approved',
  'won',
  'lost',
  'order_released',
  'procurement_active',
  'delivery_active',
  'delivery',
  'delivery_completed',
  'closed',
] as const;
export type ProjectStage = (typeof PROJECT_STAGES)[number];

export const APPROVAL_GATE_TYPES = [
  'quotation_commercial',
  'sales_order_release',
  'procurement_commitment',
  'delivery_release',
  'delivery_completion',
] as const;
export type ApprovalGateType = (typeof APPROVAL_GATE_TYPES)[number];

export type ApprovalOwnerRole = Extract<SystemRole, 'sales' | 'project_manager' | 'procurement' | 'accounting' | 'legal' | 'director'>;

export type WorkflowGuardFailure = {
  code: string;
  message: string;
};

export type WorkflowTransitionResult =
  | { ok: true }
  | { ok: false; failure: WorkflowGuardFailure };

export type ApprovalRequestLike = {
  id?: string;
  requestType?: string | null;
  department?: string | null;
  approverRole?: string | null;
  approverUserId?: string | null;
  status?: string | null;
  requestedBy?: string | null;
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

const LEGACY_ROLE_ALIASES: Partial<Record<SystemRole, SystemRole>> = {
  manager: 'project_manager',
};

const ROLE_PRIORITY: SystemRole[] = [
  'admin',
  'project_manager',
  'sales',
  'procurement',
  'accounting',
  'legal',
  'director',
  'viewer',
];

export const ROLE_MODULE_ACCESS: Record<SystemRole, AppModule[]> = {
  admin: [...APP_MODULES],
  sales: ['Home', 'My Work', 'Inbox', 'Approvals', 'Projects', 'Tasks', 'Leads', 'Accounts', 'Contacts', 'Equipment', 'Partners', 'Sales', 'Pricing', 'Users', 'Support'],
  project_manager: ['Home', 'My Work', 'Inbox', 'Approvals', 'Projects', 'Tasks', 'ERP Orders', 'Reports', 'Leads', 'Accounts', 'Contacts', 'Equipment', 'Partners', 'Sales', 'Pricing', 'Ops Overview', 'Gantt', 'Ops Staff', 'Ops Chat', 'Users', 'Support'],
  procurement: ['Home', 'My Work', 'Inbox', 'Approvals', 'Projects', 'Tasks', 'ERP Orders', 'Suppliers', 'Equipment', 'Reports', 'Users', 'Support'],
  accounting: ['Home', 'My Work', 'Inbox', 'Approvals', 'Projects', 'ERP Orders', 'Reports', 'Users', 'Support'],
  legal: ['Home', 'My Work', 'Inbox', 'Approvals', 'Projects', 'Reports', 'Users', 'Support'],
  director: ['Home', 'My Work', 'Inbox', 'Approvals', 'Projects', 'Reports', 'EventLog', 'Users', 'Support'],
  manager: ['Home', 'My Work', 'Inbox', 'Approvals', 'Projects', 'Tasks', 'Reports', 'Users', 'Support'],
  viewer: ['Home', 'My Work', 'Inbox', 'Projects', 'Reports', 'Users', 'Support'],
};

export const ROLE_ACTION_PERMISSIONS: Record<SystemRole, ActionPermissionKey[]> = {
  admin: ['manage_users', 'manage_settings', 'view_all_projects', 'edit_project_shell', 'edit_commercial', 'edit_execution', 'edit_procurement', 'review_documents'],
  sales: ['edit_commercial', 'review_documents'],
  project_manager: ['edit_project_shell', 'edit_commercial', 'edit_execution', 'review_documents'],
  procurement: ['edit_procurement', 'review_documents'],
  accounting: ['approve_finance', 'review_documents'],
  legal: ['approve_legal', 'review_documents'],
  director: ['view_all_projects', 'approve_executive', 'review_documents'],
  manager: ['edit_project_shell', 'edit_execution', 'review_documents'],
  viewer: [],
};

const WORKSPACE_TAB_META: Array<{ key: ProjectWorkspaceTabKey; label: string; roles: SystemRole[] }> = [
  { key: 'overview', label: 'Overview', roles: [...SYSTEM_ROLES] },
  { key: 'commercial', label: 'Commercial', roles: ['admin', 'sales', 'project_manager', 'manager', 'director', 'viewer'] },
  { key: 'procurement', label: 'Procurement', roles: ['admin', 'sales', 'project_manager', 'procurement', 'manager', 'director'] },
  { key: 'delivery', label: 'Delivery', roles: ['admin', 'sales', 'project_manager', 'procurement', 'accounting', 'manager', 'director', 'viewer'] },
  { key: 'finance', label: 'Finance', roles: ['admin', 'accounting', 'director'] },
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
    .map((value) => LEGACY_ROLE_ALIASES[value] || value)
    .filter((value): value is SystemRole => SYSTEM_ROLES.includes(value));

  if (normalized.length === 0 && typeof legacyRole === 'string') {
    const fallback = (LEGACY_ROLE_ALIASES[legacyRole as SystemRole] || legacyRole) as SystemRole;
    if (SYSTEM_ROLES.includes(fallback)) {
      normalized.push(fallback);
    }
  }

  if (normalized.length === 0) {
    normalized.push('viewer');
  }

  const deduped = Array.from(new Set(normalized));
  if (deduped.includes('project_manager') && deduped.includes('sales')) {
    return deduped.filter((roleCode) => roleCode !== 'sales');
  }

  return deduped;
}

export function resolvePrimaryRole(roleCodes: SystemRole[], legacyRole?: unknown): SystemRole {
  if (roleCodes.includes('project_manager') && roleCodes.includes('sales')) {
    return 'project_manager';
  }

  if (typeof legacyRole === 'string') {
    const candidate = (LEGACY_ROLE_ALIASES[legacyRole as SystemRole] || legacyRole) as SystemRole;
    if (roleCodes.includes(candidate)) {
      return candidate;
    }
  }

  for (const roleCode of ROLE_PRIORITY) {
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
  return normalizedRoles.some((roleCode) => (ROLE_ACTION_PERMISSIONS[roleCode] || []).includes(actionKey));
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

export function canApproveRequest(roleCodes: unknown, approval: ApprovalRequestLike, legacyRole?: unknown, currentUserId?: string | null) {
  const normalizedRoles = normalizeRoleCodes(roleCodes, legacyRole);
  if (String(approval.status || '').trim().toLowerCase() !== 'pending') {
    return false;
  }
  if (currentUserId && String(approval.requestedBy || '').trim() === currentUserId) {
    return false;
  }
  const assignedUserId = String(approval.approverUserId || '').trim();
  if (assignedUserId && currentUserId && assignedUserId !== currentUserId) {
    return false;
  }
  const lane = resolveApprovalLane(approval);
  return normalizedRoles.some((roleCode) => APPROVAL_PERMISSION_MAP[lane].includes(roleCode));
}
