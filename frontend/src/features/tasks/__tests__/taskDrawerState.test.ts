import { describe, expect, it } from 'vitest';
import {
  closeDrawerState,
  createClosedDrawerState,
  createOpenDrawerState,
} from '../taskDrawerState';

describe('taskDrawerState', () => {
  it('creates closed state with create mode by default', () => {
    const state = createClosedDrawerState({ id: 'u-1' }, 'project-1');
    expect(state.open).toBe(false);
    expect(state.mode).toBe('create');
    expect(state.editingTask).toBeNull();
    expect(state.form.projectId).toBe('project-1');
  });

  it('opens create drawer when no task is provided', () => {
    const state = createOpenDrawerState(null, { id: 'u-1' }, 'project-2');
    expect(state.open).toBe(true);
    expect(state.mode).toBe('create');
    expect(state.editingTask).toBeNull();
    expect(state.form.projectId).toBe('project-2');
  });

  it('opens edit drawer with task payload and preserves links', () => {
    const state = createOpenDrawerState(
      {
        id: 'task-1',
        name: 'Review quotation',
        projectId: 'project-3',
        assigneeId: 'u-22',
        accountId: 'a-1',
        leadId: 'l-1',
        quotationId: 'q-1',
      },
      { id: 'u-1' },
      'project-2',
    );

    expect(state.open).toBe(true);
    expect(state.mode).toBe('edit');
    expect(state.editingTask?.id).toBe('task-1');
    expect(state.form.projectId).toBe('project-3');
    expect(state.form.assigneeId).toBe('u-22');
    expect(state.form.accountId).toBe('a-1');
    expect(state.form.leadId).toBe('l-1');
    expect(state.form.quotationId).toBe('q-1');
  });

  it('closes drawer and resets editing state', () => {
    const closed = closeDrawerState({ id: 'u-1' }, 'project-4');
    expect(closed.open).toBe(false);
    expect(closed.mode).toBe('create');
    expect(closed.editingTask).toBeNull();
    expect(closed.saving).toBe(false);
    expect(closed.advanced).toBe(false);
    expect(closed.form.projectId).toBe('project-4');
  });
});

