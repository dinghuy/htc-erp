import { useEffect, useState } from 'preact/hooks';
import { buildRoleProfile, ROLE_LABELS, type CurrentUser } from './auth';
import { API_BASE } from './config';
import { consumeNavContext } from './navContext';
import { buildRolePreviewNotice } from './preview/rolePreviewNotice';
import { requestJsonWithAuth } from './shared/api/client';
import { canApproveRequest, resolveApprovalLane } from './shared/domain/contracts';
import { QA_TEST_IDS, approvalActionButtonTestId, approvalCardTestId, approvalLaneButtonTestId } from './testing/testIds';
import { showNotify } from './Notification';
import { tokens } from './ui/tokens';
import { ui } from './ui/styles';

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
  department?: string | null;
  approverRole?: string | null;
  approverUserId?: string | null;
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

export function Approvals({
  currentUser,
}: {
  currentUser: CurrentUser;
}) {
  const profile = buildRoleProfile(currentUser.roleCodes, currentUser.systemRole);
  const [payload, setPayload] = useState<ApprovalsPayload | null>(null);
  const [approvals, setApprovals] = useState<ApprovalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [laneFilter, setLaneFilter] = useState<string>('');

  const copyByMode: Record<string, { title: string; description: string }> = {
    sales: {
      title: 'Commercial Approvals',
      description: 'Theo dõi yêu cầu commercial và handoff đang chờ phản hồi từ các phòng ban liên quan.',
    },
    project_manager: {
      title: 'Execution Approvals',
      description: 'Nhìn một queue approvals gắn trực tiếp với readiness của dự án và các dependency liên phòng ban.',
    },
    sales_pm_combined: {
      title: 'Unified Approvals',
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
      const data = await requestJsonWithAuth<ApprovalsPayload>(
        currentUser.token,
        `${API}/workspace/approvals`,
        {},
        'Không thể tải approvals',
      );
      setPayload(data);
      setApprovals(Array.isArray(data.approvals) ? data.approvals : []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải approvals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const navContext = consumeNavContext('Approvals');
    if (navContext && typeof navContext.filters?.approvalLane === 'string') {
      setLaneFilter(navContext.filters.approvalLane);
    }
    void load();
  }, [currentUser.token]);

  const filteredApprovals = laneFilter
    ? approvals.filter((approval) => resolveApprovalLane(approval) === laneFilter)
    : approvals;
  const laneOptions = ['commercial', 'procurement', 'finance', 'legal', 'executive'];
  const previewLabel = currentUser.previewRoleCodes?.map((roleCode) => ROLE_LABELS[roleCode]).join(' + ') || ROLE_LABELS[currentUser.systemRole];
  const previewNotice = currentUser.isRolePreviewActive
    ? buildRolePreviewNotice({ screen: 'approvals', previewLabel, approvalLane: laneFilter || undefined })
    : null;

  const decide = async (approvalId: string, decision: 'approved' | 'rejected') => {
    setBusyId(approvalId);
    try {
      await requestJsonWithAuth(
        currentUser.token,
        `${API}/approval-requests/${approvalId}/decision`,
        {
          method: 'POST',
          body: JSON.stringify({ decision }),
        },
        'Không thể cập nhật approval',
      );
      showNotify(decision === 'approved' ? 'Đã duyệt approval' : 'Đã từ chối approval', 'success');
      await load();
    } catch (err: any) {
      showNotify(err?.message || 'Không thể cập nhật approval', 'error');
    } finally {
      setBusyId('');
    }
  };

  return (
    <div style={{ display: 'grid', gap: '22px' }}>
      <section style={{ ...ui.card.base, padding: '24px', display: 'grid', gap: '8px' }}>
        <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 900, color: tokens.colors.textPrimary }}>{pageCopy.title}</h1>
        <p style={{ margin: 0, fontSize: '14px', color: tokens.colors.textSecondary }}>
          {pageCopy.description}
        </p>
        {previewNotice ? (
          <div style={{ display: 'grid', gap: '6px', padding: '12px 14px', borderRadius: tokens.radius.lg, border: `1px solid ${previewNotice.tone === 'warning' ? tokens.colors.warning : tokens.colors.primary}`, background: previewNotice.tone === 'warning' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(0, 151, 110, 0.08)' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={previewNotice.tone === 'warning' ? ui.badge.warning : ui.badge.info}>Preview</span>
              <span style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{previewNotice.title}</span>
            </div>
            <span style={{ fontSize: '12px', color: tokens.colors.textSecondary, lineHeight: 1.6 }}>{previewNotice.message}</span>
          </div>
        ) : null}
        {laneFilter ? (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span data-testid={QA_TEST_IDS.approvals.focusBadge} style={ui.badge.warning}>QA focus lane: {laneFilter}</span>
            <span style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>
              Filter này chỉ đổi góc nhìn kiểm thử, không cấp thêm quyền approve cho admin.
            </span>
          </div>
        ) : null}
      </section>

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
            const lane = resolveApprovalLane(approval);
            const isOwner = !approval.approverUserId || approval.approverUserId === currentUser.id;
            const canApprove = approval.status === 'pending'
              && isOwner
              && canApproveRequest(currentUser.roleCodes, approval, currentUser.systemRole);

            return (
              <div key={approval.id} data-testid={approvalCardTestId(approval.id)} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '14px', display: 'grid', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{approval.title}</div>
                    <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, marginTop: '4px' }}>
                      {approval.projectCode ? `${approval.projectCode} · ` : ''}{approval.projectName || 'No project'} · {approval.requestType}
                    </div>
                  </div>
                  <span style={approval.status === 'pending' ? ui.badge.warning : approval.status === 'approved' ? ui.badge.success : ui.badge.error}>
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
                  </div>
                  {approval.status === 'pending' ? (
                    canApprove ? (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button type="button" data-testid={approvalActionButtonTestId(approval.id, 'reject')} style={ui.btn.outline as any} disabled={busyId === approval.id} onClick={() => decide(approval.id, 'rejected')}>
                          Reject
                        </button>
                        <button type="button" data-testid={approvalActionButtonTestId(approval.id, 'approve')} style={ui.btn.primary as any} disabled={busyId === approval.id} onClick={() => decide(approval.id, 'approved')}>
                          Approve
                        </button>
                      </div>
                    ) : (
                      <span style={ui.badge.neutral}>
                        {isOwner ? 'Read only' : 'Assigned approver khác'}
                      </span>
                    )
                  ) : null}
                </div>
              </div>
            );
          })}</div>
        ) : <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Không có approval nào trong queue hoặc lane đang lọc.</div>}
      </section>
    </div>
  );
}
