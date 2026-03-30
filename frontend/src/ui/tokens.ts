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
  overlay: {
    backdropGradient: 'linear-gradient(180deg, rgba(8, 15, 30, 0.72) 0%, rgba(4, 10, 24, 0.82) 100%)',
    backdropBlur: '16px',
    softBackdrop: 'rgba(15, 23, 42, 0.42)',
    drawerShadow: '-18px 0 40px rgba(15, 23, 42, 0.16)',
    modalShadow: '0 24px 80px rgba(2, 6, 23, 0.45)',
    toastBlur: '8px',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px'
  },
  zIndex: {
    base: 0,
    sticky: 10,
    dropdown: 200,
    popover: 300,
    toast: 900,
    overlayBackdrop: 1000,
    modal: 1010,
    drawer: 1020,
    detail: 1030,
    modalTop: 1030,
    emergency: 1100,
  }
} as const;
