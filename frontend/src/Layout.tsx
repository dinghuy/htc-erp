import htcLogoSrc from './assets/htc-logo.png';
import { useState, useEffect, useRef } from 'preact/hooks';
import { API_BASE } from './config';
import { tokens } from './ui/tokens';
import { ui } from './ui/styles';
import { type CurrentUser, ROLE_LABELS, buildRoleProfile, type SystemRole } from './auth';
import { getRolePreviewPresetNavigation, isRolePreviewPresetActive, normalizePreviewRoleCodes, ROLE_PREVIEW_PRESETS, type RolePreviewNavigation } from './authRolePreview';
import { useNotifications } from './ops/useNotifications';
import { NotificationBell } from './ops/NotificationBell';
import { useI18n } from './i18n';
import { getShellNavigationGroups } from './layoutNavigation';
import { setNavContext, type NavEntityType } from './navContext';
import type { AppModule } from './shared/domain/contracts';
import { QA_TEST_IDS, navItemTestId, previewPresetTestId } from './testing/testIds';
import {
  ChatIcon,
  CloseIcon,
  LoaderIcon,
  LogOutIcon,
  MenuIcon,
  MoonIcon,
  PlusIcon,
  SearchIcon,
  SunIcon,
} from './ui/icons';

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
  'MAINTENANCE ONLY': 'nav.section.maintenance_only',
  'QUẢN TRỊ HỆ THỐNG': 'nav.section.system_admin',
  'CÀI ĐẶT': 'nav.section.settings',
};

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

function getAvatarInitials(fullName?: string | null) {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
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
  const contentScrollRef = useRef<HTMLDivElement | null>(null);
  const notifications = useNotifications(currentUser?.token ?? null);

  const roleProfile = currentUser ? buildRoleProfile(currentUser.roleCodes, currentUser.systemRole) : null;
  const allowedModules = roleProfile?.allowedModules ?? [];
  const trimmedSearchQuery = searchQuery.trim();
  const hasSearchQuery = trimmedSearchQuery.length > 1;
  const shellNavigationGroups = getShellNavigationGroups(allowedModules, (group, fallback) => {
    if (group === 'Workspace') return t('nav.tab.workspace');
    if (group === 'Records') return t('nav.tab.master_data');
    if (group === 'Admin') return t('nav.tab.admin_primary');
    return fallback;
  });
  const searchSections = searchResults
    ? Object.entries(searchResults)
        .map(([key, list]) => [key, list.filter((item) => canAccessSearchRoute(getSearchRoute(key, item), allowedModules))] as const)
        .filter(([, list]) => list.length > 0)
    : [];

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
    contentScrollRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [currentRoute]);

  const renderNavGroups = (onItemClick?: () => void) => {
    return shellNavigationGroups.map((category) => {
      const renderedSections = category.groups.map((group) => {
        const sectionKey = SECTION_I18N_KEYS[group.section];
        const sectionLabel = sectionKey ? t(sectionKey) : group.section;

        return (
          <div key={`${category.key}-${group.section}`}>
            {group.showSectionLabel ? (
              <div
                style={{
                  padding: '8px 16px 4px',
                  fontSize: '10px',
                  fontWeight: 800,
                  color: tokens.colors.textMuted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}
              >
                {sectionLabel}
              </div>
            ) : null}
            {group.items.map((item) => {
              const isActive = currentRoute === item.label;
              const routeKey = `route.${item.label}`;
              const Icon = item.icon;
              const translated = t(routeKey);
              const routeLabel = translated === routeKey ? item.label : translated;
              const showMaintenanceBadge = item.phaseOneExposure === 'maintenance';

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
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <span>{routeLabel}</span>
                      {showMaintenanceBadge ? (
                        <span
                          style={{
                            padding: '2px 6px',
                            borderRadius: '999px',
                            background: tokens.colors.warningTint,
                            color: tokens.colors.warningText,
                            fontSize: '10px',
                            fontWeight: 800,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            flexShrink: 0,
                          }}
                        >
                          {t('nav.badge.maintenance_only')}
                        </span>
                      ) : null}
                    </span>
                  </span>
                  {item.label === 'Ops Chat' && notifications.unreadCount > 0 ? (
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
                  ) : null}
                </button>
              );
            })}
          </div>
        );
      });

      return (
        <div key={category.key} style={{ display: 'grid', gap: '4px' }}>
          <div
            style={{
              padding: '18px 16px 6px',
              fontSize: '11px',
              fontWeight: 800,
              color: tokens.colors.textPrimary,
              letterSpacing: '0.01em',
            }}
          >
            {category.label}
          </div>
          {renderedSections}
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
    ? Array.from(new Set(roleProfile.roleCodes.map((roleCode) => ROLE_LABELS[roleCode]).filter(Boolean))).join(', ')
    : '';
  const canManageRolePreview = Boolean(
    currentUser?.baseRoleCodes?.includes('admin')
      || currentUser?.roleCodes?.includes?.('admin')
      || currentUser?.systemRole === 'admin'
      || currentUser?.baseSystemRole === 'admin',
  );
  const isRolePreviewActive = Boolean(currentUser?.isRolePreviewActive && currentUser?.previewRoleCodes?.length);
  const previewRoleCodes = normalizePreviewRoleCodes(currentUser?.previewRoleCodes);
  const previewLabel = previewRoleCodes.map((roleCode) => ROLE_LABELS[roleCode]).join(' + ') || 'Admin';
  const avatarInitials = getAvatarInitials(currentUser?.fullName);

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', maxWidth: '100vw', fontFamily: 'var(--font-family-sans)', overflow: 'hidden', backgroundColor: tokens.colors.background }}>
      {/* Desktop Side Navigation */}
      <aside style={{
        width: '240px',
        background: tokens.colors.surface,
        display: isMobile ? 'none' : 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        borderRight: `1px solid ${tokens.colors.border}`,
        zIndex: tokens.zIndex.sticky,
        transition: 'background-color 0.3s ease, border-color 0.3s ease',
      }}>
        {/* Logo area */}
        <div style={{ padding: tokens.spacing.lg, display: 'flex', alignItems: 'center', gap: tokens.spacing.md }}>
          <img src={htcLogoSrc} alt="HTC Logo" style={{ width: '44px', height: '44px', objectFit: 'contain', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: tokens.colors.primary, letterSpacing: '-0.02em', lineHeight: 1 }}>Huynh Thy Group</div>
            <div style={{ fontSize: '9px', fontWeight: 700, color: tokens.colors.textSecondary, marginTop: '3px', letterSpacing: '0.06em' }}>ENTERPRISE CRM</div>
          </div>
        </div>

        {/* Grouped Nav */}
        <nav className="scrollbar-none" data-testid={QA_TEST_IDS.layout.sidebar} style={{ flex: 1, padding: `0 ${tokens.spacing.md}`, overflowY: 'auto' }}>
          {renderNavGroups()}
        </nav>

        {/* Footer */}
        <div style={{ padding: `${tokens.spacing.lg} ${tokens.spacing.xl}`, borderTop: `1px solid ${tokens.colors.border}`, display: 'flex', flexDirection: 'column', gap: tokens.spacing.sm }}>
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
            background: tokens.overlay.softBackdrop,
            backdropFilter: `blur(${tokens.overlay.backdropBlur})`,
            WebkitBackdropFilter: `blur(${tokens.overlay.backdropBlur})`,
            zIndex: tokens.zIndex.overlayBackdrop,
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
            zIndex: tokens.zIndex.drawer,
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

          {/* Drawer Nav */}
          <nav className="scrollbar-none" style={{ flex: 1, padding: '0 12px', overflowY: 'auto' }}>
            {renderNavGroups(() => setIsDrawerOpen(false))}
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
      <main style={{ flex: 1, minWidth: 0, width: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top Header */}
        <header style={{
          height: isMobile ? 'auto' : '64px',
          background: tokens.colors.surface,
          display: 'flex',
          alignItems: isMobile ? 'stretch' : 'center',
          justifyContent: 'space-between',
          padding: isMobile ? `${tokens.spacing.md} ${tokens.spacing.lg}` : `0 ${tokens.spacing.xxl}`,
          flexShrink: 0,
          borderBottom: `1px solid ${tokens.colors.border}`,
          transition: 'background-color 0.3s ease, border-color 0.3s ease',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? tokens.spacing.md : '0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? tokens.spacing.md : tokens.spacing.xl, minWidth: 0, flex: 1 }}>
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
            <div style={{ position: 'relative', flex: isMobile ? 1 : undefined, minWidth: 0 }}>
              <input
                id="global-search"
                name="globalSearch"
                type="text"
                value={searchQuery}
                onInput={(e: any) => setSearchQuery(e.target.value)}
                placeholder={t('nav.search.placeholder')}
                aria-label={t('nav.search.placeholder')}
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
                  ...ui.overlay.menu,
                  borderRadius: tokens.radius.lg,
                  overflow: 'hidden',
                  zIndex: tokens.zIndex.popover,
                  padding: '8px 0',
                }}>
                  {isSearching && (
                    <div style={{ padding: '12px', fontSize: '13px', color: tokens.colors.textSecondary }}>
                      {t('common.loading.results')}
                    </div>
                  )}
                  {!isSearching && searchResults && searchSections.length === 0 && (
                    <div style={{ padding: '12px', fontSize: '13px', color: tokens.colors.textSecondary, lineHeight: 1.6 }}>
                      <div style={{ fontWeight: 700, color: tokens.colors.textPrimary }}>{t('common.empty.no_results')}</div>
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
          </div>

          {/* Right side: dark mode, notifications, avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? tokens.spacing.md : tokens.spacing.xl, justifyContent: isMobile ? 'space-between' : 'flex-end', minWidth: 0 }}>
            <div style={{ display: 'flex', gap: isMobile ? tokens.spacing.smPlus : tokens.spacing.md, alignItems: 'center', minWidth: 0 }}>
              <button
                type="button"
                onClick={toggleDarkMode}
                aria-label={isDarkMode ? t('nav.theme.light') : t('nav.theme.dark')}
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
                isMobile={Boolean(isMobile)}
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

            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? tokens.spacing.sm : tokens.spacing.md, borderLeft: isMobile ? 'none' : `1px solid ${tokens.colors.border}`, paddingLeft: isMobile ? '0' : tokens.spacing.lg, minWidth: 0 }}>
              <div
                style={{
                  width: isMobile ? '34px' : '38px',
                  height: isMobile ? '34px' : '38px',
                  borderRadius: '12px',
                  background: tokens.colors.background,
                  border: `1px solid ${tokens.colors.border}`,
                  overflow: 'hidden',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isDarkMode ? tokens.colors.textPrimary : tokens.colors.primary,
                    color: tokens.colors.textOnPrimary,
                    fontSize: isMobile ? '14px' : '16px',
                    fontWeight: 800,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {avatarInitials}
                </span>
              </div>
              <div style={{ textAlign: 'right', display: 'grid', gap: '2px', minWidth: 0 }}>
                <div
                  style={{
                    fontSize: isMobile ? '12px' : '13px',
                    fontWeight: 700,
                    color: tokens.colors.textPrimary,
                    maxWidth: isMobile ? '104px' : '180px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {isMobile ? (roleProfile?.primaryRole ? ROLE_LABELS[roleProfile.primaryRole] : (currentUser?.fullName ?? 'Guest')) : (currentUser?.fullName ?? 'Guest')}
                </div>
                {!isMobile ? (
                  <div
                    style={{
                      fontSize: '11px',
                      color: tokens.colors.textSecondary,
                      maxWidth: '180px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {roleSummary}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

        </header>

        {canManageRolePreview ? (
          <div data-testid={QA_TEST_IDS.layout.previewBanner} style={{ padding: isMobile ? '10px 12px' : '10px 16px', borderBottom: `1px solid ${tokens.colors.border}`, background: `linear-gradient(135deg, ${tokens.colors.warningTint} 0%, ${tokens.colors.warningBg} 100%)`, display: 'grid', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '13px', color: tokens.colors.textPrimary, lineHeight: 1.5 }}>
                {isRolePreviewActive ? (
                  <>
                    <strong>Role preview:</strong> đang xem hệ thống như <strong>{previewLabel}</strong>. {previewRoleCodes.length === 1 && previewRoleCodes[0] === 'viewer' ? 'Viewer preview chỉ mở bề mặt read-only và không dùng chung với trạng thái admin gốc.' : 'Base admin identity vẫn được giữ để thoát preview hoặc quay lại kiểm tra hệ thống.'}
                  </>
                ) : (
                  <>
                    <strong>Role preview controls:</strong> bạn đang ở <strong>admin gốc</strong>. Chọn preset ngay trên banner để bật QA preview nhanh mà không cần mở Settings trước.
                  </>
                )}
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
        <div ref={contentScrollRef} data-testid={contentTestId || QA_TEST_IDS.appContent} style={{ flex: 1, minWidth: 0, overflowY: 'auto', overflowX: 'hidden', padding: isMobile ? tokens.spacing.md : tokens.spacing.lg }}>
          {children}
        </div>
      </main>
    </div>
  );
};
