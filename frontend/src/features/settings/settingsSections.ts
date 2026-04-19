import { APP_MODULE_PHASE_ONE_EXPOSURE, ROLE_ACTION_PERMISSIONS, ROLE_LABELS, buildRoleProfile, type AppModule } from '../../shared/domain/contracts';
import type { CurrentUser } from '../../auth';

export const USER_SETTINGS_SECTION_KEYS = [
  'personal-preferences',
  'personal-account',
] as const;

export const ADMIN_SETTINGS_SECTION_KEYS = [
  'operational-summary',
  'module-exposure',
  'runtime-controls',
  'pricing-finance-policy',
] as const;

export type SettingsLaneKey = 'admin' | 'user';
export type SettingsSectionKey =
  | (typeof USER_SETTINGS_SECTION_KEYS)[number]
  | (typeof ADMIN_SETTINGS_SECTION_KEYS)[number];

export type SettingsSection = {
  key: SettingsSectionKey;
};

export type SettingsLane = {
  key: SettingsLaneKey;
};

export type SettingsScreenState = {
  activeLane: SettingsLaneKey;
  availableLanes: SettingsLane[];
  sections: SettingsSection[];
};

export type AdminSummaryMetric = {
  label: string;
  value: string;
  description: string;
};

export type AdminModuleExposureItem = {
  module: AppModule;
  exposure: 'core' | 'maintenance' | 'admin';
};

export type AdminPolicyItem = {
  label: string;
  value: string;
  description: string;
};

export type AdminSettingsPanelModel = {
  summaryMetrics: AdminSummaryMetric[];
  moduleExposure: AdminModuleExposureItem[];
  hideMaintenanceModules: boolean;
  policyItems: AdminPolicyItem[];
};

const USER_SETTINGS_LANE: SettingsLane = { key: 'user' };
const ADMIN_SETTINGS_LANE: SettingsLane = { key: 'admin' };

export function resolveDefaultSettingsLane({
  isBaseAdmin,
}: {
  isBaseAdmin: boolean;
}): SettingsLaneKey {
  return isBaseAdmin ? 'admin' : 'user';
}

export function getAvailableSettingsLanes({
  isBaseAdmin,
}: {
  isBaseAdmin: boolean;
}): SettingsLane[] {
  return isBaseAdmin ? [ADMIN_SETTINGS_LANE, USER_SETTINGS_LANE] : [USER_SETTINGS_LANE];
}

export function buildSettingsScreenState({
  isBaseAdmin,
  activeLane,
}: {
  isBaseAdmin: boolean;
  activeLane: SettingsLaneKey;
}): SettingsScreenState {
  const availableLanes = getAvailableSettingsLanes({ isBaseAdmin });
  const nextActiveLane = availableLanes.some((lane) => lane.key === activeLane)
    ? activeLane
    : resolveDefaultSettingsLane({ isBaseAdmin });

  return {
    activeLane: nextActiveLane,
    availableLanes,
    sections:
      nextActiveLane === 'admin'
        ? ADMIN_SETTINGS_SECTION_KEYS.map((key) => ({ key }))
        : USER_SETTINGS_SECTION_KEYS.map((key) => ({ key })),
  };
}

export function buildAdminSettingsPanelModel(currentUser: CurrentUser): AdminSettingsPanelModel {
  const roleProfile = buildRoleProfile(currentUser.roleCodes, currentUser.systemRole);
  const allowedModules = roleProfile.allowedModules;
  const hiddenMaintenanceModules = Boolean(
    currentUser.runtimeSettings?.hide_phase_one_maintenance_modules,
  );
  const maintenanceModules = allowedModules.filter(
    (moduleName) => APP_MODULE_PHASE_ONE_EXPOSURE[moduleName] === 'maintenance',
  );

  return {
    summaryMetrics: [
      {
        label: 'Allowed modules',
        value: String(allowedModules.length),
        description: 'Modules currently reachable through the active shell guard.',
      },
      {
        label: 'Action permissions',
        value: String(ROLE_ACTION_PERMISSIONS.admin.length),
        description: 'Admin contract actions available to real system administrators.',
      },
      {
        label: 'Business approver roles',
        value: roleProfile.roleCodes.filter((roleCode) => roleCode !== 'admin').length > 0
          ? roleProfile.roleCodes
              .filter((roleCode) => roleCode !== 'admin')
              .map((roleCode) => ROLE_LABELS[roleCode])
              .join(', ')
          : 'None assigned',
        description: 'Admin access does not add finance, legal, or executive approval lanes by itself.',
      },
    ],
    moduleExposure: allowedModules.map((moduleName) => ({
      module: moduleName,
      exposure: APP_MODULE_PHASE_ONE_EXPOSURE[moduleName],
    })),
    hideMaintenanceModules: hiddenMaintenanceModules,
    policyItems: [
      {
        label: 'Shell runtime flag',
        value: hiddenMaintenanceModules ? 'Maintenance modules hidden' : 'Maintenance modules visible',
        description: maintenanceModules.length > 0
          ? `Affects ${maintenanceModules.length} maintenance-only navigation entries without changing the current lane.`
          : 'No maintenance-only modules are currently exposed for this admin account.',
      },
      {
        label: 'Permission contract',
        value: ROLE_ACTION_PERMISSIONS.admin.join(', '),
        description: 'Uses the shared role contract instead of local Settings-only assumptions.',
      },
      {
        label: 'Policy boundary',
        value: 'Real account access only',
        description: 'Users, Settings, and business approvals stay separated so admin checks do not mimic removed preview flows.',
      },
    ],
  };
}

export function countAdminExposureByKind(moduleExposure: AdminModuleExposureItem[]) {
  return moduleExposure.reduce(
    (acc, item) => {
      acc[item.exposure] += 1;
      return acc;
    },
    {
      core: 0,
      maintenance: 0,
      admin: 0,
    } as Record<AdminModuleExposureItem['exposure'], number>,
  );
}

export function getAdminExposureSections(moduleExposure: AdminModuleExposureItem[]) {
  const grouped = {
    core: moduleExposure.filter((item) => item.exposure === 'core'),
    maintenance: moduleExposure.filter((item) => item.exposure === 'maintenance'),
    admin: moduleExposure.filter((item) => item.exposure === 'admin'),
  };

  return [
    {
      key: 'core' as const,
      title: 'Core modules',
      items: grouped.core,
    },
    {
      key: 'maintenance' as const,
      title: 'Maintenance-only modules',
      items: grouped.maintenance,
    },
    {
      key: 'admin' as const,
      title: 'Admin modules',
      items: grouped.admin,
    },
  ];
}

export function buildRuntimeSettingsPatch(hideMaintenanceModules: boolean) {
  return {
    hide_phase_one_maintenance_modules: hideMaintenanceModules,
  };
}

export function getRuntimeToggleCopy(hideMaintenanceModules: boolean) {
  return hideMaintenanceModules
    ? {
        title: 'Maintenance modules hidden from shell',
        description: 'Phase 1 maintenance entries stay out of navigation until operators explicitly need them.',
        actionLabel: 'Show maintenance modules',
      }
    : {
        title: 'Maintenance modules visible in shell',
        description: 'Maintenance-only navigation remains available for operational access and regression checks.',
        actionLabel: 'Hide maintenance modules',
      };
}

export function getAdminSectionDescription(sectionKey: (typeof ADMIN_SETTINGS_SECTION_KEYS)[number]) {
  switch (sectionKey) {
    case 'operational-summary':
      return 'Operational summary for the current admin account and live shell contract.';
    case 'module-exposure':
      return 'Current route exposure grouped by core, maintenance-only, and admin surfaces.';
    case 'runtime-controls':
      return 'Narrow shell flags that update runtime settings without resetting the active lane.';
    case 'pricing-finance-policy':
      return 'Policy and permission reminders tied to shared contracts, not local preview state.';
  }
}
