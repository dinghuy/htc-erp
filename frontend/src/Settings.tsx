import { API_BASE } from './config';
import { useState, useEffect } from 'preact/hooks';
import { showNotify } from './Notification';
import { tokens } from './ui/tokens';
import { ui } from './ui/styles';
import { fetchWithAuth, ROLE_LABELS, type SystemRole } from './auth';
import { buildRolePreviewChecklist } from './preview/rolePreviewChecklist';
import { loadRolePreviewSessionProgress, resetRolePreviewSessionProgress, toggleRolePreviewSessionChecklistItem } from './preview/rolePreviewSession';
import { getRolePreviewPresetNavigation, getRolePreviewWorkspaceNavigation, isRolePreviewPresetActive, normalizePreviewRoleCodes, ROLE_PREVIEW_PRESETS, type RolePreviewNavigation } from './authRolePreview';
import { QA_TEST_IDS, settingsPreviewPresetTestId } from './testing/testIds';
import { useI18n, type Locale, translate } from './i18n';
import {
  CheckIcon,
  LoaderIcon,
  MoonIcon,
  RefreshIcon,
  SettingsIcon,
  ShieldIcon,
  SunIcon,
  UserIcon,
} from './ui/icons';
import { SegmentedControl } from './ui/SegmentedControl';

const API = API_BASE;
const PREVIEWABLE_ROLE_CODES: SystemRole[] = ['sales', 'project_manager', 'procurement', 'accounting', 'legal', 'director', 'viewer'];

export function Settings({ isDarkMode, toggleDarkMode, isMobile, currentUser, onUserUpdated, onRolePreviewChange }: { isDarkMode: boolean, toggleDarkMode: () => void, isMobile?: boolean, currentUser?: any, onUserUpdated?: (partial: any) => void, onRolePreviewChange?: (previewRoleCodes?: SystemRole[], navigation?: RolePreviewNavigation) => void }) {
  const token = currentUser?.token || '';
  const isBaseAdmin = Array.isArray(currentUser?.baseRoleCodes) ? currentUser.baseRoleCodes.includes('admin') : currentUser?.systemRole === 'admin' || currentUser?.roleCodes?.includes?.('admin');
  const { locale, setLocale, t } = useI18n();
  const [activeTab, setActiveTab] = useState('Quotation');
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [languageSaving, setLanguageSaving] = useState(false);
  const [settings, setSettings] = useState<any>({
    quote_vat: '10',
    quote_exchange_rate: '25450',
    quote_interest_rate: '0.8',
    quote_terms: '',
    vcb_rate_url: '',
    qbu_variance_threshold_pct: '10',
    qbu_variance_threshold_vnd: '20000000',
    company_name: '',
    company_address: '',
    company_phone: '',
    company_email: '',
    company_website: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshingFx, setRefreshingFx] = useState(false);
  const [previewRoles, setPreviewRoles] = useState<SystemRole[]>(() => normalizePreviewRoleCodes(currentUser?.previewRoleCodes));
  const [previewChecklistDone, setPreviewChecklistDone] = useState<number[]>([]);
  const activePreviewRoles = previewRoles.length
    ? previewRoles
    : normalizePreviewRoleCodes(currentUser?.previewRoleCodes);
  const checklistRoleCodes: SystemRole[] = activePreviewRoles.length ? activePreviewRoles : ['admin'];
  const activePreviewRoleKey = activePreviewRoles.length ? activePreviewRoles.join('|') : 'admin-base';
  const previewChecklist = buildRolePreviewChecklist(checklistRoleCodes);
  const previewChecklistDoneCount = previewChecklistDone.filter((index) => index >= 0 && index < previewChecklist.items.length).length;

  useEffect(() => {
    fetch(`${API}/settings`)
      .then(res => res.json())
      .then(data => {
        setSettings((prev: any) => ({ ...prev, ...data }));
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    setPreviewRoles(normalizePreviewRoleCodes(currentUser?.previewRoleCodes));
  }, [currentUser?.previewRoleCodes]);

  useEffect(() => {
    const session = loadRolePreviewSessionProgress(checklistRoleCodes);
    setPreviewChecklistDone(session.completedItemIndexes.filter((index) => index < previewChecklist.items.length));
  }, [activePreviewRoleKey, previewChecklist.items.length]);

  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetchWithAuth(token, `${API}/settings`, {
        method: 'POST',
        body: JSON.stringify(settings)
      });
      if (res.ok) showNotify(t('settings.saved_success'), 'success');
      else showNotify(t('settings.saved_error'), 'error');
    } catch {
      showNotify(t('settings.server_error'), 'error');
    }
    setSaving(false);
  };

  const refreshVcbFx = async () => {
    setRefreshingFx(true);
    try {
      const url = String(settings.vcb_rate_url || '').trim();
      if (!url) {
        showNotify(t('settings.quotation.vcb_url.required'), 'error');
        return;
      }

      // Persist only the VCB URL so the refresh endpoint can read it from SystemSetting immediately.
      const saveUrlRes = await fetchWithAuth(token, `${API}/settings`, {
        method: 'POST',
        body: JSON.stringify({ vcb_rate_url: url })
      });
      if (!saveUrlRes.ok) {
        showNotify(t('settings.quotation.vcb_url.save_failed'), 'error');
        return;
      }

      const res = await fetch(`${API}/exchange-rates/refresh`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showNotify(t('settings.quotation.refresh_failed', { error: data?.error || 'Unknown error' }), 'error');
        return;
      }
      if (Array.isArray(data?.warnings) && data.warnings.includes('RATE_TYPE_MISSING')) {
        showNotify(t('settings.quotation.refresh_invalid'), 'error');
        return;
      }
      if (typeof data?.rate === 'number' && data?.effectiveDate) {
        showNotify(t('settings.quotation.refresh_success', { rate: data.rate, date: data.effectiveDate }), 'success');
        return;
      }
      showNotify(t('settings.quotation.refresh_empty'), 'error');
    } catch (e: any) {
      showNotify(`${t('settings.server_error')}: ${e?.message || e}`, 'error');
    } finally {
      setRefreshingFx(false);
    }
  };

  const changePassword = async () => {
    if (!pwForm.currentPassword || !pwForm.newPassword) return showNotify(t('settings.security.error.required'), 'error');
    if (pwForm.newPassword !== pwForm.confirmPassword) return showNotify(t('settings.security.error.mismatch'), 'error');
    if (pwForm.newPassword.length < 6) return showNotify(t('settings.security.error.min_length'), 'error');
    setPwSaving(true);
    try {
      const res = await fetchWithAuth(token, `${API}/auth/change-password`, {
        method: 'POST',
        body: JSON.stringify({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword })
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data?.token || data?.user) {
          onUserUpdated?.({ ...(data?.user || {}), token: data?.token || token });
        }
        showNotify(t('settings.security.success'), 'success');
        setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        const err = await res.json().catch(() => ({}));
        showNotify(err.error || t('settings.security.error.failed'), 'error');
      }
    } catch {
      showNotify(t('settings.server_error'), 'error');
    }
    setPwSaving(false);
  };

  const changeLanguage = async (next: Locale) => {
    if (!token) return;
    if (next === locale) return;
    setLanguageSaving(true);
    try {
      const res = await fetchWithAuth(token, `${API}/me/preferences`, {
        method: 'PATCH',
        body: JSON.stringify({ language: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showNotify(data?.error || t('settings.error.update_language'), 'error');
        return;
      }
      setLocale(next);
      onUserUpdated?.({ language: next, ...(data?.user ? data.user : {}) });
      showNotify(translate(next, 'settings.language.updated') || 'Đã cập nhật ngôn ngữ', 'success');
    } catch (e: any) {
      showNotify(`${t('settings.server_error')}: ${e?.message || e}`, 'error');
    } finally {
      setLanguageSaving(false);
    }
  };

  const S = {
    container: {
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '40px',
      background: tokens.colors.surface,
      borderRadius: tokens.radius.xl,
      border: `1px solid ${tokens.colors.border}`,
      boxShadow: tokens.shadow.md,
    },
    formRow: {
      marginBottom: '24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    },
    label: {
      ...ui.form.label,
      fontSize: '13px',
      letterSpacing: '0.05em'
    },
    input: {
      ...ui.input.base,
      width: '100%'
    },
    formGrid: {
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
      gap: '40px'
    },
    stackedInputs: {
      display: 'flex',
      gap: '8px',
      flexDirection: isMobile ? 'column' : 'row'
    }
  };

  if (loading) return <div style={{ padding: '80px', textAlign: 'center', color: tokens.colors.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><LoaderIcon size={16} /> {t('settings.loading')}</div>;

  return (
    <div style={S.container}>
      <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px', color: tokens.colors.textPrimary, display: 'inline-flex', alignItems: 'center', gap: '8px' }}><SettingsIcon size={24} /> {t('settings.title')}</h1>
      <p style={{ color: tokens.colors.textSecondary, marginBottom: '40px' }}>{t('settings.desc')}</p>

      {isBaseAdmin ? (
        <div style={{ marginBottom: '24px', padding: '18px 20px', borderRadius: tokens.radius.lg, background: 'linear-gradient(135deg, rgba(0, 151, 110, 0.12) 0%, rgba(0, 77, 53, 0.04) 100%)', border: `1px solid ${tokens.colors.border}` }}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: tokens.colors.primary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>System-only admin</div>
          <div style={{ marginTop: '8px', fontSize: '14px', color: tokens.colors.textSecondary, lineHeight: 1.6 }}>
            Màn hình này dành cho cấu hình hệ thống, branding, security và tham số vận hành chung. Quyền admin không tự động là approver nghiệp vụ cho finance, legal hoặc executive nếu user chưa được gán thêm role business.
          </div>
        </div>
      ) : null}

      {isBaseAdmin ? (
        <div data-testid={QA_TEST_IDS.settings.previewPanel} style={{ marginBottom: '24px', padding: '20px', borderRadius: tokens.radius.lg, background: tokens.colors.background, border: `1px solid ${tokens.colors.border}`, display: 'grid', gap: '14px' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 800, color: tokens.colors.primary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Admin role preview</div>
            <div style={{ marginTop: '8px', fontSize: '14px', color: tokens.colors.textSecondary, lineHeight: 1.6 }}>
              Chuyển nhanh sang role khác để kiểm tra UI, queue, tab và quyền thao tác mà không phải đăng nhập lại. Preview chỉ đổi effective role, còn base admin identity vẫn giữ để bạn quay lại bất cứ lúc nào.
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
            {ROLE_PREVIEW_PRESETS.map((preset) => {
              const active = isRolePreviewPresetActive(previewRoles, preset.roleCodes);
              return (
                <button
                  key={preset.key}
                    type="button"
                    data-testid={settingsPreviewPresetTestId(preset.key)}
                    onClick={() => {
                      const nextRoles = normalizePreviewRoleCodes(preset.roleCodes);
                      const navigation = getRolePreviewPresetNavigation(preset.key);
                      setPreviewRoles(nextRoles);
                      onRolePreviewChange?.(nextRoles.length > 0 ? nextRoles : undefined, navigation);
                      showNotify(`Đang preview ${preset.label.replace('View as ', '')}`, 'success');
                    }}
                    style={{
                    ...ui.btn.outline,
                    justifyContent: 'center',
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
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, minmax(0, 1fr))', gap: '10px' }}>
            {PREVIEWABLE_ROLE_CODES.map((roleCode) => {
              const active = previewRoles.includes(roleCode);
              return (
                <button
                  key={roleCode}
                  type="button"
                  onClick={() => setPreviewRoles((prev) => active ? prev.filter((item) => item !== roleCode) : [...prev, roleCode])}
                  style={{
                    ...ui.btn.outline,
                    justifyContent: 'center',
                    background: active ? tokens.colors.badgeBgSuccess : tokens.colors.surface,
                    color: active ? tokens.colors.primary : tokens.colors.textSecondary,
                    borderColor: active ? tokens.colors.primary : tokens.colors.border,
                  }}
                >
                  {ROLE_LABELS[roleCode]}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              data-testid={QA_TEST_IDS.settings.previewApply}
              onClick={() => {
                const normalized = normalizePreviewRoleCodes(previewRoles);
                onRolePreviewChange?.(normalized.length > 0 ? normalized : undefined);
                showNotify(normalized.length > 0 ? 'Đã áp dụng role preview hiện tại' : 'Đang ở admin mode gốc', 'success');
              }}
              style={ui.btn.primary as any}
            >
              Áp dụng preview
            </button>
            <button
              type="button"
              data-testid={QA_TEST_IDS.settings.previewReset}
              onClick={() => {
                setPreviewRoles([]);
                onRolePreviewChange?.(undefined);
                showNotify('Đã quay lại admin gốc', 'success');
              }}
              style={ui.btn.outline as any}
            >
              Quay lại admin
            </button>
            <button
              type="button"
              data-testid={QA_TEST_IDS.settings.previewOpenWorkspace}
              onClick={() => {
                const activeRoles = normalizePreviewRoleCodes(previewRoles.length ? previewRoles : currentUser?.previewRoleCodes);
                const workspaceNavigation = getRolePreviewWorkspaceNavigation(activeRoles.length ? activeRoles : currentUser?.roleCodes, currentUser?.systemRole);
                onRolePreviewChange?.(activeRoles.length > 0 ? activeRoles : undefined, workspaceNavigation);
                showNotify('Đang mở workspace mẫu theo role hiện tại', 'success');
              }}
              style={ui.btn.outline as any}
            >
              Mở workspace mẫu
            </button>
          </div>
          <div data-testid={QA_TEST_IDS.settings.checklist} style={{ padding: '16px', borderRadius: tokens.radius.lg, background: tokens.colors.surface, border: `1px solid ${tokens.colors.border}`, display: 'grid', gap: '10px' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 800, color: tokens.colors.primary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>QA checklist</div>
              <div style={{ marginTop: '8px', fontSize: '15px', fontWeight: 800, color: tokens.colors.textPrimary }}>{previewChecklist.title}</div>
              <div style={{ marginTop: '4px', fontSize: '13px', color: tokens.colors.textSecondary, lineHeight: 1.6 }}>{previewChecklist.description}</div>
            </div>
            <div data-testid={QA_TEST_IDS.settings.qaSessionLog} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', padding: '12px 14px', borderRadius: tokens.radius.lg, background: tokens.colors.background, border: `1px solid ${tokens.colors.border}` }}>
              <div style={{ display: 'grid', gap: '4px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: tokens.colors.textPrimary }}>
                  Local QA session log: {previewChecklistDoneCount}/{previewChecklist.items.length} done
                </div>
                <div style={{ fontSize: '12px', color: tokens.colors.textMuted, lineHeight: 1.6 }}>
                  Trạng thái này chỉ lưu trên trình duyệt hiện tại để admin theo dõi quá trình kiểm tra. Không gửi lên server và không thay đổi quyền thật.
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  resetRolePreviewSessionProgress(checklistRoleCodes);
                  setPreviewChecklistDone([]);
                  showNotify('Đã reset QA session log cục bộ', 'success');
                }}
                style={ui.btn.outline as any}
              >
                Reset QA log
              </button>
            </div>
            <div style={{ display: 'grid', gap: '8px' }}>
              {previewChecklist.items.map((item, index) => (
                <div key={`${previewChecklist.title}-${index}`} style={{ display: 'grid', gridTemplateColumns: '28px 1fr', gap: '10px', alignItems: 'start' }}>
                  <button
                    type="button"
                    aria-pressed={previewChecklistDone.includes(index)}
                    onClick={() => {
                      const next = toggleRolePreviewSessionChecklistItem(checklistRoleCodes, index);
                      setPreviewChecklistDone(next.completedItemIndexes.filter((value) => value < previewChecklist.items.length));
                    }}
                    style={{
                      width: '28px',
                      minWidth: '28px',
                      height: '28px',
                      borderRadius: '999px',
                      border: `1px solid ${previewChecklistDone.includes(index) ? tokens.colors.primary : tokens.colors.border}`,
                      background: previewChecklistDone.includes(index) ? tokens.colors.badgeBgSuccess : tokens.colors.surface,
                      color: previewChecklistDone.includes(index) ? tokens.colors.primary : tokens.colors.textMuted,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 800,
                    }}
                  >
                    {previewChecklistDone.includes(index) ? <CheckIcon size={14} /> : index + 1}
                  </button>
                  <span style={{ fontSize: '13px', color: previewChecklistDone.includes(index) ? tokens.colors.textPrimary : tokens.colors.textSecondary, lineHeight: 1.6, textDecoration: previewChecklistDone.includes(index) ? 'line-through' : 'none' }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* Tabs */}
      <div style={{ marginBottom: '48px' }}>
        <SegmentedControl
          ariaLabel="Điều hướng cài đặt"
          wrap={Boolean(isMobile)}
          options={[
            { value: 'Quotation', label: t('settings.tab.quotation') },
            { value: 'Company', label: t('settings.tab.company') },
            { value: 'Display', label: t('settings.tab.display') },
            { value: 'Security', label: t('settings.tab.security'), icon: <ShieldIcon size={14} /> },
          ]}
          value={activeTab}
          onChange={setActiveTab}
        />
      </div>

      {activeTab === 'Quotation' && (
        <div style={S.formGrid}>
          <div>
             <div style={S.formRow}>
               <label style={S.label}>{t('settings.quotation.exchange_rate')}</label>
                <input type="number" style={S.input} value={settings.quote_exchange_rate} onInput={(e:any)=>setSettings({...settings, quote_exchange_rate: e.target.value})} />
            </div>
            <div style={S.formRow}>
               <label style={S.label}>{t('settings.quotation.interest_rate')}</label>
               <input type="number" step="0.1" style={S.input} value={settings.quote_interest_rate} onInput={(e:any)=>setSettings({...settings, quote_interest_rate: e.target.value})} />
            </div>
            <div style={S.formRow}>
               <label style={S.label}>QBU Variance Threshold %</label>
               <input type="number" step="0.1" style={S.input} value={settings.qbu_variance_threshold_pct || '10'} onInput={(e:any)=>setSettings({...settings, qbu_variance_threshold_pct: e.target.value})} />
            </div>
          </div>
          <div>
            <div style={S.formRow}>
               <label style={S.label}>{t('settings.quotation.vat')}</label>
               <input type="number" style={S.input} value={settings.quote_vat} onInput={(e:any)=>setSettings({...settings, quote_vat: e.target.value})} />
            </div>
            <div style={S.formRow}>
               <label style={S.label}>{t('settings.quotation.terms')}</label>
               <textarea style={{ ...S.input, height: '140px', resize: 'vertical' }} value={settings.quote_terms} onInput={(e:any)=>setSettings({...settings, quote_terms: e.target.value})} />
            </div>
            <div style={S.formRow}>
               <label style={S.label}>QBU Variance Threshold VND</label>
               <input type="number" style={S.input} value={settings.qbu_variance_threshold_vnd || '20000000'} onInput={(e:any)=>setSettings({...settings, qbu_variance_threshold_vnd: e.target.value})} />
            </div>
          </div>
          <div>
            <div style={S.formRow}>
              <label style={S.label}>{t('settings.quotation.vcb_url')}</label>
              <input
                type="text"
                style={S.input}
                value={settings.vcb_rate_url || ''}
                placeholder={t('settings.quotation.vcb_url.placeholder')}
                onInput={(e: any) => setSettings({ ...settings, vcb_rate_url: e.target.value })}
              />
              <div style={{ fontSize: '12px', color: tokens.colors.textMuted, lineHeight: 1.5 }}>
                {t('settings.quotation.vcb_url.help')}
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, vcb_rate_url: settings.vcb_rate_url || 'https://portal.vietcombank.com.vn/Usercontrols/TVPortal.TyGia/pXML.aspx' })}
                  style={{ ...ui.btn.outline, padding: '10px 14px', borderRadius: tokens.radius.lg, fontSize: '13px', fontWeight: 800 }}
                >
                  {t('settings.quotation.vcb_url.default')}
                </button>
                <button
                  type="button"
                  onClick={refreshVcbFx}
                  disabled={refreshingFx}
                  style={{ ...ui.btn.primary, padding: '10px 14px', borderRadius: tokens.radius.lg, fontSize: '13px', fontWeight: 800, opacity: refreshingFx ? 0.7 : 1 }}
                >
                  {refreshingFx ? <><LoaderIcon size={14} /> {t('settings.quotation.vcb_url.refreshing')}</> : <><RefreshIcon size={14} /> {t('settings.quotation.vcb_url.refresh')}</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Company' && (
        <div style={S.formGrid}>
          <div>
            <div style={S.formRow}>
               <label style={S.label}>{t('settings.company.name')}</label>
               <input type="text" style={S.input} value={settings.company_name} onInput={(e:any)=>setSettings({...settings, company_name: e.target.value})} />
            </div>
            <div style={S.formRow}>
               <label style={S.label}>{t('settings.company.address')}</label>
               <input type="text" style={S.input} value={settings.company_address} onInput={(e:any)=>setSettings({...settings, company_address: e.target.value})} />
            </div>
          </div>
          <div>
            <div style={S.formRow}>
               <label style={S.label}>{t('settings.company.phone')}</label>
               <input type="text" style={S.input} value={settings.company_phone} onInput={(e:any)=>setSettings({...settings, company_phone: e.target.value})} />
            </div>
            <div style={S.formRow}>
               <label style={S.label}>{t('settings.company.email_website')}</label>
               <div style={S.stackedInputs}>
                  <input type="text" style={S.input} value={settings.company_email} onInput={(e:any)=>setSettings({...settings, company_email: e.target.value})} placeholder="Email" />
                  <input type="text" style={S.input} value={settings.company_website} onInput={(e:any)=>setSettings({...settings, company_website: e.target.value})} placeholder="Website" />
               </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Display' && (
        <div>
           <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px', background: tokens.colors.background, borderRadius: tokens.radius.lg, border: `1px solid ${tokens.colors.border}` }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '15px' }}>{t('settings.display.dark_mode.title')}</div>
                <div style={{ fontSize: '13px', color: tokens.colors.textSecondary }}>{t('settings.display.dark_mode.desc')}</div>
              </div>
              <button onClick={toggleDarkMode} style={{ 
                padding: '10px 20px',
                background: isDarkMode ? tokens.colors.surface : tokens.colors.textPrimary,
                color: isDarkMode ? tokens.colors.textPrimary : tokens.colors.background,
                border: `1px solid ${tokens.colors.border}`,
                borderRadius: tokens.radius.lg,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}>
                {isDarkMode ? <><SunIcon size={14} /> {t('settings.display.dark_mode.enable_light')}</> : <><MoonIcon size={14} /> {t('settings.display.dark_mode.enable_dark')}</>}
              </button>
           </div>

           <div style={{ marginTop: '16px', padding: '24px', background: tokens.colors.background, borderRadius: tokens.radius.lg, border: `1px solid ${tokens.colors.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ minWidth: '240px' }}>
                  <div style={{ fontWeight: 700, fontSize: '15px' }}>{t('settings.display.language.title')}</div>
                  <div style={{ fontSize: '13px', color: tokens.colors.textSecondary }}>{t('settings.display.language.desc')}</div>
                </div>
                <select
                  value={locale}
                  disabled={languageSaving}
                  onChange={(e: any) => changeLanguage(e.currentTarget.value as Locale)}
                  style={{ ...S.input, maxWidth: '240px', opacity: languageSaving ? 0.7 : 1, cursor: languageSaving ? 'not-allowed' : 'pointer' }}
                >
                  <option value="vi">{t('language.vi')}</option>
                  <option value="en">{t('language.en')}</option>
                </select>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'Security' && (
        <div style={{ maxWidth: '480px' }}>
          <div style={{ fontWeight: 800, fontSize: '16px', color: tokens.colors.textPrimary, marginBottom: '24px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}><ShieldIcon size={16} /> {t('settings.security.title')}</div>
          <div style={S.formRow}>
            <label style={S.label}>{t('settings.security.current_password').toUpperCase()}</label>
            <input type="password" style={S.input} value={pwForm.currentPassword} onInput={(e:any)=>setPwForm({...pwForm, currentPassword: e.target.value})} placeholder={t('settings.security.current_password.placeholder')} />
          </div>
          <div style={S.formRow}>
            <label style={S.label}>{t('settings.security.new_password').toUpperCase()}</label>
            <input type="password" style={S.input} value={pwForm.newPassword} onInput={(e:any)=>setPwForm({...pwForm, newPassword: e.target.value})} placeholder={t('settings.security.new_password.placeholder')} />
          </div>
          <div style={S.formRow}>
            <label style={S.label}>{t('settings.security.confirm_password').toUpperCase()}</label>
            <input type="password" style={S.input} value={pwForm.confirmPassword} onInput={(e:any)=>setPwForm({...pwForm, confirmPassword: e.target.value})} placeholder={t('settings.security.confirm_password.placeholder')} />
          </div>
          <button onClick={changePassword} disabled={pwSaving} style={{ ...ui.btn.primary, padding: '12px 32px', borderRadius: tokens.radius.lg, fontSize: '14px', fontWeight: 800, cursor: pwSaving ? 'not-allowed' : 'pointer', opacity: pwSaving ? 0.7 : 1 }}>
            {pwSaving ? <><LoaderIcon size={14} /> {t('common.saving')}</> : <><UserIcon size={14} /> {t('settings.security.submit')}</>}
          </button>
        </div>
      )}

      {activeTab !== 'Security' && <div style={{ marginTop: '60px', borderTop: `1px solid ${tokens.colors.border}`, paddingTop: '32px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        <button onClick={saveSettings} disabled={saving} style={{ ...ui.btn.primary, padding: '14px 40px', borderRadius: tokens.radius.lg, fontSize: '15px', fontWeight: 800, cursor: 'pointer', boxShadow: tokens.shadow.sm, transition: 'all 0.2s ease', opacity: saving ? 0.7 : 1 }}>
          {saving ? <><LoaderIcon size={14} /> {t('settings.saving')}</> : <><CheckIcon size={14} /> {t('settings.save')}</>}
        </button>
      </div>}
    </div>
  );
}
