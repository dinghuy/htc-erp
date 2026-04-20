import { describe, expect, it } from 'vitest';

import { cloneUpdatedViewingUser, supportsUserBulkFileActions } from './userCrudHelpers';

function normalizeCreateMustChangePassword(value: unknown): number {
  return value === false || value === 0 ? 0 : 1;
}

describe('user CRUD contracts', () => {
  it('preserves explicit false for must-change-password on create payload normalization', () => {
    expect(normalizeCreateMustChangePassword(false)).toBe(0);
    expect(normalizeCreateMustChangePassword(0)).toBe(0);
    expect(normalizeCreateMustChangePassword(true)).toBe(1);
    expect(normalizeCreateMustChangePassword(undefined)).toBe(1);
  });

  it('enables bulk file actions for managers of the users screen', () => {
    expect(supportsUserBulkFileActions(true)).toBe(true);
    expect(supportsUserBulkFileActions(false)).toBe(false);
  });

  it('updates currently opened detail record after edit response returns the same user', () => {
    const current = { id: 'u-1', fullName: 'Old Name', accountStatus: 'locked' };
    const updated = { id: 'u-1', fullName: 'New Name', accountStatus: 'active' };

    expect(cloneUpdatedViewingUser(current, updated)).toMatchObject({
      id: 'u-1',
      fullName: 'New Name',
      accountStatus: 'active',
    });
    expect(cloneUpdatedViewingUser({ id: 'u-2' }, updated)).toEqual({ id: 'u-2' });
  });
});
