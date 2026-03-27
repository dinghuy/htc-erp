import type { NavContext } from '../navContext';
import type { RolePersonaMode } from '../shared/domain/contracts';

export type HomeNavigationTarget = {
  route: string;
  navContext?: NavContext;
};

function includesAny(haystack: string, needles: string[]) {
  return needles.some((needle) => haystack.includes(needle));
}

export function buildHomePriorityNavigation(metricKey: string, personaMode: RolePersonaMode): HomeNavigationTarget {
  const key = String(metricKey || '').trim().toLowerCase();

  if (includesAny(key, ['approval'])) {
    return { route: 'Approvals' };
  }

  if (includesAny(key, ['blocker', 'risk', 'missing'])) {
    return { route: 'Inbox' };
  }

  if (includesAny(key, ['handoff', 'deal'])) {
    if (personaMode === 'sales') return { route: 'Sales' };
    return { route: 'My Work' };
  }

  if (includesAny(key, ['project'])) {
    return { route: 'Projects' };
  }

  return { route: 'My Work' };
}

export function buildHomeHighlightNavigation(projectId: string): HomeNavigationTarget {
  return {
    route: 'Projects',
    navContext: {
      route: 'Projects',
      entityType: 'Project',
      entityId: projectId,
    },
  };
}
