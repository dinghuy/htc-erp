import { lazy } from 'preact/compat';
import type { CurrentUser } from '../../auth';
import { FeatureRouteShell } from '../shared/FeatureRouteShell';

const UsersScreen = lazy(async () => {
  const module = await import('../../Users');
  return { default: module.Users };
});

export function UsersRoute({
  isMobile,
  currentUser,
}: {
  isMobile?: boolean;
  currentUser: CurrentUser;
}) {
  return (
    <FeatureRouteShell fallbackMessage="Đang tải quản lý người dùng...">
      <UsersScreen isMobile={isMobile} currentUser={currentUser} />
    </FeatureRouteShell>
  );
}
