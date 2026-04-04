import { type ComponentChildren } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { API_BASE } from '../config';
import { fetchWithAuth, type CurrentUser } from '../auth';
import { setNavContext } from '../navContext';
import { buildErpOrdersNavigation, buildProjectListNavigation, buildProjectWorkspaceNavigation, buildTasksNavigation } from '../shared/workflow/workflowNavigation';
import { tokens } from '../ui/tokens';
import { ui } from '../ui/styles';
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  CheckIcon,
  CompassIcon,
  FolderIcon,
  PendingIcon,
  RefreshIcon,
  ReportIcon,
  TasksIcon,
  TruckIcon,
  WarningIcon,
} from '../ui/icons';

type OpsStats = {
  projects?: number;
  tasks?: number;
  activeTasks?: number;
  overdueTasks?: number;
  completedTasks?: number;
  highPriorityTasks?: number;
  avgCompletion?: number;
  erpOutboxPending?: number;
  erpOutboxFailed?: number;
};

type ProjectRow = {
  id: string;
  name?: string;
  code?: string;
  status?: string;
  projectStage?: string;
  managerName?: string;
  accountName?: string;
  taskCount?: number;
  quotationCount?: number;
  supplierQuoteCount?: number;
  openTaskCount?: number;
  overdueTaskCount?: number;
  latestQuotationId?: string;
  latestQuotationStatus?: string;
  startDate?: string;
  endDate?: string;
};

type TaskRow = {
  id: string;
  name?: string;
  description?: string;
  status?: string;
  priority?: string;
  completionPct?: number;
  projectId?: string | null;
  quotationId?: string | null;
  projectName?: string;
  assigneeName?: string;
  startDate?: string;
  dueDate?: string;
  notes?: string;
  target?: string;
};

type SalesOrderRow = {
  id: string;
  orderNumber?: string;
  quotationId?: string | null;
  quotationNumber?: string | null;
  quotationStatus?: string | null;
  accountId?: string | null;
  accountName?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  projectStage?: string | null;
  status?: string | null;
  currency?: string | null;
  grandTotal?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  approvalGateState?: {
    gateType?: string;
    status?: string | null;
    latestApprovalId?: string | null;
    pendingCount?: number;
    pendingApprovers?: Array<{
      approvalId?: string;
      approverRole?: string | null;
      approverName?: string | null;
    }>;
  } | null;
  actionAvailability?: {
    canRelease?: boolean;
    canRequestReleaseApproval?: boolean;
    canOpenQuotation?: boolean;
    canOpenProject?: boolean;
    blockers?: string[];
  } | null;
};

type Props = {
  currentUser?: CurrentUser | null;
  isMobile?: boolean;
  onNavigate?: (route: string) => void;
  token?: string;
};

const API = API_BASE;
const F = tokens.fontSize;

const S = {
  shell: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: tokens.spacing.xl,
    paddingBottom: tokens.spacing.md,
    color: tokens.colors.textPrimary,
  },
  hero: {
    position: 'relative' as const,
    overflow: 'hidden' as const,
    background: `linear-gradient(135deg, rgba(0, 151, 110, 0.12) 0%, rgba(0, 63, 133, 0.08) 55%, ${tokens.colors.surface} 100%)`,
    border: `1px solid ${tokens.colors.border}`,
    borderRadius: tokens.radius.xl,
    boxShadow: tokens.shadow.sm,
  },
  heroInner: {
    position: 'relative' as const,
    zIndex: 1,
    padding: tokens.spacing.xxl,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: tokens.spacing.lg,
  },
  sectionCard: {
    ...ui.card.base,
    padding: tokens.spacing.xl,
  },
  title: {
    fontSize: F.displayLg,
    fontWeight: 900,
    letterSpacing: '-0.04em',
    margin: 0,
  },
  subtitle: {
    fontSize: F.base,
    color: tokens.colors.textSecondary,
    margin: 0,
    lineHeight: 1.6,
    maxWidth: '68ch',
  },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
    borderRadius: tokens.radius.xl,
    background: tokens.colors.surface,
    border: `1px solid ${tokens.colors.border}`,
    color: tokens.colors.textSecondary,
    fontSize: F.sm,
    fontWeight: 700,
  },
};

const PROJECT_STATUS = {
  pending: { label: 'Chưa bắt đầu', color: '#64748b' },
  active: { label: 'Đang thực hiện', color: 'var(--ht-green)' },
  completed: { label: 'Hoàn thành', color: '#16a34a' },
  paused: { label: 'Tạm dừng', color: 'var(--ht-amber)' },
  cancelled: { label: 'Hủy bỏ', color: tokens.colors.error },
};

const PROJECT_STAGE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  new: { label: 'Mới', color: '#475569', bg: tokens.colors.surface },
  quoting: { label: 'Đang báo giá', color: tokens.colors.infoAccentText, bg: tokens.colors.infoAccentBg },
  negotiating: { label: 'Thương lượng', color: tokens.colors.warningSurfaceText, bg: tokens.colors.warningSurfaceBg },
  'internal-review': { label: 'Duyệt nội bộ', color: tokens.colors.violetAccentText, bg: tokens.colors.violetAccentBg },
  won: { label: 'Thắng', color: '#047857', bg: '#d1fae5' },
  lost: { label: 'Thua', color: tokens.colors.error, bg: tokens.colors.badgeBgError },
  delivery: { label: 'Triển khai', color: tokens.colors.violetStrongText, bg: tokens.colors.violetStrongBg },
  closed: { label: 'Đóng', color: tokens.colors.textPrimary, bg: tokens.colors.surfaceSubtle },
};

const SALES_ORDER_STATUS = {
  draft: { label: 'Bản nháp', color: '#64748b', bg: tokens.colors.surface },
  released: { label: 'Released', color: tokens.colors.infoAccentText, bg: tokens.colors.infoAccentBg },
  locked_for_execution: { label: 'Khóa triển khai', color: '#047857', bg: '#d1fae5' },
  processing: { label: 'Đang xử lý', color: tokens.colors.infoAccentText, bg: tokens.colors.infoAccentBg },
  delivered: { label: 'Đã giao', color: '#047857', bg: '#d1fae5' },
  closed: { label: 'Đã đóng', color: tokens.colors.textPrimary, bg: tokens.colors.surfaceSubtle },
  cancelled: { label: 'Đã hủy', color: tokens.colors.error, bg: tokens.colors.badgeBgError },
};

const TASK_STATUS = {
  pending: { label: 'Chờ thực hiện', color: '#64748b' },
  active: { label: 'Đang làm', color: 'var(--ht-green)' },
  completed: { label: 'Hoàn thành', color: '#16a34a' },
  paused: { label: 'Tạm dừng', color: 'var(--ht-amber)' },
};

const TASK_PRIORITY = {
  low: { label: 'Thấp', color: '#64748b', bg: tokens.colors.surface },
  medium: { label: 'Trung bình', color: 'var(--ht-green)', bg: 'var(--ht-success-bg)' },
  high: { label: 'Cao', color: tokens.colors.warningSurfaceText, bg: tokens.colors.warningSurfaceBg },
  urgent: { label: 'Khẩn cấp', color: tokens.colors.error, bg: tokens.colors.badgeBgError },
};

const fmt = new Intl.NumberFormat('vi-VN');
const formatNumber = (value: number) => fmt.format(Math.round(value));
const formatDate = (value?: string | null) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: 'short' });
};

const toDateOnly = (value: string | null | undefined) => (value ? String(value).split('T')[0] : '');
const todayKey = () => new Date().toISOString().split('T')[0];

const normalizeStatus = (status: string | null | undefined) => String(status || 'pending').toLowerCase();
const normalizePriority = (priority: string | null | undefined) => String(priority || 'medium').toLowerCase();
const normalizeProjectStage = (stage: string | null | undefined) => String(stage || 'new').toLowerCase();

const orderGateTone = (status: string | null | undefined) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'approved') return 'good' as const;
  if (normalized === 'pending') return 'warn' as const;
  if (normalized === 'rejected' || normalized === 'changes_requested') return 'bad' as const;
  return 'neutral' as const;
};

const isTaskOverdue = (task: TaskRow) => {
  if (normalizeStatus(task.status) === 'completed') return false;
  const due = toDateOnly(task.dueDate);
  if (!due) return false;
  return due < todayKey();
};

const isDueSoon = (task: TaskRow) => {
  if (normalizeStatus(task.status) === 'completed') return false;
  const due = toDateOnly(task.dueDate);
  if (!due) return false;
  const dueTime = new Date(`${due}T00:00:00`).getTime();
  const diffDays = (dueTime - Date.now()) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 7;
};

const priorityScore = (task: TaskRow) => {
  const priority = normalizePriority(task.priority);
  const status = normalizeStatus(task.status);
  const completion = Math.max(0, Math.min(100, Number(task.completionPct || 0)));
  const overdueBoost = isTaskOverdue(task) ? 100 : 0;
  const dueSoonBoost = isDueSoon(task) ? 35 : 0;
  const priorityWeight = { urgent: 90, high: 70, medium: 45, low: 20 }[priority as keyof typeof TASK_PRIORITY] ?? 40;
  const statusWeight = { active: 25, pending: 18, paused: 8, completed: 0 }[status as keyof typeof TASK_STATUS] ?? 12;
  return overdueBoost + dueSoonBoost + priorityWeight + statusWeight + (100 - completion) * 0.15;
};

function StatCard({
  icon,
  label,
  value,
  hint,
  tone = 'neutral',
  onClick,
}: {
  icon: ComponentChildren;
  label: string;
  value: string;
  hint?: string;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
  onClick?: () => void;
}) {
  const palette = {
    neutral: { color: tokens.colors.textPrimary, bg: tokens.colors.surface },
    good: { color: tokens.colors.success, bg: tokens.colors.badgeBgSuccess },
    warn: { color: tokens.colors.warning, bg: tokens.colors.warningBg },
    bad: { color: tokens.colors.error, bg: tokens.colors.badgeBgError },
  }[tone];

  const cardStyle = {
    ...ui.card.base,
    padding: tokens.spacing.xlPlus,
    position: 'relative' as const,
    overflow: 'hidden' as const,
    width: '100%',
    textAlign: 'left' as const,
    cursor: onClick ? 'pointer' : 'default',
    border: onClick ? `1px solid ${tokens.colors.border}` : undefined,
    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
  };

  const content = (
    <>
      <div style={{ position: 'absolute', inset: 'auto -18px -22px auto', opacity: 0.06, transform: 'scale(3)', pointerEvents: 'none' }}>{icon}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <div style={{ fontSize: F.xs, fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
          <div style={{ fontSize: F.displayXl, fontWeight: 900, lineHeight: 1.1, marginTop: tokens.spacing.sm, color: palette.color }}>{value}</div>
        </div>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: tokens.radius.lg,
          background: palette.bg,
          color: palette.color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          {icon}
        </div>
      </div>
      {hint && <div style={{ marginTop: tokens.spacing.smPlus, fontSize: F.sm, color: tokens.colors.textSecondary, lineHeight: 1.5 }}>{hint}</div>}
    </>
  );

  return onClick ? (
    <button type="button" onClick={onClick} style={cardStyle}>
      {content}
    </button>
  ) : (
    <div style={cardStyle}>
      {content}
    </div>
  );
}

function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ComponentChildren }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: tokens.spacing.lg, alignItems: 'flex-start', marginBottom: tokens.spacing.lgPlus, flexWrap: 'wrap' }}>
      <div>
        <h2 style={{ margin: 0, fontSize: F.xl, fontWeight: 900, letterSpacing: '-0.03em' }}>{title}</h2>
        {subtitle && <p style={{ margin: `${tokens.spacing.xs} 0 0`, fontSize: F.md, color: tokens.colors.textSecondary, lineHeight: 1.5 }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function HorizontalBars({
  items,
  totalLabel,
  onItemClick,
}: {
  items: { label: string; value: number; color: string; hint?: string; key?: string }[];
  totalLabel?: string;
  onItemClick?: (item: { label: string; value: number; color: string; hint?: string; key?: string }) => void;
}) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.mdPlus }}>
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={() => onItemClick?.(item)}
          disabled={!onItemClick}
          style={{
            display: 'block',
            width: '100%',
            padding: 0,
            border: 'none',
            background: 'transparent',
            textAlign: 'left',
            cursor: onItemClick ? 'pointer' : 'default',
            color: 'inherit',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: tokens.spacing.md, marginBottom: tokens.spacing.xsPlus, fontSize: F.sm }}>
            <span style={{ fontWeight: 800, color: tokens.colors.textPrimary }}>{item.label}</span>
            <span style={{ color: tokens.colors.textSecondary }}>{formatNumber(item.value)}</span>
          </div>
          <div style={{ height: '12px', borderRadius: tokens.radius.xl, background: tokens.colors.background, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${(item.value / max) * 100}%`,
                borderRadius: tokens.radius.xl,
                background: item.color,
                minWidth: item.value > 0 ? '10px' : '0px',
                transition: 'width 300ms ease',
              }}
            />
          </div>
          {item.hint && <div style={{ marginTop: tokens.spacing.xs, fontSize: F.xs, color: tokens.colors.textMuted }}>{item.hint}</div>}
        </button>
      ))}
      {totalLabel && <div style={{ marginTop: tokens.spacing.xs, fontSize: F.xs, color: tokens.colors.textMuted }}>{totalLabel}</div>}
    </div>
  );
}

function MiniPill({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
}) {
  const palette = {
    neutral: { color: tokens.colors.textPrimary, bg: tokens.colors.surface, border: tokens.colors.border },
    good: { color: tokens.colors.success, bg: tokens.colors.badgeBgSuccess, border: tokens.colors.successTint },
    warn: { color: tokens.colors.warning, bg: tokens.colors.warningBg, border: tokens.colors.warningBorder },
    bad: { color: tokens.colors.error, bg: tokens.colors.badgeBgError, border: tokens.colors.badgeBgError },
  }[tone];

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: tokens.spacing.sm,
      padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
      borderRadius: tokens.radius.xl,
      border: `1px solid ${palette.border}`,
      background: palette.bg,
      color: palette.color,
      fontSize: F.sm,
      fontWeight: 800,
      whiteSpace: 'nowrap',
    }}>
      <span>{label}</span>
      <span style={{ opacity: 0.8 }}>{value}</span>
    </div>
  );
}

function DonutChart({
  items,
  totalLabel,
  onItemClick,
}: {
  items: { label: string; value: number; color: string; key?: string }[];
  totalLabel: string;
  onItemClick?: (item: { label: string; value: number; color: string; key?: string }) => void;
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0) || 1;
  const radius = 56;
  const strokeWidth = 18;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
      <svg width="170" height="170" viewBox="0 0 170 170" aria-label={totalLabel} role="img">
        <circle cx="85" cy="85" r={radius} fill="none" stroke={tokens.colors.background} strokeWidth={strokeWidth} />
        {items.map((item) => {
          const length = (item.value / total) * circumference;
          const currentOffset = circumference - offset - length;
          offset += length;
          return (
            <circle
              key={item.label}
              cx="85"
              cy="85"
              r={radius}
              fill="none"
              stroke={item.color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={currentOffset}
              transform="rotate(-90 85 85)"
            />
          );
        })}
        <text x="85" y="80" textAnchor="middle" style={{ fontSize: '24px', fontWeight: 900, fill: tokens.colors.textPrimary }}>
          {formatNumber(total)}
        </text>
        <text x="85" y="100" textAnchor="middle" style={{ fontSize: '11px', fontWeight: 700, fill: tokens.colors.textMuted }}>
          {totalLabel}
        </text>
      </svg>
      <div style={{ display: 'grid', gap: '10px', minWidth: '220px', flex: 1 }}>
        {items.map((item) => {
          const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => onItemClick?.(item)}
              disabled={!onItemClick}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '12px',
                alignItems: 'center',
                width: '100%',
                border: 'none',
                background: 'transparent',
                padding: 0,
                textAlign: 'left',
                cursor: onItemClick ? 'pointer' : 'default',
                color: 'inherit',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '999px', background: item.color, flexShrink: 0 }} />
                <span style={{ fontSize: '13px', fontWeight: 700, color: tokens.colors.textPrimary }}>{item.label}</span>
              </div>
              <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>
                {formatNumber(item.value)} <span style={{ color: tokens.colors.textMuted }}>({pct}%)</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TaskPriorityCard({ task, onNavigate }: { task: TaskRow; onNavigate?: (route: string) => void }) {
  const priority = normalizePriority(task.priority) as keyof typeof TASK_PRIORITY;
  const status = normalizeStatus(task.status) as keyof typeof TASK_STATUS;
  const completion = Math.max(0, Math.min(100, Number(task.completionPct || 0)));
  const overdue = isTaskOverdue(task);
  const dueSoon = isDueSoon(task);
  const priorityMeta = TASK_PRIORITY[priority] || TASK_PRIORITY.medium;
  const statusMeta = TASK_STATUS[status] || TASK_STATUS.pending;
  const openSimilarTasks = () => {
    if (!onNavigate) return;
    const target = buildTasksNavigation({
      projectId: task.projectId || undefined,
      quotationId: task.quotationId || undefined,
      status,
      priorityGroup: priority === 'urgent' || priority === 'high' ? 'high' : priority,
    }, task.id, 'Task');
    setNavContext(target.navContext);
    onNavigate(target.route);
  };

  return (
    <div style={{
      border: `1px solid ${tokens.colors.border}`,
      background: tokens.colors.surface,
      borderRadius: tokens.radius.lg,
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      boxShadow: tokens.shadow.sm,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '15px', fontWeight: 900, lineHeight: 1.4, color: tokens.colors.textPrimary, marginBottom: '4px' }}>
            {task.name || 'Công việc chưa đặt tên'}
          </div>
          <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, lineHeight: 1.5 }}>
            {task.projectName || 'Chưa có dự án'}{task.assigneeName ? ` • ${task.assigneeName}` : ' • Chưa phân công'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span style={{
            padding: '6px 10px',
            borderRadius: tokens.radius.md,
            fontSize: '11px',
            fontWeight: 800,
            color: priorityMeta.color,
            background: priorityMeta.bg,
          }}>
            {priorityMeta.label}
          </span>
          <span style={{
            padding: '6px 10px',
            borderRadius: tokens.radius.md,
            fontSize: '11px',
            fontWeight: 800,
            color: statusMeta.color,
            background: tokens.colors.surface,
            border: `1px solid ${tokens.colors.border}`,
          }}>
            {statusMeta.label}
          </span>
        </div>
      </div>

      <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, lineHeight: 1.55 }}>
        {task.description || task.notes || task.target || 'Chưa có mô tả ngắn cho công việc này.'}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', fontSize: '12px', color: tokens.colors.textMuted }}>
        <span>Bắt đầu: {formatDate(task.startDate)}</span>
        <span style={{ color: overdue ? tokens.colors.error : dueSoon ? tokens.colors.warning : tokens.colors.textMuted }}>
          Hạn xong: {formatDate(task.dueDate)}{overdue ? ' • Trễ hạn' : dueSoon ? ' • Sắp đến hạn' : ''}
        </span>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, marginBottom: '6px' }}>
          <span>Tiến độ</span>
          <span>{completion}%</span>
        </div>
        <div style={{ height: '8px', borderRadius: tokens.radius.xl, background: tokens.colors.background, overflow: 'hidden' }}>
          <div style={{
            width: `${completion}%`,
            height: '100%',
            borderRadius: tokens.radius.xl,
            background: overdue ? tokens.colors.error : priority === 'urgent' ? tokens.colors.warning : tokens.colors.primary,
          }} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '11px', color: tokens.colors.textMuted }}>
          {task.id}
        </div>
        <button
          type="button"
          onClick={openSimilarTasks}
          style={{
            ...ui.btn.ghost,
            padding: '8px 0',
            fontSize: '12px',
            fontWeight: 800,
          }}
        >
          Mở công việc liên quan
        </button>
      </div>
    </div>
  );
}

export function OperationsOverview({ currentUser, isMobile, onNavigate, token }: Props) {
  const authToken = currentUser?.token || token;
  const [reloadKey, setReloadKey] = useState(0);
  const [erpSyncing, setErpSyncing] = useState(false);
  const [erpSyncNote, setErpSyncNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<OpsStats>({});
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrderRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    const apiGet = async (url: string) => {
      const response = authToken
        ? await fetchWithAuth(authToken, url)
        : await fetch(url);
      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }
      return response.json();
    };

    const load = async () => {
      setLoading(true);
      setError(null);

      const [statsRes, projectsRes, tasksRes, salesOrdersRes] = await Promise.allSettled([
        apiGet(`${API}/stats`),
        apiGet(`${API}/projects`),
        apiGet(`${API}/tasks`),
        apiGet(`${API}/sales-orders?limit=200`),
      ]);

      if (cancelled) return;

      if (statsRes.status === 'fulfilled') setStats(statsRes.value || {});
      if (projectsRes.status === 'fulfilled') setProjects(Array.isArray(projectsRes.value) ? projectsRes.value : []);
      if (tasksRes.status === 'fulfilled') setTasks(Array.isArray(tasksRes.value) ? tasksRes.value : []);
      if (salesOrdersRes.status === 'fulfilled') setSalesOrders(Array.isArray(salesOrdersRes.value) ? salesOrdersRes.value : []);

      const anyRejected = [statsRes, projectsRes, tasksRes, salesOrdersRes].some((item) => item.status === 'rejected');
      setError(anyRejected ? 'Không thể tải đầy đủ dữ liệu. Đang hiển thị phần dữ liệu khả dụng.' : null);
      setLoading(false);
    };

    load().catch((loadError: any) => {
      if (cancelled) return;
      setError(loadError?.message || 'Không thể tải tổng quan vận hành');
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [authToken, reloadKey]);

  const derived = useMemo(() => {
    const normalizedProjects = projects.map((project) => ({
      ...project,
      projectStage: normalizeProjectStage(project.projectStage),
      status: normalizeStatus(project.status),
    }));
    const normalizedTasks = tasks.map((task) => ({
      ...task,
      status: normalizeStatus(task.status),
      priority: normalizePriority(task.priority),
    }));
    const normalizedOrders = salesOrders.map((order) => ({
      ...order,
      status: normalizeStatus(order.status),
      projectStage: normalizeProjectStage(order.projectStage),
    }));

    const projectStatusItems = Object.entries(PROJECT_STATUS).map(([key, meta]) => ({
      key,
      label: meta.label,
      value: normalizedProjects.filter((project) => project.status === key).length,
      color: meta.color,
    }));

    const projectStageItems = Object.entries(PROJECT_STAGE_LABELS).map(([key, meta]) => ({
      key,
      label: meta.label,
      value: normalizedProjects.filter((project) => project.projectStage === key).length,
      color: meta.color,
    }));

    const taskPriorityItems = Object.entries(TASK_PRIORITY).map(([key, meta]) => ({
      key,
      label: meta.label,
      value: normalizedTasks.filter((task) => task.priority === key).length,
      color: meta.color,
    }));

    const salesOrderStatusItems = Object.entries(SALES_ORDER_STATUS).map(([key, meta]) => ({
      key,
      label: meta.label,
      value: normalizedOrders.filter((order) => order.status === key).length,
      color: meta.color,
    }));

    const workloadItems = Object.entries(
      normalizedTasks.reduce<Record<string, { total: number; completed: number }>>((acc, task) => {
        const key = task.assigneeName || 'Chưa phân công';
        if (!acc[key]) acc[key] = { total: 0, completed: 0 };
        acc[key].total += 1;
        if (task.status === 'completed') acc[key].completed += 1;
        return acc;
      }, {})
    )
      .map(([label, value]) => ({
        label,
        value: value.total,
        color: 'var(--ht-green)',
        hint: `${value.completed} đã hoàn thành`,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const riskyProjects = [...normalizedProjects]
      .sort((a, b) => {
        const overdueDelta = Number(b.overdueTaskCount || 0) - Number(a.overdueTaskCount || 0);
        if (overdueDelta !== 0) return overdueDelta;
        const openDelta = Number(b.openTaskCount || 0) - Number(a.openTaskCount || 0);
        if (openDelta !== 0) return openDelta;
        const stageWeight = (stage?: string) => ({ won: 0, delivery: 1, 'internal-review': 2, negotiating: 3, quoting: 4, new: 5, lost: 6, closed: 7 }[normalizeProjectStage(stage)] ?? 8);
        return stageWeight(a.projectStage) - stageWeight(b.projectStage);
      })
      .slice(0, 6);

    const activeOrders = normalizedOrders.filter((order) => ['draft', 'released', 'locked_for_execution', 'processing'].includes(order.status));
    const deliveredOrders = normalizedOrders.filter((order) => ['delivered', 'closed'].includes(order.status));
    const workflowAttentionOrders = [...normalizedOrders]
      .filter((order) =>
        order.actionAvailability?.canRelease
        || String(order.approvalGateState?.status || '').toLowerCase() === 'pending'
        || (Array.isArray(order.actionAvailability?.blockers) && order.actionAvailability.blockers.length > 0)
      )
      .sort((a, b) => {
        const aScore = (a.actionAvailability?.canRelease ? 100 : 0)
          + (String(a.approvalGateState?.status || '').toLowerCase() === 'pending' ? 40 : 0)
          + (Array.isArray(a.actionAvailability?.blockers) ? a.actionAvailability.blockers.length : 0);
        const bScore = (b.actionAvailability?.canRelease ? 100 : 0)
          + (String(b.approvalGateState?.status || '').toLowerCase() === 'pending' ? 40 : 0)
          + (Array.isArray(b.actionAvailability?.blockers) ? b.actionAvailability.blockers.length : 0);
        return bScore - aScore;
      })
      .slice(0, 6);
    const pendingReleaseApprovals = normalizedOrders.filter((order) => String(order.approvalGateState?.status || '').toLowerCase() === 'pending');
    const releasableOrders = normalizedOrders.filter((order) => order.actionAvailability?.canRelease);
    const overdueProjects = normalizedProjects.filter((project) => Number(project.overdueTaskCount || 0) > 0);
    const overdueTasks = normalizedTasks.filter((task) => isTaskOverdue(task));
    const completedTasks = normalizedTasks.filter((task) => task.status === 'completed');
    const activeTasks = normalizedTasks.filter((task) => task.status === 'active');
    const urgentTasks = normalizedTasks.filter((task) => task.priority === 'urgent' || task.priority === 'high');
    const averageCompletion = normalizedTasks.length
      ? normalizedTasks.reduce((sum, task) => sum + Number(task.completionPct || 0), 0) / normalizedTasks.length
      : 0;

    const topTasks = [...normalizedTasks]
      .sort((a, b) => priorityScore(b as TaskRow) - priorityScore(a as TaskRow))
      .slice(0, 6);

    return {
      normalizedProjects,
      normalizedTasks,
      projectStatusItems,
      projectStageItems,
      taskPriorityItems,
      salesOrderStatusItems,
      workloadItems,
      riskyProjects,
      activeOrders,
      deliveredOrders,
      workflowAttentionOrders,
      pendingReleaseApprovals,
      releasableOrders,
      overdueProjects,
      overdueTasks,
      completedTasks,
      activeTasks,
      urgentTasks,
      averageCompletion,
      topTasks,
    };
  }, [projects, salesOrders, tasks]);

  const totals = {
    projects: stats.projects ?? projects.length,
    tasks: stats.tasks ?? tasks.length,
    activeTasks: stats.activeTasks ?? derived.activeTasks.length,
    overdueTasks: derived.overdueTasks.length,
    completedTasks: derived.completedTasks.length,
    highPriorityTasks: derived.urgentTasks.filter((task) => task.priority === 'urgent' || task.priority === 'high').length,
    avgCompletion: derived.averageCompletion,
    projectStages: derived.projectStageItems.reduce((sum, item) => sum + item.value, 0),
    salesOrders: salesOrders.length,
    activeOrders: derived.activeOrders.length,
    deliveredOrders: derived.deliveredOrders.length,
    pendingReleaseApprovals: derived.pendingReleaseApprovals.length,
    releasableOrders: derived.releasableOrders.length,
    riskyProjects: derived.riskyProjects.length,
    erpPending: stats.erpOutboxPending ?? 0,
    erpFailed: stats.erpOutboxFailed ?? 0,
  };

  const cards = [
    { icon: <FolderIcon size={18} />, label: 'Dự án', value: formatNumber(totals.projects), hint: 'Toàn bộ danh mục dự án của các nhóm', tone: 'neutral' as const },
    { icon: <CompassIcon size={18} />, label: 'Giai đoạn', value: formatNumber(totals.projectStages), hint: 'Phân bổ dự án theo từng giai đoạn', tone: 'good' as const },
    { icon: <CheckIcon size={18} />, label: 'Công việc', value: formatNumber(totals.tasks), hint: 'Toàn bộ đầu việc đang được theo dõi trong CRM', tone: 'neutral' as const },
    { icon: <TasksIcon size={18} />, label: 'Đang thực hiện', value: formatNumber(totals.activeTasks), hint: 'Công việc đang ở trạng thái xử lý', tone: 'good' as const },
    { icon: <PendingIcon size={18} />, label: 'Trễ hạn', value: formatNumber(totals.overdueTasks), hint: 'Công việc đã quá ngày hoàn thành', tone: totals.overdueTasks > 0 ? 'bad' as const : 'neutral' as const },
    { icon: <CheckCircle2Icon size={18} />, label: 'Hoàn thành', value: formatNumber(totals.completedTasks), hint: 'Công việc đã kết thúc', tone: 'good' as const },
    { icon: <ReportIcon size={18} />, label: 'Đơn ERP', value: formatNumber(totals.salesOrders), hint: 'Đơn hàng ERP sinh ra từ bàn giao dự án', tone: totals.salesOrders > 0 ? 'neutral' as const : 'warn' as const },
    { icon: <TruckIcon size={18} />, label: 'Đơn đang xử lý', value: formatNumber(totals.activeOrders), hint: 'Đơn ở draft, released hoặc locked_for_execution', tone: totals.activeOrders > 0 ? 'warn' as const : 'good' as const },
    { icon: <PendingIcon size={18} />, label: 'Chờ release approval', value: formatNumber(totals.pendingReleaseApprovals), hint: 'Sales order release gates đang pending approver', tone: totals.pendingReleaseApprovals > 0 ? 'warn' as const : 'good' as const },
    { icon: <CheckCircle2Icon size={18} />, label: 'Có thể release', value: formatNumber(totals.releasableOrders), hint: 'Đơn đã đủ điều kiện release theo workflow contract', tone: totals.releasableOrders > 0 ? 'good' as const : 'neutral' as const },
    { icon: <WarningIcon size={18} />, label: 'Ưu tiên cao', value: formatNumber(totals.highPriorityTasks), hint: 'Công việc mức khẩn hoặc ưu tiên cao', tone: totals.highPriorityTasks > 0 ? 'warn' as const : 'neutral' as const },
    { icon: <RefreshIcon size={18} />, label: 'ERP chờ đồng bộ', value: formatNumber(totals.erpPending), hint: 'Sự kiện đang chờ đẩy sang ERP', tone: totals.erpPending > 0 ? 'warn' as const : 'good' as const },
    { icon: <AlertCircleIcon size={18} />, label: 'ERP lỗi', value: formatNumber(totals.erpFailed), hint: 'Sự kiện đồng bộ ERP cần được kiểm tra', tone: totals.erpFailed > 0 ? 'bad' as const : 'good' as const },
  ];

  const canRunErpSync =
    !!authToken &&
    (String((currentUser as any)?.systemRole || '').toLowerCase() === 'admin' ||
      String((currentUser as any)?.systemRole || '').toLowerCase() === 'manager');

  const runErpSync = async () => {
    if (!authToken || erpSyncing) return;
    setErpSyncing(true);
    setErpSyncNote(null);
    try {
      const res = await fetchWithAuth(authToken, `${API}/erp/sync/run?limit=50`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as any)?.error || `Đồng bộ ERP thất bại (${res.status})`);
      }
      setErpSyncNote(`Đồng bộ ERP: đã xử lý ${data.processed || 0}, gửi thành công ${data.sent || 0}, lỗi ${data.failed || 0}.`);
      setReloadKey((v) => v + 1);
    } catch (e: any) {
      setErpSyncNote(e?.message || 'Đồng bộ ERP thất bại');
    } finally {
      setErpSyncing(false);
    }
  };

  const openProjects = (filters?: Record<string, unknown>) => {
    if (!onNavigate) return;
    const target = buildProjectListNavigation(filters);
    setNavContext(target.navContext);
    onNavigate(target.route);
  };

  const openProject = (projectId: string) => {
    if (!onNavigate) return;
    const target = buildProjectWorkspaceNavigation(projectId, null);
    if (!target) return;
    setNavContext(target.navContext);
    onNavigate(target.route);
  };

  const openTasks = (filters?: Record<string, unknown>) => {
    if (!onNavigate) return;
    const target = buildTasksNavigation(filters);
    setNavContext(target.navContext);
    onNavigate(target.route);
  };

  const openTasksForProject = (projectId: string, extras?: Record<string, unknown>) => {
    if (!onNavigate) return;
    const target = buildTasksNavigation({ projectId, ...extras }, projectId, 'Project');
    setNavContext(target.navContext);
    onNavigate(target.route);
  };

  const openOrders = (filters?: Record<string, unknown>) => {
    if (!onNavigate) return;
    const target = buildErpOrdersNavigation(filters);
    setNavContext(target.navContext);
    onNavigate(target.route);
  };

  const openOrdersForProject = (projectId: string, extras?: Record<string, unknown>) => {
    if (!onNavigate) return;
    const target = buildErpOrdersNavigation({ projectId, ...extras }, projectId);
    setNavContext(target.navContext);
    onNavigate(target.route);
  };

  return (
    <div style={S.shell}>
      <div style={S.hero}>
        <div style={{
          position: 'absolute',
          inset: 'auto -20px -40px auto',
          width: '220px',
          height: '220px',
          borderRadius: '999px',
          background: 'radial-gradient(circle, rgba(0,151,110,0.18) 0%, rgba(0,63,133,0.06) 48%, transparent 70%)',
          filter: 'blur(0px)',
        }} />
        <div style={S.heroInner}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.spacing.smPlus }}>
            <span style={S.chip}>Tổng quan vận hành</span>
            <span style={S.chip}>{new Date().toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: 'short' })}</span>
            <span style={S.chip}>Dữ liệu trực tiếp từ CRM</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.spacing.sm }}>
            <MiniPill label="Giai đoạn dự án" value={formatNumber(totals.projectStages)} tone="good" />
            <MiniPill label="Công việc trễ hạn" value={formatNumber(totals.overdueTasks)} tone={totals.overdueTasks > 0 ? 'bad' : 'neutral'} />
            <MiniPill label="Đơn đang xử lý" value={formatNumber(totals.activeOrders)} tone={totals.activeOrders > 0 ? 'warn' : 'neutral'} />
            <MiniPill label="Dự án rủi ro" value={formatNumber(totals.riskyProjects)} tone={totals.riskyProjects > 0 ? 'warn' : 'neutral'} />
          </div>
          <div>
            <h1 style={S.title}>Tổng quan vận hành</h1>
            <p style={S.subtitle}>
              Theo dõi dự án, công việc và độ ưu tiên vận hành trong cùng một màn hình. Mục tiêu là giúp ban kinh doanh và vận hành nhìn nhanh phần việc đang trễ, phần việc sắp đến hạn, và những công việc cần tác động ngay.
            </p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.spacing.smPlus }}>
            <button
              type="button"
              onClick={() => openProjects()}
              style={ui.btn.primary}
            >
              <FolderIcon size={14} />
              Mở dự án
            </button>
            <button
              type="button"
              onClick={() => openTasks()}
              style={ui.btn.outline}
            >
              <CheckIcon size={14} />
              Mở công việc
            </button>
            {canRunErpSync && (
              <button
                type="button"
                onClick={() => void runErpSync()}
                disabled={erpSyncing}
                style={{ ...ui.btn.outline, opacity: erpSyncing ? 0.7 : 1, cursor: erpSyncing ? 'not-allowed' : 'pointer' }}
                title="Chạy đồng bộ ERP ngay"
              >
                <RefreshIcon size={14} />
                {erpSyncing ? 'Đang đồng bộ ERP...' : 'Chạy đồng bộ ERP'}
              </button>
            )}
          </div>
          {erpSyncNote && (
            <div style={{ marginTop: tokens.spacing.xsPlus, fontSize: F.sm, color: tokens.colors.textSecondary, fontWeight: 700 }}>
              {erpSyncNote}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div style={{
          ...ui.card.base,
          padding: `${tokens.spacing.lg} ${tokens.spacing.xlPlus}`,
          background: 'var(--ht-error-bg)',
          borderColor: 'rgba(220, 38, 38, 0.2)',
          color: '#991b1b',
          fontSize: F.md,
          fontWeight: 600,
        }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ ...ui.card.base, padding: '40px', textAlign: 'center', color: tokens.colors.textMuted }}>
          Đang tải dữ liệu...
        </div>
      ) : (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
            gap: '16px',
          }}>
            {cards.map((card) => (
              <StatCard
                key={card.label}
                {...card}
                onClick={
                  card.label === 'Dự án'
                    ? () => openProjects()
                    : card.label === 'Giai đoạn'
                      ? () => openProjects()
                      : card.label === 'Công việc'
                        ? () => openTasks()
                        : card.label === 'Đang thực hiện'
                          ? () => openTasks({ status: 'active' })
                          : card.label === 'Trễ hạn'
                            ? () => openTasks({ overdue: true })
                            : card.label === 'Hoàn thành'
                              ? () => openTasks({ status: 'completed' })
                              : card.label === 'Đơn ERP'
                                ? () => openOrders()
                                : card.label === 'Đơn đang xử lý'
                                  ? () => openOrders({ statusGroup: 'active' })
                                  : card.label === 'Ưu tiên cao'
                                    ? () => openTasks({ priorityGroup: 'high' })
                                    : undefined
                }
              />
            ))}
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1.2fr 1fr',
            gap: '16px',
          }}>
            <div style={S.sectionCard}>
              <SectionTitle
                title="Tiến độ dự án"
                subtitle="Phân bổ theo giai đoạn để biết dự án đang ở đâu trong quy trình"
                action={<button type="button" onClick={() => openProjects()} style={ui.btn.ghost}>Xem dự án</button>}
              />
              <HorizontalBars
                items={derived.projectStageItems.map((item) => ({
                  label: item.label,
                  value: item.value,
                  color: item.color,
                  hint: item.key,
                  key: item.key,
                }))}
                totalLabel={`${formatNumber(totals.projects)} dự án`}
                onItemClick={(item) => openProjects({ projectStage: item.key })}
              />
            </div>

            <div style={S.sectionCard}>
              <SectionTitle
                title="Luồng đơn hàng"
                subtitle="Đơn hàng bàn giao từ dự án, đọc trực tiếp workflow contract từ sales-order payload"
                action={<button type="button" onClick={() => openOrders()} style={ui.btn.ghost}>Xem đơn ERP</button>}
              />
              <DonutChart
                items={derived.salesOrderStatusItems.map((item) => ({
                  label: item.label,
                  value: item.value,
                  color: item.color,
                  key: item.key,
                }))}
                totalLabel="đơn hàng"
                onItemClick={(item) => openOrders({ status: item.key })}
              />
              <div style={{ marginTop: tokens.spacing.lg, display: 'grid', gap: tokens.spacing.smPlus }}>
                {derived.workflowAttentionOrders.length > 0 ? derived.workflowAttentionOrders.map((order) => (
                  <div
                    key={order.id}
                    style={{
                      border: `1px solid ${tokens.colors.border}`,
                      borderRadius: tokens.radius.lg,
                      padding: tokens.spacing.mdPlus,
                      background: tokens.colors.surface,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: tokens.spacing.smPlus,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: tokens.spacing.md, alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: F.base, fontWeight: 900, color: tokens.colors.textPrimary }}>{order.orderNumber || order.id}</div>
                        <div style={{ fontSize: F.sm, color: tokens.colors.textSecondary, marginTop: tokens.spacing.xs }}>
                          {order.projectName || order.projectId || 'Chưa gắn project'}{order.accountName ? ` • ${order.accountName}` : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: tokens.spacing.sm, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <MiniPill label="Trạng thái" value={SALES_ORDER_STATUS[order.status as keyof typeof SALES_ORDER_STATUS]?.label || order.status || 'draft'} tone="neutral" />
                        {order.approvalGateState?.status && order.approvalGateState.status !== 'not_requested' && (
                          <MiniPill label="Gate" value={String(order.approvalGateState.status).toUpperCase()} tone={orderGateTone(order.approvalGateState.status)} />
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: tokens.spacing.sm, flexWrap: 'wrap' }}>
                      {(order.approvalGateState?.pendingApprovers || []).map((approver) => (
                        <MiniPill
                          key={`${order.id}-${approver.approvalId || approver.approverRole || 'approver'}`}
                          label="Pending approver"
                          value={approver.approverRole || approver.approverName || 'n/a'}
                          tone="warn"
                        />
                      ))}
                      {order.actionAvailability?.canRelease && (
                        <MiniPill label="Action" value="Release ready" tone="good" />
                      )}
                      {(order.actionAvailability?.blockers || []).slice(0, 2).map((blocker) => (
                        <MiniPill key={`${order.id}-${blocker}`} label="Blocker" value={blocker} tone="bad" />
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: tokens.spacing.sm, flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => openOrders({ status: order.status, projectId: order.projectId })} style={ui.btn.outline}>Mở đơn ERP</button>
                      {order.projectId && <button type="button" onClick={() => openProject(String(order.projectId))} style={ui.btn.ghost}>Mở dự án</button>}
                    </div>
                  </div>
                )) : (
                  <div style={{ fontSize: F.md, color: tokens.colors.textMuted }}>
                    Không có sales order nào đang cần workflow attention.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={S.sectionCard}>
              <SectionTitle
                title="Danh sách rủi ro"
                subtitle="Dự án có task quá hạn, task mở nhiều, hoặc đang ở stage cần cảnh báo"
                action={(
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => openProjects()} style={ui.btn.ghost}>Dự án</button>
                  <button type="button" onClick={() => openTasks({ overdue: true })} style={ui.btn.ghost}>Công việc</button>
                  </div>
                )}
            />
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
              gap: '12px',
            }}>
              {derived.riskyProjects.length > 0 ? derived.riskyProjects.map((project) => {
                const stage = PROJECT_STAGE_LABELS[normalizeProjectStage(project.projectStage)] || PROJECT_STAGE_LABELS.new;
                return (
                  <div key={project.id} style={{
                    border: `1px solid ${tokens.colors.border}`,
                    borderRadius: tokens.radius.lg,
                    padding: '16px',
                    background: tokens.colors.surface,
                    boxShadow: tokens.shadow.sm,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: '15px', fontWeight: 900, color: tokens.colors.textPrimary }}>{project.name || project.code || project.id}</div>
                        <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, marginTop: '4px' }}>{project.accountName || 'Chưa có khách hàng'}{project.managerName ? ` • ${project.managerName}` : ''}</div>
                      </div>
                      <span style={{
                        padding: '6px 10px',
                        borderRadius: tokens.radius.md,
                        fontSize: '11px',
                        fontWeight: 800,
                        color: stage.color,
                        background: stage.bg,
                      }}>
                        {stage.label}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      <MiniPill label="Quá hạn" value={formatNumber(Number(project.overdueTaskCount || 0))} tone={Number(project.overdueTaskCount || 0) > 0 ? 'bad' : 'neutral'} />
                      <MiniPill label="Đang mở" value={formatNumber(Number(project.openTaskCount || 0))} tone={Number(project.openTaskCount || 0) > 0 ? 'warn' : 'neutral'} />
                      <MiniPill label="Báo giá" value={formatNumber(Number(project.quotationCount || 0))} />
                    </div>
                    <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, lineHeight: 1.5 }}>
                      Báo giá gần nhất: {project.latestQuotationStatus || 'n/a'}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => openProject(project.id)} style={ui.btn.outline}>Mở dự án</button>
                      <button type="button" onClick={() => openTasksForProject(project.id, Number(project.overdueTaskCount || 0) > 0 ? { overdue: true } : undefined)} style={ui.btn.ghost}>Mở công việc</button>
                      <button type="button" onClick={() => openOrdersForProject(project.id)} style={ui.btn.ghost}>Mở đơn hàng</button>
                    </div>
                  </div>
                );
              }) : (
                <div style={{
                  border: `1px dashed ${tokens.colors.border}`,
                  borderRadius: tokens.radius.lg,
                  padding: '24px',
                  color: tokens.colors.textMuted,
                  fontSize: '13px',
                  textAlign: 'center',
                }}>
                  Không có dự án nào cần cảnh báo.
                </div>
              )}
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1.35fr 1fr',
            gap: '16px',
          }}>
            <div style={S.sectionCard}>
              <SectionTitle
                title="Trạng thái dự án"
                subtitle="Tổng hợp trạng thái các dự án trong CRM"
              />
              <HorizontalBars
                items={derived.projectStatusItems.map((item) => ({
                  label: item.label,
                  value: item.value,
                  color: item.color,
                  hint: item.key,
                }))}
                totalLabel={`${formatNumber(totals.projects)} dự án`}
              />
            </div>

            <div style={S.sectionCard}>
              <SectionTitle
                title="Ưu tiên công việc"
                subtitle="Phân bổ công việc theo độ ưu tiên"
              />
              <DonutChart
                items={derived.taskPriorityItems.map((item) => ({
                  label: item.label,
                  value: item.value,
                  color: item.color,
                }))}
                totalLabel="công việc"
              />
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1.15fr',
            gap: '16px',
          }}>
            <div style={S.sectionCard}>
              <SectionTitle
                title="Khối lượng công việc"
                subtitle="Số task theo từng người phụ trách"
              />
              <HorizontalBars
                items={derived.workloadItems.map((item) => ({
                  label: item.label,
                  value: item.value,
                  color: item.color,
                  hint: item.hint,
                }))}
                totalLabel="Top 5 người phụ trách"
              />
            </div>

            <div style={S.sectionCard}>
              <SectionTitle
                title="Công việc ưu tiên"
                subtitle="Danh sách task cần xử lý trước"
                action={(
                  <button
                    type="button"
                    onClick={() => onNavigate?.('Tasks')}
                    style={ui.btn.ghost}
                  >
                    Xem tất cả công việc
                  </button>
                )}
              />

              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: '12px',
                maxHeight: isMobile ? 'none' : '620px',
                overflow: 'auto',
                paddingRight: isMobile ? 0 : '4px',
              }}>
                {derived.topTasks.length > 0 ? (
                  derived.topTasks.map((task) => (
                    <TaskPriorityCard key={task.id} task={task} onNavigate={onNavigate} />
                  ))
                ) : (
                  <div style={{
                    border: `1px dashed ${tokens.colors.border}`,
                    borderRadius: tokens.radius.lg,
                    padding: '28px',
                    textAlign: 'center',
                    color: tokens.colors.textMuted,
                    fontSize: '13px',
                  }}>
                    Chưa có task nào để ưu tiên.
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default OperationsOverview;
