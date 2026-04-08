import { describe, expect, it, vi } from 'vitest';

import { guardWorkspaceAction } from './workspaceGuardedActions';

describe('guardWorkspaceAction', () => {
  it('runs the wrapped action when access is allowed', () => {
    const onDenied = vi.fn();
    const action = vi.fn((value: string) => `ok:${value}`);
    const guardedAction = guardWorkspaceAction({
      allowed: true,
      deniedMessage: 'denied',
      onDenied,
      action,
    });

    const result = guardedAction('demo');

    expect(result).toBe('ok:demo');
    expect(action).toHaveBeenCalledWith('demo');
    expect(onDenied).not.toHaveBeenCalled();
  });

  it('blocks the wrapped action and notifies when access is denied', () => {
    const onDenied = vi.fn();
    const action = vi.fn();
    const guardedAction = guardWorkspaceAction({
      allowed: false,
      deniedMessage: 'denied',
      onDenied,
      action,
    });

    const result = guardedAction('demo');

    expect(result).toBeUndefined();
    expect(action).not.toHaveBeenCalled();
    expect(onDenied).toHaveBeenCalledWith('denied');
  });
});
