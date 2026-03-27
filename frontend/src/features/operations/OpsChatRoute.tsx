import { lazy } from 'preact/compat';
import type { CurrentUser } from '../../auth';
import { FeatureRouteShell } from '../shared/FeatureRouteShell';

const ChatPanelScreen = lazy(async () => {
  const module = await import('../../ops/ChatPanel');
  return { default: module.ChatPanel };
});

export function OpsChatRoute({
  currentUser,
}: {
  currentUser: CurrentUser;
}) {
  return (
    <FeatureRouteShell fallbackMessage="Dang tai trao doi van hanh...">
      <ChatPanelScreen currentUser={currentUser} />
    </FeatureRouteShell>
  );
}
