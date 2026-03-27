import { describe, expect, it } from 'vitest';
import { buildWorkspaceCollections } from '../taskData';

function response(ok: boolean) {
  return { ok } as Response;
}

describe('taskData guards', () => {
  it('throws when core data endpoints fail', () => {
    expect(() =>
      buildWorkspaceCollections({
        taskRes: response(false),
        projectRes: response(true),
        userRes: response(true),
        accountRes: response(true),
        leadRes: response(true),
        quotationRes: response(true),
        tasksPayload: [],
        projectsPayload: [],
        usersPayload: [],
        accountsPayload: [],
        leadsPayload: [],
        quotationsPayload: [],
      }),
    ).toThrow('core_data_failed');
  });

  it('accepts array payloads nested under data/items/results', () => {
    const result = buildWorkspaceCollections({
      taskRes: response(true),
      projectRes: response(true),
      userRes: response(true),
      accountRes: response(true),
      leadRes: response(true),
      quotationRes: response(true),
      tasksPayload: { data: [{ id: 't-1' }] },
      projectsPayload: { items: [{ id: 'p-1' }] },
      usersPayload: { results: [{ id: 'u-1' }] },
      accountsPayload: { data: [{ id: 'a-1' }] },
      leadsPayload: { items: [{ id: 'l-1' }] },
      quotationsPayload: { results: [{ id: 'q-1' }] },
    });

    expect(result.tasks).toHaveLength(1);
    expect(result.projects).toHaveLength(1);
    expect(result.users).toHaveLength(1);
    expect(result.accounts).toHaveLength(1);
    expect(result.leads).toHaveLength(1);
    expect(result.quotations).toHaveLength(1);
    expect(result.userLoadWarning).toBe('');
  });

  it('keeps screen stable when users payload is invalid', () => {
    const result = buildWorkspaceCollections({
      taskRes: response(true),
      projectRes: response(true),
      userRes: response(true),
      accountRes: response(true),
      leadRes: response(true),
      quotationRes: response(true),
      tasksPayload: [],
      projectsPayload: [],
      usersPayload: { error: 'invalid-shape' },
      accountsPayload: [],
      leadsPayload: [],
      quotationsPayload: [],
    });

    expect(result.users).toEqual([]);
    expect(result.userLoadWarning.length).toBeGreaterThan(0);
  });

  it('does not raise user warning when users payload is a valid empty array', () => {
    const result = buildWorkspaceCollections({
      taskRes: response(true),
      projectRes: response(true),
      userRes: response(true),
      accountRes: response(true),
      leadRes: response(true),
      quotationRes: response(true),
      tasksPayload: [],
      projectsPayload: [],
      usersPayload: [],
      accountsPayload: [],
      leadsPayload: [],
      quotationsPayload: [],
    });

    expect(result.users).toEqual([]);
    expect(result.userLoadWarning).toBe('');
  });
});
