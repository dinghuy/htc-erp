import { describe, expect, it } from 'vitest';

import { buildRolePreviewChecklist } from './rolePreviewChecklist';

describe('role preview checklist', () => {
  it('returns a combined checklist for sales + project manager preview', () => {
    const checklist = buildRolePreviewChecklist(['sales', 'project_manager']);
    expect(checklist.title).toBe('Sales + PM QA checklist');
    expect(checklist.items.length).toBeGreaterThanOrEqual(4);
  });

  it('falls back to admin checklist when no preview roles are active', () => {
    const checklist = buildRolePreviewChecklist(['admin']);
    expect(checklist.title).toBe('Admin QA checklist');
    expect(checklist.description).toContain('admin');
  });
});
