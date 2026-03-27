import htcLogoSrc from './assets/htc-logo.png';
import { useState, useEffect } from 'preact/hooks';
import { API_BASE } from './config';
import { tokens } from './ui/tokens';
import { ui } from './ui/styles';
import { type CurrentUser, ROLE_LABELS, buildRoleProfile, type SystemRole } from './auth';
import { getRolePreviewPresetNavigation, isRolePreviewPresetActive, normalizePreviewRoleCodes, ROLE_PREVIEW_PRESETS, type RolePreviewNavigation } from './authRolePreview';
import { useNotifications } from './ops/useNotifications';
import { NotificationBell } from './ops/NotificationBell';
import { useI18n } from './i18n';
import { setNavContext, type NavEntityType } from './navContext';
import type { AppModule } from './shared/domain/contracts';
import { QA_TEST_IDS, navItemTestId, previewPresetTestId } from './testing/testIds';
import {
  BriefcaseIcon,
  BuildingIcon,
  CalendarIcon,
  ChatIcon,
  CheckSquareIcon,
  ClipboardIcon,
  CloseIcon,
  CompassIcon,
  DashboardIcon,
  FolderIcon,
  HandshakeIcon,
  HeadphonesIcon,
  LoaderIcon,
  LogOutIcon,
  MenuIcon,
  MoneyIcon,
  MoonIcon,
  PackageIcon,
  PlusIcon,
  ReceiptIcon,
  ReportIcon,
  SearchIcon,
  SettingsIcon,
  SunIcon,
  TargetIcon,
  TrendingIcon,
  TruckIcon,
  UserIcon,
  UsersIcon,
} from './ui/icons';

type TabName = 'Workspace' | 'Records' | 'Admin';
type SearchEntityKind = NavEntityType | 'Product';
type SearchResultItem = {
  id: string;
  title?: string;
  subject?: string;
  type?: string;
  entityType?: string;
  entityId?: string;
};
type SearchResults = Record<string, SearchResultItem[]>;
type SearchNavContext = {
  route: AppModule;
  entityType?: NavEntityType;
  entityId?: string;
  filters?: {
    projectId?: string;
    accountId?: string;
    leadId?: string;
    quotationId?: string;
  };
  autoOpenEdit?: boolean;
};

const SECTION_I18N_KEYS: Record<string, string> = {
  'TỔNG QUAN': 'nav.section.overview',
  'SALES & CRM': 'nav.section.sales_crm',
  'BÁO CÁO': 'nav.section.reports',
  'QUẢN LÝ CÔNG VIỆC': 'nav.section.work_mgmt',
  'ERP (MVP)': 'nav.section.erp',
  'QUẢN TRỊ HỆ THỐNG': 'nav.section.system_admin',
  'CÀI ĐẶT': 'nav.section.settings',
};

const NAV_GROUPS: Record<TabName, { section: string; items: { label: AppModule; icon: (props: { size?: number; color?: string; strokeWidth?: number }) => any }[] }[]> = {
  Workspace: [
    {
      section: 'WORKSPACE',
      items: [
        { label: 'Home', icon: DashboardIcon },
        { label: 'My Work', icon: BriefcaseIcon },
        { label: 'Inbox', icon: ClipboardIcon },
        { label: 'Approvals', icon: CheckSquareIcon },
        { label: 'Projects', icon: FolderIcon },
        { label: 'Tasks', icon: CheckSquareIcon },
      ],
    },
    {
      section: 'OPERATIONS',
      items: [
        { label: 'ERP Orders', icon: ReceiptIcon },
        { label: 'Ops Overview', icon: CompassIcon },
        { label: 'Gantt', icon: CalendarIcon },
        { label: 'Ops Staff', icon: BriefcaseIcon },
        { label: 'Ops Chat', icon: ChatIcon },
      ],
    },
    {
      section: 'ANALYTICS',
      items: [
        { label: 'Reports', icon: ReportIcon },
      ],
    },
  ],
  Records: [
    {
      section: 'COMMERCIAL',
      items: [
        { label: 'Sales', icon: MoneyIcon },
        { label: 'Leads', icon: TargetIcon },
        { label: 'Accounts', icon: BuildingIcon },
        { label: 'Contacts', icon: UserIcon },
        { label: 'Partners', icon: HandshakeIcon },
      ],
    },
    {
      section: 'MASTER DATA',
      items: [
        { label: 'Equipment', icon: PackageIcon },
        { label: 'Suppliers', icon: TruckIcon },
        { label: 'Pricing', icon: TrendingIcon },
      ],
    },
  ],
  Admin: [
    {
      section: 'QUẢN TRỊ HỆ THỐNG',
      items: [
        { label: 'Users', icon: UsersIcon },
        { label: 'EventLog', icon: ClipboardIcon },
      ],
    },
    {
      section: 'CÀI ĐẶT',
      items: [
        { label: 'Settings', icon: SettingsIcon },
        { label: 'Support', icon: HeadphonesIcon },
      ],
    },
  ],
};

const WORKSPACE_ROUTES = ['Home', 'My Work', 'Inbox', 'Approvals', 'Projects', 'Tasks', 'ERP Orders', 'Reports', 'Ops Overview', 'Gantt', 'Ops Staff', 'Ops Chat'];
const RECORD_ROUTES = ['Leads', 'Accounts', 'Contacts', 'Equipment', 'Suppliers', 'Partners', 'Sales', 'Pricing'];
const ADMIN_ROUTES = ['Users', 'EventLog', 'Settings', 'Support'];

const SEARCH_ROUTE_BY_ENTITY: Partial<Record<SearchEntityKind, AppModule>> = {
  Account: 'Accounts',
  Lead: 'Leads',
  Quotation: 'Sales',
  Project: 'Projects',
  Task: 'Tasks',
  Product: 'Equipment',
};

const SEARCH_FILTER_BY_ENTITY: Partial<Record<NavEntityType, (id: string) => SearchNavContext['filters']>> = {
  Account: (id) => ({ accountId: id }),
  Lead: (id) => ({ leadId: id }),
  Quotation: (id) => ({ quotationId: id }),
  Project: (id) => ({ projectId: id }),
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeSearchResults(raw: unknown): SearchResults {
  if (!isRecord(raw)) return {};

  return Object.entries(raw).reduce<SearchResults>((acc, [key, value]) => {
    if (!Array.isArray(value)) return acc;
    acc[key] = value.filter((item): item is SearchResultItem => isRecord(item) && typeof item.id === 'string');
    return acc;
  }, {});
}

function getSearchEntityType(item: SearchResultItem): NavEntityType | undefined {
  const rawType = item.entityType ?? item.type;
  return rawType === 'Account' || rawType === 'Lead' || rawType === 'Quotation' || rawType === 'Project' || rawType === 'Task'
    ? rawType
    : undefined;
}

function getSearchRoute(groupKey: string, item: SearchResultItem): AppModule | '' {
  const entityType = getSearchEntityType(item);
  if (entityType && SEARCH_ROUTE_BY_ENTITY[entityType]) {
    return SEARCH_ROUTE_BY_ENTITY[entityType]!;
  }

  const rawType = (item.type ?? groupKey).toLowerCase();
  if (rawType === 'products' || rawType === 'product') return SEARCH_ROUTE_BY_ENTITY.Product!;
  if (rawType === 'quotations' || rawType === 'quotation') return SEARCH_ROUTE_BY_ENTITY.Quotation!;
  if (rawType === 'leads' || rawType === 'lead') return SEARCH_ROUTE_BY_ENTITY.Lead!;
  if (rawType === 'accounts' || rawType === 'account') return SEARCH_ROUTE_BY_ENTITY.Account!;
  if (rawType === 'projects' || rawType === 'project') return SEARCH_ROUTE_BY_ENTITY.Project!;
  if (rawType === 'tasks' || rawType === 'task') return SEARCH_ROUTE_BY_ENTITY.Task!;
  return '';
}

function buildSearchNavContext(groupKey: string, item: SearchResultItem): SearchNavContext | null {
  const entityType = getSearchEntityType(item);
  if (!entityType || !SEARCH_FILTER_BY_ENTITY[entityType]) return null;

  const route = getSearchRoute(groupKey, item);
  if (!route) return null;
  const entityId = item.entityId ?? item.id;
  const filters = SEARCH_FILTER_BY_ENTITY[entityType]!(entityId);

  return {
    route,
    entityType,
    entityId,
    autoOpenEdit: true,
    filters,
  };
}

function canAccessSearchRoute(route: AppModule | '', allowedModules: AppModule[]) {
  if (!route) return false;
  return allowedModules.includes(route);
}

export const Layout = ({
  children,
  currentRoute,
  onNavigate,
  isDarkMode,
  toggleDarkMode,
  isMobile,
  currentUser,
  onRolePreviewChange,
  contentTestId,
}: {
  children: any;
  currentRoute?: string;
  onNavigate?: (route: string) => void;
  isDarkMode?: boolean;
  toggleDarkMode?: () => void;
  isMobile?: boolean;
  currentUser?: CurrentUser | null;
  onRolePreviewChange?: (previewRoleCodes?: SystemRole[], navigation?: RolePreviewNavigation) => void;
  contentTestId?: string;
}) => {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabName>('Workspace');
  const notifications = useNotifications(currentUser?.token ?? null);

  const roleProfile = currentUser ? buildRoleProfile(currentUser.roleCodes, currentUser.systemRole) : null;
  const allowedModules = roleProfile?.allowedModules ?? [];
  const trimmedSearchQuery = searchQuery.trim();
  const hasSearchQuery = trimmedSearchQuery.length > 1;
  const visibleTabs = (['Workspace', 'Records', 'Admin'] as TabName[]).filter((tab) =>
    NAV_GROUPS[tab].some((group) => group.items.some((item) => allowedModules.includes(item.label))),
  );
  const searchSections = searchResults
    ? Object.entries(searchResults)
        .map(([key, list]) => [key, list.filter((item) => canAccessSearchRoute(getSearchRoute(key, item), allowedModules))] as const)
        .filter(([, list]) => list.length > 0)
    : [];

  useEffect(() => {
    if (WORKSPACE_ROUTES.includes(currentRoute || '')) setActiveTab('Workspace');
    else if (RECORD_ROUTES.includes(currentRoute || '')) setActiveTab('Records');
    else if (ADMIN_ROUTES.includes(currentRoute || '')) setActiveTab('Admin');
  }, [currentRoute]);

  useEffect(() => {
    if (!isDrawerOpen || !isMobile) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsDrawerOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isDrawerOpen, isMobile]);

  useEffect(() => {
    if (!isDrawerOpen || !isMobile) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isDrawerOpen, isMobile]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    if (hasSearchQuery) {
      setIsSearching(true);
      setSearchResults(null);
      timeout = setTimeout(() => {
        fetch(`${API_BASE}/search?q=${encodeURIComponent(trimmedSearchQuery)}`)
          .then((res) => res.json())
          .then((data) => {
            if (cancelled) return;
            setSearchResults(normalizeSearchResults(data));
            setIsSearching(false);
          })
          .catch(() => {
            if (cancelled) return;
            setIsSearching(false);
            setSearchResults({});
          });
      }, 500);
    } else {
      setSearchResults(null);
      setIsSearching(false);
    }

    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [trimmedSearchQuery, hasSearchQuery]);

  useEffect(() => {
    if (visibleTabs.length === 0) return;
    if (!visibleTabs.includes(activeTab)) {
      setActiveTab(visibleTabs[0]);
    }
  }, [activeTab, visibleTabs]);

  const navigateToTab = (tab: TabName) => {
    setActiveTab(tab);
    const groups = NAV_GROUPS[tab];
    for (const group of groups) {
      for (const item of group.items) {
        if (allowedModules.includes(item.label)) {
          onNavigate?.(item.label);
          return;
        }
      }
    }
  };

  const handleTabClick = (tab: TabName) => {
    const routeAlreadyInTab =
      (tab === 'Workspace' && WORKSPACE_ROUTES.includes(currentRoute || '')) ||
      (tab === 'Records' && RECORD_ROUTES.includes(currentRoute || '')) ||
      (tab === 'Admin' && ADMIN_ROUTES.includes(currentRoute || ''));

    if (routeAlreadyInTab) {
      setActiveTab(tab);
    } else {
      navigateToTab(tab);
    }
  };

  const renderTabButton = (tab: TabName, compact = false) => {
    const active = activeTab === tab;

    if (compact) {
      return (
        <button
          key={tab}
          type="button"
          onClick={() => handleTabClick(tab)}
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: active ? tokens.colors.primary : tokens.colors.textSecondary,
            background: active ? tokens.colors.badgeBgSuccess : tokens.colors.background,
            border: `1px solid ${active ? tokens.colors.primary : tokens.colors.border}`,
            borderRadius: tokens.radius.md,
            padding: '6px 10px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
          aria-current={active ? 'page' : undefined}
        >
          {tab === 'Workspace' ? 'Workspace' : tab === 'Records' ? 'Master Data' : 'Admin'}
        </button>
      );
    }

    return (
      <button
        key={tab}
        type="button"
        onClick={() => handleTabClick(tab)}
        style={{
          fontSize: '14px',
          fontWeight: 600,
          color: active ? tokens.colors.primary : tokens.colors.textSecondary,
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
          borderBottom: active ? `2px solid ${tokens.colors.primary}` : '2px solid transparent',
          transition: 'color 0.2s ease, border-color 0.2s ease',
          background: 'transparent',
          borderLeft: 'none',
          borderRight: 'none',
          borderTop: 'none',
          padding: 0,
        }}
        aria-current={active ? 'page' : undefined}
      >
        {tab === 'Workspace' ? 'Workspace' : tab === 'Records' ? 'Master Data' : 'Admin'}
      </button>
    );
  };

  const renderNavGroups = (tab: TabName, onItemClick?: () => void) => {
    return NAV_GROUPS[tab].map((group) => {
      const visibleItems = group.items.filter((item) => allowedModules.includes(item.label));
      if (visibleItems.length === 0) return null;

      const sectionKey = SECTION_I18N_KEYS[group.section];
      const sectionLabel = sectionKey ? t(sectionKey) : group.section;

      return (
        <div key={group.section}>
          <div
            style={{
              padding: '16px 16px 4px',
              fontSize: '10px',
              fontWeight: 800,
              color: tokens.colors.textMuted,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            {sectionLabel}
          </div>
          {visibleItems.map((item) => {
            const isActive = currentRoute === item.label;
            const routeKey = `route.${item.label}`;
            const Icon = item.icon;
            const routeLabel = (() => {
              const translated = t(routeKey);
              return translated === routeKey ? item.label : translated;
            })();

            return (
              <button
                type="button"
                key={item.label}
                data-testid={navItemTestId(item.label)}
                onClick={() => {
                  onItemClick?.();
                  onNavigate?.(item.label);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  padding: '10px 16px',
                  borderRadius: tokens.radius.lg,
                  marginBottom: '4px',
                  textDecoration: 'none',
                  fontSize: '14px',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? tokens.colors.primary : tokens.colors.textSecondary,
                  backgroundColor: isActive ? tokens.colors.badgeBgSuccess : 'transparent',
                  transition: 'all 0.2s ease',
                  borderRight: isActive ? `3px solid ${tokens.colors.primary}` : '3px solid transparent',
                  borderTop: 'none',
                  borderLeft: 'none',
                  borderBottom: 'none',
                  textAlign: 'left',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                  <span
                    style={{
                      width: '18px',
                      height: '18px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isActive ? tokens.colors.primary : tokens.colors.textMuted,
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={18} strokeWidth={1.85} />
                  </span>
                    <span>{routeLabel}</span>
                  </span>
                {item.label === 'Ops Chat' && notifications.unreadCount > 0 && (
                  <span
                    style={{
                      minWidth: '20px',
                      height: '20px',
                      padding: '0 6px',
                      borderRadius: '999px',
                      background: tokens.colors.warning,
                      color: '#fff',
                      fontSize: '11px',
                      fontWeight: 800,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {notifications.unreadCount > 99 ? '99+' : notifications.unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      );
    });
  };

  const renderSearchResult = (groupKey: string, item: SearchResultItem) => {
    const route = getSearchRoute(groupKey, item);
    const navContext = buildSearchNavContext(groupKey, item);
    const resultLabel = item.title || item.subject || item.id;
    const detailLabel = item.subject && item.subject !== resultLabel ? item.subject : '';

    return (
      <button
        key={item.id}
        type="button"
        onClick={() => {
          if (navContext) setNavContext(navContext);
          if (route) onNavigate?.(route);
          setSearchQuery('');
          setSearchResults(null);
          setIsSearching(false);
        }}
        style={{
          width: '100%',
          textAlign: 'left',
          border: 'none',
          background: 'transparent',
          padding: '8px 12px',
          cursor: 'pointer',
          transition: 'background 0.2s',
        }}
        onMouseEnter={(e: any) => (e.currentTarget.style.background = tokens.colors.background)}
        onMouseLeave={(e: any) => (e.currentTarget.style.background = 'transparent')}
      >
        <div style={{ fontSize: '13px', fontWeight: 600 }}>{resultLabel}</div>
        {detailLabel && <div style={{ fontSize: '11px', color: tokens.colors.textMuted }}>{detailLabel}</div>}
      </button>
    );
  };

  const roleSummary = roleProfile
    ? roleProfile.personaMode === 'sales_pm_combined'
      ? 'Sales + Project Manager'
      : roleProfile.roleCodes.map((roleCode) => ROLE_LABELS[roleCode]).join(', ')
    : '';
  const isRolePreviewActive = Boolean(currentUser?.isRolePreviewActive && currentUser?.previewRoleCodes?.length);
  const previewRoleCodes = normalizePreviewRoleCodes(currentUser?.previewRoleCodes);
  const previewLabel = previewRoleCodes.map((roleCode) => ROLE_LABELS[roleCode]).join(' + ') || '';

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'var(--font-family-sans)', overflow: 'hidden', backgroundColor: tokens.colors.background }}>
      {/* Desktop Side Navigation */}
      <aside style={{
        width: '240px',
        background: tokens.colors.surface,
        display: isMobile ? 'none' : 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        borderRight: `1px solid ${tokens.colors.border}`,
        zIndex: 10,
        transition: 'background-color 0.3s ease, border-color 0.3s ease',
      }}>
        {/* Logo area */}
        <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src={htcLogoSrc} alt="HTC Logo" style={{ width: '44px', height: '44px', objectFit: 'contain', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: tokens.colors.primary, letterSpacing: '-0.02em', lineHeight: 1 }}>Huynh Thy Group</div>
            <div style={{ fontSize: '9px', fontWeight: 700, color: tokens.colors.textSecondary, marginTop: '3px', letterSpacing: '0.06em' }}>ENTERPRISE CRM</div>
          </div>
        </div>

        {/* Grouped Nav */}
        <nav data-testid={QA_TEST_IDS.layout.sidebar} style={{ flex: 1, padding: '0 12px', overflowY: 'auto' }}>
          {renderNavGroups(activeTab)}
        </nav>

        {/* Footer */}
        <div style={{ padding: '16px 20px', borderTop: `1px solid ${tokens.colors.border}`, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {allowedModules.includes('Sales') && (
            <button
              type="button"
              onClick={() => onNavigate?.('NewDeal')}
              style={{
                ...ui.btn.primary,
                width: '100%',
                justifyContent: 'center',
                boxShadow: tokens.shadow.md,
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                <PlusIcon size={18} strokeWidth={2} color={tokens.colors.textOnPrimary} />
              </span>
              {t('nav.action.new_deal')}
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate?.('Logout')}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', color: tokens.colors.error, padding: '4px 0', border: 'none', background: 'transparent', textAlign: 'left' }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center' }}>
              <LogOutIcon size={18} strokeWidth={1.9} color={tokens.colors.error} />
            </span>
            <span style={{ fontSize: '14px', fontWeight: 500 }}>{t('nav.action.logout')}</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer Backdrop */}
      {isMobile && isDrawerOpen && (
        <button
          type="button"
          aria-label={t('nav.menu.close')}
          onClick={() => setIsDrawerOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            zIndex: 40,
            border: 'none',
            padding: 0,
          }}
        />
      )}

      {/* Mobile Drawer */}
      {isMobile && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('nav.menu.mobile_label')}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            height: '100vh',
            width: '280px',
            background: tokens.colors.surface,
            borderRight: `1px solid ${tokens.colors.border}`,
            transform: isDrawerOpen ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform 0.25s ease',
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Drawer Header */}
          <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: `1px solid ${tokens.colors.border}` }}>
            <img src={htcLogoSrc} alt="HTC Logo" style={{ width: '40px', height: '40px', objectFit: 'contain', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.primary, letterSpacing: '-0.02em', lineHeight: 1 }}>Huynh Thy Group</div>
              <div style={{ fontSize: '9px', fontWeight: 700, color: tokens.colors.textSecondary, marginTop: '3px', letterSpacing: '0.06em' }}>ENTERPRISE CRM</div>
            </div>
            <button
              type="button"
              onClick={() => setIsDrawerOpen(false)}
              style={{
                background: tokens.colors.background,
                border: `1px solid ${tokens.colors.border}`,
                borderRadius: tokens.radius.md,
                width: '32px',
                height: '32px',
                cursor: 'pointer',
              }}
              aria-label={t('nav.menu.close')}
            >
              <CloseIcon size={16} strokeWidth={2} color={tokens.colors.textPrimary} />
            </button>
          </div>

          {/* Drawer Tab Pills */}
            <div style={{ padding: '12px 16px', display: 'flex', gap: '8px', borderBottom: `1px solid ${tokens.colors.border}` }}>
            {visibleTabs.map((tab) => renderTabButton(tab, true))}
          </div>

          {/* Drawer Nav */}
          <nav style={{ flex: 1, padding: '0 12px', overflowY: 'auto' }}>
            {renderNavGroups(activeTab, () => setIsDrawerOpen(false))}
          </nav>

          {/* Drawer Footer */}
          <div style={{ padding: '16px', borderTop: `1px solid ${tokens.colors.border}`, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {allowedModules.includes('Sales') && (
              <button
                type="button"
                onClick={() => {
                  setIsDrawerOpen(false);
                  onNavigate?.('NewDeal');
                }}
                style={{
                  ...ui.btn.primary,
                  width: '100%',
                  justifyContent: 'center',
                  boxShadow: tokens.shadow.md,
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <PlusIcon size={18} strokeWidth={2} color={tokens.colors.textOnPrimary} />
                </span>
                {t('nav.action.new_deal')}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setIsDrawerOpen(false);
                onNavigate?.('Logout');
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', color: tokens.colors.error, padding: '4px 0', border: 'none', background: 'transparent', textAlign: 'left' }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                <LogOutIcon size={18} strokeWidth={1.9} color={tokens.colors.error} />
              </span>
              <span style={{ fontSize: '14px', fontWeight: 500 }}>{t('nav.action.logout')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top Header */}
        <header style={{
          height: isMobile ? 'auto' : '64px',
          background: tokens.colors.surface,
          display: 'flex',
          alignItems: isMobile ? 'stretch' : 'center',
          justifyContent: 'space-between',
          padding: isMobile ? '12px 16px' : '0 32px',
          flexShrink: 0,
          borderBottom: `1px solid ${tokens.colors.border}`,
          transition: 'background-color 0.3s ease, border-color 0.3s ease',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? '10px' : '0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '12px' : '32px' }}>
            {isMobile && (
              <button
                type="button"
                onClick={() => setIsDrawerOpen(true)}
                style={{
                  background: tokens.colors.background,
                  border: `1px solid ${tokens.colors.border}`,
                  borderRadius: tokens.radius.md,
                  width: '36px',
                  height: '36px',
                  cursor: 'pointer',
                  fontSize: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                aria-label={t('nav.menu.open')}
                aria-expanded={isDrawerOpen}
              >
                <MenuIcon size={18} strokeWidth={2} color={tokens.colors.textPrimary} />
              </button>
            )}

            {/* Search */}
            <div style={{ position: 'relative', flex: isMobile ? 1 : undefined }}>
              <input
                type="text"
                value={searchQuery}
                onInput={(e: any) => setSearchQuery(e.target.value)}
                placeholder={t('nav.search.placeholder')}
                data-testid={QA_TEST_IDS.layout.searchInput}
                style={{
                  ...ui.input.base,
                  width: isMobile ? '100%' : '320px',
                  padding: '10px 16px 10px 40px',
                  fontSize: '14px',
                }}
              />
              <span style={{ position: 'absolute', left: '14px', top: '12px', color: tokens.colors.textMuted }}>
                {isSearching ? (
                  <LoaderIcon size={16} strokeWidth={2} color={tokens.colors.textMuted} />
                ) : (
                  <SearchIcon size={16} strokeWidth={2} color={tokens.colors.textMuted} />
                )}
              </span>

              {hasSearchQuery && (isSearching || searchResults) && (
                <div style={{
                  position: 'absolute',
                  top: '48px',
                  left: 0,
                  right: isMobile ? 0 : undefined,
                  width: isMobile ? '100%' : '400px',
                  maxWidth: isMobile ? '100%' : '400px',
                  background: tokens.colors.surface,
                  border: `1px solid ${tokens.colors.border}`,
                  borderRadius: tokens.radius.lg,
                  boxShadow: tokens.shadow.md,
                  overflow: 'hidden',
                  zIndex: 1000,
                  padding: '8px 0',
                }}>
                  {isSearching && (
                    <div style={{ padding: '12px', fontSize: '13px', color: tokens.colors.textSecondary }}>
                      Đang tìm kiếm...
                    </div>
                  )}
                  {!isSearching && searchResults && searchSections.length === 0 && (
                    <div style={{ padding: '12px', fontSize: '13px', color: tokens.colors.textSecondary, lineHeight: 1.6 }}>
                      <div style={{ fontWeight: 700, color: tokens.colors.textPrimary }}>Không tìm thấy kết quả phù hợp.</div>
                      <div style={{ marginTop: '4px' }}>Thử từ khóa khác hoặc rút ngắn truy vấn.</div>
                    </div>
                  )}
                  {!isSearching && searchSections.map(([key, list]) => (
                    <div key={key}>
                      <div style={{ padding: '4px 12px', fontSize: '10px', fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase' }}>{key}</div>
                      {list.map((item) => renderSearchResult(key, item))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Desktop Header Tabs */}
            {!isMobile && (
              <nav data-testid={QA_TEST_IDS.layout.topTabs} style={{ display: 'flex', gap: '24px', height: '64px', alignItems: 'center' }}>
                {visibleTabs.map((tab) => renderTabButton(tab))}
              </nav>
            )}
          </div>

          {/* Right side: dark mode, notifications, avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '12px' : '20px', justifyContent: isMobile ? 'space-between' : 'flex-end' }}>
            <div style={{ display: 'flex', gap: isMobile ? '10px' : '16px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={toggleDarkMode}
                style={{
                  background: tokens.colors.background,
                  border: `1px solid ${tokens.colors.border}`,
                  borderRadius: tokens.radius.lg,
                  width: '36px',
                  height: '36px',
                  cursor: 'pointer',
                  fontSize: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title={isDarkMode ? t('nav.theme.light') : t('nav.theme.dark')}
              >
                {isDarkMode ? (
                  <SunIcon size={18} strokeWidth={1.9} color={tokens.colors.textPrimary} />
                ) : (
                  <MoonIcon size={18} strokeWidth={1.9} color={tokens.colors.textPrimary} />
                )}
              </button>

              <NotificationBell
                unreadCount={notifications.unreadCount}
                items={notifications.items}
                loading={notifications.loading}
                onRefresh={notifications.refresh}
                onMarkRead={notifications.markRead}
                onMarkAllRead={notifications.markAllRead}
                onNavigate={onNavigate}
                compact
              />
              {allowedModules.includes('Ops Chat') ? (
                <button
                  type="button"
                  title={t('nav.chat.title')}
                  onClick={() => onNavigate?.('Ops Chat')}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: tokens.radius.lg,
                    border: `1px solid ${tokens.colors.border}`,
                    background: tokens.colors.background,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    color: tokens.colors.textPrimary,
                  }}
                  aria-label={t('nav.chat.title')}
                >
                  <ChatIcon size={18} strokeWidth={1.9} color={tokens.colors.textPrimary} />
                </button>
              ) : null}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderLeft: isMobile ? 'none' : `1px solid ${tokens.colors.border}`, paddingLeft: isMobile ? '0' : '20px' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: tokens.colors.textPrimary }}>{currentUser?.fullName ?? 'Guest'}</div>
                <div style={{ fontSize: '11px', color: tokens.colors.textSecondary }}>{roleSummary}</div>
              </div>
              <button
                type="button"
                title={t('nav.action.logout')}
                onClick={() => onNavigate && onNavigate('Logout')}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: tokens.radius.md,
                  background: tokens.colors.border,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  border: 'none',
                  padding: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                aria-label={t('nav.action.logout')}
              >
                <img
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent((currentUser?.fullName ?? 'U').slice(0, 2))}&background=${isDarkMode ? '1E293B' : '009B6E'}&color=fff`}
                  alt="User"
                />
              </button>
            </div>
          </div>

        </header>

        {isRolePreviewActive ? (
          <div data-testid={QA_TEST_IDS.layout.previewBanner} style={{ padding: isMobile ? '10px 12px' : '10px 16px', borderBottom: `1px solid ${tokens.colors.border}`, background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(234, 179, 8, 0.05) 100%)', display: 'grid', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '13px', color: tokens.colors.textPrimary, lineHeight: 1.5 }}>
                <strong>Role preview:</strong> đang xem hệ thống như <strong>{previewLabel}</strong>. {previewRoleCodes.length === 1 && previewRoleCodes[0] === 'viewer' ? 'Viewer preview chỉ mở bề mặt read-only và không dùng chung với trạng thái admin gốc.' : 'Base admin identity vẫn được giữ để thoát preview hoặc quay lại kiểm tra hệ thống.'}
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  data-testid={QA_TEST_IDS.layout.previewOpenSettings}
                  onClick={() => onRolePreviewChange?.(previewRoleCodes, { route: 'Settings' })}
                  style={ui.btn.outline as any}
                >
                  Mở Settings
                </button>
                <button type="button" data-testid={QA_TEST_IDS.layout.previewBackToAdmin} onClick={() => onRolePreviewChange?.(undefined)} style={ui.btn.primary as any}>Quay lại admin</button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {ROLE_PREVIEW_PRESETS.map((preset) => {
                const nextRoles = normalizePreviewRoleCodes(preset.roleCodes);
                const active = isRolePreviewPresetActive(previewRoleCodes, preset.roleCodes);
                return (
                  <button
                    key={preset.key}
                    type="button"
                    data-testid={previewPresetTestId(preset.key)}
                    onClick={() => onRolePreviewChange?.(nextRoles.length > 0 ? nextRoles : undefined, getRolePreviewPresetNavigation(preset.key))}
                    style={{
                      ...ui.btn.outline,
                      padding: isMobile ? '8px 10px' : '8px 12px',
                      fontSize: '12px',
                      fontWeight: 700,
                      background: active ? tokens.colors.primary : tokens.colors.surface,
                      color: active ? tokens.colors.textOnPrimary : tokens.colors.textPrimary,
                      borderColor: active ? tokens.colors.primary : tokens.colors.border,
                    }}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Dynamic Page Content */}
        <div data-testid={contentTestId || QA_TEST_IDS.appContent} style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '12px' : '10px' }}>
          {children}
        </div>
      </main>
    </div>
  );
};
