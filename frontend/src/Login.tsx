import { useState } from 'preact/hooks';
import { API_BASE } from './config';
import { showNotify } from './Notification';
import { tokens } from './ui/tokens';
import { ui } from './ui/styles';
import type { CurrentUser } from './auth';
import htcLogo from './assets/htc-logo.png';
import { type Locale, useI18n } from './i18n';
import { QA_TEST_IDS } from './testing/testIds';
import { LoaderIcon, ShieldIcon, WarningIcon } from './ui/icons';

interface LoginProps {
  onLogin: (user: CurrentUser) => void;
}

export function Login({ onLogin }: LoginProps) {
  const { locale, setLocale, t } = useI18n();
  const [mode, setMode] = useState<'login' | 'forgot' | 'reset'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: Event) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || t('login.error.default')); return; }
      onLogin({ ...data.user, token: data.token });
    } catch {
      setError(t('login.error.connect'));
    } finally {
      setLoading(false);
    }
  };

  const requestReset = async (e: Event) => {
    e.preventDefault();
    if (!resetIdentifier.trim()) {
      setError(t('login.reset.error.required_identifier'));
      return;
    }
    setLoading(true);
    setError('');
    setResetMessage('');
    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: resetIdentifier.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || t('login.error.default'));
        return;
      }
      setResetMessage(t('login.reset.request_success'));
      if (data.debugResetToken) {
        setResetToken(data.debugResetToken);
        setMode('reset');
      }
    } catch {
      setError(t('login.error.connect'));
    } finally {
      setLoading(false);
    }
  };

  const completeReset = async (e: Event) => {
    e.preventDefault();
    if (!resetToken) {
      setError(t('login.reset.error.required_token'));
      return;
    }
    if (resetPassword.length < 8) {
      setError(t('login.reset.error.min_length'));
      return;
    }
    if (resetPassword !== resetConfirmPassword) {
      setError(t('login.reset.error.mismatch'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, newPassword: resetPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || t('login.error.default'));
        return;
      }
      showNotify(t('login.reset.success'), 'success');
      onLogin({ ...data.user, token: data.token });
    } catch {
      setError(t('login.error.connect'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: tokens.surface.authCanvas,
      fontFamily: 'var(--font-family-sans)',
    }}>
      <div style={{
        background: tokens.colors.surface,
        borderRadius: tokens.radius.xl,
        boxShadow: tokens.shadow.auth,
        padding: '48px 40px',
        width: '100%',
        maxWidth: '420px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
      }} data-testid={QA_TEST_IDS.login.shell}>
        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <img src={htcLogo} alt="HTC Logo" style={{ width: '64px', height: '64px', objectFit: 'contain' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '18px', fontWeight: 800, color: tokens.colors.primary, letterSpacing: '-0.02em' }}>Huynh Thy Group</div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: tokens.colors.textMuted, letterSpacing: '0.08em', marginTop: '4px', textTransform: 'uppercase' }}>
              ENTERPRISE CRM · {t('login.subtitle')}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <select
            value={locale}
            onChange={(e: any) => setLocale(e.currentTarget.value as Locale)}
            data-testid={QA_TEST_IDS.login.locale}
            style={{ ...ui.input.base, padding: '10px 12px', fontSize: '13px', cursor: 'pointer', maxWidth: '180px' } as any}
          >
            <option value="vi">{t('language.vi')}</option>
            <option value="en">{t('language.en')}</option>
          </select>
        </div>

        {/* Form */}
        {mode === 'login' ? (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: tokens.colors.textSecondary, marginBottom: '6px' }}>
                {t('login.username').toUpperCase()}
              </label>
              <input
                type="text"
                autoComplete="username"
                value={username}
                onInput={(e: any) => setUsername(e.target.value)}
                data-testid={QA_TEST_IDS.login.username}
                placeholder={t('login.username.placeholder')}
                style={{ ...ui.input.base, width: '100%', padding: '12px 14px', fontSize: '14px', boxSizing: 'border-box' } as any}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: tokens.colors.textSecondary, marginBottom: '6px' }}>
                {t('login.password').toUpperCase()}
              </label>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onInput={(e: any) => setPassword(e.target.value)}
                data-testid={QA_TEST_IDS.login.password}
                placeholder={t('login.password.placeholder')}
                style={{ ...ui.input.base, width: '100%', padding: '12px 14px', fontSize: '14px', boxSizing: 'border-box' } as any}
              />
            </div>

            {error && (
              <div data-testid={QA_TEST_IDS.login.error} style={{ background: tokens.colors.badgeBgError, border: `1px solid ${tokens.colors.error}`, borderRadius: tokens.radius.md, padding: '10px 14px', fontSize: '13px', color: tokens.colors.error, fontWeight: 600 }}>
                <WarningIcon size={14} /> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username.trim() || !password}
              data-testid={QA_TEST_IDS.login.submit}
              style={{
                ...ui.btn.primary,
                width: '100%',
                justifyContent: 'center',
                padding: '13px',
                fontSize: '14px',
                fontWeight: 700,
                opacity: (loading || !username.trim() || !password) ? 0.6 : 1,
                cursor: (loading || !username.trim() || !password) ? 'not-allowed' : 'pointer',
              } as any}
            >
              {loading ? <><LoaderIcon size={14} /> {t('login.loading')}</> : <><ShieldIcon size={14} /> {t('login.submit')}</>}
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('forgot');
                setError('');
                setResetMessage('');
              }}
              style={{ ...ui.btn.ghost, width: '100%', justifyContent: 'center', padding: '10px 12px' } as any}
            >
              {t('login.forgot_password')}
            </button>
          </form>
        ) : null}

        {mode === 'forgot' ? (
          <form onSubmit={requestReset} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: tokens.colors.textSecondary, marginBottom: '6px' }}>
                {t('login.reset.identifier').toUpperCase()}
              </label>
              <input
                type="text"
                value={resetIdentifier}
                onInput={(e: any) => setResetIdentifier(e.target.value)}
                placeholder={t('login.reset.identifier.placeholder')}
                style={{ ...ui.input.base, width: '100%', padding: '12px 14px', fontSize: '14px', boxSizing: 'border-box' } as any}
              />
            </div>

            {resetMessage ? (
              <div style={{ background: tokens.colors.badgeBgSuccess, border: `1px solid ${tokens.colors.success}`, borderRadius: tokens.radius.md, padding: '10px 14px', fontSize: '13px', color: tokens.colors.success, fontWeight: 600 }}>
                {resetMessage}
              </div>
            ) : null}
            {error ? (
              <div data-testid={QA_TEST_IDS.login.error} style={{ background: tokens.colors.badgeBgError, border: `1px solid ${tokens.colors.error}`, borderRadius: tokens.radius.md, padding: '10px 14px', fontSize: '13px', color: tokens.colors.error, fontWeight: 600 }}>
                <WarningIcon size={14} /> {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading || !resetIdentifier.trim()}
              style={{ ...ui.btn.primary, width: '100%', justifyContent: 'center', padding: '13px', fontSize: '14px', fontWeight: 700, opacity: (loading || !resetIdentifier.trim()) ? 0.6 : 1, cursor: (loading || !resetIdentifier.trim()) ? 'not-allowed' : 'pointer' } as any}
            >
              {loading ? t('login.reset.request_loading') : t('login.reset.request_submit')}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
                setResetMessage('');
              }}
              style={{ ...ui.btn.ghost, width: '100%', justifyContent: 'center', padding: '10px 12px' } as any}
            >
              {t('login.back_to_login')}
            </button>
          </form>
        ) : null}

        {mode === 'reset' ? (
          <form onSubmit={completeReset} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: tokens.colors.infoAccentBg, border: `1px solid ${tokens.colors.infoAccentText}`, borderRadius: tokens.radius.md, padding: '10px 14px', fontSize: '13px', color: tokens.colors.infoAccentText, lineHeight: 1.5 }}>
              {t('login.reset.local_notice')}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: tokens.colors.textSecondary, marginBottom: '6px' }}>
                {t('login.reset.new_password').toUpperCase()}
              </label>
              <input
                type="password"
                autoComplete="new-password"
                value={resetPassword}
                onInput={(e: any) => setResetPassword(e.target.value)}
                placeholder={t('login.reset.new_password.placeholder')}
                style={{ ...ui.input.base, width: '100%', padding: '12px 14px', fontSize: '14px', boxSizing: 'border-box' } as any}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: tokens.colors.textSecondary, marginBottom: '6px' }}>
                {t('login.reset.confirm_password').toUpperCase()}
              </label>
              <input
                type="password"
                autoComplete="new-password"
                value={resetConfirmPassword}
                onInput={(e: any) => setResetConfirmPassword(e.target.value)}
                placeholder={t('login.reset.confirm_password.placeholder')}
                style={{ ...ui.input.base, width: '100%', padding: '12px 14px', fontSize: '14px', boxSizing: 'border-box' } as any}
              />
            </div>

            {error ? (
              <div data-testid={QA_TEST_IDS.login.error} style={{ background: tokens.colors.badgeBgError, border: `1px solid ${tokens.colors.error}`, borderRadius: tokens.radius.md, padding: '10px 14px', fontSize: '13px', color: tokens.colors.error, fontWeight: 600 }}>
                <WarningIcon size={14} /> {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading || !resetPassword || !resetConfirmPassword}
              style={{ ...ui.btn.primary, width: '100%', justifyContent: 'center', padding: '13px', fontSize: '14px', fontWeight: 700, opacity: (loading || !resetPassword || !resetConfirmPassword) ? 0.6 : 1, cursor: (loading || !resetPassword || !resetConfirmPassword) ? 'not-allowed' : 'pointer' } as any}
            >
              {loading ? t('login.reset.saving') : t('login.reset.submit')}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
                setResetMessage('');
                setResetToken('');
                setResetPassword('');
                setResetConfirmPassword('');
              }}
              style={{ ...ui.btn.ghost, width: '100%', justifyContent: 'center', padding: '10px 12px' } as any}
            >
              {t('login.back_to_login')}
            </button>
          </form>
        ) : null}

        <div style={{ textAlign: 'center', fontSize: '11px', color: tokens.colors.textMuted, borderTop: `1px solid ${tokens.colors.border}`, paddingTop: '16px' }}>
          {t('login.footer')}
        </div>
      </div>
    </div>
  );
}
