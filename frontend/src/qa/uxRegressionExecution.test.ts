import { describe, expect, it } from 'vitest';

// @ts-ignore Test-only JS helper without TypeScript declarations.
import { UX_REGRESSION_MANIFEST, UX_SMOKE_ROUTES } from '../../scripts/qa/ux-regression.manifest.mjs';
// @ts-ignore Test-only JS helper without TypeScript declarations.
import { UX_AUDIT_EXECUTION_METADATA, CODEX_RUNBOOK_SECTIONS } from '../../scripts/qa/ux-regression.execution.mjs';

describe('ux regression execution metadata', () => {
  it('adds notes and execution metadata for every journey', () => {
    for (const journey of UX_REGRESSION_MANIFEST) {
      expect(journey.notes, `Missing notes for ${journey.id}`).toBeTruthy();
      expect(UX_AUDIT_EXECUTION_METADATA[journey.id], `Missing execution metadata for ${journey.id}`).toBeTruthy();
      expect(UX_AUDIT_EXECUTION_METADATA[journey.id]?.steps.length, `Missing steps for ${journey.id}`).toBeGreaterThan(0);
    }
  });

  it('keeps execution metadata ids aligned with manifest ids', () => {
    const manifestIds = new Set(UX_REGRESSION_MANIFEST.map((journey: any) => journey.id));
    const metadataIds = new Set(Object.keys(UX_AUDIT_EXECUTION_METADATA));
    expect(metadataIds).toEqual(manifestIds);
  });

  it('covers all core journeys and smoke routes in codex runbook sections', () => {
    expect(CODEX_RUNBOOK_SECTIONS.journeys).toHaveLength(UX_REGRESSION_MANIFEST.length);
    expect(CODEX_RUNBOOK_SECTIONS.smokeRoutes).toEqual(UX_SMOKE_ROUTES);
  });
});
