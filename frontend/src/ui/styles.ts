import { tokens } from './tokens';

export const ui = {
  btn: {
    primary: {
      padding: `${tokens.spacing.md} ${tokens.spacing.xl}`,
      borderRadius: tokens.radius.lg,
      fontSize: tokens.fontSize.base,
      fontWeight: 700,
      cursor: 'pointer',
      border: 'none',
      color: tokens.colors.textOnPrimary,
      background: tokens.colors.primary,
      display: 'flex',
      alignItems: 'center',
      gap: tokens.spacing.sm,
      transition: 'background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease'
    },
    outline: {
      padding: `${tokens.spacing.md} ${tokens.spacing.xl}`,
      borderRadius: tokens.radius.lg,
      fontSize: tokens.fontSize.base,
      fontWeight: 600,
      cursor: 'pointer',
      border: `1px solid ${tokens.colors.border}`,
      color: tokens.colors.textSecondary,
      background: tokens.colors.surface,
      display: 'flex',
      alignItems: 'center',
      gap: tokens.spacing.sm,
      transition: 'background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease'
    },
    danger: {
      padding: `${tokens.spacing.xs} ${tokens.spacing.lg}`,
      borderRadius: tokens.radius.md,
      fontSize: tokens.fontSize.sm,
      fontWeight: 600,
      cursor: 'pointer',
      border: 'none',
      color: tokens.colors.textOnPrimary,
      background: tokens.colors.error,
      transition: 'background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease'
    },
    ghost: {
      padding: `${tokens.spacing.md} ${tokens.spacing.xl}`,
      borderRadius: tokens.radius.lg,
      fontSize: tokens.fontSize.base,
      fontWeight: 600,
      cursor: 'pointer',
      border: 'none',
      color: tokens.colors.primary,
      background: 'transparent',
      display: 'flex',
      alignItems: 'center',
      gap: tokens.spacing.sm,
      transition: 'background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease'
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
      fontSize: tokens.fontSize.xs,
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
      fontSize: tokens.fontSize.xs,
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
      fontSize: tokens.fontSize.md,
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
      fontSize: tokens.fontSize.base,
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
      fontSize: tokens.fontSize.xs,
      fontWeight: 800
    },
    warning: {
      padding: `${tokens.spacing.xs} ${tokens.spacing.md}`,
      borderRadius: tokens.radius.md,
      background: tokens.colors.badgeBgInfo,
      color: tokens.colors.warning,
      fontSize: tokens.fontSize.xs,
      fontWeight: 800
    },
    info: {
      padding: `${tokens.spacing.xs} ${tokens.spacing.md}`,
      borderRadius: tokens.radius.md,
      background: tokens.colors.badgeBgInfo,
      color: tokens.colors.info,
      fontSize: tokens.fontSize.xs,
      fontWeight: 800
    },
    error: {
      padding: `${tokens.spacing.xs} ${tokens.spacing.md}`,
      borderRadius: tokens.radius.md,
      background: tokens.colors.badgeBgError,
      color: tokens.colors.error,
      fontSize: tokens.fontSize.xs,
      fontWeight: 800
    },
    neutral: {
      padding: `${tokens.spacing.xs} ${tokens.spacing.md}`,
      borderRadius: tokens.radius.md,
      background: tokens.colors.surface,
      color: tokens.colors.textMuted,
      fontSize: tokens.fontSize.xs,
      fontWeight: 800
    }
  },
  page: {
    /** Responsive KPI bar — cards wrap on narrow viewports */
    kpiRow: {
      display: 'flex',
      gap: tokens.spacing.lg,
      flexWrap: 'wrap',
    } as const,
    /** Individual KPI card — stretches equally, min 140 px before wrapping */
    kpiCard: {
      flex: '1 1 140px',
      minWidth: 0,
    } as const,
    /** Page-level title + action-buttons row — stacks on narrow viewports */
    titleRow: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: tokens.spacing.lg,
    } as const,
    /** Action buttons cluster inside titleRow */
    actions: {
      display: 'flex',
      gap: tokens.spacing.smPlus,
      flexWrap: 'wrap',
      flexShrink: 0,
    } as const,
    /** End-aligned row for a single action or compact action group */
    endActionRow: {
      display: 'flex',
      justifyContent: 'flex-end',
      alignItems: 'center',
    } as const,
    shell: {
      maxWidth: '1400px',
      margin: '0 auto',
      display: 'grid',
      gap: tokens.shell.sectionGap,
    } as const,
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
  overlay: {
    backdrop: {
      background: tokens.overlay.backdropGradient,
      backdropFilter: `blur(${tokens.overlay.backdropBlur})`,
      WebkitBackdropFilter: `blur(${tokens.overlay.backdropBlur})`,
    },
    drawer: {
      background: tokens.colors.surface,
      borderLeft: `1px solid ${tokens.colors.border}`,
      boxShadow: tokens.overlay.drawerShadow,
    },
    menu: {
      border: `1px solid ${tokens.colors.border}`,
      background: tokens.colors.surface,
      boxShadow: tokens.shadow.md,
    },
    toast: {
      boxShadow: tokens.shadow.md,
      backdropFilter: `blur(${tokens.overlay.toastBlur})`,
      WebkitBackdropFilter: `blur(${tokens.overlay.toastBlur})`,
    },
  },
  form: {
    label: {
      fontSize: tokens.fontSize.sm,
      fontWeight: 700,
      color: tokens.colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: '0.05em'
    },
    help: {
      fontSize: tokens.fontSize.sm,
      color: tokens.colors.textSecondary
    },
    error: {
      fontSize: tokens.fontSize.sm,
      color: tokens.colors.error,
      fontWeight: 600
    }
  }
} as const;
