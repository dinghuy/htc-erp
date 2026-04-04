import { useEffect, useState } from 'preact/hooks';
import { buildRoleProfile, ROLE_LABELS, type CurrentUser } from './auth';
import { API_BASE } from './config';
import { consumeNavContext, setNavContext } from './navContext';
import { buildRolePreviewNotice } from './preview/rolePreviewNotice';
import { requestJsonWithAuth } from './shared/api/client';
import { QA_TEST_IDS } from './testing/testIds';
import { tokens } from './ui/tokens';
import { ui } from './ui/styles';
import { buildInboxProjectWorkspaceNavigation } from './work/inboxNavigation';

type InboxPayload = {
  persona?: {
    primaryRole?: string;
    roleCodes?: string[];
    mode?: string;
  };
  summary?: {
    totalCount?: number;
    documentCount?: number;
    blockedTaskCount?: number;
    notificationCount?: number;
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
  items?: Array<{
    entityId: string;
    entityType: string;
    title: string;
    description?: string;
    source?: string;
    projectName?: string;
    projectId?: string;
    department?: string;
    status?: string;
    createdAt?: string;
    actionAvailability?: {
      workspaceTab?: string;
      canOpenProject?: boolean;
      canOpenEntity?: boolean;
      primaryActionLabel?: string;
      blockers?: string[];
    } | null;
  }>;
};

const API = API_BASE;

export function Inbox({ currentUser, onNavigate }: { currentUser: CurrentUser; onNavigate?: (route: string) => void }) {
  const profile = buildRoleProfile(currentUser.roleCodes, currentUser.systemRole);
  const [payload, setPayload] = useState<InboxPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');

  const copyByMode: Record<string, { title: string; description: string }> = {
    sales: {
      title: 'Sales Inbox',
      description: 'Tập trung hồ sơ thiếu, blocked task và notifications ảnh hưởng tới commercial follow-up hoặc handoff.',
    },
    project_manager: {
      title: 'Commercial + Delivery Inbox',
      description: 'Một inbox xuyên commercial tới delivery để gom hồ sơ thiếu, blockers và notifications quan trọng.',
    },
    procurement: {
      title: 'Procurement Inbox',
      description: 'Tập trung shortage, chứng từ thiếu và các exception từ vendor hoặc delivery.',
    },
    accounting: {
      title: 'Finance Inbox',
      description: 'Tập trung chứng từ tài chính thiếu, milestone cần follow-up và các cảnh báo ERP liên quan.',
    },
    legal: {
      title: 'Legal Inbox',
      description: 'Tập trung contract package thiếu, deviation notes và các hồ sơ pháp lý cần hoàn tất.',
    },
    director: {
      title: 'Executive Inbox',
      description: 'Tập trung escalations, risk signals và các item cần nhìn ở cấp điều hành.',
    },
    admin: {
      title: 'Admin Inbox',
      description: 'Tập trung support issues, workflow exceptions và các item cần can thiệp vận hành hệ thống.',
    },
    viewer: {
      title: 'Inbox',
      description: 'Tập trung hồ sơ thiếu, blocked task và notification liên quan tới workflow của bạn.',
    },
  };
  const pageCopy = payload?.view || copyByMode[profile.personaMode] || copyByMode.viewer;
  const cards = Array.isArray(payload?.cards) ? payload.cards : [];

  useEffect(() => {
    let active = true;
    const navContext = consumeNavContext('Inbox');
    if (navContext && typeof navContext.filters?.department === 'string') {
      setDepartmentFilter(navContext.filters.department);
    }
    async function load() {
      setLoading(true);
      try {
        const data = await requestJsonWithAuth<InboxPayload>(
          currentUser.token,
          `${API}/workspace/inbox`,
          {},
          'Không thể tải inbox',
        );
        if (!active) return;
        setPayload(data);
        setError('');
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Không thể tải inbox');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [currentUser.token]);

  const filteredItems = departmentFilter
    ? (payload?.items || []).filter((item) => {
        const departmentValue = String(item.department || '').toLowerCase();
        const sourceValue = String(item.source || '').toLowerCase();
        return departmentValue.includes(departmentFilter.toLowerCase()) || sourceValue.includes(departmentFilter.toLowerCase());
      })
    : (payload?.items || []);
  const previewLabel = currentUser.previewRoleCodes?.map((roleCode) => ROLE_LABELS[roleCode]).join(' + ') || ROLE_LABELS[currentUser.systemRole];
  const previewNotice = currentUser.isRolePreviewActive
    ? buildRolePreviewNotice({ screen: 'inbox', previewLabel, departmentFilter: departmentFilter || undefined })
    : null;

  return (
    <div style={{ display: 'grid', gap: '22px' }}>
      <section style={{ ...ui.card.base, padding: '24px', display: 'grid', gap: '8px' }}>
        <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 900, color: tokens.colors.textPrimary }}>{pageCopy.title}</h1>
        <p style={{ margin: 0, fontSize: '14px', color: tokens.colors.textSecondary }}>
          {pageCopy.description}
        </p>
        {previewNotice ? (
          <div style={{ display: 'grid', gap: '6px', padding: '12px 14px', borderRadius: tokens.radius.lg, border: `1px solid ${previewNotice.tone === 'warning' ? tokens.colors.warning : tokens.colors.primary}`, background: previewNotice.tone === 'warning' ? tokens.colors.warningTint : tokens.colors.infoBg }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={previewNotice.tone === 'warning' ? ui.badge.warning : ui.badge.info}>Preview</span>
              <span style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{previewNotice.title}</span>
            </div>
            <span style={{ fontSize: '12px', color: tokens.colors.textSecondary, lineHeight: 1.6 }}>{previewNotice.message}</span>
          </div>
        ) : null}
        {departmentFilter ? (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span data-testid={QA_TEST_IDS.inbox.focusBadge} style={ui.badge.warning}>QA focus department: {departmentFilter}</span>
            <span style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>
              Đây chỉ là bộ lọc hiển thị để test queue nhanh hơn.
            </span>
          </div>
        ) : null}
      </section>

      {cards.length ? (
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          {cards.map((card) => (
            <div key={card.label} style={{ ...ui.card.base, padding: '18px', display: 'grid', gap: '8px' }}>
              <span style={card.tone === 'good' ? ui.badge.success : card.tone === 'warn' ? ui.badge.warning : card.tone === 'bad' ? ui.badge.error : ui.badge.info}>{card.label}</span>
              <strong style={{ fontSize: '28px', color: tokens.colors.textPrimary }}>{loading ? '…' : card.value}</strong>
            </div>
          ))}
        </section>
      ) : null}

      {error ? <div style={{ ...ui.card.base, padding: '16px', color: tokens.colors.error }}>{error}</div> : null}

      <section data-testid={QA_TEST_IDS.inbox.itemsSection} style={{ ...ui.card.base, padding: '22px', display: 'grid', gap: '12px' }}>
        {departmentFilter ? (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setDepartmentFilter('')} style={ui.btn.outline as any}>Xóa filter</button>
          </div>
        ) : null}
        {loading ? <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Đang tải inbox...</div> : filteredItems.length ? (
          filteredItems.map((item) => (
            <div key={`${item.entityType}-${item.entityId}`} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '14px', display: 'grid', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{item.title}</div>
                <span style={item.status === 'missing' ? ui.badge.error : ui.badge.neutral}>{item.source || item.entityType}</span>
              </div>
              {item.description ? <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>{item.description}</div> : null}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {item.projectName ? <span style={ui.badge.info}>{item.projectName}</span> : null}
                {item.department ? <span style={ui.badge.warning}>{item.department}</span> : null}
                {item.actionAvailability?.workspaceTab ? <span style={ui.badge.neutral}>Tab {item.actionAvailability.workspaceTab}</span> : null}
              </div>
              {item.actionAvailability?.canOpenProject ? (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    style={ui.btn.outline as any}
                    onClick={() => {
                      const target = buildInboxProjectWorkspaceNavigation(item);
                      if (!target) return;
                      setNavContext(target.navContext);
                      onNavigate?.(target.route);
                    }}
                  >
                    {item.actionAvailability?.primaryActionLabel || 'Mở workspace'}
                  </button>
                </div>
              ) : null}
            </div>
          ))
        ) : <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Inbox đang trống hoặc không có item phù hợp filter hiện tại.</div>}
      </section>
    </div>
  );
}
