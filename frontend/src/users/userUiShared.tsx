import { useMemo, useState } from 'preact/hooks';
import type { JSX } from 'preact';

import { API_BASE } from '../config';
import { buildRoleProfile, normalizeRoleCodes, ROLE_LABELS } from '../auth';
import { GENDER_OPTIONS } from '../gender';
import type { SystemRole } from '../shared/domain/contracts';
import { OverlayPortal, getOverlayContainerStyle } from '../ui/overlay';
import { OverlayModal } from '../ui/OverlayModal';
import { tokens } from '../ui/tokens';
import { ui } from '../ui/styles';

const API = API_BASE;

export const DEPARTMENTS = [
  'Ban Giám đốc',
  'Sales & Marketing',
  'Kỹ thuật',
  'Mua hàng',
  'Kế toán & Tài chính',
  'IT',
  'Hành chính - Nhân sự',
  'Vận hành',
];

export const BUSINESS_ROLE_OPTIONS: Array<{ value: SystemRole; label: string }> = [
  { value: 'sales', label: 'Sales' },
  { value: 'project_manager', label: 'Project Manager' },
  { value: 'procurement', label: 'Procurement' },
  { value: 'accounting', label: 'Accounting' },
  { value: 'legal', label: 'Legal' },
  { value: 'director', label: 'Director' },
  { value: 'admin', label: 'Admin' },
];

export const PRIMARY_ROLE_OPTIONS: Array<{ value: SystemRole; label: string }> = [
  { value: 'viewer', label: 'Viewer — Chỉ xem' },
  { value: 'sales', label: 'Sales — Kinh doanh' },
  { value: 'project_manager', label: 'Project Manager — Điều phối dự án' },
  { value: 'procurement', label: 'Procurement — Mua hàng' },
  { value: 'accounting', label: 'Accounting — Kế toán' },
  { value: 'legal', label: 'Legal — Pháp lý' },
  { value: 'director', label: 'Director — Điều hành' },
  { value: 'admin', label: 'Admin — Toàn quyền' },
];

export const S = {
  card: ui.card.base as any,
  btnPrimary: ui.btn.primary as any,
  btnOutline: ui.btn.outline as any,
  thSortable: ui.table.thSortable as any,
  thStatic: ui.table.thStatic as any,
  td: ui.table.td as any,
  input: { ...ui.input.base, transition: 'all 0.2s ease' } as any,
  kpiCard: ui.card.kpi as any,
  label: { ...ui.form.label, display: 'block', marginBottom: '6px' } as any,
};

export const USERS_WARNING_PILL = {
  background: tokens.colors.warningSurfaceBg,
  color: tokens.colors.warningSurfaceText,
} as const;

export const USERS_INFO_PILL = {
  background: tokens.colors.infoAccentBg,
  color: tokens.colors.infoAccentText,
} as const;

export const USERS_TABLE_HEADER_BG = tokens.colors.surfaceSubtle;
export const USERS_TABLE_ALT_ROW_BG = tokens.colors.background;
export const USERS_TABLE_MUTED_TEXT = tokens.colors.textSecondary;
export const USERS_ACTION_PRIMARY = {
  border: tokens.colors.successBorder,
  background: tokens.colors.surfaceSuccessSoft,
  color: tokens.colors.success,
} as const;

export type DirectorySortKey = 'fullName' | 'department' | 'primaryRole' | 'lastLoginAt';

export function canonicalizeProjectManagerRoles(roleCodes: SystemRole[]) {
  if (roleCodes.includes('project_manager') && roleCodes.includes('sales')) {
    return roleCodes.filter((roleCode) => roleCode !== 'sales');
  }
  return roleCodes;
}

export function derivePersistedSystemRole(systemRole: SystemRole, roleCodes: SystemRole[]) {
  if (roleCodes.includes('project_manager') && systemRole === 'sales') {
    return 'project_manager' as SystemRole;
  }
  return systemRole;
}

export function formatDate(val: any): string {
  if (!val) return 'Chưa đăng nhập';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return 'Chưa đăng nhập';
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return 'Chưa đăng nhập';
  }
}

export function AccountStatusBadge({ status }: { status?: string }) {
  if (status === 'active') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '99px', background: tokens.colors.badgeBgSuccess, fontSize: '11px', fontWeight: 700, color: tokens.colors.success }}>
        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: tokens.colors.success, display: 'inline-block' }} />
        Đang hoạt động
      </span>
    );
  }
  if (status === 'locked') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '99px', background: tokens.colors.badgeBgError, fontSize: '11px', fontWeight: 700, color: tokens.colors.error }}>
        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: tokens.colors.error, display: 'inline-block' }} />
        Đã khóa
      </span>
    );
  }
  if (status === 'suspended') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '99px', background: USERS_WARNING_PILL.background, fontSize: '11px', fontWeight: 700, color: USERS_WARNING_PILL.color }}>
        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: USERS_WARNING_PILL.color, display: 'inline-block' }} />
        Tạm ngưng
      </span>
    );
  }
  return <span style={{ fontSize: '11px', color: tokens.colors.textMuted }}>-</span>;
}

export function PasswordStateBadge({ mustChangePassword }: { mustChangePassword?: boolean | number | null }) {
  const pending = mustChangePassword === true || mustChangePassword === 1;
  if (pending) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '99px', background: USERS_WARNING_PILL.background, fontSize: '11px', fontWeight: 700, color: USERS_WARNING_PILL.color }}>
        Yêu cầu đổi
      </span>
    );
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '99px', background: tokens.colors.badgeBgSuccess, fontSize: '11px', fontWeight: 700, color: tokens.colors.success }}>
      Bình thường
    </span>
  );
}

export function EmploymentStatusBadge({ status }: { status?: string }) {
  const active = String(status || '').toLowerCase() === 'active';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '99px', background: active ? tokens.colors.badgeBgSuccess : tokens.colors.background, color: active ? tokens.colors.success : tokens.colors.textMuted, fontSize: '11px', fontWeight: 700, border: active ? 'none' : `1px solid ${tokens.colors.border}` }}>
      {active ? 'Đang làm việc' : 'Ngưng hoạt động'}
    </span>
  );
}

export function UserAvatar({ avatar, fullName, size = 32 }: { avatar?: string; fullName?: string; size?: number }) {
  const initials = (fullName || '?').trim().split(' ').slice(-1)[0]?.[0]?.toUpperCase() ?? '?';
  if (avatar) {
    return (
      <img
        src={API + avatar}
        alt={fullName}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${tokens.colors.border}`, flexShrink: 0 }}
      />
    );
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: tokens.colors.primary, color: tokens.colors.textOnPrimary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size > 28 ? '13px' : '11px', fontWeight: 800, flexShrink: 0, border: `2px solid ${tokens.colors.border}` }}>
      {initials}
    </div>
  );
}

export function ModalWrapper({ title, children, onClose }: any) {
  return (
    <OverlayModal title={title} onClose={onClose} maxWidth="680px" contentPadding="24px">
      <div style={{ maxHeight: '80vh', overflowY: 'auto' }}>{children}</div>
    </OverlayModal>
  );
}

export function SectionDivider({ label }: { label: string }) {
  return (
    <div style={{ gridColumn: 'span 2', borderTop: `1px solid ${tokens.colors.border}`, paddingTop: '16px', marginTop: '4px' }}>
      <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
    </div>
  );
}

export function RoleCodeSelector({
  value,
  onChange,
}: {
  value: SystemRole[];
  onChange: (next: SystemRole[]) => void;
}) {
  return (
    <div style={{ display: 'grid', gap: '10px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
        {BUSINESS_ROLE_OPTIONS.map((option) => {
          const checked = value.includes(option.value);
          return (
            <label
              key={option.value}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 12px',
                borderRadius: tokens.radius.md,
                border: `1px solid ${checked ? tokens.colors.primary : tokens.colors.border}`,
                background: checked ? tokens.colors.badgeBgSuccess : tokens.colors.surface,
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                color: tokens.colors.textPrimary,
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(e: any) => {
                  const next = e.target.checked
                    ? [...value, option.value]
                    : value.filter((roleCode) => roleCode !== option.value);
                  onChange(canonicalizeProjectManagerRoles(Array.from(new Set(next))));
                }}
                style={{ width: '16px', height: '16px', accentColor: tokens.colors.primary }}
              />
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
      <div style={{ fontSize: '12px', color: tokens.colors.textMuted }}>
        Một user có thể có nhiều capability cùng lúc. Nếu đã chọn `project_manager`, hệ thống sẽ tự bỏ `sales` vì PM đã có sẵn commercial scope.
      </div>
    </div>
  );
}

export function toUsername(fullName: string): string {
  const map: Record<string, string> = {
    'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a', 'å': 'a',
    'ă': 'a', 'ắ': 'a', 'ặ': 'a', 'ằ': 'a', 'ẳ': 'a', 'ẵ': 'a',
    'ấ': 'a', 'ậ': 'a', 'ầ': 'a', 'ẩ': 'a', 'ẫ': 'a',
    'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e',
    'ề': 'e', 'ế': 'e', 'ệ': 'e', 'ể': 'e', 'ễ': 'e',
    'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i', 'ị': 'i', 'ỉ': 'i', 'ĩ': 'i',
    'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o',
    'ơ': 'o', 'ớ': 'o', 'ợ': 'o', 'ờ': 'o', 'ở': 'o', 'ỡ': 'o',
    'ồ': 'o', 'ố': 'o', 'ộ': 'o', 'ổ': 'o', 'ỗ': 'o',
    'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u',
    'ư': 'u', 'ứ': 'u', 'ự': 'u', 'ừ': 'u', 'ử': 'u', 'ữ': 'u',
    'ỳ': 'y', 'ý': 'y', 'ỵ': 'y', 'ỷ': 'y', 'ỹ': 'y',
    'đ': 'd',
  };
  return fullName
    .toLowerCase()
    .split('')
    .map((c) => map[c] ?? c)
    .join('')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .join('.');
}

export function getSupplementalRoles(roleCodes: SystemRole[], systemRole?: SystemRole) {
  const normalized = normalizeRoleCodes(roleCodes, systemRole);
  const primaryRole = buildRoleProfile(normalized, systemRole).primaryRole;
  return normalized.filter((roleCode) => roleCode !== primaryRole);
}

export function CapabilitySummary({
  roleCodes,
  systemRole,
  emptyLabel = 'Base access',
}: {
  roleCodes: SystemRole[];
  systemRole?: SystemRole;
  emptyLabel?: string;
}) {
  const supplementalRoles = getSupplementalRoles(roleCodes, systemRole);
  if (supplementalRoles.length === 0) {
    return <span style={{ fontSize: '12px', fontWeight: 700, color: tokens.colors.textMuted }}>{emptyLabel}</span>;
  }

  const visible = supplementalRoles.slice(0, 3);
  const remaining = supplementalRoles.length - visible.length;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
      {visible.map((roleCode) => (
        <span key={roleCode} style={{ padding: '4px 8px', borderRadius: '999px', background: tokens.colors.background, border: `1px solid ${tokens.colors.border}`, fontSize: '11px', fontWeight: 700, color: tokens.colors.textSecondary, whiteSpace: 'nowrap' }}>
          {ROLE_LABELS[roleCode]}
        </span>
      ))}
      {remaining > 0 ? <span style={{ padding: '4px 8px', borderRadius: '999px', background: tokens.colors.surface, fontSize: '11px', fontWeight: 700, color: tokens.colors.textMuted }}>+{remaining}</span> : null}
    </div>
  );
}

export function getUserDirectoryStatus(user: any) {
  if (user.accountStatus === 'locked') {
    return { key: 'locked', label: 'Tạm khóa', background: tokens.colors.badgeBgError, color: tokens.colors.error };
  }
  if (user.accountStatus === 'suspended') {
    return { key: 'limited', label: 'Giới hạn', background: tokens.colors.surfaceSubtle, color: tokens.colors.textSecondary };
  }
  if (String(user.status || '').toLowerCase() === 'inactive') {
    return { key: 'inactive', label: 'Tạm nghỉ', background: tokens.colors.surfaceSubtle, color: tokens.colors.textSecondary };
  }
  if (!user.lastLoginAt) {
    return { key: 'never_logged_in', label: 'Chưa đăng nhập', background: tokens.colors.warningBg, color: tokens.colors.warningStrong };
  }
  return { key: 'active', label: 'Hoạt động', background: tokens.colors.badgeBgSuccess, color: tokens.colors.success };
}

export function getUserAccessSummary(user: any) {
  const primaryRole = buildRoleProfile(user.roleCodes, user.systemRole).primaryRole;
  const summaries: Partial<Record<SystemRole, string>> = {
    admin: 'Toàn quyền hệ thống',
    accounting: 'Finance + Reports',
    director: 'Approvals + Reports',
    legal: 'Contracts + Audit',
    procurement: 'Vendor + Purchase',
    project_manager: 'Projects + Timeline',
    sales: 'Pipeline + Quotations',
    viewer: 'Chỉ xem dữ liệu',
  };
  return summaries[primaryRole] || 'Quyền cơ bản';
}

export function SummaryChip({
  label,
  tone,
}: {
  label: string;
  tone: 'info' | 'warning' | 'danger';
}) {
  const palette = tone === 'warning'
    ? { background: tokens.colors.warningStrongBg, color: tokens.colors.warningStrong }
    : tone === 'danger'
      ? { background: tokens.colors.badgeBgError, color: tokens.colors.error }
      : USERS_INFO_PILL;

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '8px 12px', borderRadius: '999px', background: palette.background, color: palette.color, fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
}

export function TableRolePill({ label }: { label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 12px', borderRadius: '999px', background: tokens.colors.surfaceSubtle, border: `1px solid ${tokens.colors.border}`, color: tokens.colors.textSecondary, fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
}

export function TableStatusPill({ user }: { user: any }) {
  const status = getUserDirectoryStatus(user);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '7px 12px', borderRadius: '999px', background: status.background, color: status.color, fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap' }}>
      {status.label}
    </span>
  );
}

export function TableActionButton({
  label,
  tone = 'secondary',
  onClick,
}: {
  label: string;
  tone?: 'secondary' | 'primary';
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} style={{ minWidth: '58px', height: '36px', padding: '0 12px', borderRadius: '12px', border: `1px solid ${tone === 'primary' ? USERS_ACTION_PRIMARY.border : tokens.colors.border}`, background: tone === 'primary' ? USERS_ACTION_PRIMARY.background : tokens.colors.surface, color: tone === 'primary' ? USERS_ACTION_PRIMARY.color : tokens.colors.textSecondary, fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
      {label}
    </button>
  );
}

export function DetailField({ label, value }: { label: string; value?: JSX.Element | string | number | null | undefined }) {
  return (
    <div style={{ display: 'grid', gap: '8px' }}>
      <div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1.4 }}>{label}</div>
      <div style={{ fontSize: '14px', fontWeight: 600, color: tokens.colors.textPrimary, lineHeight: 1.5, wordBreak: 'break-word' }}>{value || '-'}</div>
    </div>
  );
}

export function SidePanel({ open, title, subtitle, onClose, children }: { open: boolean; title: string; subtitle?: string; onClose: () => void; children: any }) {
  if (!open) return null;
  return (
    <OverlayPortal>
      <div style={getOverlayContainerStyle('drawer', { padding: '0', alignItems: 'stretch', justifyContent: 'flex-end' })}>
        <button type="button" aria-label="Close panel" onClick={onClose} style={{ position: 'absolute', inset: 0, background: tokens.overlay.softBackdrop, backdropFilter: `blur(${tokens.overlay.backdropBlur})`, WebkitBackdropFilter: `blur(${tokens.overlay.backdropBlur})`, border: 'none', padding: 0, cursor: 'pointer' }} />
        <div style={{ position: 'relative', zIndex: 1, width: 'min(560px, 100vw)', height: '100%', ...ui.overlay.drawer, overflowY: 'auto' }}>
          <div style={{ padding: '22px 24px 18px', borderBottom: `1px solid ${tokens.colors.border}`, background: tokens.surface.drawerHeader }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
              <div style={{ display: 'grid', gap: '6px', minWidth: 0 }}>
                <div style={{ fontSize: '22px', fontWeight: 900, color: tokens.colors.textPrimary, lineHeight: 1.3 }}>{title}</div>
                {subtitle ? <div style={{ fontSize: '13px', color: tokens.colors.textSecondary, lineHeight: 1.5 }}>{subtitle}</div> : null}
              </div>
              <button type="button" onClick={onClose} aria-label="Close panel" title="Close panel" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', border: `1px solid ${tokens.colors.border}`, borderRadius: '999px', background: tokens.colors.surface, color: tokens.colors.textSecondary, padding: '8px 12px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', lineHeight: 1 }}>
                <span aria-hidden="true" style={{ fontSize: '16px' }}>&times;</span>
                <span>Close</span>
              </button>
            </div>
          </div>
          <div style={{ padding: '24px' }}>{children}</div>
        </div>
      </div>
    </OverlayPortal>
  );
}

export function useUserDirectoryData(items: any[]) {
  const [sortConfig, setSortConfig] = useState<{ key: DirectorySortKey; direction: 'asc' | 'desc' }>({ key: 'fullName', direction: 'asc' });
  const [filters, setFilters] = useState({ query: '', department: '', primaryRole: '', accountStatus: '', passwordState: '', loginState: '' });
  const enrichedItems = useMemo(() => items.map((item) => {
    const roleCodes = normalizeRoleCodes(item.roleCodes, item.systemRole);
    const profile = buildRoleProfile(roleCodes, item.systemRole);
    return {
      ...item,
      roleCodes,
      primaryRole: profile.primaryRole,
      primaryRoleLabel: ROLE_LABELS[profile.primaryRole],
      passwordState: item.mustChangePassword === true || item.mustChangePassword === 1 ? 'must_change' : 'normal',
      loginState: item.lastLoginAt ? 'active' : 'never_logged_in',
      searchIndex: [
        item.fullName,
        item.email,
        item.phone,
        item.department,
        item.role,
        item.employeeCode,
        ROLE_LABELS[profile.primaryRole],
        roleCodes.map((roleCode) => ROLE_LABELS[roleCode]).join(' '),
      ].filter(Boolean).join(' ').toLowerCase(),
    };
  }), [items]);
  const filteredItems = useMemo(() => {
    const result = [...enrichedItems];
    if (filters.query.trim()) {
      const query = filters.query.trim().toLowerCase();
      result.splice(0, result.length, ...result.filter((item) => item.searchIndex.includes(query)));
    }
    if (filters.department) {
      result.splice(0, result.length, ...result.filter((item) => String(item.department || '') === filters.department));
    }
    if (filters.primaryRole) {
      result.splice(0, result.length, ...result.filter((item) => item.primaryRole === filters.primaryRole));
    }
    if (filters.accountStatus) {
      result.splice(0, result.length, ...result.filter((item) => String(item.accountStatus || '') === filters.accountStatus));
    }
    if (filters.passwordState) {
      result.splice(0, result.length, ...result.filter((item) => item.passwordState === filters.passwordState));
    }
    if (filters.loginState) {
      result.splice(0, result.length, ...result.filter((item) => item.loginState === filters.loginState));
    }
    result.sort((a, b) => {
      const direction = sortConfig.direction === 'asc' ? 1 : -1;
      if (sortConfig.key === 'lastLoginAt') {
        const aValue = a.lastLoginAt ? new Date(a.lastLoginAt).getTime() : 0;
        const bValue = b.lastLoginAt ? new Date(b.lastLoginAt).getTime() : 0;
        return (aValue - bValue) * direction;
      }
      const aValue = String(a[sortConfig.key] || '').toLowerCase();
      const bValue = String(b[sortConfig.key] || '').toLowerCase();
      if (aValue < bValue) return -1 * direction;
      if (aValue > bValue) return 1 * direction;
      return 0;
    });
    return result;
  }, [enrichedItems, filters, sortConfig]);

  return {
    items: filteredItems,
    filters,
    setFilters,
    sortConfig,
    requestSort: (key: DirectorySortKey) => setSortConfig((current) => current.key === key ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' }),
  };
}

export type UserDirectoryData = ReturnType<typeof useUserDirectoryData>;

export { GENDER_OPTIONS };
