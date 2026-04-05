import { describe, expect, it } from 'vitest';

import * as layoutModule from './layoutNavigation';
import {
  getAppModulePhaseOneExposure,
  isMaintenanceOnlyModule,
  type AppModule,
} from './shared/domain/contracts';

describe('layout navigation', () => {
  it('marks non-core Phase 1 modules as maintenance-only in the shared exposure map', () => {
    expect(getAppModulePhaseOneExposure('Reports')).toBe('maintenance');
    expect(getAppModulePhaseOneExposure('Ops Chat')).toBe('maintenance');
    expect(getAppModulePhaseOneExposure('Users')).toBe('admin');
    expect(getAppModulePhaseOneExposure('Sales')).toBe('core');
    expect(isMaintenanceOnlyModule('Support')).toBe(true);
    expect(isMaintenanceOnlyModule('Projects')).toBe(false);
  });

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
      'Suppliers',
      'Partners',
      'Users',
      'EventLog',
      'Settings',
      'Support',
    ];
    const groups = layoutModule.getShellNavigationGroups(allowedModules);

    expect(groups.map((group) => group.label)).toEqual(['Workspace', 'Master data', 'Admin']);
    expect(groups[0]?.groups[0]?.showSectionLabel).toBe(false);
    expect(groups[0]?.groups[1]?.section).toBe('MAINTENANCE ONLY');
    expect(groups[0]?.groups[1]?.items.map((item) => item.label)).toEqual(['Ops Overview', 'Gantt', 'Ops Staff', 'Ops Chat', 'Reports']);
    expect(groups[0]?.groups[1]?.items.every((item) => item.phaseOneExposure === 'maintenance')).toBe(true);
    expect(groups[1]?.groups[0]?.items.map((item) => item.label)).toEqual(['Sales', 'Leads', 'Accounts', 'Contacts', 'Equipment']);
    expect(groups[1]?.groups[1]?.items.map((item) => item.label)).toEqual(['Suppliers', 'Partners']);
    expect(groups[2]?.groups.at(-1)?.items.map((item) => item.label)).toEqual(['EventLog', 'Support']);
  });
});
