import { requestJsonWithAuth, API_BASE } from '../shared/api/client';
import { showNotify } from '../Notification';
import type { ProjectWorkspaceTabKey } from '../shared/domain/contracts';
import type { WorkspaceActionAccess } from './workspacePermissions';
import { guardWorkspaceAction } from './workspaceGuardedActions';
import {
  buildBlockerEditorState,
  buildDeliveryEditorState,
  buildDocumentChecklistEditorState,
  buildInboundEditorState,
} from './projectWorkspaceEditors';
import { ensureArray } from './projectWorkspacePanels';

const API = API_BASE;

type ProjectWorkspaceEditorHandlersDeps = {
  token: string;
  projectId: string;
  workspace: any;
  ui: any;
  workspaceActionAccess: WorkspaceActionAccess;
  denyWorkspaceAction: (message: string) => void;
  setBusy: (value: string | null) => void;
  loadWorkspace: () => Promise<void>;
  setTab: (tab: ProjectWorkspaceTabKey) => void;
  performQuickReviewDocument: (document: any, nextStatus: 'in_review' | 'changes_requested' | 'approved') => Promise<void>;
};

export function createProjectWorkspaceEditorHandlers({
  token,
  projectId,
  workspace,
  ui,
  workspaceActionAccess,
  denyWorkspaceAction,
  setBusy,
  loadWorkspace,
  setTab,
  performQuickReviewDocument,
}: ProjectWorkspaceEditorHandlersDeps) {
  const openContractEditor = guardWorkspaceAction({
    allowed: workspaceActionAccess.canEditCommercial,
    deniedMessage: 'Vai trò hiện tại chỉ được xem không gian thương mại',
    onDenied: denyWorkspaceAction,
    action: ui.setContractEditor,
  });

  const openAppendixEditor = guardWorkspaceAction({
    allowed: workspaceActionAccess.canEditCommercial,
    deniedMessage: 'Vai trò hiện tại chỉ được xem không gian thương mại',
    onDenied: denyWorkspaceAction,
    action: ui.setAppendixEditor,
  });

  const openProcurementEditor = guardWorkspaceAction({
    allowed: workspaceActionAccess.canEditProcurement,
    deniedMessage: 'Vai trò hiện tại không được cập nhật không gian mua hàng',
    onDenied: denyWorkspaceAction,
    action: ui.setProcurementEditor,
  });

  const openInboundEditor = guardWorkspaceAction({
    allowed: workspaceActionAccess.canEditDelivery,
    deniedMessage: 'Vai trò hiện tại không được cập nhật không gian giao hàng',
    onDenied: denyWorkspaceAction,
    action: ui.setInboundEditor,
  });

  const openDeliveryEditor = guardWorkspaceAction({
    allowed: workspaceActionAccess.canEditDelivery,
    deniedMessage: 'Vai trò hiện tại không được cập nhật không gian giao hàng',
    onDenied: denyWorkspaceAction,
    action: ui.setDeliveryEditor,
  });

  const openMilestoneEditor = guardWorkspaceAction({
    allowed: workspaceActionAccess.canEditTimeline,
    deniedMessage: 'Vai trò hiện tại không được cập nhật timeline của dự án',
    onDenied: denyWorkspaceAction,
    action: ui.setMilestoneEditor,
  });

  const openDocumentEditor = guardWorkspaceAction({
    allowed: workspaceActionAccess.canReviewDocuments,
    deniedMessage: 'Vai trò hiện tại chỉ được xem checklist hồ sơ',
    onDenied: denyWorkspaceAction,
    action: (value: any) => ui.setDocumentEditor(buildDocumentChecklistEditorState(value, workspace?.projectStage)),
  });

  const openBlockerEditor = guardWorkspaceAction({
    allowed: workspaceActionAccess.canReviewDocuments,
    deniedMessage: 'Vai trò hiện tại chỉ được xem blocker register',
    onDenied: denyWorkspaceAction,
    action: (value: any) => ui.setBlockerEditor(buildBlockerEditorState(value)),
  });

  const openAuditItem = (value: any) => {
    ui.setAuditTrailItem(value);
  };

  const openInboundFromProcurement = guardWorkspaceAction({
    allowed: workspaceActionAccess.canEditDelivery,
    deniedMessage: 'Vai trò hiện tại không được cập nhật không gian giao hàng',
    onDenied: denyWorkspaceAction,
    action: (line: any) => ui.setInboundEditor(buildInboundEditorState(line)),
  });

  const openDeliveryFromProcurement = guardWorkspaceAction({
    allowed: workspaceActionAccess.canEditDelivery,
    deniedMessage: 'Vai trò hiện tại không được cập nhật không gian giao hàng',
    onDenied: denyWorkspaceAction,
    action: (line: any) => ui.setDeliveryEditor(buildDeliveryEditorState(line)),
  });

  const saveMainContract = guardWorkspaceAction({
    allowed: workspaceActionAccess.canEditCommercial,
    deniedMessage: 'Vai trò hiện tại chỉ được xem không gian thương mại',
    onDenied: denyWorkspaceAction,
    action: async () => {
      const lineItems = ensureArray(ui.contractEditor?.lineItems).filter((line: any) => line.itemCode || line.itemName || line.description);
      if (!lineItems.length) return showNotify('Cần ít nhất 1 line item trong hợp đồng', 'error');
      setBusy('contract-save');
      try {
        const isEdit = Boolean(ui.contractEditor?.id);
        const url = isEdit ? `${API}/project-contracts/${ui.contractEditor.id}` : `${API}/projects/${projectId}/contracts`;
        await requestJsonWithAuth(token, url, { method: isEdit ? 'PATCH' : 'POST', body: JSON.stringify({ ...ui.contractEditor, lineItems }) }, 'Không thể lưu hợp đồng chính');
        showNotify(isEdit ? 'Đã cập nhật hợp đồng chính' : 'Đã lưu hợp đồng chính và tạo baseline', 'success');
        ui.setContractEditor(null);
        setTab('commercial');
        await loadWorkspace();
      } catch (error: any) {
        showNotify(error?.message || 'Không thể lưu hợp đồng chính', 'error');
      } finally {
        setBusy(null);
      }
    },
  });

  const saveAppendix = guardWorkspaceAction({
    allowed: workspaceActionAccess.canEditCommercial,
    deniedMessage: 'Vai trò hiện tại chỉ được xem không gian thương mại',
    onDenied: denyWorkspaceAction,
    action: async () => {
      const lineItems = ensureArray(ui.appendixEditor?.lineItems).filter((line: any) => line.itemCode || line.itemName || line.description);
      if (!workspace?.mainContract?.id) return showNotify('Cần có hợp đồng chính trước khi thêm phụ lục', 'error');
      if (!lineItems.length) return showNotify('Cần ít nhất 1 line item trong phụ lục', 'error');
      setBusy('appendix-save');
      try {
        const isEdit = Boolean(ui.appendixEditor?.id);
        const url = isEdit ? `${API}/project-contract-appendices/${ui.appendixEditor.id}` : `${API}/projects/${projectId}/contracts/${workspace.mainContract.id}/appendices`;
        await requestJsonWithAuth(token, url, { method: isEdit ? 'PATCH' : 'POST', body: JSON.stringify({ ...ui.appendixEditor, lineItems }) }, 'Không thể lưu phụ lục');
        showNotify(isEdit ? 'Đã cập nhật phụ lục' : 'Đã lưu phụ lục và cập nhật baseline', 'success');
        ui.setAppendixEditor(null);
        setTab('commercial');
        await loadWorkspace();
      } catch (error: any) {
        showNotify(error?.message || 'Không thể lưu phụ lục', 'error');
      } finally {
        setBusy(null);
      }
    },
  });

  const saveProcurement = guardWorkspaceAction({
    allowed: workspaceActionAccess.canEditProcurement,
    deniedMessage: 'Vai trò hiện tại không được cập nhật không gian mua hàng',
    onDenied: denyWorkspaceAction,
    action: async () => {
      if (!ui.procurementEditor?.id) return;
      setBusy('procurement-save');
      try {
        await requestJsonWithAuth(token, `${API}/project-procurement-lines/${ui.procurementEditor.id}`, { method: 'PATCH', body: JSON.stringify(ui.procurementEditor) }, 'Không thể cập nhật line mua hàng');
        showNotify('Đã cập nhật line mua hàng', 'success');
        ui.setProcurementEditor(null);
        await loadWorkspace();
      } catch (error: any) {
        showNotify(error?.message || 'Không thể cập nhật line mua hàng', 'error');
      } finally {
        setBusy(null);
      }
    },
  });

  const saveMoveLine = guardWorkspaceAction({
    allowed: workspaceActionAccess.canEditDelivery,
    deniedMessage: 'Vai trò hiện tại không được cập nhật không gian giao hàng',
    onDenied: denyWorkspaceAction,
    action: async (type: 'inbound' | 'delivery') => {
      const editor = type === 'inbound' ? ui.inboundEditor : ui.deliveryEditor;
      if (!editor?.procurementLineId) return showNotify('Chọn procurement line trước khi lưu', 'error');
      setBusy(`${type}-save`);
      try {
        const isEdit = Boolean(editor?.id);
        const url = isEdit ? `${API}/project-${type}-lines/${editor.id}` : `${API}/projects/${projectId}/${type}-lines`;
        await requestJsonWithAuth(token, url, { method: isEdit ? 'PATCH' : 'POST', body: JSON.stringify(editor) }, type === 'inbound' ? 'Không thể lưu inbound' : 'Không thể lưu giao hàng');
        showNotify(type === 'inbound' ? (isEdit ? 'Đã cập nhật inbound' : 'Đã ghi nhận inbound') : (isEdit ? 'Đã cập nhật giao hàng' : 'Đã ghi nhận giao hàng'), 'success');
        if (type === 'inbound') ui.setInboundEditor(null); else ui.setDeliveryEditor(null);
        setTab('delivery');
        await loadWorkspace();
      } catch (error: any) {
        showNotify(error?.message || (type === 'inbound' ? 'Không thể lưu inbound' : 'Không thể lưu giao hàng'), 'error');
      } finally {
        setBusy(null);
      }
    },
  });

  const saveMilestone = guardWorkspaceAction({
    allowed: workspaceActionAccess.canEditTimeline,
    deniedMessage: 'Vai trò hiện tại không được cập nhật timeline của dự án',
    onDenied: denyWorkspaceAction,
    action: async () => {
      if (!ui.milestoneEditor?.title?.trim()) return showNotify('Thiếu tiêu đề milestone', 'error');
      setBusy('milestone-save');
      try {
        const isEdit = Boolean(ui.milestoneEditor?.id);
        const url = isEdit ? `${API}/project-milestones/${ui.milestoneEditor.id}` : `${API}/projects/${projectId}/milestones`;
        await requestJsonWithAuth(token, url, { method: isEdit ? 'PATCH' : 'POST', body: JSON.stringify(ui.milestoneEditor) }, 'Không thể lưu milestone');
        showNotify(isEdit ? 'Đã cập nhật milestone' : 'Đã tạo milestone', 'success');
        ui.setMilestoneEditor(null);
        setTab('timeline');
        await loadWorkspace();
      } catch (error: any) {
        showNotify(error?.message || 'Không thể lưu milestone', 'error');
      } finally {
        setBusy(null);
      }
    },
  });

  const saveDocumentChecklist = guardWorkspaceAction({
    allowed: workspaceActionAccess.canReviewDocuments,
    deniedMessage: 'Vai trò hiện tại chỉ được xem checklist hồ sơ',
    onDenied: denyWorkspaceAction,
    action: async () => {
      if (!ui.documentEditor?.documentName?.trim()) return showNotify('Thiếu tên hồ sơ', 'error');
      if (!ui.documentEditor?.department?.trim()) return showNotify('Thiếu phòng ban phụ trách', 'error');
      setBusy('document-save');
      try {
        const isEdit = Boolean(ui.documentEditor?.id);
        const url = isEdit ? `${API}/project-documents/${ui.documentEditor.id}` : `${API}/projects/${projectId}/documents`;
        await requestJsonWithAuth(token, url, {
          method: isEdit ? 'PATCH' : 'POST',
          body: JSON.stringify({
            quotationId: ui.documentEditor.quotationId,
            documentCode: ui.documentEditor.documentCode,
            documentName: ui.documentEditor.documentName,
            category: ui.documentEditor.category,
            department: ui.documentEditor.department,
            status: ui.documentEditor.status,
            requiredAtStage: ui.documentEditor.requiredAtStage,
            receivedAt: ui.documentEditor.receivedAt,
            note: ui.documentEditor.note,
          }),
        }, 'Không thể lưu checklist hồ sơ');
        if (isEdit) {
          await requestJsonWithAuth(token, `${API}/project-documents/${ui.documentEditor.id}/review-state`, {
            method: 'PATCH',
            body: JSON.stringify({
              reviewStatus: ui.documentEditor.reviewStatus,
              reviewerUserId: ui.documentEditor.reviewerUserId || null,
              reviewNote: ui.documentEditor.reviewNote || null,
              storageKey: ui.documentEditor.storageKey || null,
              threadId: ui.documentEditor.threadId || null,
            }),
          }, 'Không thể lưu review state hồ sơ');
        }
        showNotify(isEdit ? 'Đã cập nhật checklist hồ sơ' : 'Đã thêm checklist hồ sơ', 'success');
        ui.setDocumentEditor(null);
        setTab('documents');
        await loadWorkspace();
      } catch (error: any) {
        showNotify(error?.message || 'Không thể lưu checklist hồ sơ', 'error');
      } finally {
        setBusy(null);
      }
    },
  });

  const saveBlocker = guardWorkspaceAction({
    allowed: workspaceActionAccess.canReviewDocuments,
    deniedMessage: 'Vai trò hiện tại chỉ được xem blocker register',
    onDenied: denyWorkspaceAction,
    action: async () => {
      if (!ui.blockerEditor?.title?.trim()) return showNotify('Thiếu tiêu đề blocker', 'error');
      setBusy('blocker-save');
      try {
        const isEdit = Boolean(ui.blockerEditor?.id);
        const url = isEdit ? `${API}/project-blockers/${ui.blockerEditor.id}` : `${API}/projects/${projectId}/blockers`;
        await requestJsonWithAuth(token, url, {
          method: isEdit ? 'PATCH' : 'POST',
          body: JSON.stringify(ui.blockerEditor),
        }, 'Không thể lưu blocker');
        showNotify(isEdit ? 'Đã cập nhật blocker' : 'Đã thêm blocker', 'success');
        ui.setBlockerEditor(null);
        setTab('documents');
        await loadWorkspace();
      } catch (error: any) {
        showNotify(error?.message || 'Không thể lưu blocker', 'error');
      } finally {
        setBusy(null);
      }
    },
  });

  const quickReviewDocument = guardWorkspaceAction({
    allowed: workspaceActionAccess.canReviewDocuments,
    deniedMessage: 'Vai trò hiện tại chỉ được xem checklist hồ sơ',
    onDenied: denyWorkspaceAction,
    action: performQuickReviewDocument,
  });

  return {
    openContractEditor,
    openAppendixEditor,
    openProcurementEditor,
    openInboundEditor,
    openDeliveryEditor,
    openMilestoneEditor,
    openDocumentEditor,
    openBlockerEditor,
    openAuditItem,
    openInboundFromProcurement,
    openDeliveryFromProcurement,
    saveMainContract,
    saveAppendix,
    saveProcurement,
    saveMoveLine,
    saveMilestone,
    saveDocumentChecklist,
    saveBlocker,
    quickReviewDocument,
  };
}
