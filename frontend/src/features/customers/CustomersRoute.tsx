import { lazy } from 'preact/compat';
import type { CurrentUser } from '../../auth';
import { FeatureRouteShell } from '../shared/FeatureRouteShell';

const CustomersScreen = lazy(async () => {
  const module = await import('../../Customers');
  return { default: module.Customers };
});

type CustomersRouteName = 'Accounts' | 'Contacts' | 'Partners' | 'Suppliers';
type CustomersView = 'accounts' | 'contacts';
type AccountTypeFilter = 'Customer' | 'Supplier' | 'Partner';

const CUSTOMERS_ROUTE_CONFIG: Record<CustomersRouteName, { view: CustomersView; initialAccountType?: AccountTypeFilter; fallbackMessage: string }> = {
  Accounts: {
    view: 'accounts',
    initialAccountType: 'Customer',
    fallbackMessage: 'Đang tải khu vực khách hàng...',
  },
  Contacts: {
    view: 'contacts',
    fallbackMessage: 'Đang tải khu vực liên hệ...',
  },
  Partners: {
    view: 'accounts',
    initialAccountType: 'Partner',
    fallbackMessage: 'Đang tải khu vực đối tác...',
  },
  Suppliers: {
    view: 'accounts',
    initialAccountType: 'Supplier',
    fallbackMessage: 'Đang tải khu vực nhà cung cấp...',
  },
};

export function CustomersRoute({
  route,
  isMobile,
  currentUser,
  onNavigate,
}: {
  route: CustomersRouteName;
  isMobile?: boolean;
  currentUser: CurrentUser;
  onNavigate?: (route: string) => void;
}) {
  const config = CUSTOMERS_ROUTE_CONFIG[route];

  return (
    <FeatureRouteShell fallbackMessage={config.fallbackMessage}>
      <CustomersScreen
        view={config.view}
        initialAccountType={config.initialAccountType}
        isMobile={isMobile}
        currentUser={currentUser}
        onNavigate={onNavigate}
      />
    </FeatureRouteShell>
  );
}
