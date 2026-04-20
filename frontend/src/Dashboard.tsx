import { API_BASE } from './config';
import { useState, useEffect } from 'preact/hooks';
import { fetchWithAuth } from './auth';
import { HistoryModal } from './Customers';
import { tokens } from './ui/tokens';
import { ui } from './ui/styles';
import { useI18n } from './i18n';
import { OverlayModal } from './ui/OverlayModal';
import { MetricCard, PageHero } from './ui/patterns';
import { renderActivityIcon } from './ui/activityIcon';
const API = API_BASE;

export function Dashboard({ onNavigate, isDarkMode, isMobile, currentUser }: { onNavigate?: (route: string) => void; isDarkMode?: boolean; isMobile?: boolean; currentUser?: any }) {
  const { t } = useI18n();
  const token = currentUser?.token || '';
  const [stats, setStats] = useState<any>(null);
  const [funnel, setFunnel] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  const [showHistoryFor, setShowHistoryFor] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = async () => {
    setRefreshing(true);
    try {
      if (!token) {
        setStats({});
        setFunnel([]);
        setActivities([]);
        return;
      }

      const [statsRes, funnelRes, activitiesRes] = await Promise.all([
        fetchWithAuth(token, `${API}/stats`),
        fetchWithAuth(token, `${API}/reports/funnel`),
        fetchWithAuth(token, `${API}/activities`),
      ]);

      const nextStats = statsRes.ok ? await statsRes.json() : {};
      const nextFunnel = funnelRes.ok ? await funnelRes.json() : [];
      const nextActivities = activitiesRes.ok ? await activitiesRes.json() : [];

      setStats(nextStats || {});
      setFunnel(Array.isArray(nextFunnel) ? nextFunnel : []);

      if (Array.isArray(nextActivities) && nextActivities.length > 0) {
        setActivities(nextActivities);
      } else {
        setActivities([
          { id: '1', title: 'Meeting with Anh Tùng', description: 'Technical requirements finalized for Crane fleet.', createdAt: new Date().toISOString(), category: 'CRM EVENT', icon: 'users', color: tokens.colors.badgeBgSuccess, iconColor: tokens.colors.success, link: 'Accounts' },
          { id: '2', title: 'Proposal sent to Chị Lan', description: 'Phase 2 logistics automation proposal.', createdAt: new Date(Date.now() - 3600000).toISOString(), category: 'OUTBOUND', icon: 'quote', color: tokens.colors.badgeBgInfo, iconColor: tokens.colors.warning, link: 'Sales' },
          { id: '3', title: 'Missed Call: Mr. Vuong', description: 'Inquiry regarding maintenance schedules.', createdAt: new Date(Date.now() - 86400000).toISOString(), category: 'TELEPHONY', icon: 'phone', color: tokens.colors.badgeBgInfo, iconColor: tokens.colors.info, link: 'Accounts' },
        ]);
      }
    } catch {
      setStats({});
      setFunnel([]);
      setActivities([]);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, [isDarkMode, token]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadDashboard();
    }, 60000);

    return () => window.clearInterval(interval);
  }, [isDarkMode, token]);

  const formatTime = (isoString: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return t('dashboard.yesterday');
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const v = (key: string) => stats ? (stats[key] ?? 0) : '…';
  const fmt = (n: any) => typeof n === 'number' ? n.toLocaleString('vi-VN') : n;

  const kpis = [
    { id: 'pipeline_value', label: t('dashboard.kpi.pipeline'), value: `${fmt(v('pipelineValue'))} đ`, trend: '12%', trendUp: true, sub: t('dashboard.kpi.updated') },
    { id: 'won_deals', label: t('dashboard.kpi.won'), value: v('wonDealsCount'), trend: `/ ${v('quotations')} ${t('dashboard.kpi.quotes')}`, trendUp: true },
    { id: 'win_rate', label: t('dashboard.kpi.win_rate'), value: `${v('winRate')}%`, trend: '2%', trendUp: true, sub: t('dashboard.kpi.based_on_quotes') },
  ];

  const salesFunnelSection = (
    <div style={{ background: tokens.colors.surface, borderRadius: tokens.radius.lg, padding: tokens.spacing.xl, border: `1px solid ${tokens.colors.border}`, boxShadow: tokens.shadow.sm }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h3 style={{ fontSize: '18px', fontWeight: 800, color: tokens.colors.textPrimary, margin: 0 }}>{t('dashboard.funnel.title')}</h3>
          <p style={{ fontSize: '13px', color: tokens.colors.textSecondary, margin: 0 }}>{t('dashboard.funnel.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', background: tokens.colors.background, padding: tokens.spacing.xs, borderRadius: tokens.radius.md, gap: tokens.spacing.xs }}>
          <button
            onClick={() => void loadDashboard()}
            disabled={refreshing}
            style={{
              padding: `${tokens.spacing.xs} ${tokens.spacing.md}`,
              border: 'none',
              background: tokens.colors.primary,
              borderRadius: tokens.radius.sm,
              fontSize: '12px',
              fontWeight: 600,
              color: tokens.colors.textOnPrimary,
              cursor: refreshing ? 'wait' : 'pointer',
              opacity: refreshing ? 0.72 : 1,
            }}
          >
            {refreshing ? 'Refreshing...' : t('dashboard.funnel.realtime')}
          </button>
        </div>
      </div>

      {(funnel.length > 0 ? funnel : [
        { label: 'LEADS', value: 0, color: tokens.colors.textPrimary },
        { label: 'QUALIFIED', value: 0, color: tokens.colors.textSecondary },
        { label: 'PROPOSAL', value: 0, color: tokens.colors.primary },
        { label: 'WON', value: 0, color: tokens.colors.success }
      ]).map((s, i, arr) => {
        const max = Math.max(...arr.map(x => x.value)) || 1;
        const width = `${(s.value / max) * 100}%`;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', gap: '16px' }}>
            <div style={{ width: '100px', fontSize: '11px', fontWeight: 700, color: tokens.colors.textMuted, textAlign: 'right' }}>{s.label}</div>
            <div style={{ flex: 1, position: 'relative' }}>
              <div style={{ 
                height: '36px', 
                width: width, 
                background: s.color, 
                borderRadius: tokens.radius.sm, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'flex-end', 
                paddingRight: tokens.spacing.md, 
                transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)',
                minWidth: s.value > 0 ? '40px' : '4px'
              }}>
                {s.value > 0 && <span style={{ color: tokens.colors.surface, fontSize: '13px', fontWeight: 700 }}>{s.value}</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  const recentActivitiesSection = (
    <div style={{ background: tokens.colors.surface, borderRadius: tokens.radius.lg, padding: tokens.spacing.xl, border: `1px solid ${tokens.colors.border}`, boxShadow: tokens.shadow.sm }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 800, color: tokens.colors.textPrimary, margin: 0 }}>{t('dashboard.activities.title')}</h3>
        <button
          onClick={() => onNavigate?.('EventLog')}
          title="Mở nhật ký sự kiện"
          style={{ background: 'none', border: 'none', color: tokens.colors.textMuted, cursor: 'pointer', fontSize: '18px' }}
        >
          •••
        </button>
      </div>

      {activities.map((a: any, i: number) => (
        <div key={i} style={{ display: 'flex', gap: '16px', marginBottom: '24px', cursor: 'pointer' }} onClick={() => setSelectedActivity(a)}>
          <div style={{ width: '40px', height: '40px', borderRadius: tokens.radius.md, background: a.color || tokens.colors.badgeBgSuccess, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
            <span style={{ color: a.iconColor || tokens.colors.textMuted }}>
              {renderActivityIcon(a.icon, a.category, 18)}
            </span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: tokens.colors.textPrimary, margin: 0, transition: 'color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color = tokens.colors.primary} onMouseLeave={(e) => e.currentTarget.style.color = tokens.colors.textPrimary}>
                 {a.title} {a.entityDisplay ? <span style={{ color: tokens.colors.textMuted }}>- {a.entityDisplay}</span> : ''}
              </h4>
            </div>
            <p style={{ fontSize: '12px', color: tokens.colors.textSecondary, margin: '2px 0 6px', lineHeight: 1.4 }}>{a.description}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: tokens.colors.textMuted }}>{formatTime(a.createdAt)}</span>
              <span style={{ width: '3px', height: '3px', background: tokens.colors.border, borderRadius: '50%' }} />
              <span style={{ fontSize: '10px', fontWeight: 700, color: a.iconColor || tokens.colors.success }}>{a.category}</span>
            </div>
          </div>
        </div>
      ))}
      
      <button 
        onClick={() => onNavigate?.('EventLog')}
        style={{ width: '100%', padding: tokens.spacing.md, background: 'none', border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.md, color: tokens.colors.textSecondary, fontSize: '13px', fontWeight: 600, cursor: 'pointer', marginTop: tokens.spacing.sm }}
      >
        {t('dashboard.activities.view_all')}
      </button>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <PageHero
        eyebrow="Tổng quan vận hành"
        title={t('dashboard.operations.title')}
        description={t('dashboard.operations.subtitle')}
        actions={[
          {
            key: 'refresh-dashboard',
            label: refreshing ? 'Đang làm mới...' : 'Làm mới số liệu',
            onClick: () => void loadDashboard(),
            variant: 'primary' as const,
          },
          {
            key: 'open-event-log',
            label: 'Mở nhật ký sự kiện',
            onClick: () => onNavigate?.('EventLog'),
            variant: 'outline' as const,
          },
        ]}
      />

      <div style={ui.page.metricGrid}>
        {kpis.map((k, i) => (
          <MetricCard
            key={i}
            label={k.label}
            value={k.value}
            accent={k.id === 'pipeline_value' ? tokens.colors.primary : undefined}
            hint={k.sub || (k.trend ? `${k.trendUp ? 'Tăng' : 'Giảm'} ${k.trend}` : undefined)}
          />
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '7fr 4fr', gap: isMobile ? '16px' : '24px' }}>
        {isMobile ? recentActivitiesSection : salesFunnelSection}
        {isMobile ? salesFunnelSection : recentActivitiesSection}
      </div>

      {selectedActivity && (
        <OverlayModal
          title={selectedActivity.title || 'Chi tiết hoạt động'}
          onClose={() => setSelectedActivity(null)}
          maxWidth="560px"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: tokens.radius.lg, background: selectedActivity.color || tokens.colors.badgeBgSuccess, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
              <span style={{ color: selectedActivity.iconColor || tokens.colors.textMuted }}>
                {renderActivityIcon(selectedActivity.icon, selectedActivity.category, 22)}
              </span>
            </div>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: tokens.colors.textPrimary }}>{selectedActivity.title}</h2>
              <span style={{ fontSize: '12px', fontWeight: 700, color: selectedActivity.iconColor || tokens.colors.success, display: 'inline-block', marginTop: '4px' }}>{selectedActivity.category}</span>
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <p style={{ fontSize: '14px', lineHeight: 1.6, color: tokens.colors.textSecondary, margin: 0 }}>
              {selectedActivity.description}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px', padding: tokens.spacing.lg, background: tokens.colors.background, borderRadius: tokens.radius.lg }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', fontSize: '13px' }}>
              <span style={{ color: tokens.colors.textMuted }}>Thời gian</span>
              <span style={{ fontWeight: 600, color: tokens.colors.textPrimary }}>{new Date(selectedActivity.createdAt).toLocaleString('vi-VN')}</span>
            </div>
            {selectedActivity.entityType && (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', fontSize: '13px' }}>
                <span style={{ color: tokens.colors.textMuted }}>Loại đối tượng</span>
                <span style={{ fontWeight: 600, color: tokens.colors.textPrimary }}>{selectedActivity.entityType}</span>
              </div>
            )}
            {selectedActivity.entityDisplay && (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', fontSize: '13px' }}>
                <span style={{ color: tokens.colors.textMuted }}>Bản ghi liên quan</span>
                <span style={{ fontWeight: 600, color: tokens.colors.textPrimary }}>{selectedActivity.entityDisplay}</span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setSelectedActivity(null)}
              style={{
                padding: `${tokens.spacing.md} ${tokens.spacing.lg}`,
                background: 'transparent',
                border: `1px solid ${tokens.colors.border}`,
                borderRadius: tokens.radius.md,
                color: tokens.colors.textSecondary,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Đóng
            </button>
            {selectedActivity.entityId && (
              <button
                type="button"
                onClick={() => {
                  setShowHistoryFor({ id: selectedActivity.entityId, name: selectedActivity.entityDisplay || selectedActivity.entityType });
                  setSelectedActivity(null);
                }}
                style={{
                  padding: `${tokens.spacing.md} ${tokens.spacing.lg}`,
                  background: 'transparent',
                  border: `1px solid ${tokens.colors.primary}`,
                  borderRadius: tokens.radius.md,
                  color: tokens.colors.primary,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Xem lịch sử
              </button>
            )}
            {(selectedActivity.link || selectedActivity.entityType) && (
              <button
                type="button"
                onClick={() => {
                  if (onNavigate) {
                    if (selectedActivity.entityType === 'Account') onNavigate('Accounts');
                    else if (selectedActivity.entityType === 'Contact') onNavigate('Contacts');
                    else if (selectedActivity.link) onNavigate(selectedActivity.link);
                  }
                  setSelectedActivity(null);
                }}
                style={{
                  padding: `${tokens.spacing.md} ${tokens.spacing.xl}`,
                  background: tokens.colors.primary,
                  border: 'none',
                  borderRadius: tokens.radius.md,
                  color: tokens.colors.textOnPrimary,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-block',
                }}
              >
                Xem chi tiết {selectedActivity.entityType === 'Account' ? 'công ty' : (selectedActivity.entityType === 'Contact' ? 'liên hệ' : 'mục')}
              </button>
            )}
          </div>
        </OverlayModal>
      )}
      
      {showHistoryFor && (
        <HistoryModal 
          entityId={showHistoryFor.id} 
          entityName={showHistoryFor.name} 
          onClose={() => setShowHistoryFor(null)} 
        />
      )}
    </div>
  );
}
