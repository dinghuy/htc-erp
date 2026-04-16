import { lazy } from 'preact/compat';
import type { CurrentUser } from '../../auth';
import { FeatureRouteShell } from '../shared/FeatureRouteShell';

const LeadsScreen = lazy(async () => {
  const module = await import('../../Leads');
  return { default: module.Leads };
});

type LeadsRouteProps = {
  currentUser?: CurrentUser | null;
  isMobile?: boolean;
};

export function LeadsRoute({ currentUser, isMobile }: LeadsRouteProps) {
  return (
    <FeatureRouteShell fallbackMessage="Đang tải khu vực lead...">
      <LeadsScreen currentUser={currentUser} isMobile={isMobile} />
    </FeatureRouteShell>
  );
}
