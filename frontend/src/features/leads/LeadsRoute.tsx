import { h } from 'preact';
import { Leads } from '../../Leads';
import type { CurrentUser } from '../../auth';

type LeadsRouteProps = {
  currentUser?: CurrentUser | null;
  isMobile?: boolean;
};

export function LeadsRoute({ currentUser, isMobile }: LeadsRouteProps) {
  return h(Leads, { currentUser, isMobile });
}
