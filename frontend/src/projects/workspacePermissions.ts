import type { ProjectWorkspaceTabKey } from '../shared/domain/contracts';
import { canPerformAction } from '../shared/domain/contracts';

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
  const canEditCommercial = canPerformAction(roleCodes, 'edit_commercial', legacyRole);
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

export function buildWorkspacePreviewNotice(
  tab: ProjectWorkspaceTabKey,
  actionAccess: WorkspaceActionAccess,
  isRolePreviewActive: boolean,
  previewLabel: string,
): WorkspacePreviewNotice | null {
  if (!isRolePreviewActive) return null;

  const previewName = previewLabel || 'role đang preview';
  const editableByTab: Partial<Record<ProjectWorkspaceTabKey, boolean>> = {
    commercial: actionAccess.canEditCommercial,
    procurement: actionAccess.canEditProcurement,
    delivery: actionAccess.canEditDelivery,
    timeline: actionAccess.canEditTimeline,
  };

  if (Object.prototype.hasOwnProperty.call(editableByTab, tab)) {
    const canEditCurrentTab = Boolean(editableByTab[tab]);
    if (!canEditCurrentTab) {
      return {
        readOnly: true,
        tone: 'warning',
        title: `Preview read-only: ${previewName}`,
        message: `Tab ${tab} đang mở ở chế độ xem. Action ghi dữ liệu bị khóa vì capability hiện tại không cho phép chỉnh tab này.`,
      };
    }

    return {
      readOnly: false,
      tone: 'info',
      title: `Preview active: ${previewName}`,
      message: `Tab ${tab} đang được kiểm thử bằng đúng capability hiện tại của role preview. Bạn chỉ thấy và thao tác được những action lane này cho phép.`,
    };
  }

  return {
    readOnly: true,
    tone: 'info',
    title: `Preview review mode: ${previewName}`,
    message: `Tab ${tab} là bề mặt review hoặc cockpit trong role preview hiện tại. Admin vẫn không được nâng quyền business chỉ vì đang preview.`,
  };
}
