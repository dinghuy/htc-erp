import { lazy } from 'preact/compat';
import type { CurrentUser } from '../../auth';
import { FeatureRouteShell } from '../shared/FeatureRouteShell';

const SettingsScreen = lazy(async () => {
  const module = await import('./SettingsScreen');
  return { default: module.SettingsScreen };
});

export function SettingsRoute({
  isDarkMode,
  toggleDarkMode,
  isMobile,
  currentUser,
  onUserUpdated,
  onSystemSettingsUpdated,
}: {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  isMobile?: boolean;
  currentUser: CurrentUser;
  onUserUpdated?: (partial: Partial<CurrentUser>) => void;
  onSystemSettingsUpdated?: (partial: Record<string, unknown>) => void;
}) {
  return (
    <FeatureRouteShell fallbackMessage="Đang tải cài đặt...">
      <SettingsScreen
        isDarkMode={isDarkMode}
        toggleDarkMode={toggleDarkMode}
        isMobile={isMobile}
        currentUser={currentUser}
        onUserUpdated={onUserUpdated}
        onSystemSettingsUpdated={onSystemSettingsUpdated}
      />
    </FeatureRouteShell>
  );
}
