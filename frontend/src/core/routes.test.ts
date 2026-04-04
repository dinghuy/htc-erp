import { describe, expect, it } from 'vitest';
import { normalizeRoute, resolveProtectedRoute } from './routes';

describe('routes', () => {
  it('normalizes legacy dashboard route to home', () => {
    expect(normalizeRoute('Dashboard')).toBe('Home');
  });

  it('falls back to home when route is not allowed', () => {
    expect(resolveProtectedRoute('Users', ['Home', 'Projects'])).toBe('Home');
  });

  it('falls back when a removed route is requested', () => {
    expect(normalizeRoute('Pricing')).toBe('Pricing');
    expect(resolveProtectedRoute('Pricing', ['Home', 'Projects'])).toBe('Home');
  });
});
