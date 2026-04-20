import { useEffect, useState } from 'preact/hooks';
import { buildRoleProfile, type CurrentUser } from './auth';
import { mapApprovalQueuePayload } from './approvalQueueData';
import { API_BASE } from './config';
import { consumeNavContext, setNavContext } from './navContext';
import { buildDocumentThreadSummary } from './projects/documentThreadData';
import { createIdempotencyKey, requestJsonWithAuth, withIdempotencyKey } from './shared/api/client';
import { canApproveRequest, resolveApprovalLane } from './shared/domain/contracts';
import { QA_TEST_IDS, approvalActionButtonTestId, approvalCardTestId, approvalLaneButtonTestId } from './testing/testIds';
import { buildThreadCountIndex } from './threadIndexData';
import { showNotify } from './Notification';
import { OverlayModal } from './ui/OverlayModal';
import { tokens } from './ui/tokens';
import { ui } from './ui/styles';
import { buildApprovalsActions } from './work/phaseDrivenActions';

type ApprovalRecord = {
  id: string;
  title: string;
  requestType: string;
  status: string;
  note?: string | null;
  dueDate?: string | null;
  projectCode?: string | null;
  projectName?: string | null;
  requestedByName?: string | null;
  requestedBy?: string | null;
  department?: string | null;
  approverRole?: string | null;
  approverUserId?: string | null;
  actionAvailability?: {
    lane?: string | null;
    canDecide?: boolean;
    isRequester?: boolean;
    isAssignedApprover?: boolean;
    availableDecisions?: string[];
  } | null;
};

type ApprovalsPayload = {
  persona?: {
    primaryRole?: string;
    roleCodes?: string[];
    mode?: string;
  };
  summary?: {
    totalCount?: number;
    pendingCount?: number;
    executiveCount?: number;
    financeCount?: number;
    legalCount?: number;
    procurementCount?: number;
  };
  view?: {
    title?: string;
    description?: string;
  };
  cards?: Array<{
    label: string;
    value: number;
    tone?: 'good' | 'warn' | 'bad' | 'info';
  }>;
  approvals?: ApprovalRecord[];
};

const API = API_BASE;

function ActionBar({
  actions,
  onRunAction,
}: {
  actions: ReturnType<typeof buildApprovalsActions>;
  onRunAction: (index: number) => void;
}) {
  return (
    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
      {actions.map((action, index) => (
        <button
          key={`${action.route}-${action.label}`}
          type="button"
          onClick={() => onRunAction(index)}
          style={{
            ...ui.card.base,
            padding: '18px',
            display: 'grid',
            gap: '8px',
            textAlign: 'left',
            cursor: 'pointer',
            border: `1px solid ${tokens.colors.border}`,
            background: tokens.colors.surface,
          }}
        >
          <div>
            <span style={action.tone === 'primary' ? ui.badge.info : action.tone === 'secondary' ? ui.badge.warning : ui.badge.neutral}>
              {action.tone === 'primary' ? 'Primary action' : action.tone === 'secondary' ? 'Next step' : 'Watchlist'}
            </span>
          </div>
          <div style={{ fontSize: '15px', fontWeight: 800, color: tokens.colors.textPrimary }}>{action.label}</div>
          <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, lineHeight: 1.6 }}>{action.hint}</div>
        </button>
      ))}
    </section>
  );
}

export function Approvals({
  currentUser,
  onNavigate,
}: {
  currentUser: CurrentUser;
  onNavigate?: (route: string) => void;
}) {
  const profile = buildRoleProfile(currentUser.roleCodes, currentUser.systemRole);
  const [payload, setPayload] = useState<ApprovalsPayload | null>(null);
  const [approvals, setApprovals] = useState<ApprovalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [laneFilter, setLaneFilter] = useState<string>('');
  const [approvalThreadIndex, setApprovalThreadIndex] = useState<Record<string, { threadId: string | null; messageCount: number }>>({});
  const [approvalThread, setApprovalThread] = useState<any | null>(null);
  const [approvalThreadMessages, setApprovalThreadMessages] = useState<any[]>([]);
  const [approvalThreadDraft, setApprovalThreadDraft] = useState('');
  const [sendingThread, setSendingThread] = useState(false);
  const [pendingOpenApprovalId, setPendingOpenApprovalId] = useState<string | null>(null);

  const copyByMode: Record<string, { title: string; description: string }> = {
    sales: {
      title: 'Commercial Approvals',
      description: 'Theo dõi yêu cầu commercial và handoff đang chờ phản hồi từ các phòng ban liên quan.',
    },
    project_manager: {
      title: 'Commercial + Execution Approvals',
      description: 'Một queue duy nhất để theo dõi commercial handoff, project blockers và các phê duyệt ảnh hưởng tới margin hoặc tiến độ.',
    },
    procurement: {
      title: 'Procurement Approvals',
      description: 'Ưu tiên supplier selection, PO approvals và các exception làm trễ ETA hoặc delivery.',
    },
    accounting: {
      title: 'Finance Approvals',
      description: 'Xử lý payment milestone, invoice/deposit release và các approval tài chính đang chờ quyết định.',
    },
    legal: {
      title: 'Legal Approvals',
      description: 'Tập trung contract review, deviation và các hồ sơ pháp lý cần approve hoặc trả lại với comment.',
    },
    director: {
      title: 'Executive Approvals',
      description: 'Cockpit quyết định cho margin exception, dự án at-risk và các request vượt ngưỡng phê duyệt điều hành.',
    },
    admin: {
      title: 'Approval Oversight',
      description: 'Admin theo dõi toàn cục và hỗ trợ workflow, nhưng không mặc định là approver nghiệp vụ nếu chưa có role business tương ứng.',
    },
    viewer: {
      title: 'Approval Watchlist',
      description: 'Theo dõi approvals liên quan trong chế độ read-only.',
    },
  };

  const pageCopy = payload?.view || copyByMode[profile.personaMode] || copyByMode.viewer;

  const load = async () => {
    setLoading(true);
    try {
      const queueData = await requestJsonWithAuth<any>(
        currentUser.token,
        `${API}/v1/approvals/queue`,
        {},
        'Không thể tải approvals',
      );
      const data = mapApprovalQueuePayload(queueData, copyByMode[profile.personaMode] || copyByMode.viewer);
      setPayload(data);
      setApprovals(Array.isArray(data.approvals) ? data.approvals : []);
      const threadPayload = await requestJsonWithAuth<any>(
        currentUser.token,
        `${API}/v1/threads?entityType=ApprovalRequest&limit=200`,
        {},
        'Không thể tải thread index approvals',
      ).catch(() => ({ items: [] }));
      setApprovalThreadIndex(buildThreadCountIndex(threadPayload));
      setError('');
    } catch (_err) {
      try {
        const data = await requestJsonWithAuth<ApprovalsPayload>(
          currentUser.token,
          `${API}/workspace/approvals`,
          {},
          'Không thể tải approvals',
        );
        setPayload(data);
        setApprovals(Array.isArray(data.approvals) ? data.approvals : []);
        setApprovalThreadIndex({});
        setError('');
      } catch (fallbackError) {
        setError(fallbackError instanceof Error ? fallbackError.message : 'Không thể tải approvals');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const navContext = consumeNavContext('Approvals');
    if (navContext && typeof navContext.filters?.approvalLane === 'string') {
      setLaneFilter(navContext.filters.approvalLane);
    }
    if (navContext?.filters?.approvalId && navContext?.filters?.openThread) {
      setPendingOpenApprovalId(navContext.filters.approvalId);
    }
    void load();
  }, [currentUser.token]);

  const filteredApprovals = laneFilter
    ? approvals.filter((approval) => resolveApprovalLane(approval) === laneFilter)
    : approvals;
  const laneOptions = ['commercial', 'procurement', 'finance', 'legal', 'executive'];
  const phaseActions = buildApprovalsActions(profile.personaMode, laneFilter, payload?.summary);

  useEffect(() => {
    if (!pendingOpenApprovalId || loading) return;
    const target = approvals.find((approval) => approval.id === pendingOpenApprovalId);
    if (!target) return;
    void openApprovalThread(target);
    setPendingOpenApprovalId(null);
  }, [pendingOpenApprovalId, loading, approvals]);

  const decide = async (approvalId: string, decision: 'approved' | 'rejected' | 'changes_requested') => {
    setBusyId(approvalId);
    const idempotencyKey = createIdempotencyKey(`approval-decision:${approvalId}:${decision}`);
    try {
      await requestJsonWithAuth(
        currentUser.token,
        `${API}/v1/approvals/${approvalId}/decision`,
        withIdempotencyKey({
          method: 'POST',
          body: JSON.stringify({ decision }),
        }, idempotencyKey),
        'Không thể cập nhật approval',
      );
      showNotify(
        decision === 'approved'
          ? 'Đã duyệt approval'
          : decision === 'changes_requested'
            ? 'Đã yêu cầu chỉnh sửa approval'
            : 'Đã từ chối approval',
        'success',
      );
      await load();
    } catch (err: any) {
      showNotify(err?.message || 'Không thể cập nhật approval', 'error');
    } finally {
      setBusyId('');
    }
  };

  const openApprovalThread = async (approval: ApprovalRecord) => {
    try {
      const threadPayload = await requestJsonWithAuth<any>(
        currentUser.token,
        `${API}/v1/threads?entityType=ApprovalRequest&entityId=${approval.id}`,
        {},
        'Không thể tải thread approval',
      );
      const threadId = threadPayload?.items?.[0]?.id;
      const messagesPayload = threadId
        ? await requestJsonWithAuth<any>(currentUser.token, `${API}/v1/threads/${threadId}/messages`, {}, 'Không thể tải messages approval')
        : { items: [] };

      setApprovalThread({
        approval,
        threadSummary: buildDocumentThreadSummary({ threadPayload, messagesPayload }),
      });
      setApprovalThreadMessages(Array.isArray(messagesPayload?.items) ? messagesPayload.items : []);
      setApprovalThreadDraft('');
    } catch (error: any) {
      showNotify(error?.message || 'Không thể tải thread approval', 'error');
    }
  };

  const sendApprovalThreadMessage = async () => {
    const approval = approvalThread?.approval;
    const content = String(approvalThreadDraft || '').trim();
    if (!approval?.id || !content) return;

    setSendingThread(true);
    try {
      let threadId = approvalThread.threadSummary?.threadId;
      if (!threadId) {
        const createdThread = await requestJsonWithAuth<any>(
          currentUser.token,
          `${API}/v1/threads`,
          {
            method: 'POST',
            body: JSON.stringify({
              entityType: 'ApprovalRequest',
              entityId: approval.id,
              title: approval.title || approval.requestType || 'Approval thread',
            }),
          },
          'Không thể tạo thread approval',
        );
        threadId = createdThread.id;
      }

      await requestJsonWithAuth<any>(
        currentUser.token,
        `${API}/v1/threads/${threadId}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({ content }),
        },
        'Không thể gửi message approval',
      );

      await openApprovalThread(approval);
    } catch (error: any) {
      showNotify(error?.message || 'Không thể gửi message approval', 'error');
    } finally {
      setSendingThread(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: '22px' }}>
      <section style={{ ...ui.card.base, padding: '24px', display: 'grid', gap: '8px' }}>
        <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 900, color: tokens.colors.textPrimary }}>{pageCopy.title}</h1>
        <p style={{ margin: 0, fontSize: '14px', color: tokens.colors.textSecondary }}>
          {pageCopy.description}
        </p>
        {laneFilter ? (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span data-testid={QA_TEST_IDS.approvals.focusBadge} style={ui.badge.warning}>QA focus lane: {laneFilter}</span>
            <span style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>
              Filter này chỉ đổi góc nhìn kiểm thử, không cấp thêm quyền approve cho admin.
            </span>
          </div>
        ) : null}
      </section>

      <ActionBar
        actions={phaseActions}
        onRunAction={(index) => {
          const action = phaseActions[index];
          if (!action?.route) return;
          if (action.navContext) {
            setNavContext(action.navContext);
          }
          if (action.route === 'Approvals' && action.navContext?.filters?.approvalLane) {
            setLaneFilter(action.navContext.filters.approvalLane);
            return;
          }
          onNavigate?.(action.route);
        }}
      />

      {Array.isArray(payload?.cards) && payload.cards.length ? (
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          {payload.cards.map((card) => (
            <div key={card.label} style={{ ...ui.card.base, padding: '18px', display: 'grid', gap: '8px' }}>
              <span style={card.tone === 'good' ? ui.badge.success : card.tone === 'warn' ? ui.badge.warning : card.tone === 'bad' ? ui.badge.error : ui.badge.info}>{card.label}</span>
              <strong style={{ fontSize: '28px', color: tokens.colors.textPrimary }}>{loading ? '…' : card.value}</strong>
            </div>
          ))}
        </section>
      ) : null}

      {error ? <div style={{ ...ui.card.base, padding: '16px', color: tokens.colors.error }}>{error}</div> : null}

      <section style={{ ...ui.card.base, padding: '22px', display: 'grid', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button" data-testid={approvalLaneButtonTestId('all')} onClick={() => setLaneFilter('')} style={(laneFilter ? ui.btn.outline : ui.btn.primary) as any}>All lanes</button>
          {laneOptions.map((lane) => (
            <button key={lane} type="button" data-testid={approvalLaneButtonTestId(lane)} onClick={() => setLaneFilter(lane)} style={(laneFilter === lane ? ui.btn.primary : ui.btn.outline) as any}>
              {lane}
            </button>
          ))}
        </div>
        {loading ? <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Đang tải approvals...</div> : filteredApprovals.length ? (
          <div data-testid={QA_TEST_IDS.approvals.listSection} style={{ display: 'grid', gap: '10px' }}>{filteredApprovals.map((approval) => {
            const lane = approval.actionAvailability?.lane || resolveApprovalLane(approval);
            const isOwner = !approval.approverUserId || approval.approverUserId === currentUser.id;
            const canApprove = (
              approval.actionAvailability?.canDecide ?? (
                approval.status === 'pending'
                && isOwner
                && canApproveRequest(currentUser.roleCodes, approval, currentUser.systemRole, currentUser.id)
              )
            );
            const availableDecisionsFromPayload = Array.isArray(approval.actionAvailability?.availableDecisions)
              ? approval.actionAvailability?.availableDecisions
              : [];
            const availableDecisions = availableDecisionsFromPayload.length > 0
              ? availableDecisionsFromPayload
              : (canApprove ? ['rejected', 'changes_requested', 'approved'] : []);

            return (
              <div key={approval.id} data-testid={approvalCardTestId(approval.id)} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '14px', display: 'grid', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{approval.title}</div>
                    <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, marginTop: '4px' }}>
                      {approval.projectCode ? `${approval.projectCode} · ` : ''}{approval.projectName || 'No project'} · {approval.requestType}
                    </div>
                  </div>
                  <span style={
                    approval.status === 'pending'
                      ? ui.badge.warning
                      : approval.status === 'approved'
                        ? ui.badge.success
                        : approval.status === 'changes_requested'
                          ? ui.badge.info
                          : ui.badge.error
                  }>
                    {approval.status}
                  </span>
                </div>
                {approval.note ? <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>{approval.note}</div> : null}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={ui.badge.neutral}>Lane {lane}</span>
                    {approval.department ? <span style={ui.badge.info}>{approval.department}</span> : null}
                    {approval.requestedByName ? <span style={ui.badge.info}>From {approval.requestedByName}</span> : null}
                    {approval.dueDate ? <span style={ui.badge.neutral}>Due {String(approval.dueDate).slice(0, 10)}</span> : null}
                    {approvalThreadIndex[approval.id]?.messageCount > 0 ? <span style={ui.badge.info}>{approvalThreadIndex[approval.id].messageCount} thread msg</span> : null}
                    <button type="button" style={ui.btn.outline as any} onClick={() => void openApprovalThread(approval)}>
                      {approvalThreadIndex[approval.id]?.threadId ? 'Open thread' : 'Create thread'}
                    </button>
                  </div>
                  {approval.status === 'pending' ? (
                    canApprove ? (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {availableDecisions.includes('rejected') ? (
                          <button type="button" data-testid={approvalActionButtonTestId(approval.id, 'reject')} style={ui.btn.outline as any} disabled={busyId === approval.id} onClick={() => decide(approval.id, 'rejected')}>
                            Reject
                          </button>
                        ) : null}
                        {availableDecisions.includes('changes_requested') ? (
                          <button type="button" data-testid={approvalActionButtonTestId(approval.id, 'changes_requested')} style={ui.btn.outline as any} disabled={busyId === approval.id} onClick={() => decide(approval.id, 'changes_requested')}>
                            Request changes
                          </button>
                        ) : null}
                        {availableDecisions.includes('approved') ? (
                          <button type="button" data-testid={approvalActionButtonTestId(approval.id, 'approve')} style={ui.btn.primary as any} disabled={busyId === approval.id} onClick={() => decide(approval.id, 'approved')}>
                            Approve
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <span style={ui.badge.neutral}>
                        {approval.actionAvailability?.isRequester || approval.requestedBy === currentUser.id ? 'Không thể tự duyệt request của chính mình' : isOwner ? 'Read only' : 'Assigned approver khác'}
                      </span>
                    )
                  ) : null}
                </div>
              </div>
            );
          })}</div>
        ) : <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Không có approval nào trong queue hoặc lane đang lọc.</div>}
      </section>

      {approvalThread ? (
        <OverlayModal
          title={`Approval thread: ${approvalThread.approval?.title || approvalThread.approval?.requestType || approvalThread.approval?.id}`}
          onClose={() => {
            setApprovalThread(null);
            setApprovalThreadMessages([]);
            setApprovalThreadDraft('');
          }}
          maxWidth="900px"
        >
          <div style={{ display: 'grid', gap: '14px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span style={ui.badge.neutral}>Lane {approvalThread.approval?.actionAvailability?.lane || resolveApprovalLane(approvalThread.approval)}</span>
              <span style={approvalThread.threadSummary?.hasActiveThread ? ui.badge.info : ui.badge.warning}>
                {approvalThread.threadSummary?.hasActiveThread ? 'Thread active' : 'Chưa có thread'}
              </span>
              <span style={ui.badge.neutral}>{approvalThread.threadSummary?.messageCount || 0} messages</span>
            </div>
            <div style={{ display: 'grid', gap: '10px', maxHeight: '320px', overflowY: 'auto' }}>
              {approvalThreadMessages.length > 0 ? approvalThreadMessages.map((message: any) => (
                <div key={message.id} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px', display: 'grid', gap: '6px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: tokens.colors.textPrimary }}>
                    {message.authorName || message.authorUserId || 'System'}
                  </div>
                  <div style={{ fontSize: '13px', color: tokens.colors.textSecondary, lineHeight: 1.6 }}>
                    {message.content}
                  </div>
                </div>
              )) : (
                <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Chưa có tin nhắn nào trong approval thread này.</div>
              )}
            </div>
            <div style={{ display: 'grid', gap: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 800, color: tokens.colors.textMuted }}>TIN NHẮN MỚI</label>
              <textarea
                rows={4}
                style={{ ...ui.input.base, resize: 'vertical', fontFamily: 'inherit' }}
                value={approvalThreadDraft}
                onInput={(event: any) => setApprovalThreadDraft(event.target.value)}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                style={ui.btn.outline as any}
                onClick={() => {
                  setApprovalThread(null);
                  setApprovalThreadMessages([]);
                  setApprovalThreadDraft('');
                }}
              >
                Đóng
              </button>
              <button type="button" style={ui.btn.primary as any} onClick={() => void sendApprovalThreadMessage()}>
                {sendingThread ? 'Đang gửi...' : 'Gửi vào thread'}
              </button>
            </div>
          </div>
        </OverlayModal>
      ) : null}
    </div>
  );
}
