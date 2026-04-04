import { describe, expect, it } from 'vitest';

import {
  buildTimelineWindowRange,
  createTimelineWindowDays,
  isRangeOverlappingTimelineWindow,
} from '../ganttUtils';

const MARCH_2026 = new Date('2026-03-01T00:00:00');

describe('ganttUtils timeline window', () => {
  it('builds a continuous 3-month day window around the center month', () => {
    const days = createTimelineWindowDays(MARCH_2026);

    expect(days).toHaveLength(89);
    expect(days[0]).toMatchObject({
      dayNumber: 1,
      monthKey: '2026-02',
      isMonthStart: true,
      isCenterMonth: false,
    });
    expect(days[28]).toMatchObject({
      dayNumber: 1,
      monthKey: '2026-03',
      isMonthStart: true,
      isCenterMonth: true,
    });
    expect(days[59]).toMatchObject({
      dayNumber: 1,
      monthKey: '2026-04',
      isMonthStart: true,
      isCenterMonth: false,
    });
  });

  it('detects overlap anywhere inside the 3-month window', () => {
    expect(isRangeOverlappingTimelineWindow('2026-02-10', '2026-02-15', MARCH_2026)).toBe(true);
    expect(isRangeOverlappingTimelineWindow('2026-04-20', '2026-04-25', MARCH_2026)).toBe(true);
    expect(isRangeOverlappingTimelineWindow('2026-05-01', '2026-05-03', MARCH_2026)).toBe(false);
  });

  it('clips ranges against the full timeline window rather than only the center month', () => {
    expect(buildTimelineWindowRange('2026-02-25', '2026-04-03', MARCH_2026)).toEqual({
      startIndex: 24,
      endIndex: 61,
      span: 38,
    });
  });
});
