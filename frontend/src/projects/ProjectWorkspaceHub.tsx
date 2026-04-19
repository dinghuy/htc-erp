import { useEffect, useState } from 'preact/hooks';
import { buildRoleProfile, ROLE_LABELS, type CurrentUser } from '../auth';
import { requestJsonWithAuth, API_BASE } from '../shared/api/client';
import { getProjectWorkspaceTabsForRoles, type ProjectWorkspaceTabKey } from '../shared/domain/contracts';
import { showNotify } from '../Notification';
import { tokens } from '../ui/tokens';
import { ui } from '../ui/styles';
import { OverlayModal } from '../ui/OverlayModal';
import { setNavContext } from '../navContext';
import { projectStageLabel } from '../ops/workflowOptions';
import { QA_TEST_IDS, workspaceTabTestId } from '../testing/testIds';
import { ProjectWorkspaceModalHost } from './ProjectWorkspaceModalHost';
import { ProjectWorkspaceTabContent } from './ProjectWorkspaceTabContent';
import { buildWorkspaceActionAccess, buildWorkspacePreviewNotice } from './workspacePermissions';
import { buildWorkspaceHeroPlan } from './workspaceHeroActions';
import { mergeWorkspaceSummary } from './workspaceSummaryData';
import { collectProjectActivityStream } from './projectActivityStreamData';
import { createProjectWorkspaceAsyncActions } from './projectWorkspaceAsyncActions';
import { createProjectWorkspaceEditorHandlers } from './createProjectWorkspaceEditorHandlers';
import { buildProjectWorkspaceViewModel } from './projectWorkspaceViewModel';
import { useProjectWorkspaceUiController } from './useProjectWorkspaceUiController';
import { statusBadgeStyle, projectStageBadgeStyle, statusLabel } from './workspaceDisplayUtils';
import { WorkspaceHeroActionBar, HandoffActivationPanel, WorkflowGatesSection, PhaseControlSection } from './WorkspaceHubComponents';

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

function ensureArray<T = any>(value: any): T[] {
  return Array.isArray(value) ? value : [];
}


function Modal({ title, children, onClose }: any) {
  return (
    <OverlayModal title={title} onClose={onClose} maxWidth="1180px" contentPadding="28px" closeButtonTestId={QA_TEST_IDS.workspace.close}>
      {children}
    </OverlayModal>
  );
}

function KpiCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div style={{ ...ui.card.base, padding: '16px', border: `1px solid ${tokens.colors.border}` }}>
      <div style={{ fontSize: '12px', fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div style={{ marginTop: '10px', fontSize: '28px', fontWeight: 900, color: accent }}>
        {value}
      </div>
    </div>
  );
}

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
  const [activityStream, setActivityStream] = useState<any[]>([]);
  const [pendingOpenThreadIntent, setPendingOpenThreadIntent] = useState(openDocumentThreadOnMount);
  const uiController = useProjectWorkspaceUiController();

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
    setPendingOpenThreadIntent(openDocumentThreadOnMount);
  }, [openDocumentThreadOnMount, projectId]);

  useEffect(() => {
    if (!workspace || !pendingOpenThreadIntent) return;
    if (!focusDocumentId) {
      void openProjectThreadInTimeline();
      setPendingOpenThreadIntent(false);
      return;
    }
    const documents = ensureArray(workspace.documents);
    const target = documents.find((document: any) => document.id === focusDocumentId);
    if (!target) return;
    setTab('documents');
    void openDocumentThread(target);
    setPendingOpenThreadIntent(false);
  }, [workspace, focusDocumentId, pendingOpenThreadIntent]);

  useEffect(() => {
    if (!workspace || !pendingOpenThreadIntent || !focusDocumentId) return;
    const documents = ensureArray(workspace.documents);
    if (documents.some((document: any) => document.id === focusDocumentId)) return;
    setPendingOpenThreadIntent(false);
  }, [workspace, focusDocumentId, pendingOpenThreadIntent]);

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

  const {
    quotationVersions,
    qbuRounds,
    contractAppendices,
    executionBaselines,
    inboundLines,
    deliveryLines,
    milestones,
    timeline,
    currentBaseline,
    supplierAccounts,
    activeProcurementLines,
    historyProcurementLines,
    inboundEditorProcurementLines,
    deliveryEditorProcurementLines,
    shortageLines,
    overdueEtaLines,
    overdueDeliveryLines,
    unorderedLines,
    pendingMilestones,
    overviewAlerts,
    phaseReadiness,
    workHubSummaryKpis,
  } = buildProjectWorkspaceViewModel({
    workspace,
    accounts,
    inboundEditorProcurementLineId: uiController.inboundEditor?.procurementLineId,
    deliveryEditorProcurementLineId: uiController.deliveryEditor?.procurementLineId,
  });

  const denyWorkspaceAction = (message: string) => {
    showNotify(message, 'error');
  };

  const {
    createCommercialApproval,
    createSalesOrder,
    releaseSalesOrder,
    requestDeliveryCompletionApproval,
    finalizeDeliveryCompletion,
    openDocumentThread,
    openProjectThreadInTimeline,
    sendDocumentThreadMessage,
    sendProjectThreadMessage,
    runHeroAction,
    quickReviewDocument: performQuickReviewDocument,
  } = createProjectWorkspaceAsyncActions({
    token,
    projectId,
    currentUserId: currentUser.id,
    workspace,
    ui: uiController,
    setBusy,
    loadWorkspace,
    setTab,
    goToRoute,
  });

  const {
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
  } = createProjectWorkspaceEditorHandlers({
    token,
    projectId,
    workspace,
    ui: uiController,
    workspaceActionAccess,
    denyWorkspaceAction,
    setBusy,
    loadWorkspace,
    setTab,
    performQuickReviewDocument,
  });

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

          <ProjectWorkspaceTabContent
            tab={tab}
            currentBaseline={currentBaseline}
            executionBaselines={executionBaselines}
            activeProcurementLines={activeProcurementLines}
            shortageLines={shortageLines}
            overdueEtaLines={overdueEtaLines}
            overdueDeliveryLines={overdueDeliveryLines}
            unorderedLines={unorderedLines}
            overviewAlerts={overviewAlerts}
            pendingMilestones={pendingMilestones}
            milestones={milestones}
            workspace={workspace}
            projectId={projectId}
            goToRoute={goToRoute}
            setTab={setTab}
            quotationVersions={quotationVersions}
            qbuRounds={qbuRounds}
            contractAppendices={contractAppendices}
            openContractEditor={openContractEditor}
            openAppendixEditor={openAppendixEditor}
            workspaceActionAccess={workspaceActionAccess}
            historyProcurementLines={historyProcurementLines}
            openProcurementEditor={openProcurementEditor}
            openInboundFromProcurement={openInboundFromProcurement}
            openDeliveryFromProcurement={openDeliveryFromProcurement}
            inboundLines={inboundLines}
            openInboundEditor={openInboundEditor}
            deliveryLines={deliveryLines}
            openDeliveryEditor={openDeliveryEditor}
            token={token}
            approvals={ensureArray(workspace?.approvals)}
            openMilestoneEditor={openMilestoneEditor}
            timeline={timeline}
            activityStream={activityStream}
            reviewerRoleCodes={currentUser.roleCodes}
            openDocumentEditor={openDocumentEditor}
            openBlockerEditor={openBlockerEditor}
            openAuditItem={openAuditItem}
            runHeroAction={runHeroAction}
            openDocumentThread={openDocumentThread}
            quickReviewDocument={quickReviewDocument}
            loadWorkspace={loadWorkspace}
          />
        </div>
      )}
      </div>
      <ProjectWorkspaceModalHost
        ui={uiController}
        saveMainContract={saveMainContract}
        busy={busy}
        saveAppendix={saveAppendix}
        supplierAccounts={supplierAccounts}
        saveProcurement={saveProcurement}
        inboundEditorProcurementLines={inboundEditorProcurementLines}
        saveMoveLine={saveMoveLine}
        deliveryEditorProcurementLines={deliveryEditorProcurementLines}
        saveMilestone={saveMilestone}
        saveDocumentChecklist={saveDocumentChecklist}
        sendDocumentThreadMessage={sendDocumentThreadMessage}
        sendProjectThreadMessage={sendProjectThreadMessage}
        saveBlocker={saveBlocker}
      />
    </Modal>
  );
}


