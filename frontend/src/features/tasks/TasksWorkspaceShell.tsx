import { tokens } from '../../ui/tokens';
import { ui } from '../../ui/styles';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import {
  CalendarIcon,
  CloseIcon,
  PlusIcon,
  SearchIcon,
  TasksIcon,
  WarningIcon,
} from '../../ui/icons';
import { ALL_PROJECT, PRIORITY_META, UI_STATUS_META } from './taskDomain';
import { matchesTaskViewPreset } from './taskViewPresets';
import {
  KanbanBoard,
  MetricTile,
  SurfaceTab,
  TaskDrawer,
  TaskList,
} from './taskViews';

export const TASKS_POLISH_CSS = `
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
  box-shadow: 0 0 0 3px var(--focus-ring-color);
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
  background: var(--surface-sheen);
  pointer-events: none;
}
.tasks-workspace .planner-interactive:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-interactive-lg);
}
.tasks-workspace .planner-tab:hover {
  box-shadow: var(--shadow-interactive-md);
}
.tasks-workspace .planner-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 999px;
  background: var(--surface-chip-bg);
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
  background: var(--surface-empty-bg);
  color: var(--text-secondary);
  font-size: 13px;
}
.tasks-workspace .planner-skeleton {
  position: relative;
  overflow: hidden;
  background: var(--surface-skeleton-bg);
  background-size: 400% 100%;
  animation: plannerShimmer 1.6s ease infinite;
}
@keyframes plannerShimmer {
  0% { background-position: 100% 0; }
  100% { background-position: 0 0; }
}
.tasks-workspace .kanban-drop-target {
  box-shadow: var(--shadow-drop-target);
}
.tasks-workspace .drawer-footer {
  position: sticky;
  bottom: 0;
  background: var(--surface-sticky-bg);
  backdrop-filter: blur(12px);
}
`;

export const taskWorkspaceStyles = {
  page: { display: 'flex', flexDirection: 'column', gap: tokens.spacing.xl } as any,
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
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: tokens.spacing.lg }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: tokens.spacing.md }}>
        <div
          style={{
            width: '44px',
            height: '44px',
            display: 'grid',
            placeItems: 'center',
            borderRadius: '14px',
            background: tokens.colors.surfaceSuccessSoft,
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
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, minmax(0, 1fr))', gap: tokens.spacing.mdPlus }}>
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="planner-skeleton" style={{ ...taskWorkspaceStyles.card, minHeight: '124px', borderRadius: tokens.radius.lg }} />
      ))}
    </div>
  );
}

export function TasksWorkspaceShell(props: any) {
  const {
    isMobile,
    confirmState,
    setConfirmState,
    userCanEdit,
    openDrawer,
    contextActive,
    resetFilters,
    selectedProjectName,
    activeFilterCount,
    search,
    setSearch,
    selectedProjectId,
    setSelectedProjectId,
    projects,
    selectedAssigneeId,
    setSelectedAssigneeId,
    users,
    selectedPriority,
    setSelectedPriority,
    selectedStatus,
    setSelectedStatus,
    groupBy,
    setGroupBy,
    onlyOverdue,
    setOnlyOverdue,
    taskViewName,
    setTaskViewName,
    taskViewIsDefault,
    setTaskViewIsDefault,
    saveCurrentTaskView,
    savingTaskView,
    activeTaskViewPresetId,
    updateActiveTaskView,
    taskQuickViews,
    currentTaskViewSnapshot,
    applyQuickView,
    taskViewPresets,
    applyTaskViewPreset,
    deleteTaskViewPreset,
    deletingTaskViewId,
    loadError,
    userLoadWarning,
    taskViewWarning,
    loading,
    metrics,
    filteredTasks,
    surface,
    setSurface,
    bulkStatus,
    setBulkStatus,
    bulkPriority,
    setBulkPriority,
    bulkAssigneeId,
    setBulkAssigneeId,
    selectedTaskIds,
    applyBulkTaskAction,
    bulkUpdating,
    draggingTaskId,
    setDraggingTaskId,
    hoveredStatus,
    setHoveredStatus,
    updatingTaskId,
    updateTaskStatus,
    toggleSelectedTask,
    openWorkflowFromTask,
    toggleAllVisibleTasks,
    moveProjectTask,
    drawer,
    userCanDelete,
    accounts,
    leads,
    quotations,
    taskWorkHubSummary,
    taskChecklistItems,
    taskChecklistDraft,
    taskChecklistEditingId,
    taskChecklistEditingTitle,
    setTaskChecklistDraft,
    addTaskChecklistItem,
    toggleTaskChecklistItem,
    deleteTaskChecklistItem,
    setTaskChecklistEditingId,
    setTaskChecklistEditingTitle,
    saveTaskChecklistItem,
    taskSubtasks,
    taskSubtaskDraft,
    taskSubtaskEditingId,
    taskSubtaskEditingTitle,
    setTaskSubtaskDraft,
    setTaskSubtaskEditingId,
    setTaskSubtaskEditingTitle,
    addTaskSubtask,
    moveTaskSubtask,
    deleteTaskSubtask,
    saveTaskSubtask,
    taskThreadMessages,
    taskThreadDraft,
    setTaskThreadDraft,
    openTaskThread,
    sendTaskThreadMessage,
    setDrawer,
    closeDrawer,
    saveTask,
    deleteTask,
    openProjectFromDrawer,
  } = props;

  const S = taskWorkspaceStyles;

  return (
    <div className="tasks-workspace" style={S.page}>
      <style>{TASKS_POLISH_CSS}</style>
      {confirmState && <ConfirmDialog message={confirmState.message} onConfirm={confirmState.onConfirm} onCancel={() => setConfirmState(null)} />}

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

      <div className="planner-surface" style={{ ...S.card, padding: tokens.spacing.lgPlus, display: 'flex', flexDirection: 'column', gap: tokens.spacing.lg }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: tokens.spacing.mdPlus, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 900, color: tokens.colors.textPrimary }}>Scope bar</div>
            <div style={{ marginTop: '6px', fontSize: '13px', color: tokens.colors.textSecondary }}>
              Chọn phạm vi, owner và mức ưu tiên để board/list chạy cùng một ngữ cảnh.
            </div>
          </div>
          <div style={{ display: 'flex', gap: tokens.spacing.sm, flexWrap: 'wrap' }}>
            {contextActive ? <span style={{ padding: `${tokens.spacing.xsPlus} ${tokens.spacing.smPlus}`, borderRadius: '999px', background: tokens.colors.surfaceSuccessSoft, color: tokens.colors.primary, fontSize: tokens.fontSize.sm, fontWeight: 800 }}>Ngữ cảnh chuyển trang đang bật</span> : null}
            <button onClick={resetFilters} style={S.btnOutline}>Xóa bộ lọc</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: tokens.spacing.sm, flexWrap: 'wrap' }}>
          <div className="planner-chip"><strong>Scope</strong><span>{selectedProjectName}</span></div>
          <div className="planner-chip"><strong>Filters</strong><span>{activeFilterCount > 0 ? `${activeFilterCount} đang bật` : 'Mặc định'}</span></div>
          {search ? <div className="planner-chip"><strong>Search</strong><span>{search}</span></div> : null}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.5fr repeat(5, minmax(0, 1fr))', gap: tokens.spacing.md }}>
          <div style={{ position: 'relative' }}>
            <SearchIcon size={16} style={{ position: 'absolute', top: '50%', left: '14px', transform: 'translateY(-50%)', color: tokens.colors.textMuted }} />
            <input aria-label="Tìm kiếm công việc" style={{ ...S.input, paddingLeft: '42px' }} placeholder="Tìm theo task, project, owner..." value={search} onInput={(event: any) => setSearch(event.target.value)} />
          </div>
          <select style={S.select} value={selectedProjectId} onChange={(event: any) => setSelectedProjectId(event.target.value)}>
            <option value={ALL_PROJECT}>Tất cả project</option>
            {projects.map((project: any) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
          <select style={S.select} value={selectedAssigneeId} onChange={(event: any) => setSelectedAssigneeId(event.target.value)}>
            <option value="">Tất cả owner</option>
            {users.map((user: any) => <option key={user.id} value={user.id}>{user.fullName || user.username}</option>)}
          </select>
          <select style={S.select} value={selectedPriority} onChange={(event: any) => setSelectedPriority(event.target.value)}>
            <option value="">Tất cả ưu tiên</option>
            {Object.keys(PRIORITY_META).map((priority) => <option key={priority} value={priority}>{PRIORITY_META[priority as keyof typeof PRIORITY_META].label}</option>)}
          </select>
          <select style={S.select} value={selectedStatus} onChange={(event: any) => setSelectedStatus(event.target.value)}>
            <option value="">Tất cả trạng thái</option>
            {Object.keys(UI_STATUS_META).map((status) => <option key={status} value={status}>{UI_STATUS_META[status as keyof typeof UI_STATUS_META].label}</option>)}
          </select>
          <select style={S.select} value={groupBy} onChange={(event: any) => setGroupBy(event.target.value)}>
            <option value="none">Không group</option>
            <option value="project">Group theo project</option>
            <option value="assignee">Group theo owner</option>
            <option value="department">Group theo department</option>
            <option value="taskType">Group theo task type</option>
            <option value="urgency">Group theo urgency lane</option>
            <option value="hierarchy">Group theo hierarchy</option>
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.sm, ...S.select }}>
            <input type="checkbox" checked={onlyOverdue} onChange={(event: any) => setOnlyOverdue(Boolean(event.target.checked))} />
            Chỉ task quá hạn
          </label>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.md }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: tokens.spacing.md, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 900, color: tokens.colors.textPrimary }}>Saved views</div>
              <div style={{ marginTop: '4px', fontSize: '13px', color: tokens.colors.textSecondary }}>
                Port native từ tư duy tracker của Huly: lưu bộ lọc và surface để vào lại task board nhanh hơn.
              </div>
            </div>
            <div style={{ display: 'flex', gap: tokens.spacing.sm, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                aria-label="Tên task view"
                style={{ ...S.input, minWidth: isMobile ? '100%' : '220px' }}
                placeholder="Tên view hiện tại"
                value={taskViewName}
                onInput={(event: any) => setTaskViewName(event.target.value)}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.xsPlus, ...S.select, minWidth: 'fit-content' }}>
                <input type="checkbox" checked={taskViewIsDefault} onChange={(event: any) => setTaskViewIsDefault(Boolean(event.target.checked))} />
                Mặc định
              </label>
              <button onClick={saveCurrentTaskView} style={S.btnOutline} disabled={savingTaskView}>
                {savingTaskView ? 'Đang lưu...' : 'Lưu view'}
              </button>
              {activeTaskViewPresetId ? (
                <button onClick={updateActiveTaskView} style={S.btnOutline} disabled={savingTaskView}>
                  {savingTaskView ? 'Đang cập nhật...' : 'Cập nhật view'}
                </button>
              ) : null}
            </div>
          </div>

          <div style={{ display: 'flex', gap: tokens.spacing.sm, flexWrap: 'wrap' }}>
            {taskQuickViews.map((view: any) => {
              const active = matchesTaskViewPreset(currentTaskViewSnapshot, {
                id: view.id,
                name: view.label,
                query: view.snapshot.search,
                projectId: view.snapshot.selectedProjectId === ALL_PROJECT ? null : view.snapshot.selectedProjectId,
                assigneeId: view.snapshot.selectedAssigneeId || null,
                priority: view.snapshot.selectedPriority || null,
                status: view.snapshot.selectedStatus || null,
                onlyOverdue: view.snapshot.onlyOverdue,
                groupBy: view.snapshot.groupBy || 'none',
                surface: view.snapshot.surface,
                isDefault: false,
              });
              return (
                <button
                  key={view.id}
                  onClick={() => applyQuickView(view.snapshot)}
                  style={{
                    ...S.btnOutline,
                    borderRadius: '999px',
                    background: active ? tokens.colors.primary : tokens.colors.surface,
                    color: active ? tokens.colors.textOnPrimary : tokens.colors.textPrimary,
                    borderColor: active ? tokens.colors.primary : tokens.colors.border,
                  }}
                >
                  {view.label} · {view.count}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: tokens.spacing.sm, flexWrap: 'wrap' }}>
            {taskViewPresets.length === 0 ? (
              <div className="planner-inline-empty" style={{ width: '100%' }}>
                Chưa có saved view nào. Lưu bộ lọc hiện tại để tạo task cockpit riêng theo team hoặc workflow.
              </div>
            ) : (
              taskViewPresets.map((preset: any) => {
                const active = preset.id === activeTaskViewPresetId;
                return (
                  <div
                    key={preset.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: tokens.spacing.xsPlus,
                      padding: `${tokens.spacing.xsPlus} ${tokens.spacing.smPlus}`,
                      borderRadius: '999px',
                      background: active ? tokens.colors.primary : tokens.colors.surfaceSubtle,
                      color: active ? tokens.colors.textOnPrimary : tokens.colors.textPrimary,
                      border: active ? 'none' : `1px solid ${tokens.colors.border}`,
                    }}
                  >
                    <button
                      onClick={() => applyTaskViewPreset(preset)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: 'inherit',
                        fontSize: tokens.fontSize.sm,
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      {preset.name}
                    </button>
                    {preset.isDefault ? <span style={{ fontSize: tokens.fontSize.xs, fontWeight: 800, opacity: 0.82 }}>Default</span> : null}
                    <button
                      onClick={() => deleteTaskViewPreset(preset.id)}
                      disabled={deletingTaskViewId === preset.id}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: 'inherit',
                        cursor: 'pointer',
                        fontSize: tokens.fontSize.xs,
                        fontWeight: 900,
                        opacity: deletingTaskViewId === preset.id ? 0.5 : 0.8,
                      }}
                      aria-label={`Xóa saved view ${preset.name}`}
                    >
                      ×
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {loadError ? (
          <div className="planner-inline-empty" style={{ borderStyle: 'solid', borderColor: 'var(--error-surface-border)', background: 'var(--error-surface-bg-soft)' }}>
            {loadError}
          </div>
        ) : null}
        {userLoadWarning ? (
          <div className="planner-inline-empty" style={{ borderStyle: 'solid', borderColor: 'var(--warning-surface-border)', background: 'var(--warning-surface-bg-soft)' }}>
            {userLoadWarning}
          </div>
        ) : null}
        {taskViewWarning ? (
          <div className="planner-inline-empty" style={{ borderStyle: 'solid', borderColor: 'var(--warning-surface-border)', background: 'var(--warning-surface-bg-soft)' }}>
            {taskViewWarning}
          </div>
        ) : null}
      </div>

      {loading ? loadingSkeleton(isMobile) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, minmax(0, 1fr))', gap: tokens.spacing.mdPlus }}>
          <MetricTile icon={WarningIcon} label="Quá hạn" value={metrics.overdue} note="Cần xử lý ngay để không làm chậm project." accent={tokens.colors.error} surface={tokens.colors.badgeBgError} />
          <MetricTile icon={CloseIcon} label="Đang bị chặn" value={metrics.blocked} note="Task cần gỡ blocker hoặc ra quyết định." accent={tokens.colors.warningSurfaceText} surface={tokens.colors.warningSurfaceBg} />
          <MetricTile icon={TasksIcon} label="Ưu tiên cao" value={metrics.highPriority} note="Nhóm việc ảnh hưởng lớn đến tiến độ tuần này." accent={tokens.colors.primary} surface={tokens.colors.surfaceSuccessSoft} />
          <MetricTile icon={CalendarIcon} label="Đến hạn hôm nay" value={metrics.dueToday} note="Các đầu việc cần được chốt trong ngày." accent={tokens.colors.infoAccentText} surface={tokens.colors.infoAccentBg} />
        </div>
      )}

      <div className="planner-surface" style={{ ...S.card, padding: tokens.spacing.lgPlus, display: 'flex', flexDirection: 'column', gap: tokens.spacing.lgPlus }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: tokens.spacing.mdPlus, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 900, color: tokens.colors.textPrimary }}>Task board</div>
            <div style={{ marginTop: '6px', fontSize: '13px', color: tokens.colors.textSecondary }}>
              Chuyển nhanh giữa Kanban kéo-thả và danh sách để xử lý task theo ngữ cảnh.
            </div>
          </div>
          <div style={{ display: 'flex', gap: tokens.spacing.sm, flexWrap: 'wrap' }}>
            <SurfaceTab active={surface === 'kanban'} label="Kanban" onClick={() => setSurface('kanban')} />
            <SurfaceTab active={surface === 'list'} label="Danh sách" onClick={() => setSurface('list')} />
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'grid', gap: tokens.spacing.md }}>
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="planner-skeleton" style={{ ...S.card, minHeight: '220px' }} />
            ))}
          </div>
        ) : null}

        {!loading && filteredTasks.length === 0 ? (
          <div className="planner-inline-empty">Không có công việc nào khớp với phạm vi đang chọn. Bạn có thể đổi project hoặc xoá bớt bộ lọc để tiếp tục điều phối.</div>
        ) : null}

        {!loading && filteredTasks.length > 0 ? (
          <div style={{ ...S.card, padding: tokens.spacing.md, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, minmax(0, 1fr)) auto', gap: tokens.spacing.sm, alignItems: 'center' }}>
            <select style={S.select} value={bulkStatus} onChange={(event: any) => setBulkStatus(event.target.value)}>
              <option value="">Bulk status</option>
              {Object.keys(UI_STATUS_META).map((status) => <option key={status} value={status}>{UI_STATUS_META[status as keyof typeof UI_STATUS_META].label}</option>)}
            </select>
            <select style={S.select} value={bulkPriority} onChange={(event: any) => setBulkPriority(event.target.value)}>
              <option value="">Bulk priority</option>
              {Object.keys(PRIORITY_META).map((priority) => <option key={priority} value={priority}>{PRIORITY_META[priority as keyof typeof PRIORITY_META].label}</option>)}
            </select>
            <select style={S.select} value={bulkAssigneeId} onChange={(event: any) => setBulkAssigneeId(event.target.value)}>
              <option value="">Bulk owner</option>
              {users.map((user: any) => <option key={user.id} value={user.id}>{user.fullName || user.username}</option>)}
            </select>
            <div className="planner-chip"><strong>Selected</strong><span>{selectedTaskIds.length}</span></div>
            <button onClick={applyBulkTaskAction} style={S.btnOutline} disabled={bulkUpdating}>{bulkUpdating ? 'Đang áp dụng...' : 'Áp dụng hàng loạt'}</button>
          </div>
        ) : null}

        {!loading && filteredTasks.length > 0 && surface === 'kanban' ? (
          <KanbanBoard
            tasks={filteredTasks}
            draggingTaskId={draggingTaskId}
            hoveredStatus={hoveredStatus}
            updatingTaskId={updatingTaskId}
            selectedTaskIds={selectedTaskIds}
            canDrag={userCanEdit}
            onDragStart={setDraggingTaskId}
            onHoverStatus={setHoveredStatus}
            onDropStatus={(status: any) => draggingTaskId && updateTaskStatus(draggingTaskId, status)}
            onToggleTaskSelection={toggleSelectedTask}
            onOpenTask={openDrawer}
            onOpenWorkflow={openWorkflowFromTask}
          />
        ) : null}

        {!loading && filteredTasks.length > 0 && surface === 'list' ? (
          <div style={{ display: 'grid', gap: tokens.spacing.md }}>
            <TaskList
              tasks={filteredTasks}
              groupBy={groupBy}
              isMobile={isMobile}
              selectedTaskIds={selectedTaskIds}
              onToggleTask={toggleSelectedTask}
              onToggleAllTasks={toggleAllVisibleTasks}
              canReorderProjectTasks={selectedProjectId !== ALL_PROJECT && groupBy === 'none'}
              onMoveProjectTask={moveProjectTask}
              onOpenTask={openDrawer}
              onOpenWorkflow={openWorkflowFromTask}
            />
          </div>
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
        workHubSummary={taskWorkHubSummary}
        checklistItems={taskChecklistItems}
        checklistDraft={taskChecklistDraft}
        checklistEditingId={taskChecklistEditingId}
        checklistEditingTitle={taskChecklistEditingTitle}
        onChecklistDraftChange={setTaskChecklistDraft}
        onAddChecklistItem={addTaskChecklistItem}
        onToggleChecklistItem={toggleTaskChecklistItem}
        onDeleteChecklistItem={deleteTaskChecklistItem}
        onStartChecklistEdit={(item: any) => {
          setTaskChecklistEditingId(item.id);
          setTaskChecklistEditingTitle(item.title || '');
        }}
        onChecklistEditingTitleChange={setTaskChecklistEditingTitle}
        onSaveChecklistItem={saveTaskChecklistItem}
        onCancelChecklistEdit={() => {
          setTaskChecklistEditingId('');
          setTaskChecklistEditingTitle('');
        }}
        subtasks={taskSubtasks}
        subtaskDraft={taskSubtaskDraft}
        subtaskEditingId={taskSubtaskEditingId}
        subtaskEditingTitle={taskSubtaskEditingTitle}
        onSubtaskDraftChange={setTaskSubtaskDraft}
        onAddSubtask={addTaskSubtask}
        onMoveSubtask={moveTaskSubtask}
        onDeleteSubtask={deleteTaskSubtask}
        onStartSubtaskEdit={(task: any) => {
          setTaskSubtaskEditingId(task.id);
          setTaskSubtaskEditingTitle(task.name || '');
        }}
        onSubtaskEditingTitleChange={setTaskSubtaskEditingTitle}
        onSaveSubtask={saveTaskSubtask}
        onCancelSubtaskEdit={() => {
          setTaskSubtaskEditingId('');
          setTaskSubtaskEditingTitle('');
        }}
        threadMessages={taskThreadMessages}
        threadDraft={taskThreadDraft}
        onThreadDraftChange={setTaskThreadDraft}
        onOpenThread={openTaskThread}
        onSendThreadMessage={sendTaskThreadMessage}
        sendingThreadMessage={false}
        onChange={(next: any) => setDrawer((prev: any) => ({ ...prev, form: next }))}
        onToggleAdvanced={() => setDrawer((prev: any) => ({ ...prev, advanced: !prev.advanced }))}
        onClose={closeDrawer}
        onSave={saveTask}
        onDelete={deleteTask}
        onOpenProject={openProjectFromDrawer}
      />
    </div>
  );
}
