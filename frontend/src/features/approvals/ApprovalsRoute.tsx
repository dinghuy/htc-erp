import { h } from 'preact';

import { Approvals } from '../../Approvals';
import type { CurrentUser } from '../../auth';

type ApprovalsRouteProps = {
  currentUser: CurrentUser;
  onNavigate?: (route: string) => void;
};

export function ApprovalsRoute({ currentUser, onNavigate }: ApprovalsRouteProps) {
  return h(Approvals, { currentUser, onNavigate });
}
