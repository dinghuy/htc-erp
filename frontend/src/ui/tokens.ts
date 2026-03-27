export const tokens = {
  colors: {
    primary: 'var(--ht-green)',
    primaryDark: 'var(--ht-green-dark)',
    warning: 'var(--ht-amber)',
    warningDark: 'var(--ht-amber-dark)',
    textPrimary: 'var(--text-primary)',
    textSecondary: 'var(--text-secondary)',
    textMuted: 'var(--text-muted)',
    textOnPrimary: 'var(--text-on-primary)',
    surface: 'var(--bg-surface)',
    background: 'var(--bg-primary)',
    border: 'var(--border-color)',
    success: 'var(--ht-success-text)',
    error: 'var(--ht-error-text)',
    badgeBgSuccess: 'var(--ht-success-bg)',
    badgeBgError: 'var(--ht-error-bg)',
    info: 'var(--ht-green)',
    badgeBgInfo: 'var(--bg-surface)'
  },
  radius: {
    sm: 'var(--radius-sm)',
    md: 'var(--radius-md)',
    lg: 'var(--radius-lg)',
    xl: 'var(--radius-xl)'
  },
  shadow: {
    sm: 'var(--shadow-sm)',
    md: 'var(--shadow-md)'
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px'
  }
} as const;
