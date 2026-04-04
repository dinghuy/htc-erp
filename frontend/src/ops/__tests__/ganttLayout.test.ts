import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Gantt layout source contract', () => {
  it('uses segmented controls for the primary lens and preset scope rows', () => {
    const source = readFileSync(path.resolve(__dirname, '../GanttView.tsx'), 'utf8');

    expect(source).toContain("import { SegmentedControl } from '../ui/SegmentedControl';");
    expect(source).toContain('ariaLabel="Gantt lens"');
    expect(source).toContain('ariaLabel="Preset pham vi gantt"');
    expect(source).toContain('createTimelineWindowDays');
  });

  it('keeps command metrics separate from quick presets', () => {
    const source = readFileSync(path.resolve(__dirname, '../GanttCommandBar.tsx'), 'utf8');

    expect(source).toContain('Can xu ly ngay');
    expect(source).not.toContain('Quick Presets');
  });

  it('supports drag-to-pan on the timeline container', () => {
    const source = readFileSync(path.resolve(__dirname, '../GanttView.tsx'), 'utf8');

    expect(source).toContain('onPointerDown={handleTimelinePointerDown}');
    expect(source).toContain("cursor: timelineDragging ? 'grabbing' : 'grab'");
    expect(source).toContain('suppressClicksUntilRef={suppressRowClickUntilRef}');
  });

  it('keeps the left project rail frozen while the timeline scrolls horizontally', () => {
    const source = readFileSync(path.resolve(__dirname, '../GanttView.tsx'), 'utf8');

    expect(source).toContain("position: 'sticky'");
    expect(source).toContain('left: 0');
    expect(source).toContain('stickyLeftPaneStyle(');
  });
});
