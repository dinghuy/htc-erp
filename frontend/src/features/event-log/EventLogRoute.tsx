import { lazy } from 'preact/compat';
import type { CurrentUser } from '../../auth';
import { FeatureRouteShell } from '../shared/FeatureRouteShell';

const EventLogScreen = lazy(async () => {
  const module = await import('../../EventLog');
  return { default: module.EventLog };
});

export function EventLogRoute({
  isMobile,
  currentUser,
  onNavigate,
}: {
  isMobile?: boolean;
  currentUser: CurrentUser;
  onNavigate?: (route: string) => void;
}) {
  return (
    <FeatureRouteShell fallbackMessage="Đang tải nhật ký hoạt động...">
      <EventLogScreen isMobile={isMobile} currentUser={currentUser} onNavigate={onNavigate} />
    </FeatureRouteShell>
  );
}
