import { describe, expect, it } from 'vitest';

import { buildTaskAccess } from '../taskPermissions';

describe('taskPermissions', () => {
  it('grants task editing only to execution-capable roles', () => {
    expect(buildTaskAccess(['project_manager'])).toEqual({
      canCreateTask: true,
      canEditTask: true,
      canDeleteTask: true,
      canUpdateTaskStatus: true,
    });

    expect(buildTaskAccess(['sales', 'project_manager'])).toEqual({
      canCreateTask: true,
      canEditTask: true,
      canDeleteTask: true,
      canUpdateTaskStatus: true,
    });

    expect(buildTaskAccess([], 'manager')).toEqual({
      canCreateTask: true,
      canEditTask: true,
      canDeleteTask: true,
      canUpdateTaskStatus: true,
    });
  });

  it('keeps sales, procurement and viewer read-only in the shared task workspace', () => {
    expect(buildTaskAccess(['sales'])).toEqual({
      canCreateTask: false,
      canEditTask: false,
      canDeleteTask: false,
      canUpdateTaskStatus: false,
    });

    expect(buildTaskAccess(['procurement'])).toEqual({
      canCreateTask: false,
      canEditTask: false,
      canDeleteTask: false,
      canUpdateTaskStatus: false,
    });

    expect(buildTaskAccess(['viewer'])).toEqual({
      canCreateTask: false,
      canEditTask: false,
      canDeleteTask: false,
      canUpdateTaskStatus: false,
    });
  });
});
