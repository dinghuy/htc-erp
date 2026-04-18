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

export function EquipmentRoute(props: {
  isMobile?: boolean;
  currentUser: CurrentUser;
  onNavigate?: (route: string) => void;
}) {
  return (
    <FeatureRouteShell fallbackMessage="Đang tải danh mục sản phẩm...">
      <EquipmentScreen isMobile={props.isMobile} currentUser={props.currentUser} />
    </FeatureRouteShell>
  );
}
