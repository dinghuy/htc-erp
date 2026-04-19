import { describe, expect, it } from 'vitest';

import { resolveApiBase } from './client';

describe('resolveApiBase', () => {
  it('prefers an explicit API URL from env', () => {
    expect(resolveApiBase('http://api.internal:9999/custom')).toBe('http://api.internal:9999/custom');
  });

  it('normalizes loopback env URLs to the current browser hostname for local QA', () => {
    expect(resolveApiBase('http://localhost:3001/api', '127.0.0.1')).toBe('http://127.0.0.1:3001/api');
    expect(resolveApiBase('http://127.0.0.1:3001/api', 'localhost')).toBe('http://localhost:3001/api');
  });

  it('falls back to the current browser hostname for local QA', () => {
    expect(resolveApiBase(undefined, '127.0.0.1')).toBe('http://127.0.0.1:3001/api');
    expect(resolveApiBase(undefined, 'localhost')).toBe('http://localhost:3001/api');
  });

  it('defaults to localhost when no hostname is available', () => {
    expect(resolveApiBase()).toBe('http://localhost:3001/api');
  });
});
