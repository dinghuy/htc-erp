import { describe, it } from 'vitest';
import { expectFilesToAvoidLiterals } from './qa/themeAuditContracts';

describe('projects theme contracts', () => {
  it('keeps project workspace surfaces on semantic tokens instead of hardcoded neutrals', () => {
    expectFilesToAvoidLiterals([
      'projects/ProjectWorkspaceTabs.tsx',
      'projects/ProjectWorkspaceModals.tsx',
    ]);
  });
});
