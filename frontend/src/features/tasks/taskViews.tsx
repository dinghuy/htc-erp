import { ui } from '../../ui/styles';
import { OverlayPortal, getOverlayContainerStyle } from '../../ui/overlay';
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
import type { TaskWorkHubSummary } from './taskWorkHubData';
import { groupTasks, type TaskGroupBy } from './taskGrouping';

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
const F = tokens.fontSize;

function ProgressBar({ value }: { value: number }) {
  const safeValue = Math.min(100, Math.max(0, Number(value || 0)));
  return (
    <div
      style={{
        width: '100%',
        height: '8px',
        borderRadius: '999px',
        overflow: 'hidden',
        background: tokens.colors.progressTrack,
      }}
    >
      <div
        style={{
          width: `${safeValue}%`,
          height: '100%',
          borderRadius: '999px',
          background: safeValue >= 100 ? tokens.colors.progressComplete : tokens.colors.primary,
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
        fontSize: F.xs,
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
        fontSize: F.xs,
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
        fontSize: F.md,
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
  surface = tokens.colors.surfaceSubtle,
}: {
  icon: any;
  label: string;
  value: number;
  note: string;
  accent: string;
  surface?: string;
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
            background: surface,
            color: accent,
          }}
        >
          <Icon size={18} />
        </div>
      </div>
      <div>
        <div style={{ fontSize: F.displayMd, fontWeight: 900, lineHeight: 1, color: tokens.colors.textPrimary }}>{value}</div>
        <div style={{ fontSize: F.base, fontWeight: 800, color: tokens.colors.textPrimary, marginTop: '10px' }}>{label}</div>
        <div style={{ fontSize: F.sm, color: tokens.colors.textSecondary, marginTop: '6px', lineHeight: 1.45 }}>{note}</div>
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
  selectedTaskIds = [],
  onDragStart,
  onHoverStatus,
  onDropStatus,
  onOpenTask,
  onToggleTaskSelection,
  onOpenWorkflow,
}: {
  tasks: TaskRecord[];
  draggingTaskId: string;
  hoveredStatus: UiTaskStatus | '';
  updatingTaskId: string;
  canDrag: boolean;
  selectedTaskIds?: string[];
  onDragStart: (taskId: string) => void;
  onHoverStatus: (status: UiTaskStatus | '') => void;
  onDropStatus: (status: UiTaskStatus) => void;
  onOpenTask: (task: TaskRecord) => void;
  onToggleTaskSelection?: (taskId: string, checked: boolean) => void;
  onOpenWorkflow: (task: TaskRecord) => void;
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
            <span style={{ fontSize: F.sm, fontWeight: 800, color: column.meta.accent }}>
              {hoveredStatus === column.key && draggingTaskId ? 'Thả vào đây' : column.tasks.length}
            </span>
          </div>
          {column.tasks.length === 0 ? (
            <div style={{ fontSize: F.sm, color: tokens.colors.textMuted }}>Kéo công việc vào đây để cập nhật trạng thái.</div>
          ) : (
            column.tasks.map((task) => {
              const isSelected = selectedTaskIds.includes(task.id);

              return (
                <div
                  className="planner-interactive"
                  key={task.id}
                  role="button"
                  tabIndex={0}
                  draggable={canDrag}
                  onDragStart={() => onDragStart(task.id)}
                  onDragEnd={() => onHoverStatus('')}
                  onClick={() => onOpenTask(task)}
                  onKeyDown={(event: any) => {
                    if (event.target !== event.currentTarget) {
                      return;
                    }
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onOpenTask(task);
                    }
                  }}
                  aria-label={`Mở thẻ kanban ${task.name}`}
                  style={{
                    border: draggingTaskId === task.id ? `2px solid ${tokens.colors.primary}` : `1px solid ${isSelected ? column.meta.accent : tokens.colors.border}`,
                    cursor: 'pointer',
                    textAlign: 'left',
                    borderRadius: '16px',
                    padding: '14px',
                    background: tokens.colors.surface,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    boxShadow: isSelected
                      ? `0 0 0 3px ${column.meta.soft}, ${tokens.interaction.shadowMd}`
                      : tokens.interaction.shadowMd,
                    opacity: draggingTaskId === task.id ? 0.45 : updatingTaskId === task.id ? 0.72 : 1,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: F.base, fontWeight: 900, color: tokens.colors.textPrimary }}>{task.name}</div>
                      <div style={{ marginTop: '4px', fontSize: F.sm, color: tokens.colors.textSecondary }}>
                        {task.projectName || 'Chưa gắn dự án'} • {task.assigneeName || 'Chưa phân công'}
                      </div>
                    </div>
                    <label
                      onClick={(event: any) => event.stopPropagation()}
                      onMouseDown={(event: any) => event.stopPropagation()}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: F.xs,
                        fontWeight: 800,
                        color: isSelected ? column.meta.accent : tokens.colors.textSecondary,
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        aria-label={`Chọn công việc ${task.name}`}
                        onClick={(event: any) => event.stopPropagation()}
                        onKeyDown={(event: any) => event.stopPropagation()}
                        onChange={(event: any) => onToggleTaskSelection?.(task.id, Boolean(event.target.checked))}
                        style={{ accentColor: tokens.colors.primary }}
                      />
                      Chọn
                    </label>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <PriorityBadge priority={normalizePriority(task.priority)} />
                    {task.actionAvailability?.workspaceTab ? (
                      <span style={{ padding: '4px 10px', borderRadius: '999px', background: tokens.colors.taskTabBg, color: tokens.colors.taskTabText, fontSize: F.xs, fontWeight: 800 }}>
                        Tab {task.actionAvailability.workspaceTab}
                      </span>
                    ) : null}
                    {isBlocked(task) ? (
                      <span style={{ padding: '4px 10px', borderRadius: '999px', background: tokens.colors.taskBlockedBg, color: tokens.colors.taskBlockedText, fontSize: F.xs, fontWeight: 800 }}>
                        Blocked
                      </span>
                    ) : null}
                  </div>
                  <div style={{ fontSize: F.sm, color: tokens.colors.textSecondary }}>Hạn chót: {formatDate(taskDueDate(task))}</div>
                  {task.actionAvailability?.blockers?.[0] ? (
                    <div style={{ fontSize: F.sm, color: tokens.colors.warningStrong, fontWeight: 700 }}>
                      {task.actionAvailability.blockers[0]}
                    </div>
                  ) : null}
                  {(task.actionAvailability?.canOpenProject || task.actionAvailability?.canOpenQuotation) ? (
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenWorkflow(task);
                        }}
                        onKeyDown={(event: any) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            event.stopPropagation();
                            onOpenWorkflow(task);
                          }
                        }}
                        style={{ ...S.btnGhost, padding: '8px 10px', fontSize: F.sm, cursor: 'pointer' }}
                      >
                        {task.actionAvailability?.primaryActionLabel || 'Mở workflow'}
                      </span>
                    </div>
                  ) : null}
                  {updatingTaskId === task.id ? <div style={{ fontSize: F.xs, fontWeight: 800, color: tokens.colors.primary }}>Đang cập nhật...</div> : null}
                </div>
              );
            })
          )}
        </div>
      ))}
    </div>
  );
}

export function TaskList({
  tasks,
  groupBy = 'none',
  isMobile,
  selectedTaskIds = [],
  onToggleTask,
  onToggleAllTasks,
  canReorderProjectTasks = false,
  onMoveProjectTask,
  onOpenTask,
  onOpenWorkflow,
}: {
  tasks: TaskRecord[];
  groupBy?: TaskGroupBy;
  isMobile?: boolean;
  selectedTaskIds?: string[];
  onToggleTask?: (taskId: string, checked: boolean) => void;
  onToggleAllTasks?: (checked: boolean) => void;
  canReorderProjectTasks?: boolean;
  onMoveProjectTask?: (taskId: string, direction: 'up' | 'down') => void;
  onOpenTask: (task: TaskRecord) => void;
  onOpenWorkflow: (task: TaskRecord) => void;
}) {
  const sections = groupTasks(tasks, groupBy);
  const allSelected = tasks.length > 0 && tasks.every((task) => selectedTaskIds.includes(task.id));

  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {sections.map((section) => (
          <div key={section.key} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {groupBy !== 'none' ? <div style={{ fontSize: F.sm, fontWeight: 900, color: tokens.colors.textPrimary }}>{section.label} · {section.tasks.length}</div> : null}
            {section.tasks.map((task) => (
              <button
                key={task.id}
                onClick={() => onOpenTask(task)}
                aria-label={`Mở công việc ${task.name}`}
                style={{ ...S.card, padding: '16px', border: 'none', textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '10px' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                  <div style={{ fontSize: F.base, fontWeight: 900, color: tokens.colors.textPrimary }}>{task.name}</div>
                  <PriorityBadge priority={normalizePriority(task.priority)} />
                </div>
                <div style={{ fontSize: F.sm, color: tokens.colors.textSecondary }}>{task.projectName || 'Chưa gắn dự án'}</div>
                {(Number(task.subtaskCount || 0) > 0 || Number(task.checklistCount || 0) > 0) ? (
                  <div style={{ fontSize: F.xs, color: tokens.colors.textMuted }}>
                    Rollup {Number(task.rollupCompletionPct ?? 0)}% · {Number(task.completedSubtaskCount || 0)}/{Number(task.subtaskCount || 0)} subtasks · {Number(task.checklistCompletedCount || 0)}/{Number(task.checklistCount || 0)} checklist
                  </div>
                ) : null}
                {task.actionAvailability?.workspaceTab ? (
                  <div style={{ fontSize: F.xs, fontWeight: 800, color: tokens.colors.taskTabText }}>
                    Tab {task.actionAvailability.workspaceTab}
                  </div>
                ) : null}
                <StatusBadge status={normalizeTaskStatus(task.status)} />
                <ProgressBar value={Number(task.completionPct || 0)} />
                {(task.actionAvailability?.canOpenProject || task.actionAvailability?.canOpenQuotation) ? (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenWorkflow(task);
                    }}
                    onKeyDown={(event: any) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        event.stopPropagation();
                        onOpenWorkflow(task);
                      }
                    }}
                    style={{ ...S.btnGhost, alignSelf: 'flex-start', padding: '8px 10px', fontSize: F.sm, cursor: 'pointer' }}
                  >
                    {task.actionAvailability?.primaryActionLabel || 'Mở workflow'}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '14px' }}>
      {sections.map((section) => (
        <div key={section.key} style={{ ...S.card, overflow: 'hidden' }}>
          {groupBy !== 'none' ? (
            <div style={{ padding: '14px 16px', borderBottom: `1px solid ${tokens.colors.border}`, fontSize: F.sm, fontWeight: 900, color: tokens.colors.textPrimary }}>
              {section.label} · {section.tasks.length}
            </div>
          ) : null}
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={ui.table.thStatic as any}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(event: any) => onToggleAllTasks?.(Boolean(event.target.checked))}
                  />
                </th>
                {['Công việc', 'Project', 'Owner', 'Trạng thái', 'Ưu tiên', 'Hạn chót', 'Tiến độ'].map((header) => (
                  <th key={header} style={ui.table.thStatic as any}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.tasks.map((task, index) => (
                <tr key={task.id} onClick={() => onOpenTask(task)} style={{ cursor: 'pointer' }} aria-label={`Mở công việc ${task.name}`}>
                  <td style={ui.table.td as any}>
                    <input
                      type="checkbox"
                      checked={selectedTaskIds.includes(task.id)}
                      onClick={(event: any) => event.stopPropagation()}
                      onChange={(event: any) => onToggleTask?.(task.id, Boolean(event.target.checked))}
                    />
                  </td>
                  <td style={ui.table.td as any}>
                    <div style={{ fontWeight: 800, paddingLeft: `${Number((task as any).depth || 0) * 18}px` }}>
                      {Number((task as any).depth || 0) > 0 ? '↳ ' : ''}
                    {task.name}
                  </div>
                  <div style={{ marginTop: '4px', fontSize: F.sm, color: tokens.colors.textSecondary }}>{task.description || 'Không có mô tả ngắn'}</div>
                  {(Number(task.subtaskCount || 0) > 0 || Number(task.checklistCount || 0) > 0) ? (
                    <div style={{ marginTop: '4px', fontSize: F.xs, color: tokens.colors.textMuted }}>
                      Rollup {Number(task.rollupCompletionPct ?? 0)}% · {Number(task.completedSubtaskCount || 0)}/{Number(task.subtaskCount || 0)} subtasks · {Number(task.checklistCompletedCount || 0)}/{Number(task.checklistCount || 0)} checklist
                    </div>
                  ) : null}
                  {task.actionAvailability?.workspaceTab ? (
                      <div style={{ marginTop: '6px', fontSize: F.xs, fontWeight: 800, color: tokens.colors.taskTabText }}>
                        Tab {task.actionAvailability.workspaceTab}
                      </div>
                    ) : null}
                    {task.actionAvailability?.blockers?.[0] ? (
                      <div style={{ marginTop: '6px', fontSize: F.sm, color: tokens.colors.warningStrong, fontWeight: 700 }}>
                        {task.actionAvailability.blockers[0]}
                      </div>
                    ) : null}
                  </td>
                  <td style={ui.table.td as any}>{task.projectName || 'Chưa gắn'}</td>
                  <td style={ui.table.td as any}>{task.assigneeName || 'Chưa phân công'}</td>
                  <td style={ui.table.td as any}><StatusBadge status={normalizeTaskStatus(task.status)} /></td>
                  <td style={ui.table.td as any}><PriorityBadge priority={normalizePriority(task.priority)} /></td>
                  <td style={ui.table.td as any}>{formatDate(taskDueDate(task))}</td>
                  <td style={ui.table.td as any}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: F.sm, fontWeight: 800 }}>{Number(task.completionPct || 0)}%</span>
                      <ProgressBar value={Number(task.completionPct || 0)} />
                      {canReorderProjectTasks && !task.parentTaskId ? (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onMoveProjectTask?.(task.id, 'up');
                            }}
                            style={{ ...S.btnGhost, alignSelf: 'flex-start', padding: '4px 8px', fontSize: F.xs }}
                            disabled={index === 0}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onMoveProjectTask?.(task.id, 'down');
                            }}
                            style={{ ...S.btnGhost, alignSelf: 'flex-start', padding: '4px 8px', fontSize: F.xs }}
                            disabled={index === section.tasks.length - 1}
                          >
                            ↓
                          </button>
                        </div>
                      ) : null}
                      {(task.actionAvailability?.canOpenProject || task.actionAvailability?.canOpenQuotation) ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onOpenWorkflow(task);
                          }}
                          style={{ ...S.btnGhost, alignSelf: 'flex-start', padding: '6px 10px', fontSize: F.sm }}
                        >
                          {task.actionAvailability?.primaryActionLabel || 'Mở workflow'}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
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
      {help ? <div style={{ marginTop: '6px', fontSize: F.sm, color: tokens.colors.textMuted }}>{help}</div> : null}
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
  workHubSummary,
  checklistItems,
  checklistDraft,
  checklistEditingId,
  checklistEditingTitle,
  onChecklistDraftChange,
  onAddChecklistItem,
  onToggleChecklistItem,
  onDeleteChecklistItem,
  onStartChecklistEdit,
  onChecklistEditingTitleChange,
  onSaveChecklistItem,
  onCancelChecklistEdit,
  subtasks,
  subtaskDraft,
  subtaskEditingId,
  subtaskEditingTitle,
  onSubtaskDraftChange,
  onAddSubtask,
  onMoveSubtask,
  onDeleteSubtask,
  onStartSubtaskEdit,
  onSubtaskEditingTitleChange,
  onSaveSubtask,
  onCancelSubtaskEdit,
  threadMessages,
  threadDraft,
  onThreadDraftChange,
  onOpenThread,
  onSendThreadMessage,
  sendingThreadMessage,
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
  workHubSummary?: TaskWorkHubSummary | null;
  checklistItems?: any[];
  checklistDraft?: string;
  checklistEditingId?: string;
  checklistEditingTitle?: string;
  onChecklistDraftChange?: (value: string) => void;
  onAddChecklistItem?: () => void;
  onToggleChecklistItem?: (item: any, done: boolean) => void;
  onDeleteChecklistItem?: (itemId: string) => void;
  onStartChecklistEdit?: (item: any) => void;
  onChecklistEditingTitleChange?: (value: string) => void;
  onSaveChecklistItem?: () => void;
  onCancelChecklistEdit?: () => void;
  subtasks?: TaskRecord[];
  subtaskDraft?: string;
  subtaskEditingId?: string;
  subtaskEditingTitle?: string;
  onSubtaskDraftChange?: (value: string) => void;
  onAddSubtask?: () => void;
  onMoveSubtask?: (taskId: string, direction: 'up' | 'down') => void;
  onDeleteSubtask?: (taskId: string) => void;
  onStartSubtaskEdit?: (task: TaskRecord) => void;
  onSubtaskEditingTitleChange?: (value: string) => void;
  onSaveSubtask?: () => void;
  onCancelSubtaskEdit?: () => void;
  threadMessages?: any[];
  threadDraft?: string;
  onThreadDraftChange?: (value: string) => void;
  onOpenThread?: () => void;
  onSendThreadMessage?: () => void;
  sendingThreadMessage?: boolean;
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
    <OverlayPortal>
      <div style={getOverlayContainerStyle('drawer', { padding: '0', alignItems: 'stretch', justifyContent: 'flex-end' })}>
        <div
          onClick={onClose}
          style={{
            position: 'absolute',
            inset: 0,
            background: tokens.overlay.softBackdrop,
            backdropFilter: `blur(${tokens.overlay.backdropBlur})`,
            WebkitBackdropFilter: `blur(${tokens.overlay.backdropBlur})`,
          }}
        />
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            width: 'min(520px, 100vw)',
            height: '100%',
            ...ui.overlay.drawer,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
        <div style={{ padding: '20px 20px 16px', borderBottom: `1px solid ${tokens.colors.border}`, display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ padding: '6px 10px', borderRadius: '999px', background: tokens.colors.surfaceSuccessSoft, color: tokens.colors.primary, fontSize: F.xs, fontWeight: 800, textTransform: 'uppercase' }}>
                {mode === 'create' ? 'Quick Add' : 'Task Drawer'}
              </span>
              {!canEditTask ? (
                <span style={{ padding: '6px 10px', borderRadius: '999px', background: tokens.colors.surfaceSubtle, color: tokens.colors.textSecondary, fontSize: F.xs, fontWeight: 800 }}>
                  Read only
                </span>
              ) : null}
            </div>
            <div style={{ marginTop: '10px', fontSize: F.title, fontWeight: 900, color: tokens.colors.textPrimary }}>
              {mode === 'create' ? 'Tạo công việc mới' : form.name || 'Chi tiết công việc'}
            </div>
            <div style={{ marginTop: '6px', fontSize: F.md, color: tokens.colors.textSecondary }}>
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

          {workHubSummary ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ ...S.card, padding: '14px', display: 'grid', gap: '6px' }}>
                <div style={{ fontSize: F.sm, fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase' }}>Work Hub</div>
                <div style={{ fontSize: F.lg, fontWeight: 900, color: tokens.colors.textPrimary }}>
                  {workHubSummary.dependencyCount} dependencies
                </div>
                <div style={{ fontSize: F.sm, color: tokens.colors.textSecondary }}>
                  {workHubSummary.blockedByCount} blocker trực tiếp từ task khác
                </div>
              </div>
              <div style={{ ...S.card, padding: '14px', display: 'grid', gap: '6px' }}>
                <div style={{ fontSize: F.sm, fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase' }}>Worklogs</div>
                <div style={{ fontSize: F.lg, fontWeight: 900, color: tokens.colors.textPrimary }}>
                  {Math.round((workHubSummary.totalLoggedMinutes / 60) * 10) / 10}h
                </div>
                <div style={{ fontSize: F.sm, color: tokens.colors.textSecondary }}>
                  {workHubSummary.worklogCount} bản ghi · {workHubSummary.latestWorklog?.summary || 'Chưa có worklog'}
                </div>
              </div>
              <div style={{ ...S.card, padding: '14px', display: 'grid', gap: '6px' }}>
                <div style={{ fontSize: F.sm, fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase' }}>Checklist</div>
                <div style={{ fontSize: F.lg, fontWeight: 900, color: tokens.colors.textPrimary }}>
                  {workHubSummary.checklistCompletedCount}/{workHubSummary.checklistCount}
                </div>
                <div style={{ fontSize: F.sm, color: tokens.colors.textSecondary }}>
                  Checklist item đã hoàn tất trên task này
                </div>
              </div>
            </div>
          ) : null}

          {Array.isArray(checklistItems) ? (
            <div style={{ ...S.card, padding: '14px', display: 'grid', gap: '10px' }}>
              <div style={{ fontSize: F.sm, fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase' }}>Task checklist</div>
              {checklistItems.length === 0 ? <div style={{ fontSize: F.sm, color: tokens.colors.textSecondary }}>Chưa có checklist item nào.</div> : (
                <div style={{ display: 'grid', gap: '8px' }}>
                  {checklistItems.map((item: any) => (
                    <div key={item.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '10px', alignItems: 'start', border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.md, padding: '10px 12px' }}>
                      <input type="checkbox" checked={Boolean(item.doneAt)} onChange={(event: any) => onToggleChecklistItem?.(item, Boolean(event.target.checked))} />
                      <div>
                        {checklistEditingId === item.id ? (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '6px' }}>
                            <input style={S.input} value={checklistEditingTitle || ''} onInput={(event: any) => onChecklistEditingTitleChange?.(event.target.value)} />
                            <button type="button" onClick={onSaveChecklistItem} style={{ ...S.btnOutline, padding: '4px 8px', fontSize: F.xs }}>Lưu</button>
                            <button type="button" onClick={onCancelChecklistEdit} style={{ ...S.btnGhost, padding: '4px 8px', fontSize: F.xs }}>Hủy</button>
                          </div>
                        ) : (
                          <div style={{ fontSize: F.sm, fontWeight: 800, color: tokens.colors.textPrimary, textDecoration: item.doneAt ? 'line-through' : 'none' }}>{item.title}</div>
                        )}
                        {item.description ? <div style={{ marginTop: '4px', fontSize: F.sm, color: tokens.colors.textSecondary }}>{item.description}</div> : null}
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button type="button" onClick={() => onStartChecklistEdit?.(item)} style={{ ...S.btnGhost, padding: '4px 8px', fontSize: F.xs }}>Sửa</button>
                        <button type="button" onClick={() => onDeleteChecklistItem?.(item.id)} style={{ ...S.btnGhost, padding: '4px 8px', fontSize: F.xs }}>Xóa</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {onChecklistDraftChange && onAddChecklistItem ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px' }}>
                  <input style={S.input} value={checklistDraft || ''} placeholder="Thêm checklist item..." onInput={(event: any) => onChecklistDraftChange(event.target.value)} />
                  <button onClick={onAddChecklistItem} style={S.btnOutline}>Thêm</button>
                </div>
              ) : null}
            </div>
          ) : null}

          {Array.isArray(subtasks) ? (
            <div style={{ ...S.card, padding: '14px', display: 'grid', gap: '10px' }}>
              <div style={{ fontSize: F.sm, fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase' }}>Subtasks</div>
              {subtasks.length === 0 ? <div style={{ fontSize: F.sm, color: tokens.colors.textSecondary }}>Chưa có subtask nào.</div> : (
                <div style={{ display: 'grid', gap: '8px' }}>
                  {subtasks.map((task, index) => (
                    <div key={task.id} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.md, padding: '10px 12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {subtaskEditingId === task.id ? (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '6px', flex: 1 }}>
                            <input style={S.input} value={subtaskEditingTitle || ''} onInput={(event: any) => onSubtaskEditingTitleChange?.(event.target.value)} />
                            <button type="button" onClick={onSaveSubtask} style={{ ...S.btnOutline, padding: '4px 8px', fontSize: F.xs }}>Lưu</button>
                            <button type="button" onClick={onCancelSubtaskEdit} style={{ ...S.btnGhost, padding: '4px 8px', fontSize: F.xs }}>Hủy</button>
                          </div>
                        ) : (
                          <div style={{ fontSize: F.sm, fontWeight: 800, color: tokens.colors.textPrimary }}>{task.name}</div>
                        )}
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          {onMoveSubtask ? (
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button type="button" style={{ ...S.btnGhost, padding: '4px 8px', fontSize: F.xs }} disabled={index === 0} onClick={() => onMoveSubtask(task.id, 'up')}>↑</button>
                              <button type="button" style={{ ...S.btnGhost, padding: '4px 8px', fontSize: F.xs }} disabled={index === subtasks.length - 1} onClick={() => onMoveSubtask(task.id, 'down')}>↓</button>
                            </div>
                          ) : null}
                          <button type="button" onClick={() => onStartSubtaskEdit?.(task)} style={{ ...S.btnGhost, padding: '4px 8px', fontSize: F.xs }}>Sửa</button>
                          <button type="button" onClick={() => onDeleteSubtask?.(task.id)} style={{ ...S.btnGhost, padding: '4px 8px', fontSize: F.xs }}>Xóa</button>
                          <StatusBadge status={normalizeTaskStatus(task.status)} />
                        </div>
                      </div>
                      <div style={{ marginTop: '4px', fontSize: F.sm, color: tokens.colors.textSecondary }}>
                        {task.assigneeName || 'Chưa phân công'} · {task.taskType || 'subtask'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {onSubtaskDraftChange && onAddSubtask ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px' }}>
                  <input style={S.input} value={subtaskDraft || ''} placeholder="Thêm subtask..." onInput={(event: any) => onSubtaskDraftChange(event.target.value)} />
                  <button onClick={onAddSubtask} style={S.btnOutline}>Tạo</button>
                </div>
              ) : null}
            </div>
          ) : null}

          {workHubSummary ? (
            <div style={{ ...S.card, padding: '14px', display: 'grid', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: F.sm, fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase' }}>Task thread</div>
                  <div style={{ fontSize: F.base, fontWeight: 800, color: tokens.colors.textPrimary }}>
                    {workHubSummary.hasActiveThread ? 'Đang hoạt động' : 'Chưa tạo thread'}
                  </div>
                </div>
                <button onClick={onOpenThread} style={S.btnOutline}>
                  {workHubSummary.threadId ? 'Mở thread' : 'Tạo thread'}
                </button>
              </div>
              {Array.isArray(threadMessages) && threadMessages.length > 0 ? (
                <div style={{ display: 'grid', gap: '8px' }}>
                  {threadMessages.slice(0, 2).map((message: any) => (
                    <div key={message.id} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.md, padding: '10px 12px' }}>
                      <div style={{ fontSize: F.xs, fontWeight: 800, color: tokens.colors.textPrimary }}>{message.authorName || message.authorUserId || 'System'}</div>
                      <div style={{ marginTop: '4px', fontSize: F.sm, color: tokens.colors.textSecondary }}>{message.content}</div>
                    </div>
                  ))}
                </div>
              ) : null}
              {onThreadDraftChange && onSendThreadMessage ? (
                <div style={{ display: 'grid', gap: '8px' }}>
                  <textarea rows={3} style={{ ...S.textarea, fontFamily: 'inherit' }} value={threadDraft || ''} onInput={(event: any) => onThreadDraftChange(event.target.value)} />
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={onSendThreadMessage} style={S.btnPrimary}>{sendingThreadMessage ? 'Đang gửi...' : 'Gửi thread message'}</button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

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
                <div style={{ marginTop: '6px', fontSize: F.sm, color: tokens.colors.warning, fontWeight: 700 }}>
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
              <div style={{ fontSize: F.base, fontWeight: 900, color: tokens.colors.textPrimary }}>Thông tin nâng cao</div>
              <div style={{ marginTop: '4px', fontSize: F.sm, color: tokens.colors.textSecondary }}>
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
    </OverlayPortal>
  );
}
