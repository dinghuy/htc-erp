import { describe, expect, it } from 'vitest';
import {
  closeDrawerState,
  createClosedDrawerState,
  createOpenDrawerState,
} from '../taskDrawerState';
import type { TaskRecord } from '../taskDomain';

describe('taskDrawerState', () => {
  it('creates closed state with create mode by default', () => {
    const state = createClosedDrawerState({ id: 1 }, '1');
    expect(state.open).toBe(false);
    expect(state.mode).toBe('create');
    expect(state.editingTask).toBeNull();
    expect(state.form.projectId).toBe('1');
  });

  it('opens create drawer when no task is provided', () => {
    const state = createOpenDrawerState(null, { id: 1 }, '2');
    expect(state.open).toBe(true);
    expect(state.mode).toBe('create');
    expect(state.editingTask).toBeNull();
    expect(state.form.projectId).toBe('2');
  });

  it('opens edit drawer with task payload and preserves links', () => {
    const state = createOpenDrawerState(
      {
        id: 1,
        name: 'Review quotation',
        projectId: 3,
        assigneeId: 22,
        accountId: 1,
        leadId: 1,
        quotationId: 1,
      } as TaskRecord,
      { id: 1 },
      '2',
    );

    expect(state.open).toBe(true);
    expect(state.mode).toBe('edit');
    expect(state.editingTask?.id).toBe(1);
    expect(state.form.projectId).toBe('3');
    expect(state.form.assigneeId).toBe('22');
    expect(state.form.accountId).toBe('1');
    expect(state.form.leadId).toBe('1');
    expect(state.form.quotationId).toBe('1');
  });

  it('closes drawer and resets editing state', () => {
    const closed = closeDrawerState({ id: 1 }, '4');
    expect(closed.open).toBe(false);
    expect(closed.mode).toBe('create');
    expect(closed.editingTask).toBeNull();
    expect(closed.saving).toBe(false);
    expect(closed.advanced).toBe(false);
    expect(closed.form.projectId).toBe('4');
  });
});

