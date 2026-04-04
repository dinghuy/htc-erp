import { RiskState, type RiskState as RiskStateValue } from './ganttDerived';

export type GanttSignalTone = 'neutral' | 'info' | 'warning' | 'error' | 'success';

export type GanttSignal = {
  key: string;
  label: string;
  tone: GanttSignalTone;
};

export function formatStatusLabel(status?: string | null) {
  const normalized = (status || '').toLowerCase();
  if (normalized.includes('completed') || normalized.includes('hoan')) return 'Hoàn thành';
  if (normalized.includes('paused') || normalized.includes('tam')) return 'Tạm dừng';
  if (normalized.includes('cancel') || normalized.includes('huy')) return 'Hủy bỏ';
  if (normalized.includes('active') || normalized.includes('dang')) return 'Đang thực hiện';
  if (normalized.includes('pending') || normalized.includes('cho')) return 'Chờ thực hiện';
  return status || 'Unknown';
}

export function formatPriorityLabel(priority?: string | null) {
  const normalized = (priority || '').toLowerCase();
  if (normalized === 'urgent') return 'Khẩn cấp';
  if (normalized === 'high') return 'Cao';
  if (normalized === 'medium') return 'Trung bình';
  if (normalized === 'low') return 'Thấp';
  return priority || '\u2014';
}

export function formatRiskLabel(risk?: RiskStateValue | null) {
  if (risk === RiskState.Critical) return 'Critical';
  if (risk === RiskState.Warning) return 'Warning';
  if (risk === RiskState.Watch) return 'Watch';
  return 'Healthy';
}

export function buildProjectSignals(input: {
  risk?: RiskStateValue | null;
  status?: string | null;
  taskCount: number;
  overdueTaskCount?: number;
}): GanttSignal[] {
  const signals: GanttSignal[] = [];

  if (input.risk && input.risk !== RiskState.Healthy) {
    signals.push({
      key: 'risk',
      label: formatRiskLabel(input.risk),
      tone:
        input.risk === RiskState.Critical
          ? 'error'
          : input.risk === RiskState.Warning
            ? 'warning'
            : 'info',
    });
  }

  if (input.status) {
    signals.push({
      key: 'status',
      label: formatStatusLabel(input.status),
      tone: input.status.toLowerCase().includes('active') || input.status.toLowerCase().includes('dang') ? 'success' : 'neutral',
    });
  }

  if ((input.overdueTaskCount || 0) > 0) {
    signals.push({
      key: 'overdue',
      label: `${input.overdueTaskCount} trễ hạn`,
      tone: 'error',
    });
  } else {
    signals.push({
      key: 'taskCount',
      label: `${input.taskCount} công việc`,
      tone: 'neutral',
    });
  }

  return signals.slice(0, 3);
}

export function buildTaskSignals(input: {
  priority?: string | null;
  status?: string | null;
  overdue?: boolean;
  timelineMissing?: boolean;
}): GanttSignal[] {
  const signals: GanttSignal[] = [];

  if (input.priority) {
    const normalized = input.priority.toLowerCase();
    signals.push({
      key: 'priority',
      label: formatPriorityLabel(input.priority),
      tone: normalized === 'urgent' ? 'error' : normalized === 'high' ? 'warning' : 'neutral',
    });
  }

  if (input.status) {
    signals.push({
      key: 'status',
      label: formatStatusLabel(input.status),
      tone: input.status.toLowerCase().includes('active') || input.status.toLowerCase().includes('dang') ? 'success' : 'neutral',
    });
  }

  if (input.overdue) {
    signals.push({
      key: 'overdue',
      label: 'Trễ hạn',
      tone: 'error',
    });
  } else if (input.timelineMissing) {
    signals.push({
      key: 'timelineMissing',
      label: 'Thiếu timeline',
      tone: 'warning',
    });
  }

  return signals.slice(0, 3);
}
