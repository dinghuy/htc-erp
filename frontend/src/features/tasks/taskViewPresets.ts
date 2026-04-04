import { ALL_PROJECT, type SurfaceKey } from './taskDomain';

export type TaskViewPresetRecord = {
  id: string;
  name: string;
  query?: string | null;
  projectId?: string | null;
  assigneeId?: string | null;
  priority?: string | null;
  status?: string | null;
  onlyOverdue?: boolean | null;
  groupBy?: string | null;
  surface?: string | null;
  isDefault?: boolean | null;
};

export type TaskViewSnapshot = {
  search: string;
  selectedProjectId: string;
  selectedAssigneeId: string;
  selectedPriority: string;
  selectedStatus: string;
  onlyOverdue: boolean;
  groupBy: string;
  surface: SurfaceKey;
};

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeTaskViewPreset(raw: any): TaskViewPresetRecord {
  return {
    id: String(raw?.id || ''),
    name: normalizeText(raw?.name),
    query: normalizeText(raw?.query) || null,
    projectId: normalizeText(raw?.projectId) || null,
    assigneeId: normalizeText(raw?.assigneeId) || null,
    priority: normalizeText(raw?.priority) || null,
    status: normalizeText(raw?.status) || null,
    onlyOverdue: Boolean(raw?.onlyOverdue),
    groupBy: normalizeText(raw?.groupBy) || 'none',
    surface: normalizeText(raw?.surface).toLowerCase() === 'list' ? 'list' : 'kanban',
    isDefault: Boolean(raw?.isDefault),
  };
}

export function collectTaskViewPresets(payload: any): TaskViewPresetRecord[] {
  const source = Array.isArray(payload) ? payload : (Array.isArray(payload?.items) ? payload.items : []);
  return source
    .map((item: any) => normalizeTaskViewPreset(item))
    .filter((item: TaskViewPresetRecord) => item.id && item.name);
}

export function snapshotFromTaskViewPreset(preset: TaskViewPresetRecord): TaskViewSnapshot {
  return {
    search: preset.query || '',
    selectedProjectId: preset.projectId || ALL_PROJECT,
    selectedAssigneeId: preset.assigneeId || '',
    selectedPriority: preset.priority || '',
    selectedStatus: preset.status || '',
    onlyOverdue: Boolean(preset.onlyOverdue),
    groupBy: preset.groupBy || 'none',
    surface: preset.surface === 'list' ? 'list' : 'kanban',
  };
}

export function buildTaskViewPresetPayload(name: string, snapshot: TaskViewSnapshot, isDefault: boolean) {
  return {
    name: normalizeText(name),
    query: normalizeText(snapshot.search) || null,
    projectId: snapshot.selectedProjectId !== ALL_PROJECT ? snapshot.selectedProjectId : null,
    assigneeId: snapshot.selectedAssigneeId || null,
    priority: snapshot.selectedPriority || null,
    status: snapshot.selectedStatus || null,
    onlyOverdue: Boolean(snapshot.onlyOverdue),
    groupBy: snapshot.groupBy || 'none',
    surface: snapshot.surface,
    isDefault: Boolean(isDefault),
  };
}

export function getDefaultTaskViewPreset(presets: TaskViewPresetRecord[]) {
  return presets.find((preset) => Boolean(preset.isDefault)) || null;
}

export function matchesTaskViewPreset(snapshot: TaskViewSnapshot, preset: TaskViewPresetRecord) {
  const presetSnapshot = snapshotFromTaskViewPreset(preset);
  return (
    snapshot.search.trim() === presetSnapshot.search.trim() &&
    snapshot.selectedProjectId === presetSnapshot.selectedProjectId &&
    snapshot.selectedAssigneeId === presetSnapshot.selectedAssigneeId &&
    snapshot.selectedPriority === presetSnapshot.selectedPriority &&
    snapshot.selectedStatus === presetSnapshot.selectedStatus &&
    snapshot.onlyOverdue === presetSnapshot.onlyOverdue &&
    snapshot.groupBy === presetSnapshot.groupBy &&
    snapshot.surface === presetSnapshot.surface
  );
}
