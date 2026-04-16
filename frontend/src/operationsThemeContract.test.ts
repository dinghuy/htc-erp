import { describe, it } from 'vitest';
import { expectFilesToAvoidLiterals } from './qa/themeAuditContracts';

describe('operations theme contracts', () => {
  it('keeps operations surfaces on semantic tokens instead of light-only literals', () => {
    expectFilesToAvoidLiterals([
      'ops/OperationsOverview.tsx',
      'ops/ChatPanel.tsx',
      'ops/GanttView.tsx',
      'ops/StaffPerformance.tsx',
      'SalesOrders.tsx',
    ]);
  });
});
