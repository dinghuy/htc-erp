import { describe, expect, it } from 'vitest';

import { buildProjectWorkspaceViewModel } from './projectWorkspaceViewModel';

describe('buildProjectWorkspaceViewModel', () => {
  it('filters procurement lines to the active baseline and derives shortages', () => {
    const viewModel = buildProjectWorkspaceViewModel({
      workspace: {
        executionBaselines: [{ id: 'baseline-1', isCurrent: true }],
        procurementLines: [
          { id: 'line-1', baselineId: 'baseline-1', isActive: 1, status: 'open', shortageQty: 2, orderedQty: 4, contractQty: 6, receivedQty: 1, deliveredQty: 0, etaDate: '2026-04-07', committedDeliveryDate: '2026-04-07', itemCode: 'A' },
          { id: 'line-2', baselineId: 'baseline-2', isActive: 1, status: 'open', shortageQty: 0, orderedQty: 1, contractQty: 1, receivedQty: 1, deliveredQty: 1 },
        ],
        milestones: [{ id: 'm-1', title: 'Pending', plannedDate: '2026-04-09', status: 'pending' }],
      },
      accounts: [{ id: 'supplier-1', accountType: 'supplier' }, { id: 'customer-1', accountType: 'customer' }],
    });

    expect(viewModel.activeProcurementLines).toHaveLength(1);
    expect(viewModel.activeProcurementLines[0]?.id).toBe('line-1');
    expect(viewModel.shortageLines).toHaveLength(1);
    expect(viewModel.supplierAccounts).toHaveLength(1);
    expect(viewModel.overviewAlerts.length).toBeGreaterThan(0);
  });

  it('includes the requested procurement line in editor options even when not active', () => {
    const viewModel = buildProjectWorkspaceViewModel({
      workspace: {
        executionBaselines: [{ id: 'baseline-1', isCurrent: true }],
        procurementLines: [
          { id: 'line-1', baselineId: 'baseline-1', isActive: 1, status: 'open' },
          { id: 'line-2', baselineId: 'baseline-2', isActive: 1, status: 'open' },
        ],
      },
      accounts: [],
      inboundEditorProcurementLineId: 'line-2',
      deliveryEditorProcurementLineId: 'line-2',
    });

    expect(viewModel.inboundEditorProcurementLines.map((line: any) => line.id)).toContain('line-2');
    expect(viewModel.deliveryEditorProcurementLines.map((line: any) => line.id)).toContain('line-2');
  });
});
