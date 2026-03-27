import { describe, expect, it } from 'vitest';
import {
  backendStatusFromUi,
  buildTaskForm,
  buildTaskPayload,
  matchesTaskSearch,
  normalizePriority,
  normalizeTaskStatus,
} from '../taskDomain';

describe('taskDomain', () => {
  it('maps backend task statuses to UI statuses safely', () => {
    expect(normalizeTaskStatus('active')).toBe('in_progress');
    expect(normalizeTaskStatus('completed')).toBe('complete');
    expect(normalizeTaskStatus('paused')).toBe('on_hold');
    expect(normalizeTaskStatus('cancelled')).toBe('cancelled');
    expect(normalizeTaskStatus('unexpected')).toBe('not_started');
  });

  it('maps UI statuses back to backend contract', () => {
    expect(backendStatusFromUi('in_progress')).toBe('active');
    expect(backendStatusFromUi('complete')).toBe('completed');
    expect(backendStatusFromUi('on_hold')).toBe('paused');
    expect(backendStatusFromUi('cancelled')).toBe('cancelled');
    expect(backendStatusFromUi('not_started')).toBe('pending');
  });

  it('normalizes priority and keeps urgent as high', () => {
    expect(normalizePriority('high')).toBe('high');
    expect(normalizePriority('urgent')).toBe('high');
    expect(normalizePriority('low')).toBe('low');
    expect(normalizePriority('anything-else')).toBe('medium');
  });

  it('builds payload without changing API shape and forces 100% on complete', () => {
    const payload = buildTaskPayload({
      name: '  Follow up customer  ',
      description: '  details  ',
      projectId: 'p-1',
      assigneeId: 'u-1',
      uiStatus: 'complete',
      priority: 'high',
      startDate: '2026-03-26',
      dueDate: '2026-03-29',
      completionPct: 40,
      notes: '  notes  ',
      blockedReason: '',
      taskType: 'follow_up',
      department: 'Sales',
      accountId: 'a-1',
      leadId: 'l-1',
      quotationId: 'q-1',
      target: '  close deal  ',
      resultLinks: '  http://x  ',
      output: '  done  ',
      reportDate: '2026-03-30',
    });

    expect(payload).toEqual(
      expect.objectContaining({
        name: 'Follow up customer',
        status: 'completed',
        completionPct: 100,
        blockedReason: null,
        target: 'close deal',
      }),
    );
  });

  it('builds create form default using selected project scope', () => {
    const form = buildTaskForm(null, { id: 'u-99' }, 'project-88');
    expect(form.projectId).toBe('project-88');
    expect(form.assigneeId).toBe('u-99');
    expect(form.uiStatus).toBe('not_started');
    expect(form.priority).toBe('medium');
  });

  it('matches task search across multiple fields', () => {
    const task = {
      id: 't-1',
      name: 'Prepare quotation package',
      description: 'Customer asks for revised scope',
      projectName: 'Project Delta',
      assigneeName: 'Linh',
      department: 'Sales',
      taskType: 'follow_up',
      target: 'quotation:abc',
      output: 'sent email',
    };

    expect(matchesTaskSearch(task, 'delta')).toBe(true);
    expect(matchesTaskSearch(task, 'linh')).toBe(true);
    expect(matchesTaskSearch(task, 'follow_up')).toBe(true);
    expect(matchesTaskSearch(task, 'not-found')).toBe(false);
  });
});

