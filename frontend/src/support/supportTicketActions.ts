type SupportTicketLike = {
  actionAvailability?: {
    canManageTicket?: boolean;
    canOpenTicket?: boolean;
    primaryActionLabel?: string | null;
  } | null;
};
import { buildSupportTicketNavigation } from '../shared/workflow/workflowNavigation';

export function canManageSupportTicket(ticket: SupportTicketLike): boolean {
  return Boolean(ticket.actionAvailability?.canManageTicket);
}

export function buildSupportTicketPrimaryAction(ticket: SupportTicketLike): {
  label: string;
  route: 'Support';
  tab: 'Ticket';
} | null {
  if (!ticket.actionAvailability?.canOpenTicket) return null;
  return {
    ...buildSupportTicketNavigation(),
    label: ticket.actionAvailability?.primaryActionLabel || 'Theo dõi ticket',
  };
}
