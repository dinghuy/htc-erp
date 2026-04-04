import { describe, expect, it } from 'vitest';

import { RiskState } from '../ganttDerived';
import { buildProjectSignals, buildTaskSignals } from '../ganttPresentation';

describe('ganttPresentation', () => {
  it('keeps project signals focused on risk, status, and the highest-value summary badge', () => {
    expect(
      buildProjectSignals({
        risk: RiskState.Critical,
        status: 'active',
        taskCount: 7,
        overdueTaskCount: 2,
      }),
    ).toEqual([
      expect.objectContaining({ key: 'risk', label: 'Critical' }),
      expect.objectContaining({ key: 'status', label: 'Đang thực hiện' }),
      expect.objectContaining({ key: 'overdue', label: '2 trễ hạn' }),
    ]);
  });

  it('keeps project rows calm when nothing exceptional is happening', () => {
    expect(
      buildProjectSignals({
        risk: RiskState.Healthy,
        status: 'active',
        taskCount: 3,
        overdueTaskCount: 0,
      }),
    ).toEqual([
      expect.objectContaining({ key: 'status', label: 'Đang thực hiện' }),
      expect.objectContaining({ key: 'taskCount', label: '3 công việc' }),
    ]);
  });

  it('prioritizes task priority, status, and exceptional state over extra badges', () => {
    expect(
      buildTaskSignals({
        priority: 'urgent',
        status: 'active',
        overdue: true,
        timelineMissing: true,
      }),
    ).toEqual([
      expect.objectContaining({ key: 'priority', label: 'Khẩn cấp' }),
      expect.objectContaining({ key: 'status', label: 'Đang thực hiện' }),
      expect.objectContaining({ key: 'overdue', label: 'Trễ hạn' }),
    ]);
  });

  it('uses timeline-missing as the fallback exceptional badge when the task is not overdue', () => {
    expect(
      buildTaskSignals({
        priority: 'medium',
        status: 'paused',
        overdue: false,
        timelineMissing: true,
      }),
    ).toEqual([
      expect.objectContaining({ key: 'priority', label: 'Trung bình' }),
      expect.objectContaining({ key: 'status', label: 'Tạm dừng' }),
      expect.objectContaining({ key: 'timelineMissing', label: 'Thiếu timeline' }),
    ]);
  });
});
