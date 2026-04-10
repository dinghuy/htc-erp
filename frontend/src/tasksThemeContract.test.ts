import { describe, it } from 'vitest';
import { expectFilesToAvoidLiterals } from './qa/themeAuditContracts';

describe('tasks theme contracts', () => {
  it('keeps task surfaces on semantic tokens instead of light-only literals', () => {
    expectFilesToAvoidLiterals([
      'Tasks.tsx',
      'features/tasks/TasksWorkspaceShell.tsx',
      'features/tasks/taskDomain.ts',
      'features/tasks/taskViews.tsx',
    ]);
  });
});
