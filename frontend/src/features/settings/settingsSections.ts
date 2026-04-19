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
