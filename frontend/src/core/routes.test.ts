import { describe, expect, it } from 'vitest';
import { normalizeRoute, resolveProtectedRoute } from './routes';

describe('routes', () => {
  it('normalizes legacy dashboard route to home', () => {
    expect(normalizeRoute('Dashboard')).toBe('Home');
  });

  it('falls back to home when route is not allowed', () => {
    expect(resolveProtectedRoute('Users', ['Home', 'Projects'])).toBe('Home');
  });

  it('keeps pricing as a first-class route', () => {
    expect(normalizeRoute('Pricing')).toBe('Pricing');
    expect(resolveProtectedRoute('Pricing', ['Home', 'Pricing'])).toBe('Pricing');
  });
});
