import { describe, expect, it } from 'vitest';

import { buildWorkspaceActionAccess } from './workspacePermissions';

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

  it('keeps project manager commercial editing read-only while allowing execution controls', () => {
    const pmAccess = buildWorkspaceActionAccess(['project_manager']);
    expect(pmAccess).toMatchObject({
      canEditCommercial: false,
      canEditTimeline: true,
      canEditProcurement: false,
      canEditDelivery: false,
    });
  });
});
