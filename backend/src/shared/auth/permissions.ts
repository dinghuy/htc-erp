import type { AuthenticatedUser } from '../contracts/domain';
import { normalizeRoleCodes, type NormalizedRoleCode } from './roles';

export const APPROVAL_LANES = ['commercial', 'procurement', 'finance', 'legal', 'executive'] as const;
export type ApprovalLane = (typeof APPROVAL_LANES)[number];

export type ApprovalRequestLike = {
  requestType?: string | null;
  department?: string | null;
  approverRole?: string | null;
  approverUserId?: string | null;
  status?: string | null;
  requestedBy?: string | null;
};

export const APPROVAL_PERMISSION_MAP: Record<ApprovalLane, NormalizedRoleCode[]> = {
  commercial: ['sales', 'project_manager', 'director'],
  procurement: ['procurement', 'director'],
  finance: ['accounting'],
  legal: ['legal'],
  executive: ['director'],
};

function includesAny(haystack: string, needles: string[]) {
  return needles.some((needle) => haystack.includes(needle));
}

export function resolveApprovalLane(approval: ApprovalRequestLike): ApprovalLane {
  const requestType = String(approval.requestType || '').trim().toLowerCase();
  const department = String(approval.department || '').trim().toLowerCase();
  const approverRole = String(approval.approverRole || '').trim().toLowerCase();

  if (
    department === 'finance' ||
    includesAny(requestType, ['finance', 'payment', 'invoice', 'receivable', 'qbu']) ||
    ['finance', 'accounting', 'cfo'].includes(approverRole)
  ) {
    return 'finance';
  }

  if (
    department === 'legal' ||
    includesAny(requestType, ['legal', 'contract', 'clause', 'deviation']) ||
    approverRole === 'legal'
  ) {
    return 'legal';
  }

  if (
    ['procurement', 'purchase'].includes(department) ||
    includesAny(requestType, ['procurement', 'supplier', 'purchase', 'po-approval']) ||
    approverRole === 'procurement'
  ) {
    return 'procurement';
  }

  if (
    ['bod', 'executive'].includes(department) ||
    includesAny(requestType, ['executive', 'margin-exception', 'profit-risk']) ||
    ['director', 'ceo', 'executive'].includes(approverRole)
  ) {
    return 'executive';
  }

  return 'commercial';
}

export function canUserApproveRequest(user: Pick<AuthenticatedUser, 'id' | 'systemRole' | 'roleCodes'> | null | undefined, approval: ApprovalRequestLike) {
  if (!user) return false;
  const userRoles = normalizeRoleCodes(user.roleCodes, user.systemRole);
  const lane = resolveApprovalLane(approval);
  const assignedUserId = String(approval.approverUserId || '').trim();

  if (String(approval.status || '').trim().toLowerCase() !== 'pending') {
    return false;
  }

  if (userRoles.includes('admin')) {
    return true;
  }

  if (String(approval.requestedBy || '').trim() === user.id) {
    return false;
  }

  if (assignedUserId && assignedUserId !== user.id) {
    return false;
  }

  return userRoles.some((roleCode) => APPROVAL_PERMISSION_MAP[lane].includes(roleCode));
}

export function resolveApprovalActingCapability(user: Pick<AuthenticatedUser, 'systemRole' | 'roleCodes'> | null | undefined, approval: ApprovalRequestLike): NormalizedRoleCode | null {
  if (!user) return null;
  const userRoles = normalizeRoleCodes(user.roleCodes, user.systemRole);
  const lane = resolveApprovalLane(approval);
  return APPROVAL_PERMISSION_MAP[lane].find((roleCode) => userRoles.includes(roleCode)) || null;
}

export function hasGlobalWorkspaceAccess(roleCodes: unknown, systemRole?: unknown, baseRoleCodes?: unknown, baseSystemRole?: unknown) {
  const normalized = normalizeRoleCodes(roleCodes, systemRole);
  const baseNormalized = normalizeRoleCodes(baseRoleCodes, baseSystemRole);
  return normalized.includes('admin') || normalized.includes('director') || baseNormalized.includes('admin') || baseNormalized.includes('director');
}
