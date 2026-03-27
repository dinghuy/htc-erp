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
    <FeatureRouteShell fallbackMessage="Dang tai trung tam ho tro...">
      <SupportScreen isMobile={isMobile} currentUser={currentUser} />
    </FeatureRouteShell>
  );
}
