import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const myWorkSource = readFileSync(
  resolve(process.cwd(), 'src/MyWork.tsx'),
  'utf8',
);

describe('my work workflow contract', () => {
  it('delegates project workspace navigation to the shared my-work helper', () => {
    expect(myWorkSource).toContain('const target = buildMyWorkProjectWorkspaceNavigation(projectId, workspaceTab);');
    expect(myWorkSource).toContain('setNavContext(target.navContext);');
    expect(myWorkSource).toContain('onNavigate?.(target.route);');
  });

  it('delegates approval queue navigation to the shared my-work approval helper', () => {
    expect(myWorkSource).toContain('const target = buildMyWorkApprovalQueueNavigation(approval.actionAvailability?.lane);');
    expect(myWorkSource).toContain("{approval.actionAvailability?.canDecide ? 'Mở lane để quyết định' : 'Mở approval queue'}");
  });

  it('still renders backend workflow metadata on task and approval rows', () => {
    expect(myWorkSource).toContain('task.actionAvailability?.workspaceTab ? <span style={ui.badge.warning}>Tab {task.actionAvailability.workspaceTab}</span> : null');
    expect(myWorkSource).toContain('approval.actionAvailability?.lane ? <span style={ui.badge.neutral}>Lane {approval.actionAvailability.lane}</span> : null');
  });
});
