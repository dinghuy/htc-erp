import { lazy } from 'preact/compat';
import type { CurrentUser } from '../../auth';
import { FeatureRouteShell } from '../shared/FeatureRouteShell';

const ChatPanelScreen = lazy(async () => {
  const module = await import('../../ops/ChatPanel');
  return { default: module.ChatPanel };
});

export function OpsChatRoute({
  currentUser,
  isMobile,
}: {
  currentUser: CurrentUser;
  isMobile?: boolean;
}) {
  return (
    <FeatureRouteShell fallbackMessage="Đang tải trao đổi vận hành...">
      <ChatPanelScreen currentUser={currentUser} isMobile={isMobile} />
    </FeatureRouteShell>
  );
}
