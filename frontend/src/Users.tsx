import { API_BASE } from './config';
import { useState, useEffect, useMemo, useRef } from 'preact/hooks';
import { showNotify } from './Notification';
import { tokens } from './ui/tokens';
import { ui } from './ui/styles';
import { type CurrentUser, canEdit, canDelete, canManageUsers, fetchWithAuth, normalizeRoleCodes, ROLE_LABELS } from './auth';
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
                  onChange(Array.from(new Set(next)));
                }}
                style={{ width: '16px', height: '16px', accentColor: tokens.colors.primary }}
              />
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
      <div style={{ fontSize: '12px', color: tokens.colors.textMuted }}>
        Một user có thể có nhiều capability cùng lúc. Ví dụ: `sales` + `project_manager`.
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
      const res = await fetchWithAuth(token, `${API}/users`, {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          roleCodes: normalizeRoleCodes([...form.roleCodes, form.systemRole], form.systemRole),
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
      const res = await fetchWithAuth(token, `${API}/users/${user.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...form,
          roleCodes: normalizeRoleCodes([...form.roleCodes, form.systemRole], form.systemRole),
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

function useSortableData(items: any[]) {
  const [sortConfig, setSortConfig] = useState<any>(null);
  const [filters, setFilters] = useState<any>({});
  const filteredItems = useMemo(() => {
    const getComparableValue = (item: any, key: string) => {
      if (key === 'contact') return `${item.email || ''} ${item.phone || ''}`.trim();
      return item[key] || '';
    };
    let result = [...items];
    Object.keys(filters).forEach(k => {
      if (filters[k]) result = result.filter(i => String(getComparableValue(i, k)).toLowerCase().includes(filters[k].toLowerCase()));
    });
    if (sortConfig) result.sort((a, b) => {
      const vA = String(getComparableValue(a, sortConfig.key)).toLowerCase();
      const vB = String(getComparableValue(b, sortConfig.key)).toLowerCase();
      if (vA < vB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (vA > vB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }, [items, sortConfig, filters]);
  return {
    items: filteredItems,
    requestSort: (key: string) => {
      let dir = 'asc';
      if (sortConfig?.key === key && sortConfig.direction === 'asc') dir = 'desc';
      setSortConfig({ key, direction: dir });
    },
    sortConfig,
    filters,
    setFilters,
  };
}

export function Users({ isMobile, currentUser }: { isMobile?: boolean; currentUser?: CurrentUser } = {}) {
  const { t } = useI18n();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [viewingUser, setViewingUser] = useState<any>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const userData = useSortableData(users);
  const token = currentUser?.token ?? '';
  const userCanEdit = currentUser ? canEdit(currentUser.roleCodes, currentUser.systemRole) : false;
  const userCanDelete = currentUser ? canDelete(currentUser.roleCodes, currentUser.systemRole) : false;
  const userCanManage = currentUser ? canManageUsers(currentUser.roleCodes, currentUser.systemRole) : false;

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(token, `${API}/users`);
      const data = await res.json();
      setUsers(Array.isArray(data) ? data.map((item: any) => ({
        ...item,
        roleCodes: normalizeRoleCodes(item.roleCodes, item.systemRole),
      })) : []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const stats = useMemo(() => {
    const total = users.length;
    const activeAccounts = users.filter(u => u.accountStatus === 'active').length;
    const lockedAccounts = users.filter(u => u.accountStatus === 'locked' || u.accountStatus === 'suspended').length;
    const pendingPassword = users.filter(u => u.mustChangePassword == 1 || u.mustChangePassword === true).length;
    return { total, activeAccounts, lockedAccounts, pendingPassword };
  }, [users]);

  const importCSV = async (e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setLoading(true);
    try {
      const res = await fetchWithAuth(token, `${API}/users/import`, { method: 'POST', body: formData });
      const result = await res.json();
      showNotify(`Đã nhập: ${result.inserted}, Bỏ qua: ${result.skipped}`, 'success');
      loadData();
    } catch { showNotify('Lỗi khi nhập CSV', 'error'); }
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
    } catch (err: any) {
      showNotify('Lỗi: ' + err.message, 'error');
    }
  };

  const cols = [
    { k: 'fullName', l: 'Họ và tên' },
    { k: 'role', l: 'Chức vụ' },
    { k: 'department', l: 'Phòng ban' },
    { k: 'contact', l: 'Liên hệ' },
    { k: 'accountStatus', l: 'Trạng thái' },
    { k: 'lastLoginAt', l: 'Đăng nhập cuối' },
  ];
  const primaryFilters = cols.slice(0, 3);
  const advancedFilters = cols.slice(3);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {showAdd && <AddUserModal onClose={() => setShowAdd(false)} onSaved={loadData} token={token} />}
      {editingUser && <EditUserModal user={editingUser} onClose={() => setEditingUser(null)} onSaved={loadData} token={token} />}
      {viewingUser && (
        <ModalWrapper title={`Chi tiết: ${viewingUser.fullName || ''}`} onClose={() => setViewingUser(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '16px' }}>
            <div>
              <p style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, marginBottom: '6px' }}>MÃ NV</p>
              <div style={{ fontWeight: 700 }}>{viewingUser.employeeCode || '-'}</div>
            </div>
            <div>
              <p style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, marginBottom: '6px' }}>QUYỀN</p>
              <div style={{ fontWeight: 700 }}>{ROLE_LABELS[viewingUser.systemRole as keyof typeof ROLE_LABELS] || viewingUser.systemRole || '-'}</div>
            </div>
            <div>
              <p style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, marginBottom: '6px' }}>CAPABILITIES</p>
              <div style={{ fontWeight: 700 }}>
                {normalizeRoleCodes(viewingUser.roleCodes, viewingUser.systemRole).map((roleCode) => ROLE_LABELS[roleCode]).join(', ')}
              </div>
            </div>
            <div>
              <p style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, marginBottom: '6px' }}>NGÀY VÀO</p>
              <div style={{ fontWeight: 700 }}>{viewingUser.startDate ? formatDate(viewingUser.startDate) : '-'}</div>
            </div>
            <div>
              <p style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, marginBottom: '6px' }}>ĐỊA CHỈ</p>
              <div style={{ fontWeight: 700 }}>{viewingUser.address || '-'}</div>
            </div>
            <div>
              <p style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, marginBottom: '6px' }}>TÀI KHOẢN</p>
              <AccountStatusBadge status={viewingUser.accountStatus} />
            </div>
            <div>
              <p style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, marginBottom: '6px' }}>ĐĂNG NHẬP CUỐI</p>
              <div style={{ fontWeight: 700 }}>{viewingUser.lastLoginAt ? formatDate(viewingUser.lastLoginAt) : 'Chưa đăng nhập'}</div>
            </div>
          </div>
        </ModalWrapper>
      )}

      <input type="file" ref={fileInputRef} onChange={importCSV} style={{ display: 'none' }} accept=".csv" />

      {/* KPI Cards */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        <div style={S.kpiCard}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase' }}>Tổng nhân viên</span>
          <span style={{ fontSize: '24px', fontWeight: 800, color: tokens.colors.textPrimary }}>{stats.total}</span>
        </div>
        <div style={{ ...S.kpiCard, borderLeft: `4px solid ${tokens.colors.success}` }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.success, textTransform: 'uppercase' }}>Đang hoạt động</span>
          <span style={{ fontSize: '24px', fontWeight: 800, color: tokens.colors.textPrimary }}>{stats.activeAccounts}</span>
        </div>
        <div style={{ ...S.kpiCard, borderLeft: `4px solid ${tokens.colors.error}` }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.error, textTransform: 'uppercase' }}>Đã khóa</span>
          <span style={{ fontSize: '24px', fontWeight: 800, color: tokens.colors.textPrimary }}>{stats.lockedAccounts}</span>
        </div>
        <div style={{ ...S.kpiCard, borderLeft: '4px solid #e65100' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: '#e65100', textTransform: 'uppercase' }}>Chờ đổi mật khẩu</span>
          <span style={{ fontSize: '24px', fontWeight: 800, color: tokens.colors.textPrimary }}>{stats.pendingPassword}</span>
        </div>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: tokens.colors.textPrimary, margin: 0 }}>{t('admin.users.title')}</h2>
          <p style={{ fontSize: '14px', color: tokens.colors.textSecondary, margin: '6px 0 0' }}>{t('admin.users.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', ...(isMobile ? { overflowX: 'auto', maxWidth: '100%', flexWrap: 'nowrap', whiteSpace: 'nowrap', WebkitOverflowScrolling: 'touch' } : {}) }}>
          <button style={S.btnOutline} onClick={downloadTemplate}>{t('common.csv_template')}</button>
          {userCanManage && <button style={S.btnOutline} onClick={() => fileInputRef.current?.click()}>{t('common.csv_import')}</button>}
          <button style={S.btnOutline} onClick={exportCSV}>{t('common.csv_export')}</button>
          {userCanManage && <button style={S.btnPrimary} onClick={() => setShowAdd(true)}>+ {t('admin.users.action.add')}</button>}
        </div>
      </div>

      {/* Table / Mobile cards */}
      <div style={{ ...S.card, overflow: 'hidden', border: `1px solid ${tokens.colors.border}` }}>
        {loading ? (
          <div style={{ padding: '80px', textAlign: 'center', color: tokens.colors.textMuted }}>Đang tải dữ liệu...</div>
        ) : isMobile ? (
          /* Mobile layout */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Mobile filters */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '16px', borderBottom: `1px solid ${tokens.colors.border}` }}>
              {[...primaryFilters, ...(showAdvancedFilters ? advancedFilters : [])].map(c => (
                <div key={c.k} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase' }}>{c.l}</label>
                  <input
                    type="text"
                    placeholder="Lọc..."
                    value={userData.filters[c.k] || ''}
                    onInput={(e: any) => userData.setFilters({ ...userData.filters, [c.k]: e.target.value })}
                    style={{ ...ui.input.base, width: '100%', padding: '8px 10px', fontSize: '12px', fontWeight: 400 }}
                  />
                </div>
              ))}
              <button
                onClick={() => setShowAdvancedFilters(v => !v)}
                style={{ ...ui.btn.outline, padding: '8px 10px', fontSize: '12px', justifyContent: 'center' }}
              >
                {showAdvancedFilters ? 'Thu gọn bộ lọc' : 'Bộ lọc nâng cao'}
              </button>
            </div>
            {/* Mobile cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' }}>
              {userData.items.map((item: any) => (
                <div key={item.id} style={{ ...ui.card.base, border: `1px solid ${tokens.colors.border}`, padding: tokens.spacing.lg }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                    <UserAvatar avatar={item.avatar} fullName={item.fullName} size={36} />
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 800, color: tokens.colors.textPrimary }}>
                        {item.fullName}
                      </div>
                      {item.employeeCode && <div style={{ fontSize: '11px', fontWeight: 700, color: tokens.colors.textMuted }}>{item.employeeCode}</div>}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}><strong>Chức vụ:</strong> {item.role || '-'}</div>
                    <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}><strong>Phòng ban:</strong> {item.department || '-'}</div>
                    <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}><strong>Liên hệ:</strong> {item.email || item.phone || '-'}</div>
                    <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <strong>Trạng thái:</strong> <AccountStatusBadge status={item.accountStatus} />
                    </div>
                    <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}><strong>Đăng nhập cuối:</strong> {item.lastLoginAt ? formatDate(item.lastLoginAt) : 'Chưa đăng nhập'}</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '12px', marginTop: '12px', borderTop: `1px solid ${tokens.colors.border}` }}>
                    <button onClick={() => setViewingUser(item)} style={{ ...ui.btn.outline, padding: '6px 10px' }}>Xem</button>
                    {userCanManage && (
                      <button
                        onClick={() => handleLockToggle(item)}
                        title={(item.accountStatus === 'locked' || item.accountStatus === 'suspended') ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}
                        style={{ color: tokens.colors.warning, background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}
                      >
                        {(item.accountStatus === 'locked' || item.accountStatus === 'suspended') ? 'Mở khóa' : 'Khóa'}
                      </button>
                    )}
                    {userCanEdit && (
                      <button onClick={() => setEditingUser(item)} style={{ ...ui.btn.outline, padding: '6px 10px' }}>Sửa</button>
                    )}
                    {userCanDelete && (
                      <button
                        onClick={() => { if (confirm('Xóa nhân viên này?')) { fetchWithAuth(token, `${API}/users/${item.id}`, { method: 'DELETE' }).then(() => loadData()); } }}
                        style={{ ...ui.btn.danger, padding: '6px 10px' }}
                      >
                        Xóa
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Desktop table */
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr>
                  {cols.map(c => (
                    <th key={c.k} style={S.thSortable} onClick={() => userData.requestSort(c.k)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{c.l} {userData.sortConfig?.key === c.k ? (userData.sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
                      </div>
                    </th>
                  ))}
                  <th style={{ ...S.thStatic, cursor: 'default', textAlign: 'right' }}>Thao tác</th>
                </tr>
                <tr>
                  {cols.map(c => {
                    const isPrimary = primaryFilters.some(p => p.k === c.k);
                    return (
                      <th key={c.k} style={{ ...S.thStatic, paddingTop: '8px' }}>
                        {isPrimary ? (
                          <input
                            type="text"
                            placeholder="Lọc..."
                            value={userData.filters[c.k] || ''}
                            onInput={(e: any) => userData.setFilters({ ...userData.filters, [c.k]: e.target.value })}
                            onClick={e => e.stopPropagation()}
                            style={{ ...ui.input.base, width: '100%', padding: '8px 10px', fontSize: '12px', fontWeight: 400 }}
                          />
                        ) : null}
                      </th>
                    );
                  })}
                  <th style={{ ...S.thStatic, paddingTop: '8px', textAlign: 'right' }}>
                    <button
                      onClick={() => setShowAdvancedFilters(v => !v)}
                      style={{ ...ui.btn.outline, padding: '8px 10px', fontSize: '12px' }}
                    >
                      {showAdvancedFilters ? 'Thu gọn bộ lọc' : 'Bộ lọc nâng cao'}
                    </button>
                  </th>
                </tr>
                {showAdvancedFilters && (
                  <tr>
                    {cols.map(c => {
                      const isAdvanced = advancedFilters.some(p => p.k === c.k);
                      return (
                        <th key={c.k} style={{ ...S.thStatic, paddingTop: '8px' }}>
                          {isAdvanced ? (
                            <input
                              type="text"
                            placeholder="Lọc..."
                              value={userData.filters[c.k] || ''}
                              onInput={(e: any) => userData.setFilters({ ...userData.filters, [c.k]: e.target.value })}
                              onClick={e => e.stopPropagation()}
                              style={{ ...ui.input.base, width: '100%', padding: '8px 10px', fontSize: '12px', fontWeight: 400 }}
                            />
                          ) : null}
                        </th>
                      );
                    })}
                    <th style={{ ...S.thStatic, paddingTop: '8px', textAlign: 'right' }} />
                  </tr>
                )}
              </thead>
              <tbody>
                {userData.items.map((item: any) => (
                  <tr
                    key={item.id}
                    style={{ ...ui.table.row }}
                    onMouseEnter={(e: any) => e.currentTarget.style.background = tokens.colors.background}
                    onMouseLeave={(e: any) => e.currentTarget.style.background = ''}
                  >
                    {/* Name + avatar */}
                    <td style={{ ...S.td, fontWeight: 800, color: tokens.colors.textPrimary }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <UserAvatar avatar={item.avatar} fullName={item.fullName} size={32} />
                        <div>
                          <div>
                            {item.fullName}
                          </div>
                          {item.email && <div style={{ fontSize: '11px', fontWeight: 400, color: tokens.colors.textMuted }}>{item.email}</div>}
                        </div>
                      </div>
                    </td>
                    {/* Role */}
                    <td style={S.td}>
                      <span style={{ padding: '3px 10px', borderRadius: '6px', background: tokens.colors.background, border: `1px solid ${tokens.colors.border}`, fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted }}>
                        {item.role || '-'}
                      </span>
                    </td>
                    {/* Department */}
                    <td style={{ ...S.td, fontWeight: 700, color: tokens.colors.textSecondary }}>{item.department || '-'}</td>
                    {/* Contact */}
                    <td style={S.td}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span>{item.email || '-'}</span>
                        <span style={{ fontSize: '11px', color: tokens.colors.textMuted }}>{item.phone || ''}</span>
                      </div>
                    </td>
                    {/* Status */}
                    <td style={S.td}><AccountStatusBadge status={item.accountStatus} /></td>
                    {/* Last login */}
                    <td style={{ ...S.td, whiteSpace: 'nowrap', fontSize: '12px', color: tokens.colors.textMuted }}>
                      {item.lastLoginAt ? formatDate(item.lastLoginAt) : 'Chưa đăng nhập'}
                    </td>
                    {/* Actions */}
                    <td style={{ ...S.td, textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <button
                          onClick={() => setViewingUser(item)}
                          style={{ color: tokens.colors.textSecondary, background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 700 }}
                        >
                          Xem
                        </button>
                        {userCanManage && (
                          <button
                            onClick={() => handleLockToggle(item)}
                            title={(item.accountStatus === 'locked' || item.accountStatus === 'suspended') ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '15px', color: tokens.colors.warning, padding: '2px' }}
                          >
                            {(item.accountStatus === 'locked' || item.accountStatus === 'suspended') ? 'MK' : 'K'}
                          </button>
                        )}
                        {userCanEdit && (
                          <button
                            onClick={() => setEditingUser(item)}
                            style={{ color: tokens.colors.primary, background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 700 }}
                          >
                              Sửa
                          </button>
                        )}
                        {userCanDelete && (
                          <button
                            onClick={() => {
                                if (confirm('Xóa nhân viên này?')) {
                                fetchWithAuth(token, `${API}/users/${item.id}`, { method: 'DELETE' }).then(() => loadData());
                              }
                            }}
                            style={{ color: tokens.colors.error, background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 700 }}
                          >
                              Xóa
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
