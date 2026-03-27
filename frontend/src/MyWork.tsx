import { useEffect, useMemo, useState } from 'preact/hooks';
import { buildRoleProfile, ROLE_LABELS, type CurrentUser } from './auth';
import { API_BASE } from './config';
import { consumeNavContext } from './navContext';
import { buildRolePreviewNotice } from './preview/rolePreviewNotice';
import { requestJsonWithAuth } from './shared/api/client';
import { resolveApprovalLane } from './shared/domain/contracts';
import { QA_TEST_IDS } from './testing/testIds';
import { tokens } from './ui/tokens';
import { ui } from './ui/styles';

type MyWorkPayload = {
  persona?: {
    primaryRole?: string;
    roleCodes?: string[];
    mode?: string;
  };
  summary?: {
    taskCount?: number;
    approvalCount?: number;
    projectCount?: number;
    blockedTaskCount?: number;
    overdueTaskCount?: number;
    pendingApprovalCount?: number;
  };
  view?: {
    title?: string;
    description?: string;
    taskTitle?: string;
    taskDescription?: string;
    approvalTitle?: string;
    approvalDescription?: string;
  };
  cards?: Array<{
    label: string;
    value: number;
    tone?: 'good' | 'warn' | 'bad' | 'info';
  }>;
  tasks?: any[];
  approvals?: any[];
  projects?: any[];
};

const API = API_BASE;

function Section({ title, description, children, action }: any) {
  return (
    <section style={{ ...ui.card.base, padding: '22px', display: 'grid', gap: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: tokens.colors.textPrimary }}>{title}</h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: tokens.colors.textSecondary }}>{description}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function MyWork({
  currentUser,
  onNavigate,
}: {
  currentUser: CurrentUser;
  onNavigate?: (route: string) => void;
}) {
  const profile = useMemo(
    () => buildRoleProfile(currentUser.roleCodes, currentUser.systemRole),
    [currentUser.roleCodes, currentUser.systemRole],
  );
  const [payload, setPayload] = useState<MyWorkPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [workFocus, setWorkFocus] = useState('');

  useEffect(() => {
    let active = true;
    const navContext = consumeNavContext('My Work');
    if (navContext && typeof navContext.filters?.workFocus === 'string') {
      setWorkFocus(navContext.filters.workFocus);
    }
    async function load() {
      setLoading(true);
      try {
        const data = await requestJsonWithAuth<MyWorkPayload>(
          currentUser.token,
          `${API}/workspace/my-work`,
          {},
          'Không thể tải My Work',
        );
        if (!active) return;
        setPayload(data);
        setError('');
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Không thể tải My Work');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [currentUser.token]);

  const workFocusCopy: Record<string, { label: string; helper: string }> = {
    commercial: {
      label: 'commercial queue',
      helper: 'Ưu tiên follow-up quotation, handoff và các approval thương mại để QA nhanh flow sales.',
    },
    execution: {
      label: 'execution queue',
      helper: 'Ưu tiên blockers, readiness và dependency liên phòng ban để QA flow PM.',
    },
    combined: {
      label: 'combined sales + PM queue',
      helper: 'Giữ cùng một queue từ commercial sang execution để test unified persona.',
    },
  };
  const filteredApprovals = workFocus === 'commercial'
    ? (payload?.approvals || []).filter((approval) => resolveApprovalLane(approval) === 'commercial')
    : (payload?.approvals || []);
  const previewLabel = currentUser.previewRoleCodes?.map((roleCode) => ROLE_LABELS[roleCode]).join(' + ') || ROLE_LABELS[currentUser.systemRole];
  const previewNotice = currentUser.isRolePreviewActive
    ? buildRolePreviewNotice({ screen: 'my_work', previewLabel, workFocus: workFocus || undefined })
    : null;

  const taskCount = payload?.summary?.taskCount ?? payload?.tasks?.length ?? 0;
  const approvalCount = payload?.summary?.approvalCount ?? payload?.approvals?.length ?? 0;
  const projectCount = payload?.summary?.projectCount ?? payload?.projects?.length ?? 0;
  const cards = useMemo(() => {
    if (Array.isArray(payload?.cards) && payload.cards.length) {
      return payload.cards.map((card) => ({
        label: card.label,
        value: card.value,
        tone:
          card.tone === 'good'
            ? ui.badge.success
            : card.tone === 'warn'
              ? ui.badge.warning
              : card.tone === 'bad'
                ? ui.badge.error
                : ui.badge.info,
      }));
    }

    const byMode: Record<string, Array<{ label: string; value: number; tone: any }>> = {
      sales: [
        { label: 'Deals cần chốt', value: taskCount, tone: ui.badge.info },
        { label: 'Commercial approvals', value: approvalCount, tone: ui.badge.warning },
        { label: 'Projects theo dõi', value: projectCount, tone: ui.badge.success },
      ],
      project_manager: [
        { label: 'Projects cần đẩy', value: taskCount, tone: ui.badge.info },
        { label: 'Execution approvals', value: approvalCount, tone: ui.badge.warning },
        { label: 'Workspaces active', value: projectCount, tone: ui.badge.success },
      ],
      sales_pm_combined: [
        { label: 'Deals cần chốt', value: taskCount, tone: ui.badge.info },
        { label: 'Handoff / approvals', value: approvalCount, tone: ui.badge.warning },
        { label: 'Projects cần đẩy', value: projectCount, tone: ui.badge.success },
      ],
      procurement: [
        { label: 'Procurement tasks', value: taskCount, tone: ui.badge.info },
        { label: 'PO / vendor approvals', value: approvalCount, tone: ui.badge.warning },
        { label: 'Delivery risk projects', value: projectCount, tone: ui.badge.success },
      ],
      accounting: [
        { label: 'Finance tasks', value: taskCount, tone: ui.badge.info },
        { label: 'Finance approvals', value: approvalCount, tone: ui.badge.warning },
        { label: 'Projects payment-related', value: projectCount, tone: ui.badge.success },
      ],
      legal: [
        { label: 'Contract reviews', value: taskCount, tone: ui.badge.info },
        { label: 'Legal approvals', value: approvalCount, tone: ui.badge.warning },
        { label: 'Projects thiếu hồ sơ', value: projectCount, tone: ui.badge.success },
      ],
      director: [
        { label: 'Escalations theo dõi', value: taskCount, tone: ui.badge.info },
        { label: 'Executive approvals', value: approvalCount, tone: ui.badge.warning },
        { label: 'Projects at risk', value: projectCount, tone: ui.badge.success },
      ],
      admin: [
        { label: 'System tasks', value: taskCount, tone: ui.badge.info },
        { label: 'Approval watchlist', value: approvalCount, tone: ui.badge.warning },
        { label: 'Projects cần support', value: projectCount, tone: ui.badge.success },
      ],
      viewer: [
        { label: 'Items đang theo', value: taskCount, tone: ui.badge.info },
        { label: 'Approvals liên quan', value: approvalCount, tone: ui.badge.warning },
        { label: 'Projects active', value: projectCount, tone: ui.badge.success },
      ],
    };

    return byMode[profile.personaMode] || byMode.viewer;
  }, [approvalCount, payload?.cards, profile.personaMode, projectCount, taskCount]);

  const copyByMode: Record<string, { title: string; description: string; taskTitle: string; taskDescription: string; approvalTitle: string; approvalDescription: string }> = {
    sales: {
      title: 'My Work',
      description: 'Queue commercial theo assignment thực tế: follow-up, quotation và các yêu cầu bổ sung để đẩy deal.',
      taskTitle: 'Sales Queue',
      taskDescription: 'Các follow-up và handoff task đang gắn trực tiếp cho bạn.',
      approvalTitle: 'Commercial Queue',
      approvalDescription: 'Các approval thương mại bạn đang theo dõi hoặc đã khởi tạo.',
    },
    project_manager: {
      title: 'My Work',
      description: 'Queue execution để xử lý milestone, blocker và readiness trên các project đang chạy.',
      taskTitle: 'Execution Queue',
      taskDescription: 'Các đầu việc operational đang gắn trực tiếp cho bạn.',
      approvalTitle: 'Execution Dependencies',
      approvalDescription: 'Các approval đang ảnh hưởng tới delivery hoặc project readiness.',
    },
    sales_pm_combined: {
      title: 'My Work',
      description: 'Queue hợp nhất từ quotation sang execution, không cần tách deal và project thành hai nơi.',
      taskTitle: 'Deals + Projects',
      taskDescription: 'Các đầu việc cần chốt, handoff chưa sạch và execution follow-up trên cùng một queue.',
      approvalTitle: 'Cross-functional Approvals',
      approvalDescription: 'Approvals ảnh hưởng trực tiếp tới margin, handoff và tiến độ delivery.',
    },
    procurement: {
      title: 'My Work',
      description: 'Queue exception-driven cho vendor, PO, ETA và delivery risk.',
      taskTitle: 'Procurement Queue',
      taskDescription: 'Các đầu việc mua hàng, follow-up vendor và shortage handling đang gắn cho bạn.',
      approvalTitle: 'PO / Supplier Queue',
      approvalDescription: 'Các approval liên quan supplier selection, PO hoặc escalation supply risk.',
    },
    accounting: {
      title: 'My Work',
      description: 'Queue tài chính để xử lý invoice, payment milestone, công nợ và lỗi ERP.',
      taskTitle: 'Finance Queue',
      taskDescription: 'Các đầu việc tài chính đang gắn trực tiếp cho bạn.',
      approvalTitle: 'Finance Approval Queue',
      approvalDescription: 'Những quyết định tài chính đang chờ review hoặc đã được bạn khởi tạo.',
    },
    legal: {
      title: 'My Work',
      description: 'Queue pháp lý để review hợp đồng, deviation và hồ sơ thiếu.',
      taskTitle: 'Legal Review Queue',
      taskDescription: 'Các đầu việc contract review và legal follow-up đang gắn cho bạn.',
      approvalTitle: 'Legal Approval Queue',
      approvalDescription: 'Các approval pháp lý đang chờ quyết định hoặc cần trả lại với comment.',
    },
    director: {
      title: 'My Work',
      description: 'Queue điều hành tập trung vào escalations, risk projects và approvals vượt ngưỡng.',
      taskTitle: 'Escalation Queue',
      taskDescription: 'Các item cần can thiệp ở cấp điều hành.',
      approvalTitle: 'Executive Queue',
      approvalDescription: 'Các approval cần quyết định ở vai trò điều hành.',
    },
    admin: {
      title: 'My Work',
      description: 'Queue system-only để support workflow, phân quyền và các project đang cần can thiệp vận hành.',
      taskTitle: 'Support Queue',
      taskDescription: 'Các đầu việc support hoặc vận hành hệ thống đang gắn cho bạn.',
      approvalTitle: 'Approval Watchlist',
      approvalDescription: 'Theo dõi approval queue toàn cục, nhưng không mặc định là approver business.',
    },
    viewer: {
      title: 'My Work',
      description: 'Queue theo dõi read-only cho các project, task và approval liên quan.',
      taskTitle: 'Task Queue',
      taskDescription: 'Các đầu việc đang gắn trực tiếp cho bạn.',
      approvalTitle: 'Approval Queue',
      approvalDescription: 'Yêu cầu duyệt bạn đang xử lý hoặc đã khởi tạo.',
    },
  };
  const pageCopy = payload?.view || copyByMode[profile.personaMode] || copyByMode.viewer;

  return (
    <div style={{ display: 'grid', gap: '22px' }}>
      <section style={{ ...ui.card.base, padding: '24px', display: 'grid', gap: '14px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 900, color: tokens.colors.textPrimary }}>{pageCopy.title}</h1>
          <p style={{ margin: '6px 0 0', fontSize: '14px', color: tokens.colors.textSecondary }}>
            {pageCopy.description}
          </p>
        </div>
        {previewNotice ? (
          <div style={{ display: 'grid', gap: '6px', padding: '12px 14px', borderRadius: tokens.radius.lg, border: `1px solid ${previewNotice.tone === 'warning' ? tokens.colors.warning : tokens.colors.primary}`, background: previewNotice.tone === 'warning' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(0, 151, 110, 0.08)' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={previewNotice.tone === 'warning' ? ui.badge.warning : ui.badge.info}>Preview</span>
              <span style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{previewNotice.title}</span>
            </div>
            <span style={{ fontSize: '12px', color: tokens.colors.textSecondary, lineHeight: 1.6 }}>{previewNotice.message}</span>
          </div>
        ) : null}
        {workFocus ? (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span data-testid={QA_TEST_IDS.myWork.focusBadge} style={ui.badge.warning}>QA focus: {workFocusCopy[workFocus]?.label || workFocus}</span>
            <span style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>
              {workFocusCopy[workFocus]?.helper || 'Đây là context hiển thị để mở đúng queue cần kiểm thử.'}
            </span>
          </div>
        ) : null}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          {cards.map((card) => (
            <div key={card.label} style={{ ...ui.card.base, padding: '18px', display: 'grid', gap: '8px' }}>
              <span style={card.tone}>{card.label}</span>
              <strong style={{ fontSize: '28px', color: tokens.colors.textPrimary }}>{loading ? '…' : card.value}</strong>
            </div>
          ))}
        </div>
      </section>

      {error ? <div style={{ ...ui.card.base, padding: '16px', color: tokens.colors.error }}>{error}</div> : null}

      <div data-testid={QA_TEST_IDS.myWork.tasksSection}>
      <Section title={pageCopy.taskTitle} description={pageCopy.taskDescription} action={<button type="button" style={ui.btn.outline as any} onClick={() => onNavigate?.('Tasks')}>Mở Tasks</button>}>
        {loading ? <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Đang tải tasks...</div> : payload?.tasks?.length ? (
          <div style={{ display: 'grid', gap: '10px' }}>
            {payload.tasks.map((task) => (
              <div key={task.id} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{task.name}</div>
                    <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, marginTop: '4px' }}>
                      {task.projectCode ? `${task.projectCode} · ` : ''}{task.projectName || 'No project'} · {task.taskType || 'general'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={ui.badge.neutral}>{task.status || 'pending'}</span>
                    <span style={ui.badge.info}>{task.priority || 'medium'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Không có task nào trong queue.</div>}
      </Section>
      </div>

      <div data-testid={QA_TEST_IDS.myWork.approvalsSection}>
      <Section title={pageCopy.approvalTitle} description={pageCopy.approvalDescription} action={<button type="button" style={ui.btn.outline as any} onClick={() => onNavigate?.('Approvals')}>Mở Approvals</button>}>
        {loading ? <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Đang tải approvals...</div> : filteredApprovals.length ? (
          <div style={{ display: 'grid', gap: '10px' }}>
            {filteredApprovals.map((approval) => (
              <div key={approval.id} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{approval.title}</div>
                    <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, marginTop: '4px' }}>
                      {approval.projectCode ? `${approval.projectCode} · ` : ''}{approval.projectName || 'No project'} · {approval.requestType}
                    </div>
                  </div>
                  <span style={approval.status === 'pending' ? ui.badge.warning : ui.badge.success}>{approval.status}</span>
                </div>
              </div>
            ))}
          </div>
        ) : <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Không có approval nào trong queue hoặc context đang lọc.</div>}
      </Section>
      </div>
    </div>
  );
}
