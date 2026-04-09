import { showNotify } from '../../Notification';
import { requestJsonWithAuth } from '../../shared/api/client';
import { applyTaskViewSnapshot } from './taskPageState';
import {
  buildTaskViewPresetPayload,
  collectTaskViewPresets,
  snapshotFromTaskViewPreset,
  type TaskViewPresetRecord,
  type TaskViewSnapshot,
} from './taskViewPresets';

export function createTaskViewActions(deps: any) {
  const {
    token,
    api,
    currentTaskViewSnapshot,
    taskViewName,
    taskViewIsDefault,
    taskViewPresets,
    activeTaskViewPresetId,
    setSavingTaskView,
    setTaskViewPresets,
    setTaskViewName,
    setTaskViewIsDefault,
    setDefaultPresetApplied,
    setDeletingTaskViewId,
    setContextActive,
    taskViewSetters,
  } = deps;

  const saveCurrentTaskView = async () => {
    const payload = buildTaskViewPresetPayload(taskViewName, currentTaskViewSnapshot, taskViewIsDefault);
    if (!payload.name) {
      showNotify('Nhập tên view trước khi lưu', 'error');
      return;
    }

    setSavingTaskView(true);
    try {
      const created = await requestJsonWithAuth<any>(token, `${api}/v1/tasks/views`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }, 'Không thể lưu task view');
      const normalized = collectTaskViewPresets({ items: [created] })[0];
      setTaskViewPresets((prev: TaskViewPresetRecord[]) => {
        const next = payload.isDefault
          ? prev.map((item) => ({ ...item, isDefault: false }))
          : prev;
        return normalized ? [...next, normalized] : next;
      });
      setTaskViewName('');
      setTaskViewIsDefault(false);
      setDefaultPresetApplied(true);
      showNotify('Đã lưu task view', 'success');
    } catch {
      showNotify('Không lưu được task view', 'error');
    } finally {
      setSavingTaskView(false);
    }
  };

  const updateActiveTaskView = async () => {
    const activePreset = taskViewPresets.find((preset: TaskViewPresetRecord) => preset.id === activeTaskViewPresetId);
    if (!activePreset) {
      showNotify('Chọn một saved view trước khi cập nhật', 'error');
      return;
    }
    const payload = buildTaskViewPresetPayload(activePreset.name, currentTaskViewSnapshot, Boolean(activePreset.isDefault));
    setSavingTaskView(true);
    try {
      const updated = await requestJsonWithAuth<any>(token, `${api}/v1/tasks/views/${activePreset.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }, 'Không thể cập nhật task view');
      const normalized = collectTaskViewPresets({ items: [updated] })[0];
      setTaskViewPresets((prev: TaskViewPresetRecord[]) => prev.map((preset) => {
        if (preset.id === activePreset.id) return normalized || preset;
        if (normalized?.isDefault) return { ...preset, isDefault: false };
        return preset;
      }));
      showNotify('Đã cập nhật task view', 'success');
    } catch {
      showNotify('Không cập nhật được task view', 'error');
    } finally {
      setSavingTaskView(false);
    }
  };

  const deleteTaskViewPreset = async (presetId: string) => {
    setDeletingTaskViewId(presetId);
    try {
      await requestJsonWithAuth<any>(token, `${api}/v1/tasks/views/${presetId}`, { method: 'DELETE' }, 'Không thể xóa task view');
      setTaskViewPresets((prev: TaskViewPresetRecord[]) => prev.filter((preset) => preset.id !== presetId));
      showNotify('Đã xóa task view', 'success');
    } catch {
      showNotify('Không xóa được task view', 'error');
    } finally {
      setDeletingTaskViewId('');
    }
  };

  const applyTaskViewPreset = (preset: TaskViewPresetRecord) => {
    applyTaskViewSnapshot(snapshotFromTaskViewPreset(preset), taskViewSetters);
    setContextActive(false);
    setDefaultPresetApplied(true);
    setTaskViewName(preset.name);
    setTaskViewIsDefault(Boolean(preset.isDefault));
  };

  const applyQuickView = (snapshot: TaskViewSnapshot) => {
    applyTaskViewSnapshot(snapshot, taskViewSetters);
    setContextActive(false);
    setDefaultPresetApplied(true);
    setTaskViewIsDefault(false);
  };

  return {
    saveCurrentTaskView,
    updateActiveTaskView,
    deleteTaskViewPreset,
    applyTaskViewPreset,
    applyQuickView,
  };
}
