import { describe, expect, it } from 'vitest';

import { buildWorkspaceActionAccess, buildWorkspacePreviewNotice } from './workspacePermissions';

describe('workspace action access', () => {
  it('grants commercial editing only to commercial roles', () => {
    expect(buildWorkspaceActionAccess(['sales'])).toMatchObject({
      canEditCommercial: true,
      canEditPricing: true,
      canEditProcurement: false,
      canEditDelivery: false,
      canEditTimeline: false,
    });

    expect(buildWorkspaceActionAccess(['project_manager'])).toMatchObject({
      canEditCommercial: false,
      canEditPricing: false,
      canEditProcurement: false,
      canEditDelivery: false,
      canEditTimeline: true,
    });
  });

  it('unifies sales and project manager capabilities without inventing a new data role', () => {
    expect(buildWorkspaceActionAccess(['sales', 'project_manager'])).toMatchObject({
      canEditCommercial: true,
      canEditPricing: true,
      canEditProcurement: false,
      canEditDelivery: false,
      canEditTimeline: true,
    });
  });

  it('keeps combined sales-pm powerful on handoff surfaces without leaking finance or legal authority', () => {
    const combined = buildWorkspaceActionAccess(['sales', 'project_manager']);
    expect(combined).toMatchObject({
      canEditCommercial: true,
      canEditPricing: true,
      canEditTimeline: true,
      canEditProcurement: false,
      canEditDelivery: false,
    });

    expect(buildWorkspacePreviewNotice('commercial', combined, true, 'Sales + PM')).toMatchObject({
      readOnly: false,
      tone: 'info',
    });

    expect(buildWorkspacePreviewNotice('finance', combined, true, 'Sales + PM')).toMatchObject({
      readOnly: true,
      tone: 'info',
    });
  });

  it('grants procurement editing to procurement roles and keeps viewers read-only', () => {
    expect(buildWorkspaceActionAccess(['procurement'])).toMatchObject({
      canEditCommercial: false,
      canEditPricing: false,
      canEditProcurement: true,
      canEditDelivery: true,
      canEditTimeline: false,
    });

    expect(buildWorkspaceActionAccess(['viewer'])).toMatchObject({
      canEditCommercial: false,
      canEditPricing: false,
      canEditProcurement: false,
      canEditDelivery: false,
      canEditTimeline: false,
    });
  });

  it('lets admin support all editor lanes while keeping approval behavior separate', () => {
    expect(buildWorkspaceActionAccess(['admin'])).toMatchObject({
      canEditCommercial: true,
      canEditPricing: true,
      canEditProcurement: true,
      canEditDelivery: true,
      canEditTimeline: true,
      canReviewDocuments: true,
    });
  });

  it('explains preview read-only boundaries per workspace tab', () => {
    const pmAccess = buildWorkspaceActionAccess(['project_manager']);
    expect(buildWorkspacePreviewNotice('commercial', pmAccess, true, 'Project Manager')).toMatchObject({
      readOnly: true,
      tone: 'warning',
    });
    expect(buildWorkspacePreviewNotice('commercial', pmAccess, true, 'Project Manager')?.message).toContain('read-only');

    expect(buildWorkspacePreviewNotice('timeline', pmAccess, true, 'Project Manager')).toMatchObject({
      readOnly: false,
      tone: 'info',
    });

    expect(buildWorkspacePreviewNotice('finance', pmAccess, true, 'Project Manager')).toMatchObject({
      readOnly: true,
      tone: 'info',
    });

    expect(buildWorkspacePreviewNotice('timeline', pmAccess, false, 'Project Manager')).toBeNull();
  });
});
