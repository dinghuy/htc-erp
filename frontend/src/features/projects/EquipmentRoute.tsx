import { lazy } from 'preact/compat';
import type { CurrentUser } from '../../auth';
import { FeatureRouteShell } from '../shared/FeatureRouteShell';

const EquipmentScreen = lazy(async () => {
  const module = await import('../../Products');
  return {
    default: (props: {
      isMobile?: boolean;
      currentUser?: CurrentUser;
    }) => <module.Products {...props} />,
  };
});

export function EquipmentRoute({
  isMobile,
  currentUser,
}: {
  isMobile?: boolean;
  currentUser: CurrentUser;
}) {
  return (
    <FeatureRouteShell fallbackMessage="Đang tải danh mục sản phẩm...">
      <EquipmentScreen isMobile={isMobile} currentUser={currentUser} />
    </FeatureRouteShell>
  );
}
