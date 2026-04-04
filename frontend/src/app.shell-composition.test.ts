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

  it('keeps the role preview banner available to base admin sessions even before a preview is active', () => {
    const layoutPath = path.resolve(__dirname, 'Layout.tsx');
    const source = readFileSync(layoutPath, 'utf8');

    expect(source).toContain('const canManageRolePreview = Boolean(');
    expect(source).toContain('{canManageRolePreview ? (');
    expect(source).toContain('Role preview controls:');
  });

  it('preserves direct Settings and Users routing for base admin preview sessions without reopening sidebar access', () => {
    const appPath = path.resolve(__dirname, 'app.tsx');
    const source = readFileSync(appPath, 'utf8');

    expect(source).toContain("const previewAdminRoutes: AppModule[] = currentUser.baseRoleCodes?.includes('admin')");
    expect(source).toContain("['Settings', 'Users']");
    expect(source).toContain('const routeGuardModules = Array.from(new Set([...allowedModules, ...previewAdminRoutes]));');
  });
});
