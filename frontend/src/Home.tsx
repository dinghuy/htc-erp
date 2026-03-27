import { useEffect, useMemo, useState } from 'preact/hooks';
import type { CurrentUser } from './auth';
import { buildRoleProfile, ROLE_LABELS } from './auth';
import { API_BASE } from './config';
import { setNavContext } from './navContext';
import { buildHomeHighlightNavigation, buildHomePriorityNavigation } from './home/homeNavigation';
import { requestJsonWithAuth } from './shared/api/client';
import type { ProjectWorkspaceTabKey } from './shared/domain/contracts';
import { tokens } from './ui/tokens';
import { ui } from './ui/styles';
import { ActionCard, EntitySummaryCard, MetricCard, PageHero, PageSectionHeader, StatusChipRow } from './ui/patterns';

type HomePriority = {
  metricKey: string;
  label: string;
  value: number;
  tone?: 'good' | 'warn' | 'bad';
};

type WorkflowAvailabilityTone = 'good' | 'warn' | 'bad' | 'info';

type ResolvedHomeActionAvailability = {
  nextActionLabel: string;
  nextActionHint: string;
  workspaceTab: ProjectWorkspaceTabKey;
  tone: WorkflowAvailabilityTone;
  blockers: string[];
};

type HomeHighlight = {
  projectId: string;
  projectCode?: string | null;
  projectName?: string | null;
  projectStage?: string | null;
  projectStatus?: string | null;
  accountName?: string | null;
  openTaskCount?: number | null;
  pendingApprovalCount?: number | null;
  missingDocumentCount?: number | null;
  approvalGateStates?: Array<{
    gateType?: string | null;
    status?: string | null;
  }> | null;
  pendingApproverState?: Array<{
    approvalId?: string | null;
    approverRole?: string | null;
    approverName?: string | null;
  }> | null;
  actionAvailability?: {
    quotation?: {
      canCreateSalesOrder?: boolean;
    } | null;
    salesOrder?: {
      canReleaseLatest?: boolean;
    } | null;
    project?: {
      blockers?: string[];
    } | null;
  } | null;
};

type HomePayload = {
  persona?: {
    primaryRole?: string;
    roleCodes?: string[];
    mode?: string;
  };
  priorities?: HomePriority[];
  highlights?: HomeHighlight[];
};

const API = API_BASE;

function toneColor(tone?: string) {
  switch (tone) {
    case 'good':
      return { fg: tokens.colors.success, bg: tokens.colors.badgeBgSuccess };
    case 'warn':
      return { fg: tokens.colors.warning, bg: tokens.colors.badgeBgInfo };
    case 'bad':
      return { fg: tokens.colors.error, bg: tokens.colors.badgeBgError };
    default:
      return { fg: tokens.colors.primary, bg: '#e8f4fd' };
  }
}

function workflowGateLabel(gateType?: string | null) {
  switch (String(gateType || '').trim().toLowerCase()) {
    case 'quotation_commercial':
      return 'Thương mại';
    case 'sales_order_release':
      return 'Release SO';
    case 'procurement_commitment':
      return 'Mua hàng';
    case 'delivery_release':
      return 'Release giao hàng';
    case 'delivery_completion':
      return 'Hoàn tất giao hàng';
    default:
      return 'Workflow';
  }
}

function toSafeCount(value: unknown) {
  const normalized = Number(value || 0);
  return Number.isFinite(normalized) ? normalized : 0;
}

function resolveHomeWorkspaceTab(item: HomeHighlight): ProjectWorkspaceTabKey {
  if (toSafeCount(item.missingDocumentCount) > 0) return 'documents';

  const stage = String(item.projectStage || '').trim().toLowerCase();
  if (['order_released', 'procurement_active'].includes(stage)) return 'procurement';
  if (['delivery_active', 'delivery', 'delivery_completed', 'closed'].includes(stage)) return 'delivery';
  return toSafeCount(item.openTaskCount) > 0 ? 'timeline' : 'commercial';
}

function resolveHomeHighlightActionAvailability(item: HomeHighlight): ResolvedHomeActionAvailability {
  const workspaceTab = resolveHomeWorkspaceTab(item);
  const quotationAvailability = item.actionAvailability?.quotation;
  const salesOrderAvailability = item.actionAvailability?.salesOrder;
  const blockers = Array.isArray(item.actionAvailability?.project?.blockers)
    ? item.actionAvailability?.project?.blockers.filter(Boolean)
    : [];

  if (quotationAvailability?.canCreateSalesOrder) {
    return {
      nextActionLabel: 'Tạo sales order',
      nextActionHint: 'Báo giá đã approved/won và sẵn sàng handoff sang sales order.',
      workspaceTab: 'commercial',
      tone: 'good',
      blockers,
    };
  }
  if (salesOrderAvailability?.canReleaseLatest) {
    return {
      nextActionLabel: 'Release sales order',
      nextActionHint: 'Sales order mới nhất đã sẵn sàng để release cho execution.',
      workspaceTab: 'commercial',
      tone: 'warn',
      blockers,
    };
  }
  if (blockers.length > 0) {
    return {
      nextActionLabel: 'Gỡ workflow blockers',
      nextActionHint: blockers[0],
      workspaceTab,
      tone: 'bad',
      blockers,
    };
  }

  const pendingApprovals = toSafeCount(item.pendingApprovalCount);
  const missingDocuments = toSafeCount(item.missingDocumentCount);
  const openTasks = toSafeCount(item.openTaskCount);
  const stage = String(item.projectStage || '').trim().toLowerCase();
  const derivedBlockers = [
    pendingApprovals > 0 ? `${pendingApprovals} approval đang chờ` : '',
    missingDocuments > 0 ? `${missingDocuments} hồ sơ còn thiếu` : '',
    openTasks > 0 ? `${openTasks} task đang mở` : '',
  ].filter(Boolean);

  if (pendingApprovals > 0) {
    return {
      nextActionLabel: 'Dọn hàng đợi approval',
      nextActionHint: `${pendingApprovals} approval đang chặn bước workflow kế tiếp của dự án này.`,
      workspaceTab,
      tone: 'warn',
      blockers: derivedBlockers,
    };
  }
  if (missingDocuments > 0) {
    return {
      nextActionLabel: 'Bổ sung hồ sơ',
      nextActionHint: `${missingDocuments} tài liệu còn thiếu trước khi tiếp tục flow.`,
      workspaceTab: 'documents',
      tone: 'bad',
      blockers: derivedBlockers,
    };
  }
  if (['order_released', 'procurement_active'].includes(stage)) {
    return {
      nextActionLabel: 'Đẩy procurement',
      nextActionHint: 'Dự án đã rời cổng thương mại và đang chờ follow-through từ mua hàng/inbound.',
      workspaceTab: 'procurement',
      tone: 'info',
      blockers: derivedBlockers,
    };
  }
  if (['delivery_active', 'delivery'].includes(stage)) {
    return {
      nextActionLabel: 'Theo dõi giao hàng',
      nextActionHint: 'Giai đoạn giao hàng đang là bước trọng tâm của dự án này.',
      workspaceTab: 'delivery',
      tone: 'info',
      blockers: derivedBlockers,
    };
  }
  if (openTasks > 0) {
    return {
      nextActionLabel: 'Xử lý task mở',
      nextActionHint: `${openTasks} task đang mở cần được kéo tiếp.`,
      workspaceTab: 'timeline',
      tone: 'info',
      blockers: derivedBlockers,
    };
  }

  return {
    nextActionLabel: 'Mở workspace',
    nextActionHint: 'Dự án chưa có blocker nổi bật; rà bước kế tiếp trong workspace.',
    workspaceTab,
    tone: 'info',
    blockers: derivedBlockers,
  };
}

function buildSuggestedActions(
  mode: string,
  priorities: HomePriority[],
  highlights: Array<HomeHighlight & { resolvedActionAvailability: ResolvedHomeActionAvailability }>,
) {
  const topPriority = priorities[0];
  const hotProject = highlights[0];

  const baseByMode: Record<string, Array<{ label: string; hint: string; route: string; navContext?: any; tone: 'primary' | 'secondary' | 'ghost' }>> = {
    sales: [
      {
        label: topPriority?.metricKey?.includes('approval') ? 'Dọn hàng đợi approval' : 'Đẩy quotation tiếp theo',
        hint: topPriority ? `${topPriority.label}: ${topPriority.value}` : 'Đi thẳng vào hàng đợi thương mại ưu tiên.',
        route: topPriority?.metricKey?.includes('approval') ? 'Approvals' : 'Sales',
        tone: 'primary',
      },
      {
        label: 'Mở My Work',
        hint: 'Xử lý follow-up, handoff và deals đang chờ.',
        route: 'My Work',
        navContext: { route: 'My Work', filters: { workFocus: 'commercial' } },
        tone: 'secondary',
      },
      {
        label: 'Rà project nóng',
        hint: hotProject ? `${hotProject.projectCode || hotProject.projectName} đang có approval hoặc hồ sơ chờ xử lý.` : 'Đi vào dự án nóng nhất của bạn.',
        route: 'Projects',
        navContext: hotProject ? { route: 'Projects', entityType: 'Project', entityId: hotProject.projectId, filters: { workspaceTab: 'commercial' } } : undefined,
        tone: 'ghost',
      },
    ],
    project_manager: [
      {
        label: 'Giữ nhịp commercial -> execution',
        hint: topPriority ? `${topPriority.label}: ${topPriority.value}` : 'Đi vào queue hợp nhất của PM.',
        route: 'My Work',
        navContext: { route: 'My Work', filters: { workFocus: 'execution' } },
        tone: 'primary',
      },
      {
        label: 'Mở workspace nóng nhất',
        hint: hotProject ? `${hotProject.projectCode || hotProject.projectName} đang cần chốt bước kế tiếp.` : 'Đi vào dự án nóng nhất.',
        route: 'Projects',
        navContext: hotProject ? { route: 'Projects', entityType: 'Project', entityId: hotProject.projectId, filters: { workspaceTab: 'commercial' } } : undefined,
        tone: 'secondary',
      },
      {
        label: 'Rà blocker approval',
        hint: 'Kiểm tra approval nào đang đe dọa margin hoặc timeline.',
        route: 'Approvals',
        tone: 'ghost',
      },
    ],
    procurement: [
      {
        label: 'Xử lý supply exceptions',
        hint: topPriority ? `${topPriority.label}: ${topPriority.value}` : 'Đi vào queue ETA, shortage và vendor exceptions.',
        route: 'Inbox',
        navContext: { route: 'Inbox', filters: { department: 'procurement' } },
        tone: 'primary',
      },
      {
        label: 'Mở workspace mua hàng',
        hint: hotProject ? `${hotProject.projectCode || hotProject.projectName} có rủi ro nguồn cung.` : 'Đi vào dự án có áp lực mua hàng.',
        route: 'Projects',
        navContext: hotProject ? { route: 'Projects', entityType: 'Project', entityId: hotProject.projectId, filters: { workspaceTab: 'procurement' } } : undefined,
        tone: 'secondary',
      },
      {
        label: 'Xem reports',
        hint: 'Theo dõi cockpit dự án theo góc nhìn nguồn cung.',
        route: 'Reports',
        tone: 'ghost',
      },
    ],
    accounting: [
      {
        label: 'Xử lý approval tài chính',
        hint: topPriority ? `${topPriority.label}: ${topPriority.value}` : 'Đi thẳng vào lane tài chính đang chờ.',
        route: 'Approvals',
        navContext: { route: 'Approvals', filters: { approvalLane: 'finance' } },
        tone: 'primary',
      },
      {
        label: 'Mở workspace tài chính',
        hint: hotProject ? `${hotProject.projectCode || hotProject.projectName} cần follow-up về thanh toán hoặc hồ sơ.` : 'Đi vào dự án cần rà trạng thái tài chính.',
        route: 'Projects',
        navContext: hotProject ? { route: 'Projects', entityType: 'Project', entityId: hotProject.projectId, filters: { workspaceTab: 'finance' } } : undefined,
        tone: 'secondary',
      },
      {
        label: 'Xem role cockpit',
        hint: 'Mở dashboard tài chính theo persona.',
        route: 'Reports',
        tone: 'ghost',
      },
    ],
    legal: [
      {
        label: 'Xử lý approval pháp lý',
        hint: topPriority ? `${topPriority.label}: ${topPriority.value}` : 'Đi thẳng vào hàng đợi approval pháp lý.',
        route: 'Approvals',
        navContext: { route: 'Approvals', filters: { approvalLane: 'legal' } },
        tone: 'primary',
      },
      {
        label: 'Mở workspace pháp lý',
        hint: hotProject ? `${hotProject.projectCode || hotProject.projectName} đang có áp lực pháp lý.` : 'Đi vào dự án cần review hợp đồng.',
        route: 'Projects',
        navContext: hotProject ? { route: 'Projects', entityType: 'Project', entityId: hotProject.projectId, filters: { workspaceTab: 'legal' } } : undefined,
        tone: 'secondary',
      },
      {
        label: 'Rà inbox hồ sơ',
        hint: 'Xem hồ sơ pháp lý còn thiếu.',
        route: 'Inbox',
        tone: 'ghost',
      },
    ],
    director: [
      {
        label: 'Mở cockpit điều hành',
        hint: topPriority ? `${topPriority.label}: ${topPriority.value}` : 'Đi thẳng vào risk và approval queue cấp điều hành.',
        route: 'Reports',
        tone: 'primary',
      },
      {
        label: 'Xem approval điều hành',
        hint: 'Rà các quyết định vượt ngưỡng.',
        route: 'Approvals',
        navContext: { route: 'Approvals', filters: { approvalLane: 'executive' } },
        tone: 'secondary',
      },
      {
        label: 'Mở dự án rủi ro cao',
        hint: hotProject ? `${hotProject.projectCode || hotProject.projectName} đang nổi rủi ro.` : 'Đi vào dự án rủi ro nhất.',
        route: 'Projects',
        navContext: hotProject ? { route: 'Projects', entityType: 'Project', entityId: hotProject.projectId } : undefined,
        tone: 'ghost',
      },
    ],
    admin: [
      {
        label: 'Theo dõi watchlist hệ thống',
        hint: topPriority ? `${topPriority.label}: ${topPriority.value}` : 'Đi vào watchlist approval/inbox toàn cục.',
        route: 'Reports',
        tone: 'primary',
      },
      {
        label: 'Quản lý Users',
        hint: 'Rà capability roles, trạng thái account và các persona kết hợp.',
        route: 'Users',
        tone: 'secondary',
      },
      {
        label: 'Mở dự án cần hỗ trợ',
        hint: hotProject ? `${hotProject.projectCode || hotProject.projectName} đang cần admin hỗ trợ.` : 'Đi vào dự án cần can thiệp vận hành.',
        route: 'Projects',
        navContext: hotProject ? { route: 'Projects', entityType: 'Project', entityId: hotProject.projectId } : undefined,
        tone: 'ghost',
      },
    ],
    viewer: [
      {
        label: 'Xem dự án',
        hint: 'Đi vào danh sách dự án trong chế độ read-only.',
        route: 'Projects',
        tone: 'primary',
      },
      {
        label: 'Mở inbox',
        hint: 'Theo dõi exception items liên quan.',
        route: 'Inbox',
        tone: 'secondary',
      },
      {
        label: 'Xem cockpit vai trò',
        hint: 'Mở dashboard tổng quan read-only.',
        route: 'Reports',
        tone: 'ghost',
      },
    ],
  };

  return baseByMode[mode] || baseByMode.viewer;
}

export function Home({
  currentUser,
  onNavigate,
}: {
  currentUser: CurrentUser;
  onNavigate?: (route: string) => void;
}) {
  const [payload, setPayload] = useState<HomePayload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const profile = useMemo(
    () => buildRoleProfile(currentUser.roleCodes, currentUser.systemRole),
    [currentUser.roleCodes, currentUser.systemRole],
  );

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      try {
        const data = await requestJsonWithAuth<HomePayload>(
          currentUser.token,
          `${API}/workspace/home`,
          {},
          'Không thể tải role home',
        );
        if (!active) return;
        setPayload(data);
        setError('');
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Không thể tải role home');
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [currentUser.token]);

  const priorities = payload?.priorities || [];
  const highlights = payload?.highlights || [];
  const resolvedHighlights = highlights.map((item) => ({
    ...item,
    resolvedActionAvailability: resolveHomeHighlightActionAvailability(item),
  }));
  const subtitleByMode: Record<string, string> = {
    project_manager: 'PM giờ dùng một màn hình hợp nhất để vừa chốt thương mại, làm sạch handoff, vừa đẩy execution tiếp tục trên cùng dự án.',
    procurement: 'Ưu tiên line thiếu hàng, ETA trễ, PO cần tạo và vendor chưa phản hồi.',
    accounting: 'Theo dõi mốc thanh toán, lỗi ERP và công nợ cần xử lý.',
    legal: 'Tập trung hồ sơ thiếu, hợp đồng chờ review và deviation cần phản hồi.',
    director: 'Profit + risk cockpit cho các dự án cần quyết định hoặc can thiệp.',
    sales: 'Quản lý pipeline, quotation, handoff pending và follow-up thương mại.',
    admin: 'Theo dõi hoạt động liên phòng ban, phân quyền và những điểm nghẽn hệ thống.',
    viewer: 'Xem các highlights quan trọng mà không can thiệp workflow.',
  };
  const quickActionsByMode: Record<string, Array<{ label: string; route: string }>> = {
    sales: [
      { label: 'Mở My Work', route: 'My Work' },
      { label: 'Đi tới Sales', route: 'Sales' },
      { label: 'Xem Projects', route: 'Projects' },
    ],
    project_manager: [
      { label: 'Mở My Work', route: 'My Work' },
      { label: 'Mở Approvals', route: 'Approvals' },
      { label: 'Xem Projects', route: 'Projects' },
    ],
    procurement: [
      { label: 'Mở My Work', route: 'My Work' },
      { label: 'Xem Suppliers', route: 'Suppliers' },
      { label: 'Xem Reports', route: 'Reports' },
    ],
    accounting: [
      { label: 'Mở Approvals', route: 'Approvals' },
      { label: 'Mở My Work', route: 'My Work' },
      { label: 'Xem Reports', route: 'Reports' },
    ],
    legal: [
      { label: 'Mở Approvals', route: 'Approvals' },
      { label: 'Mở Inbox', route: 'Inbox' },
      { label: 'Xem Projects', route: 'Projects' },
    ],
    director: [
      { label: 'Mở Approvals', route: 'Approvals' },
      { label: 'Xem Reports', route: 'Reports' },
      { label: 'Xem Event Log', route: 'EventLog' },
    ],
    admin: [
      { label: 'Quản lý Users', route: 'Users' },
      { label: 'Mở Settings', route: 'Settings' },
      { label: 'Xem Event Log', route: 'EventLog' },
    ],
    viewer: [
      { label: 'Mở Inbox', route: 'Inbox' },
      { label: 'Xem Projects', route: 'Projects' },
      { label: 'Xem Reports', route: 'Reports' },
    ],
  };
  const highlightTitleByMode: Record<string, { title: string; description: string }> = {
    sales: {
      title: 'Điểm nóng thương mại',
      description: 'Các deal hoặc dự án đang kéo quotation, approval hoặc hồ sơ bổ sung vào cùng một điểm nhìn.',
    },
    project_manager: {
      title: 'Điểm nóng từ deal tới delivery',
      description: 'Các dự án đang kéo công việc, approval hoặc hồ sơ thiếu vào cùng một điểm nhìn từ thương mại sang delivery.',
    },
    procurement: {
      title: 'Điểm nóng nguồn cung',
      description: 'Những dự án đang bị shortage, ETA trễ hoặc chờ thêm tài liệu từ chuỗi mua hàng.',
    },
    accounting: {
      title: 'Điểm nóng tài chính',
      description: 'Những dự án có payment milestone, receivable risk hoặc tài liệu tài chính chưa đủ điều kiện xử lý.',
    },
    legal: {
      title: 'Điểm nóng pháp lý',
      description: 'Những dự án có contract review pending, hồ sơ thiếu hoặc legal blockers cần phản hồi.',
    },
    director: {
      title: 'Điểm nóng điều hành',
      description: 'Các dự án cần quyết định, có approval tồn hoặc đang kéo risk margin/tiến độ lên mức điều hành.',
    },
    admin: {
      title: 'Giám sát hệ thống',
      description: 'Điểm nhìn toàn cục để support workflow, kiểm tra phân quyền và xác định project đang cần can thiệp hệ thống.',
    },
    viewer: {
      title: 'Điểm nổi bật của dự án',
      description: 'Các dự án quan trọng mà bạn đang theo dõi trong chế độ read-only.',
    },
  };
  const quickActions = quickActionsByMode[profile.personaMode] || quickActionsByMode.viewer;
  const suggestedActions = buildSuggestedActions(profile.personaMode, priorities, resolvedHighlights);
  const highlightCopy = highlightTitleByMode[profile.personaMode] || highlightTitleByMode.viewer;
  const navigateFromTarget = (target: { route: string; navContext?: any }) => {
    if (target.navContext) {
      setNavContext(target.navContext);
    }
    onNavigate?.(target.route);
  };

  return (
    <div style={{ display: 'grid', gap: '24px' }}>
      <PageHero
        eyebrow={ROLE_LABELS[profile.primaryRole]}
        title="Tổng quan theo vai trò"
        description={
          priorities[0]
            ? `${subtitleByMode[profile.personaMode]} Hôm nay ưu tiên: ${priorities[0].label} · ${priorities[0].value}.`
            : subtitleByMode[profile.personaMode]
        }
        actions={quickActions.map((action, index) => ({
          key: `${action.route}-${action.label}`,
          label: action.label,
          onClick: () => onNavigate?.(action.route),
          variant: index === 0 ? 'primary' : 'outline',
        }))}
      />

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '14px' }}>
        {suggestedActions.slice(0, 3).map((action) => (
          <ActionCard
            key={`${action.route}-${action.label}`}
            eyebrow={action.tone === 'primary' ? 'Ưu tiên chính' : action.tone === 'secondary' ? 'Bước kế tiếp' : 'Theo dõi'}
            title={action.label}
            description={action.hint}
            tone={action.tone === 'primary' ? 'info' : action.tone === 'secondary' ? 'warn' : 'neutral'}
            onClick={() => navigateFromTarget({ route: action.route, navContext: action.navContext })}
          />
        ))}
      </section>

      {error ? (
        <div style={{ ...ui.card.base, padding: '20px', color: tokens.colors.error }}>{error}</div>
      ) : null}

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
        {(loading ? Array.from({ length: 4 }).map((_, index) => ({ metricKey: `loading-${index}`, label: 'Đang tải', value: 0, tone: 'good' as const })) : priorities).map((item) => {
          const target = buildHomePriorityNavigation(item.metricKey, profile.personaMode);
          return (
            <button
              type="button"
              key={item.metricKey}
              disabled={loading}
              onClick={() => navigateFromTarget(target)}
              style={{ border: 'none', padding: 0, background: 'transparent', textAlign: 'left', cursor: loading ? 'default' : 'pointer' }}
            >
              <MetricCard
                label={item.label}
                value={item.value}
                accent={toneColor(item.tone).fg}
            hint={item.metricKey.includes('approval') ? 'Hàng đợi approval hiện tại' : item.metricKey.includes('project') ? 'Dự án cần theo dõi' : undefined}
              />
            </button>
          );
        })}
      </section>

      <section style={{ ...ui.card.base, padding: '22px', display: 'grid', gap: '16px' }}>
        <PageSectionHeader
          title={highlightCopy.title}
          description={highlightCopy.description}
          action={<button type="button" style={ui.btn.outline as any} onClick={() => onNavigate?.('Inbox')}>Mở Inbox</button>}
        />

        {loading ? (
          <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Đang tải highlights...</div>
        ) : resolvedHighlights.length === 0 ? (
          <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Chưa có dự án nổi bật phù hợp với vai trò hiện tại.</div>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {resolvedHighlights.map((item) => {
              const pendingGates = Array.isArray(item.approvalGateStates)
                ? item.approvalGateStates.filter((gate) => String(gate?.status || '').toLowerCase() === 'pending')
                : [];
              const pendingApprovers = Array.isArray(item.pendingApproverState) ? item.pendingApproverState : [];
              const supportChips = [
              { key: `${item.projectId}-tasks`, label: `${Number(item.openTaskCount || 0)} task mở`, tone: 'info' as const },
                { key: `${item.projectId}-approvals`, label: `${Number(item.pendingApprovalCount || 0)} approval`, tone: Number(item.pendingApprovalCount || 0) > 0 ? 'warn' as const : 'good' as const },
                { key: `${item.projectId}-docs`, label: `${Number(item.missingDocumentCount || 0)} hồ sơ thiếu`, tone: Number(item.missingDocumentCount || 0) > 0 ? 'bad' as const : 'good' as const },
                ...(item.actionAvailability?.quotation?.canCreateSalesOrder ? [{ key: `${item.projectId}-so-ready`, label: 'Sẵn sàng tạo SO', tone: 'info' as const }] : []),
                ...(item.actionAvailability?.salesOrder?.canReleaseLatest ? [{ key: `${item.projectId}-release-ready`, label: 'Sẵn sàng release', tone: 'good' as const }] : []),
                ...pendingGates.slice(0, 1).map((gate, index) => ({
                  key: `${item.projectId}-gate-${gate.gateType || 'pending'}-${index}`,
                  label: `Gate ${workflowGateLabel(gate.gateType)}`,
                  tone: String(gate.status || '').toLowerCase() === 'pending' ? 'warn' as const : 'neutral' as const,
                })),
                ...pendingApprovers.slice(0, 1).map((approver, index) => ({
                  key: `${item.projectId}-approver-${approver.approvalId || approver.approverRole || 'pending'}-${index}`,
                  label: `Chờ ${approver.approverName || approver.approverRole || 'approver'}`,
                  tone: 'neutral' as const,
                })),
              ].slice(0, 4);

              return (
                <button
                  type="button"
                  key={item.projectId}
                  onClick={() => navigateFromTarget(buildHomeHighlightNavigation(item.projectId))}
                  style={{ border: 'none', padding: 0, background: 'transparent', textAlign: 'left', cursor: 'pointer' }}
                >
                  <EntitySummaryCard
                    title={`${item.projectCode ? `${item.projectCode} · ` : ''}${item.projectName || 'Dự án chưa đặt tên'}`}
                    subtitle={`${item.accountName || 'Chưa có account'} · Giai đoạn ${item.projectStage || 'new'} · Trạng thái ${item.projectStatus || 'pending'}`}
                    primaryLabel={item.resolvedActionAvailability.nextActionLabel}
                    primaryHint={item.resolvedActionAvailability.nextActionHint}
                    statusItems={supportChips}
                    meta={[
                      { key: 'account', label: 'Account', value: item.accountName || '—' },
                      { key: 'stage', label: 'Giai đoạn', value: item.projectStage || '—' },
                    ]}
                    footer={item.resolvedActionAvailability.blockers.length > 0 && item.resolvedActionAvailability.blockers[0] !== item.resolvedActionAvailability.nextActionHint ? <StatusChipRow items={item.resolvedActionAvailability.blockers.slice(0, 1).map((blocker, index) => ({ key: `${item.projectId}-blocker-${index}`, label: blocker, tone: 'neutral' as const }))} /> : null}
                  />
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
