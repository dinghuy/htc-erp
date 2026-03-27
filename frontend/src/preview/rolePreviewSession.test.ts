import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getRolePreviewSessionStorageKey,
  loadRolePreviewSessionProgress,
  resetRolePreviewSessionProgress,
  saveRolePreviewSessionProgress,
  toggleRolePreviewSessionChecklistItem,
} from './rolePreviewSession';

const storageFactory = () => {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
  };
};

describe('rolePreviewSession', () => {
  const originalStorage = globalThis.localStorage;
  let localStorageMock: ReturnType<typeof storageFactory>;

  beforeEach(() => {
    localStorageMock = storageFactory();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: localStorageMock,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: originalStorage,
    });
  });

  it('builds a stable storage key for combined roles regardless of input order', () => {
    expect(getRolePreviewSessionStorageKey(['sales', 'project_manager'])).toBe(
      getRolePreviewSessionStorageKey(['project_manager', 'sales']),
    );
  });

  it('saves and loads checklist progress', () => {
    saveRolePreviewSessionProgress(['legal'], [2, 0, 2]);
    expect(loadRolePreviewSessionProgress(['legal']).completedItemIndexes).toEqual([0, 2]);
  });

  it('toggles checklist items and can reset the session', () => {
    expect(toggleRolePreviewSessionChecklistItem(['accounting'], 1).completedItemIndexes).toEqual([1]);
    expect(toggleRolePreviewSessionChecklistItem(['accounting'], 3).completedItemIndexes).toEqual([1, 3]);
    expect(toggleRolePreviewSessionChecklistItem(['accounting'], 1).completedItemIndexes).toEqual([3]);

    resetRolePreviewSessionProgress(['accounting']);
    expect(loadRolePreviewSessionProgress(['accounting']).completedItemIndexes).toEqual([]);
  });
});
