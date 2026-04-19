import type { CurrentUser, SystemRole } from '../../auth';
import type { RolePreviewNavigation } from '../../authRolePreview';
import { Settings } from '../../Settings';

type SettingsScreenProps = {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  isMobile?: boolean;
  currentUser: CurrentUser;
  onRolePreviewChange?: (previewRoleCodes?: SystemRole[], navigation?: RolePreviewNavigation) => void;
  onUserUpdated?: (partial: Partial<CurrentUser>) => void;
  onSystemSettingsUpdated?: (partial: Record<string, unknown>) => void;
};

export function SettingsScreen({
  onSystemSettingsUpdated: _onSystemSettingsUpdated,
  ...props
}: SettingsScreenProps) {
  return <Settings {...props} />;
}
