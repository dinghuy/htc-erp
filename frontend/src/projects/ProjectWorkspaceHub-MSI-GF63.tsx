import { useEffect, useState } from 'preact/hooks';
import { buildRoleProfile, ROLE_LABELS, type CurrentUser } from '../auth';
import { requestJsonWithAuth, API_BASE } from '../shared/api/client';
import { getProjectWorkspaceTabsForRoles, type ProjectWorkspaceTabKey } from '../shared/domain/contracts';
import { showNotify } from '../Notification';
import { tokens } from '../ui/tokens';
import { ui } from '../ui/styles';
import { setNavContext } from '../navContext';
import { projectStageLabel } from '../ops/workflowOptions';
import { QA_TEST_IDS, workspaceTabTestId } from '../testing/testIds';
import {
  ContractTab,
  DeliveryTab,
  DocumentsTab,
  FinanceTab,
  InboundTab,
  LegalTab,
  OverviewTab,
  ProcurementTab,
  ProjectTasksTab,
  QbuRoundsTab,
  QuotationTab,
  TimelineTab,
} from './ProjectWorkspaceTabs';
import {
  AuditTrailDetailModal,
  BlockerEditorModal,
  ContractEditorModal,
  DocumentChecklistEditorModal,
  DocumentThreadModal,
  MilestoneEditorModal,
  MoveLineEditorModal,
  ProcurementEditorModal,
} from './ProjectWorkspaceModals';
import { buildWorkspaceActionAccess, buildWorkspacePreviewNotice } from './workspacePermissions';
import { buildWorkspaceHeroPlan } from './workspaceHeroActions';
import { buildWorkspacePhaseReadiness } from './workspacePhaseReadiness';
import { buildWorkspaceSummaryKpis, mergeWorkspaceSummary } from './workspaceSummaryData';
import { buildDocumentThreadSummary } from './documentThreadData';
import { collectProjectActivityStream } from './projectActivityStreamData';
import {
  ensureArray,
  formatDateValue,
  isPastDate,
  numberValue,
  statusLabel,
  statusBadgeStyle,
  projectStageBadgeStyle,
  Modal,
  KpiCard,
  WorkspaceHeroActionBar,
  HandoffActivationPanel,
  WorkflowGatesSection,
  PhaseControlSection,
} from './projectWorkspacePanels';

const API = API_BASE;

const S = {
  btnPrimary: { ...ui.btn.primary, justifyContent: 'center', transition: 'all 0.2s ease' } as any,
  btnOutline: { ...ui.btn.outline, transition: 'all 0.2s ease' } as any,
  tabBtn: (active: boolean) => ({
    padding: `${tokens.spacing.md} ${tokens.spacing.xl}`,
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
    background: active ? tokens.colors.primary : 'transparent',
    color: active ? tokens.colors.textOnPrimary : tokens.colors.textSecondary,
    border: 'none',
    borderRadius: tokens.radius.lg,
    transition: 'all 0.2s ease'
  }) as any,
};




export function ProjectWorkspaceHubModal({
  projectId,
  token,
  currentUser,
  initialTab,
  focusDocumentId,
  openDocumentThreadOnMount,
  accounts,
  onClose,
  onNavigate,
  onUnavailable,
}: {
  projectId: string;
  token: string;
  currentUser: CurrentUser;
  initialTab?: ProjectWorkspaceTabKey;
  focusDocumentId?: string;
  openDocumentThreadOnMount?: boolean;
  accounts: any[];
  onClose: () => void;
  onNavigate?: (route: string) => void;
  onUnavailable?: (projectId: string) => void;
}) {
  const [workspace, setWorkspace] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<ProjectWorkspaceTabKey>(initialTab || 'overview');
  const [contractEditor, setContractEditor] = useState<any | null>(null);
  const [appendixEditor, setAppendixEditor] = useState<any | null>(null);
  const [procurementEditor, setProcurementEditor] = useState<any | null>(null);
  const [inboundEditor, setInboundEditor] = useState<any | null>(null);
  const [deliveryEditor, setDeliveryEditor] = useState<any | null>(null);
  const [milestoneEditor, setMilestoneEditor] = useState<any | null>(null);
  const [documentEditor, setDocumentEditor] = useState<any | null>(null);
  const [documentThread, setDocumentThread] = useState<any | null>(null);
  const [documentThreadMessages, setDocumentThreadMessages] = useState<any[]>([]);
  const [documentThreadDraft, setDocumentThreadDraft] = useState('');
  const [blockerEditor, setBlockerEditor] = useState<any | null>(null);
  const [auditTrailItem, setAuditTrailItem] = useState<any | null>(null);
  const [activityStream, setActivityStream] = useState<any[]>([]);

  const loadWorkspace = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [data, summary, activityStreamPayload] = await Promise.all([
        requestJsonWithAuth<any>(token, `${API}/projects/${projectId}`, {}, 'Không thể tải workspace dự án'),
        requestJsonWithAuth<any>(token, `${API}/v1/projects/${projectId}/workspace`, {}, 'Không thể tải summary workspace dự án').catch(() => null),
        requestJsonWithAuth<any>(token, `${API}/v1/projects/${projectId}/activities?limit=40`, {}, 'Không thể tải activity stream dự án').catch(() => ({ items: [] })),
      ]);
      if (!data?.id) {
        setWorkspace(null);
        setActivityStream([]);
        showNotify('Dự án không còn tồn tại hoặc không thể truy cập', 'error');
        onUnavailable?.(projectId);
        onClose();
        return;
      }
      setWorkspace(mergeWorkspaceSummary(data, summary));
      setActivityStream(collectProjectActivityStream(activityStreamPayload));
    } catch (error: any) {
      setWorkspace(null);
      setActivityStream([]);
      setLoadError(error?.message || 'Không thể tải workspace dự án');
      showNotify(error?.message || 'Lỗi tải workspace dự án', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadWorkspace();
  }, [projectId, token]);

  useEffect(() => {
    if (initialTab) {
      setTab(initialTab);
    }
  }, [initialTab, projectId]);

  useEffect(() => {
    if (!workspace || !focusDocumentId || !openDocumentThreadOnMount) return;
    const documents = ensureArray(workspace.documents);
    const target = documents.find((document: any) => document.id === focusDocumentId);
    if (!target) return;
    setTab('documents');
    void openDocumentThread(target);
  }, [workspace, focusDocumentId, openDocumentThreadOnMount]);

  const visibleTabs = getProjectWorkspaceTabsForRoles(currentUser.roleCodes, currentUser.systemRole);
  const workspaceActionAccess = buildWorkspaceActionAccess(currentUser.roleCodes, currentUser.systemRole);
  const previewLabel = currentUser.previewRoleCodes?.map((roleCode) => ROLE_LABELS[roleCode]).join(' + ') || ROLE_LABELS[currentUser.systemRole];
  const previewNotice = buildWorkspacePreviewNotice(tab, workspaceActionAccess, Boolean(currentUser.isRolePreviewActive), previewLabel);
  const roleProfile = buildRoleProfile(currentUser.roleCodes, currentUser.systemRole);
  const workspaceHeroPlan = buildWorkspaceHeroPlan(
    roleProfile.personaMode,
    workspace?.projectStage,
    workspace?.actionAvailability,
    workspaceActionAccess,
    workspace?.blockerRegister,
    workspace?.phaseControl,
  );

  useEffect(() => {
    if (visibleTabs.some((item) => item.key === tab)) return;
    if (initialTab && initialTab === tab) {
      showNotify('Không đủ quyền mở tab được yêu cầu, đang chuyển sang tab khả dụng đầu tiên.', 'info');
    }
    setTab(visibleTabs[0]?.key || 'overview');
  }, [initialTab, tab, visibleTabs]);

  const goToRoute = (route: string, filters?: any, entityType?: any, entityId?: string) => {
    if (!onNavigate) return;
    setNavContext({ route, filters, entityType, entityId });
    onNavigate(route);
    onClose();
  };

  const quotationVersions = ensureArray(workspace?.quotations);
  const qbuRounds = ensureArray(workspace?.qbuRounds);
  const contractAppendices = ensureArray(workspace?.contractAppendices);
  const executionBaselines = ensureArray(workspace?.executionBaselines);
  const procurementLines = ensureArray(workspace?.procurementLines);
  const inboundLines = ensureArray(workspace?.inboundLines);
  const deliveryLines = ensureArray(workspace?.deliveryLines);
  const milestones = ensureArray(workspace?.milestones);
  const timeline = ensureArray(workspace?.timeline);
  const currentBaseline = workspace?.currentBaseline || executionBaselines.find((item: any) => item.isCurrent);
  const supplierAccounts = ensureArray(accounts).filter((item: any) => String(item.accountType || '').toLowerCase() === 'supplier');
  const activeProcurementLines = procurementLines.filter((line: any) => {
    const activeFlag = line?.isActive !== false && Number(line?.isActive ?? 1) !== 0;
    const notSuperseded = String(line?.status || '').toLowerCase() !== 'superseded';
    const matchesCurrentBaseline = currentBaseline?.id ? line?.baselineId === currentBaseline.id : true;
    return activeFlag && notSuperseded && matchesCurrentBaseline;
  });
  const historyProcurementLines = procurementLines.filter((line: any) => !activeProcurementLines.some((activeLine: any) => activeLine.id === line.id));
  const inboundEditorProcurementLines = inboundEditor?.procurementLineId
    ? procurementLines.filter((line: any) => line.id === inboundEditor.procurementLineId || activeProcurementLines.some((activeLine: any) => activeLine.id === line.id))
    : activeProcurementLines;
  const deliveryEditorProcurementLines = deliveryEditor?.procurementLineId
    ? procurementLines.filter((line: any) => line.id === deliveryEditor.procurementLineId || activeProcurementLines.some((activeLine: any) => activeLine.id === line.id))
    : activeProcurementLines;
  const shortageLines = activeProcurementLines.filter((line: any) => numberValue(line.shortageQty) > 0);
  const overdueEtaLines = activeProcurementLines.filter((line: any) => isPastDate(line.etaDate) && numberValue(line.receivedQty) < Math.max(numberValue(line.orderedQty), numberValue(line.contractQty)));
  const overdueDeliveryLines = activeProcurementLines.filter((line: any) => isPastDate(line.committedDeliveryDate) && numberValue(line.deliveredQty) < numberValue(line.contractQty));
  const unorderedLines = activeProcurementLines.filter((line: any) => numberValue(line.orderedQty) < numberValue(line.contractQty));
  const pendingMilestones = milestones.filter((milestone: any) => String(milestone.status || 'pending').toLowerCase() !== 'completed');
  const overviewAlerts = [
    ...shortageLines.map((line: any) => ({
      key: `shortage-${line.id}`,
      tone: 'danger' as const,
      title: `${line.itemCode || line.itemName || 'Line'} đang thiếu ${numberValue(line.shortageQty)}`,
      description: `Hợp đồng ${numberValue(line.contractQty)} · Đặt mua ${numberValue(line.orderedQty)} · Đã nhận ${numberValue(line.receivedQty)} · Đã giao ${numberValue(line.deliveredQty)}`,
    })),
    ...overdueEtaLines.map((line: any) => ({
      key: `eta-${line.id}`,
      tone: 'warning' as const,
      title: `${line.itemCode || line.itemName || 'Line'} đã quá ETA`,
      description: `ETA ${formatDateValue(line.etaDate)} · Thực nhận ${numberValue(line.receivedQty)}/${Math.max(numberValue(line.orderedQty), numberValue(line.contractQty))}`,
    })),
    ...overdueDeliveryLines.map((line: any) => ({
      key: `delivery-${line.id}`,
      tone: 'warning' as const,
      title: `${line.itemCode || line.itemName || 'Line'} đã quá cam kết giao`,
      description: `Cam kết ${formatDateValue(line.committedDeliveryDate)} · Thực giao ${numberValue(line.deliveredQty)}/${numberValue(line.contractQty)}`,
    })),
    ...pendingMilestones.slice(0, 3).map((milestone: any) => ({
      key: `milestone-${milestone.id}`,
      tone: 'info' as const,
      title: `Milestone chờ xử lý: ${milestone.title}`,
      description: `Kế hoạch ${formatDateValue(milestone.plannedDate)} · Trạng thái ${statusLabel(milestone.status || 'pending')}`,
    })),
  ].slice(0, 6);
  const phaseReadiness = workspace?.phaseControl || buildWorkspacePhaseReadiness({
    workspace,
    shortageCount: shortageLines.length,
    overdueEtaCount: overdueEtaLines.length,
    overdueDeliveryCount: overdueDeliveryLines.length,
    unorderedCount: unorderedLines.length,
    pendingMilestoneCount: pendingMilestones.length,
  });
  const workHubSummaryKpis = buildWorkspaceSummaryKpis(workspace?.workHubSummary);

  const denyWorkspaceAction = (message: string) => {
    showNotify(message, 'error');
  };

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

  const openContractEditor = (value: any) => {
    if (!workspaceActionAccess.canEditCommercial) return denyWorkspaceAction('Vai trò hiện tại chỉ được xem không gian thương mại');
    setContractEditor(value);
  };

  const openAppendixEditor = (value: any) => {
    if (!workspaceActionAccess.canEditCommercial) return denyWorkspaceAction('Vai trò hiện tại chỉ được xem không gian thương mại');
    setAppendixEditor(value);
  };

  const openProcurementEditor = (value: any) => {
    if (!workspaceActionAccess.canEditProcurement) return denyWorkspaceAction('Vai trò hiện tại không được cập nhật không gian mua hàng');
    setProcurementEditor(value);
  };

  const openInboundEditor = (value: any) => {
    if (!workspaceActionAccess.canEditDelivery) return denyWorkspaceAction('Vai trò hiện tại không được cập nhật không gian giao hàng');
    setInboundEditor(value);
  };

  const openDeliveryEditor = (value: any) => {
    if (!workspaceActionAccess.canEditDelivery) return denyWorkspaceAction('Vai trò hiện tại không được cập nhật không gian giao hàng');
    setDeliveryEditor(value);
  };

  const openMilestoneEditor = (value: any) => {
    if (!workspaceActionAccess.canEditTimeline) return denyWorkspaceAction('Vai trò hiện tại không được cập nhật timeline của dự án');
    setMilestoneEditor(value);
  };

  const openDocumentEditor = (value: any) => {
    if (!workspaceActionAccess.canReviewDocuments) return denyWorkspaceAction('Vai trò hiện tại chỉ được xem checklist hồ sơ');
    setDocumentEditor({
      id: value?.id,
      quotationId: value?.quotationId || '',
      documentCode: value?.documentCode || '',
      documentName: value?.documentName || value?.title || '',
      category: value?.category || '',
      department: value?.department || '',
      status: value?.status || 'missing',
      requiredAtStage: value?.requiredAtStage || workspace?.projectStage || '',
      receivedAt: value?.receivedAt || '',
      note: value?.note || '',
      reviewStatus: value?.reviewStatus || 'draft',
      reviewerUserId: value?.reviewerUserId || '',
      reviewNote: value?.reviewNote || '',
      storageKey: value?.storageKey || '',
      threadId: value?.threadId || '',
    });
  };

  const openDocumentThread = async (document: any) => {
    try {
      const threadPayload = await requestJsonWithAuth<any>(token, `${API}/v1/threads?entityType=ProjectDocument&entityId=${document.id}`, {}, 'Không thể tải thread hồ sơ');
      const threadId = threadPayload?.items?.[0]?.id;
      const messagesPayload = threadId
        ? await requestJsonWithAuth<any>(token, `${API}/v1/threads/${threadId}/messages`, {}, 'Không thể tải messages thread')
        : { items: [] };
      setDocumentThread({
        document,
        threadSummary: buildDocumentThreadSummary({ threadPayload, messagesPayload }),
      });
      setDocumentThreadMessages(Array.isArray(messagesPayload?.items) ? messagesPayload.items : []);
      setDocumentThreadDraft('');
    } catch (error: any) {
      showNotify(error?.message || 'Không thể tải thread hồ sơ', 'error');
    }
  };

  const openBlockerEditor = (value: any) => {
    if (!workspaceActionAccess.canReviewDocuments) return denyWorkspaceAction('Vai trò hiện tại chỉ được xem blocker register');
    setBlockerEditor({
      id: value?.isManual ? value?.id : value?.id,
      source: value?.source || 'manual',
      category: value?.category || 'workflow',
      ownerRole: value?.ownerRole || '',
      status: value?.status || 'open',
      tone: value?.tone || 'warning',
      title: value?.title || '',
      detail: value?.detail || '',
      action: value?.action || '',
      linkedEntityType: value?.linkedEntityType || '',
      linkedEntityId: value?.linkedEntityId || '',
    });
  };

  const openAuditItem = (value: any) => {
    setAuditTrailItem(value);
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

  const openInboundFromProcurement = (line: any) => {
    if (!workspaceActionAccess.canEditDelivery) return denyWorkspaceAction('Vai trò hiện tại không được cập nhật không gian giao hàng');
    setInboundEditor({
      procurementLineId: line.id,
      receivedQty: Math.max(numberValue(line.orderedQty) - numberValue(line.receivedQty), 0),
      etaDate: line.etaDate || '',
      actualReceivedDate: '',
      status: numberValue(line.shortageQty) > 0 ? 'partial' : 'completed',
      receiptRef: '',
      note: '',
    });
  };

  const openDeliveryFromProcurement = (line: any) => {
    if (!workspaceActionAccess.canEditDelivery) return denyWorkspaceAction('Vai trò hiện tại không được cập nhật không gian giao hàng');
    setDeliveryEditor({
      procurementLineId: line.id,
      deliveredQty: Math.max(numberValue(line.receivedQty) - numberValue(line.deliveredQty), 0),
      committedDate: line.committedDeliveryDate || '',
      actualDeliveryDate: '',
      status: numberValue(line.shortageQty) > 0 ? 'partial' : 'completed',
      deliveryRef: '',
      note: '',
    });
  };

  const saveMainContract = async () => {
    if (!workspaceActionAccess.canEditCommercial) return denyWorkspaceAction('Vai trò hiện tại chỉ được xem không gian thương mại');
    const lineItems = ensureArray(contractEditor?.lineItems).filter((line: any) => line.itemCode || line.itemName || line.description);
    if (!lineItems.length) return showNotify('Cần ít nhất 1 line item trong hợp đồng', 'error');
    setBusy('contract-save');
    try {
      const isEdit = Boolean(contractEditor?.id);
      const url = isEdit ? `${API}/project-contracts/${contractEditor.id}` : `${API}/projects/${projectId}/contracts`;
      await requestJsonWithAuth(token, url, { method: isEdit ? 'PATCH' : 'POST', body: JSON.stringify({ ...contractEditor, lineItems }) }, 'Không thể lưu hợp đồng chính');
      showNotify(isEdit ? 'Đã cập nhật hợp đồng chính' : 'Đã lưu hợp đồng chính và tạo baseline', 'success');
      setContractEditor(null);
      setTab('commercial');
      await loadWorkspace();
    } catch (error: any) {
      showNotify(error?.message || 'Không thể lưu hợp đồng chính', 'error');
    } finally {
      setBusy(null);
    }
  };

  const saveAppendix = async () => {
    if (!workspaceActionAccess.canEditCommercial) return denyWorkspaceAction('Vai trò hiện tại chỉ được xem không gian thương mại');
    const lineItems = ensureArray(appendixEditor?.lineItems).filter((line: any) => line.itemCode || line.itemName || line.description);
    if (!workspace?.mainContract?.id) return showNotify('Cần có hợp đồng chính trước khi thêm phụ lục', 'error');
    if (!lineItems.length) return showNotify('Cần ít nhất 1 line item trong phụ lục', 'error');
    setBusy('appendix-save');
    try {
      const isEdit = Boolean(appendixEditor?.id);
      const url = isEdit ? `${API}/project-contract-appendices/${appendixEditor.id}` : `${API}/projects/${projectId}/contracts/${workspace.mainContract.id}/appendices`;
      await requestJsonWithAuth(token, url, { method: isEdit ? 'PATCH' : 'POST', body: JSON.stringify({ ...appendixEditor, lineItems }) }, 'Không thể lưu phụ lục');
      showNotify(isEdit ? 'Đã cập nhật phụ lục' : 'Đã lưu phụ lục và cập nhật baseline', 'success');
      setAppendixEditor(null);
      setTab('commercial');
      await loadWorkspace();
    } catch (error: any) {
      showNotify(error?.message || 'Không thể lưu phụ lục', 'error');
    } finally {
      setBusy(null);
    }
  };

  const saveProcurement = async () => {
    if (!workspaceActionAccess.canEditProcurement) return denyWorkspaceAction('Vai trò hiện tại không được cập nhật không gian mua hàng');
    if (!procurementEditor?.id) return;
    setBusy('procurement-save');
    try {
      await requestJsonWithAuth(token, `${API}/project-procurement-lines/${procurementEditor.id}`, { method: 'PATCH', body: JSON.stringify(procurementEditor) }, 'Không thể cập nhật line mua hàng');
      showNotify('Đã cập nhật line mua hàng', 'success');
      setProcurementEditor(null);
      await loadWorkspace();
    } catch (error: any) {
      showNotify(error?.message || 'Không thể cập nhật line mua hàng', 'error');
    } finally {
      setBusy(null);
    }
  };

  const saveMoveLine = async (type: 'inbound' | 'delivery') => {
    if (!workspaceActionAccess.canEditDelivery) return denyWorkspaceAction('Vai trò hiện tại không được cập nhật không gian giao hàng');
    const editor = type === 'inbound' ? inboundEditor : deliveryEditor;
    if (!editor?.procurementLineId) return showNotify('Chọn procurement line trước khi lưu', 'error');
    setBusy(`${type}-save`);
    try {
      const isEdit = Boolean(editor?.id);
      const url = isEdit ? `${API}/project-${type}-lines/${editor.id}` : `${API}/projects/${projectId}/${type}-lines`;
      await requestJsonWithAuth(token, url, { method: isEdit ? 'PATCH' : 'POST', body: JSON.stringify(editor) }, type === 'inbound' ? 'Không thể lưu inbound' : 'Không thể lưu giao hàng');
      showNotify(type === 'inbound' ? (isEdit ? 'Đã cập nhật inbound' : 'Đã ghi nhận inbound') : (isEdit ? 'Đã cập nhật giao hàng' : 'Đã ghi nhận giao hàng'), 'success');
      if (type === 'inbound') setInboundEditor(null); else setDeliveryEditor(null);
      setTab('delivery');
      await loadWorkspace();
    } catch (error: any) {
      showNotify(error?.message || (type === 'inbound' ? 'Không thể lưu inbound' : 'Không thể lưu giao hàng'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const saveMilestone = async () => {
    if (!workspaceActionAccess.canEditTimeline) return denyWorkspaceAction('Vai trò hiện tại không được cập nhật timeline của dự án');
    if (!milestoneEditor?.title?.trim()) return showNotify('Thiếu tiêu đề milestone', 'error');
    setBusy('milestone-save');
    try {
      const isEdit = Boolean(milestoneEditor?.id);
      const url = isEdit ? `${API}/project-milestones/${milestoneEditor.id}` : `${API}/projects/${projectId}/milestones`;
      await requestJsonWithAuth(token, url, { method: isEdit ? 'PATCH' : 'POST', body: JSON.stringify(milestoneEditor) }, 'Không thể lưu milestone');
      showNotify(isEdit ? 'Đã cập nhật milestone' : 'Đã tạo milestone', 'success');
      setMilestoneEditor(null);
      setTab('timeline');
      await loadWorkspace();
    } catch (error: any) {
      showNotify(error?.message || 'Không thể lưu milestone', 'error');
    } finally {
      setBusy(null);
    }
  };

  const saveDocumentChecklist = async () => {
    if (!workspaceActionAccess.canReviewDocuments) return denyWorkspaceAction('Vai trò hiện tại chỉ được xem checklist hồ sơ');
    if (!documentEditor?.documentName?.trim()) return showNotify('Thiếu tên hồ sơ', 'error');
    if (!documentEditor?.department?.trim()) return showNotify('Thiếu phòng ban phụ trách', 'error');
    setBusy('document-save');
    try {
      const isEdit = Boolean(documentEditor?.id);
      const url = isEdit ? `${API}/project-documents/${documentEditor.id}` : `${API}/projects/${projectId}/documents`;
      await requestJsonWithAuth(token, url, {
        method: isEdit ? 'PATCH' : 'POST',
        body: JSON.stringify({
          quotationId: documentEditor.quotationId,
          documentCode: documentEditor.documentCode,
          documentName: documentEditor.documentName,
          category: documentEditor.category,
          department: documentEditor.department,
          status: documentEditor.status,
          requiredAtStage: documentEditor.requiredAtStage,
          receivedAt: documentEditor.receivedAt,
          note: documentEditor.note,
        }),
      }, 'Không thể lưu checklist hồ sơ');
      if (isEdit) {
        await requestJsonWithAuth(token, `${API}/project-documents/${documentEditor.id}/review-state`, {
          method: 'PATCH',
          body: JSON.stringify({
            reviewStatus: documentEditor.reviewStatus,
            reviewerUserId: documentEditor.reviewerUserId || null,
            reviewNote: documentEditor.reviewNote || null,
            storageKey: documentEditor.storageKey || null,
            threadId: documentEditor.threadId || null,
          }),
        }, 'Không thể lưu review state hồ sơ');
      }
      showNotify(isEdit ? 'Đã cập nhật checklist hồ sơ' : 'Đã thêm checklist hồ sơ', 'success');
      setDocumentEditor(null);
      setTab('documents');
      await loadWorkspace();
    } catch (error: any) {
      showNotify(error?.message || 'Không thể lưu checklist hồ sơ', 'error');
    } finally {
      setBusy(null);
    }
  };

  const saveBlocker = async () => {
    if (!workspaceActionAccess.canReviewDocuments) return denyWorkspaceAction('Vai trò hiện tại chỉ được xem blocker register');
    if (!blockerEditor?.title?.trim()) return showNotify('Thiếu tiêu đề blocker', 'error');
    setBusy('blocker-save');
    try {
      const isEdit = Boolean(blockerEditor?.id);
      const url = isEdit ? `${API}/project-blockers/${blockerEditor.id}` : `${API}/projects/${projectId}/blockers`;
      await requestJsonWithAuth(token, url, {
        method: isEdit ? 'PATCH' : 'POST',
        body: JSON.stringify(blockerEditor),
      }, 'Không thể lưu blocker');
      showNotify(isEdit ? 'Đã cập nhật blocker' : 'Đã thêm blocker', 'success');
      setBlockerEditor(null);
      setTab('documents');
      await loadWorkspace();
    } catch (error: any) {
      showNotify(error?.message || 'Không thể lưu blocker', 'error');
    } finally {
      setBusy(null);
    }
  };

  const sendDocumentThreadMessage = async () => {
    if (!documentThread?.document?.id) return;
    const content = String(documentThreadDraft || '').trim();
    if (!content) return showNotify('Thiếu nội dung thread', 'error');
    setBusy('document-thread-send');
    try {
      let threadId = documentThread.threadSummary?.threadId;
      if (!threadId) {
        const createdThread = await requestJsonWithAuth<any>(token, `${API}/v1/threads`, {
          method: 'POST',
          body: JSON.stringify({
            entityType: 'ProjectDocument',
            entityId: documentThread.document.id,
            title: documentThread.document.documentName || documentThread.document.documentCode || 'Document thread',
          }),
        }, 'Không thể tạo thread hồ sơ');
        threadId = createdThread.id;
      }
      await requestJsonWithAuth<any>(token, `${API}/v1/threads/${threadId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      }, 'Không thể gửi message thread');
      await openDocumentThread(documentThread.document);
    } catch (error: any) {
      showNotify(error?.message || 'Không thể gửi message thread', 'error');
    } finally {
      setBusy(null);
    }
  };

  const quickReviewDocument = async (document: any, nextStatus: 'in_review' | 'changes_requested' | 'approved') => {
    if (!document?.id) return;
    if (!workspaceActionAccess.canReviewDocuments) return denyWorkspaceAction('Vai trò hiện tại chỉ được xem checklist hồ sơ');
    setBusy('document-quick-review');
    try {
      await requestJsonWithAuth(token, `${API}/project-documents/${document.id}/review-state`, {
        method: 'PATCH',
        body: JSON.stringify({
          reviewStatus: nextStatus,
          reviewerUserId: currentUser.id,
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

  return (
    <Modal title="Không gian dự án" onClose={onClose}>
      <div data-testid={QA_TEST_IDS.workspace.modal} style={{ display: 'contents' }}>
      {loading ? <div style={{ padding: '40px 0', textAlign: 'center', color: tokens.colors.textMuted }}>Đang tải workspace...</div> : loadError ? (
        <div style={{ display: 'grid', gap: '12px', padding: '12px 0' }}>
          <div style={{ color: tokens.colors.error, fontSize: '14px', fontWeight: 700 }}>{loadError}</div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}><button type="button" onClick={onClose} style={S.btnOutline}>Đóng</button><button type="button" onClick={() => void loadWorkspace()} style={S.btnPrimary}>Thử lại</button></div>
        </div>
      ) : !workspace ? <div style={{ padding: '40px 0', textAlign: 'center', color: tokens.colors.textMuted }}>Không gian dự án hiện không khả dụng.</div> : (
        <div style={{ display: 'grid', gap: '18px' }}>
          <div style={{ ...ui.card.base, padding: '20px', display: 'grid', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '12px', color: tokens.colors.textMuted, fontWeight: 800, letterSpacing: '0.06em' }}>{workspace.code || 'PROJECT'}</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: tokens.colors.textPrimary }}>{workspace.name}</div>
                <div style={{ fontSize: '13px', color: tokens.colors.textSecondary, marginTop: '6px' }}>{workspace.description || 'Chưa có mô tả.'}</div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span style={projectStageBadgeStyle(workspace.projectStage)}>{projectStageLabel(workspace.projectStage) || workspace.projectStage || 'Mới'}</span>
                <span style={statusBadgeStyle(workspace.status)}>{statusLabel(workspace.status || 'pending')}</span>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
              {workHubSummaryKpis.length > 0 ? (
                workHubSummaryKpis.map((item) => (
                  <KpiCard
                    key={item.label}
                    label={item.label}
                    value={item.value}
                    accent={
                      item.accentToken === 'danger'
                        ? tokens.colors.error
                        : item.accentToken === 'warning'
                          ? tokens.colors.warning
                          : item.accentToken === 'success'
                            ? tokens.colors.success
                            : tokens.colors.info
                    }
                  />
                ))
              ) : (
                <>
                  <KpiCard label="Phiên bản báo giá" value={quotationVersions.length} accent={tokens.colors.primary} />
                  <KpiCard label="Vòng QBU" value={qbuRounds.length} accent={tokens.colors.info} />
                  <KpiCard label="Phiên bản baseline" value={executionBaselines.length} accent={tokens.colors.success} />
                  <KpiCard label="Mua hàng đang chạy" value={activeProcurementLines.length} accent={tokens.colors.warning} />
                  <KpiCard label="Sự kiện inbound" value={inboundLines.length} accent={tokens.colors.info} />
                  <KpiCard label="Sự kiện giao hàng" value={deliveryLines.length} accent={tokens.colors.success} />
                  <KpiCard label="Blocker register" value={ensureArray(workspace?.blockerRegister).length} accent={tokens.colors.error} />
                  <KpiCard label="Audit trail" value={ensureArray(workspace?.auditTrail).length} accent={tokens.colors.textPrimary} />
                </>
              )}
            </div>
          </div>

          <WorkspaceHeroActionBar plan={workspaceHeroPlan} onRunAction={runHeroAction} />

          <PhaseControlSection readiness={phaseReadiness} onRunAction={runHeroAction} />

          <HandoffActivationPanel handoffActivation={workspace.handoffActivation} />

          <div style={{ ...ui.card.base, padding: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {visibleTabs.map((item) => <button key={item.key} data-testid={workspaceTabTestId(item.key)} type="button" style={S.tabBtn(tab === item.key)} onClick={() => setTab(item.key)}>{item.label}</button>)}
          </div>

          <WorkflowGatesSection
            gateStates={workspace.approvalGateStates}
            actionAvailability={workspace.actionAvailability}
            busy={busy}
            onRequestCommercialApproval={createCommercialApproval}
            onCreateSalesOrder={createSalesOrder}
            onReleaseSalesOrder={releaseSalesOrder}
            onRequestDeliveryCompletionApproval={requestDeliveryCompletionApproval}
            onFinalizeDeliveryCompletion={finalizeDeliveryCompletion}
            onOpenApprovals={() => goToRoute('Approvals', { projectId }, 'Project', projectId)}
          />

          {previewNotice ? (
            <div
              data-testid={QA_TEST_IDS.workspace.previewNotice}
              style={{
                ...ui.card.base,
                padding: '14px 16px',
                display: 'grid',
                gap: '6px',
                borderColor: previewNotice.tone === 'warning' ? tokens.colors.warning : tokens.colors.primary,
                background: previewNotice.tone === 'warning' ? tokens.colors.warningTint : tokens.colors.infoBg,
              }}
            >
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={previewNotice.readOnly ? ui.badge.warning : ui.badge.info}>{previewNotice.readOnly ? 'Preview chỉ xem' : 'Preview đang hoạt động'}</span>
                <span style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{previewNotice.title}</span>
              </div>
              <div style={{ fontSize: '12px', lineHeight: 1.6, color: tokens.colors.textSecondary }}>{previewNotice.message}</div>
            </div>
          ) : null}

          {tab === 'overview' ? <OverviewTab currentBaseline={currentBaseline} executionBaselines={executionBaselines} procurementLines={activeProcurementLines} shortageLines={shortageLines} overdueEtaLines={overdueEtaLines} overdueDeliveryLines={overdueDeliveryLines} unorderedLines={unorderedLines} overviewAlerts={overviewAlerts} pendingMilestones={pendingMilestones} milestones={milestones} workspace={workspace} projectId={projectId} goToRoute={goToRoute} setTab={setTab} /> : null}

          {tab === 'commercial' ? (
            <div style={{ display: 'grid', gap: '18px' }}>
              <QuotationTab quotationVersions={quotationVersions} />
              <QbuRoundsTab qbuRounds={qbuRounds} />
              <ContractTab workspace={workspace} currentBaseline={currentBaseline} contractAppendices={contractAppendices} executionBaselines={executionBaselines} setContractEditor={openContractEditor} setAppendixEditor={openAppendixEditor} canEditCommercial={workspaceActionAccess.canEditCommercial} />
            </div>
          ) : null}

          {tab === 'procurement' ? <ProcurementTab activeProcurementLines={activeProcurementLines} historyProcurementLines={historyProcurementLines} unorderedLines={unorderedLines} shortageLines={shortageLines} overdueEtaLines={overdueEtaLines} overdueDeliveryLines={overdueDeliveryLines} setProcurementEditor={openProcurementEditor} openInboundFromProcurement={openInboundFromProcurement} openDeliveryFromProcurement={openDeliveryFromProcurement} canEditProcurement={workspaceActionAccess.canEditProcurement} /> : null}

          {tab === 'delivery' ? (
            <div style={{ display: 'grid', gap: '18px' }}>
              <InboundTab inboundLines={inboundLines} setInboundEditor={openInboundEditor} canEditDelivery={workspaceActionAccess.canEditDelivery} />
              <DeliveryTab deliveryLines={deliveryLines} setDeliveryEditor={openDeliveryEditor} canEditDelivery={workspaceActionAccess.canEditDelivery} />
            </div>
          ) : null}

          {tab === 'finance' ? <FinanceTab projectId={projectId} token={token} workspace={workspace} approvals={ensureArray(workspace?.approvals)} milestones={milestones} overdueDeliveryLines={overdueDeliveryLines} onChanged={() => void loadWorkspace()} canEditPricing={workspaceActionAccess.canEditPricing} /> : null}

          {tab === 'legal' ? <LegalTab workspace={workspace} approvals={ensureArray(workspace?.approvals)} contractAppendices={contractAppendices} setTab={setTab} /> : null}

          {tab === 'tasks' ? <ProjectTasksTab workspace={workspace} milestones={milestones} goToRoute={goToRoute} projectId={projectId} /> : null}

          {tab === 'timeline' ? <TimelineTab milestones={milestones} timeline={timeline} activityStream={activityStream} setMilestoneEditor={openMilestoneEditor} canEditTimeline={workspaceActionAccess.canEditTimeline} /> : null}

          {tab === 'documents' ? <DocumentsTab workspace={workspace} canEditDocuments={workspaceActionAccess.canReviewDocuments} reviewerRoleCodes={currentUser.roleCodes} openDocumentEditor={openDocumentEditor} openBlockerEditor={openBlockerEditor} openAuditItem={openAuditItem} onRunAction={runHeroAction} onOpenThread={openDocumentThread} onQuickReviewAction={quickReviewDocument} /> : null}
        </div>
      )}
      </div>
      {contractEditor ? <ContractEditorModal value={contractEditor} onChange={setContractEditor} onClose={() => setContractEditor(null)} onSave={saveMainContract} saving={busy === 'contract-save'} /> : null}
      {appendixEditor ? <ContractEditorModal value={appendixEditor} isAppendix onChange={setAppendixEditor} onClose={() => setAppendixEditor(null)} onSave={saveAppendix} saving={busy === 'appendix-save'} /> : null}
      {procurementEditor ? <ProcurementEditorModal value={procurementEditor} suppliers={supplierAccounts} onChange={setProcurementEditor} onClose={() => setProcurementEditor(null)} onSave={saveProcurement} saving={busy === 'procurement-save'} /> : null}
      {inboundEditor ? <MoveLineEditorModal value={inboundEditor} procurementLines={inboundEditorProcurementLines} onChange={setInboundEditor} onClose={() => setInboundEditor(null)} onSave={() => saveMoveLine('inbound')} saving={busy === 'inbound-save'} type="inbound" /> : null}
      {deliveryEditor ? <MoveLineEditorModal value={deliveryEditor} procurementLines={deliveryEditorProcurementLines} onChange={setDeliveryEditor} onClose={() => setDeliveryEditor(null)} onSave={() => saveMoveLine('delivery')} saving={busy === 'delivery-save'} type="delivery" /> : null}
      {milestoneEditor ? <MilestoneEditorModal value={milestoneEditor} onChange={setMilestoneEditor} onClose={() => setMilestoneEditor(null)} onSave={saveMilestone} saving={busy === 'milestone-save'} /> : null}
      {documentEditor ? <DocumentChecklistEditorModal value={documentEditor} onChange={setDocumentEditor} onClose={() => setDocumentEditor(null)} onSave={saveDocumentChecklist} saving={busy === 'document-save'} /> : null}
      {documentThread ? <DocumentThreadModal document={documentThread.document} threadSummary={documentThread.threadSummary} messages={documentThreadMessages} draft={documentThreadDraft} onDraftChange={setDocumentThreadDraft} onSend={sendDocumentThreadMessage} onClose={() => { setDocumentThread(null); setDocumentThreadMessages([]); setDocumentThreadDraft(''); }} saving={busy === 'document-thread-send'} /> : null}
      {blockerEditor ? <BlockerEditorModal value={blockerEditor} onChange={setBlockerEditor} onClose={() => setBlockerEditor(null)} onSave={saveBlocker} saving={busy === 'blocker-save'} /> : null}
      {auditTrailItem ? <AuditTrailDetailModal item={auditTrailItem} onClose={() => setAuditTrailItem(null)} /> : null}
    </Modal>
  );
}


