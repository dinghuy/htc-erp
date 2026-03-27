import { useEffect, useMemo, useState } from 'preact/hooks';
import type { CurrentUser } from './auth';
import { buildRoleProfile, ROLE_LABELS } from './auth';
import { API_BASE } from './config';
import { setNavContext } from './navContext';
import { buildHomeHighlightNavigation, buildHomePriorityNavigation } from './home/homeNavigation';
import { requestJsonWithAuth } from './shared/api/client';
import { tokens } from './ui/tokens';
import { ui } from './ui/styles';
import { AlertCircleIcon, BriefcaseIcon, CheckIcon, FolderIcon, HandshakeIcon, TrendingIcon } from './ui/icons';

type HomePriority = {
  metricKey: string;
  label: string;
  value: number;
  tone?: 'good' | 'warn' | 'bad';
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

function iconForMetric(metricKey?: string) {
  if (metricKey?.includes('handoff') || metricKey?.includes('deals')) return HandshakeIcon;
  if (metricKey?.includes('project')) return FolderIcon;
  if (metricKey?.includes('approval')) return CheckIcon;
  if (metricKey?.includes('blocker') || metricKey?.includes('risk')) return AlertCircleIcon;
  return BriefcaseIcon;
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
  const subtitleByMode: Record<string, string> = {
    sales_pm_combined: 'Một màn hình hợp nhất để chốt deal, làm sạch handoff và đẩy execution tiếp tục trên cùng project.',
    project_manager: 'Theo dõi tiến độ, blocker và readiness xuyên phòng ban trên từng workspace dự án.',
    procurement: 'Ưu tiên line thiếu hàng, ETA trễ, PO cần tạo và vendor chưa phản hồi.',
    accounting: 'Theo dõi payment milestone, lỗi ERP và công nợ cần xử lý.',
    legal: 'Tập trung hồ sơ thiếu, hợp đồng chờ review và deviation cần phản hồi.',
    director: 'Profit + risk cockpit cho các dự án cần quyết định hoặc can thiệp.',
    sales: 'Quản lý pipeline, quotation, handoff pending và commercial follow-up.',
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
      { label: 'Xem Ops Overview', route: 'Ops Overview' },
      { label: 'Xem Projects', route: 'Projects' },
    ],
    sales_pm_combined: [
      { label: 'Mở My Work', route: 'My Work' },
      { label: 'Xem Projects', route: 'Projects' },
      { label: 'Mở Approvals', route: 'Approvals' },
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
      title: 'Commercial Highlights',
      description: 'Các deal hoặc project đang kéo quotation, approvals hoặc hồ sơ bổ sung vào cùng một điểm nhìn.',
    },
    project_manager: {
      title: 'Execution Highlights',
      description: 'Các project đang sinh blocker, open task hoặc pending approval ảnh hưởng trực tiếp tới execution.',
    },
    sales_pm_combined: {
      title: 'Unified Project Highlights',
      description: 'Các project đang kéo công việc, approvals hoặc hồ sơ thiếu vào cùng một điểm nhìn từ commercial sang delivery.',
    },
    procurement: {
      title: 'Supply Highlights',
      description: 'Những project đang bị shortage, ETA trễ hoặc chờ thêm tài liệu từ procurement chain.',
    },
    accounting: {
      title: 'Finance Highlights',
      description: 'Những project có payment milestone, receivable risk hoặc tài liệu tài chính chưa đủ điều kiện xử lý.',
    },
    legal: {
      title: 'Legal Highlights',
      description: 'Những project có contract review pending, missing documents hoặc legal blockers cần phản hồi.',
    },
    director: {
      title: 'Executive Drill-down',
      description: 'Các project cần quyết định, có approvals tồn hoặc đang kéo risk margin/tiến độ lên mức điều hành.',
    },
    admin: {
      title: 'System Oversight',
      description: 'Điểm nhìn toàn cục để support workflow, kiểm tra phân quyền và xác định project đang cần can thiệp hệ thống.',
    },
    viewer: {
      title: 'Project Highlights',
      description: 'Các project quan trọng mà bạn đang theo dõi trong chế độ read-only.',
    },
  };
  const quickActions = quickActionsByMode[profile.personaMode] || quickActionsByMode.viewer;
  const highlightCopy = highlightTitleByMode[profile.personaMode] || highlightTitleByMode.viewer;
  const navigateFromTarget = (target: { route: string; navContext?: any }) => {
    if (target.navContext) {
      setNavContext(target.navContext);
    }
    onNavigate?.(target.route);
  };

  return (
    <div style={{ display: 'grid', gap: '24px' }}>
      <section
        style={{
          ...ui.card.base,
          padding: '28px',
          background: 'linear-gradient(135deg, rgba(0, 151, 110, 0.12) 0%, rgba(0, 77, 53, 0.04) 60%, rgba(255,255,255,1) 100%)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'grid', gap: '10px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', ...ui.badge.info }}>
              <TrendingIcon size={16} />
              {ROLE_LABELS[profile.primaryRole]}
              {profile.personaMode === 'sales_pm_combined' ? ' · Sales-PM Unified' : ''}
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 900, color: tokens.colors.textPrimary }}>Role Home</h1>
              <p style={{ margin: '8px 0 0', fontSize: '14px', color: tokens.colors.textSecondary, maxWidth: '68ch', lineHeight: 1.6 }}>
                {subtitleByMode[profile.personaMode]}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {quickActions.map((action, index) => (
              <button
                key={`${action.route}-${action.label}`}
                type="button"
                style={(index === 0 ? ui.btn.primary : ui.btn.outline) as any}
                onClick={() => onNavigate?.(action.route)}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {error ? (
        <div style={{ ...ui.card.base, padding: '20px', color: tokens.colors.error }}>{error}</div>
      ) : null}

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
        {(loading ? Array.from({ length: 4 }).map((_, index) => ({ metricKey: `loading-${index}`, label: 'Dang tai...', value: 0, tone: 'good' as const })) : priorities).map((item) => {
          const palette = toneColor(item.tone);
          const Icon = iconForMetric(item.metricKey);
          const target = buildHomePriorityNavigation(item.metricKey, profile.personaMode);
          return (
            <button
              type="button"
              key={item.metricKey}
              disabled={loading}
              onClick={() => navigateFromTarget(target)}
              style={{
                ...ui.card.base,
                padding: '20px',
                display: 'grid',
                gap: '12px',
                textAlign: 'left',
                cursor: loading ? 'default' : 'pointer',
                border: `1px solid ${tokens.colors.border}`,
                background: tokens.colors.surface,
              }}
            >
              <div style={{ display: 'inline-flex', width: '42px', height: '42px', borderRadius: '14px', background: palette.bg, color: palette.fg, alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={18} />
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: tokens.colors.textSecondary }}>{item.label}</div>
              <div style={{ fontSize: '34px', fontWeight: 900, color: tokens.colors.textPrimary }}>{item.value}</div>
            </button>
          );
        })}
      </section>

      <section style={{ ...ui.card.base, padding: '22px', display: 'grid', gap: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: tokens.colors.textPrimary }}>{highlightCopy.title}</h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: tokens.colors.textSecondary }}>{highlightCopy.description}</p>
          </div>
          <button type="button" style={ui.btn.outline as any} onClick={() => onNavigate?.('Inbox')}>Mở Inbox</button>
        </div>

        {loading ? (
          <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Đang tải highlights...</div>
        ) : highlights.length === 0 ? (
          <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Chưa có project highlight phù hợp role hiện tại.</div>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {highlights.map((item) => (
              <button
                type="button"
                key={item.projectId}
                onClick={() => navigateFromTarget(buildHomeHighlightNavigation(item.projectId))}
                style={{
                  ...ui.card.base,
                  padding: '16px',
                  textAlign: 'left',
                  display: 'grid',
                  gap: '10px',
                  border: `1px solid ${tokens.colors.border}`,
                  background: tokens.colors.surface,
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>
                      {item.projectCode ? `${item.projectCode} · ` : ''}
                      {item.projectName || 'Unnamed project'}
                    </div>
                    <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, marginTop: '4px' }}>
                      {item.accountName || 'No account'} · Stage {item.projectStage || 'new'} · Status {item.projectStatus || 'pending'}
                    </div>
                  </div>
                  <span style={ui.badge.info}>
                    {Number(item.openTaskCount || 0)} open task
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={ui.badge.warning}>Approvals {Number(item.pendingApprovalCount || 0)}</span>
                  <span style={Number(item.missingDocumentCount || 0) > 0 ? ui.badge.error : ui.badge.success}>
                    Documents {Number(item.missingDocumentCount || 0)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
