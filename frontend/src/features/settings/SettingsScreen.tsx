import type { RolePreviewNavigation } from '../../authRolePreview';
import type { CurrentUser, SystemRole } from '../../auth';
import { Settings } from '../../Settings';

type SettingsScreenProps = {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  isMobile?: boolean;
  currentUser: CurrentUser;
  onRolePreviewChange?: (previewRoleCodes?: SystemRole[], navigation?: RolePreviewNavigation) => void;
  onUserUpdated?: (partial: Partial<CurrentUser>) => void;
};

export function SettingsScreen(props: SettingsScreenProps) {
  return <Settings {...props} />;
}
