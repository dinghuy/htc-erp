import { API_BASE } from './config';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { showNotify } from './Notification';
import { fetchWithAuth } from './auth';
import { consumeNavContext, setNavContext } from './navContext';
import { tokens } from './ui/tokens';
import { ui } from './ui/styles';
import {
  CalendarIcon,
  CloseIcon,
  PlusIcon,
  SearchIcon,
  TasksIcon,
  WarningIcon,
} from './ui/icons';
import {
  ALL_PROJECT,
  backendStatusFromUi,
  buildTaskPayload,
  isBlocked,
  isDueToday,
  isOverdue,
  matchesTaskSearch,
  normalizePriority,
  normalizeTaskStatus,
  PRIORITY_META,
  sortTasksByUrgency,
  type SurfaceKey,
  type TaskRecord,
  type UiTaskStatus,
  UI_STATUS_META,
} from './features/tasks/taskDomain';
import { loadTaskWorkspaceData } from './features/tasks/taskData';
import {
  closeDrawerState,
  createClosedDrawerState,
  createOpenDrawerState,
  type TaskDrawerState,
} from './features/tasks/taskDrawerState';
import {
  KanbanBoard,
  MetricTile,
  SurfaceTab,
  TaskDrawer,
  TaskList,
} from './features/tasks/taskViews';
import { buildTaskAccess } from './features/tasks/taskPermissions';

const API = API_BASE;

const TASKS_POLISH_CSS = `
.tasks-workspace {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.tasks-workspace button,
.tasks-workspace input,
.tasks-workspace select,
.tasks-workspace textarea {
  transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease, background-color .18s ease, opacity .18s ease;
}
.tasks-workspace button:focus-visible,
.tasks-workspace input:focus-visible,
.tasks-workspace select:focus-visible,
.tasks-workspace textarea:focus-visible {
  outline: 0;
  box-shadow: 0 0 0 3px rgba(11, 163, 96, 0.18);
  border-color: var(--ht-green);
}
.tasks-workspace .planner-surface {
  position: relative;
  overflow: hidden;
}
.tasks-workspace .planner-surface::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(255,255,255,.5) 0%, rgba(255,255,255,0) 24%);
  pointer-events: none;
}
.tasks-workspace .planner-interactive:hover {
  transform: translateY(-1px);
  box-shadow: 0 16px 32px rgba(15, 23, 42, 0.08);
}
.tasks-workspace .planner-tab:hover {
  box-shadow: 0 10px 20px rgba(15, 23, 42, 0.08);
}
.tasks-workspace .planner-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(255,255,255,.7);
  border: 1px solid var(--border-color);
  font-size: 12px;
  font-weight: 700;
  color: var(--text-secondary);
}
.tasks-workspace .planner-chip strong {
  color: var(--text-primary);
}
.tasks-workspace .planner-inline-empty {
  padding: 18px 16px;
  border-radius: 16px;
  border: 1px dashed var(--border-color);
  background: linear-gradient(180deg, rgba(248,250,252,.9) 0%, rgba(255,255,255,1) 100%);
  color: var(--text-secondary);
  font-size: 13px;
}
.tasks-workspace .planner-skeleton {
  position: relative;
  overflow: hidden;
  background: linear-gradient(90deg, rgba(241,245,249,.9) 25%, rgba(255,255,255,.92) 37%, rgba(241,245,249,.9) 63%);
  background-size: 400% 100%;
  animation: plannerShimmer 1.6s ease infinite;
}
@keyframes plannerShimmer {
  0% { background-position: 100% 0; }
  100% { background-position: 0 0; }
}
.tasks-workspace .kanban-drop-target {
  box-shadow: inset 0 0 0 2px rgba(11, 163, 96, 0.3), 0 16px 32px rgba(11, 163, 96, 0.08);
}
.tasks-workspace .drawer-footer {
  position: sticky;
  bottom: 0;
  background: rgba(255,255,255,.9);
  backdrop-filter: blur(12px);
}
`;

const S = {
  page: { display: 'flex', flexDirection: 'column', gap: '24px' } as any,
  card: ui.card.base as any,
  input: { ...ui.input.base, transition: 'all 0.2s ease' } as any,
  select: { ...ui.input.base, transition: 'all 0.2s ease' } as any,
  btnPrimary: { ...ui.btn.primary, justifyContent: 'center' } as any,
  btnOutline: { ...ui.btn.outline, justifyContent: 'center' } as any,
};

function SectionHeader({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: any;
  title: string;
  subtitle: string;
  action?: any;
}) {
  const Icon = icon;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div
          style={{
            width: '44px',
            height: '44px',
            display: 'grid',
            placeItems: 'center',
            borderRadius: '14px',
            background: '#e8f4ee',
            color: tokens.colors.primary,
          }}
        >
          <Icon size={20} />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 900, color: tokens.colors.textPrimary }}>{title}</h2>
          <p style={{ margin: '6px 0 0', color: tokens.colors.textSecondary, fontSize: '14px' }}>{subtitle}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

function loadingSkeleton(isMobile?: boolean) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, minmax(0, 1fr))', gap: '14px' }}>
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="planner-skeleton" style={{ ...S.card, minHeight: '124px', borderRadius: tokens.radius.lg }} />
      ))}
    </div>
  );
}

export function Tasks({
  isMobile,
  currentUser,
  onNavigate,
}: {
  isMobile?: boolean;
  currentUser?: any;
  onNavigate?: (route: string) => void;
} = {}) {
  const token = currentUser?.token || '';
  const taskAccess = buildTaskAccess(currentUser?.roleCodes, currentUser?.systemRole || 'viewer');
  const userCanEdit = taskAccess.canEditTask;
  const userCanDelete = taskAccess.canDeleteTask;

  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [userLoadWarning, setUserLoadWarning] = useState('');

  const [search, setSearch] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState(ALL_PROJECT);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [surface, setSurface] = useState<SurfaceKey>('kanban');
  const [contextActive, setContextActive] = useState(false);

  const [drawer, setDrawer] = useState<TaskDrawerState>(() => createClosedDrawerState(currentUser, ALL_PROJECT));

  const [draggingTaskId, setDraggingTaskId] = useState('');
  const [hoveredStatus, setHoveredStatus] = useState<UiTaskStatus | ''>('');
  const [updatingTaskId, setUpdatingTaskId] = useState('');

  const openDrawer = (task?: TaskRecord | null) => {
    setDrawer(createOpenDrawerState(task || null, currentUser, selectedProjectId));
  };

  const closeDrawer = () => {
    setDrawer(closeDrawerState(currentUser, selectedProjectId));
    setDraggingTaskId('');
    setHoveredStatus('');
  };

  const loadData = async () => {
    setLoading(true);
    setLoadError('');
    setUserLoadWarning('');
    try {
      const snapshot = await loadTaskWorkspaceData(API, token);
      setTasks(snapshot.tasks);
      setProjects(snapshot.projects);
      setUsers(snapshot.users);
      setAccounts(snapshot.accounts);
      setLeads(snapshot.leads);
      setQuotations(snapshot.quotations);
      setUserLoadWarning(snapshot.userLoadWarning);
    } catch {
      setTasks([]);
      setProjects([]);
      setUsers([]);
      setAccounts([]);
      setLeads([]);
      setQuotations([]);
      setLoadError('Không tải được dữ liệu công việc. Bạn có thể thử lại mà không mất ngữ cảnh hiện tại.');
      showNotify('Không tải được dữ liệu công việc', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [token]);

  useEffect(() => {
    const ctx = consumeNavContext();
    if (!ctx) return;
    if (ctx.filters?.projectId) setSelectedProjectId(ctx.filters.projectId);
    if (ctx.filters?.priority) setSelectedPriority(normalizePriority(ctx.filters.priority));
    if (ctx.filters?.status) setSelectedStatus(normalizeTaskStatus(ctx.filters.status));
    if (ctx.filters?.overdue) setOnlyOverdue(true);

    if (ctx.filters?.projectId || ctx.filters?.priority || ctx.filters?.status || ctx.filters?.overdue) {
      setContextActive(true);
    }

    if (ctx.entityType === 'Task' && ctx.entityId && ctx.autoOpenEdit) {
      void (async () => {
        try {
          const response = await fetchWithAuth(token, `${API}/tasks/${ctx.entityId}`);
          if (!response.ok) return;
          const payload = await response.json();
          openDrawer(payload as TaskRecord);
        } catch {
          // ignore
        }
      })();
    }
  }, [token]);

  const filteredTasks = useMemo(() => {
    return sortTasksByUrgency(
      tasks.filter((task) => {
        if (selectedProjectId !== ALL_PROJECT && task.projectId !== selectedProjectId) return false;
        if (selectedAssigneeId && task.assigneeId !== selectedAssigneeId) return false;
        if (selectedPriority && normalizePriority(task.priority) !== selectedPriority) return false;
        if (selectedStatus && normalizeTaskStatus(task.status) !== selectedStatus) return false;
        if (onlyOverdue && !isOverdue(task)) return false;
        return matchesTaskSearch(task, search);
      })
    );
  }, [tasks, selectedProjectId, selectedAssigneeId, selectedPriority, selectedStatus, onlyOverdue, search]);

  const metrics = useMemo(() => ({
    overdue: filteredTasks.filter(isOverdue).length,
    blocked: filteredTasks.filter(isBlocked).length,
    highPriority: filteredTasks.filter((task) => normalizePriority(task.priority) === 'high').length,
    dueToday: filteredTasks.filter(isDueToday).length,
  }), [filteredTasks]);

  const selectedProjectName = useMemo(
    () => selectedProjectId === ALL_PROJECT ? 'Tất cả project' : projects.find((project) => project.id === selectedProjectId)?.name || 'Project đã chọn',
    [projects, selectedProjectId]
  );

  const activeFilterCount = [search, selectedAssigneeId, selectedPriority, selectedStatus].filter(Boolean).length
    + (selectedProjectId !== ALL_PROJECT ? 1 : 0)
    + (onlyOverdue ? 1 : 0);

  const resetFilters = () => {
    setSearch('');
    setSelectedProjectId(ALL_PROJECT);
    setSelectedAssigneeId('');
    setSelectedPriority('');
    setSelectedStatus('');
    setOnlyOverdue(false);
    setContextActive(false);
  };

  const saveTask = async () => {
    if (!taskAccess.canCreateTask) {
      showNotify('Role hiện tại chỉ xem task, không thể lưu thay đổi execution', 'error');
      return;
    }

    if (!drawer.form.name.trim()) {
      showNotify('Tên công việc là bắt buộc', 'error');
      return;
    }

    setDrawer((prev) => ({ ...prev, saving: true }));
    const isEdit = drawer.mode === 'edit' && !!drawer.editingTask;
    const method = isEdit ? 'PUT' : 'POST';
    const url = isEdit ? `${API}/tasks/${drawer.editingTask?.id}` : `${API}/tasks`;

    try {
      const response = await fetchWithAuth(token, url, {
        method,
        body: JSON.stringify(buildTaskPayload(drawer.form)),
      });
      if (!response.ok) throw new Error('save_failed');
      const payload = await response.json();
      const saved = payload as TaskRecord;
      if (!saved?.id) throw new Error('invalid_saved_payload');

      setTasks((prev) => method === 'POST' ? [saved, ...prev] : prev.map((task) => task.id === saved.id ? saved : task));
      showNotify(method === 'POST' ? 'Đã tạo công việc' : 'Đã cập nhật công việc', 'success');
      closeDrawer();
    } catch {
      showNotify('Không lưu được công việc', 'error');
      setDrawer((prev) => ({ ...prev, saving: false }));
    }
  };

  const deleteTask = async () => {
    if (!taskAccess.canDeleteTask) {
      showNotify('Role hiện tại không thể xóa task execution', 'error');
      return;
    }

    if (!drawer.editingTask || !window.confirm('Xóa công việc này?')) return;
    const taskId = drawer.editingTask.id;
    const previousTasks = tasks;
    setTasks((prev) => prev.filter((task) => task.id !== taskId));

    try {
      const response = await fetchWithAuth(token, `${API}/tasks/${taskId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('delete_failed');
      showNotify('Đã xóa công việc', 'success');
      closeDrawer();
    } catch {
      setTasks(previousTasks);
      showNotify('Không xóa được công việc', 'error');
    }
  };

  const updateTaskStatus = async (taskId: string, nextStatus: UiTaskStatus) => {
    if (!taskAccess.canUpdateTaskStatus) {
      showNotify('Role hiện tại chỉ xem task, không thể đổi trạng thái execution', 'error');
      return;
    }

    const currentTask = tasks.find((task) => task.id === taskId);
    if (!currentTask) return;

    const previousTasks = tasks;
    setUpdatingTaskId(taskId);

    const optimistic = {
      ...currentTask,
      status: backendStatusFromUi(nextStatus),
      completionPct: nextStatus === 'complete' ? 100 : Number(currentTask.completionPct || 0),
    };

    setTasks((prev) => prev.map((task) => task.id === taskId ? optimistic : task));

    try {
      const response = await fetchWithAuth(token, `${API}/tasks/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify({ ...currentTask, status: optimistic.status, completionPct: optimistic.completionPct }),
      });
      if (!response.ok) throw new Error('status_failed');
      const saved = await response.json();
      setTasks((prev) => prev.map((task) => task.id === taskId ? saved : task));
    } catch {
      setTasks(previousTasks);
      showNotify('Không cập nhật được trạng thái', 'error');
    } finally {
      setDraggingTaskId('');
      setHoveredStatus('');
      setUpdatingTaskId('');
    }
  };

  const openProjectFromDrawer = () => {
    if (!drawer.form.projectId) return;
    setNavContext({ route: 'Projects', entityType: 'Project', entityId: drawer.form.projectId });
    onNavigate?.('Projects');
  };

  return (
    <div className="tasks-workspace" style={S.page}>
      <style>{TASKS_POLISH_CSS}</style>

      <SectionHeader
        icon={TasksIcon}
        title="Công việc"
        subtitle="Balanced planner để điều phối task nhanh, ổn định và bám sát ngữ cảnh project."
        action={
          userCanEdit
            ? <button onClick={() => openDrawer(null)} style={S.btnPrimary} aria-label="Tạo công việc mới"><PlusIcon size={16} /> Thêm công việc</button>
            : null
        }
      />

      <div className="planner-surface" style={{ ...S.card, padding: '18px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 900, color: tokens.colors.textPrimary }}>Scope bar</div>
            <div style={{ marginTop: '6px', fontSize: '13px', color: tokens.colors.textSecondary }}>
              Chọn phạm vi, owner và mức ưu tiên để board/list chạy cùng một ngữ cảnh.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {contextActive ? <span style={{ padding: '6px 10px', borderRadius: '999px', background: '#e6f6ee', color: tokens.colors.primary, fontSize: '12px', fontWeight: 800 }}>Ngữ cảnh chuyển trang đang bật</span> : null}
            <button onClick={resetFilters} style={S.btnOutline}>Xóa bộ lọc</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <div className="planner-chip"><strong>Scope</strong><span>{selectedProjectName}</span></div>
          <div className="planner-chip"><strong>Filters</strong><span>{activeFilterCount > 0 ? `${activeFilterCount} đang bật` : 'Mặc định'}</span></div>
          {search ? <div className="planner-chip"><strong>Search</strong><span>{search}</span></div> : null}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.5fr repeat(5, minmax(0, 1fr))', gap: '12px' }}>
          <div style={{ position: 'relative' }}>
            <SearchIcon size={16} style={{ position: 'absolute', top: '50%', left: '14px', transform: 'translateY(-50%)', color: tokens.colors.textMuted }} />
            <input aria-label="Tìm kiếm công việc" style={{ ...S.input, paddingLeft: '42px' }} placeholder="Tìm theo task, project, owner..." value={search} onInput={(event: any) => setSearch(event.target.value)} />
          </div>
          <select style={S.select} value={selectedProjectId} onChange={(event: any) => setSelectedProjectId(event.target.value)}>
            <option value={ALL_PROJECT}>Tất cả project</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
          <select style={S.select} value={selectedAssigneeId} onChange={(event: any) => setSelectedAssigneeId(event.target.value)}>
            <option value="">Tất cả owner</option>
            {users.map((user) => <option key={user.id} value={user.id}>{user.fullName || user.username}</option>)}
          </select>
          <select style={S.select} value={selectedPriority} onChange={(event: any) => setSelectedPriority(event.target.value)}>
            <option value="">Tất cả ưu tiên</option>
            {Object.keys(PRIORITY_META).map((priority) => <option key={priority} value={priority}>{PRIORITY_META[priority as keyof typeof PRIORITY_META].label}</option>)}
          </select>
          <select style={S.select} value={selectedStatus} onChange={(event: any) => setSelectedStatus(event.target.value)}>
            <option value="">Tất cả trạng thái</option>
            {Object.keys(UI_STATUS_META).map((status) => <option key={status} value={status}>{UI_STATUS_META[status as keyof typeof UI_STATUS_META].label}</option>)}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', ...S.select }}>
            <input type="checkbox" checked={onlyOverdue} onChange={(event: any) => setOnlyOverdue(Boolean(event.target.checked))} />
            Chỉ task quá hạn
          </label>
        </div>

        {loadError ? (
          <div className="planner-inline-empty" style={{ borderStyle: 'solid', borderColor: '#f3c7c2', background: '#fff8f7' }}>
            {loadError}
          </div>
        ) : null}
        {userLoadWarning ? (
          <div className="planner-inline-empty" style={{ borderStyle: 'solid', borderColor: '#f4d39a', background: '#fffaf0' }}>
            {userLoadWarning}
          </div>
        ) : null}
      </div>

      {loading ? loadingSkeleton(isMobile) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, minmax(0, 1fr))', gap: '14px' }}>
          <MetricTile icon={WarningIcon} label="Quá hạn" value={metrics.overdue} note="Cần xử lý ngay để không làm chậm project." accent="#b42318" />
          <MetricTile icon={CloseIcon} label="Đang bị chặn" value={metrics.blocked} note="Task cần gỡ blocker hoặc ra quyết định." accent="#c06b21" />
          <MetricTile icon={TasksIcon} label="Ưu tiên cao" value={metrics.highPriority} note="Nhóm việc ảnh hưởng lớn đến tiến độ tuần này." accent={tokens.colors.primary} />
          <MetricTile icon={CalendarIcon} label="Đến hạn hôm nay" value={metrics.dueToday} note="Các đầu việc cần được chốt trong ngày." accent="#2563eb" />
        </div>
      )}

      <div className="planner-surface" style={{ ...S.card, padding: '18px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 900, color: tokens.colors.textPrimary }}>Task board</div>
            <div style={{ marginTop: '6px', fontSize: '13px', color: tokens.colors.textSecondary }}>
              Chuyển nhanh giữa Kanban kéo-thả và danh sách để xử lý task theo ngữ cảnh.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <SurfaceTab active={surface === 'kanban'} label="Kanban" onClick={() => setSurface('kanban')} />
            <SurfaceTab active={surface === 'list'} label="Danh sách" onClick={() => setSurface('list')} />
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'grid', gap: '12px' }}>
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="planner-skeleton" style={{ ...S.card, minHeight: '220px' }} />
            ))}
          </div>
        ) : null}

        {!loading && filteredTasks.length === 0 ? (
          <div className="planner-inline-empty">Không có công việc nào khớp với phạm vi đang chọn. Bạn có thể đổi project hoặc xoá bớt bộ lọc để tiếp tục điều phối.</div>
        ) : null}

        {!loading && filteredTasks.length > 0 && surface === 'kanban' ? (
          <KanbanBoard
            tasks={filteredTasks}
            draggingTaskId={draggingTaskId}
            hoveredStatus={hoveredStatus}
            updatingTaskId={updatingTaskId}
            canDrag={userCanEdit}
            onDragStart={setDraggingTaskId}
            onHoverStatus={setHoveredStatus}
            onDropStatus={(status) => draggingTaskId && updateTaskStatus(draggingTaskId, status)}
            onOpenTask={openDrawer}
          />
        ) : null}

        {!loading && filteredTasks.length > 0 && surface === 'list' ? (
          <TaskList tasks={filteredTasks} isMobile={isMobile} onOpenTask={openDrawer} />
        ) : null}
      </div>

      <TaskDrawer
        open={drawer.open}
        mode={drawer.mode}
        form={drawer.form}
        saving={drawer.saving}
        advanced={drawer.advanced}
        canEditTask={userCanEdit}
        canDeleteTask={userCanDelete}
        projects={projects}
        users={users}
        userLoadWarning={userLoadWarning}
        accounts={accounts}
        leads={leads}
        quotations={quotations}
        onChange={(next) => setDrawer((prev) => ({ ...prev, form: next }))}
        onToggleAdvanced={() => setDrawer((prev) => ({ ...prev, advanced: !prev.advanced }))}
        onClose={closeDrawer}
        onSave={saveTask}
        onDelete={deleteTask}
        onOpenProject={openProjectFromDrawer}
      />
    </div>
  );
}

export default Tasks;
