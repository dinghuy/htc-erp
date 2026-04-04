import { lazy } from 'preact/compat';
import type { CurrentUser } from '../../auth';
import { FeatureRouteShell } from '../shared/FeatureRouteShell';

const SupportScreen = lazy(async () => {
  const module = await import('../../Support');
  return { default: module.Support };
});

export function SupportRoute({
  isMobile,
  currentUser,
}: {
  isMobile?: boolean;
  currentUser: CurrentUser;
}) {
  return (
    <FeatureRouteShell fallbackMessage="Đang tải trung tâm hỗ trợ...">
      <SupportScreen isMobile={isMobile} currentUser={currentUser} />
    </FeatureRouteShell>
  );
}
