import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

import { canManageUsers, fetchWithAuth, normalizeRoleCodes, type CurrentUser } from './auth';
import { showNotify } from './Notification';
import { useI18n } from './i18n';
import { normalizeImportReport, buildImportSummary } from './shared/imports/importReport';
import { buildTabularFileUrl } from './shared/imports/tabularFiles';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { type UserRecord, cloneUpdatedViewingUser, supportsUserBulkFileActions } from './userCrudHelpers';
import { UserDetailPanel } from './users/UserDetailPanel';
import { AddUserModal, EditUserModal } from './users/UserFormModal';
import { UserTable } from './users/UserTable';
import { getSupplementalRoles, useUserDirectoryData } from './users/userUiShared';

const API = '/api';

type PanelTab = 'profile' | 'access' | 'security' | 'activity';

export function Users({ isMobile, currentUser }: { isMobile?: boolean; currentUser?: CurrentUser } = {}) {
  const { t } = useI18n();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [viewingUser, setViewingUser] = useState<UserRecord | null>(null);
  const [confirmState, setConfirmState] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [panelTab, setPanelTab] = useState<PanelTab>('profile');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const directoryData = useUserDirectoryData(users);
  const token = currentUser?.token ?? '';
  const userCanManage = currentUser ? canManageUsers(currentUser.roleCodes, currentUser.systemRole) : false;
  const userCanEditUsers = userCanManage;
  const userSupportsBulkFileActions = supportsUserBulkFileActions(userCanManage);
  const hasSupplementalCapabilities = directoryData.items.some((item: any) => getSupplementalRoles(item.roleCodes, item.systemRole).length > 0);

  const loadData = async () => {
    setLoading(true);
    try {
      const route = userCanManage ? '/users' : '/users/directory';
      const response = await fetchWithAuth(token, `${API}${route}`);
      const payload = await response.json().catch(() => []);
      if (!response.ok) {
        throw new Error(payload?.error || 'Không tải được danh sách nhân sự');
      }
      setUsers(Array.isArray(payload) ? payload.map((item: any) => ({
        ...item,
        roleCodes: normalizeRoleCodes(item.roleCodes, item.systemRole),
      })) : []);
    } catch (error: any) {
      showNotify(error?.message || 'Không tải được danh sách nhân sự', 'error');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [userCanManage, token]);

  useEffect(() => {
    if (!viewingUser) {
      setPanelTab('profile');
    }
  }, [viewingUser]);

  const stats = useMemo(() => {
    const total = users.length;
    const lockedAccounts = users.filter((user) => user.accountStatus === 'locked' || user.accountStatus === 'suspended').length;
    const neverLoggedIn = users.filter((user) => !user.lastLoginAt).length;
    return { total, lockedAccounts, neverLoggedIn };
  }, [users]);

  const filterOptions = useMemo(() => ({
    departments: Array.from(new Set(users.map((user) => user.department).filter(Boolean))).sort(),
  }), [users]);

  const importCSV = async (event: any) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setLoading(true);
    try {
      const response = await fetchWithAuth(token, `${API}/users/import`, { method: 'POST', body: formData });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Không thể import dữ liệu');
      const report = normalizeImportReport(payload);
      showNotify(buildImportSummary(report), report.errors > 0 ? 'info' : 'success');
      await loadData();
    } catch (error: any) {
      showNotify(error?.message || 'Lỗi khi nhập dữ liệu', 'error');
    } finally {
      setLoading(false);
      if (event?.target) event.target.value = '';
    }
  };

  const exportData = (format: 'csv' | 'xlsx') => {
    window.open(buildTabularFileUrl(`${API}/users/export`, format), '_blank');
  };

  const downloadTemplate = (format: 'csv' | 'xlsx') => {
    window.open(buildTabularFileUrl(`${API}/template/users`, format), '_blank');
  };

  const handleLockToggle = async (item: UserRecord) => {
    const isLocked = item.accountStatus === 'locked' || item.accountStatus === 'suspended';
    const endpoint = isLocked ? 'unlock' : 'lock';
    const label = isLocked ? 'mở khóa' : 'khóa';
    setConfirmState({
      message: `${label.charAt(0).toUpperCase() + label.slice(1)} tài khoản "${item.fullName}"?`,
      onConfirm: async () => {
        setConfirmState(null);
        try {
          const response = await fetchWithAuth(token, `${API}/users/${item.id}/${endpoint}`, { method: 'POST' });
          if (!response.ok) throw new Error('Lỗi server');
          showNotify(`Đã ${label} tài khoản ${item.fullName}!`, 'success');
          await loadData();
          if (viewingUser?.id === item.id) {
            setViewingUser({ ...viewingUser, accountStatus: isLocked ? 'active' : 'locked' });
          }
        } catch (error: any) {
          showNotify(`Lỗi: ${error.message}`, 'error');
        }
      },
    });
  };

  const handleUpdatedUser = (updatedUser: UserRecord) => {
    setUsers((current) => current.map((item: any) => item.id === updatedUser.id ? {
      ...updatedUser,
      roleCodes: normalizeRoleCodes(updatedUser.roleCodes, updatedUser.systemRole),
    } : item));
    setEditingUser((current) => current?.id === updatedUser.id ? updatedUser : current);
    setViewingUser((current) => cloneUpdatedViewingUser(current, updatedUser));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {confirmState ? (
        <ConfirmDialog
          message={confirmState.message}
          onConfirm={confirmState.onConfirm}
          onCancel={() => setConfirmState(null)}
          variant="warning"
          confirmLabel="Xác nhận"
        />
      ) : null}

      {showAdd ? (
        <AddUserModal
          onClose={() => setShowAdd(false)}
          onSaved={loadData}
          token={token}
        />
      ) : null}

      {editingUser ? (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={handleUpdatedUser}
          token={token}
        />
      ) : null}

      <UserDetailPanel
        open={!!viewingUser}
        viewingUser={viewingUser}
        panelTab={panelTab}
        setPanelTab={setPanelTab}
        userCanManage={userCanManage}
        userCanEditUsers={userCanEditUsers}
        onClose={() => setViewingUser(null)}
        onLockToggle={handleLockToggle}
        onEdit={(user) => {
          setEditingUser(user);
          setViewingUser(null);
        }}
      />

      <input type="file" ref={fileInputRef} onChange={importCSV} style={{ display: 'none' }} accept=".csv,.xlsx" />

      <UserTable
        isMobile={isMobile}
        loading={loading}
        userCanManage={userCanManage}
        userCanEditUsers={userCanEditUsers}
        userSupportsBulkFileActions={userSupportsBulkFileActions}
        directoryData={directoryData}
        filterOptions={filterOptions}
        stats={stats}
        hasSupplementalCapabilities={hasSupplementalCapabilities}
        onAddUser={() => setShowAdd(true)}
        onOpenUser={(user) => {
          setViewingUser(user);
          setPanelTab('profile');
        }}
        onEditUser={(user) => setEditingUser(user)}
        onImportClick={() => fileInputRef.current?.click()}
        onExportData={exportData}
        onDownloadTemplate={downloadTemplate}
        title={t('admin.users.title')}
        subtitle={userCanManage ? t('admin.users.subtitle') : 'Tra cứu danh bạ nội bộ và thông tin liên hệ đồng nghiệp.'}
      />
    </div>
  );
}
