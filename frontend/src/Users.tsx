import { API_BASE } from './config';
import { useState, useEffect, useMemo, useRef } from 'preact/hooks';
import { showNotify } from './Notification';
import { tokens } from './ui/tokens';
import { ui } from './ui/styles';
import { buildRoleProfile, type CurrentUser, canEdit, canManageUsers, fetchWithAuth, normalizeRoleCodes, ROLE_LABELS } from './auth';
import type { SystemRole } from './shared/domain/contracts';
import { useI18n } from './i18n';
import { GENDER_OPTIONS, normalizeGender } from './gender';

const API = API_BASE;

const DEPARTMENTS = [
  'Ban Giam Doc',
  'Sales & Marketing',
  'Ky thuat',
  'Mua hang',
  'Ke toan & Tai chinh',
  'IT',
  'Hanh chinh - Nhan su',
  'Van hanh',
];

const BUSINESS_ROLE_OPTIONS: Array<{ value: SystemRole; label: string }> = [
  { value: 'sales', label: 'Sales' },
  { value: 'project_manager', label: 'Project Manager' },
  { value: 'procurement', label: 'Procurement' },
  { value: 'accounting', label: 'Accounting' },
  { value: 'legal', label: 'Legal' },
  { value: 'director', label: 'Director' },
  { value: 'admin', label: 'Admin' },
];

const PRIMARY_ROLE_OPTIONS: Array<{ value: SystemRole; label: string }> = [
  { value: 'viewer', label: 'Viewer — Chỉ xem' },
  { value: 'sales', label: 'Sales — Kinh doanh' },
  { value: 'project_manager', label: 'Project Manager — Điều phối dự án' },
  { value: 'procurement', label: 'Procurement — Mua hàng' },
  { value: 'accounting', label: 'Accounting — Kế toán' },
  { value: 'legal', label: 'Legal — Pháp lý' },
  { value: 'director', label: 'Director — Điều hành' },
  { value: 'admin', label: 'Admin — Toàn quyền' },
];

function canonicalizeProjectManagerRoles(roleCodes: SystemRole[]) {
  if (roleCodes.includes('project_manager') && roleCodes.includes('sales')) {
    return roleCodes.filter((roleCode) => roleCode !== 'sales');
  }
  return roleCodes;
}

function derivePersistedSystemRole(systemRole: SystemRole, roleCodes: SystemRole[]) {
  if (roleCodes.includes('project_manager') && systemRole === 'sales') {
    return 'project_manager' as SystemRole;
  }
  return systemRole;
}

const S = {
  card: ui.card.base as any,
  btnPrimary: ui.btn.primary as any,
  btnOutline: ui.btn.outline as any,
  thSortable: ui.table.thSortable as any,
  thStatic: ui.table.thStatic as any,
  td: ui.table.td as any,
  input: { ...ui.input.base, transition: 'all 0.2s ease' } as any,
  kpiCard: ui.card.kpi as any,
  label: { ...ui.form.label, display: 'block', marginBottom: '6px' } as any
};

function formatDate(val: any): string {
  if (!val) return 'Chưa đăng nhập';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return 'Chưa đăng nhập';
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return 'Chưa đăng nhập';
  }
}

function AccountStatusBadge({ status }: { status?: string }) {
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
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '99px', background: 'rgba(255,152,0,0.12)', fontSize: '11px', fontWeight: 700, color: '#e65100' }}>
        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#e65100', display: 'inline-block' }} />
        Tạm ngưng
      </span>
    );
  }
  return <span style={{ fontSize: '11px', color: tokens.colors.textMuted }}>-</span>;
}

function UserAvatar({ avatar, fullName, size = 32 }: { avatar?: string; fullName?: string; size?: number }) {
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
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: tokens.colors.primary,
      color: tokens.colors.textOnPrimary,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: size > 28 ? '13px' : '11px',
      fontWeight: 800,
      flexShrink: 0,
      border: `2px solid ${tokens.colors.border}`,
    }}>
      {initials}
    </div>
  );
}

function ModalWrapper({ title, children, onClose }: any) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: tokens.colors.textPrimary, opacity: 0.7 }} />
      <div style={{ ...ui.modal.shell, width: '100%', maxWidth: '680px', position: 'relative', zIndex: 1 }}>
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${tokens.colors.border}`, background: tokens.colors.background, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: tokens.colors.primary }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: tokens.colors.textMuted }}>&times;</button>
        </div>
        <div style={{ padding: '24px', maxHeight: '80vh', overflowY: 'auto' }}>{children}</div>
      </div>
    </div>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div style={{ gridColumn: 'span 2', borderTop: `1px solid ${tokens.colors.border}`, paddingTop: '16px', marginTop: '4px' }}>
      <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
    </div>
  );
}

function RoleCodeSelector({
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

function AddUserModal({ onClose, onSaved, token }: any) {
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    role: '',
    department: '',
    status: 'Active',
    gender: 'unknown',
    username: '',
    password: '',
    systemRole: 'viewer',
    roleCodes: [] as SystemRole[],
    employeeCode: '',
    dateOfBirth: '',
    address: '',
    startDate: '',
    accountStatus: 'active',
    mustChangePassword: true,
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.fullName.trim()) return showNotify('Thiếu họ và tên', 'error');
    if (form.password && form.password.length < 6) return showNotify('Mật khẩu tối thiểu 6 ký tự', 'error');
    setSaving(true);
    try {
      const normalizedRoleCodes = normalizeRoleCodes([...form.roleCodes, form.systemRole], form.systemRole);
      const persistedSystemRole = derivePersistedSystemRole(form.systemRole as SystemRole, normalizedRoleCodes);
      const res = await fetchWithAuth(token, `${API}/users`, {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          systemRole: persistedSystemRole,
          roleCodes: normalizedRoleCodes,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Lỗi server');
      }
      showNotify('Đã thêm nhân viên mới!', 'success');
      onSaved();
      onClose();
    } catch (err: any) {
      showNotify('Lỗi: ' + err.message, 'error');
      setSaving(false);
    }
  };

  const F = (field: string, val: any) => setForm(f => ({ ...f, [field]: val }));

  return (
    <ModalWrapper title="Them Nhan vien moi" onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '20px' }}>

        {/* Personal info */}
        <SectionDivider label="Thong tin ca nhan" />
        <div style={{ gridColumn: 'span 1' }}>
          <label style={S.label}>Giới tính</label>
          <select value={form.gender} onChange={(e: any) => F('gender', e.target.value)} style={S.input}>
            {GENDER_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div style={{ gridColumn: 'span 1' }}>
          <label style={S.label}>Ho va Ten day du *</label>
          <input type="text" placeholder="Nhap ten nhan vien" value={form.fullName} onInput={(e: any) => F('fullName', e.target.value)} style={S.input} />
        </div>
        <div style={{ gridColumn: 'span 1' }}>
          <label style={S.label}>Ma NV (HTG-001)</label>
          <input type="text" placeholder="VD: HTG-001" value={form.employeeCode} onInput={(e: any) => F('employeeCode', e.target.value)} style={S.input} />
        </div>
        <div style={{ gridColumn: 'span 1' }}>
          <label style={S.label}>Ngay sinh</label>
          <input type="date" value={form.dateOfBirth} onInput={(e: any) => F('dateOfBirth', e.target.value)} style={S.input} />
        </div>
        <div style={{ gridColumn: 'span 1' }}>
          <label style={S.label}>Dia chi Email cong ty</label>
          <input type="email" placeholder="email@huynhthy.com" value={form.email} onInput={(e: any) => F('email', e.target.value)} style={S.input} />
        </div>
        <div style={{ gridColumn: 'span 1' }}>
          <label style={S.label}>So dien thoai di dong</label>
          <input type="text" placeholder="0901 234 567" value={form.phone} onInput={(e: any) => F('phone', e.target.value)} style={S.input} />
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <label style={S.label}>Dia chi</label>
          <input type="text" placeholder="So nha, duong, quan/huyen, tinh/thanh pho" value={form.address} onInput={(e: any) => F('address', e.target.value)} style={S.input} />
        </div>

        {/* Work info */}
        <SectionDivider label="Thong tin cong viec" />
        <div style={{ gridColumn: 'span 1' }}>
          <label style={S.label}>Chức vụ đang đảm nhiệm</label>
          <input type="text" placeholder="VD: Sales Executive" value={form.role} onInput={(e: any) => F('role', e.target.value)} style={S.input} />
        </div>
        <div style={{ gridColumn: 'span 1' }}>
          <label style={S.label}>Phòng ban trực thuộc</label>
          <select value={form.department} onChange={(e: any) => F('department', e.target.value)} style={S.input}>
            <option value="">-- Chọn phòng ban --</option>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div style={{ gridColumn: 'span 1' }}>
          <label style={S.label}>Ngày vào công ty</label>
          <input type="date" value={form.startDate} onInput={(e: any) => F('startDate', e.target.value)} style={S.input} />
        </div>
        <div style={{ gridColumn: 'span 1' }}>
          <label style={S.label}>Trạng thái nhân sự</label>
          <select value={form.status} onChange={(e: any) => F('status', e.target.value)} style={S.input}>
            <option value="Active">Dang lam viec (Active)</option>
            <option value="Inactive">Da nghi viec (Inactive)</option>
          </select>
        </div>

        {/* Account info */}
        <SectionDivider label="Tai khoan dang nhap he thong" />
        <div style={{ gridColumn: 'span 1' }}>
          <label style={S.label}>Ten dang nhap (username)</label>
          <input type="text" placeholder="VD: tran.van.a" value={form.username} onInput={(e: any) => F('username', e.target.value)} style={S.input} />
        </div>
        <div style={{ gridColumn: 'span 1' }}>
          <label style={S.label}>Mật khẩu ban đầu</label>
          <input type="password" placeholder="Tối thiểu 6 ký tự" value={form.password} onInput={(e: any) => F('password', e.target.value)} style={S.input} />
        </div>
        <div style={{ gridColumn: 'span 1' }}>
          <label style={S.label}>Phan quyen he thong</label>
          <select value={form.systemRole} onChange={(e: any) => F('systemRole', e.target.value)} style={S.input}>
            {PRIMARY_ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div style={{ gridColumn: 'span 1' }}>
          <label style={S.label}>Trạng thái tài khoản</label>
          <select value={form.accountStatus} onChange={(e: any) => F('accountStatus', e.target.value)} style={S.input}>
            <option value="active">Active — Hoạt động</option>
            <option value="locked">Locked — Đã khóa</option>
            <option value="suspended">Suspended — Tạm ngưng</option>
          </select>
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <label style={S.label}>Capability roles</label>
          <RoleCodeSelector value={form.roleCodes} onChange={(next) => F('roleCodes', next)} />
        </div>
        <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '4px' }}>
          <input
            type="checkbox"
            id="mustChangePassword"
            checked={form.mustChangePassword}
            onChange={(e: any) => F('mustChangePassword', e.target.checked)}
            style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: tokens.colors.primary }}
          />
          <label for="mustChangePassword" style={{ ...S.label, marginBottom: 0, cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: tokens.colors.textSecondary }}>
            Bắt buộc đổi mật khẩu lần đầu
          </label>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginTop: '32px', justifyContent: 'flex-end', borderTop: `1px solid ${tokens.colors.border}`, paddingTop: '24px' }}>
        <button onClick={onClose} style={S.btnOutline}>Bỏ qua</button>
        <button onClick={submit} disabled={saving} style={{ ...S.btnPrimary, opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Đang lưu...' : 'Lưu nhân viên'}
        </button>
      </div>
    </ModalWrapper>
  );
}

function EditUserModal({ user, onClose, onSaved, token }: any) {
  const [form, setForm] = useState({
    ...user,
    gender: normalizeGender(user.gender),
    password: '',
    systemRole: user.systemRole || 'viewer',
    roleCodes: normalizeRoleCodes(user.roleCodes, user.systemRole),
    employeeCode: user.employeeCode || '',
    dateOfBirth: user.dateOfBirth || '',
    address: user.address || '',
    startDate: user.startDate || '',
    accountStatus: user.accountStatus || 'active',
    mustChangePassword: !!user.mustChangePassword,
    department: user.department || '',
  });
  const [saving, setSaving] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState<string | undefined>(user.avatar);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const F = (field: string, val: any) => setForm((f: any) => ({ ...f, [field]: val }));

  const submit = async () => {
    if (!form.fullName?.trim()) return showNotify('Thiếu họ và tên', 'error');
    if (form.password && form.password.length < 6) return showNotify('Mật khẩu tối thiểu 6 ký tự', 'error');
    setSaving(true);
    try {
      const normalizedRoleCodes = normalizeRoleCodes([...form.roleCodes, form.systemRole], form.systemRole);
      const persistedSystemRole = derivePersistedSystemRole(form.systemRole as SystemRole, normalizedRoleCodes);
      const res = await fetchWithAuth(token, `${API}/users/${user.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...form,
          systemRole: persistedSystemRole,
          roleCodes: normalizedRoleCodes,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Lỗi server');
      }
      showNotify('Đã lưu thay đổi!', 'success');
      onSaved();
      onClose();
    } catch (err: any) {
      showNotify('Lỗi: ' + err.message, 'error');
      setSaving(false);
    }
  };

  const handleAvatarChange = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('avatar', file);
    setUploadingAvatar(true);
    try {
      const res = await fetchWithAuth(token, `${API}/users/${user.id}/avatar`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Upload thất bại');
      const data = await res.json();
      const newAvatar = data.avatar || data.avatarUrl || data.path;
      setAvatarSrc(newAvatar);
      F('avatar', newAvatar);
      showNotify('Cập nhật ảnh đại diện thành công!', 'success');
    } catch (err: any) {
      showNotify('Lỗi upload ảnh: ' + err.message, 'error');
    }
    setUploadingAvatar(false);
  };

  return (
    <ModalWrapper title="Chỉnh sửa nhân viên" onClose={onClose}>
      {/* Avatar section */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px', padding: '16px', background: tokens.colors.background, borderRadius: tokens.radius.md, border: `1px solid ${tokens.colors.border}` }}>
        <UserAvatar avatar={avatarSrc} fullName={form.fullName} size={48} />
        <div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: tokens.colors.textPrimary }}>{form.fullName}</div>
          {form.employeeCode && <div style={{ fontSize: '12px', color: tokens.colors.textMuted }}>{form.employeeCode}</div>}
          <input
            type="file"
            ref={avatarInputRef}
            onChange={handleAvatarChange}
            accept="image/*"
            style={{ display: 'none' }}
          />
          <button
            onClick={() => avatarInputRef.current?.click()}
            disabled={uploadingAvatar}
            style={{ ...S.btnOutline, marginTop: '8px', padding: '5px 12px', fontSize: '12px', opacity: uploadingAvatar ? 0.7 : 1 }}
          >
            {uploadingAvatar ? 'Dang tai len...' : 'Doi anh'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '20px' }}>

        {/* Personal info */}
        <SectionDivider label="Thong tin ca nhan" />
        <div style={{ gridColumn: 'span 1' }}>
          <label style={S.label}>Giới tính</label>
          <select value={form.gender} onChange={(e: any) => F('gender', e.target.value)} style={S.input}>
            {GENDER_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div style={{ gridColumn: 'span 1' }}>
          <label style={S.label}>Ho va Ten day du *</label>
          <input type="text" value={form.fullName} onInput={(e: any) => F('fullName', e.target.value)} style={S.input} />
        </div>
        <div style={{ gridColumn: 'span 1' }}>
          <label style={S.label}>Ma NV (HTG-001)</label>
          <input type="text" placeholder="VD: HTG-001" value={form.employeeCode} onInput={(e: any) => F('employeeCode', e.target.value)} style={S.input} />
        </div>
        <div style={{ gridColumn: 'span 1' }}>
          <label style={S.label}>Ngay sinh</label>
          <input type="date" value={form.dateOfBirth} onInput={(e: any) => F('dateOfBirth', e.target.value)} style={S.input} />
        </div>
        <div style={{ gridColumn: 'span 1' }}>
          <label style={S.label}>Email</label>
          <input type="email" value={form.email} onInput={(e: any) => F('email', e.target.value)} style={S.input} />
        </div>
        <div style={{ gridColumn: 'span 1' }}>
          <label style={S.label}>So dien thoai</label>
          <input type="text" value={form.phone} onInput={(e: any) => F('phone', e.target.value)} style={S.input} />
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <label style={S.label}>Dia chi</label>
          <input type="text" value={form.address} onInput={(e: any) => F('address', e.target.value)} style={S.input} />
        </div>

        {/* Work info */}
        <SectionDivider label="Thong tin cong viec" />
        <div style={{ gridColumn: 'span 1' }}>
          <label style={S.label}>Chức vụ</label>
          <input type="text" value={form.role} onInput={(e: any) => F('role', e.target.value)} style={S.input} />
        </div>
        <div style={{ gridColumn: 'span 1' }}>
          <label style={S.label}>Phòng ban</label>
          <select value={form.department} onChange={(e: any) => F('department', e.target.value)} style={S.input}>
            <option value="">-- Chọn phòng ban --</option>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div style={{ gridColumn: 'span 1' }}>
          <label style={S.label}>Ngay vao cong ty</label>
          <input type="date" value={form.startDate} onInput={(e: any) => F('startDate', e.target.value)} style={S.input} />
        </div>
        <div style={{ gridColumn: 'span 1' }}>
          <label style={S.label}>Trạng thái nhân sự</label>
          <select value={form.status} onChange={(e: any) => F('status', e.target.value)} style={S.input}>
            <option value="Active">Đang làm việc</option>
            <option value="Inactive">Đã nghỉ việc</option>
          </select>
        </div>

        {/* Account info */}
        <SectionDivider label="Tài khoản hệ thống" />
        <div style={{ gridColumn: 'span 1' }}>
          <label style={S.label}>Tên đăng nhập</label>
          <input type="text" value={form.username || ''} onInput={(e: any) => F('username', e.target.value)} style={S.input} />
        </div>
        <div style={{ gridColumn: 'span 1' }}>
          <label style={S.label}>Mật khẩu mới (để trống nếu không đổi)</label>
          <input type="password" placeholder="......  " value={form.password} onInput={(e: any) => F('password', e.target.value)} style={S.input} />
        </div>
        <div style={{ gridColumn: 'span 1' }}>
          <label style={S.label}>Phân quyền hệ thống</label>
          <select value={form.systemRole} onChange={(e: any) => F('systemRole', e.target.value)} style={S.input}>
            {PRIMARY_ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div style={{ gridColumn: 'span 1' }}>
          <label style={S.label}>Trạng thái tài khoản</label>
          <select value={form.accountStatus} onChange={(e: any) => F('accountStatus', e.target.value)} style={S.input}>
            <option value="active">Active — Hoạt động</option>
            <option value="locked">Locked — Đã khóa</option>
            <option value="suspended">Suspended — Tạm ngưng</option>
          </select>
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <label style={S.label}>Capability roles</label>
          <RoleCodeSelector value={form.roleCodes} onChange={(next) => F('roleCodes', next)} />
        </div>
        <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '4px' }}>
          <input
            type="checkbox"
            id="editMustChangePassword"
            checked={!!form.mustChangePassword}
            onChange={(e: any) => F('mustChangePassword', e.target.checked)}
            style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: tokens.colors.primary }}
          />
          <label for="editMustChangePassword" style={{ ...S.label, marginBottom: 0, cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: tokens.colors.textSecondary }}>
            Bắt buộc đổi mật khẩu lần đầu
          </label>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginTop: '32px', justifyContent: 'flex-end', borderTop: `1px solid ${tokens.colors.border}`, paddingTop: '24px' }}>
        <button onClick={onClose} style={S.btnOutline}>Bỏ qua</button>
        <button onClick={submit} disabled={saving} style={{ ...S.btnPrimary, opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
        </button>
      </div>
    </ModalWrapper>
  );
}

type DirectorySortKey = 'fullName' | 'department' | 'primaryRole' | 'lastLoginAt';

function PasswordStateBadge({ mustChangePassword }: { mustChangePassword?: boolean | number | null }) {
  const pending = mustChangePassword === true || mustChangePassword === 1;
  if (pending) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '99px', background: 'rgba(255,152,0,0.12)', fontSize: '11px', fontWeight: 700, color: '#e65100' }}>
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

function EmploymentStatusBadge({ status }: { status?: string }) {
  const active = String(status || '').toLowerCase() === 'active';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '99px', background: active ? tokens.colors.badgeBgSuccess : tokens.colors.background, color: active ? tokens.colors.success : tokens.colors.textMuted, fontSize: '11px', fontWeight: 700, border: active ? 'none' : `1px solid ${tokens.colors.border}` }}>
      {active ? 'Đang làm việc' : 'Ngưng hoạt động'}
    </span>
  );
}

function getSupplementalRoles(roleCodes: SystemRole[], systemRole?: SystemRole) {
  const normalized = normalizeRoleCodes(roleCodes, systemRole);
  const primaryRole = buildRoleProfile(normalized, systemRole).primaryRole;
  return normalized.filter((roleCode) => roleCode !== primaryRole);
}

function CapabilitySummary({
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

function DetailField({ label, value }: { label: string; value?: any }) {
  return (
    <div style={{ display: 'grid', gap: '6px' }}>
      <div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: '14px', fontWeight: 600, color: tokens.colors.textPrimary }}>{value || '-'}</div>
    </div>
  );
}

function SidePanel({ open, title, subtitle, onClose, children }: { open: boolean; title: string; subtitle?: string; onClose: () => void; children: any }) {
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 120, display: 'flex', justifyContent: 'flex-end' }}>
      <button type="button" aria-label="Close panel" onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.46)', border: 'none', padding: 0, cursor: 'pointer' }} />
      <div style={{ position: 'relative', width: 'min(560px, 100vw)', height: '100%', background: tokens.colors.surface, borderLeft: `1px solid ${tokens.colors.border}`, boxShadow: '0 10px 40px rgba(15,23,42,0.18)', overflowY: 'auto' }}>
        <div style={{ padding: '22px 24px 18px', borderBottom: `1px solid ${tokens.colors.border}`, background: 'linear-gradient(180deg, rgba(0,77,53,0.08) 0%, rgba(255,255,255,0) 100%)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
            <div style={{ display: 'grid', gap: '6px' }}>
              <div style={{ fontSize: '22px', fontWeight: 900, color: tokens.colors.textPrimary }}>{title}</div>
              {subtitle ? <div style={{ fontSize: '13px', color: tokens.colors.textSecondary }}>{subtitle}</div> : null}
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '24px', color: tokens.colors.textMuted, lineHeight: 1 }}>&times;</button>
          </div>
        </div>
        <div style={{ padding: '24px' }}>{children}</div>
      </div>
    </div>
  );
}

function useUserDirectoryData(items: any[]) {
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
      searchIndex: [item.fullName, item.email, item.phone, item.department, item.role, item.employeeCode, ROLE_LABELS[profile.primaryRole], roleCodes.map((roleCode) => ROLE_LABELS[roleCode]).join(' ')].filter(Boolean).join(' ').toLowerCase(),
    };
  }), [items]);
  const filteredItems = useMemo(() => {
    let result = [...enrichedItems];
    if (filters.query.trim()) result = result.filter((item) => item.searchIndex.includes(filters.query.trim().toLowerCase()));
    if (filters.department) result = result.filter((item) => String(item.department || '') === filters.department);
    if (filters.primaryRole) result = result.filter((item) => item.primaryRole === filters.primaryRole);
    if (filters.accountStatus) result = result.filter((item) => String(item.accountStatus || '') === filters.accountStatus);
    if (filters.passwordState) result = result.filter((item) => item.passwordState === filters.passwordState);
    if (filters.loginState) result = result.filter((item) => item.loginState === filters.loginState);
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

export function Users({ isMobile, currentUser }: { isMobile?: boolean; currentUser?: CurrentUser } = {}) {
  const { t } = useI18n();
  const roleProfile = buildRoleProfile(currentUser?.roleCodes, currentUser?.systemRole);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [viewingUser, setViewingUser] = useState<any>(null);
  const [panelTab, setPanelTab] = useState<'profile' | 'access' | 'security' | 'activity'>('profile');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const directoryData = useUserDirectoryData(users);
  const token = currentUser?.token ?? '';
  const userCanEdit = currentUser ? canEdit(currentUser.roleCodes, currentUser.systemRole) : false;
  const userCanManage = currentUser ? canManageUsers(currentUser.roleCodes, currentUser.systemRole) : false;
  const hasSupplementalCapabilities = directoryData.items.some((item: any) => getSupplementalRoles(item.roleCodes, item.systemRole).length > 0);
  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(token, `${API}/users`);
      const data = await res.json();
      setUsers(Array.isArray(data) ? data.map((item: any) => ({
        ...item,
        roleCodes: normalizeRoleCodes(item.roleCodes, item.systemRole),
      })) : []);
    } catch {
      showNotify('Không tải được danh sách nhân sự', 'error');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!viewingUser) setPanelTab('profile');
  }, [viewingUser]);

  const stats = useMemo(() => {
    const total = users.length;
    const activeAccounts = users.filter((user) => user.accountStatus === 'active').length;
    const lockedAccounts = users.filter((user) => user.accountStatus === 'locked' || user.accountStatus === 'suspended').length;
    const pendingPassword = users.filter((user) => user.mustChangePassword === true || user.mustChangePassword === 1).length;
    const neverLoggedIn = users.filter((user) => !user.lastLoginAt).length;
    return { total, activeAccounts, lockedAccounts, pendingPassword, neverLoggedIn };
  }, [users]);

  const adminCapabilities = useMemo(() => {
    const counts: Record<string, number> = {
      sales: 0,
      project_manager: 0,
      procurement: 0,
      accounting: 0,
      legal: 0,
      director: 0,
      admin: 0,
      viewer: 0,
    };
    users.forEach((user) => {
      const normalized = normalizeRoleCodes(user.roleCodes, user.systemRole);
      normalized.forEach((roleCode) => {
        counts[roleCode] = (counts[roleCode] || 0) + 1;
      });
    });
    return counts;
  }, [users]);

  const filterOptions = useMemo(() => ({
    departments: Array.from(new Set(users.map((user) => user.department).filter(Boolean))).sort(),
  }), [users]);

  const importCSV = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setLoading(true);
    try {
      const res = await fetchWithAuth(token, `${API}/users/import`, { method: 'POST', body: formData });
      const result = await res.json();
      showNotify(`Đã nhập: ${result.inserted}, Bỏ qua: ${result.skipped}`, 'success');
      loadData();
    } catch {
      showNotify('Lỗi khi nhập CSV', 'error');
    }
    setLoading(false);
  };

  const exportCSV = () => window.open(`${API}/users/export`, '_blank');
  const downloadTemplate = () => window.open(`${API}/template/users`, '_blank');

  const handleLockToggle = async (item: any) => {
    const isLocked = item.accountStatus === 'locked' || item.accountStatus === 'suspended';
    const endpoint = isLocked ? 'unlock' : 'lock';
    const label = isLocked ? 'mở khóa' : 'khóa';
    if (!confirm(`${label.charAt(0).toUpperCase() + label.slice(1)} tài khoản "${item.fullName}"?`)) return;
    try {
      const res = await fetchWithAuth(token, `${API}/users/${item.id}/${endpoint}`, { method: 'POST' });
      if (!res.ok) throw new Error('Lỗi server');
      showNotify(`Đã ${label} tài khoản ${item.fullName}!`, 'success');
      loadData();
      if (viewingUser?.id === item.id) setViewingUser({ ...viewingUser, accountStatus: isLocked ? 'active' : 'locked' });
    } catch (err: any) {
      showNotify('Lỗi: ' + err.message, 'error');
    }
  };

  const openUserPanel = (user: any) => {
    setViewingUser(user);
    setPanelTab('profile');
  };

  const adminColumns: Array<{ key: DirectorySortKey | 'capabilities' | 'employment' | 'accountStatus' | 'passwordState'; label: string }> = [
    { key: 'fullName', label: 'User' },
    { key: 'department', label: 'Phòng ban' },
    { key: 'primaryRole', label: 'Primary role' },
    { key: 'employment', label: 'Employment' },
    { key: 'accountStatus', label: 'Account' },
    { key: 'passwordState', label: 'Password' },
    { key: 'lastLoginAt', label: 'Last login' },
  ];
  if (hasSupplementalCapabilities) adminColumns.splice(3, 0, { key: 'capabilities', label: 'Capabilities' });

  const renderDirectoryFilters = () => (
    <div style={{ ...S.card, display: 'grid', gap: '16px', border: `1px solid ${tokens.colors.border}` }}>
      <div style={{ display: 'grid', gap: '8px' }}>
        <div style={{ fontSize: '12px', fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase' }}>Tìm đồng nghiệp</div>
        <input
          type="text"
          placeholder="Tìm theo tên, email, số điện thoại, phòng ban..."
          value={directoryData.filters.query}
          onInput={(e: any) => directoryData.setFilters({ ...directoryData.filters, query: e.target.value })}
          style={{ ...S.input, width: '100%' }}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : `repeat(${userCanManage ? 5 : 3}, minmax(0, 1fr))`, gap: '12px' }}>
        <select value={directoryData.filters.department} onChange={(e: any) => directoryData.setFilters({ ...directoryData.filters, department: e.target.value })} style={S.input}>
          <option value="">Tất cả phòng ban</option>
          {filterOptions.departments.map((department) => <option key={department} value={department}>{department}</option>)}
        </select>
        <select value={directoryData.filters.primaryRole} onChange={(e: any) => directoryData.setFilters({ ...directoryData.filters, primaryRole: e.target.value })} style={S.input}>
          <option value="">Tất cả role</option>
          {PRIMARY_ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        {userCanManage ? (
          <>
            <select value={directoryData.filters.accountStatus} onChange={(e: any) => directoryData.setFilters({ ...directoryData.filters, accountStatus: e.target.value })} style={S.input}>
              <option value="">Tất cả account status</option>
              <option value="active">Active</option>
              <option value="locked">Locked</option>
              <option value="suspended">Suspended</option>
            </select>
            <select value={directoryData.filters.passwordState} onChange={(e: any) => directoryData.setFilters({ ...directoryData.filters, passwordState: e.target.value })} style={S.input}>
              <option value="">Tất cả password state</option>
              <option value="must_change">Yêu cầu đổi mật khẩu</option>
              <option value="normal">Bình thường</option>
            </select>
          </>
        ) : null}
        <select value={directoryData.filters.loginState} onChange={(e: any) => directoryData.setFilters({ ...directoryData.filters, loginState: e.target.value })} style={S.input}>
          <option value="">Tất cả đăng nhập</option>
          <option value="active">Đã từng đăng nhập</option>
          <option value="never_logged_in">Chưa từng đăng nhập</option>
        </select>
      </div>
    </div>
  );

  const renderAdminDesktopTable = () => (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead>
          <tr>
            {adminColumns.map((column) => (
              <th key={column.key} style={column.key === 'capabilities' || column.key === 'employment' || column.key === 'accountStatus' || column.key === 'passwordState' ? S.thStatic : S.thSortable} onClick={column.key === 'capabilities' || column.key === 'employment' || column.key === 'accountStatus' || column.key === 'passwordState' ? undefined : () => directoryData.requestSort(column.key as DirectorySortKey)}>
                <span>{column.label}{directoryData.sortConfig.key === column.key ? (directoryData.sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}</span>
              </th>
            ))}
            <th style={{ ...S.thStatic, textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {directoryData.items.map((item: any) => (
            <tr key={item.id} style={{ ...ui.table.row, borderTop: `1px solid ${tokens.colors.border}` }}>
              <td style={{ ...S.td, minWidth: '240px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><UserAvatar avatar={item.avatar} fullName={item.fullName} size={36} /><div style={{ display: 'grid', gap: '4px' }}><div style={{ fontSize: '14px', fontWeight: 800, color: tokens.colors.textPrimary }}>{item.fullName}</div><div style={{ fontSize: '12px', color: tokens.colors.textMuted }}>{item.employeeCode || item.username || '-'}</div></div></div></td>
              <td style={S.td}>{item.department || '-'}</td>
              <td style={{ ...S.td, minWidth: '150px' }}><span style={{ padding: '4px 10px', borderRadius: '999px', background: tokens.colors.background, border: `1px solid ${tokens.colors.border}`, fontSize: '11px', fontWeight: 800, color: tokens.colors.textSecondary, whiteSpace: 'nowrap', display: 'inline-flex' }}>{item.primaryRoleLabel}</span></td>
              {hasSupplementalCapabilities ? <td style={{ ...S.td, minWidth: '220px' }}><CapabilitySummary roleCodes={item.roleCodes} systemRole={item.systemRole} /></td> : null}
              <td style={S.td}><EmploymentStatusBadge status={item.status} /></td>
              <td style={S.td}><AccountStatusBadge status={item.accountStatus} /></td>
              <td style={S.td}><PasswordStateBadge mustChangePassword={item.mustChangePassword} /></td>
              <td style={{ ...S.td, whiteSpace: 'nowrap', color: tokens.colors.textMuted }}>{formatDate(item.lastLoginAt)}</td>
              <td style={{ ...S.td, textAlign: 'right' }}><div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><button onClick={() => openUserPanel(item)} style={{ ...ui.btn.outline, padding: '6px 10px' }}>Xem</button>{userCanEdit ? <button onClick={() => setEditingUser(item)} style={{ ...ui.btn.outline, padding: '6px 10px' }}>Sửa</button> : null}</div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderAdminMobileCards = () => (
    <div style={{ display: 'grid', gap: '12px' }}>
      {directoryData.items.map((item: any) => (
        <div key={item.id} style={{ ...ui.card.base, border: `1px solid ${tokens.colors.border}`, padding: tokens.spacing.lg }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}><UserAvatar avatar={item.avatar} fullName={item.fullName} size={40} /><div style={{ display: 'grid', gap: '3px' }}><div style={{ fontSize: '15px', fontWeight: 800, color: tokens.colors.textPrimary }}>{item.fullName}</div><div style={{ fontSize: '12px', color: tokens.colors.textMuted }}>{item.primaryRoleLabel} · {item.department || '-'}</div></div></div>
          <div style={{ display: 'grid', gap: '10px' }}>{getSupplementalRoles(item.roleCodes, item.systemRole).length > 0 ? <CapabilitySummary roleCodes={item.roleCodes} systemRole={item.systemRole} /> : null}<div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}><EmploymentStatusBadge status={item.status} /><AccountStatusBadge status={item.accountStatus} /><PasswordStateBadge mustChangePassword={item.mustChangePassword} /></div><div style={{ fontSize: '12px', color: tokens.colors.textMuted }}>Đăng nhập cuối: {formatDate(item.lastLoginAt)}</div></div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}><button onClick={() => openUserPanel(item)} style={{ ...ui.btn.outline, padding: '6px 10px' }}>Xem</button>{userCanEdit ? <button onClick={() => setEditingUser(item)} style={{ ...ui.btn.outline, padding: '6px 10px' }}>Sửa</button> : null}</div>
        </div>
      ))}
    </div>
  );

  const renderDirectoryDesktopTable = () => (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead><tr><th style={S.thSortable} onClick={() => directoryData.requestSort('fullName')}>Nhân viên{directoryData.sortConfig.key === 'fullName' ? (directoryData.sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}</th><th style={S.thSortable} onClick={() => directoryData.requestSort('department')}>Phòng ban{directoryData.sortConfig.key === 'department' ? (directoryData.sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}</th><th style={S.thSortable} onClick={() => directoryData.requestSort('primaryRole')}>Vai trò{directoryData.sortConfig.key === 'primaryRole' ? (directoryData.sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}</th><th style={S.thStatic}>Thông tin liên hệ</th>{hasSupplementalCapabilities ? <th style={S.thStatic}>Capabilities</th> : null}<th style={{ ...S.thStatic, textAlign: 'right' }}>Chi tiết</th></tr></thead>
        <tbody>
          {directoryData.items.map((item: any) => (
            <tr key={item.id} style={{ ...ui.table.row, borderTop: `1px solid ${tokens.colors.border}` }}>
              <td style={{ ...S.td, minWidth: '220px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><UserAvatar avatar={item.avatar} fullName={item.fullName} size={36} /><div style={{ display: 'grid', gap: '4px' }}><div style={{ fontSize: '14px', fontWeight: 800, color: tokens.colors.textPrimary }}>{item.fullName}</div><div style={{ fontSize: '12px', color: tokens.colors.textMuted }}>{item.role || item.primaryRoleLabel}</div></div></div></td>
              <td style={S.td}>{item.department || '-'}</td>
              <td style={S.td}>{item.primaryRoleLabel}</td>
              <td style={S.td}><div style={{ display: 'grid', gap: '4px' }}><div>{item.email || '-'}</div><div style={{ fontSize: '12px', color: tokens.colors.textMuted }}>{item.phone || '-'}</div></div></td>
              {hasSupplementalCapabilities ? <td style={{ ...S.td, minWidth: '180px' }}>{getSupplementalRoles(item.roleCodes, item.systemRole).length > 0 ? <CapabilitySummary roleCodes={item.roleCodes} systemRole={item.systemRole} emptyLabel="-" /> : '-'}</td> : null}
              <td style={{ ...S.td, textAlign: 'right' }}><button onClick={() => openUserPanel(item)} style={{ ...ui.btn.outline, padding: '6px 10px' }}>Xem</button></td>
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
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}><button onClick={() => openUserPanel(item)} style={{ ...ui.btn.outline, padding: '6px 10px' }}>Xem chi tiết</button></div>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {showAdd && <AddUserModal onClose={() => setShowAdd(false)} onSaved={loadData} token={token} />}
      {editingUser && <EditUserModal user={editingUser} onClose={() => setEditingUser(null)} onSaved={loadData} token={token} />}
      <SidePanel open={!!viewingUser} title={viewingUser?.fullName || ''} subtitle={userCanManage ? 'Employee record & access profile' : 'Employee directory profile'} onClose={() => setViewingUser(null)}>
        {viewingUser ? <div style={{ display: 'grid', gap: '20px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}><UserAvatar avatar={viewingUser.avatar} fullName={viewingUser.fullName} size={56} /><div style={{ display: 'grid', gap: '6px' }}><div style={{ fontSize: '18px', fontWeight: 900, color: tokens.colors.textPrimary }}>{viewingUser.fullName}</div><div style={{ fontSize: '13px', color: tokens.colors.textSecondary }}>{viewingUser.role || ROLE_LABELS[buildRoleProfile(viewingUser.roleCodes, viewingUser.systemRole).primaryRole]}</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}><EmploymentStatusBadge status={viewingUser.status} />{userCanManage ? <AccountStatusBadge status={viewingUser.accountStatus} /> : null}{userCanManage ? <PasswordStateBadge mustChangePassword={viewingUser.mustChangePassword} /> : null}</div></div></div>{userCanManage ? <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', borderBottom: `1px solid ${tokens.colors.border}`, paddingBottom: '12px' }}>{[{ key: 'profile', label: 'Profile' }, { key: 'access', label: 'Access' }, { key: 'security', label: 'Security' }, { key: 'activity', label: 'Activity' }].map((tab) => <button key={tab.key} onClick={() => setPanelTab(tab.key as any)} style={{ ...ui.btn.outline, padding: '8px 12px', background: panelTab === tab.key ? tokens.colors.primary : tokens.colors.surface, color: panelTab === tab.key ? tokens.colors.textOnPrimary : tokens.colors.textSecondary, borderColor: panelTab === tab.key ? tokens.colors.primary : tokens.colors.border }}>{tab.label}</button>)}</div> : null}{!userCanManage || panelTab === 'profile' ? <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}><DetailField label="Mã nhân sự" value={viewingUser.employeeCode} /><DetailField label="Phòng ban" value={viewingUser.department} /><DetailField label="Chức vụ" value={viewingUser.role} /><DetailField label="Email" value={viewingUser.email} /><DetailField label="Điện thoại" value={viewingUser.phone} /><DetailField label="Ngày vào công ty" value={viewingUser.startDate ? formatDate(viewingUser.startDate) : '-'} /><div style={{ gridColumn: '1 / -1' }}><DetailField label="Địa chỉ" value={viewingUser.address} /></div></div> : null}{userCanManage && panelTab === 'access' ? <div style={{ display: 'grid', gap: '18px' }}><DetailField label="Username" value={viewingUser.username} /><DetailField label="Primary role" value={ROLE_LABELS[buildRoleProfile(viewingUser.roleCodes, viewingUser.systemRole).primaryRole]} /><div style={{ display: 'grid', gap: '8px' }}><div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Capability roles</div><CapabilitySummary roleCodes={normalizeRoleCodes(viewingUser.roleCodes, viewingUser.systemRole)} systemRole={viewingUser.systemRole} emptyLabel="No extra capabilities" /></div></div> : null}{userCanManage && panelTab === 'security' ? <div style={{ display: 'grid', gap: '16px' }}><div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}><DetailField label="Account status" value={<AccountStatusBadge status={viewingUser.accountStatus} />} /><DetailField label="Password state" value={<PasswordStateBadge mustChangePassword={viewingUser.mustChangePassword} />} /><DetailField label="Last login" value={formatDate(viewingUser.lastLoginAt)} /><DetailField label="Employment status" value={<EmploymentStatusBadge status={viewingUser.status} />} /></div><div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}><button onClick={() => handleLockToggle(viewingUser)} style={ui.btn.outline}>{viewingUser.accountStatus === 'locked' || viewingUser.accountStatus === 'suspended' ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}</button>{userCanEdit ? <button onClick={() => { setEditingUser(viewingUser); setViewingUser(null); }} style={ui.btn.primary}>Chỉnh username / mật khẩu tạm / force reset</button> : null}</div></div> : null}{userCanManage && panelTab === 'activity' ? <div style={{ display: 'grid', gap: '12px' }}><DetailField label="Last login" value={formatDate(viewingUser.lastLoginAt)} /><DetailField label="Language" value={viewingUser.language || 'vi'} /></div> : null}</div> : null}
      </SidePanel>
      <input type="file" ref={fileInputRef} onChange={importCSV} style={{ display: 'none' }} accept=".csv" />
      {userCanManage ? <div style={{ ...ui.card.base, padding: '22px', display: 'grid', gap: '14px', background: 'linear-gradient(135deg, rgba(0, 77, 53, 0.10) 0%, rgba(0, 151, 110, 0.05) 50%, rgba(255,255,255,1) 100%)' }}><div style={{ display: 'grid', gap: '8px' }}><div style={{ ...ui.badge.info, display: 'inline-flex', width: 'fit-content' }}>{roleProfile.personaMode === 'admin' ? 'Admin system-only' : 'User administration'}</div><div style={{ fontSize: '28px', fontWeight: 900, color: tokens.colors.textPrimary }}>User & Role Admin</div><div style={{ fontSize: '14px', lineHeight: 1.7, color: tokens.colors.textSecondary, maxWidth: '76ch' }}>Console này tách profile nhân sự, quyền truy cập và trạng thái bảo mật để admin rà soát user theo đúng logic enterprise.</div></div><div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, minmax(0, 1fr))', gap: '12px' }}><div style={{ padding: '14px 16px', borderRadius: tokens.radius.lg, border: `1px solid ${tokens.colors.border}`, background: tokens.colors.surface }}><div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase' }}>Tổng user</div><div style={{ marginTop: '8px', fontSize: '24px', fontWeight: 900, color: tokens.colors.primary }}>{stats.total}</div></div><div style={{ padding: '14px 16px', borderRadius: tokens.radius.lg, border: `1px solid ${tokens.colors.border}`, background: tokens.colors.surface }}><div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase' }}>Business approvers</div><div style={{ marginTop: '8px', fontSize: '24px', fontWeight: 900, color: tokens.colors.warning }}>{adminCapabilities.accounting + adminCapabilities.legal + adminCapabilities.director}</div></div><div style={{ padding: '14px 16px', borderRadius: tokens.radius.lg, border: `1px solid ${tokens.colors.border}`, background: tokens.colors.surface }}><div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase' }}>System admins</div><div style={{ marginTop: '8px', fontSize: '24px', fontWeight: 900, color: tokens.colors.error }}>{adminCapabilities.admin}</div></div><div style={{ padding: '14px 16px', borderRadius: tokens.radius.lg, border: `1px solid ${tokens.colors.border}`, background: tokens.colors.surface }}><div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase' }}>Chưa từng đăng nhập</div><div style={{ marginTop: '8px', fontSize: '24px', fontWeight: 900, color: '#e65100' }}>{stats.neverLoggedIn}</div></div></div></div> : <div style={{ ...ui.card.base, padding: '22px', display: 'grid', gap: '10px', background: 'linear-gradient(135deg, rgba(1,87,155,0.08) 0%, rgba(255,255,255,1) 100%)' }}><div style={{ ...ui.badge.info, display: 'inline-flex', width: 'fit-content' }}>Employee directory</div><div style={{ fontSize: '28px', fontWeight: 900, color: tokens.colors.textPrimary }}>Danh bạ nội bộ</div><div style={{ fontSize: '14px', lineHeight: 1.7, color: tokens.colors.textSecondary, maxWidth: '70ch' }}>Tra cứu đồng nghiệp theo tên, phòng ban, role và thông tin liên hệ. Trạng thái tài khoản và action bảo mật được ẩn khỏi chế độ này.</div></div>}
      <div style={{ display: 'flex', alignItems: isMobile ? 'stretch' : 'center', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', gap: '12px' }}><div><h2 style={{ fontSize: '24px', fontWeight: 800, color: tokens.colors.textPrimary, margin: 0 }}>{userCanManage ? t('admin.users.title') : 'Employee Directory'}</h2><p style={{ fontSize: '14px', color: tokens.colors.textSecondary, margin: '6px 0 0' }}>{userCanManage ? 'Rà soát profile, access và security theo từng user.' : 'Tìm nhanh email và số điện thoại nội bộ để phối hợp công việc.'}</p></div>{userCanManage ? <div style={{ display: 'flex', gap: '10px', ...(isMobile ? { overflowX: 'auto', maxWidth: '100%', flexWrap: 'nowrap', whiteSpace: 'nowrap', WebkitOverflowScrolling: 'touch' } : {}) }}><button style={S.btnOutline} onClick={downloadTemplate}>{t('common.csv_template')}</button><button style={S.btnOutline} onClick={() => fileInputRef.current?.click()}>{t('common.csv_import')}</button><button style={S.btnOutline} onClick={exportCSV}>{t('common.csv_export')}</button><button style={S.btnPrimary} onClick={() => setShowAdd(true)}>+ {t('admin.users.action.add')}</button></div> : null}</div>
      {renderDirectoryFilters()}
      <div style={{ ...S.card, overflow: 'hidden', border: `1px solid ${tokens.colors.border}` }}>{loading ? <div style={{ padding: '80px', textAlign: 'center', color: tokens.colors.textMuted }}>Đang tải dữ liệu...</div> : directoryData.items.length === 0 ? <div style={{ padding: '48px 24px', textAlign: 'center', color: tokens.colors.textMuted }}>Không có nhân sự nào khớp với bộ lọc hiện tại.</div> : userCanManage ? (isMobile ? renderAdminMobileCards() : renderAdminDesktopTable()) : (isMobile ? renderDirectoryMobileCards() : renderDirectoryDesktopTable())}</div>
    </div>
  );
}
