import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const supportSource = readFileSync(
  resolve(process.cwd(), 'src/Support.tsx'),
  'utf8',
);

describe('support workflow contract', () => {
  it('renders backend-provided tab and blocker metadata on ticket rows', () => {
    expect(supportSource).toContain('ticket.actionAvailability?.supportTab');
    expect(supportSource).toContain('Tab {ticket.actionAvailability.supportTab}');
    expect(supportSource).toContain('ticket.actionAvailability?.blockers?.length');
    expect(supportSource).toContain('ticket.actionAvailability.blockers.map((blocker) => (');
  });

  it('delegates permission and CTA decisions to shared support ticket helpers', () => {
    expect(supportSource).toContain('const primaryAction = buildSupportTicketPrimaryAction(ticket);');
    expect(supportSource).toContain('const canManageTicket = canManageSupportTicket(ticket);');
    expect(supportSource).toContain('canManageTicket && (');
    expect(supportSource).toContain('!canManageTicket && primaryAction ? (');
  });

  it('uses helper-provided support actions to return to the Ticket tab', () => {
    expect(supportSource).toContain('setActiveSupportTab(primaryAction.tab);');
    expect(supportSource).toContain('onNavigate?.(primaryAction.route);');
    expect(supportSource).toContain('{primaryAction.label}');
  });
});
