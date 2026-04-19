import { requestJsonWithAuth, API_BASE } from '../shared/api/client';
import { showNotify } from '../Notification';
import type { ProjectWorkspaceTabKey } from '../shared/domain/contracts';
import { buildDocumentThreadSummary } from './documentThreadData';

const API = API_BASE;

type ProjectWorkspaceAsyncActionsDeps = {
  token: string;
  projectId: string;
  currentUserId: string;
  workspace: any;
  ui: any;
  setBusy: (value: string | null) => void;
  loadWorkspace: () => Promise<void>;
  setTab: (value: ProjectWorkspaceTabKey) => void;
  goToRoute: (route: string, filters?: any, entityType?: any, entityId?: string) => void;
};

async function loadThread(token: string, entityType: 'Project' | 'ProjectDocument', entityId: string, loadErrorMessage: string) {
  const threadPayload = await requestJsonWithAuth<any>(
    token,
    `${API}/v1/threads?entityType=${entityType}&entityId=${entityId}`,
    {},
    loadErrorMessage,
  );
  const threadId = threadPayload?.items?.[0]?.id;
  const messagesPayload = threadId
    ? await requestJsonWithAuth<any>(token, `${API}/v1/threads/${threadId}/messages`, {}, 'Không thể tải messages thread')
    : { items: [] };

  return {
    threadSummary: buildDocumentThreadSummary({ threadPayload, messagesPayload }),
    messages: Array.isArray(messagesPayload?.items) ? messagesPayload.items : [],
  };
}

export function createProjectWorkspaceAsyncActions({
  token,
  projectId,
  currentUserId,
  workspace,
  ui,
  setBusy,
  loadWorkspace,
  setTab,
  goToRoute,
}: ProjectWorkspaceAsyncActionsDeps) {
  const createApprovalRequest = async (key: string, payload: any, successMessage: string) => {
    setBusy(key);
    try {
      await requestJsonWithAuth(token, `${API}/projects/${projectId}/approval-requests`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }, 'Không thể tạo approval request');
      showNotify(successMessage, 'success');
      await loadWorkspace();
    } catch (error: any) {
      showNotify(error?.message || 'Không thể tạo approval request', 'error');
    } finally {
      setBusy(null);
    }
  };

  const createCommercialApproval = async () => {
    const quotationId = workspace?.actionAvailability?.quotation?.latestQuotationId;
    if (!quotationId) return showNotify('Không có quotation phù hợp để trình commercial approval', 'error');
    await createApprovalRequest('request-commercial-approval', {
      quotationId,
      requestType: 'quotation_commercial',
      title: 'Phê duyệt thương mại báo giá',
      department: 'Thương mại',
      approverRole: 'director',
    }, 'Đã tạo phê duyệt thương mại');
  };

  const createSalesOrder = async () => {
    const quotationId = workspace?.actionAvailability?.quotation?.latestQuotationId;
    if (!quotationId) return showNotify('Không có báo giá phù hợp để tạo sales order', 'error');
    setBusy('create-sales-order');
    try {
      await requestJsonWithAuth(token, `${API}/sales-orders/from-quotation/${quotationId}`, { method: 'POST' }, 'Không thể tạo sales order');
      showNotify('Đã tạo sales order', 'success');
      await loadWorkspace();
    } catch (error: any) {
      showNotify(error?.message || 'Không thể tạo sales order', 'error');
    } finally {
      setBusy(null);
    }
  };

  const releaseSalesOrder = async () => {
    const salesOrderId = workspace?.actionAvailability?.salesOrder?.latestSalesOrderId;
    if (!salesOrderId) return showNotify('Không có sales order để release', 'error');
    setBusy('release-sales-order');
    try {
      await requestJsonWithAuth(token, `${API}/sales-orders/${salesOrderId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'released' }),
      }, 'Không thể release sales order');
      showNotify('Đã release sales order', 'success');
      await loadWorkspace();
    } catch (error: any) {
      showNotify(error?.message || 'Không thể release sales order', 'error');
    } finally {
      setBusy(null);
    }
  };

  const requestDeliveryCompletionApproval = async () => {
    await createApprovalRequest('request-delivery-completion', {
      requestType: 'delivery_completion',
      title: 'Phê duyệt hoàn tất giao hàng',
      department: 'Vận hành',
      approverRole: 'sales',
    }, 'Đã tạo phê duyệt hoàn tất giao hàng');
  };

  const finalizeDeliveryCompletion = async () => {
    setBusy('finalize-delivery-completion');
    try {
      await requestJsonWithAuth(token, `${API}/projects/${projectId}/delivery-completion`, { method: 'POST' }, 'Không thể hoàn tất giao hàng');
      showNotify('Đã hoàn tất giao hàng', 'success');
      await loadWorkspace();
    } catch (error: any) {
      showNotify(error?.message || 'Không thể hoàn tất giao hàng', 'error');
    } finally {
      setBusy(null);
    }
  };

  const openDocumentThread = async (document: any) => {
    try {
      const { threadSummary, messages } = await loadThread(token, 'ProjectDocument', document.id, 'Không thể tải thread hồ sơ');
      ui.setDocumentThread({ document, threadSummary });
      ui.setDocumentThreadMessages(messages);
      ui.setDocumentThreadDraft('');
    } catch (error: any) {
      showNotify(error?.message || 'Không thể tải thread hồ sơ', 'error');
    }
  };

  const openProjectThread = async () => {
    try {
      const { threadSummary, messages } = await loadThread(token, 'Project', projectId, 'Không thể tải thread dự án');
      ui.setProjectThread({ project: workspace, threadSummary });
      ui.setProjectThreadMessages(messages);
      ui.setProjectThreadDraft('');
    } catch (error: any) {
      showNotify(error?.message || 'Không thể tải thread dự án', 'error');
    }
  };

  const openProjectThreadInTimeline = async () => {
    setTab('timeline');
    await openProjectThread();
  };

  const sendProjectThreadMessage = async () => {
    const content = String(ui.projectThreadDraft || '').trim();
    if (!content) return showNotify('Thiếu nội dung thread', 'error');
    setBusy('project-thread-send');
    try {
      let threadId = ui.projectThread?.threadSummary?.threadId;
      if (!threadId) {
        const createdThread = await requestJsonWithAuth<any>(token, `${API}/v1/threads`, {
          method: 'POST',
          body: JSON.stringify({
            entityType: 'Project',
            entityId: projectId,
            title: workspace?.name || workspace?.code || 'Project thread',
          }),
        }, 'Không thể tạo thread dự án');
        threadId = createdThread.id;
      }
      await requestJsonWithAuth<any>(token, `${API}/v1/threads/${threadId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      }, 'Không thể gửi message thread dự án');
      await openProjectThread();
    } catch (error: any) {
      showNotify(error?.message || 'Không thể gửi message thread dự án', 'error');
    } finally {
      setBusy(null);
    }
  };

  const sendDocumentThreadMessage = async () => {
    if (!ui.documentThread?.document?.id) return;
    const content = String(ui.documentThreadDraft || '').trim();
    if (!content) return showNotify('Thiếu nội dung thread', 'error');
    setBusy('document-thread-send');
    try {
      let threadId = ui.documentThread.threadSummary?.threadId;
      if (!threadId) {
        const createdThread = await requestJsonWithAuth<any>(token, `${API}/v1/threads`, {
          method: 'POST',
          body: JSON.stringify({
            entityType: 'ProjectDocument',
            entityId: ui.documentThread.document.id,
            title: ui.documentThread.document.documentName || ui.documentThread.document.documentCode || 'Document thread',
          }),
        }, 'Không thể tạo thread hồ sơ');
        threadId = createdThread.id;
      }
      await requestJsonWithAuth<any>(token, `${API}/v1/threads/${threadId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      }, 'Không thể gửi message thread');
      await openDocumentThread(ui.documentThread.document);
    } catch (error: any) {
      showNotify(error?.message || 'Không thể gửi message thread', 'error');
    } finally {
      setBusy(null);
    }
  };

  const runHeroAction = (action: string) => {
    if (action === 'requestCommercialApproval') return void createCommercialApproval();
    if (action === 'createSalesOrder') return void createSalesOrder();
    if (action === 'releaseSalesOrder') return void releaseSalesOrder();
    if (action === 'requestDeliveryCompletionApproval') return void requestDeliveryCompletionApproval();
    if (action === 'finalizeDeliveryCompletion') return void finalizeDeliveryCompletion();
    if (action === 'openApprovals') return goToRoute('Approvals', { projectId }, 'Project', projectId);
    if (action === 'openTasks') return setTab('tasks');
    if (action === 'openCommercial') return setTab('commercial');
    if (action === 'openProcurement') return setTab('procurement');
    if (action === 'openDelivery') return setTab('delivery');
    if (action === 'openFinance') return setTab('finance');
    if (action === 'openLegal') return setTab('legal');
    if (action === 'openTimeline') return setTab('timeline');
    if (action === 'openDocuments') return setTab('documents');
  };

  const quickReviewDocument = async (document: any, nextStatus: 'in_review' | 'changes_requested' | 'approved') => {
    if (!document?.id) return;
    setBusy('document-quick-review');
    try {
      await requestJsonWithAuth(token, `${API}/project-documents/${document.id}/review-state`, {
        method: 'PATCH',
        body: JSON.stringify({
          reviewStatus: nextStatus,
          reviewerUserId: currentUserId,
          reviewNote: document.reviewNote || null,
          storageKey: document.storageKey || null,
          threadId: document.threadId || null,
        }),
      }, 'Không thể cập nhật review state');
      showNotify('Đã cập nhật review state hồ sơ', 'success');
      await loadWorkspace();
    } catch (error: any) {
      showNotify(error?.message || 'Không thể cập nhật review state', 'error');
    } finally {
      setBusy(null);
    }
  };

  return {
    createCommercialApproval,
    createSalesOrder,
    releaseSalesOrder,
    requestDeliveryCompletionApproval,
    finalizeDeliveryCompletion,
    openDocumentThread,
    openProjectThread,
    openProjectThreadInTimeline,
    sendDocumentThreadMessage,
    sendProjectThreadMessage,
    runHeroAction,
    quickReviewDocument,
  };
}
