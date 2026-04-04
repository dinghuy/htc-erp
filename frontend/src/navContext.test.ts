import { beforeEach, describe, expect, it } from 'vitest';

import { clearNavContext, consumeNavContext, setNavContext } from './navContext';

function createStorageMock(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

describe('navContext', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: createStorageMock(),
      configurable: true,
      writable: true,
    });
    localStorage.clear();
  });

  it('consumes the matching route context once', () => {
    setNavContext({ route: 'Projects', filters: { workspaceTab: 'commercial', documentId: 'doc-1', approvalId: 'approval-1', openThread: true } as any });

    expect(consumeNavContext('Projects')).toMatchObject({
      route: 'Projects',
      filters: { workspaceTab: 'commercial', documentId: 'doc-1', approvalId: 'approval-1', openThread: true },
    });
    expect(consumeNavContext('Projects')).toBeNull();
  });

  it('preserves context when another route checks first', () => {
    setNavContext({ route: 'Approvals', filters: { approvalLane: 'finance' } });

    expect(consumeNavContext('Inbox')).toBeNull();
    expect(consumeNavContext('Approvals')).toMatchObject({
      route: 'Approvals',
      filters: { approvalLane: 'finance' },
    });
  });

  it('can clear stale context intentionally', () => {
    setNavContext({ route: 'My Work', filters: { workFocus: 'commercial' } });

    clearNavContext();

    expect(consumeNavContext('My Work')).toBeNull();
  });
});
