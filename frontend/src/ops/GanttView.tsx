import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { API_BASE } from '../config';
import { fetchWithAuth } from '../auth';
import { SegmentedControl } from '../ui/SegmentedControl';
import { tokens } from '../ui/tokens';
import { ui } from '../ui/styles';
import {
  addMonths,
  createMonthDays,
  createTimelineWindowDays,
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
import {
  buildProjectSignals,
  buildTaskSignals,
  formatPriorityLabel,
  formatRiskLabel,
  type GanttSignal,
} from './ganttPresentation';

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
  btnUtility: {
    ...ui.btn.outline,
    justifyContent: 'center',
    padding: `${tokens.spacing.smPlus} ${tokens.spacing.lg}`,
    minHeight: '38px',
    fontSize: tokens.fontSize.sm,
    fontWeight: 700,
    background: tokens.colors.background,
  } as any,
  btnPill: {
    ...ui.btn.outline,
    justifyContent: 'center',
    padding: `${tokens.spacing.sm} ${tokens.spacing.mdPlus}`,
    minHeight: '36px',
    borderRadius: tokens.radius.xl,
    fontSize: tokens.fontSize.sm,
    fontWeight: 700,
    background: tokens.colors.background,
  } as any,
  select: { ...ui.input.base, minWidth: '180px', width: 'auto', paddingRight: '40px' } as any,
  input: { ...ui.input.base, transition: 'all 0.2s ease' } as any,
  pill: {
    padding: '5px 10px',
    borderRadius: tokens.radius.md,
    fontSize: tokens.fontSize.xs,
    fontWeight: 800,
    display: 'inline-flex',
    alignItems: 'center',
    gap: tokens.spacing.xsPlus,
  } as any,
  sectionLabel: {
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: tokens.colors.textMuted,
  } as any,
  signalRail: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacing.xsPlus,
    alignItems: 'center',
  } as any,
  scopeSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacing.xsPlus,
    minWidth: 0,
  } as any,
  scopeRail: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
    alignItems: 'center',
    minHeight: '48px',
    padding: '6px',
    borderRadius: tokens.radius.xl,
    border: `1px solid ${tokens.colors.border}`,
    background: tokens.colors.background,
  } as any,
};

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

type SavedViewKey = (typeof SAVED_VIEWS)[number]['key'];

function buildWeekHeader(days: MonthDay[]) {
  return days.map(day => (
    <div
      key={day.key}
      style={{
        minWidth: `${DAY_COLUMN_WIDTH}px`,
        width: `${DAY_COLUMN_WIDTH}px`,
        boxSizing: 'border-box',
        textAlign: 'center',
        padding: '6px 4px 12px',
        borderLeft: `1px solid ${tokens.colors.border}`,
        boxShadow: day.isMonthStart ? `inset 2px 0 0 ${tokens.colors.border}` : 'none',
        background: day.isToday
          ? tokens.colors.successTint
          : day.isWeekend
            ? tokens.colors.surfaceSubtle
            : tokens.colors.background,
      }}
    >
      <div
        style={{
          minHeight: '12px',
          marginBottom: '2px',
          fontSize: '10px',
          fontWeight: 800,
          letterSpacing: '0.04em',
          color: day.isMonthStart ? tokens.colors.primary : 'transparent',
        }}
      >
        {day.isMonthStart ? day.monthLabelShort : '·'}
      </div>
      <div style={{ fontSize: '10px', fontWeight: 800, color: tokens.colors.textMuted }}>{day.weekdayLabel}</div>
      <div style={{ fontSize: '13px', fontWeight: day.isToday ? 900 : 700, color: day.isToday ? tokens.colors.primary : day.isWeekend ? tokens.colors.warning : tokens.colors.textPrimary }}>{day.dayNumber}</div>
    </div>
  ));
}

function signalChipStyle(signal: GanttSignal) {
  const base = { ...S.pill };
  if (signal.tone === 'error') return { ...base, ...ui.badge.error };
  if (signal.tone === 'warning') return { ...base, ...ui.badge.warning };
  if (signal.tone === 'info') return { ...base, ...ui.badge.info };
  if (signal.tone === 'success') return { ...base, ...ui.badge.success };
  return { ...base, ...ui.badge.neutral };
}

function buildDateSummary(startDate?: string | null, dueDate?: string | null) {
  if (!startDate && !dueDate) return '';
  return `${formatShortDate(startDate)} - ${formatShortDate(dueDate)}`;
}

function stripProjectTaskCount(subtitle?: string) {
  return (subtitle || '').replace(/\s*·\s*\d+\s*công việc$/, '').trim();
}

function stickyLeftPaneStyle(background: string, zIndex = 2) {
  return {
    position: 'sticky',
    left: 0,
    zIndex,
    background,
    backgroundClip: 'padding-box',
    isolation: 'isolate',
    boxShadow: `1px 0 0 ${tokens.colors.border}`,
  } as const;
}

function GanttRow({
  label,
  subtitle,
  signals,
  barStyle,
  barLabel,
  onClick,
  isProject = false,
  overdue = false,
  timelineMissing = false,
  todayIndex = -1,
  suppressClicksUntilRef,
  expanded,
  onToggle,
  canToggle = false,
}: {
  label: string;
  subtitle?: string;
  signals?: GanttSignal[];
  barStyle?: any;
  barLabel?: string;
  onClick?: () => void;
  isProject?: boolean;
  overdue?: boolean;
  timelineMissing?: boolean;
  todayIndex?: number;
  suppressClicksUntilRef?: { current: number };
  expanded?: boolean;
  onToggle?: () => void;
  canToggle?: boolean;
}) {
  const rowBackground = overdue
    ? `linear-gradient(0deg, rgba(239, 68, 68, 0.04), rgba(239, 68, 68, 0.04)), ${tokens.colors.surface}`
    : tokens.colors.surface;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `${LEFT_COLUMN_WIDTH}px minmax(${TIMELINE_WIDTH_MIN}px, 1fr)`,
        minHeight: `${isProject ? PROJECT_ROW_HEIGHT : ROW_HEIGHT}px`,
        borderBottom: `1px solid ${tokens.colors.border}`,
        background: rowBackground,
      }}
    >
      <div
        style={{
          padding: `${tokens.spacing.mdPlus} ${tokens.spacing.lg}`,
          borderRight: `1px solid ${tokens.colors.border}`,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: tokens.spacing.sm,
          cursor: onClick ? 'pointer' : 'default',
          ...stickyLeftPaneStyle(rowBackground, 6),
        }}
        onClick={() => {
          if (suppressClicksUntilRef && Date.now() < suppressClicksUntilRef.current) return;
          onClick?.();
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.smPlus, minWidth: 0 }}>
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

        <div style={S.signalRail}>
          {(signals || []).map(signal => (
            <span key={signal.key} style={signalChipStyle(signal)}>
              {signal.label}
            </span>
          ))}
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
        {todayIndex >= 0 ? (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${todayIndex * DAY_COLUMN_WIDTH + DAY_COLUMN_WIDTH / 2}px`,
              width: '2px',
              transform: 'translateX(-1px)',
              background: tokens.colors.primary,
              opacity: 0.7,
              zIndex: 1,
            }}
          />
        ) : null}
        <div style={{ position: 'relative', height: '100%', minHeight: `${isProject ? PROJECT_ROW_HEIGHT : ROW_HEIGHT}px` }}>
          <div style={{ position: 'absolute', inset: '50% 0 auto 0', height: `${TRACK_HEIGHT}px`, transform: 'translateY(-50%)', padding: `0 ${tokens.spacing.xsPlus}` }}>
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
                  gap: tokens.spacing.sm,
                  padding: `0 ${tokens.spacing.smPlus}`,
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
                  background: tokens.colors.warningTint,
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
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const timelineDragRef = useRef<{
    mode: 'pointer' | 'mouse' | null;
    pointerId: number | null;
    startX: number;
    startScrollLeft: number;
    moved: boolean;
  }>({
    mode: null,
    pointerId: null,
    startX: 0,
    startScrollLeft: 0,
    moved: false,
  });
  const suppressRowClickUntilRef = useRef(0);
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
  const [pendingTimelineScroll, setPendingTimelineScroll] = useState<'start' | 'today' | null>('start');
  const [timelineDragging, setTimelineDragging] = useState(false);

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

  const centerMonthDays = useMemo(() => createMonthDays(viewMonth), [viewMonth]);
  const monthDays = useMemo(() => createTimelineWindowDays(viewMonth), [viewMonth]);
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
  const todayIndex = useMemo(
    () => monthDays.findIndex(day => day.isToday),
    [monthDays],
  );
  const centerMonthStartIndex = useMemo(
    () => monthDays.findIndex(day => day.isCenterMonth && day.isMonthStart),
    [monthDays],
  );

  const visibleStats = useMemo(
    () => ({
      projects: visibleProjectRows.length,
      tasks: visibleTaskRows.length,
    }),
    [visibleProjectRows.length, visibleTaskRows.length],
  );
  const activeSavedView = useMemo<SavedViewKey | 'custom'>(() => {
    if (!searchQuery && !selectedAssignee && !selectedPriority && selectedLens === 'project' && activePreset === 'all') {
      return 'ops-default';
    }
    if (!searchQuery && !selectedAssignee && !selectedPriority && selectedLens === 'owner' && activePreset === 'overloadedOwners') {
      return 'owner-focus';
    }
    if (!searchQuery && !selectedAssignee && !selectedPriority && selectedLens === 'priority' && activePreset === 'urgentHigh') {
      return 'urgent-queue';
    }
    if (!searchQuery && !selectedAssignee && !selectedPriority && selectedLens === 'project' && activePreset === 'overdue') {
      return 'overdue-projects';
    }
    return 'custom';
  }, [activePreset, searchQuery, selectedAssignee, selectedLens, selectedPriority]);

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
            subtitle={[stripProjectTaskCount(row.subtitle), `${row.progress}% tien do`].filter(Boolean).join(' · ')}
            signals={buildProjectSignals({
              risk: row.risk,
              status: row.status,
              taskCount: row.taskCount,
              overdueTaskCount: row.overdueTaskCount,
            })}
            barStyle={projectBarStyle}
            barLabel={row.risk ? formatRiskLabel(row.risk) : row.status || 'Project'}
            onClick={() => onOpenProject?.(row.id)}
            isProject
            todayIndex={todayIndex}
            suppressClicksUntilRef={suppressRowClickUntilRef}
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
              <div
                style={{
                  padding: '12px 16px',
                  borderRight: `1px solid ${tokens.colors.border}`,
                  color: tokens.colors.textMuted,
                  fontSize: '12px',
                  ...stickyLeftPaneStyle('rgba(248, 250, 252, 0.9)', 2),
                }}
              >
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
        buildDateSummary(row.startDate, row.dueDate),
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
          signals={buildTaskSignals({
            priority: row.priority,
            status: row.status,
            overdue: row.overdue,
            timelineMissing: row.timelineMissing,
          })}
          barStyle={taskBarStyle}
          barLabel={row.timelineMissing ? 'Thiếu timeline' : row.priority || row.status || 'Task'}
          onClick={() => onOpenTask?.(row.id)}
          overdue={row.overdue}
          timelineMissing={row.timelineMissing}
          todayIndex={todayIndex}
          suppressClicksUntilRef={suppressRowClickUntilRef}
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
              ...stickyLeftPaneStyle(
                group.risk === RiskState.Critical
                  ? 'rgba(239, 68, 68, 0.05)'
                  : group.risk === RiskState.Warning
                    ? 'rgba(249, 115, 22, 0.05)'
                    : 'rgba(248, 250, 252, 0.96)',
                2,
              ),
            }}
          >
            <div style={{ fontSize: '14px', fontWeight: 900, color: tokens.colors.textPrimary }}>{group.label}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
              {group.risk ? <span style={signalChipStyle({ key: 'risk', label: formatRiskLabel(group.risk), tone: group.risk === RiskState.Critical ? 'error' : group.risk === RiskState.Warning ? 'warning' : 'info' })}>{formatRiskLabel(group.risk)}</span> : null}
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
          buildDateSummary(row.startDate, row.dueDate),
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
            signals={buildTaskSignals({
              priority: row.priority,
              status: row.status,
              overdue: row.overdue,
              timelineMissing: row.timelineMissing,
            })}
            barStyle={taskBarStyle}
            barLabel={row.timelineMissing ? 'Thiếu timeline' : row.assigneeName || row.priority || row.status || 'Task'}
            onClick={() => onOpenTask?.(row.id)}
            overdue={row.overdue}
            timelineMissing={row.timelineMissing}
            todayIndex={todayIndex}
            suppressClicksUntilRef={suppressRowClickUntilRef}
          />,
        );
      }

      return groupRows;
    });
  };

  const hasResults = selectedLens === 'project' ? visibleProjectRows.length > 0 : lensGroups.length > 0;
  const currentUserLabel = currentUser?.fullName || currentUser?.username || 'Current user';

  const isInteractiveTimelineTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    return Boolean(target.closest('button, input, select, textarea, a, [role="button"]'));
  };

  const beginTimelineDrag = (clientX: number, mode: 'pointer' | 'mouse', pointerId: number | null = null) => {
    const container = timelineScrollRef.current;
    if (!container) return false;

    timelineDragRef.current = {
      mode,
      pointerId,
      startX: clientX,
      startScrollLeft: container.scrollLeft,
      moved: false,
    };
    setTimelineDragging(true);
    return true;
  };

  const handleTimelinePointerDown = (event: any) => {
    const container = timelineScrollRef.current;
    if (!container || isInteractiveTimelineTarget(event.target)) return;

    const bounds = container.getBoundingClientRect();
    const contentX = event.clientX - bounds.left + container.scrollLeft;
    if (contentX < LEFT_COLUMN_WIDTH) return;

    if (!beginTimelineDrag(event.clientX, 'pointer', event.pointerId)) return;
    container.setPointerCapture?.(event.pointerId);
  };

  const handleTimelinePointerMove = (event: any) => {
    const container = timelineScrollRef.current;
    const drag = timelineDragRef.current;
    if (!container || drag.mode !== 'pointer' || drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.startX;
    if (Math.abs(deltaX) > 4) {
      drag.moved = true;
      suppressRowClickUntilRef.current = Date.now() + 180;
    }

    container.scrollLeft = drag.startScrollLeft - deltaX;
    if (drag.moved) event.preventDefault?.();
  };

  const handleWindowTimelineMouseMove = (event: MouseEvent) => {
    const container = timelineScrollRef.current;
    const drag = timelineDragRef.current;
    if (!container || drag.mode !== 'mouse') return;

    const deltaX = event.clientX - drag.startX;
    if (Math.abs(deltaX) > 4) {
      drag.moved = true;
      suppressRowClickUntilRef.current = Date.now() + 180;
    }

    container.scrollLeft = drag.startScrollLeft - deltaX;
    if (drag.moved) event.preventDefault();
  };

  const handleWindowTimelineMouseUp = () => {
    endTimelineDrag();
  };

  const handleTimelineMouseDown = (event: any) => {
    const container = timelineScrollRef.current;
    if (!container || isInteractiveTimelineTarget(event.target)) return;

    const bounds = container.getBoundingClientRect();
    const contentX = event.clientX - bounds.left + container.scrollLeft;
    if (contentX < LEFT_COLUMN_WIDTH) return;

    if (!beginTimelineDrag(event.clientX, 'mouse')) return;
    window.addEventListener('mousemove', handleWindowTimelineMouseMove);
    window.addEventListener('mouseup', handleWindowTimelineMouseUp);
  };

  const endTimelineDrag = (event?: any) => {
    const container = timelineScrollRef.current;
    const drag = timelineDragRef.current;
    if (container && drag.mode === 'pointer' && drag.pointerId !== null && event?.pointerId === drag.pointerId) {
      container.releasePointerCapture?.(drag.pointerId);
    }
    timelineDragRef.current = {
      mode: null,
      pointerId: null,
      startX: 0,
      startScrollLeft: 0,
      moved: false,
    };
    window.removeEventListener('mousemove', handleWindowTimelineMouseMove);
    window.removeEventListener('mouseup', handleWindowTimelineMouseUp);
    setTimelineDragging(false);
  };

  useEffect(() => {
    if (!pendingTimelineScroll || !timelineScrollRef.current) return;

    const container = timelineScrollRef.current;
    if (pendingTimelineScroll === 'start') {
      const targetLeft = Math.max(0, centerMonthStartIndex * DAY_COLUMN_WIDTH);
      container.scrollTo({ left: targetLeft, behavior: 'smooth' });
      setPendingTimelineScroll(null);
      return;
    }

    if (todayIndex >= 0) {
      const viewportWidth = Math.max(container.clientWidth - LEFT_COLUMN_WIDTH, DAY_COLUMN_WIDTH * 5);
      const targetLeft = Math.max(
        0,
        LEFT_COLUMN_WIDTH + todayIndex * DAY_COLUMN_WIDTH - viewportWidth / 2 + DAY_COLUMN_WIDTH / 2,
      );
      container.scrollTo({ left: targetLeft, behavior: 'smooth' });
    }

    setPendingTimelineScroll(null);
  }, [centerMonthStartIndex, pendingTimelineScroll, todayIndex]);

  return (
    <div style={{ padding: tokens.spacing.xl, maxWidth: '1600px', margin: '0 auto' }}>
      <div
        style={{
          ...S.card,
          overflow: 'hidden',
          background: `linear-gradient(135deg, rgba(16,185,129,0.08), rgba(59,130,246,0.05))`,
        }}
      >
        <div style={{ padding: `${tokens.spacing.xl} ${tokens.spacing.xl} ${tokens.spacing.lgPlus}`, borderBottom: `1px solid ${tokens.colors.border}` }}>
          <div style={{ ...ui.page.titleRow, alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0 }}>
              <div style={S.sectionLabel}>
                Vận hành
              </div>
              <h2 style={{ margin: '8px 0 6px', fontSize: '28px', lineHeight: 1.1, color: tokens.colors.textPrimary }}>
                Tiến độ Gantt
              </h2>
              <div style={{ fontSize: '14px', color: tokens.colors.textSecondary, maxWidth: '860px' }}>
                Theo dõi tiến độ dự án theo tháng, chuyển góc nhìn nhanh và ưu tiên những mục cần xử lý ngay.
              </div>
              <div style={{ marginTop: tokens.spacing.sm, fontSize: tokens.fontSize.sm, color: tokens.colors.textMuted }}>
                Người xem: {currentUserLabel}
              </div>
            </div>
            <div style={{ ...ui.page.actions, alignItems: 'center' }}>
              <button type="button" onClick={() => setRefreshTick(tick => tick + 1)} style={S.btnUtility}>
                Làm mới
              </button>
              <button type="button" onClick={expandAll} style={S.btnUtility} disabled={selectedLens !== 'project'}>
                Mở rộng tất cả
              </button>
              <button type="button" onClick={collapseAll} style={S.btnUtility} disabled={selectedLens !== 'project'}>
                Thu gọn tất cả
              </button>
            </div>
          </div>
        </div>

        <div style={{ padding: `${tokens.spacing.lgPlus} ${tokens.spacing.xl} ${tokens.spacing.xl}`, display: 'grid', gap: tokens.spacing.lg }}>
          <div
            style={{
              ...ui.card.base,
              padding: tokens.spacing.lg,
              display: 'grid',
              gap: tokens.spacing.lg,
              background: tokens.colors.surface,
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) auto',
                gap: tokens.spacing.md,
                alignItems: 'center',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <input
                  type="search"
                  value={searchQuery}
                  onInput={(event: any) => {
                    setSearchQuery(event.target.value);
                    setExpandedProjectIds(undefined);
                  }}
                  placeholder="Tìm dự án, công việc, người phụ trách, khách hàng..."
                  style={{ ...S.input, minHeight: '48px' }}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: tokens.spacing.sm,
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: tokens.spacing.xsPlus,
                    padding: '4px',
                    borderRadius: tokens.radius.xl,
                    border: `1px solid ${tokens.colors.border}`,
                    background: tokens.colors.background,
                    flexWrap: 'wrap',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setViewMonth(date => addMonths(date, -1));
                      setExpandedProjectIds(undefined);
                      setPendingTimelineScroll('start');
                    }}
                    style={S.btnPill}
                  >
                    Tháng trước
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setViewMonth(new Date());
                      setExpandedProjectIds(undefined);
                      setPendingTimelineScroll('today');
                    }}
                    style={{ ...S.btnPill, background: tokens.colors.primary, border: `1px solid ${tokens.colors.primary}`, color: tokens.colors.textOnPrimary }}
                  >
                    Hôm nay
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setViewMonth(date => addMonths(date, 1));
                      setExpandedProjectIds(undefined);
                      setPendingTimelineScroll('start');
                    }}
                    style={S.btnPill}
                  >
                    Tháng sau
                  </button>
                </div>
                <SegmentedControl
                  ariaLabel="Gantt lens"
                  size="sm"
                  wrap
                  value={selectedLens}
                  options={LENS_OPTIONS.map(option => ({ value: option.key, label: option.label }))}
                  onChange={(value) => {
                    setSelectedLens(value);
                    setExpandedProjectIds(undefined);
                  }}
                  style={{ minHeight: '48px', width: 'fit-content', flex: '0 0 auto' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gap: tokens.spacing.md }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.spacing.md, alignItems: 'end', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.xsPlus }}>
                  <span style={S.sectionLabel}>Bo loc</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.spacing.md, alignItems: 'center' }}>
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
                        style={S.btnPill}
                      >
                        Xóa filter
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.spacing.sm, alignItems: 'center', color: tokens.colors.textMuted, fontSize: tokens.fontSize.sm }}>
                  <span>{formatMonthLabel(viewMonth)}</span>
                  <span>·</span>
                  <span>{visibleStats.projects} dự án</span>
                  <span>·</span>
                  <span>{visibleStats.tasks} công việc</span>
                  {derived.safeMode ? (
                    <>
                      <span>·</span>
                      <span style={{ ...S.pill, ...ui.badge.warning }}>Đang dùng safe mode</span>
                    </>
                  ) : null}
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                  gap: tokens.spacing.lg,
                  alignItems: 'start',
                }}
              >
                <div style={S.scopeSection}>
                  <span style={S.sectionLabel}>Saved views</span>
                  <SegmentedControl
                    ariaLabel="Saved views gantt"
                    size="sm"
                    wrap
                    value={activeSavedView as SavedViewKey}
                    options={SAVED_VIEWS.map(view => ({ value: view.key, label: view.label }))}
                    onChange={(value) => applySavedView(value)}
                    style={{ width: '100%', minHeight: '48px' }}
                  />
                </div>

                <div style={S.scopeSection}>
                  <span style={S.sectionLabel}>Quick presets</span>
                  <SegmentedControl
                    ariaLabel="Preset pham vi gantt"
                    size="sm"
                    wrap
                    value={activePreset}
                    options={PRESET_OPTIONS.map(option => ({ value: option.key, label: option.label }))}
                    onChange={(value) => {
                      setActivePreset(value);
                      setExpandedProjectIds(undefined);
                    }}
                    style={{ width: '100%', minHeight: '48px' }}
                  />
                </div>
              </div>
            </div>

            <GanttCommandBar metrics={metricActions} />
          </div>

          {error && (
            <div style={{ ...ui.badge.error, padding: `${tokens.spacing.md} ${tokens.spacing.lg}`, borderRadius: tokens.radius.lg, fontSize: tokens.fontSize.base }}>
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
            <div
              ref={timelineScrollRef}
              onMouseDown={handleTimelineMouseDown}
              onPointerDown={handleTimelinePointerDown}
              onPointerMove={handleTimelinePointerMove}
              onPointerUp={endTimelineDrag}
              onPointerCancel={endTimelineDrag}
              onPointerLeave={(event: any) => {
                if (timelineDragRef.current.pointerId === event.pointerId) {
                  endTimelineDrag(event);
                }
              }}
              style={{
                overflowX: 'auto',
                border: `1px solid ${tokens.colors.border}`,
                borderRadius: tokens.radius.lg,
                background: tokens.colors.surface,
                cursor: timelineDragging ? 'grabbing' : 'grab',
                userSelect: timelineDragging ? 'none' : 'auto',
              }}
            >
              <div style={{ minWidth: `${LEFT_COLUMN_WIDTH + monthDays.length * DAY_COLUMN_WIDTH}px` }}>
                <div style={{ display: 'grid', gridTemplateColumns: `${LEFT_COLUMN_WIDTH}px minmax(${TIMELINE_WIDTH_MIN}px, 1fr)`, position: 'sticky', top: 0, zIndex: 3 }}>
                  <div
                    style={{
                      padding: `${tokens.spacing.mdPlus} ${tokens.spacing.lg}`,
                      borderRight: `1px solid ${tokens.colors.border}`,
                      ...stickyLeftPaneStyle(tokens.colors.background, 5),
                    }}
                  >
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
                      <div
                        style={{
                          padding: `${tokens.spacing.smPlus} ${tokens.spacing.lg}`,
                          borderRight: `1px solid ${tokens.colors.border}`,
                          color: tokens.colors.textMuted,
                          fontSize: tokens.fontSize.sm,
                          ...stickyLeftPaneStyle(tokens.colors.background, 4),
                        }}
                      >
                        {centerMonthDays.length} ngày trong tháng · {currentUserLabel}
                      </div>
                      <div style={{ position: 'relative', minHeight: '18px', backgroundImage: `linear-gradient(to right, ${tokens.colors.border} 1px, transparent 1px)`, backgroundSize: `${DAY_COLUMN_WIDTH}px 100%` }}>
                        <div
                          style={{
                            position: 'absolute',
                            left: todayIndex >= 0 ? `${todayIndex * DAY_COLUMN_WIDTH + DAY_COLUMN_WIDTH / 2}px` : '0px',
                            top: 0,
                            bottom: 0,
                            width: '2px',
                            transform: 'translateX(-1px)',
                            background: tokens.colors.primary,
                            opacity: todayIndex >= 0 ? 1 : 0,
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
