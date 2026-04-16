import { lazy } from 'preact/compat';
import type { CurrentUser } from '../../auth';
import { FeatureRouteShell } from '../shared/FeatureRouteShell';

const ApprovalsScreen = lazy(async () => {
  const module = await import('../../Approvals');
  return { default: module.Approvals };
});

type ApprovalsRouteProps = {
  currentUser: CurrentUser;
  onNavigate?: (route: string) => void;
};

export function ApprovalsRoute({ currentUser, onNavigate }: ApprovalsRouteProps) {
  return (
    <FeatureRouteShell fallbackMessage="Đang tải phê duyệt...">
      <ApprovalsScreen currentUser={currentUser} onNavigate={onNavigate} />
    </FeatureRouteShell>
  );
}
