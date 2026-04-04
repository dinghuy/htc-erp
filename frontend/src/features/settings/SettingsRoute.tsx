import type { RolePreviewNavigation } from '../../authRolePreview';
import { lazy } from 'preact/compat';
import type { CurrentUser, SystemRole } from '../../auth';
import { FeatureRouteShell } from '../shared/FeatureRouteShell';

const SettingsScreen = lazy(async () => {
  const module = await import('../../Settings');
  return { default: module.Settings };
});

export function SettingsRoute({
  isDarkMode,
  toggleDarkMode,
  isMobile,
  currentUser,
  onRolePreviewChange,
  onUserUpdated,
}: {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  isMobile?: boolean;
  currentUser: CurrentUser;
  onRolePreviewChange?: (previewRoleCodes?: SystemRole[], navigation?: RolePreviewNavigation) => void;
  onUserUpdated?: (partial: Partial<CurrentUser>) => void;
}) {
  return (
    <FeatureRouteShell fallbackMessage="Đang tải cài đặt...">
      <SettingsScreen
        isDarkMode={isDarkMode}
        toggleDarkMode={toggleDarkMode}
        isMobile={isMobile}
        currentUser={currentUser}
        onRolePreviewChange={onRolePreviewChange}
        onUserUpdated={onUserUpdated}
      />
    </FeatureRouteShell>
  );
}
