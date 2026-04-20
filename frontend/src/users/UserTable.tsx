import { FormatActionButton } from '../ui/FormatActionButton';
import { tokens } from '../ui/tokens';
import { ui } from '../ui/styles';
import {
  CapabilitySummary,
  getSupplementalRoles,
  getUserAccessSummary,
  PRIMARY_ROLE_OPTIONS,
  S,
  SummaryChip,
  TableActionButton,
  TableRolePill,
  TableStatusPill,
  UserAvatar,
  USERS_TABLE_ALT_ROW_BG,
  USERS_TABLE_HEADER_BG,
  USERS_TABLE_MUTED_TEXT,
  type UserDirectoryData,
} from './userUiShared';
import type { DirectorySortKey } from './userUiShared';

type UserTableProps = {
  isMobile?: boolean;
  loading: boolean;
  userCanManage: boolean;
  userCanEditUsers: boolean;
  userSupportsBulkFileActions: boolean;
  directoryData: UserDirectoryData;
  filterOptions: { departments: string[] };
  stats: { total: number; lockedAccounts: number; neverLoggedIn: number };
  hasSupplementalCapabilities: boolean;
  onAddUser: () => void;
  onOpenUser: (user: any) => void;
  onEditUser: (user: any) => void;
  onImportClick: () => void;
  onExportData: (format: 'csv' | 'xlsx') => void;
  onDownloadTemplate: (format: 'csv' | 'xlsx') => void;
  title: string;
  subtitle: string;
};

export function UserTable({
  isMobile,
  loading,
  userCanManage,
  userCanEditUsers,
  userSupportsBulkFileActions,
  directoryData,
  filterOptions,
  stats,
  hasSupplementalCapabilities,
  onAddUser,
  onOpenUser,
  onEditUser,
  onImportClick,
  onExportData,
  onDownloadTemplate,
  title,
  subtitle,
}: UserTableProps) {
  const adminColumns: Array<{ key: DirectorySortKey | 'capabilities' | 'status'; label: string }> = [
    { key: 'fullName', label: 'Người dùng' },
    { key: 'department', label: 'Phòng ban' },
    { key: 'primaryRole', label: 'Vai trò' },
    { key: 'capabilities', label: 'Quyền hạn' },
    { key: 'status', label: 'Trạng thái' },
    { key: 'lastLoginAt', label: 'Đăng nhập gần nhất' },
  ];
  const statusFilterValue = directoryData.filters.accountStatus || directoryData.filters.loginState || '';

  const setStatusFilter = (value: string) => {
    if (!value) {
      directoryData.setFilters({
        ...directoryData.filters,
        accountStatus: '',
        loginState: '',
        passwordState: '',
      });
      return;
    }
    if (value === 'never_logged_in') {
      directoryData.setFilters({
        ...directoryData.filters,
        accountStatus: '',
        loginState: 'never_logged_in',
        passwordState: '',
      });
      return;
    }
    directoryData.setFilters({
      ...directoryData.filters,
      accountStatus: value,
      loginState: '',
      passwordState: '',
    });
  };

  const renderDirectoryFilters = () => {
    if (userCanManage) {
      return (
        <div style={{ display: 'grid', gap: '12px' }}>
          <div style={{ ...S.card, display: 'grid', gap: '12px', padding: isMobile ? '16px' : '14px 16px', borderRadius: '18px', border: `1px solid ${tokens.colors.border}`, boxShadow: 'none' }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(260px, 1.7fr) minmax(180px, 0.9fr) minmax(180px, 0.9fr) auto', gap: '12px', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Tìm theo tên hoặc username"
                value={directoryData.filters.query}
                onInput={(e: any) => directoryData.setFilters({ ...directoryData.filters, query: e.target.value })}
                style={{ ...S.input, width: '100%', background: tokens.colors.background, borderRadius: '14px', padding: '12px 16px' }}
              />
              <select value={directoryData.filters.department} onChange={(e: any) => directoryData.setFilters({ ...directoryData.filters, department: e.target.value })} style={{ ...S.input, background: tokens.colors.surface, borderRadius: '14px', padding: '12px 16px' }}>
                <option value="">Phòng ban</option>
                {filterOptions.departments.map((department) => <option key={department} value={department}>{department}</option>)}
              </select>
              <select value={statusFilterValue} onChange={(e: any) => setStatusFilter(e.target.value)} style={{ ...S.input, background: tokens.colors.surface, borderRadius: '14px', padding: '12px 16px' }}>
                <option value="">Trạng thái</option>
                <option value="active">Hoạt động</option>
                <option value="never_logged_in">Chưa đăng nhập</option>
                <option value="locked">Tạm khóa</option>
                <option value="suspended">Giới hạn</option>
              </select>
              <div style={{ display: 'flex', gap: '12px', justifyContent: isMobile ? 'stretch' : 'flex-end', flexWrap: 'wrap' }}>
                <button style={{ ...S.btnPrimary, padding: '12px 18px', borderRadius: '14px', justifyContent: 'center' }} onClick={onAddUser}>
                  + Thêm
                </button>
              </div>
            </div>
          </div>
          {userSupportsBulkFileActions ? (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <FormatActionButton label="Xuất file" buttonStyle={{ ...S.btnOutline, padding: '12px 18px', borderRadius: '14px' }} menuAlign="right" onSelect={onExportData} />
              <FormatActionButton label="Tải mẫu import" buttonStyle={{ ...ui.btn.ghost, padding: '6px 10px', fontSize: '13px' }} onSelect={onDownloadTemplate} />
              <button type="button" onClick={onImportClick} style={{ ...ui.btn.ghost, padding: '6px 10px', fontSize: '13px' }}>
                Import file
              </button>
            </div>
          ) : null}
        </div>
      );
    }

    return (
      <div style={{ ...S.card, display: 'grid', gap: '16px', border: `1px solid ${tokens.colors.border}` }}>
        <div style={{ display: 'grid', gap: '8px' }}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase' }}>Tìm đồng nghiệp</div>
          <input type="text" placeholder="Tìm theo tên, email, số điện thoại, phòng ban..." value={directoryData.filters.query} onInput={(e: any) => directoryData.setFilters({ ...directoryData.filters, query: e.target.value })} style={{ ...S.input, width: '100%' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: '12px' }}>
          <select value={directoryData.filters.department} onChange={(e: any) => directoryData.setFilters({ ...directoryData.filters, department: e.target.value })} style={S.input}>
            <option value="">Tất cả phòng ban</option>
            {filterOptions.departments.map((department) => <option key={department} value={department}>{department}</option>)}
          </select>
          <select value={directoryData.filters.primaryRole} onChange={(e: any) => directoryData.setFilters({ ...directoryData.filters, primaryRole: e.target.value })} style={S.input}>
            <option value="">Tất cả role</option>
            {PRIMARY_ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select value={directoryData.filters.loginState} onChange={(e: any) => directoryData.setFilters({ ...directoryData.filters, loginState: e.target.value })} style={S.input}>
            <option value="">Tất cả đăng nhập</option>
            <option value="active">Đã từng đăng nhập</option>
            <option value="never_logged_in">Chưa từng đăng nhập</option>
          </select>
        </div>
      </div>
    );
  };

  const renderAdminDesktopTable = () => (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead>
          <tr>
            {adminColumns.map((column) => (
              <th key={column.key} style={{ padding: '20px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 700, color: tokens.colors.textMuted, borderBottom: `1px solid ${tokens.colors.border}`, background: USERS_TABLE_HEADER_BG, cursor: column.key === 'capabilities' || column.key === 'status' ? 'default' : 'pointer', whiteSpace: 'nowrap' }} onClick={column.key === 'capabilities' || column.key === 'status' ? undefined : () => directoryData.requestSort(column.key as DirectorySortKey)}>
                <span>{column.label}{directoryData.sortConfig.key === column.key ? (directoryData.sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}</span>
              </th>
            ))}
            <th style={{ padding: '20px 16px', textAlign: 'right', fontSize: '13px', fontWeight: 700, color: tokens.colors.textMuted, borderBottom: `1px solid ${tokens.colors.border}`, background: USERS_TABLE_HEADER_BG }}>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {directoryData.items.map((item: any, index: number) => (
            <tr key={item.id} style={{ ...ui.table.row, borderTop: `1px solid ${tokens.colors.border}`, background: index % 2 === 0 ? tokens.colors.surface : USERS_TABLE_ALT_ROW_BG }}>
              <td style={{ ...S.td, minWidth: '240px', paddingTop: '18px', paddingBottom: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <UserAvatar avatar={item.avatar} fullName={item.fullName} size={36} />
                  <div style={{ display: 'grid', gap: '4px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: tokens.colors.textPrimary }}>{item.fullName}</div>
                    <div style={{ fontSize: '12px', color: tokens.colors.textMuted }}>{item.employeeCode || item.username || '-'}</div>
                  </div>
                </div>
              </td>
              <td style={S.td}>{item.department || '-'}</td>
              <td style={{ ...S.td, minWidth: '160px' }}><TableRolePill label={item.primaryRoleLabel} /></td>
              <td style={{ ...S.td, minWidth: '220px', color: USERS_TABLE_MUTED_TEXT }}>{getUserAccessSummary(item)}</td>
              <td style={S.td}><TableStatusPill user={item} /></td>
              <td style={{ ...S.td, whiteSpace: 'nowrap', color: !item.lastLoginAt ? tokens.colors.warningStrong : USERS_TABLE_MUTED_TEXT }}>{item.lastLoginAt ? new Date(item.lastLoginAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Chưa đăng nhập'}</td>
              <td style={{ ...S.td, textAlign: 'right' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <TableActionButton label="Xem" onClick={() => onOpenUser(item)} />
                  {userCanEditUsers ? <TableActionButton label="Sửa" tone="primary" onClick={() => onEditUser(item)} /> : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderAdminMobileCards = () => (
    <div style={{ display: 'grid', gap: '12px' }}>
      {directoryData.items.map((item: any) => (
        <div key={item.id} style={{ ...ui.card.base, border: `1px solid ${tokens.colors.border}`, padding: tokens.spacing.lg, borderRadius: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
            <UserAvatar avatar={item.avatar} fullName={item.fullName} size={40} />
            <div style={{ display: 'grid', gap: '3px', minWidth: 0 }}>
              <div style={{ fontSize: '15px', fontWeight: 800, color: tokens.colors.textPrimary }}>{item.fullName}</div>
              <div style={{ fontSize: '12px', color: tokens.colors.textMuted }}>{item.employeeCode || item.username || '-'}</div>
            </div>
          </div>
          <div style={{ display: 'grid', gap: '10px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <TableRolePill label={item.primaryRoleLabel} />
              <TableStatusPill user={item} />
            </div>
            <div style={{ fontSize: '13px', color: USERS_TABLE_MUTED_TEXT }}><strong>Phòng ban:</strong> {item.department || '-'}</div>
            <div style={{ fontSize: '13px', color: USERS_TABLE_MUTED_TEXT }}><strong>Quyền hạn:</strong> {getUserAccessSummary(item)}</div>
            <div style={{ fontSize: '12px', color: !item.lastLoginAt ? tokens.colors.warningStrong : tokens.colors.textMuted }}>Đăng nhập gần nhất: {item.lastLoginAt ? new Date(item.lastLoginAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Chưa đăng nhập'}</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
            <TableActionButton label="Xem" onClick={() => onOpenUser(item)} />
            {userCanEditUsers ? <TableActionButton label="Sửa" tone="primary" onClick={() => onEditUser(item)} /> : null}
          </div>
        </div>
      ))}
    </div>
  );

  const renderDirectoryDesktopTable = () => (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead>
          <tr>
            <th style={S.thSortable} onClick={() => directoryData.requestSort('fullName')}>Nhân viên{directoryData.sortConfig.key === 'fullName' ? (directoryData.sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}</th>
            <th style={S.thSortable} onClick={() => directoryData.requestSort('department')}>Phòng ban{directoryData.sortConfig.key === 'department' ? (directoryData.sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}</th>
            <th style={S.thSortable} onClick={() => directoryData.requestSort('primaryRole')}>Vai trò{directoryData.sortConfig.key === 'primaryRole' ? (directoryData.sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}</th>
            <th style={S.thStatic}>Thông tin liên hệ</th>
            {hasSupplementalCapabilities ? <th style={S.thStatic}>Capabilities</th> : null}
            <th style={{ ...S.thStatic, textAlign: 'right' }}>Chi tiết</th>
          </tr>
        </thead>
        <tbody>
          {directoryData.items.map((item: any) => (
            <tr key={item.id} style={{ ...ui.table.row, borderTop: `1px solid ${tokens.colors.border}` }}>
              <td style={{ ...S.td, minWidth: '220px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><UserAvatar avatar={item.avatar} fullName={item.fullName} size={36} /><div style={{ display: 'grid', gap: '4px' }}><div style={{ fontSize: '14px', fontWeight: 800, color: tokens.colors.textPrimary }}>{item.fullName}</div><div style={{ fontSize: '12px', color: tokens.colors.textMuted }}>{item.role || item.primaryRoleLabel}</div></div></div></td>
              <td style={S.td}>{item.department || '-'}</td>
              <td style={S.td}>{item.primaryRoleLabel}</td>
              <td style={S.td}><div style={{ display: 'grid', gap: '4px' }}><div>{item.email || '-'}</div><div style={{ fontSize: '12px', color: tokens.colors.textMuted }}>{item.phone || '-'}</div></div></td>
              {hasSupplementalCapabilities ? <td style={{ ...S.td, minWidth: '180px' }}>{getSupplementalRoles(item.roleCodes, item.systemRole).length > 0 ? <CapabilitySummary roleCodes={item.roleCodes} systemRole={item.systemRole} emptyLabel="-" /> : '-'}</td> : null}
              <td style={{ ...S.td, textAlign: 'right' }}><button onClick={() => onOpenUser(item)} style={{ ...ui.btn.outline, padding: '6px 10px' }}>Xem</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderDirectoryMobileCards = () => (
    <div style={{ display: 'grid', gap: '12px' }}>
      {directoryData.items.map((item: any) => (
        <div key={item.id} style={{ ...ui.card.base, border: `1px solid ${tokens.colors.border}`, padding: tokens.spacing.lg }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}><UserAvatar avatar={item.avatar} fullName={item.fullName} size={40} /><div style={{ display: 'grid', gap: '4px' }}><div style={{ fontSize: '15px', fontWeight: 800, color: tokens.colors.textPrimary }}>{item.fullName}</div><div style={{ fontSize: '12px', color: tokens.colors.textMuted }}>{item.role || item.primaryRoleLabel}</div></div></div>
          <div style={{ display: 'grid', gap: '8px' }}><div style={{ fontSize: '13px', color: tokens.colors.textSecondary }}><strong>Phòng ban:</strong> {item.department || '-'}</div><div style={{ fontSize: '13px', color: tokens.colors.textSecondary }}><strong>Email:</strong> {item.email || '-'}</div><div style={{ fontSize: '13px', color: tokens.colors.textSecondary }}><strong>Điện thoại:</strong> {item.phone || '-'}</div>{getSupplementalRoles(item.roleCodes, item.systemRole).length > 0 ? <CapabilitySummary roleCodes={item.roleCodes} systemRole={item.systemRole} emptyLabel="-" /> : null}</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}><button onClick={() => onOpenUser(item)} style={{ ...ui.btn.outline, padding: '6px 10px' }}>Xem chi tiết</button></div>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {userCanManage ? (
        <div style={{ display: 'grid', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: '14px' }}>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ fontSize: '30px', fontWeight: 900, color: tokens.colors.textPrimary, margin: 0 }}>{title}</h2>
              <p style={{ fontSize: '14px', color: tokens.colors.textSecondary, margin: '6px 0 0', lineHeight: 1.6 }}>{subtitle}</p>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <SummaryChip label={`${stats.total} tài khoản`} tone="info" />
              <SummaryChip label={`${stats.neverLoggedIn} chờ kích hoạt`} tone="warning" />
              <SummaryChip label={`${stats.lockedAccounts} bị khóa`} tone="danger" />
            </div>
          </div>
        </div>
      ) : (
        <div style={{ ...ui.card.base, padding: '22px', display: 'grid', gap: '10px', background: tokens.surface.heroGradientSubtle }}>
          <div style={{ ...ui.badge.info, display: 'inline-flex', width: 'fit-content' }}>Employee directory</div>
          <div style={{ fontSize: '28px', fontWeight: 900, color: tokens.colors.textPrimary }}>Danh bạ nội bộ</div>
          <div style={{ fontSize: '14px', lineHeight: 1.7, color: tokens.colors.textSecondary, maxWidth: '70ch' }}>Tra cứu đồng nghiệp theo tên, phòng ban, role và thông tin liên hệ. Trạng thái tài khoản và action bảo mật được ẩn khỏi chế độ này.</div>
        </div>
      )}
      {renderDirectoryFilters()}
      <div style={{ ...S.card, overflow: 'hidden', border: `1px solid ${tokens.colors.border}`, borderRadius: userCanManage ? '22px' : tokens.radius.lg, boxShadow: tokens.shadow.sm }}>
        {loading ? (
          <div style={{ padding: '56px 24px', display: 'grid', justifyItems: 'center', gap: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: tokens.colors.textSecondary }}>Đang tải danh sách nhân sự</div>
            <div style={{ fontSize: '12px', color: tokens.colors.textMuted }}>Vui lòng chờ trong giây lát.</div>
          </div>
        ) : directoryData.items.length === 0 ? (
          <div style={{ padding: '56px 24px', display: 'grid', justifyItems: 'center', gap: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: tokens.colors.textSecondary }}>Không tìm thấy người dùng phù hợp</div>
            <div style={{ fontSize: '12px', color: tokens.colors.textMuted }}>Hãy điều chỉnh từ khóa hoặc bộ lọc để thử lại.</div>
          </div>
        ) : userCanManage ? (
          isMobile ? renderAdminMobileCards() : renderAdminDesktopTable()
        ) : (
          isMobile ? renderDirectoryMobileCards() : renderDirectoryDesktopTable()
        )}
      </div>
    </div>
  );
}
