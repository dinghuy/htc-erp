import { describe, expect, it } from 'vitest';

import {
  ADMIN_SETTINGS_SECTION_KEYS,
  USER_SETTINGS_SECTION_KEYS,
  buildSettingsScreenState,
  getAvailableSettingsLanes,
  resolveDefaultSettingsLane,
} from './settingsSections';

describe('settings boundary helpers', () => {
  it('uses the approved default surface and section taxonomy', () => {
    expect(resolveDefaultSettingsLane({ isBaseAdmin: true })).toBe('admin');
    expect(resolveDefaultSettingsLane({ isBaseAdmin: false })).toBe('user');

    expect(USER_SETTINGS_SECTION_KEYS).toEqual([
      'personal-preferences',
      'personal-account',
    ]);
    expect(ADMIN_SETTINGS_SECTION_KEYS).toEqual([
      'operational-summary',
      'module-exposure',
      'runtime-controls',
      'pricing-finance-policy',
    ]);
  });

  it('returns one settings route with a role-scoped lane surface', () => {
    expect(getAvailableSettingsLanes({ isBaseAdmin: false }).map((lane) => lane.key)).toEqual([
      'user',
    ]);
    expect(getAvailableSettingsLanes({ isBaseAdmin: true }).map((lane) => lane.key)).toEqual([
      'admin',
      'user',
    ]);

    expect(
      buildSettingsScreenState({
        isBaseAdmin: false,
        activeLane: 'admin',
      }),
    ).toMatchObject({
      activeLane: 'user',
      availableLanes: [{ key: 'user' }],
      sections: [{ key: 'personal-preferences' }, { key: 'personal-account' }],
    });

    expect(
      buildSettingsScreenState({
        isBaseAdmin: true,
        activeLane: 'user',
      }),
    ).toMatchObject({
      activeLane: 'user',
      availableLanes: [{ key: 'admin' }, { key: 'user' }],
      sections: [{ key: 'personal-preferences' }, { key: 'personal-account' }],
    });

    expect(
      buildSettingsScreenState({
        isBaseAdmin: true,
        activeLane: 'admin',
      }),
    ).toMatchObject({
      activeLane: 'admin',
      sections: [
        { key: 'operational-summary' },
        { key: 'module-exposure' },
        { key: 'runtime-controls' },
        { key: 'pricing-finance-policy' },
      ],
    });
  });
});
