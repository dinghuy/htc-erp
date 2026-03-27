import { ui } from '../../ui/styles';
import { tokens } from '../../ui/tokens';
import { CloseIcon } from '../../ui/icons';
import {
  departmentValueOptions,
  taskTypeValueOptions,
} from '../../ops/workflowOptions';
import {
  formatDate,
  isBlocked,
  normalizePriority,
  normalizeTaskStatus,
  PRIORITY_META,
  sortTasksByUrgency,
  taskDueDate,
  UI_STATUS_META,
  type TaskFormState,
  type TaskPriority,
  type TaskRecord,
  type UiTaskStatus,
  type DrawerMode,
} from './taskDomain';

const S = {
  input: { ...ui.input.base, transition: 'all 0.2s ease' } as any,
  select: { ...ui.input.base, transition: 'all 0.2s ease' } as any,
  textarea: { ...ui.input.base, minHeight: '92px', resize: 'vertical', fontFamily: 'inherit' } as any,
  btnPrimary: { ...ui.btn.primary, justifyContent: 'center' } as any,
  btnOutline: { ...ui.btn.outline, justifyContent: 'center' } as any,
  btnGhost: { ...ui.btn.ghost, justifyContent: 'center' } as any,
  btnDanger: { ...ui.btn.danger, justifyContent: 'center' } as any,
  label: { ...ui.form.label, display: 'block', marginBottom: '8px' } as any,
  card: ui.card.base as any,
};

function ProgressBar({ value }: { value: number }) {
  const safeValue = Math.min(100, Math.max(0, Number(value || 0)));
  return (
    <div
      style={{
        width: '100%',
        height: '8px',
        borderRadius: '999px',
        overflow: 'hidden',
        background: '#e7ebef',
      }}
    >
      <div
        style={{
          width: `${safeValue}%`,
          height: '100%',
          borderRadius: '999px',
          background: safeValue >= 100 ? '#2563eb' : tokens.colors.primary,
        }}
      />
    </div>
  );
}

export function StatusBadge({ status }: { status: UiTaskStatus }) {
  const meta = UI_STATUS_META[status];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 10px',
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: 800,
        background: meta.soft,
        color: meta.accent,
      }}
    >
      <span style={{ width: '7px', height: '7px', borderRadius: '999px', background: meta.accent }} />
      {meta.label}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const meta = PRIORITY_META[priority];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 10px',
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: 800,
        background: meta.soft,
        color: meta.accent,
      }}
    >
      {meta.label}
    </span>
  );
}

export function SurfaceTab({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      className="planner-tab"
      onClick={onClick}
      aria-pressed={active}
      style={{
        border: 'none',
        cursor: 'pointer',
        borderRadius: tokens.radius.lg,
        padding: '10px 16px',
        fontSize: '13px',
        fontWeight: 700,
        background: active ? tokens.colors.primary : tokens.colors.background,
        color: active ? tokens.colors.textOnPrimary : tokens.colors.textSecondary,
      }}
    >
      {label}
    </button>
  );
}

export function MetricTile({
  icon,
  label,
  value,
  note,
  accent,
}: {
  icon: any;
  label: string;
  value: number;
  note: string;
  accent: string;
}) {
  const Icon = icon;
  return (
    <div
      className="planner-surface planner-interactive"
      style={{
        ...S.card,
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        minHeight: '124px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div
          style={{
            width: '42px',
            height: '42px',
            display: 'grid',
            placeItems: 'center',
            borderRadius: '14px',
            background: `${accent}15`,
            color: accent,
          }}
        >
          <Icon size={18} />
        </div>
      </div>
      <div>
        <div style={{ fontSize: '26px', fontWeight: 900, lineHeight: 1, color: tokens.colors.textPrimary }}>{value}</div>
        <div style={{ fontSize: '14px', fontWeight: 800, color: tokens.colors.textPrimary, marginTop: '10px' }}>{label}</div>
        <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, marginTop: '6px', lineHeight: 1.45 }}>{note}</div>
      </div>
    </div>
  );
}

export function KanbanBoard({
  tasks,
  draggingTaskId,
  hoveredStatus,
  updatingTaskId,
  canDrag,
  onDragStart,
  onHoverStatus,
  onDropStatus,
  onOpenTask,
}: {
  tasks: TaskRecord[];
  draggingTaskId: string;
  hoveredStatus: UiTaskStatus | '';
  updatingTaskId: string;
  canDrag: boolean;
  onDragStart: (taskId: string) => void;
  onHoverStatus: (status: UiTaskStatus | '') => void;
  onDropStatus: (status: UiTaskStatus) => void;
  onOpenTask: (task: TaskRecord) => void;
}) {
  const columns = (Object.keys(UI_STATUS_META) as UiTaskStatus[]).map((status) => ({
    key: status,
    meta: UI_STATUS_META[status],
    tasks: sortTasksByUrgency(tasks.filter((task) => normalizeTaskStatus(task.status) === status)),
  }));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
      {columns.map((column) => (
        <div
          key={column.key}
          onDragOver={(event) => {
            event.preventDefault();
            onHoverStatus(column.key);
          }}
          onDragEnter={() => onHoverStatus(column.key)}
          onDrop={() => onDropStatus(column.key)}
          className={hoveredStatus === column.key ? 'kanban-drop-target' : undefined}
          style={{
            ...S.card,
            padding: '14px',
            background: column.meta.soft,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            minHeight: '280px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <StatusBadge status={column.key} />
            <span style={{ fontSize: '12px', fontWeight: 800, color: column.meta.accent }}>
              {hoveredStatus === column.key && draggingTaskId ? 'Thả vào đây' : column.tasks.length}
            </span>
          </div>
          {column.tasks.length === 0 ? (
            <div style={{ fontSize: '12px', color: tokens.colors.textMuted }}>Kéo công việc vào đây để cập nhật trạng thái.</div>
          ) : (
            column.tasks.map((task) => (
              <button
                className="planner-interactive"
                key={task.id}
                draggable={canDrag}
                onDragStart={() => onDragStart(task.id)}
                onDragEnd={() => onHoverStatus('')}
                onClick={() => onOpenTask(task)}
                aria-label={`Mở thẻ kanban ${task.name}`}
                style={{
                  border: draggingTaskId === task.id ? `2px solid ${tokens.colors.primary}` : 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  borderRadius: '16px',
                  padding: '14px',
                  background: tokens.colors.surface,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  boxShadow: '0 10px 22px rgba(15, 23, 42, 0.06)',
                  opacity: draggingTaskId === task.id ? 0.45 : updatingTaskId === task.id ? 0.72 : 1,
                }}
              >
                <div style={{ fontSize: '14px', fontWeight: 900, color: tokens.colors.textPrimary }}>{task.name}</div>
                <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>
                  {task.projectName || 'Chưa gắn dự án'} • {task.assigneeName || 'Chưa phân công'}
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <PriorityBadge priority={normalizePriority(task.priority)} />
                  {isBlocked(task) ? (
                    <span style={{ padding: '4px 10px', borderRadius: '999px', background: '#fdecea', color: '#b42318', fontSize: '11px', fontWeight: 800 }}>
                      Blocked
                    </span>
                  ) : null}
                </div>
                <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>Hạn chót: {formatDate(taskDueDate(task))}</div>
                {updatingTaskId === task.id ? <div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.primary }}>Đang cập nhật...</div> : null}
              </button>
            ))
          )}
        </div>
      ))}
    </div>
  );
}

export function TaskList({
  tasks,
  isMobile,
  onOpenTask,
}: {
  tasks: TaskRecord[];
  isMobile?: boolean;
  onOpenTask: (task: TaskRecord) => void;
}) {
  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {tasks.map((task) => (
          <button
            key={task.id}
            onClick={() => onOpenTask(task)}
            aria-label={`Mở công việc ${task.name}`}
            style={{ ...S.card, padding: '16px', border: 'none', textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '10px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
              <div style={{ fontSize: '14px', fontWeight: 900, color: tokens.colors.textPrimary }}>{task.name}</div>
              <PriorityBadge priority={normalizePriority(task.priority)} />
            </div>
            <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>{task.projectName || 'Chưa gắn dự án'}</div>
            <StatusBadge status={normalizeTaskStatus(task.status)} />
            <ProgressBar value={Number(task.completionPct || 0)} />
          </button>
        ))}
      </div>
    );
  }

  return (
    <div style={{ ...S.card, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['Công việc', 'Project', 'Owner', 'Trạng thái', 'Ưu tiên', 'Hạn chót', 'Tiến độ'].map((header) => (
              <th key={header} style={ui.table.thStatic as any}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id} onClick={() => onOpenTask(task)} style={{ cursor: 'pointer' }} aria-label={`Mở công việc ${task.name}`}>
              <td style={ui.table.td as any}>
                <div style={{ fontWeight: 800 }}>{task.name}</div>
                <div style={{ marginTop: '4px', fontSize: '12px', color: tokens.colors.textSecondary }}>{task.description || 'Không có mô tả ngắn'}</div>
              </td>
              <td style={ui.table.td as any}>{task.projectName || 'Chưa gắn'}</td>
              <td style={ui.table.td as any}>{task.assigneeName || 'Chưa phân công'}</td>
              <td style={ui.table.td as any}><StatusBadge status={normalizeTaskStatus(task.status)} /></td>
              <td style={ui.table.td as any}><PriorityBadge priority={normalizePriority(task.priority)} /></td>
              <td style={ui.table.td as any}>{formatDate(taskDueDate(task))}</td>
              <td style={ui.table.td as any}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 800 }}>{Number(task.completionPct || 0)}%</span>
                  <ProgressBar value={Number(task.completionPct || 0)} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Field({
  label,
  children,
  help,
}: {
  label: string;
  children: any;
  help?: string;
}) {
  return (
    <div>
      <label style={S.label}>{label}</label>
      {children}
      {help ? <div style={{ marginTop: '6px', fontSize: '12px', color: tokens.colors.textMuted }}>{help}</div> : null}
    </div>
  );
}

export function TaskDrawer({
  open,
  mode,
  form,
  saving,
  advanced,
  canEditTask,
  canDeleteTask,
  projects,
  users,
  userLoadWarning,
  accounts,
  leads,
  quotations,
  onChange,
  onToggleAdvanced,
  onClose,
  onSave,
  onDelete,
  onOpenProject,
}: {
  open: boolean;
  mode: DrawerMode;
  form: TaskFormState;
  saving: boolean;
  advanced: boolean;
  canEditTask: boolean;
  canDeleteTask: boolean;
  projects: any[];
  users: any[];
  userLoadWarning?: string;
  accounts: any[];
  leads: any[];
  quotations: any[];
  onChange: (next: TaskFormState) => void;
  onToggleAdvanced: () => void;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
  onOpenProject: () => void;
}) {
  if (!open) return null;
  const disabled = !canEditTask || saving;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.45)' }} />
      <div
        style={{
          position: 'relative',
          width: 'min(520px, 100vw)',
          height: '100%',
          background: tokens.colors.surface,
          borderLeft: `1px solid ${tokens.colors.border}`,
          boxShadow: '-18px 0 40px rgba(15, 23, 42, 0.16)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '20px 20px 16px', borderBottom: `1px solid ${tokens.colors.border}`, display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ padding: '6px 10px', borderRadius: '999px', background: '#eefbf4', color: tokens.colors.primary, fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>
                {mode === 'create' ? 'Quick Add' : 'Task Drawer'}
              </span>
              {!canEditTask ? (
                <span style={{ padding: '6px 10px', borderRadius: '999px', background: '#eef2f6', color: tokens.colors.textSecondary, fontSize: '11px', fontWeight: 800 }}>
                  Read only
                </span>
              ) : null}
            </div>
            <div style={{ marginTop: '10px', fontSize: '20px', fontWeight: 900, color: tokens.colors.textPrimary }}>
              {mode === 'create' ? 'Tạo công việc mới' : form.name || 'Chi tiết công việc'}
            </div>
            <div style={{ marginTop: '6px', fontSize: '13px', color: tokens.colors.textSecondary }}>
              Cập nhật nhanh trạng thái, ưu tiên, lịch và các liên kết vận hành ngay trong cùng màn hình.
            </div>
          </div>
          <button onClick={onClose} aria-label="Đóng drawer công việc" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: tokens.colors.textSecondary }}>
            <CloseIcon size={20} />
          </button>
        </div>

        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="planner-chip"><strong>Quick edit</strong><span>{form.uiStatus === 'complete' ? 'Hoàn tất' : 'Đang mở'}</span></div>
            <div className="planner-chip"><strong>Context</strong><span>{form.projectId ? 'Theo project' : 'Chưa gắn project'}</span></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Tên công việc">
              <input disabled={disabled} style={{ ...S.input, opacity: disabled ? 0.72 : 1 }} value={form.name} onInput={(event: any) => onChange({ ...form, name: event.target.value })} />
            </Field>
            <Field label="Project">
              <select disabled={disabled} style={{ ...S.select, opacity: disabled ? 0.72 : 1 }} value={form.projectId} onChange={(event: any) => onChange({ ...form, projectId: event.target.value })}>
                <option value="">Chưa gắn project</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Mô tả ngắn">
            <textarea disabled={disabled} style={{ ...S.textarea, opacity: disabled ? 0.72 : 1 }} value={form.description} onInput={(event: any) => onChange({ ...form, description: event.target.value })} />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Owner">
              <select disabled={disabled} style={{ ...S.select, opacity: disabled ? 0.72 : 1 }} value={form.assigneeId} onChange={(event: any) => onChange({ ...form, assigneeId: event.target.value })}>
                <option value="">Chưa phân công</option>
                {users.map((user) => <option key={user.id} value={user.id}>{user.fullName || user.username}</option>)}
              </select>
              {userLoadWarning ? (
                <div style={{ marginTop: '6px', fontSize: '12px', color: tokens.colors.warning, fontWeight: 700 }}>
                  {userLoadWarning}
                </div>
              ) : null}
            </Field>
            <Field label="Trạng thái">
              <select
                disabled={disabled}
                style={{ ...S.select, opacity: disabled ? 0.72 : 1 }}
                value={form.uiStatus}
                onChange={(event: any) => onChange({ ...form, uiStatus: event.target.value, completionPct: event.target.value === 'complete' ? 100 : form.completionPct })}
              >
                {(Object.keys(UI_STATUS_META) as UiTaskStatus[]).map((status) => <option key={status} value={status}>{UI_STATUS_META[status].label}</option>)}
              </select>
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Ưu tiên">
              <select disabled={disabled} style={{ ...S.select, opacity: disabled ? 0.72 : 1 }} value={form.priority} onChange={(event: any) => onChange({ ...form, priority: event.target.value })}>
                {(Object.keys(PRIORITY_META) as TaskPriority[]).map((priority) => <option key={priority} value={priority}>{PRIORITY_META[priority].label}</option>)}
              </select>
            </Field>
            <Field label="Blocker">
              <input disabled={disabled} style={{ ...S.input, opacity: disabled ? 0.72 : 1 }} value={form.blockedReason} onInput={(event: any) => onChange({ ...form, blockedReason: event.target.value })} placeholder="Nguyên nhân đang chặn..." />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Ngày bắt đầu">
              <input disabled={disabled} type="date" style={{ ...S.input, opacity: disabled ? 0.72 : 1 }} value={form.startDate} onInput={(event: any) => onChange({ ...form, startDate: event.target.value })} />
            </Field>
            <Field label="Hạn chót">
              <input disabled={disabled} type="date" style={{ ...S.input, opacity: disabled ? 0.72 : 1 }} value={form.dueDate} onInput={(event: any) => onChange({ ...form, dueDate: event.target.value })} />
            </Field>
          </div>

          <Field label={`Tiến độ ${form.completionPct}%`}>
            <input disabled={disabled} type="range" min={0} max={100} step={5} style={{ width: '100%', accentColor: tokens.colors.primary, opacity: disabled ? 0.72 : 1 }} value={form.completionPct} onInput={(event: any) => onChange({ ...form, completionPct: Number(event.target.value) })} />
          </Field>

          <Field label="Ghi chú nhanh">
            <textarea disabled={disabled} style={{ ...S.textarea, opacity: disabled ? 0.72 : 1 }} value={form.notes} onInput={(event: any) => onChange({ ...form, notes: event.target.value })} />
          </Field>

          <div style={{ height: '1px', background: tokens.colors.border, margin: '2px 0' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 900, color: tokens.colors.textPrimary }}>Thông tin nâng cao</div>
              <div style={{ marginTop: '4px', fontSize: '12px', color: tokens.colors.textSecondary }}>
                taskType, department, account/lead/quotation và đầu ra bàn giao.
              </div>
            </div>
            <button onClick={onToggleAdvanced} style={S.btnOutline}>{advanced ? 'Thu gọn' : 'Mở rộng'}</button>
          </div>

          {advanced ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Field label="Loại công việc">
                  <select disabled={disabled} style={{ ...S.select, opacity: disabled ? 0.72 : 1 }} value={form.taskType} onChange={(event: any) => onChange({ ...form, taskType: event.target.value })}>
                    {taskTypeValueOptions().map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </Field>
                <Field label="Phòng ban">
                  <select disabled={disabled} style={{ ...S.select, opacity: disabled ? 0.72 : 1 }} value={form.department} onChange={(event: any) => onChange({ ...form, department: event.target.value })}>
                    {departmentValueOptions().map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Field label="Account">
                  <select disabled={disabled} style={{ ...S.select, opacity: disabled ? 0.72 : 1 }} value={form.accountId} onChange={(event: any) => onChange({ ...form, accountId: event.target.value })}>
                    <option value="">Không liên kết</option>
                    {accounts.map((account) => <option key={account.id} value={account.id}>{account.companyName || account.name}</option>)}
                  </select>
                </Field>
                <Field label="Lead">
                  <select disabled={disabled} style={{ ...S.select, opacity: disabled ? 0.72 : 1 }} value={form.leadId} onChange={(event: any) => onChange({ ...form, leadId: event.target.value })}>
                    <option value="">Không liên kết</option>
                    {leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.companyName || lead.contactName || lead.name || lead.id}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Quotation">
                <select disabled={disabled} style={{ ...S.select, opacity: disabled ? 0.72 : 1 }} value={form.quotationId} onChange={(event: any) => onChange({ ...form, quotationId: event.target.value })}>
                  <option value="">Không liên kết</option>
                  {quotations.map((quotation) => <option key={quotation.id} value={quotation.id}>{quotation.quoteNumber || quotation.subject || quotation.id}</option>)}
                </select>
              </Field>
              <Field label="Target / mục tiêu">
                <input disabled={disabled} style={{ ...S.input, opacity: disabled ? 0.72 : 1 }} value={form.target} onInput={(event: any) => onChange({ ...form, target: event.target.value })} />
              </Field>
              <Field label="Links / bằng chứng">
                <textarea disabled={disabled} style={{ ...S.textarea, opacity: disabled ? 0.72 : 1 }} value={form.resultLinks} onInput={(event: any) => onChange({ ...form, resultLinks: event.target.value })} />
              </Field>
              <Field label="Output">
                <textarea disabled={disabled} style={{ ...S.textarea, opacity: disabled ? 0.72 : 1 }} value={form.output} onInput={(event: any) => onChange({ ...form, output: event.target.value })} />
              </Field>
              <Field label="Ngày báo cáo">
                <input disabled={disabled} type="date" style={{ ...S.input, opacity: disabled ? 0.72 : 1 }} value={form.reportDate} onInput={(event: any) => onChange({ ...form, reportDate: event.target.value })} />
              </Field>
            </div>
          ) : null}
        </div>

        <div className="drawer-footer" style={{ padding: '16px 20px', borderTop: `1px solid ${tokens.colors.border}`, display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {mode === 'edit' ? <button onClick={onOpenProject} style={S.btnGhost}>Mở project</button> : null}
            {mode === 'edit' && canDeleteTask ? <button onClick={onDelete} style={S.btnDanger}>Xóa</button> : null}
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={onClose} style={S.btnOutline}>Đóng</button>
            {canEditTask ? <button onClick={onSave} style={S.btnPrimary}>{saving ? 'Đang lưu...' : 'Lưu thay đổi'}</button> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

