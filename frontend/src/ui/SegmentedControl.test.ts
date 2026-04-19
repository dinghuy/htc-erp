import { describe, expect, it } from 'vitest';

import { getSegmentedControlBadgeStyle, getSegmentedControlItemStyle, getSegmentedControlMetrics } from './segmentedControlStyles';

describe('SegmentedControl helpers', () => {
  it('returns compact metrics for small controls', () => {
    expect(getSegmentedControlMetrics('sm')).toMatchObject({
      groupPadding: '4px',
      minHeight: '36px',
      fontSize: '12px',
    });
  });

  it('styles the active item as an elevated success-toned pill', () => {
    expect(getSegmentedControlItemStyle({ active: true, size: 'md' })).toMatchObject({
      background: 'var(--ht-surface-success-soft)',
      color: 'var(--ht-green)',
      boxShadow: 'var(--shadow-sm)',
      fontWeight: 800,
    });
  });

  it('styles the inactive item as a neutral transparent pill', () => {
    expect(getSegmentedControlItemStyle({ active: false, size: 'md', stretch: true })).toMatchObject({
      background: 'transparent',
      color: 'var(--text-secondary)',
      flex: '1 1 0',
      fontWeight: 700,
    });
  });

  it('uses a calmer badge treatment for inactive pills', () => {
    expect(getSegmentedControlBadgeStyle(false)).toMatchObject({
      background: 'var(--ht-surface-subtle)',
      color: 'var(--text-secondary)',
    });
  });
});
