import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('SettingsScreen source contract', () => {
  it('wires the admin runtime toggle through the shared shell callback', () => {
    const source = readFileSync(path.resolve(__dirname, 'SettingsScreen.tsx'), 'utf8');

    expect(source).toContain('data-testid={QA_TEST_IDS.settings.adminRuntimeToggle}');
    expect(source).toContain('onSystemSettingsUpdated?.(');
    expect(source).toContain('buildRuntimeSettingsPatch(!adminPanelModel.hideMaintenanceModules)');
  });
});
