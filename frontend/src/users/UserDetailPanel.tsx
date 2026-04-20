import { buildRoleProfile, normalizeRoleCodes, ROLE_LABELS } from '../auth';
import type { UserRecord } from '../userCrudHelpers';
import { tokens } from '../ui/tokens';
import { ui } from '../ui/styles';
import {
  AccountStatusBadge,
  CapabilitySummary,
  DetailField,
  EmploymentStatusBadge,
  formatDate,
  PasswordStateBadge,
  SidePanel,
  UserAvatar,
} from './userUiShared';

type PanelTab = 'profile' | 'access' | 'security' | 'activity';

type UserDetailPanelProps = {
  open: boolean;
  viewingUser: UserRecord | null;
  panelTab: PanelTab;
  setPanelTab: (tab: PanelTab) => void;
  userCanManage: boolean;
  userCanEditUsers: boolean;
  onClose: () => void;
  onLockToggle: (user: UserRecord) => void;
  onEdit: (user: UserRecord) => void;
};

export function UserDetailPanel({
  open,
  viewingUser,
  panelTab,
  setPanelTab,
  userCanManage,
  userCanEditUsers,
  onClose,
  onLockToggle,
  onEdit,
}: UserDetailPanelProps) {
  return (
    <SidePanel
      open={open}
      title={viewingUser?.fullName || ''}
      subtitle={userCanManage ? 'Employee record & access profile' : 'Employee directory profile'}
      onClose={onClose}
    >
      {viewingUser ? (
        <div style={{ display: 'grid', gap: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <UserAvatar avatar={viewingUser.avatar} fullName={viewingUser.fullName} size={56} />
            <div style={{ display: 'grid', gap: '6px', minWidth: 0 }}>
              <div style={{ fontSize: '18px', fontWeight: 900, color: tokens.colors.textPrimary, lineHeight: 1.4 }}>{viewingUser.fullName}</div>
              <div style={{ fontSize: '13px', color: tokens.colors.textSecondary, lineHeight: 1.5 }}>
                {viewingUser.role || ROLE_LABELS[buildRoleProfile(viewingUser.roleCodes, viewingUser.systemRole).primaryRole]}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <EmploymentStatusBadge status={viewingUser.status} />
                {userCanManage ? <AccountStatusBadge status={viewingUser.accountStatus} /> : null}
                {userCanManage ? <PasswordStateBadge mustChangePassword={viewingUser.mustChangePassword} /> : null}
              </div>
            </div>
          </div>

          {userCanManage ? (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', borderBottom: `1px solid ${tokens.colors.border}`, paddingBottom: '14px', marginTop: '4px' }}>
              {[
                { key: 'profile', label: 'Profile' },
                { key: 'access', label: 'Access' },
                { key: 'security', label: 'Security' },
                { key: 'activity', label: 'Activity' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setPanelTab(tab.key as PanelTab)}
                  style={{
                    ...ui.btn.outline,
                    padding: '8px 12px',
                    background: panelTab === tab.key ? tokens.colors.primary : tokens.colors.surface,
                    color: panelTab === tab.key ? tokens.colors.textOnPrimary : tokens.colors.textSecondary,
                    borderColor: panelTab === tab.key ? tokens.colors.primary : tokens.colors.border,
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          ) : null}

          {!userCanManage || panelTab === 'profile' ? (
            <div style={{ display: 'grid', gap: '18px', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
              <DetailField label="Mã nhân sự" value={viewingUser.employeeCode} />
              <DetailField label="Phòng ban" value={viewingUser.department} />
              <DetailField label="Chức vụ" value={viewingUser.role} />
              <DetailField label="Email" value={viewingUser.email} />
              <DetailField label="Điện thoại" value={viewingUser.phone} />
              <DetailField label="Ngày vào công ty" value={viewingUser.startDate ? formatDate(viewingUser.startDate) : '-'} />
              <div style={{ gridColumn: '1 / -1' }}>
                <DetailField label="Địa chỉ" value={viewingUser.address} />
              </div>
            </div>
          ) : null}

          {userCanManage && panelTab === 'access' ? (
            <div style={{ display: 'grid', gap: '20px' }}>
              <DetailField label="Username" value={viewingUser.username} />
              <DetailField label="Vai trò chính" value={ROLE_LABELS[buildRoleProfile(viewingUser.roleCodes, viewingUser.systemRole).primaryRole]} />
              <div style={{ display: 'grid', gap: '8px' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Capability roles</div>
                <CapabilitySummary roleCodes={normalizeRoleCodes(viewingUser.roleCodes, viewingUser.systemRole)} systemRole={viewingUser.systemRole} emptyLabel="No extra capabilities" />
              </div>
            </div>
          ) : null}

          {userCanManage && panelTab === 'security' ? (
            <div style={{ display: 'grid', gap: '20px' }}>
              <div style={{ padding: '14px 16px', borderRadius: '16px', background: tokens.colors.surfaceSubtle, border: `1px solid ${tokens.colors.border}`, fontSize: '13px', lineHeight: 1.6, color: tokens.colors.textSecondary }}>
                <strong style={{ color: tokens.colors.textPrimary }}>Phân biệt trạng thái:</strong> Trạng thái tài khoản quyết định quyền đăng nhập. Trạng thái nhân sự chỉ phản ánh tình trạng làm việc trong HR.
              </div>
              <div style={{ display: 'grid', gap: '14px', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                <DetailField label="Trạng thái tài khoản" value={<AccountStatusBadge status={viewingUser.accountStatus} />} />
                <DetailField label="Tình trạng mật khẩu" value={<PasswordStateBadge mustChangePassword={viewingUser.mustChangePassword} />} />
                <DetailField label="Đăng nhập gần nhất" value={formatDate(viewingUser.lastLoginAt)} />
                <DetailField label="Trạng thái nhân sự" value={<EmploymentStatusBadge status={viewingUser.status} />} />
              </div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', paddingTop: '4px' }}>
                <button onClick={() => onLockToggle(viewingUser)} style={ui.btn.outline}>
                  {viewingUser.accountStatus === 'locked' || viewingUser.accountStatus === 'suspended' ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}
                </button>
                {userCanEditUsers ? (
                  <button onClick={() => onEdit(viewingUser)} style={ui.btn.primary}>
                    Chỉnh username / mật khẩu tạm / force reset
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {userCanManage && panelTab === 'activity' ? (
            <div style={{ display: 'grid', gap: '14px' }}>
              <DetailField label="Đăng nhập gần nhất" value={formatDate(viewingUser.lastLoginAt)} />
              <DetailField label="Ngôn ngữ" value={viewingUser.language || 'vi'} />
            </div>
          ) : null}
        </div>
      ) : null}
    </SidePanel>
  );
}
