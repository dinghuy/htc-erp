import { APP_MODULES, type AppModule } from '../shared/domain/contracts';

export const KNOWN_APP_ROUTES = new Set<string>(APP_MODULES);

export function normalizeRoute(route: string): string {
  if (route === 'Dashboard') return 'Home';
  return route;
}

export function resolveProtectedRoute(route: string, allowedModules: AppModule[]): AppModule {
  const normalizedRoute = normalizeRoute(route);
  if (allowedModules.includes(route as AppModule)) {
    return route as AppModule;
  }
  if (allowedModules.includes(normalizedRoute as AppModule)) {
    return normalizedRoute as AppModule;
  }
  return 'Home';
}

export function isKnownRoute(route: string): route is AppModule {
  return KNOWN_APP_ROUTES.has(route);
}
