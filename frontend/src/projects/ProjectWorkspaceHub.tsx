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
import { ProjectWorkspaceModalHost } from './ProjectWorkspaceModalHost';
import { buildWorkspaceActionAccess, buildWorkspacePreviewNotice } from './workspacePermissions';
import { buildWorkspaceHeroPlan } from './workspaceHeroActions';
import { buildWorkspacePhaseReadiness } from './workspacePhaseReadiness';
import { mergeWorkspaceSummary } from './workspaceSummaryData';
import { collectProjectActivityStream } from './projectActivityStreamData';
import {
  buildBlockerEditorState,
  buildDeliveryEditorState,
  buildDocumentChecklistEditorState,
  buildInboundEditorState,
} from './projectWorkspaceEditors';
import { createProjectWorkspaceAsyncActions } from './projectWorkspaceAsyncActions';
import { buildProjectWorkspaceViewModel } from './projectWorkspaceViewModel';
import { guardWorkspaceAction } from './workspaceGuardedActions';

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

function statusBadgeStyle(status?: string): any {
  const base = {
    padding: `${tokens.spacing.xs} ${tokens.spacing.md}`,
    borderRadius: tokens.radius.md,
    fontSize: '11px',
    fontWeight: 800,
    display: 'inline-block'
  };
  switch (status) {
    case 'active': return { ...base, background: tokens.colors.infoAccentBg, color: tokens.colors.primary };
    case 'completed':
    case 'signed':
    case 'effective': return { ...base, ...ui.badge.success };
    case 'paused':
    case 'partial': return { ...base, ...ui.badge.warning };
    case 'cancelled':
    case 'rejected': return { ...base, ...ui.badge.error };
    default: return { ...base, ...ui.badge.neutral };
  }
}

function projectStageBadgeStyle(stage?: string): any {
  const base = {
    padding: `${tokens.spacing.xs} ${tokens.spacing.md}`,
    borderRadius: tokens.radius.md,
    fontSize: '11px',
    fontWeight: 800,
    display: 'inline-block'
  };
  switch (stage) {
    case 'won': return { ...base, ...ui.badge.success };
    case 'lost': return { ...base, ...ui.badge.error };
    case 'delivery': return { ...base, background: tokens.colors.violetStrongBg, color: tokens.colors.violetStrongText };
    default: return { ...base, ...ui.badge.neutral };
  }
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

function statusLabel(status?: string | null) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'active') return 'Đang chạy';
  if (normalized === 'completed') return 'Hoàn tất';
  if (normalized === 'signed') return 'Đã ký';
  if (normalized === 'effective') return 'Hiệu lực';
  if (normalized === 'paused') return 'Tạm dừng';
  if (normalized === 'partial') return 'Một phần';
  if (normalized === 'cancelled') return 'Đã hủy';
  if (normalized === 'rejected') return 'Bị từ chối';
  if (normalized === 'pending') return 'Đang chờ';
  return status || 'Chưa cập nhật';
}


function WorkspaceHeroActionBar({
  plan,
  onRunAction,
}: {
  plan: ReturnType<typeof buildWorkspaceHeroPlan>;
  onRunAction: (action: string) => void;
}) {
  return (
    <div
      style={{
        ...ui.card.base,
        padding: '20px',
        display: 'grid',
        gap: '16px',
        border: `1px solid ${tokens.colors.border}`,
        background: tokens.surface.heroGradient,
      }}
    >
      <div style={{ display: 'grid', gap: '8px' }}>
        <div style={{ ...ui.badge.info, display: 'inline-flex', width: 'fit-content' }}>{plan.eyebrow}</div>
        <div style={{ fontSize: '22px', fontWeight: 900, color: tokens.colors.textPrimary }}>{plan.title}</div>
        <div style={{ fontSize: '13px', color: tokens.colors.textSecondary, lineHeight: 1.7, maxWidth: '72ch' }}>{plan.description}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
        {plan.actions.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onRunAction(item.action)}
            style={{
              ...ui.card.base,
              padding: '16px',
              display: 'grid',
              gap: '8px',
              textAlign: 'left',
              cursor: 'pointer',
              border: `1px solid ${tokens.colors.border}`,
              background: tokens.colors.surface,
            }}
          >
            <div>
              <span style={item.tone === 'primary' ? ui.badge.info : item.tone === 'secondary' ? ui.badge.warning : ui.badge.neutral}>
                {item.tone === 'primary' ? 'Ưu tiên chính' : item.tone === 'secondary' ? 'Bước kế tiếp' : 'Rà soát'}
              </span>
            </div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: tokens.colors.textPrimary }}>{item.label}</div>
            <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, lineHeight: 1.6 }}>{item.hint}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function GateStatusBadge({ status }: { status?: string | null }) {
  const normalized = String(status || 'not_requested').toLowerCase();
  if (normalized === 'pending') return <span style={ui.badge.warning}>đang chờ</span>;
  if (normalized === 'approved') return <span style={ui.badge.success}>đã duyệt</span>;
  if (normalized === 'changes_requested') return <span style={ui.badge.info}>cần chỉnh sửa</span>;
  if (normalized === 'rejected') return <span style={ui.badge.error}>bị từ chối</span>;
  return <span style={ui.badge.neutral}>chưa yêu cầu</span>;
}

function HandoffActivationPanel({ handoffActivation }: { handoffActivation?: any }) {
  if (!handoffActivation) return null;

  const status = String(handoffActivation.status || '').trim().toLowerCase();
  const badge =
    status === 'ready_to_create_sales_order'
      ? { label: 'Sẵn sàng tạo SO', style: ui.badge.info }
      : status === 'awaiting_release_approval'
        ? { label: 'Chờ duyệt release', style: ui.badge.warning }
        : status === 'ready_to_release'
          ? { label: 'Sẵn sàng release', style: ui.badge.success }
          : status === 'activated'
            ? { label: 'Handoff đã kích hoạt', style: ui.badge.success }
            : { label: 'Handoff bị chặn', style: ui.badge.error };
  const blockers = Array.isArray(handoffActivation.blockers) ? handoffActivation.blockers.filter(Boolean) : [];

  return (
    <div style={{ ...ui.card.base, padding: '18px', display: 'grid', gap: '10px', border: `1px solid ${tokens.colors.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Trạng thái handoff
          </div>
          <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, marginTop: '4px' }}>
            Một nguồn sự thật cho bước kế tiếp từ báo giá thắng sang execution.
          </div>
        </div>
        <span style={badge.style}>{badge.label}</span>
      </div>
      <div style={{ fontSize: '14px', fontWeight: 800, color: tokens.colors.textPrimary }}>
        {handoffActivation.nextActionLabel || 'Rà trạng thái handoff'}
      </div>
      {blockers.length ? (
        <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, lineHeight: 1.6 }}>
          {blockers[0]}
        </div>
      ) : null}
    </div>
  );
}

function WorkflowGatesSection({
  gateStates,
  actionAvailability,
  busy,
  onRequestCommercialApproval,
  onCreateSalesOrder,
  onReleaseSalesOrder,
  onRequestDeliveryCompletionApproval,
  onFinalizeDeliveryCompletion,
  onOpenApprovals,
}: any) {
  const gates = Array.isArray(gateStates) ? gateStates : [];
  if (!gates.length) return null;

  return (
    <div style={{ ...ui.card.base, padding: '18px', display: 'grid', gap: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Cổng quy trình</div>
          <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, marginTop: '4px' }}>Hiển thị người duyệt đang chờ và các hành động mà backend hiện cho phép thực hiện.</div>
        </div>
        <button type="button" onClick={onOpenApprovals} style={S.btnOutline}>Mở phê duyệt</button>
      </div>
      <div style={{ display: 'grid', gap: '10px' }}>
        {gates.map((gate: any) => {
          const pendingApprovers = Array.isArray(gate.pendingApprovers) ? gate.pendingApprovers : [];
          const blockers = Array.isArray(gate.actionAvailability?.blockers) ? gate.actionAvailability.blockers : [];

          return (
            <div key={gate.gateType} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '14px', display: 'grid', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{gate.title}</div>
                  <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, marginTop: '4px' }}>
                    {gate.pendingCount ? `${gate.pendingCount} người duyệt đang chờ` : 'Không có người duyệt nào đang chờ'}
                  </div>
                </div>
                <GateStatusBadge status={gate.status} />
              </div>
              {pendingApprovers.length ? (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {pendingApprovers.map((approver: any) => (
                    <span key={`${gate.gateType}-${approver.approvalId}`} style={approver.actionAvailability?.canDecide ? ui.badge.success : ui.badge.info}>
                      {approver.approverName || approver.approverRole || 'Người duyệt đang chờ'}
                    </span>
                  ))}
                </div>
              ) : null}
              {blockers.length ? (
                <div style={{ display: 'grid', gap: '4px' }}>
                  {blockers.map((blocker: string, index: number) => (
                    <div key={`${gate.gateType}-blocker-${index}`} style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>
                      {blocker}
                    </div>
                  ))}
                </div>
              ) : null}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {gate.gateType === 'quotation_commercial' && actionAvailability?.quotation?.canRequestCommercialApproval ? (
                  <button type="button" onClick={onRequestCommercialApproval} style={S.btnPrimary} disabled={busy === 'request-commercial-approval'}>
                    {busy === 'request-commercial-approval' ? 'Đang tạo...' : 'Tạo phê duyệt thương mại'}
                  </button>
                ) : null}
                {gate.gateType === 'sales_order_release' && actionAvailability?.quotation?.canCreateSalesOrder ? (
                  <button type="button" onClick={onCreateSalesOrder} style={S.btnOutline} disabled={busy === 'create-sales-order'}>
                    {busy === 'create-sales-order' ? 'Đang tạo...' : 'Tạo sales order'}
                  </button>
                ) : null}
                {gate.gateType === 'sales_order_release' && actionAvailability?.salesOrder?.canReleaseLatest ? (
                  <button type="button" onClick={onReleaseSalesOrder} style={S.btnPrimary} disabled={busy === 'release-sales-order'}>
                    {busy === 'release-sales-order' ? 'Đang phát hành...' : 'Phát hành sales order'}
                  </button>
                ) : null}
                {gate.gateType === 'delivery_completion' && actionAvailability?.project?.canRequestDeliveryCompletionApproval ? (
                  <button type="button" onClick={onRequestDeliveryCompletionApproval} style={S.btnOutline} disabled={busy === 'request-delivery-completion'}>
                    {busy === 'request-delivery-completion' ? 'Đang tạo...' : 'Tạo phê duyệt hoàn tất'}
                  </button>
                ) : null}
                {gate.gateType === 'delivery_completion' && actionAvailability?.project?.canFinalizeDeliveryCompletion ? (
                  <button type="button" onClick={onFinalizeDeliveryCompletion} style={S.btnPrimary} disabled={busy === 'finalize-delivery-completion'}>
                    {busy === 'finalize-delivery-completion' ? 'Đang hoàn tất...' : 'Chốt hoàn tất giao hàng'}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PhaseControlSection({
  readiness,
  onRunAction,
}: {
  readiness: ReturnType<typeof buildWorkspacePhaseReadiness>;
  onRunAction: (action: string) => void;
}) {
  const resolvedStageLabel = projectStageLabel(readiness.stageLabel) || readiness.stageLabel;
  return (
    <div style={{ ...ui.card.base, padding: '18px', display: 'grid', gap: '16px', border: `1px solid ${tokens.colors.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ display: 'grid', gap: '6px' }}>
          <div style={{ ...ui.badge.info, display: 'inline-flex', width: 'fit-content' }}>Kiểm soát giai đoạn</div>
          <div style={{ fontSize: '18px', fontWeight: 900, color: tokens.colors.textPrimary }}>
            {resolvedStageLabel} {'->'} {readiness.nextStepLabel}
          </div>
          <div style={{ fontSize: '13px', color: tokens.colors.textSecondary, lineHeight: 1.7, maxWidth: '78ch' }}>
            {readiness.summary}
          </div>
        </div>
        <div style={{ minWidth: 0, width: '100%', maxWidth: '220px', border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '14px 16px', background: tokens.colors.background }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Điểm sẵn sàng</div>
          <div style={{ marginTop: '8px', fontSize: '28px', fontWeight: 900, color: readiness.readinessTone === 'good' ? tokens.colors.success : readiness.readinessTone === 'warn' ? tokens.colors.warning : tokens.colors.error }}>
            {readiness.readinessScore}%
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
        {readiness.items.map((item) => (
          <div key={item.id} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '14px', display: 'grid', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{item.label}</div>
              <span style={item.status === 'ready' ? ui.badge.success : item.status === 'warning' ? ui.badge.warning : ui.badge.error}>
                {item.status === 'ready' ? 'sẵn sàng' : item.status === 'warning' ? 'cảnh báo' : 'bị chặn'}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, lineHeight: 1.6 }}>{item.detail}</div>
            {item.action ? (
              <button type="button" onClick={() => onRunAction(item.action as string)} style={{ ...S.btnOutline, justifyContent: 'flex-start', padding: '8px 10px' }}>
                Mở bề mặt liên quan
              </button>
            ) : null}
          </div>
        ))}
      </div>

      {readiness.blockers.length ? (
        <div style={{ display: 'grid', gap: '10px' }}>
          <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Điểm nghẽn hiện tại
          </div>
          <div style={{ display: 'grid', gap: '10px' }}>
            {readiness.blockers.map((blocker) => (
              <div key={blocker.id} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center', background: blocker.tone === 'danger' ? tokens.colors.badgeBgError : tokens.colors.warningTint }}>
                <div style={{ display: 'grid', gap: '4px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{blocker.title}</div>
                  <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, lineHeight: 1.6 }}>{blocker.detail}</div>
                </div>
                {blocker.action ? (
                  <button type="button" onClick={() => onRunAction(blocker.action as string)} style={{ ...S.btnOutline }}>
                    Xử lý ngay
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
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
    inboundEditorProcurementLineId: inboundEditor?.procurementLineId,
    deliveryEditorProcurementLineId: deliveryEditor?.procurementLineId,
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
    sendDocumentThreadMessage,
    runHeroAction,
    quickReviewDocument: performQuickReviewDocument,
  } = createProjectWorkspaceAsyncActions({
    token,
    projectId,
    currentUserId: currentUser.id,
    workspace,
    documentThread,
    documentThreadDraft,
    setBusy,
    loadWorkspace,
    setDocumentThread,
    setDocumentThreadMessages,
    setDocumentThreadDraft,
    setTab,
    goToRoute,
  });

  const openContractEditor = guardWorkspaceAction({
    allowed: workspaceActionAccess.canEditCommercial,
    deniedMessage: 'Vai trò hiện tại chỉ được xem không gian thương mại',
    onDenied: denyWorkspaceAction,
    action: setContractEditor,
  });

  const openAppendixEditor = guardWorkspaceAction({
    allowed: workspaceActionAccess.canEditCommercial,
    deniedMessage: 'Vai trò hiện tại chỉ được xem không gian thương mại',
    onDenied: denyWorkspaceAction,
    action: setAppendixEditor,
  });

  const openProcurementEditor = guardWorkspaceAction({
    allowed: workspaceActionAccess.canEditProcurement,
    deniedMessage: 'Vai trò hiện tại không được cập nhật không gian mua hàng',
    onDenied: denyWorkspaceAction,
    action: setProcurementEditor,
  });

  const openInboundEditor = guardWorkspaceAction({
    allowed: workspaceActionAccess.canEditDelivery,
    deniedMessage: 'Vai trò hiện tại không được cập nhật không gian giao hàng',
    onDenied: denyWorkspaceAction,
    action: setInboundEditor,
  });

  const openDeliveryEditor = guardWorkspaceAction({
    allowed: workspaceActionAccess.canEditDelivery,
    deniedMessage: 'Vai trò hiện tại không được cập nhật không gian giao hàng',
    onDenied: denyWorkspaceAction,
    action: setDeliveryEditor,
  });

  const openMilestoneEditor = guardWorkspaceAction({
    allowed: workspaceActionAccess.canEditTimeline,
    deniedMessage: 'Vai trò hiện tại không được cập nhật timeline của dự án',
    onDenied: denyWorkspaceAction,
    action: setMilestoneEditor,
  });

  const openDocumentEditor = guardWorkspaceAction({
    allowed: workspaceActionAccess.canReviewDocuments,
    deniedMessage: 'Vai trò hiện tại chỉ được xem checklist hồ sơ',
    onDenied: denyWorkspaceAction,
    action: (value: any) => setDocumentEditor(buildDocumentChecklistEditorState(value, workspace?.projectStage)),
  });

  const openBlockerEditor = guardWorkspaceAction({
    allowed: workspaceActionAccess.canReviewDocuments,
    deniedMessage: 'Vai trò hiện tại chỉ được xem blocker register',
    onDenied: denyWorkspaceAction,
    action: (value: any) => setBlockerEditor(buildBlockerEditorState(value)),
  });

  const openAuditItem = (value: any) => {
    setAuditTrailItem(value);
  };

  const openInboundFromProcurement = guardWorkspaceAction({
    allowed: workspaceActionAccess.canEditDelivery,
    deniedMessage: 'Vai trò hiện tại không được cập nhật không gian giao hàng',
    onDenied: denyWorkspaceAction,
    action: (line: any) => setInboundEditor(buildInboundEditorState(line)),
  });

  const openDeliveryFromProcurement = guardWorkspaceAction({
    allowed: workspaceActionAccess.canEditDelivery,
    deniedMessage: 'Vai trò hiện tại không được cập nhật không gian giao hàng',
    onDenied: denyWorkspaceAction,
    action: (line: any) => setDeliveryEditor(buildDeliveryEditorState(line)),
  });

  const saveMainContract = guardWorkspaceAction({
    allowed: workspaceActionAccess.canEditCommercial,
    deniedMessage: 'Vai trò hiện tại chỉ được xem không gian thương mại',
    onDenied: denyWorkspaceAction,
    action: async () => {
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
    },
  });

  const saveAppendix = guardWorkspaceAction({
    allowed: workspaceActionAccess.canEditCommercial,
    deniedMessage: 'Vai trò hiện tại chỉ được xem không gian thương mại',
    onDenied: denyWorkspaceAction,
    action: async () => {
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
    },
  });

  const saveProcurement = guardWorkspaceAction({
    allowed: workspaceActionAccess.canEditProcurement,
    deniedMessage: 'Vai trò hiện tại không được cập nhật không gian mua hàng',
    onDenied: denyWorkspaceAction,
    action: async () => {
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
    },
  });

  const saveMoveLine = guardWorkspaceAction({
    allowed: workspaceActionAccess.canEditDelivery,
    deniedMessage: 'Vai trò hiện tại không được cập nhật không gian giao hàng',
    onDenied: denyWorkspaceAction,
    action: async (type: 'inbound' | 'delivery') => {
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
    },
  });

  const saveMilestone = guardWorkspaceAction({
    allowed: workspaceActionAccess.canEditTimeline,
    deniedMessage: 'Vai trò hiện tại không được cập nhật timeline của dự án',
    onDenied: denyWorkspaceAction,
    action: async () => {
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
    },
  });

  const saveDocumentChecklist = guardWorkspaceAction({
    allowed: workspaceActionAccess.canReviewDocuments,
    deniedMessage: 'Vai trò hiện tại chỉ được xem checklist hồ sơ',
    onDenied: denyWorkspaceAction,
    action: async () => {
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
    },
  });

  const saveBlocker = guardWorkspaceAction({
    allowed: workspaceActionAccess.canReviewDocuments,
    deniedMessage: 'Vai trò hiện tại chỉ được xem blocker register',
    onDenied: denyWorkspaceAction,
    action: async () => {
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
    },
  });

  const quickReviewDocument = guardWorkspaceAction({
    allowed: workspaceActionAccess.canReviewDocuments,
    deniedMessage: 'Vai trò hiện tại chỉ được xem checklist hồ sơ',
    onDenied: denyWorkspaceAction,
    action: performQuickReviewDocument,
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
      <ProjectWorkspaceModalHost
        contractEditor={contractEditor}
        setContractEditor={setContractEditor}
        saveMainContract={saveMainContract}
        busy={busy}
        appendixEditor={appendixEditor}
        setAppendixEditor={setAppendixEditor}
        saveAppendix={saveAppendix}
        procurementEditor={procurementEditor}
        setProcurementEditor={setProcurementEditor}
        supplierAccounts={supplierAccounts}
        saveProcurement={saveProcurement}
        inboundEditor={inboundEditor}
        setInboundEditor={setInboundEditor}
        inboundEditorProcurementLines={inboundEditorProcurementLines}
        saveMoveLine={saveMoveLine}
        deliveryEditor={deliveryEditor}
        setDeliveryEditor={setDeliveryEditor}
        deliveryEditorProcurementLines={deliveryEditorProcurementLines}
        milestoneEditor={milestoneEditor}
        setMilestoneEditor={setMilestoneEditor}
        saveMilestone={saveMilestone}
        documentEditor={documentEditor}
        setDocumentEditor={setDocumentEditor}
        saveDocumentChecklist={saveDocumentChecklist}
        documentThread={documentThread}
        documentThreadMessages={documentThreadMessages}
        documentThreadDraft={documentThreadDraft}
        setDocumentThreadDraft={setDocumentThreadDraft}
        sendDocumentThreadMessage={sendDocumentThreadMessage}
        setDocumentThread={setDocumentThread}
        setDocumentThreadMessages={setDocumentThreadMessages}
        blockerEditor={blockerEditor}
        setBlockerEditor={setBlockerEditor}
        saveBlocker={saveBlocker}
        auditTrailItem={auditTrailItem}
        setAuditTrailItem={setAuditTrailItem}
      />
    </Modal>
  );
}


