import { describe, expect, it } from 'vitest';

import * as layoutModule from './layoutNavigation';
import type { AppModule } from './shared/domain/contracts';

describe('layout navigation', () => {
  it('publishes a single grouped shell taxonomy for sidebar and drawer reuse', () => {
    expect(typeof layoutModule.getShellNavigationGroups).toBe('function');

    const allowedModules: AppModule[] = [
      'Home',
      'My Work',
      'Inbox',
      'Approvals',
      'Projects',
      'Tasks',
      'ERP Orders',
      'Ops Overview',
      'Gantt',
      'Ops Staff',
      'Ops Chat',
      'Reports',
      'Sales',
      'Leads',
      'Accounts',
      'Contacts',
      'Equipment',
      'Users',
      'EventLog',
      'Settings',
      'Support',
    ];
    const groups = layoutModule.getShellNavigationGroups(allowedModules);

    expect(groups.map((group) => group.label)).toEqual(['Workspace', 'Master data', 'Admin']);
    expect(groups[0]?.groups[0]?.showSectionLabel).toBe(false);
    expect(groups[0]?.groups[1]?.section).toBe('OPERATIONS');
    expect(groups[1]?.groups[0]?.items.map((item) => item.label)).toEqual(['Sales', 'Leads', 'Accounts', 'Contacts']);
    expect(groups[1]?.groups[1]?.items.map((item) => item.label)).toEqual(['Equipment']);
    expect(groups[2]?.groups.at(-1)?.items.map((item) => item.label)).toContain('Support');
  });
});
