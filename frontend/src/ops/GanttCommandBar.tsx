import { tokens } from '../ui/tokens';
import type { CommandMetric } from './ganttDerived';

export type { CommandMetric } from './ganttDerived';

type MetricAction = CommandMetric & {
  active?: boolean;
  onClick?: () => void;
};

type GanttCommandBarProps = {
  metrics: MetricAction[];
};

const toneStyles = {
  neutral: {
    color: tokens.colors.textPrimary,
    background: tokens.colors.surface,
    border: tokens.colors.border,
    badgeBackground: tokens.colors.background,
    badgeColor: tokens.colors.textSecondary,
  },
  good: {
    color: tokens.colors.success,
    background: 'var(--ht-success-bg)',
    border: tokens.colors.badgeBgSuccess,
    badgeBackground: tokens.surface.badge,
    badgeColor: tokens.colors.success,
  },
  warn: {
    color: tokens.colors.warning,
    background: tokens.colors.warningBg,
    border: tokens.colors.warningBorder,
    badgeBackground: tokens.surface.badge,
    badgeColor: tokens.colors.warning,
  },
  bad: {
    color: tokens.colors.error,
    background: 'var(--ht-error-bg)',
    border: 'rgba(239, 68, 68, 0.22)',
    badgeBackground: tokens.surface.badgeStrong,
    badgeColor: tokens.colors.error,
  },
} as const;

const S = {
  shell: {
    padding: `${tokens.spacing.smPlus} 0 0`,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacing.sm,
  } as any,
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacing.xsPlus,
    minWidth: 0,
  } as any,
  sectionLabel: {
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: tokens.colors.textMuted,
  } as any,
  metricRail: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(156px, 188px))',
    gap: tokens.spacing.sm,
    justifyContent: 'start',
  } as any,
  metricButton: {
    minWidth: 0,
    minHeight: '60px',
    padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
    borderRadius: tokens.radius.xl,
    border: `1px solid ${tokens.colors.border}`,
    background: tokens.colors.background,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: tokens.spacing.xs,
    textAlign: 'left',
    transition: 'all 0.2s ease',
  } as any,
  metricLabelRow: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing.xsPlus,
  } as any,
  metricLabel: {
    fontSize: tokens.fontSize.xs,
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: tokens.colors.textMuted,
    lineHeight: 1.2,
  } as any,
  metricValueRow: {
    width: '100%',
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: tokens.spacing.sm,
  } as any,
  metricValue: {
    fontSize: tokens.fontSize.title,
    fontWeight: 900,
    letterSpacing: '-0.03em',
    lineHeight: 1,
    color: tokens.colors.textPrimary,
  } as any,
  metricBadge: {
    padding: '2px 7px',
    borderRadius: '999px',
    fontSize: '10px',
    fontWeight: 800,
    flexShrink: 0,
  } as any,
  emptyText: {
    fontSize: tokens.fontSize.sm,
    color: tokens.colors.textSecondary,
    padding: `${tokens.spacing.xxs} 0`,
  } as any,
};

function renderMetricCount(metric: CommandMetric) {
  if (metric.value !== String(metric.count)) {
    return `${metric.count} mục`;
  }
  return metric.count === 1 ? '1 mục' : `${metric.count} mục`;
}

export function GanttCommandBar(props: GanttCommandBarProps) {
  const { metrics } = props;

  return (
    <section style={S.shell} aria-label="Gantt command bar">
      <div style={S.section}>
        <div style={S.sectionLabel}>Can xu ly ngay</div>
        {metrics.length > 0 ? (
          <div style={S.metricRail}>
            {metrics.map((metric) => {
              const tone = toneStyles[metric.tone] || toneStyles.neutral;
              const isInteractive = typeof metric.onClick === 'function';

              return (
                <button
                  key={metric.key}
                  type="button"
                  onClick={metric.onClick}
                  disabled={!isInteractive}
                  aria-pressed={metric.active ? true : undefined}
                  aria-label={`${metric.label}: ${metric.value}`}
                  style={{
                    ...S.metricButton,
                    cursor: isInteractive ? 'pointer' : 'default',
                    opacity: !isInteractive && !metric.active ? 0.92 : 1,
                    background: metric.active ? tone.background : tokens.colors.background,
                    border: `1px solid ${metric.active ? tone.border : tokens.colors.border}`,
                    boxShadow: metric.active ? tokens.shadow.sm : 'none',
                  }}
                >
                  <div style={S.metricLabelRow}>
                    <span style={S.metricLabel}>{metric.label}</span>
                  </div>
                  <div style={S.metricValueRow}>
                    <div style={{ ...S.metricValue, color: metric.active ? tone.color : tokens.colors.textPrimary }}>
                      {metric.value}
                    </div>
                    <span
                      style={{
                        ...S.metricBadge,
                        background: tone.badgeBackground,
                        color: tone.badgeColor,
                      }}
                    >
                      {renderMetricCount(metric)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div style={S.emptyText}>No metrics available.</div>
        )}
      </div>
    </section>
  );
}
