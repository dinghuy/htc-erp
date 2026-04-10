import { useState } from 'preact/hooks';
import { fetchWithAuth } from './auth';
import { API_BASE } from './config';
import { showNotify } from './Notification';
import { OverlayPortal, getOverlayContainerStyle } from './ui/overlay';
import { tokens } from './ui/tokens';
import { ui } from './ui/styles';
import htcLogo from './assets/htc-logo.png';
import { useI18n } from './i18n';

export function ForceChangePassword({ currentUser, onDone }: { currentUser: any; onDone: (updatedUser: any) => void }) {
  const { t } = useI18n();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: Event) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError(t('force_pw.error.min_length'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('force_pw.error.mismatch'));
      return;
    }

    setSaving(true);
    try {
      const res = await fetchWithAuth(currentUser.token, `${API_BASE}/auth/change-password`, {
        method: 'POST',
        body: JSON.stringify({ currentPassword: '', newPassword, forceChange: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t('force_pw.error.default'));
      }
      const data = await res.json().catch(() => ({}));
      showNotify(t('force_pw.success'), 'success');
      onDone({
        ...currentUser,
        ...(data?.user || {}),
        token: data?.token || currentUser.token,
        mustChangePassword: false,
      });
    } catch (err: any) {
      setError(err.message || t('force_pw.error.default'));
      setSaving(false);
    }
  };

  return (
    <OverlayPortal>
      <div style={{
        ...getOverlayContainerStyle('emergency', { padding: '20px' }),
        background: tokens.surface.authCanvas,
        fontFamily: 'var(--font-family-sans)',
      }}>
        <div style={{
          background: tokens.colors.surface,
          borderRadius: tokens.radius.xl,
          boxShadow: tokens.shadow.auth,
          padding: '48px 40px',
          width: '100%',
          maxWidth: '440px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}>
        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <img src={htcLogo} alt="HTC Logo" style={{ width: '56px', height: '56px', objectFit: 'contain' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '18px', fontWeight: 800, color: tokens.colors.primary, letterSpacing: '-0.02em' }}>
              {t('force_pw.title')}
            </div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: tokens.colors.textMuted, letterSpacing: '0.05em', marginTop: '4px', textTransform: 'uppercase' }}>
              Huynh Thy Group CRM
            </div>
          </div>
        </div>

        {/* Notice banner */}
        <div style={{
          background: tokens.colors.warningSurfaceBgSoft,
          border: `1px solid ${tokens.colors.warningSurfaceBorder}`,
          borderRadius: tokens.radius.md,
          padding: '12px 16px',
          fontSize: '13px',
          color: tokens.colors.warningSurfaceText,
          lineHeight: '1.6',
        }}>
          {t('force_pw.notice')}
        </div>

        {/* Form */}
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: tokens.colors.textSecondary, marginBottom: '6px' }}>
              {t('force_pw.new_password').toUpperCase()} *
            </label>
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onInput={(e: any) => setNewPassword(e.target.value)}
              placeholder={t('force_pw.new_password.placeholder')}
              style={{ ...ui.input.base, width: '100%', padding: '12px 14px', fontSize: '14px', boxSizing: 'border-box' } as any}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: tokens.colors.textSecondary, marginBottom: '6px' }}>
              {t('force_pw.confirm_password').toUpperCase()} *
            </label>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onInput={(e: any) => setConfirmPassword(e.target.value)}
              placeholder={t('force_pw.confirm_password.placeholder')}
              style={{ ...ui.input.base, width: '100%', padding: '12px 14px', fontSize: '14px', boxSizing: 'border-box' } as any}
            />
          </div>

          {error && (
            <div style={{
              background: tokens.colors.badgeBgError,
              border: `1px solid ${tokens.colors.error}`,
              borderRadius: tokens.radius.md,
              padding: '10px 14px',
              fontSize: '13px',
              color: tokens.colors.error,
              fontWeight: 600,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving || !newPassword || !confirmPassword}
            style={{
              ...ui.btn.primary,
              width: '100%',
              justifyContent: 'center',
              padding: '13px',
              fontSize: '14px',
              fontWeight: 700,
              opacity: (saving || !newPassword || !confirmPassword) ? 0.6 : 1,
              cursor: (saving || !newPassword || !confirmPassword) ? 'not-allowed' : 'pointer',
            } as any}
          >
            {saving ? t('force_pw.saving') : t('force_pw.submit')}
          </button>
        </form>

        <div style={{ textAlign: 'center', fontSize: '11px', color: tokens.colors.textMuted, borderTop: `1px solid ${tokens.colors.border}`, paddingTop: '16px' }}>
          {t('force_pw.signed_in_as', { name: currentUser?.fullName || currentUser?.username })}
        </div>
      </div>
      </div>
    </OverlayPortal>
  );
}
