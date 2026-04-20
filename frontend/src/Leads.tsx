import { API_BASE } from './config';
import { useState, useEffect, useMemo, useRef } from 'preact/hooks';
import { showNotify } from './Notification';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { OverlayModal } from './ui/OverlayModal';
import { tokens } from './ui/tokens';
import { ui } from './ui/styles';
import { canEdit, canDelete, fetchWithAuth } from './auth';
import { consumeNavContext } from './navContext';
import { useI18n } from './i18n';
import { normalizeImportReport, buildImportSummary } from './shared/imports/importReport';
import { buildTabularFileUrl } from './shared/imports/tabularFiles';
import { FormatActionButton } from './ui/FormatActionButton';
import { MetricCard, PageHero } from './ui/patterns';
import {
  EditIcon,
  ExportIcon,
  EyeIcon,
  ImportIcon,
  NoteIcon,
  PlusIcon,
  SearchIcon,
  SheetIcon,
  TrashIcon,
} from './ui/icons';

const API = API_BASE;

const S = {
  card: ui.card.base as any,
  btnPrimary: { ...ui.btn.primary, transition: 'all 0.2s ease' } as any,
  btnSecondary: { ...ui.btn.outline, transition: 'all 0.2s ease' } as any,
  input: { ...ui.input.base, transition: 'all 0.2s ease' } as any,
  label: { ...ui.form.label, display: 'block', marginBottom: tokens.spacing.sm } as any,
  kpiCard: ui.card.kpi as any,
};

function AddLeadModal({ onClose, onSaved, token }: any) {
  const [form, setForm] = useState({ companyName: '', contactName: '', email: '', phone: '', status: 'New', source: '', expectedValue: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!form.companyName || !form.contactName) return showNotify('Thiếu thông tin bắt buộc (Công ty & Liên hệ)', 'error');
    setSaving(true);
    await fetchWithAuth(token, `${API}/leads`, { method: 'POST', body: JSON.stringify(form) });
    onSaved(); onClose();
  };
  return (
    <OverlayModal title="Thêm Lead mới" onClose={onClose} maxWidth="560px">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div style={{ gridColumn: '1/-1' }}><label style={S.label}>Tên Công ty / Lead *</label><input style={S.input} value={form.companyName} onInput={(e:any)=>setForm({...form, companyName: e.target.value})} placeholder="Tên doanh nghiệp..." /></div>
        <div style={{ gridColumn: 'span 1' }}><label style={S.label}>Người liên hệ *</label><input style={S.input} value={form.contactName} onInput={(e:any)=>setForm({...form, contactName: e.target.value})} placeholder="Họ và tên..." /></div>
        <div style={{ gridColumn: 'span 1' }}><label style={S.label}>Trạng thái</label>
          <select style={S.input} value={form.status} onChange={(e:any)=>setForm({...form, status: e.target.value})}>
            <option value="New">Mới (New)</option>
            <option value="Qualified">Xác thực (Qualified)</option>
            <option value="Proposal">Báo giá (Proposal)</option>
            <option value="Negotiation">Thương thảo (Negotiation)</option>
          </select>
        </div>
        <div style={{ gridColumn: 'span 1' }}><label style={S.label}>Email</label><input style={S.input} value={form.email} onInput={(e:any)=>setForm({...form, email: e.target.value})} placeholder="example@gmail.com" /></div>
        <div style={{ gridColumn: 'span 1' }}><label style={S.label}>Điện thoại</label><input style={S.input} value={form.phone} onInput={(e:any)=>setForm({...form, phone: e.target.value})} placeholder="090..." /></div>
        <div style={{ gridColumn: 'span 1' }}><label style={S.label}>Nguồn Lead</label><input style={S.input} value={form.source} onInput={(e:any)=>setForm({...form, source: e.target.value})} placeholder="Website, Sự kiện..." /></div>
        <div style={{ gridColumn: 'span 1' }}><label style={S.label}>Giá trị dự kiến ($)</label><input type="number" style={S.input} value={form.expectedValue} onInput={(e:any)=>setForm({...form, expectedValue: e.target.value})} placeholder="0" /></div>
        <div style={{ gridColumn: '1/-1' }}><label style={S.label}>Ghi chú</label><textarea style={{...S.input, height: '80px', resize: 'vertical'}} value={form.notes} onInput={(e:any)=>setForm({...form, notes: e.target.value})} placeholder="Thông tin bổ sung..." /></div>
      </div>
      <div style={{ display: 'flex', gap: '10px', marginTop: '24px', justifyContent: 'flex-end', borderTop: `1px solid ${tokens.colors.border}`, paddingTop: '20px' }}>
        <button onClick={onClose} style={S.btnSecondary}>Hủy</button>
        <button onClick={submit} style={S.btnPrimary}>{saving ? 'Đang lưu...' : 'Lưu Lead'}</button>
      </div>
    </OverlayModal>
  );
}

function EditLeadModal({ lead, onClose, onSaved, token }: any) {
  const [form, setForm] = useState({ ...lead });
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    await fetchWithAuth(token, `${API}/leads/${lead.id}`, { method: 'PUT', body: JSON.stringify(form) });
    onSaved(); onClose();
  };
  return (
    <OverlayModal title="Cập nhật Lead" onClose={onClose} maxWidth="560px">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div style={{ gridColumn: '1/-1' }}><label style={S.label}>Tên Công ty / Lead</label><input style={S.input} value={form.companyName} onInput={(e:any)=>setForm({...form, companyName: e.target.value})} /></div>
        <div style={{ gridColumn: 'span 1' }}><label style={S.label}>Người liên hệ</label><input style={S.input} value={form.contactName} onInput={(e:any)=>setForm({...form, contactName: e.target.value})} /></div>
        <div style={{ gridColumn: 'span 1' }}><label style={S.label}>Trạng thái</label>
          <select style={S.input} value={form.status} onChange={(e:any)=>setForm({...form, status: e.target.value})}>
            <option value="New">Mới (New)</option>
            <option value="Qualified">Xác thực (Qualified)</option>
            <option value="Proposal">Báo giá (Proposal)</option>
            <option value="Negotiation">Thương thảo (Negotiation)</option>
          </select>
        </div>
        <div style={{ gridColumn: 'span 1' }}><label style={S.label}>Email</label><input style={S.input} value={form.email} onInput={(e:any)=>setForm({...form, email: e.target.value})} /></div>
        <div style={{ gridColumn: 'span 1' }}><label style={S.label}>Điện thoại</label><input style={S.input} value={form.phone} onInput={(e:any)=>setForm({...form, phone: e.target.value})} /></div>
        <div style={{ gridColumn: 'span 1' }}><label style={S.label}>Nguồn Lead</label><input style={S.input} value={form.source} onInput={(e:any)=>setForm({...form, source: e.target.value})} /></div>
        <div style={{ gridColumn: 'span 1' }}><label style={S.label}>Giá trị dự kiến ($)</label><input type="number" style={S.input} value={form.expectedValue} onInput={(e:any)=>setForm({...form, expectedValue: e.target.value})} /></div>
        <div style={{ gridColumn: '1/-1' }}><label style={S.label}>Ghi chú</label><textarea style={{...S.input, height: '80px', resize: 'vertical'}} value={form.notes} onInput={(e:any)=>setForm({...form, notes: e.target.value})} /></div>
      </div>
      <div style={{ display: 'flex', gap: '10px', marginTop: '24px', justifyContent: 'flex-end', borderTop: `1px solid ${tokens.colors.border}`, paddingTop: '20px' }}>
        <button onClick={onClose} style={S.btnSecondary}>Hủy</button>
        <button onClick={submit} style={S.btnPrimary}>{saving ? 'Lưu...' : 'Lưu thay đổi'}</button>
      </div>
    </OverlayModal>
  );
}

function LogEventModal({ entityId, entityType, entityName, onClose, onSaved, token }: any) {
  const [form, setForm] = useState({ title: '', description: '', category: 'CRM EVENT' });
  const [saving, setSaving] = useState(false);
  
  const submit = async () => {
    if (!form.title.trim()) return showNotify('Thiếu tiêu đề sự kiện', 'error');
    setSaving(true);
    let icon = 'chat'; let color: any = tokens.colors.badgeBgSuccess; let iconColor: any = tokens.colors.success;
    if (form.category === 'TELEPHONY') { icon = 'phone'; color = tokens.colors.badgeBgInfo; iconColor = tokens.colors.info; }
    else if (form.category === 'MEETING') { icon = 'users'; color = tokens.colors.badgeBgSuccess; iconColor = tokens.colors.success; }
    else if (form.category === 'EMAIL') { icon = 'mail'; color = tokens.colors.badgeBgInfo; iconColor = tokens.colors.warning; }
    await fetchWithAuth(token, `${API}/activities`, { method: 'POST', body: JSON.stringify({ ...form, icon, color, iconColor, entityId, entityType, link: 'Leads' }) });
    showNotify('Đã ghi nhận sự kiện!', 'success');
    onSaved(); onClose();
  };
  
  return (
    <OverlayModal title={`Ghi nhận tương tác: ${entityName}`} onClose={onClose} maxWidth="560px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div><label style={S.label}>Loại sự kiện *</label>
          <select value={form.category} onChange={(e:any) => setForm({...form, category: e.target.value})} style={S.input}>
            <option value="TELEPHONY">Gọi điện (Call)</option>
            <option value="MEETING">Họp / Gặp mặt (Meeting)</option>
            <option value="EMAIL">Gửi Email</option>
            <option value="CRM EVENT">Khác (Other Interaction)</option>
          </select>
        </div>
        <div><label style={S.label}>Tiêu đề / Tóm tắt *</label><input type="text" placeholder="VD: Cuộc gọi tư vấn lần 1" style={S.input} value={form.title} onInput={(e:any)=>setForm({...form, title: e.target.value})} /></div>
        <div><label style={S.label}>Chi tiết (Tùy chọn)</label><textarea placeholder="Nội dung chi tiết..." style={{...S.input, minHeight: '80px', resize: 'vertical'}} value={form.description} onInput={(e:any)=>setForm({...form, description: e.target.value})} /></div>
      </div>
      <div style={{ display: 'flex', gap: '10px', marginTop: '24px', justifyContent: 'flex-end', borderTop: `1px solid ${tokens.colors.border}`, paddingTop: '20px' }}>
        <button onClick={onClose} style={S.btnSecondary}>Bỏ qua</button>
        <button onClick={submit} style={S.btnPrimary}>{saving ? 'Đang lưu...' : 'Lưu Sự kiện'}</button>
      </div>
    </OverlayModal>
  );
}

function LeadDetailsModal({ lead, onClose, onEdit, onLog, canEditLead, canDeleteLead, onDelete }: any) {
  if (!lead) return null;
  return (
    <OverlayModal title="Chi tiết Lead" onClose={onClose} maxWidth="620px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ padding: '16px', borderRadius: tokens.radius.lg, background: tokens.colors.background, border: `1px solid ${tokens.colors.border}` }}>
          <div style={{ fontSize: '18px', fontWeight: 900, color: tokens.colors.textPrimary }}>{lead.companyName || '—'}</div>
          <div style={{ marginTop: '4px', color: tokens.colors.textSecondary, fontWeight: 700 }}>{lead.contactName || '—'}</div>
          <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <span style={ui.badge.info}>{lead.status || 'New'}</span>
            <span style={ui.badge.neutral}>{lead.source || 'Nguồn chưa xác định'}</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
          <div>
            <label style={S.label}>Email</label>
            <div style={{ fontWeight: 700, color: tokens.colors.textPrimary }}>{lead.email || '—'}</div>
          </div>
          <div>
            <label style={S.label}>Điện thoại</label>
            <div style={{ fontWeight: 700, color: tokens.colors.textPrimary }}>{lead.phone || '—'}</div>
          </div>
          <div>
            <label style={S.label}>Giá trị dự kiến</label>
            <div style={{ fontWeight: 700, color: tokens.colors.textPrimary }}>{lead.expectedValue ? `$${Number(lead.expectedValue).toLocaleString()}` : '—'}</div>
          </div>
          <div>
            <label style={S.label}>Ngày tạo</label>
            <div style={{ fontWeight: 700, color: tokens.colors.textPrimary }}>{lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : '—'}</div>
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={S.label}>Ghi chú</label>
            <div style={{ padding: '12px 14px', borderRadius: tokens.radius.lg, border: `1px solid ${tokens.colors.border}`, background: tokens.colors.surface, color: tokens.colors.textSecondary, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
              {lead.notes || '—'}
            </div>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '24px', justifyContent: 'flex-end', borderTop: `1px solid ${tokens.colors.border}`, paddingTop: '16px' }}>
        <button onClick={onClose} style={S.btnSecondary}>Đóng</button>
        {canEditLead && <button onClick={onLog} style={S.btnSecondary}>Ghi chú</button>}
        {canEditLead && <button onClick={onEdit} style={S.btnPrimary}>Chỉnh sửa</button>}
        {canDeleteLead && <button onClick={onDelete} style={ui.btn.danger as any}>Xóa</button>}
      </div>
    </OverlayModal>
  );
}

export function Leads({ isMobile, currentUser }: { isMobile?: boolean; currentUser?: any } = {}) {
  const { t } = useI18n();
  const token = currentUser?.token ?? '';
  const userCanEdit = currentUser ? canEdit(currentUser.roleCodes, currentUser.systemRole) : false;
  const userCanDelete = currentUser ? canDelete(currentUser.roleCodes, currentUser.systemRole) : false;
  const leadStages = useMemo(() => ([
    { key: 'New', label: 'Mới (New)', color: tokens.colors.info },
    { key: 'Qualified', label: 'Xác thực (Qualified)', color: tokens.colors.primary },
    { key: 'Proposal', label: 'Báo giá (Proposal)', color: tokens.colors.warning },
    { key: 'Negotiation', label: 'Thương thảo (Negotiation)', color: tokens.colors.warningDark },
  ]), []);
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editingLead, setEditingLead] = useState<any>(null);
  const [loggingLead, setLoggingLead] = useState<any>(null);
  const [viewingLead, setViewingLead] = useState<any>(null);
  const [confirmState, setConfirmState] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [mobileStage, setMobileStage] = useState<'All' | string>('All');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    setLoading(true);
    try { const res = await fetch(`${API}/leads`); setLeads(await res.json()); } catch {}
    setLoading(false);
  };
  useEffect(() => { loadData(); }, []);

  const [pendingOpenLeadId, setPendingOpenLeadId] = useState<string | null>(null);

  useEffect(() => {
    const ctx = consumeNavContext();
    if (!ctx) return;

    if (ctx.entityType === 'Lead' && ctx.entityId) {
      const leadId = ctx.entityId;
      void (async () => {
        try {
          const res = await fetch(`${API}/leads/${leadId}`);
          if (res.ok) {
            const lead = await res.json();
            setViewingLead(lead);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
          }
        } catch {
          // ignore
        }
        // Fallback: open from the loaded list.
        setPendingOpenLeadId(leadId);
      })();
    }
  }, []);

  useEffect(() => {
    if (!pendingOpenLeadId) return;
    const lead = leads.find((l: any) => l.id === pendingOpenLeadId);
    if (!lead) return;
    setViewingLead(lead);
    setPendingOpenLeadId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [leads, pendingOpenLeadId]);

  const stats = useMemo(() => {
    const total = leads.length;
    const newLeads = leads.filter(l => l.status === 'New').length;
    const qualified = leads.filter(l => l.status === 'Qualified').length;
    const pipeline = leads.reduce((acc, l) => acc + (Number(l.expectedValue) || 0), 0);
    return { total, newLeads, qualified, pipeline };
  }, [leads]);

  const filteredLeads = useMemo(() => {
    return leads.filter(l => 
      String(l.companyName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(l.contactName || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [leads, searchTerm]);

  const visibleLeads = useMemo(() => {
    return mobileStage === 'All'
      ? filteredLeads
      : filteredLeads.filter((lead: any) => lead.status === mobileStage);
  }, [filteredLeads, mobileStage]);

  useEffect(() => {
    if (isMobile && mobileStage !== 'All') {
      const stillVisible = filteredLeads.some((lead: any) => lead.status === mobileStage);
      if (!stillVisible) setMobileStage('All');
    }
  }, [filteredLeads, isMobile, mobileStage]);

  const deleteLead = async (id: string) => {
    setConfirmState({
      message: 'Xác nhận xóa Lead này?',
      onConfirm: async () => {
        setConfirmState(null);
        setLeads(prev => prev.filter((l: any) => l.id !== id));
        await fetchWithAuth(token, `${API}/leads/${id}`, { method: 'DELETE' });
      },
    });
  };

  const handleDrop = async (e: any, newStatus: string) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData('leadId');
    if (!leadId) return;
    const lead = leads.find((l: any) => l.id === leadId);
    if (lead && lead.status !== newStatus) {
      setLeads(prev => prev.map((l: any) => l.id === leadId ? { ...l, status: newStatus } : l));
      await fetchWithAuth(token, `${API}/leads/${leadId}`, { method: 'PUT', body: JSON.stringify({ ...lead, status: newStatus }) });
    }
  };

  const importCSV = async (e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setLoading(true);
    try {
      const res = await fetchWithAuth(token, `${API}/leads/import`, { method: 'POST', body: formData });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || 'Không thể import dữ liệu');
      const report = normalizeImportReport(result);
      showNotify(buildImportSummary(report), report.errors > 0 ? 'info' : 'success');
      loadData();
    } catch (error: any) {
      showNotify(error?.message || 'Lỗi khi nhập dữ liệu', 'error');
    } finally {
      setLoading(false);
      if (e?.target) e.target.value = '';
    }
  };

  const exportData = (format: 'csv' | 'xlsx') => window.open(buildTabularFileUrl(`${API}/leads/export`, format), '_blank');
  const downloadTemplate = (format: 'csv' | 'xlsx') => window.open(buildTabularFileUrl(`${API}/template/leads`, format), '_blank');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {confirmState && <ConfirmDialog message={confirmState.message} onConfirm={confirmState.onConfirm} onCancel={() => setConfirmState(null)} />}
      {showAdd && <AddLeadModal onClose={()=>setShowAdd(false)} onSaved={loadData} token={token} />}
      {editingLead && <EditLeadModal lead={editingLead} onClose={()=>setEditingLead(null)} onSaved={loadData} token={token} />}
      {loggingLead && <LogEventModal entityId={loggingLead.id} entityType="Lead" entityName={loggingLead.companyName || loggingLead.contactName} onClose={() => setLoggingLead(null)} onSaved={() => {}} token={token} />}
      {viewingLead && (
        <LeadDetailsModal
          lead={viewingLead}
          canEditLead={userCanEdit}
          canDeleteLead={userCanDelete}
          onClose={() => setViewingLead(null)}
          onEdit={() => {
            setEditingLead(viewingLead);
            setViewingLead(null);
          }}
          onLog={() => {
            setLoggingLead(viewingLead);
            setViewingLead(null);
          }}
          onDelete={() => {
            deleteLead(viewingLead.id);
            setViewingLead(null);
          }}
        />
      )}
      
      <input type="file" ref={fileInputRef} onChange={importCSV} style={{ display: 'none' }} accept=".csv,.xlsx" />

      <PageHero
        eyebrow="Sales & CRM"
        title={t('sales.leads.title')}
        description={t('sales.leads.subtitle')}
        actions={[
          { key: 'template', label: t('common.import_template'), onClick: () => downloadTemplate('csv'), variant: 'outline' as const },
          ...(userCanEdit ? [{ key: 'import', label: t('common.import_file'), onClick: () => fileInputRef.current?.click(), variant: 'ghost' as const }] : []),
          { key: 'export', label: t('common.export_data'), onClick: () => exportData('csv'), variant: 'outline' as const },
          ...(userCanEdit ? [{ key: 'create', label: t('sales.leads.action.add'), onClick: () => setShowAdd(true), variant: 'primary' as const }] : []),
        ]}
      />

      <div style={ui.page.metricGrid}>
        <MetricCard label={t('sales.leads.kpi.total')} value={stats.total} hint="Tổng bản ghi đang được theo dõi trong phễu lead." />
        <MetricCard label={t('sales.leads.kpi.new')} value={stats.newLeads} accent={tokens.colors.info} hint="Lead mới cần được sàng lọc và phản hồi sớm." />
        <MetricCard label={t('sales.leads.kpi.qualified')} value={stats.qualified} accent={tokens.colors.primary} hint="Lead đã đủ điều kiện để đẩy tiếp sang quotation hoặc follow-up sâu hơn." />
        <MetricCard label={t('sales.leads.kpi.pipeline')} value={`$${stats.pipeline.toLocaleString()}`} accent={tokens.colors.warning} hint="Giá trị pipeline dự kiến theo dữ liệu lead hiện có." />
      </div>

      <div style={{ ...ui.page.surfaceSection, gap: '12px' }}>
        <div style={{ display: 'flex', gap: isMobile ? '12px' : '10px', alignItems: isMobile ? 'stretch' : 'center', minWidth: 0, flexDirection: isMobile ? 'column' : 'row' }}>
          <div style={{ position: 'relative', minWidth: 0, flex: 1 }}>
            <SearchIcon size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
            <input type="text" placeholder={t('common.search')} value={searchTerm} onInput={(e:any) => setSearchTerm(e.target.value)}
              style={{ ...ui.input.base, padding: '9px 12px 9px 36px', fontSize: '13.5px', width: '100%', minWidth: 0 }} />
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', overflowX: isMobile ? 'auto' : 'visible', paddingBottom: isMobile ? '4px' : '0' }}>
            <FormatActionButton label={t('common.import_template')} icon={SheetIcon} buttonStyle={S.btnSecondary} onSelect={downloadTemplate} />
            {userCanEdit && <button style={S.btnSecondary} onClick={() => fileInputRef.current?.click()}><ImportIcon size={14} /> {t('common.import_file')}</button>}
            <FormatActionButton label={t('common.export_data')} icon={ExportIcon} buttonStyle={S.btnSecondary} onSelect={exportData} />
            {userCanEdit && <button style={S.btnPrimary} onClick={()=>setShowAdd(true)}><PlusIcon size={14} /> {t('sales.leads.action.add')}</button>}
          </div>
        </div>
      </div>

      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', WebkitOverflowScrolling: 'touch' }}>
            {[{ key: 'All', label: 'Tất cả' }, ...leadStages].map(stage => {
              const count = stage.key === 'All'
                ? filteredLeads.length
                : filteredLeads.filter((lead: any) => lead.status === stage.key).length;
              const active = mobileStage === stage.key;
              return (
                <button
                  key={stage.key}
                  onClick={() => setMobileStage(stage.key)}
                  style={{
                    flex: '0 0 auto',
                    borderRadius: '999px',
                    padding: '10px 14px',
                    border: `1px solid ${active ? tokens.colors.primary : tokens.colors.border}`,
                    background: active ? tokens.colors.primary : tokens.colors.surface,
                    color: active ? '#fff' : tokens.colors.textSecondary,
                    fontSize: '13px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {stage.label} ({count})
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {loading ? <div style={{ textAlign: 'center', padding: '20px', color: tokens.colors.textMuted }}>...</div> : (
              visibleLeads.length === 0 ? (
                <div style={{ border: `2px dashed ${tokens.colors.border}`, borderRadius: '12px', padding: '28px 20px', textAlign: 'center', fontSize: '13px', color: tokens.colors.textMuted, background: tokens.colors.background }}>
                  Không có lead phù hợp
                </div>
              ) : (
                visibleLeads.map((l: any) => {
                  const stage = leadStages.find(s => s.key === l.status);
                  return (
                    <div
                      key={l.id}
                      draggable
                      onDragStart={(e: any) => e.dataTransfer.setData('leadId', l.id)}
                      onDragOver={(e: any) => e.preventDefault()}
                      onDrop={(e: any) => handleDrop(e, l.status)}
                      style={{ background: tokens.colors.surface, borderRadius: '12px', padding: '16px', border: `1px solid ${tokens.colors.border}`, boxShadow: tokens.shadow.sm, cursor: 'grab', transition: 'all 0.2s' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: '14.5px', color: tokens.colors.textPrimary, marginBottom: '4px' }}>{l.companyName}</div>
                          <div style={{ fontSize: '13px', color: tokens.colors.textSecondary }}>{l.contactName}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
                          <button onClick={()=>setViewingLead(l)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px' }} title="Xem chi tiết"><EyeIcon size={14} /></button>
                          {userCanEdit && <button onClick={()=>setLoggingLead(l)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px' }} title="Ghi chú"><NoteIcon size={14} /></button>}
                          {userCanEdit && <button onClick={()=>setEditingLead(l)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px' }} title="Sửa"><EditIcon size={14} /></button>}
                          {userCanDelete && <button onClick={()=>deleteLead(l.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px' }} title="Xóa"><TrashIcon size={14} /></button>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
                        <span style={{ padding: '2px 8px', background: stage ? `${stage.color}18` : tokens.colors.background, borderRadius: '999px', fontSize: '11px', color: stage?.color || tokens.colors.textMuted, fontWeight: 800 }}>
                          {stage?.label || l.status}
                        </span>
                      </div>
                      {l.expectedValue && <div style={{ fontSize: '14px', fontWeight: 800, color: tokens.colors.primary, marginTop: '10px' }}>${Number(l.expectedValue).toLocaleString()}</div>}
                      <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: `1px solid ${tokens.colors.background}` }} />
                    </div>
                  );
                })
              )
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '20px', minHeight: '600px', flex: 1 }}>
          {leadStages.map(col => {
            const items = filteredLeads.filter((l: any) => l.status === col.key);
            return (
              <div key={col.key} onDragOver={(e: any) => e.preventDefault()} onDrop={(e: any) => handleDrop(e, col.key)}
                style={{ flex: '0 0 300px', background: tokens.colors.background, borderRadius: '16px', border: `1px solid ${tokens.colors.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '16px', background: tokens.colors.surface, borderBottom: `1px solid ${tokens.colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: col.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{col.label}</span>
                  <span style={{ background: tokens.colors.background, color: tokens.colors.textMuted, borderRadius: '6px', padding: '2px 8px', fontSize: '11px', fontWeight: 800, border: `1px solid ${tokens.colors.border}` }}>{items.length}</span>
                </div>
                <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflowY: 'auto' }}>
                  {loading ? <div style={{ textAlign: 'center', padding: '20px', color: tokens.colors.textMuted }}>...</div> : (
                    items.length === 0 ? <div style={{ border: `2px dashed ${tokens.colors.border}`, borderRadius: '12px', padding: '40px 20px', textAlign: 'center', fontSize: '13px', color: tokens.colors.textMuted }}>Kéo thả Lead vào đây</div> : (
                      items.map(l => (
                        <div key={l.id} draggable onDragStart={(e: any) => e.dataTransfer.setData('leadId', l.id)}
                          style={{ background: tokens.colors.surface, borderRadius: '12px', padding: '16px', border: `1px solid ${tokens.colors.border}`, boxShadow: tokens.shadow.sm, cursor: 'grab', transition: 'all 0.2s' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ fontWeight: 800, fontSize: '14.5px', color: tokens.colors.textPrimary, marginBottom: '4px' }}>{l.companyName}</div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                              <button onClick={()=>setViewingLead(l)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px' }} title="Xem chi tiết"><EyeIcon size={14} /></button>
                              {userCanEdit && <button onClick={()=>setLoggingLead(l)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px' }} title="Ghi chú"><NoteIcon size={14} /></button>}
                              {userCanEdit && <button onClick={()=>setEditingLead(l)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px' }} title="Sửa"><EditIcon size={14} /></button>}
                              {userCanDelete && <button onClick={()=>deleteLead(l.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px' }} title="Xóa"><TrashIcon size={14} /></button>}
                            </div>
                          </div>
                          <div style={{ fontSize: '13px', color: tokens.colors.textSecondary }}>{l.contactName}</div>
                          {l.expectedValue && <div style={{ fontSize: '14px', fontWeight: 800, color: tokens.colors.primary, marginTop: '8px' }}>${Number(l.expectedValue).toLocaleString()}</div>}
                          <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: `1px solid ${tokens.colors.background}` }} />
                        </div>
                      ))
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
