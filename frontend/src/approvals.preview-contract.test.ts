import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('approvals preview source contract', () => {
  it('keeps finance/legal preview actions visible for admin-origin role previews', () => {
    const source = readFileSync(path.resolve(__dirname, 'Approvals.tsx'), 'utf8');

    expect(source).toContain('const canPreviewDecide = Boolean(');
    expect(source).toContain("currentUser.baseRoleCodes?.includes('admin')");
    expect(source).toContain('{ ...approval, approverUserId: null }');
  });
});
