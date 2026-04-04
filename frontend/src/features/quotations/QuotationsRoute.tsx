import { lazy } from 'preact/compat';
import type { CurrentUser } from '../../auth';
import { FeatureRouteShell } from '../shared/FeatureRouteShell';

const QuotationsScreen = lazy(async () => {
  const module = await import('../../Quotations');
  return { default: module.Quotations };
});

export function QuotationsRoute({
  autoOpenForm,
  onFormOpened,
  isMobile,
  currentUser,
}: {
  autoOpenForm?: boolean;
  onFormOpened?: () => void;
  isMobile?: boolean;
  currentUser: CurrentUser;
}) {
  return (
    <FeatureRouteShell fallbackMessage="Đang tải khu vực báo giá...">
      <QuotationsScreen
        autoOpenForm={autoOpenForm}
        onFormOpened={onFormOpened}
        isMobile={isMobile}
        currentUser={currentUser}
      />
    </FeatureRouteShell>
  );
}
