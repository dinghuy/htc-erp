import { tokens } from './tokens';

export const ui = {
  btn: {
    primary: {
      padding: `${tokens.spacing.md} ${tokens.spacing.xl}`,
      borderRadius: tokens.radius.lg,
      fontSize: '14px',
      fontWeight: 700,
      cursor: 'pointer',
      border: 'none',
      color: tokens.colors.textOnPrimary,
      background: tokens.colors.primary,
      display: 'flex',
      alignItems: 'center',
      gap: tokens.spacing.sm,
      transition: 'all 0.2s ease'
    },
    outline: {
      padding: `${tokens.spacing.md} ${tokens.spacing.xl}`,
      borderRadius: tokens.radius.lg,
      fontSize: '14px',
      fontWeight: 600,
      cursor: 'pointer',
      border: `1px solid ${tokens.colors.border}`,
      color: tokens.colors.textSecondary,
      background: tokens.colors.surface,
      display: 'flex',
      alignItems: 'center',
      gap: tokens.spacing.sm,
      transition: 'all 0.2s ease'
    },
    danger: {
      padding: `${tokens.spacing.xs} ${tokens.spacing.lg}`,
      borderRadius: tokens.radius.md,
      fontSize: '12px',
      fontWeight: 600,
      cursor: 'pointer',
      border: 'none',
      color: tokens.colors.textOnPrimary,
      background: tokens.colors.error,
      transition: 'all 0.2s ease'
    },
    ghost: {
      padding: `${tokens.spacing.md} ${tokens.spacing.xl}`,
      borderRadius: tokens.radius.lg,
      fontSize: '14px',
      fontWeight: 600,
      cursor: 'pointer',
      border: 'none',
      color: tokens.colors.primary,
      background: 'transparent',
      display: 'flex',
      alignItems: 'center',
      gap: tokens.spacing.sm,
      transition: 'all 0.2s ease'
    }
  },
  card: {
    base: {
      backgroundColor: tokens.colors.surface,
      borderRadius: tokens.radius.lg,
      boxShadow: tokens.shadow.sm,
      border: `1px solid ${tokens.colors.border}`,
      color: tokens.colors.textPrimary
    },
    kpi: {
      background: tokens.colors.surface,
      padding: `${tokens.spacing.lg} ${tokens.spacing.xl}`,
      borderRadius: tokens.radius.lg,
      border: `1px solid ${tokens.colors.border}`,
      boxShadow: tokens.shadow.sm,
      display: 'flex',
      flexDirection: 'column',
      gap: tokens.spacing.xs,
      flex: 1
    }
  },
  table: {
    thStatic: {
      padding: `${tokens.spacing.lg} ${tokens.spacing.xl}`,
      textAlign: 'left',
      fontSize: '11px',
      fontWeight: 700,
      color: tokens.colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      borderBottom: `2px solid ${tokens.colors.border}`,
      background: tokens.colors.background
    },
    thSortable: {
      padding: `${tokens.spacing.lg} ${tokens.spacing.xl}`,
      textAlign: 'left',
      fontSize: '11px',
      fontWeight: 700,
      color: tokens.colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      borderBottom: `2px solid ${tokens.colors.border}`,
      background: tokens.colors.background,
      cursor: 'pointer',
      userSelect: 'none'
    },
    td: {
      padding: `${tokens.spacing.md} ${tokens.spacing.lg}`,
      fontSize: '13.5px',
      color: tokens.colors.textPrimary,
      borderBottom: `1px solid ${tokens.colors.border}`
    },
    row: {
      transition: 'background 0.2s ease'
    }
  },
  input: {
    base: {
      width: '100%',
      maxWidth: '100%',
      minWidth: 0,
      boxSizing: 'border-box',
      padding: `${tokens.spacing.md} ${tokens.spacing.xl}`,
      borderRadius: tokens.radius.lg,
      border: `1px solid ${tokens.colors.border}`,
      fontSize: '14px',
      outline: 'none',
      background: tokens.colors.background,
      color: tokens.colors.textPrimary
    }
  },
  badge: {
    success: {
      padding: `${tokens.spacing.xs} ${tokens.spacing.md}`,
      borderRadius: tokens.radius.md,
      background: tokens.colors.badgeBgSuccess,
      color: tokens.colors.success,
      fontSize: '11px',
      fontWeight: 800
    },
    warning: {
      padding: `${tokens.spacing.xs} ${tokens.spacing.md}`,
      borderRadius: tokens.radius.md,
      background: tokens.colors.badgeBgInfo,
      color: tokens.colors.warning,
      fontSize: '11px',
      fontWeight: 800
    },
    info: {
      padding: `${tokens.spacing.xs} ${tokens.spacing.md}`,
      borderRadius: tokens.radius.md,
      background: tokens.colors.badgeBgInfo,
      color: tokens.colors.info,
      fontSize: '11px',
      fontWeight: 800
    },
    error: {
      padding: `${tokens.spacing.xs} ${tokens.spacing.md}`,
      borderRadius: tokens.radius.md,
      background: tokens.colors.badgeBgError,
      color: tokens.colors.error,
      fontSize: '11px',
      fontWeight: 800
    },
    neutral: {
      padding: `${tokens.spacing.xs} ${tokens.spacing.md}`,
      borderRadius: tokens.radius.md,
      background: tokens.colors.surface,
      color: tokens.colors.textMuted,
      fontSize: '11px',
      fontWeight: 800
    }
  },
  modal: {
    shell: {
      background: tokens.colors.surface,
      borderRadius: tokens.radius.xl,
      boxShadow: tokens.shadow.md,
      border: `1px solid ${tokens.colors.border}`,
      overflow: 'hidden'
    }
  },
  form: {
    label: {
      fontSize: '12px',
      fontWeight: 700,
      color: tokens.colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: '0.05em'
    },
    help: {
      fontSize: '12px',
      color: tokens.colors.textSecondary
    },
    error: {
      fontSize: '12px',
      color: tokens.colors.error,
      fontWeight: 600
    }
  }
} as const;
