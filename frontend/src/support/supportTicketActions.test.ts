import { describe, expect, it } from 'vitest';

import { buildSupportTicketPrimaryAction, canManageSupportTicket } from './supportTicketActions';

describe('supportTicketActions', () => {
  it('uses backend contract to decide if a ticket is manageable', () => {
    expect(canManageSupportTicket({
      actionAvailability: { canManageTicket: true },
    } as any)).toBe(true);
    expect(canManageSupportTicket({
      actionAvailability: { canManageTicket: false },
    } as any)).toBe(false);
  });

  it('builds a support primary action that always returns to the Ticket tab', () => {
    expect(buildSupportTicketPrimaryAction({
      actionAvailability: {
        canOpenTicket: true,
        primaryActionLabel: 'Review ticket',
      },
    } as any)).toEqual({
      label: 'Review ticket',
      route: 'Support',
      tab: 'Ticket',
    });
  });

  it('returns no action when backend does not expose ticket navigation', () => {
    expect(buildSupportTicketPrimaryAction({
      actionAvailability: {
        canOpenTicket: false,
      },
    } as any)).toBeNull();
  });
});
