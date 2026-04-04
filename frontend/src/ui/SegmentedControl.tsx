import type { ComponentChildren } from 'preact';

import { tokens } from './tokens';
import {
  getSegmentedControlBadgeStyle,
  getSegmentedControlItemStyle,
  getSegmentedControlMetrics,
  type SegmentedControlSize,
} from './segmentedControlStyles';

export type SegmentedControlOption<T extends string> = {
  value: T;
  label: string;
  icon?: ComponentChildren;
  badge?: string | number | null;
  disabled?: boolean;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = 'md',
  stretch = false,
  wrap = false,
  style,
}: {
  options: Array<SegmentedControlOption<T>>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
  size?: SegmentedControlSize;
  stretch?: boolean;
  wrap?: boolean;
  style?: any;
}) {
  const metrics = getSegmentedControlMetrics(size);

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: metrics.groupGap,
        padding: metrics.groupPadding,
        borderRadius: tokens.radius.xl,
        border: `1px solid ${tokens.colors.border}`,
        background: tokens.colors.background,
        width: stretch ? '100%' : 'fit-content',
        maxWidth: '100%',
        overflowX: 'auto',
        flexWrap: wrap ? 'wrap' : 'nowrap',
        WebkitOverflowScrolling: 'touch',
        ...style,
      }}
    >
      {options.map((option) => {
        const active = option.value === value;
        const buttonStyle = getSegmentedControlItemStyle({
          active,
          size,
          stretch,
          disabled: option.disabled,
        });

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            disabled={option.disabled}
            onClick={() => {
              if (!option.disabled) onChange(option.value);
            }}
            style={buttonStyle}
          >
            {option.icon ? <span style={{ display: 'inline-flex', alignItems: 'center' }}>{option.icon}</span> : null}
            <span>{option.label}</span>
            {option.badge !== undefined && option.badge !== null ? (
              <span
                style={{
                  minWidth: metrics.badgeSize,
                  height: metrics.badgeSize,
                  padding: '0 6px',
                  borderRadius: '999px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 800,
                  ...getSegmentedControlBadgeStyle(active),
                }}
              >
                {option.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
