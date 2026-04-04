import { useState, useEffect } from 'preact/hooks';
import { tokens } from './ui/tokens';
import { ui } from './ui/styles';
import { loadSession } from './auth';
import { type Locale, translate } from './i18n';
import { AlertCircleIcon, CheckCircle2Icon, InfoIcon } from './ui/icons';

let notifyFn: (msg: string, type: 'success' | 'error' | 'info') => void;

export const showNotify = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
  if (notifyFn) notifyFn(msg, type);
  else alert(msg);
};

export const showNotifyT = (key: string, type: 'success' | 'error' | 'info' = 'info', params?: Record<string, any>) => {
  const locale = (loadSession()?.language as Locale) || 'vi';
  const msg = translate(locale, key, params);
  showNotify(msg, type);
};

export function NotificationContainer() {
  const [notifs, setNotifs] = useState<{ id: number; msg: string; type: string }[]>([]);

  useEffect(() => {
    notifyFn = (msg, type) => {
      const id = Date.now();
      setNotifs((prev) => [...prev, { id, msg, type }]);
      setTimeout(() => {
        setNotifs((prev) => prev.filter((n) => n.id !== id));
      }, 4000);
    };
  }, []);

  return (
    <div style={{
      position: 'fixed', top: '24px', right: '24px', zIndex: tokens.zIndex.toast,
      display: 'flex', flexDirection: 'column', gap: '12px', pointerEvents: 'none',
      width: 'min(360px, calc(100vw - 48px))',
      maxWidth: 'calc(100vw - 48px)'
    }} aria-live="polite" aria-atomic="true">
      {notifs.map((n) => (
        <div key={n.id} role="status" style={{
          background: n.type === 'error' ? tokens.colors.badgeBgError : (n.type === 'success' ? tokens.colors.badgeBgSuccess : tokens.colors.surface),
          color: n.type === 'error' ? tokens.colors.error : (n.type === 'success' ? tokens.colors.success : tokens.colors.textPrimary),
          border: `1px solid ${n.type === 'error' ? tokens.colors.error : (n.type === 'success' ? tokens.colors.success : tokens.colors.border)}`,
          padding: '16px 20px', borderRadius: tokens.radius.lg,
          display: 'flex', alignItems: 'center', gap: '12px', pointerEvents: 'auto',
          width: '100%', maxWidth: '100%', animation: 'slideIn 0.24s ease-out forwards',
          fontWeight: 700, fontSize: '14px',
          ...ui.overlay.toast
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            {n.type === 'error'
              ? <AlertCircleIcon size={18} strokeWidth={2} />
              : n.type === 'success'
                ? <CheckCircle2Icon size={18} strokeWidth={2} />
                : <InfoIcon size={18} strokeWidth={2} />}
          </span>
          {n.msg}
          <style>{`
            @keyframes slideIn {
              from { transform: translateX(24px); opacity: 0; }
              to { transform: translateX(0); opacity: 1; }
            }
          `}</style>
        </div>
      ))}
    </div>
  );
}
