import { useEffect, useMemo, useState } from 'preact/hooks';
import { API_BASE } from '../config';
import { fetchWithAuth } from '../auth';
import { tokens } from '../ui/tokens';
import { ui } from '../ui/styles';
import {
  addMonths,
  createMonthDays,
  formatMonthLabel,
  formatShortDate,
  normalizeSearch,
  type GanttProject,
  type GanttTask,
  type MonthDay,
} from './ganttUtils';
import {
  buildGanttDerivedState,
  buildLensGroups,
  RiskState,
  type DerivedProjectRow,
  type DerivedTaskRow,
  type GanttLensKey,
  type GanttPresetKey,
} from './ganttDerived';
import { GanttCommandBar } from './GanttCommandBar';

type GanttViewProps = {
  token: string;
  currentUser?: {
    fullName?: string;
    username?: string;
    systemRole?: string;
  } | null;
  onOpenProject?: (projectId: string) => void;
  onOpenTask?: (taskId: string) => void;
};

const API = API_BASE;
const TRACK_HEIGHT = 34;
const ROW_HEIGHT = 64;
const PROJECT_ROW_HEIGHT = 72;
const LEFT_COLUMN_WIDTH = 340;
const DAY_COLUMN_WIDTH = 52;
const TIMELINE_WIDTH_MIN = 860;

const S = {
  card: ui.card.base as any,
  btnPrimary: { ...ui.btn.primary, justifyContent: 'center' } as any,
  btnOutline: { ...ui.btn.outline, justifyContent: 'center' } as any,
  select: { ...ui.input.base, minWidth: '180px', width: 'auto', paddingRight: '40px' } as any,
  input: { ...ui.input.base, transition: 'all 0.2s ease' } as any,
  pill: {
    padding: '5px 10px',
    borderRadius: tokens.radius.md,
    fontSize: '11px',
    fontWeight: 800,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  } as any,
};

function statusChipStyle(status?: string | null) {
  const normalized = (status || '').toLowerCase();
  const base = { ...S.pill };
  if (normalized.includes('completed') || normalized.includes('hoan')) {
    return { ...base, ...ui.badge.success };
  }
  if (normalized.includes('paused') || normalized.includes('tam')) {
    return { ...base, ...ui.badge.warning };
  }
  if (normalized.includes('cancel') || normalized.includes('huy')) {
    return { ...base, ...ui.badge.error };
  }
  if (normalized.includes('active') || normalized.includes('dang')) {
    return { ...base, ...ui.badge.info };
  }
  return { ...base, ...ui.badge.neutral };
}

function priorityChipStyle(priority?: string | null) {
  const normalized = (priority || '').toLowerCase();
  const base = { ...S.pill };
  if (normalized === 'urgent') return { ...base, ...ui.badge.error };
  if (normalized === 'high') return { ...base, background: '#fff3e0', color: '#e65100' };
  if (normalized === 'medium') return { ...base, ...ui.badge.info };
  if (normalized === 'low') return { ...base, ...ui.badge.neutral };
  return { ...base, ...ui.badge.neutral };
}

function formatStatusLabel(status?: string | null) {
  const normalized = (status || '').toLowerCase();
  if (normalized.includes('completed') || normalized.includes('hoan')) return 'Hoan thanh';
  if (normalized.includes('paused') || normalized.includes('tam')) return 'Tam dung';
  if (normalized.includes('cancel') || normalized.includes('huy')) return 'Huy bo';
  if (normalized.includes('active') || normalized.includes('dang')) return 'Dang thuc hien';
  if (normalized.includes('pending') || normalized.includes('cho')) return 'Cho thuc hien';
  return status || 'Unknown';
}

function formatPriorityLabel(priority?: string | null) {
  const normalized = (priority || '').toLowerCase();
  if (normalized === 'urgent') return 'Khẩn cấp';
  if (normalized === 'high') return 'Cao';
  if (normalized === 'medium') return 'Trung bình';
  if (normalized === 'low') return 'Thấp';
  return priority || '—';
}

function riskChipStyle(risk?: RiskState) {
  const base = { ...S.pill };
  if (risk === RiskState.Critical) return { ...base, ...ui.badge.error };
  if (risk === RiskState.Warning) return { ...base, background: '#fff7ed', color: '#c2410c' };
  if (risk === RiskState.Watch) return { ...base, ...ui.badge.info };
  return { ...base, ...ui.badge.neutral };
}

function formatRiskLabel(risk?: RiskState) {
  if (risk === RiskState.Critical) return 'Critical';
  if (risk === RiskState.Warning) return 'Warning';
  if (risk === RiskState.Watch) return 'Watch';
  return 'Healthy';
}

function buildRiskBarBackground(risk?: RiskState, isProject = false) {
  if (risk === RiskState.Critical) {
    return isProject
      ? 'linear-gradient(90deg, rgba(239,68,68,0.88), rgba(220,38,38,0.96))'
      : 'linear-gradient(90deg, rgba(239,68,68,0.92), rgba(220,38,38,0.98))';
  }
  if (risk === RiskState.Warning) {
    return isProject
      ? 'linear-gradient(90deg, rgba(245,158,11,0.88), rgba(217,119,6,0.95))'
      : 'linear-gradient(90deg, rgba(249,115,22,0.9), rgba(234,88,12,0.96))';
  }
  if (risk === RiskState.Watch) {
    return isProject
      ? 'linear-gradient(90deg, rgba(14,165,233,0.86), rgba(2,132,199,0.93))'
      : 'linear-gradient(90deg, rgba(59,130,246,0.9), rgba(37,99,235,0.96))';
  }
  return isProject
    ? 'linear-gradient(90deg, rgba(16,185,129,0.88), rgba(5,150,105,0.95))'
    : 'linear-gradient(90deg, rgba(34,197,94,0.9), rgba(22,163,74,0.95))';
}

const PRESET_OPTIONS: Array<{ key: GanttPresetKey; label: string }> = [
  { key: 'all', label: 'Tất cả' },
  { key: 'overdue', label: 'Trễ hạn' },
  { key: 'dueSoon', label: 'Sắp đến hạn' },
  { key: 'riskOnly', label: 'Risk only' },
  { key: 'overloadedOwners', label: 'Owner quá tải' },
  { key: 'urgentHigh', label: 'Urgent / High' },
  { key: 'missingTimeline', label: 'Thiếu timeline' },
];

const LENS_OPTIONS: Array<{ key: GanttLensKey; label: string }> = [
  { key: 'project', label: 'Project' },
  { key: 'owner', label: 'Owner' },
  { key: 'priority', label: 'Priority' },
];

const SAVED_VIEWS = [
  { key: 'ops-default', label: 'Ops mặc định' },
  { key: 'owner-focus', label: 'Theo owner' },
  { key: 'urgent-queue', label: 'Urgent / High' },
  { key: 'overdue-projects', label: 'Task trễ' },
] as const;

function buildWeekHeader(days: MonthDay[]) {
  return days.map(day => (
    <div
      key={day.key}
      style={{
        minWidth: `${DAY_COLUMN_WIDTH}px`,
        width: `${DAY_COLUMN_WIDTH}px`,
        textAlign: 'center',
        padding: '10px 4px 12px',
        borderLeft: `1px solid ${tokens.colors.border}`,
        background: day.isToday ? 'rgba(16, 185, 129, 0.08)' : tokens.colors.background,
      }}
    >
      <div style={{ fontSize: '10px', fontWeight: 800, color: tokens.colors.textMuted }}>{day.weekdayLabel}</div>
      <div style={{ fontSize: '13px', fontWeight: 700, color: day.isWeekend ? tokens.colors.warning : tokens.colors.textPrimary }}>{day.dayNumber}</div>
    </div>
  ));
}

function GanttRow({
  label,
  subtitle,
  status,
  risk,
  progress,
  taskCount,
  priority,
  barStyle,
  barLabel,
  onClick,
  isProject = false,
  overdue = false,
  timelineMissing = false,
  expanded,
  onToggle,
  canToggle = false,
}: {
  label: string;
  subtitle?: string;
  status?: string | null;
  risk?: RiskState | null;
  progress?: number;
  taskCount?: number;
  priority?: string | null;
  barStyle?: any;
  barLabel?: string;
  onClick?: () => void;
  isProject?: boolean;
  overdue?: boolean;
  timelineMissing?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  canToggle?: boolean;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `${LEFT_COLUMN_WIDTH}px minmax(${TIMELINE_WIDTH_MIN}px, 1fr)`,
        minHeight: `${isProject ? PROJECT_ROW_HEIGHT : ROW_HEIGHT}px`,
        borderBottom: `1px solid ${tokens.colors.border}`,
        background: overdue ? 'rgba(239, 68, 68, 0.03)' : tokens.colors.surface,
      }}
    >
      <div
        style={{
          padding: '14px 16px',
          borderRight: `1px solid ${tokens.colors.border}`,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '8px',
          cursor: onClick ? 'pointer' : 'default',
        }}
        onClick={onClick}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          {canToggle && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onToggle?.();
              }}
              aria-label={expanded ? 'Collapse project' : 'Expand project'}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                border: `1px solid ${tokens.colors.border}`,
                background: tokens.colors.background,
                cursor: 'pointer',
                color: tokens.colors.textSecondary,
                flexShrink: 0,
              }}
            >
              {expanded ? '−' : '+'}
            </button>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: isProject ? '15px' : '14px', fontWeight: 800, color: tokens.colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
            {subtitle && (
              <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
                {subtitle}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          {risk ? <span style={riskChipStyle(risk)}>{formatRiskLabel(risk)}</span> : null}
          {status && <span style={statusChipStyle(status)}>{formatStatusLabel(status)}</span>}
          {priority && <span style={priorityChipStyle(priority)}>{formatPriorityLabel(priority)}</span>}
          {typeof progress === 'number' && <span style={{ ...S.pill, ...ui.badge.neutral }}>{progress}%</span>}
          {typeof taskCount === 'number' && <span style={{ ...S.pill, ...ui.badge.neutral }}>{taskCount} công việc</span>}
          {overdue && <span style={{ ...S.pill, ...ui.badge.error }}>Trễ hạn</span>}
          {timelineMissing && <span style={{ ...S.pill, ...ui.badge.warning }}>Thiếu timeline</span>}
        </div>
      </div>
      <div
        style={{
          position: 'relative',
          minHeight: `${isProject ? PROJECT_ROW_HEIGHT : ROW_HEIGHT}px`,
          backgroundImage: `linear-gradient(to right, ${tokens.colors.border} 1px, transparent 1px)`,
          backgroundSize: `${DAY_COLUMN_WIDTH}px 100%`,
        }}
      >
        <div style={{ position: 'relative', height: '100%', minHeight: `${isProject ? PROJECT_ROW_HEIGHT : ROW_HEIGHT}px` }}>
          <div style={{ position: 'absolute', inset: '50% 0 auto 0', height: `${TRACK_HEIGHT}px`, transform: 'translateY(-50%)', padding: '0 6px' }}>
            {barStyle && (
              <div
                style={{
                  ...barStyle,
                  height: `${isProject ? 24 : 20}px`,
                  top: `${isProject ? 7 : 8}px`,
                  position: 'absolute',
                  borderRadius: '999px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  padding: '0 10px',
                  boxSizing: 'border-box',
                  boxShadow: '0 8px 20px rgba(15, 23, 42, 0.08)',
                  overflow: 'hidden',
                }}
              >
                <span style={{ fontSize: '11px', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{barLabel}</span>
              </div>
            )}
            {!barStyle && timelineMissing && (
              <div
                style={{
                  position: 'absolute',
                  left: '12px',
                  right: '12px',
                  top: `${isProject ? 7 : 8}px`,
                  height: `${isProject ? 24 : 20}px`,
                  borderRadius: '999px',
                  border: `1px dashed ${tokens.colors.warning}`,
                  background: 'rgba(245, 158, 11, 0.08)',
                  color: tokens.colors.warning,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 800,
                }}
              >
                Thiếu timeline
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function GanttView({ token, currentUser, onOpenProject, onOpenTask }: GanttViewProps) {
  const [projects, setProjects] = useState<GanttProject[]>([]);
  const [tasks, setTasks] = useState<GanttTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMonth, setViewMonth] = useState(() => new Date());
  const [activePreset, setActivePreset] = useState<GanttPresetKey>('all');
  const [selectedLens, setSelectedLens] = useState<GanttLensKey>('project');
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('');
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<string> | undefined>(undefined);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [projectsRes, tasksRes] = await Promise.all([
          fetchWithAuth(token, `${API}/projects`),
          fetchWithAuth(token, `${API}/tasks`),
        ]);

        if (!projectsRes.ok) throw new Error(`Không thể tải danh sách dự án (${projectsRes.status})`);
        if (!tasksRes.ok) throw new Error(`Không thể tải danh sách công việc (${tasksRes.status})`);

        const [projectsData, tasksData] = await Promise.all([
          projectsRes.json(),
          tasksRes.json(),
        ]);

        if (cancelled) return;
        setProjects(Array.isArray(projectsData) ? projectsData : []);
        setTasks(Array.isArray(tasksData) ? tasksData : []);
      } catch (loadError: any) {
        if (!cancelled) {
          setError(loadError?.message || 'Không thể tải dữ liệu Gantt');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void loadData();
    return () => {
      cancelled = true;
    };
  }, [token, refreshTick]);

  const monthDays = useMemo(() => createMonthDays(viewMonth), [viewMonth]);
  const query = useMemo(() => normalizeSearch(searchQuery), [searchQuery]);
  const derived = useMemo(
    () =>
      buildGanttDerivedState({
        projects,
        tasks,
        selectedMonth: viewMonth,
        today: new Date(),
        searchQuery: query,
        selectedPresetKey: activePreset,
        selectedAssignee,
        selectedPriority,
        manualExpandedProjectIds: expandedProjectIds,
      }),
    [projects, tasks, viewMonth, query, activePreset, selectedAssignee, selectedPriority, expandedProjectIds],
  );

  const visibleProjectRows = useMemo(
    () => derived.visibleRows.filter((row): row is DerivedProjectRow => row.kind === 'project'),
    [derived.visibleRows],
  );
  const visibleTaskRows = useMemo(
    () => derived.visibleRows.filter((row): row is DerivedTaskRow => row.kind === 'task'),
    [derived.visibleRows],
  );
  const lensGroups = useMemo(
    () => (selectedLens === 'project' ? [] : buildLensGroups(visibleTaskRows, selectedLens)),
    [selectedLens, visibleTaskRows],
  );
  const visibleProjectIds = useMemo(
    () => visibleProjectRows.map(row => row.id),
    [visibleProjectRows],
  );
  const assigneeOptions = useMemo(
    () =>
      Array.from(
        new Set(
          tasks
            .map(task => task.assigneeName?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [tasks],
  );
  const priorityOptions = useMemo(
    () =>
      Array.from(
        new Set(
          tasks
            .map(task => task.priority?.trim().toLowerCase())
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((left, right) => {
        const rank = { urgent: 0, high: 1, medium: 2, low: 3 } as Record<string, number>;
        return (rank[left] ?? 99) - (rank[right] ?? 99) || left.localeCompare(right);
      }),
    [tasks],
  );
  const effectiveExpandedProjectIds = derived.effectiveAutoExpandedProjectIds;

  const visibleStats = useMemo(() => {
    const metricMap = new Map(derived.commandMetrics.map(metric => [metric.key, metric]));
    return {
      projects: visibleProjectRows.length,
      tasks: visibleTaskRows.length,
      overdueTasks: metricMap.get('overdue')?.count ?? 0,
      dueSoonTasks: metricMap.get('dueSoon')?.count ?? 0,
      overloadedOwners: metricMap.get('overloadedOwners')?.count ?? 0,
      avgProgress: metricMap.get('avgProgress')?.count ?? 0,
    };
  }, [derived.commandMetrics, visibleProjectRows.length, visibleTaskRows.length]);

  const metricActions = useMemo(
    () =>
      derived.commandMetrics.map(metric => ({
        ...metric,
        active:
          (metric.key === 'overdue' && activePreset === 'overdue') ||
          (metric.key === 'dueSoon' && activePreset === 'dueSoon') ||
          (metric.key === 'overloadedOwners' && activePreset === 'overloadedOwners'),
        onClick:
          metric.key === 'avgProgress'
            ? undefined
            : () => {
                const nextPreset: Record<string, GanttPresetKey> = {
                  overdue: 'overdue',
                  dueSoon: 'dueSoon',
                  overloadedOwners: 'overloadedOwners',
                };
                setActivePreset(nextPreset[metric.key] || 'all');
                setExpandedProjectIds(undefined);
              },
      })),
    [activePreset, derived.commandMetrics],
  );

  const presetActions = useMemo(
    () =>
      PRESET_OPTIONS.map(option => ({
        key: option.key,
        label: option.label,
        active: activePreset === option.key,
        onClick: () => {
          setActivePreset(option.key);
          setExpandedProjectIds(undefined);
        },
      })),
    [activePreset],
  );

  const applySavedView = (key: (typeof SAVED_VIEWS)[number]['key']) => {
    setExpandedProjectIds(undefined);

    if (key === 'ops-default') {
      setSelectedLens('project');
      setActivePreset('all');
      setSelectedAssignee('');
      setSelectedPriority('');
      setSearchQuery('');
      return;
    }

    if (key === 'owner-focus') {
      setSelectedLens('owner');
      setActivePreset('overloadedOwners');
      setSelectedPriority('');
      return;
    }

    if (key === 'urgent-queue') {
      setSelectedLens('priority');
      setActivePreset('urgentHigh');
      setSelectedPriority('');
      return;
    }

    if (key === 'overdue-projects') {
      setSelectedLens('project');
      setActivePreset('overdue');
    }
  };

  const toggleProject = (projectId: string) => {
    setExpandedProjectIds(prev => {
      const next = new Set(prev ?? effectiveExpandedProjectIds);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  const expandAll = () => setExpandedProjectIds(new Set(visibleProjectIds));
  const collapseAll = () => setExpandedProjectIds(new Set());

  const renderProjectRows = () => {
    const rows: any[] = [];
    let currentProjectId: string | null = null;
    let currentProjectExpanded = false;
    let currentProjectVisibleTaskCount = 0;

    for (const row of derived.visibleRows) {
      if (row.kind === 'project') {
        currentProjectId = row.id;
        currentProjectExpanded = query ? true : effectiveExpandedProjectIds.has(row.id);
        currentProjectVisibleTaskCount = row.visibleTaskCount;

        const projectBarStyle = row.timelineRange
          ? {
              left: `${(row.timelineRange.startIndex / monthDays.length) * 100}%`,
              width: `${(row.timelineRange.span / monthDays.length) * 100}%`,
              background: buildRiskBarBackground(row.risk || undefined, true),
            }
          : undefined;

        rows.push(
          <GanttRow
            key={`project-${row.id}`}
            label={row.label}
            subtitle={row.subtitle}
            status={row.status}
            risk={row.risk}
            progress={row.progress}
            taskCount={row.taskCount}
            barStyle={projectBarStyle}
            barLabel={row.risk ? formatRiskLabel(row.risk) : row.status || 'Project'}
            onClick={() => onOpenProject?.(row.id)}
            isProject
            expanded={currentProjectExpanded}
            canToggle={true}
            onToggle={() => toggleProject(row.id)}
          />,
        );

        if (currentProjectExpanded && currentProjectVisibleTaskCount === 0) {
          rows.push(
            <div
              key={`project-empty-${row.id}`}
              style={{
                display: 'grid',
                gridTemplateColumns: `${LEFT_COLUMN_WIDTH}px minmax(${TIMELINE_WIDTH_MIN}px, 1fr)`,
                borderBottom: `1px solid ${tokens.colors.border}`,
                background: 'rgba(248, 250, 252, 0.9)',
                minHeight: '52px',
              }}
            >
              <div style={{ padding: '12px 16px', borderRight: `1px solid ${tokens.colors.border}`, color: tokens.colors.textMuted, fontSize: '12px' }}>
                {activePreset === 'all' && !query
                  ? 'Không có công việc nào trong tháng này'
                  : 'Không có công việc nào khớp bộ lọc hiện tại'}
              </div>
              <div style={{ position: 'relative', backgroundImage: `linear-gradient(to right, ${tokens.colors.border} 1px, transparent 1px)`, backgroundSize: `${DAY_COLUMN_WIDTH}px 100%` }} />
            </div>,
          );
        }

        continue;
      }

      if (!currentProjectId || !currentProjectExpanded || row.projectId !== currentProjectId) {
        continue;
      }

      const taskSubtitle = [
        row.subtitle,
        `${formatShortDate(row.startDate)} - ${formatShortDate(row.dueDate)}`,
      ]
        .filter(Boolean)
        .join(' · ');

      const taskBarStyle = row.timelineRange
        ? {
            left: `${(row.timelineRange.startIndex / monthDays.length) * 100}%`,
            width: `${(row.timelineRange.span / monthDays.length) * 100}%`,
            background: buildRiskBarBackground(row.risk, false),
          }
        : undefined;

      rows.push(
        <GanttRow
          key={`task-${row.id}`}
          label={row.label}
          subtitle={taskSubtitle}
          status={row.status}
          priority={row.priority}
          risk={row.risk}
          progress={row.progress}
          barStyle={taskBarStyle}
          barLabel={row.timelineMissing ? 'Thiếu timeline' : row.priority || row.status || 'Task'}
          onClick={() => onOpenTask?.(row.id)}
          overdue={row.overdue}
          timelineMissing={row.timelineMissing}
        />,
      );
    }

    return rows;
  };

  const renderLensRows = () => {
    return lensGroups.flatMap(group => {
      const groupRows: any[] = [
        <div
          key={`lens-group-${group.lens}-${group.key}`}
          style={{
            display: 'grid',
            gridTemplateColumns: `${LEFT_COLUMN_WIDTH}px minmax(${TIMELINE_WIDTH_MIN}px, 1fr)`,
            minHeight: '60px',
            borderBottom: `1px solid ${tokens.colors.border}`,
            background:
              group.risk === RiskState.Critical
                ? 'rgba(239, 68, 68, 0.05)'
                : group.risk === RiskState.Warning
                  ? 'rgba(249, 115, 22, 0.05)'
                  : 'rgba(248, 250, 252, 0.96)',
          }}
        >
          <div
            style={{
              padding: '14px 16px',
              borderRight: `1px solid ${tokens.colors.border}`,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <div style={{ fontSize: '14px', fontWeight: 900, color: tokens.colors.textPrimary }}>{group.label}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
              {group.risk ? <span style={riskChipStyle(group.risk)}>{formatRiskLabel(group.risk)}</span> : null}
              <span style={{ ...S.pill, ...ui.badge.neutral }}>{group.taskCount} công việc</span>
              {group.overdueCount > 0 ? <span style={{ ...S.pill, ...ui.badge.error }}>{group.overdueCount} trễ hạn</span> : null}
              {group.overloaded ? <span style={{ ...S.pill, ...ui.badge.warning }}>Quá tải</span> : null}
            </div>
          </div>
          <div
            style={{
              padding: '0 16px',
              display: 'flex',
              alignItems: 'center',
              color: tokens.colors.textMuted,
              fontSize: '12px',
              backgroundImage: `linear-gradient(to right, ${tokens.colors.border} 1px, transparent 1px)`,
              backgroundSize: `${DAY_COLUMN_WIDTH}px 100%`,
            }}
          >
            {group.lens === 'owner' ? 'Nhóm theo assignee để rà tải và rủi ro tập trung' : 'Nhóm theo mức ưu tiên để triage nhanh'}
          </div>
        </div>,
      ];

      for (const row of group.tasks) {
        const taskSubtitle = [
          row.subtitle,
          `${formatShortDate(row.startDate)} - ${formatShortDate(row.dueDate)}`,
        ]
          .filter(Boolean)
          .join(' · ');

        const taskBarStyle = row.timelineRange
          ? {
              left: `${(row.timelineRange.startIndex / monthDays.length) * 100}%`,
              width: `${(row.timelineRange.span / monthDays.length) * 100}%`,
              background: buildRiskBarBackground(row.risk, false),
            }
          : undefined;

        groupRows.push(
          <GanttRow
            key={`lens-task-${group.key}-${row.id}`}
            label={row.label}
            subtitle={taskSubtitle}
            status={row.status}
            priority={row.priority}
            risk={row.risk}
            progress={row.progress}
            barStyle={taskBarStyle}
            barLabel={row.timelineMissing ? 'Thiếu timeline' : row.assigneeName || row.priority || row.status || 'Task'}
            onClick={() => onOpenTask?.(row.id)}
            overdue={row.overdue}
            timelineMissing={row.timelineMissing}
          />,
        );
      }

      return groupRows;
    });
  };

  const hasResults = selectedLens === 'project' ? visibleProjectRows.length > 0 : lensGroups.length > 0;
  const currentUserLabel = currentUser?.fullName || currentUser?.username || 'Current user';

  return (
    <div style={{ padding: '24px', maxWidth: '1600px', margin: '0 auto' }}>
      <div
        style={{
          ...S.card,
          overflow: 'hidden',
          background: `linear-gradient(135deg, rgba(16,185,129,0.08), rgba(59,130,246,0.05))`,
        }}
      >
        <div style={{ padding: '24px 24px 18px', borderBottom: `1px solid ${tokens.colors.border}` }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.08em', color: tokens.colors.textMuted, textTransform: 'uppercase' }}>
                Vận hành
              </div>
              <h2 style={{ margin: '8px 0 6px', fontSize: '28px', lineHeight: 1.1, color: tokens.colors.textPrimary }}>
                Tiến độ Gantt
              </h2>
              <div style={{ fontSize: '14px', color: tokens.colors.textSecondary, maxWidth: '860px' }}>
                Theo dõi tiến độ dự án và công việc theo dòng thời gian. Tìm kiếm nhanh, mở rộng hạng mục và rà soát khối lượng theo từng tháng cùng cảnh báo trễ hạn.
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
              <span style={{ ...S.pill, ...ui.badge.neutral }}>Người xem: {currentUserLabel}</span>
              <button type="button" onClick={() => setRefreshTick(tick => tick + 1)} style={S.btnOutline}>
                Làm mới
              </button>
              <button type="button" onClick={expandAll} style={S.btnOutline} disabled={selectedLens !== 'project'}>
                Mở rộng tất cả
              </button>
              <button type="button" onClick={collapseAll} style={S.btnOutline} disabled={selectedLens !== 'project'}>
                Thu gọn tất cả
              </button>
            </div>
          </div>
        </div>

        <div style={{ padding: '18px 24px 24px', display: 'grid', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto auto', gap: '12px', alignItems: 'center' }}>
            <div style={{ minWidth: 0 }}>
              <input
                type="search"
                value={searchQuery}
                onInput={(event: any) => {
                  setSearchQuery(event.target.value);
                  setExpandedProjectIds(undefined);
                }}
                placeholder="Tìm dự án, công việc, người phụ trách, khách hàng..."
                style={S.input}
              />
            </div>
            <button type="button" onClick={() => {
              setViewMonth(date => addMonths(date, -1));
              setExpandedProjectIds(undefined);
            }} style={S.btnOutline}>
              Tháng trước
            </button>
            <button type="button" onClick={() => {
              setViewMonth(new Date());
              setExpandedProjectIds(undefined);
            }} style={S.btnPrimary}>
              Hôm nay
            </button>
            <button type="button" onClick={() => {
              setViewMonth(date => addMonths(date, 1));
              setExpandedProjectIds(undefined);
            }} style={S.btnOutline}>
              Tháng sau
            </button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
            <select
              value={selectedAssignee}
              onChange={(event: any) => {
                setSelectedAssignee(event.target.value);
                setExpandedProjectIds(undefined);
              }}
              style={S.select}
            >
              <option value="">Tất cả assignee</option>
              {assigneeOptions.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>

            <select
              value={selectedPriority}
              onChange={(event: any) => {
                setSelectedPriority(event.target.value);
                setExpandedProjectIds(undefined);
              }}
              style={S.select}
            >
              <option value="">Tất cả ưu tiên</option>
              {priorityOptions.map(option => (
                <option key={option} value={option}>
                  {formatPriorityLabel(option)}
                </option>
              ))}
            </select>

            {(selectedAssignee || selectedPriority) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedAssignee('');
                  setSelectedPriority('');
                  setExpandedProjectIds(undefined);
                }}
                style={S.btnOutline}
              >
                Xóa filter
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            <span style={{ ...S.pill, ...ui.badge.neutral }}>Lens</span>
            {LENS_OPTIONS.map(option => (
              <button
                key={option.key}
                type="button"
                onClick={() => {
                  setSelectedLens(option.key);
                  setExpandedProjectIds(undefined);
                }}
                style={option.key === selectedLens ? S.btnPrimary : S.btnOutline}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            <span style={{ ...S.pill, ...ui.badge.neutral }}>Saved views</span>
            {SAVED_VIEWS.map(view => (
              <button
                key={view.key}
                type="button"
                onClick={() => applySavedView(view.key)}
                style={S.btnOutline}
              >
                {view.label}
              </button>
            ))}
          </div>

          <GanttCommandBar metrics={metricActions} presets={presetActions} />

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            <span style={{ ...S.pill, ...ui.badge.neutral }}>{formatMonthLabel(viewMonth)}</span>
            <span style={{ ...S.pill, ...ui.badge.neutral }}>{visibleStats.projects} dự án</span>
            <span style={{ ...S.pill, ...ui.badge.neutral }}>{visibleStats.tasks} công việc</span>
            <span style={{ ...S.pill, ...ui.badge.error }}>{visibleStats.overdueTasks} trễ hạn</span>
            <span style={{ ...S.pill, ...ui.badge.warning }}>{visibleStats.dueSoonTasks} sắp đến hạn</span>
            <span style={{ ...S.pill, ...ui.badge.info }}>{visibleStats.overloadedOwners} owner quá tải</span>
            <span style={{ ...S.pill, ...ui.badge.info }}>Trung bình {visibleStats.avgProgress}% tiến độ</span>
            {derived.safeMode && <span style={{ ...S.pill, ...ui.badge.warning }}>Đang dùng safe mode</span>}
          </div>

          {error && (
            <div style={{ ...ui.badge.error, padding: '12px 16px', borderRadius: tokens.radius.lg, fontSize: '14px' }}>
              {error}
            </div>
          )}

          {isLoading ? (
            <div style={{ padding: '48px 16px', textAlign: 'center', color: tokens.colors.textSecondary }}>
              Đang tải dữ liệu Gantt...
            </div>
          ) : !hasResults ? (
            <div style={{ padding: '48px 16px', textAlign: 'center', color: tokens.colors.textSecondary }}>
              Không có dự án nào khớp với tháng hiện tại và bộ lọc hiện tại. Hãy thử xóa tìm kiếm hoặc chuyển preset về "Tất cả".
            </div>
          ) : (
            <div style={{ overflowX: 'auto', border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, background: tokens.colors.surface }}>
              <div style={{ minWidth: `${LEFT_COLUMN_WIDTH + monthDays.length * DAY_COLUMN_WIDTH}px` }}>
                <div style={{ display: 'grid', gridTemplateColumns: `${LEFT_COLUMN_WIDTH}px minmax(${TIMELINE_WIDTH_MIN}px, 1fr)`, position: 'sticky', top: 0, zIndex: 3 }}>
                  <div style={{ padding: '14px 16px', borderRight: `1px solid ${tokens.colors.border}`, background: tokens.colors.background }}>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Luồng công việc
                    </div>
                    <div style={{ marginTop: '4px', fontSize: '14px', fontWeight: 800, color: tokens.colors.textPrimary }}>
                      Dự án và công việc
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'stretch', background: tokens.colors.background, minWidth: `${monthDays.length * DAY_COLUMN_WIDTH}px` }}>
                    {buildWeekHeader(monthDays)}
                  </div>
                </div>

                <div>
                  {viewMonth && (
                    <div style={{ display: 'grid', gridTemplateColumns: `${LEFT_COLUMN_WIDTH}px minmax(${TIMELINE_WIDTH_MIN}px, 1fr)`, background: tokens.colors.background, borderBottom: `1px solid ${tokens.colors.border}` }}>
                      <div style={{ padding: '10px 16px', borderRight: `1px solid ${tokens.colors.border}`, color: tokens.colors.textMuted, fontSize: '12px' }}>
                        {monthDays.length} ngày trong tháng · {currentUserLabel}
                      </div>
                      <div style={{ position: 'relative', minHeight: '18px', backgroundImage: `linear-gradient(to right, ${tokens.colors.border} 1px, transparent 1px)`, backgroundSize: `${DAY_COLUMN_WIDTH}px 100%` }}>
                        <div
                          style={{
                            position: 'absolute',
                            left: `${Math.max(0, monthDays.findIndex(day => day.isToday)) * DAY_COLUMN_WIDTH}px`,
                            top: 0,
                            bottom: 0,
                            width: '2px',
                            background: tokens.colors.primary,
                            opacity: monthDays.some(day => day.isToday) ? 1 : 0,
                          }}
                        />
                      </div>
                    </div>
                  )}
                  {selectedLens === 'project' ? renderProjectRows() : renderLensRows()}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default GanttView;
