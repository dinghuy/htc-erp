import type { CurrentUser } from '../../auth';
import { Settings } from '../../Settings';

type SettingsScreenProps = {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  isMobile?: boolean;
  currentUser: CurrentUser;
  onUserUpdated?: (partial: Partial<CurrentUser>) => void;
  onSystemSettingsUpdated?: (partial: Record<string, unknown>) => void;
};

export function SettingsScreen({
  isDarkMode,
  toggleDarkMode,
  isMobile,
  currentUser,
  onUserUpdated,
}: SettingsScreenProps) {
  return (
    <Settings
      isDarkMode={isDarkMode}
      toggleDarkMode={toggleDarkMode}
      isMobile={isMobile}
      currentUser={currentUser}
      onUserUpdated={onUserUpdated}
    />
  );
}
