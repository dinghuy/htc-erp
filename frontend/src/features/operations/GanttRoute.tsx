import { lazy } from 'preact/compat';
import type { CurrentUser } from '../../auth';
import { FeatureRouteShell } from '../shared/FeatureRouteShell';

const GanttScreen = lazy(async () => {
  const module = await import('../../ops/GanttView');
  return { default: module.GanttView };
});

export function GanttRoute({
  currentUser,
}: {
  currentUser: CurrentUser;
}) {
  return (
    <FeatureRouteShell fallbackMessage="Đang tải gantt vận hành...">
      <GanttScreen token={currentUser.token} currentUser={currentUser} />
    </FeatureRouteShell>
  );
}
