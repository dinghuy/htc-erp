import { lazy } from 'preact/compat';
import type { CurrentUser } from '../../auth';
import { FeatureRouteShell } from '../shared/FeatureRouteShell';

const TasksScreen = lazy(async () => {
  const module = await import('../../Tasks');
  return { default: module.Tasks };
});

export function TasksRoute({
  isMobile,
  currentUser,
  onNavigate,
}: {
  isMobile?: boolean;
  currentUser: CurrentUser;
  onNavigate?: (route: string) => void;
}) {
  return (
    <FeatureRouteShell fallbackMessage="Đang tải khu vực công việc...">
      <TasksScreen isMobile={isMobile} currentUser={currentUser} onNavigate={onNavigate} />
    </FeatureRouteShell>
  );
}
