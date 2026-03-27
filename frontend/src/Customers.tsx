import { API_BASE } from './config';
import { useState, useEffect, useRef, useMemo } from 'preact/hooks';
import { showNotify } from './Notification';
import { tokens } from './ui/tokens';
import { ui } from './ui/styles';
import { canEdit, canDelete, fetchWithAuth } from './auth';
import { OverlayModal } from './ui/OverlayModal';
import { consumeNavContext } from './navContext';
import { useI18n } from './i18n';
import { BuildingIcon, CheckCircle2Icon, EditIcon, ExportIcon, EyeIcon, HistoryIcon, ImportIcon, MailIcon, NoteIcon, PlusIcon, SearchIcon, SheetIcon, TrashIcon, UserIcon } from './ui/icons';
import { renderActivityIcon } from './ui/activityIcon';
import { GENDER_OPTIONS, getGenderLabel, normalizeGender } from './gender';

const API = API_BASE;

const S = {
  card: ui.card.base as any,
  btnPrimary: { ...ui.btn.primary, transition: 'all 0.2s ease' } as any,
  btnOutline: { ...ui.btn.outline, transition: 'all 0.2s ease' } as any,
  btnDanger: ui.btn.danger as any,
  thSortable: ui.table.thSortable as any,
  thStatic: ui.table.thStatic as any,
  td: ui.table.td as any,
  input: { ...ui.input.base, transition: 'all 0.2s ease' } as any,
  kpiCard: ui.card.kpi as any,
  label: { ...ui.form.label, display: 'block', marginBottom: '6px' } as any
};

type AccountTypeFilter = 'Customer' | 'Supplier' | 'Partner';

const ACCOUNT_TYPE_META: Record<AccountTypeFilter, { label: string; description: string }> = {
  Customer: {
    label: 'Khách hàng',
    description: 'Danh sách khách hàng đang giao dịch hoặc đang theo dõi.',
  },
  Supplier: {
    label: 'Nhà cung cấp',
    description: 'Danh sách nhà cung cấp phục vụ mua hàng, sourcing và đấu thầu.',
  },
  Partner: {
    label: 'Đối tác',
    description: 'Danh sách đại lý, đối tác chiến lược và đơn vị hợp tác.',
  },
};

const ACCOUNT_ROUTE_BY_TYPE: Record<AccountTypeFilter, 'Accounts' | 'Suppliers' | 'Partners'> = {
  Customer: 'Accounts',
  Supplier: 'Suppliers',
  Partner: 'Partners',
};

function AddAccountModal({
  onClose,
  onSaved,
  token,
  defaultAccountType = 'Customer',
}: {
  onClose: () => void;
  onSaved: () => void;
  token: string;
  defaultAccountType?: AccountTypeFilter;
}) {
  const [form, setForm] = useState({ companyName: '', region: '', industry: '', website: '', taxCode: '', address: '', accountType: defaultAccountType, shortName: '' });
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!form.companyName.trim()) return showNotify('Thiếu tên công ty', 'error');
    setSaving(true);
    await fetchWithAuth(token, `${API}/accounts`, { method: 'POST', body: JSON.stringify(form) });
    onSaved(); onClose();
  };
  return (
    <OverlayModal title={`Thêm ${ACCOUNT_TYPE_META[defaultAccountType].label} mới`} onClose={onClose} maxWidth="600px">
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '20px' }}>
        <div style={{ gridColumn: 'span 2' }}>
          <label style={S.label}>Tên đầy đủ của Công ty / Cảng *</label>
          <input type="text" placeholder="VD: Công ty Cổ phần Cảng Cát Lái" style={S.input} value={form.companyName} onInput={(e:any)=>setForm({...form, companyName: e.target.value})} />
        </div>
        <div style={{ gridColumn: 'span 1' }}>
          <label style={S.label}>Tên viết tắt (Sử dụng trên Báo giá)</label>
          <input type="text" placeholder="VD: Cát Lái" style={S.input} value={form.shortName} onInput={(e:any)=>setForm({...form, shortName: e.target.value})} />
        </div>
        <div style={{ gridColumn: 'span 1' }}>
          <label style={S.label}>Phân loại Đối tác *</label>
          <select value={form.accountType} onChange={(e:any)=>setForm({...form, accountType: e.target.value})} style={S.input}>
            <option value="Customer">Khách hàng (Customer)</option>
            <option value="Supplier">Nhà cung cấp (Supplier)</option>
            <option value="Partner">Đại lý / Đối tác (Partner)</option>
          </select>
        </div>
        <div style={{ gridColumn: 'span 1' }}><label style={S.label}>Lĩnh vực kinh doanh</label><input type="text" placeholder="VD: Logistics, Cảng biển..." style={S.input} value={form.industry} onInput={(e:any)=>setForm({...form, industry: e.target.value})} /></div>
        <div style={{ gridColumn: 'span 1' }}><label style={S.label}>Khu vực hoạt động</label><input type="text" placeholder="VD: Miền Nam, Hải Phòng..." style={S.input} value={form.region} onInput={(e:any)=>setForm({...form, region: e.target.value})} /></div>
        <div style={{ gridColumn: 'span 1' }}><label style={S.label}>Địa chỉ Website</label><input type="text" placeholder="https://example.com" style={S.input} value={form.website} onInput={(e:any)=>setForm({...form, website: e.target.value})} /></div>
        <div style={{ gridColumn: 'span 1' }}><label style={S.label}>Mã số thuế (Tài chính)</label><input type="text" placeholder="Nhập mã số thuế" style={S.input} value={form.taxCode} onInput={(e:any)=>setForm({...form, taxCode: e.target.value})} /></div>
        <div style={{ gridColumn: 'span 2' }}><label style={S.label}>Địa chỉ trụ sở chính (Xuất hóa đơn)</label><input type="text" placeholder="Số nhà, Tên đường, Quận/Huyện, Tỉnh/Thành..." style={S.input} value={form.address} onInput={(e:any)=>setForm({...form, address: e.target.value})} /></div>
      </div>
      <div style={{ display: 'flex', gap: '12px', marginTop: '32px', justifyContent: 'flex-end', borderTop: `1px solid ${tokens.colors.border}`, paddingTop: '24px' }}>
        <button onClick={onClose} style={S.btnOutline}>Bỏ qua</button>
        <button onClick={submit} style={S.btnPrimary}>{saving ? 'Đang lưu...' : 'Lưu Account'}</button>
      </div>
    </OverlayModal>
  );
}

function EditAccountModal({ account, onClose, onSaved, token }: any) {
  const [form, setForm] = useState({ accountType: 'Customer', ...account });
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!form.companyName.trim()) return showNotify('Thiếu tên công ty', 'error');
    setSaving(true);
    await fetchWithAuth(token, `${API}/accounts/${account.id}`, { method: 'PUT', body: JSON.stringify(form) });
    onSaved(); onClose();
  };
  return (
    <OverlayModal title={`Chỉnh sửa ${ACCOUNT_TYPE_META[(form.accountType as AccountTypeFilter) || 'Customer'].label}`} onClose={onClose} maxWidth="600px">
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '20px' }}>
        <div style={{ gridColumn: 'span 2' }}>
          <label style={S.label}>Tên đầy đủ của Công ty / Cảng *</label>
          <input type="text" style={S.input} value={form.companyName} onInput={(e:any)=>setForm({...form, companyName: e.target.value})} />
        </div>
        <div style={{ gridColumn: 'span 1' }}>
          <label style={S.label}>Tên viết tắt</label>
          <input type="text" style={S.input} value={form.shortName} onInput={(e:any)=>setForm({...form, shortName: e.target.value})} />
        </div>
        <div style={{ gridColumn: 'span 1' }}>
          <label style={S.label}>Phân loại Đối tác *</label>
          <select value={form.accountType} onChange={(e:any)=>setForm({...form, accountType: e.target.value})} style={S.input}>
            <option value="Customer">Khách hàng (Customer)</option>
            <option value="Supplier">Nhà cung cấp (Supplier)</option>
            <option value="Partner">Đại lý / Đối tác (Partner)</option>
          </select>
        </div>
        <div style={{ gridColumn: 'span 1' }}><label style={S.label}>Lĩnh vực</label><input type="text" placeholder="Lĩnh vực" style={S.input} value={form.industry} onInput={(e:any)=>setForm({...form, industry: e.target.value})} /></div>
        <div style={{ gridColumn: 'span 1' }}><label style={S.label}>Khu vực</label><input type="text" placeholder="Khu vực" style={S.input} value={form.region} onInput={(e:any)=>setForm({...form, region: e.target.value})} /></div>
        <div style={{ gridColumn: 'span 1' }}><label style={S.label}>Website</label><input type="text" placeholder="Website" style={S.input} value={form.website} onInput={(e:any)=>setForm({...form, website: e.target.value})} /></div>
        <div style={{ gridColumn: 'span 1' }}><label style={S.label}>Mã số thuế</label><input type="text" placeholder="Mã số thuế" style={S.input} value={form.taxCode} onInput={(e:any)=>setForm({...form, taxCode: e.target.value})} /></div>
        <div style={{ gridColumn: 'span 2' }}><label style={S.label}>Địa chỉ trụ sở</label><input type="text" placeholder="Địa chỉ trụ sở" style={S.input} value={form.address} onInput={(e:any)=>setForm({...form, address: e.target.value})} /></div>
      </div>
      <div style={{ display: 'flex', gap: '12px', marginTop: '32px', justifyContent: 'flex-end', borderTop: `1px solid ${tokens.colors.border}`, paddingTop: '24px' }}>
        <button onClick={onClose} style={S.btnOutline}>Bỏ qua</button>
        <button onClick={submit} style={S.btnPrimary}>{saving ? 'Đang lưu...' : 'Lưu Thay đổi'}</button>
      </div>
    </OverlayModal>
  );
}

function AddContactModal({ accounts, onClose, onSaved, token }: any) {
  const [form, setForm] = useState({ lastName: '', firstName: '', department: '', jobTitle: '', email: '', phone: '', accountId: '', gender: 'unknown' });
  const [saving, setSaving] = useState(false);
  const submit = async () => {
     if (!form.firstName || !form.accountId) return showNotify('Thiếu Tên hoặc Công ty', 'error');
     setSaving(true);
     await fetchWithAuth(token, `${API}/contacts`, { method: 'POST', body: JSON.stringify(form) });
     onSaved(); onClose();
  };
  return (
    <OverlayModal title="Thêm Liên hệ mới" onClose={onClose} maxWidth="600px">
      <datalist id="depts">
        <option value="Ban Giám Đốc" />
        <option value="Phòng Mua hàng (Purchasing)" />
        <option value="Phòng Kỹ thuật (Technical)" />
        <option value="Phòng Kế toán (Accounting)" />
        <option value="Dự án (Project)" />
      </datalist>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '20px' }}>
        <div style={{ gridColumn: 'span 1' }}>
          <label style={S.label}>Giới tính & Họ</label>
          <div style={{ display: 'flex', gap: '10px', minWidth: 0 }}>
             <select value={form.gender} onChange={(e: any) => setForm(p => ({ ...p, gender: e.target.value }))} style={{ ...S.input, width: '100px' }}>
                {GENDER_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
             </select>
             <input type="text" placeholder="Nhập Họ" value={form.lastName} onInput={(e: any) => setForm(p => ({ ...p, lastName: e.target.value }))} style={{ ...S.input, flex: 1, minWidth: 0 }} />
          </div>
        </div>
        <div style={{ gridColumn: 'span 1' }}>
          <label style={S.label}>Tên riêng *</label>
          <input type="text" placeholder="Nhập Tên *" value={form.firstName} onInput={(e: any) => setForm(p => ({ ...p, firstName: e.target.value }))} style={S.input} />
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <label style={S.label}>Thuộc Công ty / Đối tác *</label>
          <select value={form.accountId} onChange={(e: any) => setForm(p => ({ ...p, accountId: e.target.value }))} style={S.input}>
            <option value="">-- Chọn công ty đối tác --</option>
            {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.companyName}</option>)}
          </select>
        </div>
        <div style={{ gridColumn: 'span 1' }}>
          <label style={S.label}>Phòng ban công tác</label>
          <input type="text" list="depts" placeholder="Nhập phòng ban" value={form.department} onInput={(e: any) => setForm(p => ({ ...p, department: e.target.value }))} style={S.input} />
        </div>
        <div style={{ gridColumn: 'span 1' }}>
          <label style={S.label}>Vị trí / Chức vụ</label>
          <input type="text" placeholder="VD: Trưởng phòng vật tư" value={form.jobTitle} onInput={(e: any) => setForm(p => ({ ...p, jobTitle: e.target.value }))} style={S.input} />
        </div>
        <div style={{ gridColumn: 'span 1' }}>
          <label style={S.label}>Địa chỉ Email</label>
          <input type="email" placeholder="example@domain.com" value={form.email} onInput={(e: any) => setForm((p: any) => ({ ...p, email: e.target.value }))} style={S.input} />
        </div>
        <div style={{ gridColumn: 'span 1' }}>
          <label style={S.label}>Số điện thoại liên hệ</label>
          <input type="text" placeholder="09xx xxx xxx" value={form.phone} onInput={(e: any) => setForm((p: any) => ({ ...p, phone: e.target.value }))} style={S.input} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '10px', marginTop: '32px', justifyContent: 'flex-end', borderTop: `1px solid ${tokens.colors.border}`, paddingTop: '24px' }}>
        <button onClick={onClose} style={S.btnOutline}>Bỏ qua</button>
        <button onClick={submit} style={S.btnPrimary}>{saving ? 'Lưu...' : 'Lưu Liên hệ'}</button>
      </div>
    </OverlayModal>
  );
}

function EditContactModal({ accounts, contact, onClose, onSaved, token }: any) {
  const [form, setForm] = useState({ ...contact, gender: normalizeGender(contact.gender) });
  const [saving, setSaving] = useState(false);
  const submit = async () => {
     if (!form.firstName || !form.accountId) return showNotify('Thiếu Tên hoặc Công ty', 'error');
     setSaving(true);
     await fetchWithAuth(token, `${API}/contacts/${contact.id}`, { method: 'PUT', body: JSON.stringify(form) });
     onSaved(); onClose();
  };
  return (
    <OverlayModal title="Chỉnh sửa Liên hệ" onClose={onClose} maxWidth="600px">
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '20px' }}>
        <div style={{ gridColumn: 'span 1' }}>
          <label style={S.label}>Giới tính & Họ</label>
          <div style={{ display: 'flex', gap: '10px', minWidth: 0 }}>
             <select value={form.gender} onChange={(e: any) => setForm((p: any) => ({ ...p, gender: e.target.value }))} style={{ ...S.input, width: '100px' }}>
                {GENDER_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
             </select>
             <input type="text" placeholder="Họ" value={form.lastName} onInput={(e: any) => setForm((p: any) => ({ ...p, lastName: e.target.value }))} style={{ ...S.input, flex: 1, minWidth: 0 }} />
          </div>
        </div>
        <div style={{ gridColumn: 'span 1' }}>
          <label style={S.label}>Tên riêng *</label>
          <input type="text" placeholder="Tên *" value={form.firstName} onInput={(e: any) => setForm((p: any) => ({ ...p, firstName: e.target.value }))} style={S.input} />
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <label style={S.label}>Thuộc Công ty / Đối tác *</label>
          <select value={form.accountId} onChange={(e: any) => setForm((p: any) => ({ ...p, accountId: e.target.value }))} style={S.input}>
            <option value="">-- Chọn công ty đối tác --</option>
            {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.companyName}</option>)}
          </select>
        </div>
        <div style={{ gridColumn: 'span 1' }}>
          <label style={S.label}>Phòng ban</label>
          <input type="text" placeholder="Phòng ban" value={form.department} onInput={(e: any) => setForm((p: any) => ({ ...p, department: e.target.value }))} style={S.input} />
        </div>
        <div style={{ gridColumn: 'span 1' }}>
          <label style={S.label}>Vị trí / Chức vụ</label>
          <input type="text" placeholder="Vị trí" value={form.jobTitle} onInput={(e: any) => setForm((p: any) => ({ ...p, jobTitle: e.target.value }))} style={S.input} />
        </div>
        <div style={{ gridColumn: 'span 1' }}>
          <label style={S.label}>Email</label>
          <input type="email" placeholder="Email" value={form.email} onInput={(e: any) => setForm((p: any) => ({ ...p, email: e.target.value }))} style={S.input} />
        </div>
        <div style={{ gridColumn: 'span 1' }}>
          <label style={S.label}>Số điện thoại</label>
          <input type="text" placeholder="Số điện thoại" value={form.phone} onInput={(e: any) => setForm((p: any) => ({ ...p, phone: e.target.value }))} style={S.input} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '10px', marginTop: '32px', justifyContent: 'flex-end', borderTop: `1px solid ${tokens.colors.border}`, paddingTop: '24px' }}>
        <button onClick={onClose} style={S.btnOutline}>Bỏ qua</button>
        <button onClick={submit} style={S.btnPrimary}>{saving ? 'Lưu...' : 'Lưu Thay đổi'}</button>
      </div>
    </OverlayModal>
  );
}

function matchesQuery(value: unknown, needle: string) {
  if (!needle) return true;
  return String(value ?? '').toLowerCase().includes(needle.toLowerCase());
}

function parseIndustryTags(raw: unknown): string[] {
  if (!raw) return [];
  const values = Array.isArray(raw) ? raw : String(raw).split(',');
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const value of values) {
    const tag = String(value ?? '').trim().replace(/\s+/g, ' ');
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }
  return tags;
}

function IndustryTagChips({
  raw,
  activeTag,
  onTagClick,
}: {
  raw: unknown;
  activeTag?: string;
  onTagClick?: (tag: string) => void;
}) {
  const tags = parseIndustryTags(raw);
  if (!tags.length) return <span>-</span>;
  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
      {tags.map((tag) => {
        const active = activeTag?.toLowerCase() === tag.toLowerCase();
        return onTagClick ? (
          <button
            type="button"
            key={tag}
            onClick={() => onTagClick(tag)}
            style={{
              ...ui.badge.info,
              border: `1px solid ${active ? tokens.colors.primary : tokens.colors.border}`,
              background: active ? tokens.colors.primary : tokens.colors.surface,
              color: active ? tokens.colors.textOnPrimary : tokens.colors.textPrimary,
              cursor: 'pointer',
            }}
          >
            {tag}
          </button>
        ) : (
          <span key={tag} style={{ ...ui.badge.info, border: `1px solid ${tokens.colors.border}` }}>
            {tag}
          </span>
        );
      })}
    </div>
  );
}

function AccountDetailsModal({ account, onClose, onEdit, onHistory, onLog, canEditAccount, canDeleteAccount, onDelete }: any) {
  if (!account) return null;
  return (
    <OverlayModal title="Chi tiết khách hàng" onClose={onClose} maxWidth="680px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ padding: '16px', borderRadius: tokens.radius.lg, border: `1px solid ${tokens.colors.border}`, background: tokens.colors.background }}>
          <div style={{ fontSize: '20px', fontWeight: 900, color: tokens.colors.textPrimary }}>{account.companyName || '—'}</div>
          <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <span style={ui.badge.info}>{account.accountType || 'Customer'}</span>
            <span style={ui.badge.neutral}>{account.region || '—'}</span>
          </div>
        </div>
        <div style={{ padding: '14px', borderRadius: tokens.radius.lg, border: `1px solid ${tokens.colors.border}`, background: tokens.colors.surface }}>
          <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: tokens.colors.textMuted, marginBottom: '12px' }}>
            Thông tin kinh doanh
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
          <div>
            <label style={S.label}>Tên viết tắt</label>
            <div style={{ fontWeight: 700 }}>{account.shortName || '-'}</div>
          </div>
          <div>
            <label style={S.label}>Lĩnh vực</label>
            <div style={{ marginTop: '6px' }}>
              <IndustryTagChips raw={account.industry} />
            </div>
          </div>
          <div>
            <label style={S.label}>Khu vực</label>
            <div style={{ fontWeight: 700 }}>{account.region || '-'}</div>
          </div>
          <div>
            <label style={S.label}>Website</label>
            <div style={{ fontWeight: 700 }}>{account.website || '-'}</div>
          </div>
          <div>
            <label style={S.label}>Loại</label>
            <div style={{ fontWeight: 700 }}>{account.accountType || '-'}</div>
          </div>
        </div>
        </div>
        <div style={{ padding: '14px', borderRadius: tokens.radius.lg, border: `1px solid ${tokens.colors.border}`, background: tokens.colors.surface }}>
          <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: tokens.colors.textMuted, marginBottom: '12px' }}>
            Thông tin hành chính
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
            <div>
              <label style={S.label}>Mã số thuế</label>
              <div style={{ fontWeight: 700 }}>{account.taxCode || '-'}</div>
            </div>
            <div>
              <label style={S.label}>Địa chỉ</label>
              <div style={{ fontWeight: 700, color: tokens.colors.textSecondary }}>{account.address || '-'}</div>
            </div>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '24px', justifyContent: 'flex-end', borderTop: `1px solid ${tokens.colors.border}`, paddingTop: '16px' }}>
        <button onClick={onClose} style={S.btnOutline}>Đóng</button>
        <button onClick={onHistory} style={S.btnOutline}>Lịch sử</button>
        {canEditAccount && <button onClick={onLog} style={S.btnOutline}>Ghi nhận</button>}
        {canEditAccount && <button onClick={onEdit} style={S.btnPrimary}>Chỉnh sửa</button>}
        {canDeleteAccount && <button onClick={onDelete} style={S.btnDanger}>Xóa</button>}
      </div>
    </OverlayModal>
  );
}

function ContactDetailsModal({ contact, accounts, onClose, onEdit, onHistory, onLog, canEditContact, canDeleteContact, onDelete }: any) {
  if (!contact) return null;
  const companyName = accounts.find((a: any) => a.id === contact.accountId)?.companyName || accounts.find((a: any) => a.id === contact.accountId)?.shortName || '—';
  return (
    <OverlayModal title="Chi tiết liên hệ" onClose={onClose} maxWidth="680px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ padding: '16px', borderRadius: tokens.radius.lg, border: `1px solid ${tokens.colors.border}`, background: tokens.colors.background }}>
          <div style={{ fontSize: '20px', fontWeight: 900, color: tokens.colors.textPrimary }}>{contact.lastName} {contact.firstName}</div>
          <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <span style={ui.badge.info}>{companyName}</span>
            <span style={ui.badge.neutral}>{contact.department || '—'}</span>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
          <div>
            <label style={S.label}>Giới tính</label>
            <div style={{ fontWeight: 700 }}>{getGenderLabel(contact.gender)}</div>
          </div>
          <div>
            <label style={S.label}>Phòng ban</label>
            <div style={{ fontWeight: 700 }}>{contact.department || '—'}</div>
          </div>
          <div>
            <label style={S.label}>Chức vụ</label>
            <div style={{ fontWeight: 700 }}>{contact.jobTitle || '—'}</div>
          </div>
          <div>
            <label style={S.label}>Công ty</label>
            <div style={{ fontWeight: 700 }}>{companyName}</div>
          </div>
          <div>
            <label style={S.label}>Email</label>
            <div style={{ fontWeight: 700 }}>{contact.email || '—'}</div>
          </div>
          <div>
            <label style={S.label}>Điện thoại</label>
            <div style={{ fontWeight: 700 }}>{contact.phone || '—'}</div>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '24px', justifyContent: 'flex-end', borderTop: `1px solid ${tokens.colors.border}`, paddingTop: '16px' }}>
        <button onClick={onClose} style={S.btnOutline}>Đóng</button>
        <button onClick={onHistory} style={S.btnOutline}>Lịch sử</button>
        {canEditContact && <button onClick={onLog} style={S.btnOutline}>Ghi nhận</button>}
        {canEditContact && <button onClick={onEdit} style={S.btnPrimary}>Chỉnh sửa</button>}
        {canDeleteContact && <button onClick={onDelete} style={S.btnDanger}>Xóa</button>}
      </div>
    </OverlayModal>
  );
}

function LogEventModal({ entityId, entityType, entityName, onClose, onSaved, token }: any) {
  const [form, setForm] = useState({ title: '', description: '', category: 'CRM EVENT' });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const submit = async () => {
    if (!form.title.trim()) return showNotify('Thiếu tiêu đề sự kiện', 'error');
    setSaving(true);
    
    let icon = 'chat'; let color: any = tokens.colors.badgeBgInfo; let iconColor: any = tokens.colors.textMuted;
    if (form.category === 'TELEPHONY') { icon = 'phone'; color = tokens.colors.badgeBgInfo; iconColor = tokens.colors.info; }
    else if (form.category === 'MEETING') { icon = 'users'; color = tokens.colors.badgeBgSuccess; iconColor = tokens.colors.success; }
    else if (form.category === 'EMAIL') { icon = 'mail'; color = tokens.colors.badgeBgInfo; iconColor = tokens.colors.warning; }
    
    await fetchWithAuth(token, `${API}/activities`, { method: 'POST',
      body: JSON.stringify({
        ...form,
        icon, color, iconColor,
        entityId,
        entityType,
        link: entityType === 'Account' ? 'Accounts' : 'Contacts'
      }) 
    });
    setSuccess(true);
    setTimeout(() => {
      onSaved(); onClose();
    }, 1200);
  };
  
  if (success) {
    return (
      <OverlayModal title="Thành công" onClose={onClose} maxWidth="600px">
        <div style={{ textAlign: 'center', padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: tokens.colors.badgeBgSuccess, color: tokens.colors.success, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}><CheckCircle2Icon size={28} /></div>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: tokens.colors.textPrimary }}>Đã ghi nhận sự kiện!</h3>
          <p style={{ margin: '8px 0 0', fontSize: '14px', color: tokens.colors.textSecondary }}>Lịch sử tương tác đã được cập nhật thành công.</p>
        </div>
      </OverlayModal>
    );
  }

  return (
    <OverlayModal title={`Ghi nhận tương tác: ${entityName}`} onClose={onClose} maxWidth="600px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label style={S.label}>Đối tượng ghi nhận</label>
          <input type="text" style={{...S.input, background: tokens.colors.background, color: tokens.colors.textMuted}} value={entityName} disabled />
        </div>
        <div>
          <label style={S.label}>Loại sự kiện tương tác *</label>
          <select value={form.category} onChange={(e:any) => setForm({...form, category: e.target.value})} style={S.input}>
            <option value="TELEPHONY">Gọi điện (Call)</option>
          <option value="MEETING">Họp / Gặp mặt (Meeting)</option>
            <option value="EMAIL">Gửi Email</option>
            <option value="CRM EVENT">Khác (Other Interaction)</option>
          </select>
        </div>
        <div>
          <label style={S.label}>Tiêu đề tóm tắt nội dung *</label>
          <input type="text" placeholder="VD: Gọi điện tư vấn giải pháp cẩu bờ" style={S.input} value={form.title} onInput={(e:any)=>setForm({...form, title: e.target.value})} />
        </div>
        <div>
          <label style={S.label}>Ghi chú chi tiết trao đổi</label>
          <textarea placeholder="Nhập nội dung chi tiết buổi làm việc hoặc kết quả cuộc gọi..." style={{...S.input, minHeight: '100px', resize: 'vertical'}} value={form.description} onInput={(e:any)=>setForm({...form, description: e.target.value})} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '12px', marginTop: '32px', justifyContent: 'flex-end', borderTop: `1px solid ${tokens.colors.border}`, paddingTop: '24px' }}>
        <button onClick={onClose} style={S.btnOutline} disabled={saving}>Bỏ qua</button>
        <button onClick={submit} style={S.btnPrimary} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu Sự kiện'}</button>
      </div>
    </OverlayModal>
  );
}

export function HistoryModal({ entityId, entityName, onClose }: any) {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/activities?entityId=${entityId}`)
      .then(res => res.json())
      .then(data => { setActivities(data); setLoading(false); });
  }, [entityId]);

  return (
    <OverlayModal title={`Lịch sử tương tác: ${entityName}`} onClose={onClose} maxWidth="600px">
      {loading ? <div style={{ textAlign: 'center', padding: '40px', color: tokens.colors.textMuted }}>Đang tải lịch sử...</div> : (
        <div style={{ maxHeight: '450px', overflowY: 'auto', paddingRight: '8px' }}>
          {activities.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: tokens.colors.textMuted, background: tokens.colors.background, borderRadius: '12px' }}>
               <div style={{ fontSize: '32px', marginBottom: '12px', color: tokens.colors.textMuted, display: 'inline-flex' }}><MailIcon size={28} /></div>
               Chưa có sự kiện tương tác nào được ghi nhận.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}>
               <div style={{ position: 'absolute', top: 0, bottom: 0, left: '23px', width: '2px', background: tokens.colors.border, zIndex: 0 }} />
               {activities.map((act) => (
                 <div key={act.id} style={{ display: 'flex', gap: '16px', position: 'relative', zIndex: 1 }}>
                   <div style={{ flexShrink: 0, width: '48px', height: '48px', borderRadius: '50%', background: act.color || tokens.colors.background, border: `2px solid ${tokens.colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', boxShadow: `0 0 0 4px ${tokens.colors.surface}` }}>
                    <span style={{ color: act.iconColor || tokens.colors.textMuted, filter: act.iconColor ? `drop-shadow(0 0 1px ${act.iconColor})` : 'none' }}>
                      {renderActivityIcon(act.icon, act.category, 20)}
                    </span>
                  </div>
                   <div style={{ flex: 1, background: tokens.colors.background, padding: '16px', borderRadius: '12px', border: `1px solid ${tokens.colors.border}` }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: tokens.colors.textPrimary }}>{act.title}</h4>
                        <span style={{ fontSize: '11px', color: tokens.colors.textMuted, fontWeight: 600 }}>{new Date(act.createdAt).toLocaleString('vi-VN')}</span>
                     </div>
                     <div style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', background: tokens.colors.surface, border: `1px solid ${tokens.colors.border}`, fontSize: '10px', fontWeight: 700, color: tokens.colors.textSecondary, marginBottom: act.description ? '12px' : 0 }}>
                       {act.category}
                     </div>
                     {act.description && <p style={{ margin: 0, fontSize: '13.5px', color: tokens.colors.textSecondary, lineHeight: 1.5 }}>{act.description}</p>}
                   </div>
                 </div>
               ))}
            </div>
          )}
        </div>
      )}
      <div style={{ marginTop: '24px', textAlign: 'right', borderTop: `1px solid ${tokens.colors.border}`, paddingTop: '16px' }}>
        <button onClick={onClose} style={S.btnOutline}>Đóng</button>
      </div>
    </OverlayModal>
  );
}

function useSortableData(items: any[]) {
  const [sortConfig, setSortConfig] = useState<any>(null);
  const [filters, setFilters] = useState<any>({});
  const filteredItems = useMemo(() => {
    let res = [...items];
    Object.keys(filters).forEach(k => { if (filters[k]) res = res.filter(i => String(i[k]||'').toLowerCase().includes(filters[k].toLowerCase())); });
    if (sortConfig) res.sort((a,b) => {
      const vA = (a[sortConfig.key]||'').toString().toLowerCase();
      const vB = (b[sortConfig.key]||'').toString().toLowerCase();
      if (vA < vB) return sortConfig.direction==='asc'?-1:1;
      if (vA > vB) return sortConfig.direction==='asc'?1:-1;
      return 0;
    });
    return res;
  }, [items, sortConfig, filters]);
  return { items: filteredItems, requestSort: (key: string) => {
    let dir = 'asc'; if (sortConfig?.key === key && sortConfig.direction === 'asc') dir = 'desc';
    setSortConfig({ key, direction: dir });
  }, sortConfig, filters, setFilters };
}

export function Customers({
  view,
  isMobile,
  currentUser,
  initialAccountType = 'Customer',
  onNavigate,
}: {
  view: 'accounts' | 'contacts';
  isMobile?: boolean;
  currentUser?: any;
  initialAccountType?: AccountTypeFilter;
  onNavigate?: (route: string) => void;
}) {
  const { t } = useI18n();
  const token = currentUser?.token ?? '';
  const userCanEdit = currentUser ? canEdit(currentUser.roleCodes, currentUser.systemRole) : false;
  const userCanDelete = currentUser ? canDelete(currentUser.roleCodes, currentUser.systemRole) : false;
  const [activeTab, setActiveTab] = useState(view || 'accounts');
  const [selectedAccountType, setSelectedAccountType] = useState<AccountTypeFilter>(initialAccountType);

  useEffect(() => {
    setActiveTab(view);
  }, [view]);
  useEffect(() => {
    if (view === 'accounts') setSelectedAccountType(initialAccountType);
  }, [initialAccountType, view]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddAcc, setShowAddAcc] = useState(false);
  const [showAddCon, setShowAddCon] = useState(false);
  const [editingAcc, setEditingAcc] = useState<any>(null);
  const [editingCon, setEditingCon] = useState<any>(null);
  const [loggingAcc, setLoggingAcc] = useState<any>(null);
  const [loggingCon, setLoggingCon] = useState<any>(null);
  const [viewingAcc, setViewingAcc] = useState<any>(null);
  const [viewingCon, setViewingCon] = useState<any>(null);
  const [viewingHistoryAcc, setViewingHistoryAcc] = useState<any>(null);
  const [viewingHistoryCon, setViewingHistoryCon] = useState<any>(null);
  const [accountSearch, setAccountSearch] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const [showAccountAdvanced, setShowAccountAdvanced] = useState(false);
  const [showContactAdvanced, setShowContactAdvanced] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredAccounts = useMemo(() => {
    const needle = accountSearch.trim().toLowerCase();
    return accounts.filter((account: any) => {
      if ((account.accountType || 'Customer') !== selectedAccountType) return false;
      if (!needle) return true;
      return (
        matchesQuery(account.companyName, needle) ||
        matchesQuery(account.shortName, needle) ||
        matchesQuery(account.industry, needle) ||
        matchesQuery(account.region, needle) ||
        matchesQuery(account.website, needle)
      );
    });
  }, [accounts, selectedAccountType, accountSearch]);

  const filteredContacts = useMemo(() => {
    const needle = contactSearch.trim().toLowerCase();
    return contacts.filter((contact: any) => {
      if (!needle) return true;
      const company = accounts.find((a: any) => a.id === contact.accountId);
      return (
        matchesQuery(contact.lastName, needle) ||
        matchesQuery(contact.firstName, needle) ||
        matchesQuery(contact.department, needle) ||
        matchesQuery(contact.jobTitle, needle) ||
        matchesQuery(contact.email, needle) ||
        matchesQuery(contact.phone, needle) ||
        matchesQuery(company?.companyName, needle) ||
        matchesQuery(company?.shortName, needle)
      );
    });
  }, [contacts, accounts, contactSearch]);

  const accData = useSortableData(filteredAccounts);
  const conData = useSortableData(filteredContacts);

  const loadData = async () => {
    setLoading(true);
    try {
      const [accRes, conRes] = await Promise.all([ fetch(`${API}/accounts`), fetch(`${API}/contacts`) ]);
      setAccounts(await accRes.json()); setContacts(await conRes.json());
    } catch { console.error('Load failed'); }
    setLoading(false);
  };
  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    const ctx = consumeNavContext();
    if (!ctx) return;

    if (ctx.entityType === 'Account' && ctx.entityId) {
      setActiveTab('accounts');
      void (async () => {
        try {
          const res = await fetch(`${API}/accounts/${ctx.entityId}`);
          if (!res.ok) return;
          const acc = await res.json();
          if (acc?.accountType) handleAccountTypeChange(acc.accountType as AccountTypeFilter);
          setEditingAcc(acc);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch {
          // ignore
        }
      })();
    }
  }, []);

  const stats = useMemo(() => {
    const totalAccounts = accounts.length;
    const totalContacts = contacts.length;
    const customers = accounts.filter(a => a.accountType === 'Customer').length;
    const suppliers = accounts.filter(a => a.accountType === 'Supplier').length;
    const partners = accounts.filter(a => a.accountType === 'Partner').length;
    return { totalAccounts, totalContacts, customers, suppliers, partners };
  }, [accounts, contacts]);

  const handleImport = async (e: any) => {
     const file = e.target.files[0]; if (!file) return;
     const formData = new FormData(); formData.append('file', file);
     setLoading(true);
     const res = await fetchWithAuth(token, `${API}/accounts/import`, { method: 'POST', body: formData });
     const result = await res.json();
     showNotify(`Đã nhập xong: ${result.inserted} bản ghi mới.`, 'success'); loadData();
  };

  const exportData = () => {
    const type = activeTab === 'accounts' ? 'accounts' : 'contacts';
    window.open(`${API}/${type}/export`, '_blank');
  };

  const deleteAccount = async (id: string) => { if (confirm('Xóa?')) { await fetchWithAuth(token, `${API}/accounts/${id}`, { method: 'DELETE' }); loadData(); } };
  const deleteContact = async (id: string) => { if (confirm('Xóa?')) { await fetchWithAuth(token, `${API}/contacts/${id}`, { method: 'DELETE' }); loadData(); } };
  const handleIndustryTagClick = (tag: string) => {
    setAccountSearch((prev) => (prev.trim().toLowerCase() === tag.toLowerCase() ? '' : tag));
  };
  const handleAccountTypeChange = (type: AccountTypeFilter) => {
    setSelectedAccountType(type);
    if (view === 'accounts') onNavigate?.(ACCOUNT_ROUTE_BY_TYPE[type]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {showAddAcc && <AddAccountModal onClose={() => setShowAddAcc(false)} onSaved={loadData} token={token} defaultAccountType={selectedAccountType} />}
      {editingAcc && <EditAccountModal account={editingAcc} onClose={() => setEditingAcc(null)} onSaved={loadData} token={token} />}
      {showAddCon && <AddContactModal accounts={accounts} onClose={() => setShowAddCon(false)} onSaved={loadData} token={token} />}
      {editingCon && <EditContactModal accounts={accounts} contact={editingCon} onClose={() => setEditingCon(null)} onSaved={loadData} token={token} />}
      {viewingAcc && (
        <AccountDetailsModal
          account={viewingAcc}
          canEditAccount={userCanEdit}
          canDeleteAccount={userCanDelete}
          onClose={() => setViewingAcc(null)}
          onHistory={() => {
            setViewingHistoryAcc(viewingAcc);
            setViewingAcc(null);
          }}
          onLog={() => {
            setLoggingAcc(viewingAcc);
            setViewingAcc(null);
          }}
          onEdit={() => {
            setEditingAcc(viewingAcc);
            setViewingAcc(null);
          }}
          onDelete={() => {
            deleteAccount(viewingAcc.id);
            setViewingAcc(null);
          }}
        />
      )}
      {viewingCon && (
        <ContactDetailsModal
          contact={viewingCon}
          accounts={accounts}
          canEditContact={userCanEdit}
          canDeleteContact={userCanDelete}
          onClose={() => setViewingCon(null)}
          onHistory={() => {
            setViewingHistoryCon(viewingCon);
            setViewingCon(null);
          }}
          onLog={() => {
            setLoggingCon(viewingCon);
            setViewingCon(null);
          }}
          onEdit={() => {
            setEditingCon(viewingCon);
            setViewingCon(null);
          }}
          onDelete={() => {
            deleteContact(viewingCon.id);
            setViewingCon(null);
          }}
        />
      )}
      {loggingAcc && <LogEventModal entityId={loggingAcc.id} entityType="Account" entityName={loggingAcc.companyName} onClose={() => setLoggingAcc(null)} onSaved={() => {}} token={token} />}
      {loggingCon && <LogEventModal entityId={loggingCon.id} entityType="Contact" entityName={`${loggingCon.lastName} ${loggingCon.firstName}`} onClose={() => setLoggingCon(null)} onSaved={() => {}} token={token} />}
      {viewingHistoryAcc && <HistoryModal entityId={viewingHistoryAcc.id} entityName={viewingHistoryAcc.companyName} onClose={() => setViewingHistoryAcc(null)} />}
      {viewingHistoryCon && <HistoryModal entityId={viewingHistoryCon.id} entityName={`${viewingHistoryCon.lastName} ${viewingHistoryCon.firstName}`} onClose={() => setViewingHistoryCon(null)} />}
      <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImport} accept=".csv" />

      {/* Mini Dashboard */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        <div style={S.kpiCard}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase' }}>{t('sales.customers.kpi.total_accounts')}</span>
          <span style={{ fontSize: '24px', fontWeight: 800, color: tokens.colors.textPrimary }}>{stats.totalAccounts}</span>
        </div>
        <div style={{...S.kpiCard, borderLeft: `4px solid ${tokens.colors.info}`}}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.info, textTransform: 'uppercase' }}>{t('sales.customers.kpi.customers')}</span>
          <span style={{ fontSize: '24px', fontWeight: 800, color: tokens.colors.textPrimary }}>{stats.customers}</span>
        </div>
        <div style={{...S.kpiCard, borderLeft: `4px solid ${tokens.colors.warning}`}}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.warning, textTransform: 'uppercase' }}>{t('sales.customers.kpi.suppliers')}</span>
          <span style={{ fontSize: '24px', fontWeight: 800, color: tokens.colors.textPrimary }}>{stats.suppliers}</span>
        </div>
        <div style={{...S.kpiCard, borderLeft: `4px solid ${tokens.colors.primary}`}}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.primary, textTransform: 'uppercase' }}>Đối tác</span>
          <span style={{ fontSize: '24px', fontWeight: 800, color: tokens.colors.textPrimary }}>{stats.partners}</span>
        </div>
        <div style={{...S.kpiCard, borderLeft: `4px solid ${tokens.colors.success}`}}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.success, textTransform: 'uppercase' }}>{t('sales.customers.kpi.total_contacts')}</span>
          <span style={{ fontSize: '24px', fontWeight: 800, color: tokens.colors.textPrimary }}>{stats.totalContacts}</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: tokens.colors.textPrimary, margin: 0 }}>
             {activeTab === 'accounts'
               ? <><BuildingIcon size={22} strokeWidth={2} /> {ACCOUNT_TYPE_META[selectedAccountType].label}</>
               : <><UserIcon size={22} strokeWidth={2} /> {t('sales.customers.title.contacts')}</>}
          </h2>
          <p style={{ fontSize: '14px', color: tokens.colors.textSecondary, margin: '6px 0 0' }}>
            {activeTab === 'accounts'
              ? ACCOUNT_TYPE_META[selectedAccountType].description
              : t('sales.customers.subtitle.contacts')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', ...(isMobile ? { overflowX: 'auto', maxWidth: '100%', flexWrap: 'nowrap', whiteSpace: 'nowrap', WebkitOverflowScrolling: 'touch' } : {}) }}>
           <button style={S.btnOutline} onClick={() => window.open(`${API}/template/${activeTab === 'accounts' ? 'accounts' : 'contacts'}`)}><SheetIcon size={16} strokeWidth={2} /> {t('common.csv_template')}</button>
           {userCanEdit && activeTab === 'accounts' && <button style={S.btnOutline} onClick={() => fileInputRef.current?.click()}><ImportIcon size={16} strokeWidth={2} /> {t('common.csv_import')}</button>}
           <button style={S.btnOutline} onClick={exportData}><ExportIcon size={16} strokeWidth={2} /> {t('common.csv_export')}</button>
           {userCanEdit && <button style={S.btnPrimary} onClick={() => activeTab === 'accounts' ? setShowAddAcc(true) : setShowAddCon(true)}>
             <PlusIcon size={16} strokeWidth={2} /> {activeTab === 'accounts' ? `Thêm ${ACCOUNT_TYPE_META[selectedAccountType].label}` : t('sales.customers.action.add_contact')}
            </button>}
        </div>
      </div>

      {activeTab === 'accounts' && (
        <div style={{ ...S.card, display: 'flex', gap: '10px', flexWrap: 'wrap', border: `1px solid ${tokens.colors.border}` }}>
          {(Object.keys(ACCOUNT_TYPE_META) as AccountTypeFilter[]).map((type) => {
            const active = selectedAccountType === type;
            return (
              <button
                key={type}
                onClick={() => handleAccountTypeChange(type)}
                style={{
                  padding: '10px 16px',
                  borderRadius: tokens.radius.lg,
                  border: `1px solid ${active ? tokens.colors.primary : tokens.colors.border}`,
                  background: active ? tokens.colors.badgeBgSuccess : tokens.colors.surface,
                  color: active ? tokens.colors.primary : tokens.colors.textSecondary,
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                {ACCOUNT_TYPE_META[type].label}
              </button>
            );
          })}
        </div>
      )}

      <div style={{ ...S.card, display: 'flex', flexDirection: 'column', gap: '12px', border: `1px solid ${tokens.colors.border}` }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', flex: 1, minWidth: 0 }}>
            <div style={{ position: 'relative', minWidth: isMobile ? '100%' : '280px', flex: isMobile ? '1 1 100%' : '1 1 280px' }}>
              <SearchIcon size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
              <input
                type="text"
                placeholder={activeTab === 'accounts' ? 'Tìm theo công ty, lĩnh vực, khu vực...' : 'Tìm theo tên, công ty, phòng ban...'}
                value={activeTab === 'accounts' ? accountSearch : contactSearch}
                onInput={(e: any) => activeTab === 'accounts' ? setAccountSearch(e.target.value) : setContactSearch(e.target.value)}
                style={{ ...ui.input.base, padding: '9px 12px 9px 36px', fontSize: '13.5px', width: '100%', minWidth: 0 }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => activeTab === 'accounts' ? setShowAccountAdvanced((prev) => !prev) : setShowContactAdvanced((prev) => !prev)} style={S.btnOutline}>
              {activeTab === 'accounts'
                ? (showAccountAdvanced ? 'Ẩn bộ lọc nâng cao' : 'Bộ lọc nâng cao')
                : (showContactAdvanced ? 'Ẩn bộ lọc nâng cao' : 'Bộ lọc nâng cao')}
            </button>
            {(activeTab === 'accounts'
              ? !!(accountSearch.trim() || Object.values(accData.filters || {}).some(Boolean))
              : !!(contactSearch.trim() || Object.values(conData.filters || {}).some(Boolean))
            ) && (
              <button
                type="button"
                onClick={() => {
                  if (activeTab === 'accounts') {
                    setAccountSearch('');
                    accData.setFilters({});
                    setShowAccountAdvanced(false);
                  } else {
                    setContactSearch('');
                    conData.setFilters({});
                    setShowContactAdvanced(false);
                  }
                }}
                style={S.btnOutline}
              >
                Xóa bộ lọc
              </button>
            )}
          </div>
        </div>
        {(activeTab === 'accounts' ? showAccountAdvanced : showContactAdvanced) && (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: '12px' }}>
            {(activeTab === 'accounts'
              ? [
                  { key: 'shortName', label: 'Tên viết tắt' },
                  { key: 'industry', label: 'Lĩnh vực' },
                  { key: 'region', label: 'Khu vực' },
                ]
              : [
                  { key: 'department', label: 'Phòng ban' },
                  { key: 'jobTitle', label: 'Chức vụ' },
                  { key: 'email', label: 'Email' },
                  { key: 'phone', label: 'Điện thoại' },
                ]
            ).map((field) => {
              const data = activeTab === 'accounts' ? accData : conData;
              return (
                <div key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase' }}>{field.label}</label>
                  <input
                    type="text"
                    placeholder={`Lọc ${field.label.toLowerCase()}`}
                    value={data.filters[field.key] || ''}
                    onInput={(e: any) => data.setFilters({ ...data.filters, [field.key]: e.target.value })}
                    style={{ ...ui.input.base, width: '100%', padding: '8px 10px', fontSize: '12px', fontWeight: 400 }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ ...S.card, overflow: 'hidden', border: `1px solid ${tokens.colors.border}` }}>
        {loading ? <div style={{ padding: '80px', textAlign: 'center', color: tokens.colors.textMuted, fontSize: '15px' }}>⏳ {t('common.loading')}</div> : (
          isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' }}>
              {(activeTab === 'accounts' ? accData.items : conData.items).map((item: any) => {
                if (activeTab === 'accounts') {
                  return (
                    <div key={item.id} style={{ ...ui.card.base, border: `1px solid ${tokens.colors.border}`, padding: tokens.spacing.lg }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '15px', fontWeight: 800, color: tokens.colors.textPrimary }}>{item.companyName}</div>
                          <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, marginTop: '4px' }}>{item.shortName || item.industry || '—'}</div>
                        </div>
                        <button onClick={() => setViewingAcc(item)} style={{ ...ui.btn.outline, padding: '6px 10px', flexShrink: 0 }}><EyeIcon size={16} strokeWidth={2} /></button>
                      </div>
                      <div style={{ display: 'grid', gap: '8px', marginTop: '10px' }}>
                        <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}><strong>Phân loại:</strong> {item.accountType || '-'}</div>
                        <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}><strong>Khu vực:</strong> {item.region || '-'}</div>
                        <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}><strong>Lĩnh vực:</strong><div style={{ marginTop: '6px' }}><IndustryTagChips raw={item.industry} activeTag={accountSearch.trim()} onTagClick={handleIndustryTagClick} /></div></div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '12px', marginTop: '12px', borderTop: `1px solid ${tokens.colors.border}` }}>
                        <button style={{ ...ui.btn.outline, padding: '6px 10px' }} onClick={() => setViewingHistoryAcc(item)}><HistoryIcon size={16} strokeWidth={2} /></button>
                        {userCanEdit && <button style={{ ...ui.btn.outline, padding: '6px 10px' }} onClick={() => setLoggingAcc(item)}><NoteIcon size={16} strokeWidth={2} /></button>}
                        {userCanEdit && <button style={{ ...ui.btn.outline, padding: '6px 10px' }} onClick={() => setEditingAcc(item)}><EditIcon size={16} strokeWidth={2} /></button>}
                        {userCanDelete && <button style={{ ...S.btnDanger, padding: '6px 10px' }} onClick={() => deleteAccount(item.id)}><TrashIcon size={16} strokeWidth={2} /></button>}
                      </div>
                    </div>
                  );
                }
                const companyName = accounts.find((a: any) => a.id === item.accountId)?.companyName || accounts.find((a: any) => a.id === item.accountId)?.shortName || '-';
                return (
                  <div key={item.id} style={{ ...ui.card.base, border: `1px solid ${tokens.colors.border}`, padding: tokens.spacing.lg }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '15px', fontWeight: 800, color: tokens.colors.textPrimary }}>
                          {item.lastName} {item.firstName}
                        </div>
                        <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, marginTop: '4px' }}>{companyName}</div>
                      </div>
                      <button onClick={() => setViewingCon(item)} style={{ ...ui.btn.outline, padding: '6px 10px', flexShrink: 0 }}><EyeIcon size={16} strokeWidth={2} /></button>
                    </div>
                    <div style={{ display: 'grid', gap: '8px', marginTop: '10px' }}>
                      <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}><strong>Phòng ban:</strong> {item.department || '-'}</div>
                      <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}><strong>Liên hệ:</strong> {item.phone || item.email || '-'}</div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '12px', marginTop: '12px', borderTop: `1px solid ${tokens.colors.border}` }}>
                      <button style={{ ...ui.btn.outline, padding: '6px 10px' }} onClick={() => setViewingHistoryCon(item)}><HistoryIcon size={16} strokeWidth={2} /></button>
                      {userCanEdit && <button style={{ ...ui.btn.outline, padding: '6px 10px' }} onClick={() => setLoggingCon(item)}><NoteIcon size={16} strokeWidth={2} /></button>}
                      {userCanEdit && <button style={{ ...ui.btn.outline, padding: '6px 10px' }} onClick={() => setEditingCon(item)}><EditIcon size={16} strokeWidth={2} /></button>}
                      {userCanDelete && <button style={{ ...S.btnDanger, padding: '6px 10px' }} onClick={() => deleteContact(item.id)}><TrashIcon size={16} strokeWidth={2} /></button>}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {(activeTab === 'accounts' ? ['Công ty', 'Phân loại', 'Khu vực', 'Lĩnh vực'] : ['Họ tên', 'Công ty', 'Phòng ban', 'Liên hệ']).map((label) => (
                      <th key={label} style={S.thStatic}>{label}</th>
                    ))}
                    <th style={{ ...S.thStatic, cursor: 'default', textAlign: 'right' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {(activeTab === 'accounts' ? accData.items : conData.items).map((item: any) => (
                    <tr key={item.id} style={{ ...ui.table.row }} onMouseEnter={(e: any) => e.currentTarget.style.background = tokens.colors.background} onMouseLeave={(e: any) => e.currentTarget.style.background = ''}>
                      {activeTab === 'accounts' ? (
                        <>
                          <td style={{ ...S.td, fontWeight: 800, color: tokens.colors.textPrimary }}>
                            <div>{item.companyName}</div>
                            <div style={{ fontSize: '12px', color: tokens.colors.textMuted, marginTop: '4px' }}>{item.shortName || '-'}</div>
                          </td>
                          <td style={S.td}>
                            <span style={item.accountType === 'Supplier' ? ui.badge.warning : (item.accountType === 'Partner' ? ui.badge.info : ui.badge.success)}>
                               {item.accountType === 'Supplier' ? 'Nhà cung cấp' : (item.accountType === 'Partner' ? 'Đối tác' : 'Khách hàng')}
                            </span>
                          </td>
                          <td style={S.td}><span style={ui.badge.success}>{item.region || '-'}</span></td>
                          <td style={S.td}><IndustryTagChips raw={item.industry} activeTag={accountSearch.trim()} onTagClick={handleIndustryTagClick} /></td>
                        </>
                      ) : (
                        <>
                          <td style={{ ...S.td, color: tokens.colors.textSecondary }}>
                             {item.lastName} {item.firstName}
                          </td>
                          <td style={{ ...S.td, fontWeight: 800, color: tokens.colors.textPrimary }}>
                             {accounts.find((a: any) => a.id === item.accountId)?.shortName || accounts.find((a: any) => a.id === item.accountId)?.companyName || '-'}
                          </td>
                          <td style={S.td}><span style={{ ...ui.badge.neutral, border: `1px solid ${tokens.colors.border}` }}>{item.department || '-'}</span></td>
                          <td style={S.td}>{item.phone || item.email || '-'}</td>
                        </>
                      )}
                      <td style={{ ...S.td, textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '14px', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <button
                            style={{ color: tokens.colors.info, background: 'none', border: 'none', cursor: 'pointer', fontSize: '15px', transition: 'transform 0.2s' }}
                            title="Xem chi tiết"
                            onClick={() => activeTab === 'accounts' ? setViewingAcc(item) : setViewingCon(item)}
                          >
                            <EyeIcon size={16} strokeWidth={2} />
                          </button>
                          <button 
                            style={{ color: tokens.colors.textSecondary, background: 'none', border: 'none', cursor: 'pointer', fontSize: '15px', transition: 'transform 0.2s' }}
                            title="Lịch sử tương tác"
                            onClick={() => activeTab === 'accounts' ? setViewingHistoryAcc(item) : setViewingHistoryCon(item)}
                            onMouseEnter={(e:any) => e.currentTarget.style.transform='scale(1.2)'}
                            onMouseLeave={(e:any) => e.currentTarget.style.transform='scale(1)'}
                          >
                            <HistoryIcon size={16} strokeWidth={2} />
                          </button>
                          {userCanEdit && <button
                            style={{ color: tokens.colors.textSecondary, background: 'none', border: 'none', cursor: 'pointer', fontSize: '15px', transition: 'transform 0.2s' }}
                            title="Ghi nhận hoạt động"
                            onClick={() => activeTab === 'accounts' ? setLoggingAcc(item) : setLoggingCon(item)}
                            onMouseEnter={(e:any) => e.currentTarget.style.transform='scale(1.2)'}
                            onMouseLeave={(e:any) => e.currentTarget.style.transform='scale(1)'}
                          >
                            <NoteIcon size={16} strokeWidth={2} />
                          </button>}
                          {userCanEdit && <button
                            style={{ color: tokens.colors.primary, background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700, transition: 'transform 0.2s' }}
                            title="Chỉnh sửa"
                            onClick={() => activeTab === 'accounts' ? setEditingAcc(item) : setEditingCon(item)}
                            onMouseEnter={(e:any) => e.currentTarget.style.transform='scale(1.2)'}
                            onMouseLeave={(e:any) => e.currentTarget.style.transform='scale(1)'}
                          >
                            <EditIcon size={16} strokeWidth={2} />
                          </button>}
                          {userCanDelete && <button
                            style={{ color: tokens.colors.error, background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700, transition: 'transform 0.2s' }}
                            title="Xóa"
                            onClick={() => activeTab === 'accounts' ? deleteAccount(item.id) : deleteContact(item.id)}
                            onMouseEnter={(e:any) => e.currentTarget.style.transform='scale(1.2)'}
                            onMouseLeave={(e:any) => e.currentTarget.style.transform='scale(1)'}
                          >
                            <TrashIcon size={16} strokeWidth={2} />
                          </button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
}

