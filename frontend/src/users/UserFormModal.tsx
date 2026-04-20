import { useEffect, useRef, useState } from 'preact/hooks';

import { fetchWithAuth, normalizeRoleCodes } from '../auth';
import { API_BASE } from '../config';
import { showNotify } from '../Notification';
import { normalizeGender } from '../gender';
import { compressImageForUpload } from '../shared/uploads/imageCompression';
import { tokens } from '../ui/tokens';
import type { SystemRole } from '../shared/domain/contracts';
import type { UserRecord } from '../userCrudHelpers';
import {
  AccountStatusBadge,
  DEPARTMENTS,
  derivePersistedSystemRole,
  GENDER_OPTIONS,
  ModalWrapper,
  PRIMARY_ROLE_OPTIONS,
  RoleCodeSelector,
  S,
  SectionDivider,
  toUsername,
  UserAvatar,
} from './userUiShared';

const API = API_BASE;

type AddUserModalProps = {
  onClose: () => void;
  onSaved: () => void;
  token: string;
};

type EditUserModalProps = {
  user: UserRecord;
  onClose: () => void;
  onSaved: (updatedUser: UserRecord) => void;
  token: string;
};

function UserStatusHelp() {
  return (
    <p style={{ margin: '6px 0 0', fontSize: '12px', color: tokens.colors.textMuted, lineHeight: 1.5 }}>
      Trạng thái nhân sự phản ánh tình trạng làm việc trong HR, không quyết định việc đăng nhập hệ thống.
    </p>
  );
}

function AccountStatusHelp() {
  return (
    <p style={{ margin: '6px 0 0', fontSize: '12px', color: tokens.colors.textMuted, lineHeight: 1.5 }}>
      Trạng thái tài khoản quyết định user có thể đăng nhập hay bị khóa khỏi hệ thống.
    </p>
  );
}

export function AddUserModal({ onClose, onSaved, token }: AddUserModalProps) {
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
  const [usernameEdited, setUsernameEdited] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!usernameEdited && form.fullName.trim()) {
      setForm((current) => ({ ...current, username: toUsername(form.fullName) }));
    }
  }, [form.fullName, usernameEdited]);

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!form.fullName.trim()) nextErrors.fullName = 'Bắt buộc nhập họ và tên';
    if (!form.role.trim()) nextErrors.role = 'Bắt buộc nhập chức vụ';
    if (form.password && form.password.length < 8) nextErrors.password = 'Tối thiểu 8 ký tự';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const updateField = (field: string, value: any) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (errors[field]) {
      setErrors((current) => ({ ...current, [field]: '' }));
    }
  };

  const inputStyle = (field: string) => errors[field]
    ? { ...S.input, borderColor: tokens.colors.error }
    : S.input;

  const submit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const normalizedRoleCodes = normalizeRoleCodes([...form.roleCodes, form.systemRole], form.systemRole);
      const persistedSystemRole = derivePersistedSystemRole(form.systemRole as SystemRole, normalizedRoleCodes);
      const response = await fetchWithAuth(token, `${API}/users`, {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          fullName: form.fullName.trim(),
          role: form.role.trim(),
          systemRole: persistedSystemRole,
          roleCodes: normalizedRoleCodes,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Lỗi server');
      }
      showNotify('Đã thêm nhân viên mới!', 'success');
      onSaved();
      onClose();
    } catch (error: any) {
      showNotify(`Lỗi: ${error.message}`, 'error');
      setSaving(false);
    }
  };

  return (
    <ModalWrapper title="Thêm nhân viên mới" onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '20px' }}>
        <SectionDivider label="Thông tin cá nhân" />
        <div style={{ gridColumn: 'span 2' }}>
          <label style={S.label}>Họ và tên đầy đủ *</label>
          <input type="text" placeholder="Nhập tên nhân viên" value={form.fullName} onChange={(e: any) => updateField('fullName', e.target.value)} style={inputStyle('fullName')} autoFocus />
          {errors.fullName ? <p style={{ margin: '4px 0 0', fontSize: '12px', color: tokens.colors.error }}>{errors.fullName}</p> : null}
        </div>
        <div>
          <label style={S.label}>Giới tính</label>
          <select value={form.gender} onChange={(e: any) => updateField('gender', e.target.value)} style={S.input}>
            {GENDER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div>
          <label style={S.label}>Mã NV (HTG-001)</label>
          <input type="text" placeholder="VD: HTG-001" value={form.employeeCode} onChange={(e: any) => updateField('employeeCode', e.target.value)} style={S.input} />
        </div>
        <div>
          <label style={S.label}>Ngày sinh</label>
          <input type="date" value={form.dateOfBirth} onChange={(e: any) => updateField('dateOfBirth', e.target.value)} style={S.input} />
        </div>
        <div>
          <label style={S.label}>Số điện thoại di động</label>
          <input type="text" placeholder="0901 234 567" value={form.phone} onChange={(e: any) => updateField('phone', e.target.value)} style={S.input} />
        </div>
        <div>
          <label style={S.label}>Địa chỉ email công ty</label>
          <input type="email" placeholder="email@huynhthy.com" value={form.email} onChange={(e: any) => updateField('email', e.target.value)} style={S.input} />
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <label style={S.label}>Địa chỉ</label>
          <input type="text" placeholder="Số nhà, đường, quận/huyện, tỉnh/thành phố" value={form.address} onChange={(e: any) => updateField('address', e.target.value)} style={S.input} />
        </div>

        <SectionDivider label="Thông tin công việc" />
        <div>
          <label style={S.label}>Chức vụ đang đảm nhiệm *</label>
          <input type="text" placeholder="VD: Sales Executive" value={form.role} onChange={(e: any) => updateField('role', e.target.value)} style={inputStyle('role')} />
          {errors.role ? <p style={{ margin: '4px 0 0', fontSize: '12px', color: tokens.colors.error }}>{errors.role}</p> : null}
        </div>
        <div>
          <label style={S.label}>Phòng ban trực thuộc</label>
          <select value={form.department} onChange={(e: any) => updateField('department', e.target.value)} style={S.input}>
            <option value="">-- Chọn phòng ban --</option>
            {DEPARTMENTS.map((department) => <option key={department} value={department}>{department}</option>)}
          </select>
        </div>
        <div>
          <label style={S.label}>Ngày vào công ty</label>
          <input type="date" value={form.startDate} onChange={(e: any) => updateField('startDate', e.target.value)} style={S.input} />
        </div>
        <div>
          <label style={S.label}>Trạng thái nhân sự</label>
          <select value={form.status} onChange={(e: any) => updateField('status', e.target.value)} style={S.input}>
            <option value="Active">Đang làm việc (Active)</option>
            <option value="Inactive">Đã nghỉ việc (Inactive)</option>
          </select>
          <UserStatusHelp />
        </div>

        <SectionDivider label="Tài khoản đăng nhập hệ thống" />
        <div>
          <label style={S.label}>Tên đăng nhập (username)</label>
          <input
            type="text"
            placeholder="VD: tran.van.a"
            value={form.username}
            onChange={(e: any) => {
              setUsernameEdited(true);
              updateField('username', e.target.value);
            }}
            style={S.input}
          />
          {!usernameEdited && form.fullName.trim() ? <p style={{ margin: '4px 0 0', fontSize: '11px', color: tokens.colors.textMuted }}>Tự động từ họ tên — có thể sửa</p> : null}
        </div>
        <div>
          <label style={S.label}>Mật khẩu ban đầu</label>
          <div style={{ position: 'relative' }}>
            <input type={showPassword ? 'text' : 'password'} placeholder="Tối thiểu 8 ký tự" value={form.password} onChange={(e: any) => updateField('password', e.target.value)} style={{ ...inputStyle('password'), paddingRight: '40px' }} />
            <button type="button" onClick={() => setShowPassword((current) => !current)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: tokens.colors.textMuted, padding: '4px', fontSize: '13px' }}>
              {showPassword ? 'Ẩn' : 'Hiện'}
            </button>
          </div>
          {errors.password ? <p style={{ margin: '4px 0 0', fontSize: '12px', color: tokens.colors.error }}>{errors.password}</p> : null}
        </div>
        <div>
          <label style={S.label}>Phân quyền hệ thống</label>
          <select value={form.systemRole} onChange={(e: any) => updateField('systemRole', e.target.value)} style={S.input}>
            {PRIMARY_ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div>
          <label style={S.label}>Trạng thái tài khoản</label>
          <select value={form.accountStatus} onChange={(e: any) => updateField('accountStatus', e.target.value)} style={S.input}>
            <option value="active">Active — Hoạt động</option>
            <option value="locked">Locked — Đã khóa</option>
            <option value="suspended">Suspended — Tạm ngưng</option>
          </select>
          <AccountStatusHelp />
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <label style={S.label}>Capability roles</label>
          <RoleCodeSelector value={form.roleCodes} onChange={(next) => updateField('roleCodes', next)} />
        </div>
        <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '4px' }}>
          <input type="checkbox" id="mustChangePassword" checked={form.mustChangePassword} onChange={(e: any) => updateField('mustChangePassword', e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: tokens.colors.primary }} />
          <label htmlFor="mustChangePassword" style={{ ...S.label, marginBottom: 0, cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: tokens.colors.textSecondary }}>
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

export function EditUserModal({ user, onClose, onSaved, token }: EditUserModalProps) {
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

  const updateField = (field: string, value: any) => {
    setForm((current: any) => ({ ...current, [field]: value }));
  };

  const submit = async () => {
    if (!form.fullName?.trim()) return showNotify('Thiếu họ và tên', 'error');
    if (!form.role?.trim()) return showNotify('Thiếu chức vụ', 'error');
    if (form.password && form.password.length < 8) return showNotify('Mật khẩu tối thiểu 8 ký tự', 'error');
    setSaving(true);
    try {
      const normalizedRoleCodes = normalizeRoleCodes([...form.roleCodes, form.systemRole], form.systemRole);
      const persistedSystemRole = derivePersistedSystemRole(form.systemRole as SystemRole, normalizedRoleCodes);
      const response = await fetchWithAuth(token, `${API}/users/${user.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...form,
          role: form.role.trim(),
          systemRole: persistedSystemRole,
          roleCodes: normalizedRoleCodes,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Lỗi server');
      }
      showNotify('Đã lưu thay đổi!', 'success');
      onSaved(payload);
      onClose();
    } catch (error: any) {
      showNotify(`Lỗi: ${error.message}`, 'error');
      setSaving(false);
    }
  };

  const handleAvatarChange = async (event: any) => {
    const file = event.target.files?.[0];
    if (!file) return;
    let preparedFile = file;
    try {
      const result = await compressImageForUpload(file, 'avatar');
      preparedFile = result.file;
    } catch {
      preparedFile = file;
    }
    const formData = new FormData();
    formData.append('avatar', preparedFile);
    setUploadingAvatar(true);
    try {
      const response = await fetchWithAuth(token, `${API}/users/${user.id}/avatar`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error('Upload thất bại');
      const payload = await response.json();
      const nextAvatar = payload.avatar || payload.avatarUrl || payload.path;
      setAvatarSrc(nextAvatar);
      updateField('avatar', nextAvatar);
      showNotify('Cập nhật ảnh đại diện thành công!', 'success');
    } catch (error: any) {
      showNotify(`Lỗi upload ảnh: ${error.message}`, 'error');
    }
    setUploadingAvatar(false);
  };

  return (
    <ModalWrapper title="Chỉnh sửa nhân viên" onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px', padding: '16px', background: tokens.colors.background, borderRadius: tokens.radius.md, border: `1px solid ${tokens.colors.border}` }}>
        <UserAvatar avatar={avatarSrc} fullName={form.fullName} size={48} />
        <div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: tokens.colors.textPrimary }}>{form.fullName}</div>
          {form.employeeCode ? <div style={{ fontSize: '12px', color: tokens.colors.textMuted }}>{form.employeeCode}</div> : null}
          <input type="file" ref={avatarInputRef} onChange={handleAvatarChange} accept="image/*" style={{ display: 'none' }} />
          <button onClick={() => avatarInputRef.current?.click()} disabled={uploadingAvatar} style={{ ...S.btnOutline, marginTop: '8px', padding: '5px 12px', fontSize: '12px', opacity: uploadingAvatar ? 0.7 : 1 }}>
            {uploadingAvatar ? 'Đang tải lên...' : 'Đổi ảnh'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '20px' }}>
        <SectionDivider label="Thông tin cá nhân" />
        <div>
          <label style={S.label}>Giới tính</label>
          <select value={form.gender} onChange={(e: any) => updateField('gender', e.target.value)} style={S.input}>
            {GENDER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div>
          <label style={S.label}>Họ và tên đầy đủ *</label>
          <input type="text" value={form.fullName} onInput={(e: any) => updateField('fullName', e.target.value)} style={S.input} />
        </div>
        <div>
          <label style={S.label}>Mã NV (HTG-001)</label>
          <input type="text" placeholder="VD: HTG-001" value={form.employeeCode} onInput={(e: any) => updateField('employeeCode', e.target.value)} style={S.input} />
        </div>
        <div>
          <label style={S.label}>Ngày sinh</label>
          <input type="date" value={form.dateOfBirth} onInput={(e: any) => updateField('dateOfBirth', e.target.value)} style={S.input} />
        </div>
        <div>
          <label style={S.label}>Email</label>
          <input type="email" value={form.email} onInput={(e: any) => updateField('email', e.target.value)} style={S.input} />
        </div>
        <div>
          <label style={S.label}>Số điện thoại</label>
          <input type="text" value={form.phone} onInput={(e: any) => updateField('phone', e.target.value)} style={S.input} />
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <label style={S.label}>Địa chỉ</label>
          <input type="text" value={form.address} onInput={(e: any) => updateField('address', e.target.value)} style={S.input} />
        </div>

        <SectionDivider label="Thông tin công việc" />
        <div>
          <label style={S.label}>Chức vụ *</label>
          <input type="text" value={form.role} onInput={(e: any) => updateField('role', e.target.value)} style={S.input} />
        </div>
        <div>
          <label style={S.label}>Phòng ban</label>
          <select value={form.department} onChange={(e: any) => updateField('department', e.target.value)} style={S.input}>
            <option value="">-- Chọn phòng ban --</option>
            {DEPARTMENTS.map((department) => <option key={department} value={department}>{department}</option>)}
          </select>
        </div>
        <div>
          <label style={S.label}>Ngày vào công ty</label>
          <input type="date" value={form.startDate} onInput={(e: any) => updateField('startDate', e.target.value)} style={S.input} />
        </div>
        <div>
          <label style={S.label}>Trạng thái nhân sự</label>
          <select value={form.status} onChange={(e: any) => updateField('status', e.target.value)} style={S.input}>
            <option value="Active">Đang làm việc</option>
            <option value="Inactive">Đã nghỉ việc</option>
          </select>
          <UserStatusHelp />
        </div>

        <SectionDivider label="Tài khoản hệ thống" />
        <div>
          <label style={S.label}>Tên đăng nhập</label>
          <input type="text" value={form.username || ''} onInput={(e: any) => updateField('username', e.target.value)} style={S.input} />
        </div>
        <div>
          <label style={S.label}>Mật khẩu mới (để trống nếu không đổi)</label>
          <input type="password" placeholder="Tối thiểu 8 ký tự" value={form.password} onInput={(e: any) => updateField('password', e.target.value)} style={S.input} />
        </div>
        <div>
          <label style={S.label}>Phân quyền hệ thống</label>
          <select value={form.systemRole} onChange={(e: any) => updateField('systemRole', e.target.value)} style={S.input}>
            {PRIMARY_ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div>
          <label style={S.label}>Trạng thái tài khoản</label>
          <select value={form.accountStatus} onChange={(e: any) => updateField('accountStatus', e.target.value)} style={S.input}>
            <option value="active">Active — Hoạt động</option>
            <option value="locked">Locked — Đã khóa</option>
            <option value="suspended">Suspended — Tạm ngưng</option>
          </select>
          <AccountStatusHelp />
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <label style={S.label}>Capability roles</label>
          <RoleCodeSelector value={form.roleCodes} onChange={(next) => updateField('roleCodes', next)} />
        </div>
        <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '4px' }}>
          <input type="checkbox" id="editMustChangePassword" checked={!!form.mustChangePassword} onChange={(e: any) => updateField('mustChangePassword', e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: tokens.colors.primary }} />
          <label htmlFor="editMustChangePassword" style={{ ...S.label, marginBottom: 0, cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: tokens.colors.textSecondary }}>
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

export function AccountStatusInlineLegend({ status }: { status?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <AccountStatusBadge status={status} />
      <span style={{ fontSize: '12px', color: tokens.colors.textMuted }}>Ảnh hưởng trực tiếp tới khả năng đăng nhập.</span>
    </div>
  );
}
