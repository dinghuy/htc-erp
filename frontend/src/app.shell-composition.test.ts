import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('app shell composition', () => {
  it('routes Leads through the feature adapter instead of mounting the legacy screen directly', () => {
    const appPath = path.resolve(__dirname, 'app.tsx');
    const source = readFileSync(appPath, 'utf8');

    expect(source).toContain("import { LeadsRoute } from './features/leads';");
    expect(source).toContain("{resolvedRoute === 'Leads' && <LeadsRoute isMobile={isMobile} currentUser={currentUser} />}");
    expect(source).not.toContain("import { Leads } from './Leads';");
  });

  it('routes Approvals through the feature adapter instead of mounting the legacy screen directly', () => {
    const appPath = path.resolve(__dirname, 'app.tsx');
    const source = readFileSync(appPath, 'utf8');

    expect(source).toContain("import { ApprovalsRoute } from './features/approvals';");
    expect(source).toContain("{resolvedRoute === 'Approvals' && <ApprovalsRoute currentUser={currentUser} onNavigate={handleNavigate} />}");
    expect(source).not.toContain("import { Approvals } from './Approvals';");
  });

  it('routes Equipment through the feature adapter instead of mounting the legacy Products screen directly', () => {
    const appPath = path.resolve(__dirname, 'app.tsx');
    const source = readFileSync(appPath, 'utf8');

    expect(source).toContain("import { EquipmentRoute, ProjectsRoute } from './features/projects';");
    expect(source).toContain("{resolvedRoute === 'Equipment' && <EquipmentRoute isMobile={isMobile} currentUser={currentUser} />}");
    expect(source).not.toContain("import { Products } from './Products';");
  });

  it('removes the deprecated role preview banner from the shared shell', () => {
    const layoutPath = path.resolve(__dirname, 'Layout.tsx');
    const source = readFileSync(layoutPath, 'utf8');

    expect(source).not.toContain('const canManageRolePreview = Boolean(');
    expect(source).not.toContain('Role preview controls:');
    expect(source).not.toContain('previewBanner');
  });

  it('renders an explicit maintenance badge for non-core Phase 1 navigation entries', () => {
    const layoutPath = path.resolve(__dirname, 'Layout.tsx');
    const source = readFileSync(layoutPath, 'utf8');

    expect(source).toContain("const showMaintenanceBadge = item.phaseOneExposure === 'maintenance';");
    expect(source).toContain("t('nav.badge.maintenance_only')");
    expect(source).toContain("'MAINTENANCE ONLY': 'nav.section.maintenance_only'");
  });

  it('keeps settings access tied to real allowed modules and threads settings shell handlers through the route adapter', () => {
    const appPath = path.resolve(__dirname, 'app.tsx');
    const source = readFileSync(appPath, 'utf8');

    expect(source).toContain('const routeGuardModules = roleProfile.allowedModules;');
    expect(source).not.toContain('previewAdminRoutes');
    expect(source).toContain('onUserUpdated={handleSettingsRouteUserUpdated}');
    expect(source).toContain('onSystemSettingsUpdated={handleSettingsShellFlagUpdated}');
    expect(source).not.toContain('onOpenUsers={handleSettingsOpenUsers}');
    expect(source).not.toContain('previewRoleCodes');
    expect(source).not.toContain('isRolePreviewActive');
  });
});
