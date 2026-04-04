import { lazy } from 'preact/compat';
import type { CurrentUser } from '../../auth';
import { FeatureRouteShell } from '../shared/FeatureRouteShell';

const ProjectsScreen = lazy(async () => {
  const module = await import('../../Projects');
  return { default: module.Projects };
});

export function ProjectsRoute({
  isMobile,
  currentUser,
  onNavigate,
}: {
  isMobile?: boolean;
  currentUser: CurrentUser;
  onNavigate?: (route: string) => void;
}) {
  return (
    <FeatureRouteShell fallbackMessage="Đang tải workspace dự án...">
      <ProjectsScreen isMobile={isMobile} currentUser={currentUser} onNavigate={onNavigate} />
    </FeatureRouteShell>
  );
}
