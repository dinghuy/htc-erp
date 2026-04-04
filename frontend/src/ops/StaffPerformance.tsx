import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { API_BASE } from '../config';
import { fetchWithAuth, type CurrentUser } from '../auth';
import { tokens } from '../ui/tokens';
import { ui } from '../ui/styles';
import { DetailField, DetailGrid, DetailModal, DetailSection } from '../ui/details';
import {
  CheckCircle2Icon,
  CheckIcon,
  FolderIcon,
  ReportIcon,
  TargetIcon,
  TasksIcon,
  UsersIcon,
} from '../ui/icons';

type Props = {
  currentUser?: CurrentUser | null;
  isMobile?: boolean;
  onNavigate?: (route: string) => void;
  token?: string;
};

type UserRow = {
  id: string;
  fullName?: string;
  username?: string;
  email?: string;
  systemRole?: string;
  department?: string;
  employeeCode?: string;
};

type TaskRow = {
  id: string;
  status?: string;
  assigneeId?: string | null;
  assigneeName?: string | null;
  completionPct?: number | null;
  dueDate?: string | null;
  projectName?: string | null;
  accountName?: string | null;
};

type StaffSummaryRow = {
  assigneeId?: string | null;
  assigneeName?: string | null;
  taskCount?: number | null;
  completedCount?: number | null;
  activeCount?: number | null;
  overdueCount?: number | null;
  avgCompletionPct?: number | null;
};

type OpsSummary = {
  tasks?: {
    total?: number;
    completed?: number;
    overdue?: number;
    avgCompletionPct?: number;
    completionRate?: number;
  };
  workload?: {
    topAssignees?: StaffSummaryRow[];
  };
};

type StaffMetric = {
  key: string;
  label: string;
  user?: UserRow;
  taskCount: number;
  completedCount: number;
  activeCount: number;
  overdueCount: number;
  avgCompletionPct: number;
  completionRate: number;
};

const API = API_BASE;
const fmt = new Intl.NumberFormat('vi-VN');
const formatNumber = (value: number) => fmt.format(Math.round(value));
const formatPercent = (value: number) => `${Math.max(0, Math.min(100, Math.round(value)))}%`;
const normalize = (value?: string | null) => String(value || '').trim().toLowerCase();
const todayKey = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const isCompleted = (task: TaskRow) => normalize(task.status) === 'completed';
const isOverdue = (task: TaskRow) => {
  if (isCompleted(task)) return false;
  const due = task.dueDate ? String(task.dueDate).split('T')[0] : '';
  return !!due && due < todayKey();
};

const S = {
  shell: { display: 'flex', flexDirection: 'column' as const, gap: '24px', color: tokens.colors.textPrimary, paddingBottom: '12px' },
  hero: { position: 'relative' as const, overflow: 'hidden' as const, background: `linear-gradient(135deg, rgba(0,151,110,0.12) 0%, rgba(0,63,133,0.08) 55%, ${tokens.colors.surface} 100%)`, border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.xl, boxShadow: tokens.shadow.sm },
  heroInner: { position: 'relative' as const, zIndex: 1, padding: '28px', display: 'flex', flexDirection: 'column' as const, gap: '16px' },
  sectionCard: { ...ui.card.base, padding: '24px' },
  chip: { display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: tokens.radius.xl, background: tokens.colors.surface, border: `1px solid ${tokens.colors.border}`, color: tokens.colors.textSecondary, fontSize: tokens.fontSize.sm, fontWeight: 700 },
  title: { fontSize: tokens.fontSize.displayLg, fontWeight: 900, letterSpacing: '-0.04em', margin: 0 },
  subtitle: { fontSize: tokens.fontSize.base, color: tokens.colors.textSecondary, margin: 0, lineHeight: 1.6, maxWidth: '72ch' },
} as const;

function StatCard({ icon, label, value, hint, tone = 'neutral' as const }: { icon: ComponentChildren; label: string; value: string; hint?: string; tone?: 'neutral' | 'good' | 'warn' | 'bad' }) {
  const palette = {
    neutral: { color: tokens.colors.textPrimary, bg: tokens.colors.surface },
    good: { color: tokens.colors.primary, bg: tokens.colors.badgeBgSuccess },
    warn: { color: tokens.colors.warning, bg: tokens.colors.warningBg },
    bad: { color: tokens.colors.error, bg: tokens.colors.badgeBgError },
  }[tone];
  return (
    <div style={{ ...ui.card.base, padding: '20px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 'auto -18px -22px auto', opacity: 0.06, transform: 'scale(3)' }}>{icon}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: tokens.fontSize.xs, fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
          <div style={{ fontSize: tokens.fontSize.displayXl, fontWeight: 900, lineHeight: 1.1, marginTop: '8px', color: palette.color }}>{value}</div>
        </div>
        <div style={{ width: '48px', height: '48px', borderRadius: tokens.radius.lg, background: palette.bg, color: palette.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
      </div>
      {hint && <div style={{ marginTop: '10px', fontSize: tokens.fontSize.sm, color: tokens.colors.textSecondary, lineHeight: 1.5 }}>{hint}</div>}
    </div>
  );
}

function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ComponentChildren }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start', marginBottom: '18px', flexWrap: 'wrap' }}>
      <div>
        <h2 style={{ margin: 0, fontSize: tokens.fontSize.xl, fontWeight: 900, letterSpacing: '-0.03em' }}>{title}</h2>
        {subtitle && <p style={{ margin: '4px 0 0', fontSize: tokens.fontSize.md, color: tokens.colors.textSecondary, lineHeight: 1.5 }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'info'; children: ComponentChildren }) {
  const styles = { neutral: ui.badge.neutral, good: ui.badge.success, warn: ui.badge.warning, bad: ui.badge.error, info: ui.badge.info }[tone];
  return <span style={styles}>{children}</span>;
}

function BarList({ items }: { items: { label: string; value: number; hint?: string }[] }) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {items.map((item) => (
        <div key={item.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '6px', fontSize: tokens.fontSize.sm }}>
            <span style={{ fontWeight: 800 }}>{item.label}</span>
            <span style={{ color: tokens.colors.textSecondary }}>{formatNumber(item.value)}</span>
          </div>
          <div style={{ height: '12px', borderRadius: tokens.radius.xl, background: tokens.colors.background, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(item.value / max) * 100}%`, borderRadius: tokens.radius.xl, background: 'var(--ht-green)', minWidth: item.value > 0 ? '10px' : '0px' }} />
          </div>
          {item.hint && <div style={{ marginTop: '4px', fontSize: tokens.fontSize.xs, color: tokens.colors.textMuted }}>{item.hint}</div>}
        </div>
      ))}
    </div>
  );
}

function getHealth(row: StaffMetric) {
  if (row.taskCount === 0) return { label: 'Chưa có việc', tone: 'neutral' as const };
  if (row.overdueCount >= 3 || row.completionRate < 50) return { label: 'Cần ưu tiên', tone: 'bad' as const };
  if (row.overdueCount > 0 || row.completionRate < 80) return { label: 'Cần theo dõi', tone: 'warn' as const };
  return { label: 'Ổn định', tone: 'good' as const };
}

function StaffRow({ row, onOpen }: { row: StaffMetric; onOpen: () => void }) {
  const health = getHealth(row);
  const user = row.user;
  return (
    <tr style={{ ...ui.table.row, background: tokens.colors.surface, cursor: 'pointer' }} onClick={onOpen}>
      <td style={{ ...ui.table.td, minWidth: '220px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ fontWeight: 800 }}>{row.label}</div>
          <div style={{ fontSize: tokens.fontSize.sm, color: tokens.colors.textMuted }}>{user?.employeeCode ? `${user.employeeCode} · ` : ''}{user?.email || user?.username || '—'}</div>
        </div>
      </td>
      <td style={ui.table.td}><div style={{ fontWeight: 700, fontSize: tokens.fontSize.sm }}>{user?.systemRole || 'member'}</div><div style={{ color: tokens.colors.textMuted, fontSize: tokens.fontSize.sm }}>{user?.department || 'Chung'}</div></td>
      <td style={ui.table.td}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <strong>{formatNumber(row.taskCount)}</strong>
          <span style={{ fontSize: tokens.fontSize.xs, color: tokens.colors.textMuted }}>{formatNumber(row.completedCount)} đã xong</span>
        </div>
      </td>
      <td style={ui.table.td}><strong style={{ color: row.overdueCount > 0 ? tokens.colors.error : tokens.colors.textPrimary }}>{formatNumber(row.overdueCount)}</strong></td>
      <td style={ui.table.td}><Badge tone={health.tone}>{health.label}</Badge></td>
      <td style={ui.table.td}>
        <button type="button" onClick={(event) => { event.stopPropagation(); onOpen(); }} style={ui.btn.outline}>Chi tiết</button>
      </td>
    </tr>
  );
}

function StaffDetailsModal({ row, onClose }: { row: StaffMetric | null; onClose: () => void }) {
  if (!row) return null;
  const user = row.user;
  const health = getHealth(row);

  return (
    <DetailModal
      open={!!row}
      title={row.label}
      subtitle="Thông tin chi tiết của nhân sự được gom ở đây, còn bảng chính chỉ giữ số liệu cốt lõi."
      onClose={onClose}
    >
      <div style={{ display: 'grid', gap: '16px' }}>
        <DetailSection title="Thông tin">
          <DetailGrid>
            <DetailField label="Mã nhân viên" value={user?.employeeCode || '—'} />
            <DetailField label="Email" value={user?.email || user?.username || '—'} />
            <DetailField label="Vai trò" value={user?.systemRole || 'member'} />
            <DetailField label="Phòng ban" value={user?.department || 'Chung'} />
            <DetailField label="Trạng thái" value={<Badge tone={health.tone}>{health.label}</Badge>} />
          </DetailGrid>
        </DetailSection>

        <DetailSection title="Tải công việc">
          <DetailGrid>
            <DetailField label="Tổng task" value={formatNumber(row.taskCount)} />
            <DetailField label="Đã hoàn thành" value={formatNumber(row.completedCount)} />
            <DetailField label="Đang xử lý" value={formatNumber(row.activeCount)} />
            <DetailField label="Quá hạn" value={formatNumber(row.overdueCount)} />
            <DetailField label="Hoàn thành TB" value={row.taskCount > 0 ? formatPercent(row.avgCompletionPct) : '—'} />
            <DetailField label="Tỷ lệ hoàn thành" value={row.taskCount > 0 ? formatPercent(row.completionRate) : '—'} />
          </DetailGrid>
        </DetailSection>
      </div>
    </DetailModal>
  );
}

export function StaffPerformance({ currentUser, isMobile, onNavigate, token }: Props) {
  const authToken = currentUser?.token || token;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<OpsSummary>({});
  const [users, setUsers] = useState<UserRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffMetric | null>(null);

  useEffect(() => {
    let cancelled = false;
    const apiGet = async (url: string) => {
      const res = authToken ? await fetchWithAuth(authToken, url) : await fetch(url);
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      return res.json();
    };
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [summaryRes, usersRes, tasksRes] = await Promise.allSettled([apiGet(`${API}/ops/summary`), apiGet(`${API}/users`), apiGet(`${API}/tasks`)]);
        if (cancelled) return;
        if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value || {});
        if (usersRes.status === 'fulfilled') setUsers(Array.isArray(usersRes.value) ? usersRes.value : []);
        if (tasksRes.status === 'fulfilled') setTasks(Array.isArray(tasksRes.value) ? tasksRes.value : []);
        if ([summaryRes, usersRes, tasksRes].some((item) => item.status === 'rejected')) setError('Không thể tải đầy đủ dữ liệu nhân sự. Màn hình đang hiển thị phần dữ liệu hiện có trong CRM.');
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Không thể tải màn hình hiệu suất nhân sự');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [authToken]);

  const derived = useMemo(() => {
    const userMap = new Map<string, UserRow>();
    users.forEach((user) => {
      if (user.id) userMap.set(`user:${user.id}`, user);
      const name = normalize(user.fullName || user.username || user.email);
      if (name) userMap.set(`name:${name}`, user);
    });

    const stats = new Map<string, StaffMetric>();
    const ensure = (key: string, label: string, user?: UserRow) => {
      if (!stats.has(key)) stats.set(key, { key, label, user, taskCount: 0, completedCount: 0, activeCount: 0, overdueCount: 0, avgCompletionPct: 0, completionRate: 0 });
      const row = stats.get(key)!;
      if (user && !row.user) row.user = user;
      return row;
    };

    const completionBuckets = new Map<string, { total: number; count: number }>();

    tasks.forEach((task) => {
      const key = task.assigneeId ? `user:${task.assigneeId}` : task.assigneeName ? `name:${normalize(task.assigneeName)}` : 'name:unassigned';
      const user = task.assigneeId ? userMap.get(`user:${task.assigneeId}`) : task.assigneeName ? userMap.get(`name:${normalize(task.assigneeName)}`) : undefined;
      const row = ensure(key, user ? (user.fullName || user.username || user.email || user.id) : (task.assigneeName || 'Chưa phân công'), user);
      row.taskCount += 1;
      if (isCompleted(task)) row.completedCount += 1;
      if (normalize(task.status) === 'active') row.activeCount += 1;
      if (isOverdue(task)) row.overdueCount += 1;
      const bucket = completionBuckets.get(key) || { total: 0, count: 0 };
      bucket.total += Number(task.completionPct || 0);
      bucket.count += 1;
      completionBuckets.set(key, bucket);
    });

    (summary.workload?.topAssignees || []).forEach((entry) => {
      const key = entry.assigneeId ? `user:${entry.assigneeId}` : `name:${normalize(entry.assigneeName) || 'unassigned'}`;
      const user = entry.assigneeId ? userMap.get(`user:${entry.assigneeId}`) : entry.assigneeName ? userMap.get(`name:${normalize(entry.assigneeName)}`) : undefined;
      const row = ensure(key, user ? (user.fullName || user.username || user.email || user.id) : (entry.assigneeName || 'Chưa phân công'), user);
      row.taskCount = Math.max(row.taskCount, Number(entry.taskCount || 0));
      row.completedCount = Math.max(row.completedCount, Number(entry.completedCount || 0));
      row.activeCount = Math.max(row.activeCount, Number(entry.activeCount || 0));
      row.overdueCount = Math.max(row.overdueCount, Number(entry.overdueCount || 0));
      row.avgCompletionPct = Math.max(row.avgCompletionPct, Number(entry.avgCompletionPct || 0));
      if (entry.taskCount) row.completionRate = Math.max(row.completionRate, Math.round((Number(entry.completedCount || 0) / Number(entry.taskCount || 1)) * 100));
    });

    stats.forEach((row, key) => {
      const bucket = completionBuckets.get(key);
      if (bucket && bucket.count > 0) row.avgCompletionPct = bucket.total / bucket.count;
      if (row.taskCount > 0 && row.completionRate === 0) row.completionRate = Math.round((row.completedCount / row.taskCount) * 100);
    });

    users.forEach((user) => ensure(`user:${user.id}`, user.fullName || user.username || user.email || user.id, user));

    const rows = [...stats.values()].sort((a, b) => b.overdueCount - a.overdueCount || b.taskCount - a.taskCount || a.completionRate - b.completionRate);
    const activeRows = rows.filter((row) => row.taskCount > 0);
    const totalTasks = Number(summary.tasks?.total ?? tasks.length);
    const completedTasks = Number(summary.tasks?.completed ?? tasks.filter(isCompleted).length);
    const overdueTasks = Number(summary.tasks?.overdue ?? tasks.filter(isOverdue).length);
    const avgCompletion = Number(summary.tasks?.avgCompletionPct ?? (tasks.length ? tasks.reduce((sum, task) => sum + Number(task.completionPct || 0), 0) / tasks.length : 0));
    const completionRate = Number(summary.tasks?.completionRate ?? (totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0));
    const topWorkload = [...activeRows].sort((a, b) => b.taskCount - a.taskCount).slice(0, 6);
    const needsAttention = [...activeRows].filter((row) => row.overdueCount > 0 || row.completionRate < 75).slice(0, 5);
    const strongPerformers = [...activeRows].sort((a, b) => b.completionRate - a.completionRate || a.overdueCount - b.overdueCount).slice(0, 5);

    return {
      rows,
      topWorkload,
      needsAttention,
      strongPerformers,
      totalStaff: users.length || rows.length,
      activeStaff: rows.filter((row) => row.activeCount > 0).length,
      totalTasks,
      completedTasks,
      overdueTasks,
      avgCompletion,
      completionRate,
    };
  }, [summary, tasks, users]);

  const cards = [
    { icon: <UsersIcon size={18} />, label: 'Nhân sự', value: formatNumber(derived.totalStaff), hint: 'Người dùng đang có trong CRM', tone: 'neutral' as const },
    { icon: <TasksIcon size={18} />, label: 'Đang hoạt động', value: formatNumber(derived.activeStaff), hint: 'Nhân sự đang có công việc được giao', tone: 'good' as const },
    { icon: <ReportIcon size={18} />, label: 'Tiến độ trung bình', value: formatPercent(derived.avgCompletion), hint: 'Mức hoàn thành trung bình của toàn đội', tone: derived.avgCompletion >= 80 ? 'good' as const : derived.avgCompletion >= 60 ? 'warn' as const : 'bad' as const },
    { icon: <TargetIcon size={18} />, label: 'Trễ hạn', value: formatNumber(derived.overdueTasks), hint: 'Số công việc đã quá hạn', tone: derived.overdueTasks > 0 ? 'bad' as const : 'neutral' as const },
    { icon: <CheckCircle2Icon size={18} />, label: 'Hoàn thành', value: formatNumber(derived.completedTasks), hint: 'Công việc đã hoàn tất', tone: 'good' as const },
    { icon: <CheckIcon size={18} />, label: 'Tỷ lệ hoàn thành', value: formatPercent(derived.completionRate), hint: 'Tỷ lệ công việc hoàn thành đúng trạng thái', tone: derived.completionRate >= 80 ? 'good' as const : derived.completionRate >= 60 ? 'warn' as const : 'bad' as const },
  ];

  return (
    <div style={S.shell}>
      {selectedStaff && <StaffDetailsModal row={selectedStaff} onClose={() => setSelectedStaff(null)} />}
      <div style={S.hero}>
        <div style={{ position: 'absolute', inset: 'auto -20px -40px auto', width: '220px', height: '220px', borderRadius: '999px', background: 'radial-gradient(circle, rgba(0,151,110,0.18) 0%, rgba(0,63,133,0.06) 48%, transparent 70%)' }} />
        <div style={S.heroInner}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            <span style={S.chip}>Hiệu suất nhân sự</span>
            <span style={S.chip}>Dữ liệu trực tiếp từ CRM</span>
          </div>
          <div>
            <h1 style={S.title}>Hiệu suất nhân sự</h1>
            <p style={S.subtitle}>Theo dõi tải công việc, tỷ lệ hoàn thành và task trễ hạn của từng nhân sự. Màn hình này dùng trực tiếp dữ liệu hiện có trong CRM.</p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            <button type="button" onClick={() => onNavigate?.('Tasks')} style={ui.btn.primary}><CheckIcon size={14} />Mở công việc</button>
            <button type="button" onClick={() => onNavigate?.('Projects')} style={ui.btn.outline}><FolderIcon size={14} />Mở dự án</button>
          </div>
        </div>
      </div>

      {error && <div style={{ ...ui.card.base, padding: '16px 20px', background: tokens.colors.badgeBgError, borderColor: tokens.colors.errorBorder, color: tokens.colors.error, fontSize: tokens.fontSize.md, fontWeight: 600 }}>{error}</div>}
      {loading ? (
        <div style={{ ...ui.card.base, padding: '40px', textAlign: 'center', color: tokens.colors.textMuted }}>Đang tải dữ liệu...</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: '16px' }}>
            {cards.map((card) => <StatCard key={card.label} {...card} />)}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.35fr 1fr', gap: '16px' }}>
            <div style={S.sectionCard}>
              <SectionTitle title="Nhân sự có tải việc cao" subtitle="Top nhân sự theo số task đang được giao" />
              <BarList items={derived.topWorkload.map((row) => ({ label: row.label, value: row.taskCount, hint: `${formatPercent(row.completionRate)} hoàn thành · ${formatNumber(row.overdueCount)} quá hạn` }))} />
            </div>
            <div style={S.sectionCard}>
              <SectionTitle title="Cần theo dõi" subtitle="Nhân sự có nguy cơ quá hạn hoặc tỷ lệ hoàn thành thấp" />
              <div style={{ display: 'grid', gap: '10px' }}>
                {derived.needsAttention.length > 0 ? derived.needsAttention.map((row) => {
                  const health = getHealth(row);
                  return (
                    <div key={row.key} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 800 }}>{row.label}</div>
                        <div style={{ fontSize: tokens.fontSize.sm, color: tokens.colors.textMuted, marginTop: '4px' }}>{row.user?.department || 'Chung'} · {row.user?.systemRole || 'member'}</div>
                      </div>
                      <Badge tone={health.tone}>{health.label}</Badge>
                    </div>
                  );
                }) : <div style={{ border: `1px dashed ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '28px', textAlign: 'center', color: tokens.colors.textMuted, fontSize: tokens.fontSize.md }}>Chưa có nhân sự nào cần cảnh báo.</div>}
              </div>
            </div>
          </div>

          <div style={S.sectionCard}>
            <SectionTitle title="Bảng nhân sự" subtitle="Bảng tổng hợp khối lượng việc, tỷ lệ hoàn thành và quá hạn theo từng nhân sự" action={<button type="button" onClick={() => onNavigate?.('Users')} style={ui.btn.ghost}>Xem người dùng</button>} />
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: '860px', borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead>
                  <tr>
                    <th style={ui.table.thStatic}>Nhân sự</th>
                    <th style={ui.table.thStatic}>Vai trò / Phòng ban</th>
                    <th style={ui.table.thStatic}>Khối lượng</th>
                    <th style={ui.table.thStatic}>Quá hạn</th>
                    <th style={ui.table.thStatic}>Mức độ</th>
                    <th style={ui.table.thStatic}>Chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {derived.rows.length > 0 ? derived.rows.slice(0, 12).map((row) => <StaffRow key={row.key} row={row} onOpen={() => setSelectedStaff(row)} />) : <tr><td style={{ ...ui.table.td, textAlign: 'center', color: tokens.colors.textMuted }} colSpan={6}>Chưa có dữ liệu nhân sự để hiển thị.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
            <div style={S.sectionCard}>
              <SectionTitle title="Nhân sự nổi bật" subtitle="Nhân sự có tỷ lệ hoàn thành cao và ít quá hạn" />
              <div style={{ display: 'grid', gap: '10px' }}>
                {derived.strongPerformers.length > 0 ? derived.strongPerformers.map((row, idx) => (
                  <div key={row.key} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                        <div style={{ width: '30px', height: '30px', borderRadius: '999px', background: idx === 0 ? tokens.colors.primary : tokens.colors.background, color: idx === 0 ? tokens.colors.white : tokens.colors.textSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: tokens.fontSize.sm }}>{idx + 1}</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.label}</div>
                        <div style={{ fontSize: tokens.fontSize.sm, color: tokens.colors.textMuted, marginTop: '2px' }}>{formatNumber(row.taskCount)} task · {formatNumber(row.overdueCount)} quá hạn</div>
                      </div>
                    </div>
                    <Badge tone={row.completionRate >= 80 ? 'good' : row.completionRate >= 60 ? 'warn' : 'bad'}>{formatPercent(row.completionRate)}</Badge>
                  </div>
                )) : <div style={{ border: `1px dashed ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '24px', textAlign: 'center', color: tokens.colors.textMuted, fontSize: tokens.fontSize.md }}>Chưa có dữ liệu để xếp hạng.</div>}
              </div>
            </div>

            <div style={S.sectionCard}>
              <SectionTitle title="Tóm tắt quản lý" subtitle="Số liệu tổng quan để báo cáo nhanh cho quản lý" />
              <div style={{ display: 'grid', gap: '12px' }}>
                {[
                  ['Nhân sự', derived.totalStaff],
                  ['Nhân sự đang hoạt động', derived.activeStaff],
                  ['Task đã hoàn thành', derived.completedTasks],
                  ['Task quá hạn', derived.overdueTasks],
                  ['Hoàn thành trung bình', derived.avgCompletion],
                  ['Tỷ lệ hoàn thành', derived.completionRate],
                ].map(([label, value]) => (
                  <div key={String(label)} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '12px 14px', borderRadius: tokens.radius.lg, background: tokens.colors.background }}>
                    <span style={{ color: tokens.colors.textSecondary, fontSize: tokens.fontSize.md }}>{label}</span>
                    <strong>{String(label).includes('Hoàn thành') || String(label).includes('Tỷ lệ') ? formatPercent(Number(value)) : formatNumber(Number(value))}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default StaffPerformance;
