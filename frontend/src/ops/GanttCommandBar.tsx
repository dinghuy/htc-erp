import { tokens } from '../ui/tokens';
import { ui } from '../ui/styles';
import type { CommandMetric } from './ganttDerived';

export type { CommandMetric } from './ganttDerived';

type MetricAction = CommandMetric & {
  active?: boolean;
  onClick?: () => void;
};

type PresetAction = {
  key: string;
  label: string;
  active?: boolean;
  onClick?: () => void;
};

type GanttCommandBarProps = {
  metrics: MetricAction[];
  presets: PresetAction[];
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
    border: 'rgba(16, 185, 129, 0.2)',
    badgeBackground: 'rgba(255, 255, 255, 0.72)',
    badgeColor: tokens.colors.success,
  },
  warn: {
    color: tokens.colors.warning,
    background: 'var(--ht-warning-bg, #fff7ed)',
    border: 'rgba(245, 158, 11, 0.24)',
    badgeBackground: 'rgba(255, 255, 255, 0.72)',
    badgeColor: tokens.colors.warning,
  },
  bad: {
    color: tokens.colors.error,
    background: 'var(--ht-error-bg)',
    border: 'rgba(239, 68, 68, 0.22)',
    badgeBackground: 'rgba(255, 255, 255, 0.76)',
    badgeColor: tokens.colors.error,
  },
} as const;

const S = {
  shell: {
    ...ui.card.base,
    padding: tokens.spacing.lg,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacing.md,
    background: `linear-gradient(180deg, ${tokens.colors.surface} 0%, rgba(255, 255, 255, 0.92) 100%)`,
  } as any,
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacing.sm,
    minWidth: 0,
  } as any,
  sectionLabel: {
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: tokens.colors.textMuted,
  } as any,
  metricGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))',
    gap: tokens.spacing.sm,
  } as any,
  metricButton: {
    minWidth: 0,
    padding: '12px 14px',
    borderRadius: tokens.radius.lg,
    border: `1px solid ${tokens.colors.border}`,
    background: tokens.colors.surface,
    boxShadow: tokens.shadow.sm,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '8px',
    textAlign: 'left',
    transition: 'all 0.2s ease',
  } as any,
  metricLabelRow: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing.sm,
  } as any,
  metricLabel: {
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: tokens.colors.textMuted,
    lineHeight: 1.3,
  } as any,
  metricValue: {
    fontSize: '24px',
    fontWeight: 900,
    letterSpacing: '-0.04em',
    lineHeight: 1,
    color: tokens.colors.textPrimary,
  } as any,
  metricMeta: {
    fontSize: '12px',
    color: tokens.colors.textSecondary,
    lineHeight: 1.4,
  } as any,
  metricBadge: {
    padding: '5px 8px',
    borderRadius: tokens.radius.md,
    fontSize: '10px',
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    flexShrink: 0,
  } as any,
  presetRail: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
  } as any,
  presetButton: {
    ...ui.btn.outline,
    padding: '8px 12px',
    borderRadius: tokens.radius.xl,
    fontSize: '12px',
    fontWeight: 700,
    minHeight: '34px',
    justifyContent: 'center',
    background: tokens.colors.background,
  } as any,
  emptyText: {
    fontSize: '12px',
    color: tokens.colors.textSecondary,
    padding: '2px 0',
  } as any,
};

function renderMetricCount(metric: CommandMetric) {
  if (metric.value !== String(metric.count)) {
    return `${metric.count} matched`;
  }
  return metric.count === 1 ? '1 matched' : `${metric.count} matched`;
}

export function GanttCommandBar(props: GanttCommandBarProps) {
  const { metrics, presets } = props;

  return (
    <section style={S.shell} aria-label="Gantt command bar">
      <div style={S.section}>
        <div style={S.sectionLabel}>Command Metrics</div>
        {metrics.length > 0 ? (
          <div style={S.metricGrid}>
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
                    background: metric.active ? tone.background : tokens.colors.surface,
                    border: `1px solid ${metric.active ? tone.border : tokens.colors.border}`,
                  }}
                >
                  <div style={S.metricLabelRow}>
                    <span style={S.metricLabel}>{metric.label}</span>
                    <span
                      style={{
                        ...S.metricBadge,
                        background: tone.badgeBackground,
                        color: tone.badgeColor,
                      }}
                    >
                      {metric.tone}
                    </span>
                  </div>
                  <div style={{ ...S.metricValue, color: metric.active ? tone.color : tokens.colors.textPrimary }}>
                    {metric.value}
                  </div>
                  <div style={S.metricMeta}>{renderMetricCount(metric)}</div>
                </button>
              );
            })}
          </div>
        ) : (
          <div style={S.emptyText}>No metrics available.</div>
        )}
      </div>

      <div style={S.section}>
        <div style={S.sectionLabel}>Quick Presets</div>
        {presets.length > 0 ? (
          <div style={S.presetRail}>
            {presets.map((preset) => {
              const isInteractive = typeof preset.onClick === 'function';

              return (
                <button
                  key={preset.key}
                  type="button"
                  onClick={preset.onClick}
                  disabled={!isInteractive}
                  aria-pressed={Boolean(preset.active)}
                  style={{
                    ...S.presetButton,
                    cursor: isInteractive ? 'pointer' : 'default',
                    opacity: !isInteractive && !preset.active ? 0.72 : 1,
                    color: preset.active ? tokens.colors.textOnPrimary : tokens.colors.textSecondary,
                    background: preset.active ? tokens.colors.primary : tokens.colors.background,
                    border: preset.active ? `1px solid ${tokens.colors.primary}` : `1px solid ${tokens.colors.border}`,
                    boxShadow: preset.active ? tokens.shadow.sm : 'none',
                  }}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        ) : (
          <div style={S.emptyText}>No presets available.</div>
        )}
      </div>
    </section>
  );
}
