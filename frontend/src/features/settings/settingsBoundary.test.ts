import { describe, expect, it } from 'vitest';

import type { CurrentUser } from '../../auth';
import {
  ADMIN_SETTINGS_SECTION_KEYS,
  USER_SETTINGS_SECTION_KEYS,
  buildAdminSettingsPanelModel,
  buildRuntimeSettingsPatch,
  buildSettingsScreenState,
  countAdminExposureByKind,
  getAdminExposureSections,
  getAvailableSettingsLanes,
  getRuntimeToggleCopy,
  resolveDefaultSettingsLane,
} from './settingsSections';

const adminUser: CurrentUser = {
  id: '1',
  username: 'admin',
  fullName: 'Admin User',
  email: 'admin@example.com',
  systemRole: 'admin',
  roleCodes: ['admin', 'director'],
  token: 'token',
  runtimeSettings: {
    hide_phase_one_maintenance_modules: true,
  },
};

const adminWithoutRuntimeFlag: CurrentUser = {
  ...adminUser,
  runtimeSettings: {},
};

const viewerUser: CurrentUser = {
  id: '2',
  username: 'viewer',
  fullName: 'Viewer User',
  email: 'viewer@example.com',
  systemRole: 'viewer',
  roleCodes: ['viewer'],
  token: 'token',
};

describe('settingsSections', () => {
  describe('lane state', () => {
    it('defaults admins to the admin lane', () => {
      expect(resolveDefaultSettingsLane({ isBaseAdmin: true })).toBe('admin');
    });

    it('defaults non-admins to the user lane', () => {
      expect(resolveDefaultSettingsLane({ isBaseAdmin: false })).toBe('user');
    });

    it('returns both lanes for admins', () => {
      expect(getAvailableSettingsLanes({ isBaseAdmin: true })).toEqual([
        { key: 'admin' },
        { key: 'user' },
      ]);
    });

    it('returns only the user lane for non-admins', () => {
      expect(getAvailableSettingsLanes({ isBaseAdmin: false })).toEqual([{ key: 'user' }]);
    });

    it('uses admin sections when the admin lane is active', () => {
      expect(buildSettingsScreenState({ isBaseAdmin: true, activeLane: 'admin' })).toEqual({
        activeLane: 'admin',
        availableLanes: [{ key: 'admin' }, { key: 'user' }],
        sections: ADMIN_SETTINGS_SECTION_KEYS.map((key) => ({ key })),
      });
    });

    it('falls back to the allowed lane when the requested lane is unavailable', () => {
      expect(buildSettingsScreenState({ isBaseAdmin: false, activeLane: 'admin' })).toEqual({
        activeLane: 'user',
        availableLanes: [{ key: 'user' }],
        sections: USER_SETTINGS_SECTION_KEYS.map((key) => ({ key })),
      });
    });
  });

  describe('admin panel model', () => {
    it('builds summary, exposure, runtime flag, and policy data from shared contracts', () => {
      const model = buildAdminSettingsPanelModel(adminUser);

      expect(model.summaryMetrics).toEqual([
        {
          label: 'Allowed modules',
          value: String(model.moduleExposure.length),
          description: 'Modules currently reachable through the active shell guard.',
        },
        {
          label: 'Action permissions',
          value: '8',
          description: 'Admin contract actions available to real system administrators.',
        },
        {
          label: 'Business approver roles',
          value: 'Director',
          description: 'Admin access does not add finance, legal, or executive approval lanes by itself.',
        },
      ]);

      expect(model.hideMaintenanceModules).toBe(true);
      expect(model.moduleExposure).toHaveLength(23);
      expect(model.moduleExposure).toContainEqual({ module: 'Home', exposure: 'core' });
      expect(model.moduleExposure).toContainEqual({ module: 'Partners', exposure: 'maintenance' });
      expect(model.moduleExposure).toContainEqual({ module: 'Users', exposure: 'admin' });
      expect(model.moduleExposure).toContainEqual({ module: 'Settings', exposure: 'core' });
      expect(model.policyItems).toEqual([
        {
          label: 'Shell runtime flag',
          value: 'Maintenance modules hidden',
          description: 'Affects 9 maintenance-only navigation entries without changing the current lane.',
        },
        {
          label: 'Permission contract',
          value: 'manage_users, manage_settings, view_all_projects, edit_project_shell, edit_commercial, edit_execution, edit_procurement, review_documents',
          description: 'Uses the shared role contract instead of local Settings-only assumptions.',
        },
        {
          label: 'Policy boundary',
          value: 'Real account access only',
          description: 'Users, Settings, and business approvals stay separated so admin checks do not mimic removed preview flows.',
        },
      ]);
    });

    it('treats the runtime flag as visible when the setting is absent', () => {
      const model = buildAdminSettingsPanelModel(adminWithoutRuntimeFlag);

      expect(model.hideMaintenanceModules).toBe(false);
      expect(model.policyItems[0]).toEqual({
        label: 'Shell runtime flag',
        value: 'Maintenance modules visible',
        description: 'Affects 9 maintenance-only navigation entries without changing the current lane.',
      });
    });

    it('reports no business approver roles for non-admin profiles without extra roles', () => {
      const model = buildAdminSettingsPanelModel({
        ...viewerUser,
        systemRole: 'admin',
        roleCodes: ['admin'],
      });

      expect(model.summaryMetrics[2]).toEqual({
        label: 'Business approver roles',
        value: 'None assigned',
        description: 'Admin access does not add finance, legal, or executive approval lanes by itself.',
      });
    });
  });

  describe('admin exposure helpers', () => {
    it('counts exposure buckets', () => {
      const model = buildAdminSettingsPanelModel(adminUser);

      expect(countAdminExposureByKind(model.moduleExposure)).toEqual({
        core: 13,
        maintenance: 9,
        admin: 1,
      });
    });

    it('groups modules into stable exposure sections', () => {
      const model = buildAdminSettingsPanelModel(adminUser);

      expect(getAdminExposureSections(model.moduleExposure)).toEqual([
        {
          key: 'core',
          title: 'Core modules',
          items: [
            { module: 'Home', exposure: 'core' },
            { module: 'My Work', exposure: 'core' },
            { module: 'Inbox', exposure: 'core' },
            { module: 'Approvals', exposure: 'core' },
            { module: 'Projects', exposure: 'core' },
            { module: 'Tasks', exposure: 'core' },
            { module: 'ERP Orders', exposure: 'core' },
            { module: 'Leads', exposure: 'core' },
            { module: 'Accounts', exposure: 'core' },
            { module: 'Contacts', exposure: 'core' },
            { module: 'Equipment', exposure: 'core' },
            { module: 'Sales', exposure: 'core' },
            { module: 'Settings', exposure: 'core' },
          ],
        },
        {
          key: 'maintenance',
          title: 'Maintenance-only modules',
          items: [
            { module: 'Reports', exposure: 'maintenance' },
            { module: 'Suppliers', exposure: 'maintenance' },
            { module: 'Partners', exposure: 'maintenance' },
            { module: 'Ops Overview', exposure: 'maintenance' },
            { module: 'Gantt', exposure: 'maintenance' },
            { module: 'Ops Staff', exposure: 'maintenance' },
            { module: 'Ops Chat', exposure: 'maintenance' },
            { module: 'EventLog', exposure: 'maintenance' },
            { module: 'Support', exposure: 'maintenance' },
          ],
        },
        {
          key: 'admin',
          title: 'Admin modules',
          items: [{ module: 'Users', exposure: 'admin' }],
        },
      ]);
    });
  });

  describe('runtime helpers', () => {
    it('builds the shell runtime patch from the next toggle value', () => {
      expect(buildRuntimeSettingsPatch(false)).toEqual({
        hide_phase_one_maintenance_modules: false,
      });
    });

    it('returns copy for the hidden maintenance state', () => {
      expect(getRuntimeToggleCopy(true)).toEqual({
        title: 'Maintenance modules hidden from shell',
        description: 'Phase 1 maintenance entries stay out of navigation until operators explicitly need them.',
        actionLabel: 'Show maintenance modules',
      });
    });

    it('returns copy for the visible maintenance state', () => {
      expect(getRuntimeToggleCopy(false)).toEqual({
        title: 'Maintenance modules visible in shell',
        description: 'Maintenance-only navigation remains available for operational access and regression checks.',
        actionLabel: 'Hide maintenance modules',
      });
    });
  });
});
