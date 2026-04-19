import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('SettingsRoute', () => {
  it('mounts the feature SettingsScreen through FeatureRouteShell with the current shell props', () => {
    const source = readFileSync(path.resolve(__dirname, 'SettingsRoute.tsx'), 'utf8');

    expect(source).toContain("import { FeatureRouteShell } from '../shared/FeatureRouteShell';");
    expect(source).toContain('<FeatureRouteShell fallbackMessage="Đang tải cài đặt...">');
    expect(source).toContain('<SettingsScreen');
    expect(source).toContain('isDarkMode={isDarkMode}');
    expect(source).toContain('toggleDarkMode={toggleDarkMode}');
    expect(source).toContain('isMobile={isMobile}');
    expect(source).toContain('currentUser={currentUser}');
    expect(source).toContain('onUserUpdated={onUserUpdated}');
    expect(source).toContain('onSystemSettingsUpdated={onSystemSettingsUpdated}');
    expect(source).not.toContain('onRolePreviewChange');
    expect(source).not.toContain('onOpenUsers');
  });
});
