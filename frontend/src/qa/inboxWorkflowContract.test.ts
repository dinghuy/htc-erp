import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const inboxSource = readFileSync(
  resolve(process.cwd(), 'src/Inbox.tsx'),
  'utf8',
);

describe('inbox workflow contract', () => {
  it('delegates project workspace navigation to the shared inbox helper', () => {
    expect(inboxSource).toContain('const target = buildInboxProjectWorkspaceNavigation(item);');
    expect(inboxSource).toContain('if (!target) return;');
    expect(inboxSource).toContain('setNavContext(target.navContext);');
    expect(inboxSource).toContain('onNavigate?.(target.route);');
  });

  it('renders backend workflow metadata on inbox rows', () => {
    expect(inboxSource).toContain('item.actionAvailability?.workspaceTab ? <span style={ui.badge.neutral}>Tab {item.actionAvailability.workspaceTab}</span> : null');
    expect(inboxSource).toContain("{item.actionAvailability?.primaryActionLabel || 'Mở workspace'}");
  });
});
