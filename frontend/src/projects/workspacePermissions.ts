import { canPerformAction, normalizeRoleCodes } from '../shared/domain/contracts';

export type WorkspaceActionAccess = {
  canEditCommercial: boolean;
  canEditPricing: boolean;
  canEditProcurement: boolean;
  canEditDelivery: boolean;
  canEditTimeline: boolean;
  canReviewDocuments: boolean;
};

export type WorkspacePreviewNotice = {
  readOnly: boolean;
  title: string;
  message: string;
  tone: 'info' | 'warning';
};

export function buildWorkspaceActionAccess(roleCodes: unknown, legacyRole?: unknown): WorkspaceActionAccess {
  const normalizedRoles = normalizeRoleCodes(roleCodes, legacyRole);
  const isPureProjectManager =
    normalizedRoles.includes('project_manager') &&
    !normalizedRoles.includes('sales') &&
    !normalizedRoles.includes('admin');
  const canEditCommercial = canPerformAction(normalizedRoles, 'edit_commercial', legacyRole) && !isPureProjectManager;
  const canEditProcurement = canPerformAction(roleCodes, 'edit_procurement', legacyRole);
  const canEditTimeline = canPerformAction(roleCodes, 'edit_execution', legacyRole);

  return {
    canEditCommercial,
    canEditPricing: canEditCommercial,
    canEditProcurement,
    canEditDelivery: canEditProcurement,
    canEditTimeline,
    canReviewDocuments: canPerformAction(roleCodes, 'review_documents', legacyRole),
  };
}
