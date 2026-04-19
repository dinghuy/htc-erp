import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(path.resolve(__dirname, 'SettingsScreen.tsx'), 'utf8');

describe('SettingsScreen source contract', () => {
  it('keeps the core settings user lanes mounted', () => {
    expect(source).toContain('data-testid={QA_TEST_IDS.settings.displayCard}');
    expect(source).toContain('data-testid={QA_TEST_IDS.settings.profileCard}');
    expect(source).toContain('data-testid={QA_TEST_IDS.settings.securityCard}');
  });

  it('preserves profile save wiring through the session callback', () => {
    expect(source).toContain('const handleProfileSave = () => {');
    expect(source).toContain('onUserUpdated?.({');
    expect(source).toContain('fullName: nextFullName');
    expect(source).toContain('email: nextEmail');
    expect(source).toContain('language,');
    expect(source).toContain('data-testid={QA_TEST_IDS.settings.profileSave}');
  });

  it('keeps the existing display controls wired to the shell state', () => {
    expect(source).toContain('data-testid={QA_TEST_IDS.settings.languageSelect}');
    expect(source).toContain('data-testid={QA_TEST_IDS.settings.themeToggle}');
    expect(source).toContain('onClick={toggleDarkMode}');
  });

  it('keeps password submission guarded behind the current security form', () => {
    expect(source).toContain('const handlePasswordSubmit = async (event: Event) => {');
    expect(source).toContain("setPasswordError(t('settings.security.error.required'))");
    expect(source).toContain("setPasswordError(t('settings.security.error.min_length'))");
    expect(source).toContain("setPasswordError(t('settings.security.error.mismatch'))");
    expect(source).toContain("fetchWithAuth(currentUser.token, `${API_BASE}/auth/change-password`, {");
    expect(source).toContain("throw new Error(t('settings.security.error.failed'))");
    expect(source).toContain("setPasswordError(t('settings.security.error.failed'))");
    expect(source).toContain('data-testid={QA_TEST_IDS.settings.passwordSubmit}');
  });

  it('wires the admin runtime toggle through the shared shell callback', () => {
    expect(source).toContain('data-testid={QA_TEST_IDS.settings.adminRuntimeToggle}');
    expect(source).toContain('onSystemSettingsUpdated?.(');
    expect(source).toContain('buildRuntimeSettingsPatch(!adminPanelModel.hideMaintenanceModules)');
  });
});
