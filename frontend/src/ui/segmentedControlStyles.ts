import { ui } from './styles';
import { tokens } from './tokens';

export type SegmentedControlSize = 'sm' | 'md';

export function getSegmentedControlMetrics(size: SegmentedControlSize = 'md') {
  if (size === 'sm') {
    return {
      groupPadding: '4px',
      groupGap: '4px',
      itemPadding: '8px 14px',
      fontSize: '12px',
      minHeight: '36px',
      iconSize: 14,
      badgeSize: '18px',
    };
  }

  return {
    groupPadding: '6px',
    groupGap: '6px',
    itemPadding: '10px 18px',
    fontSize: '13px',
    minHeight: '40px',
    iconSize: 16,
    badgeSize: '20px',
  };
}

export function getSegmentedControlItemStyle({
  active,
  size = 'md',
  stretch = false,
  disabled = false,
}: {
  active: boolean;
  size?: SegmentedControlSize;
  stretch?: boolean;
  disabled?: boolean;
}) {
  const metrics = getSegmentedControlMetrics(size);

  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    minHeight: metrics.minHeight,
    padding: metrics.itemPadding,
    borderRadius: tokens.radius.lg,
    border: `1px solid ${active ? tokens.colors.successBorder : 'transparent'}`,
    background: active ? tokens.colors.surfaceSuccessSoft : 'transparent',
    color: active ? tokens.colors.primary : tokens.colors.textSecondary,
    fontSize: metrics.fontSize,
    fontWeight: active ? 800 : 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease',
    boxShadow: active ? tokens.shadow.sm : 'none',
    flex: stretch ? '1 1 0' : '0 0 auto',
    opacity: disabled ? 0.5 : 1,
  } as const;
}

export function getSegmentedControlBadgeStyle(active: boolean) {
  return {
    background: active ? tokens.colors.surface : ui.badge.neutral.background,
    color: active ? tokens.colors.primary : tokens.colors.textSecondary,
  } as const;
}
