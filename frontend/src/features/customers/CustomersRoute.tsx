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
    fallbackMessage: 'Dang tai khu vuc khach hang...',
  },
  Contacts: {
    view: 'contacts',
    fallbackMessage: 'Dang tai khu vuc lien he...',
  },
  Partners: {
    view: 'accounts',
    initialAccountType: 'Partner',
    fallbackMessage: 'Dang tai khu vuc doi tac...',
  },
  Suppliers: {
    view: 'accounts',
    initialAccountType: 'Supplier',
    fallbackMessage: 'Dang tai khu vuc nha cung cap...',
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
