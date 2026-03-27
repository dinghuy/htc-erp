import { describe, expect, it } from 'vitest';

import {
  APPROVAL_GATE_TYPES,
  APPROVAL_STATUSES,
  DELIVERY_LINE_STATUSES,
  PROJECT_STAGES,
  QUOTATION_STATUSES,
  SALES_ORDER_STATUSES,
} from './contracts';
import {
  canCompleteDelivery,
  canCreateSalesOrderFromQuotation,
  canTransitionSalesOrderStatus,
  resolveApprovalOwners,
} from './revenueFlow';

describe('revenue flow contracts', () => {
  it('publishes canonical status families for the physical delivery flow', () => {
    expect(QUOTATION_STATUSES).toEqual([
      'draft',
      'submitted_for_approval',
      'revision_required',
      'approved',
      'rejected',
      'won',
      'lost',
    ]);
    expect(APPROVAL_STATUSES).toEqual([
      'pending',
      'approved',
      'rejected',
      'changes_requested',
      'cancelled',
    ]);
    expect(SALES_ORDER_STATUSES).toEqual(['draft', 'released', 'locked_for_execution', 'cancelled']);
    expect(DELIVERY_LINE_STATUSES).toEqual(['pending', 'scheduled', 'partially_delivered', 'delivered', 'blocked', 'closed']);
    expect(PROJECT_STAGES).toContain('delivery_completed');
    expect(APPROVAL_GATE_TYPES).toContain('delivery_release');
  });

  it('derives commercial and execution decisions from canonical statuses', () => {
    expect(canCreateSalesOrderFromQuotation('draft')).toBe(false);
    expect(canCreateSalesOrderFromQuotation('approved')).toBe(true);
    expect(canCreateSalesOrderFromQuotation('won')).toBe(true);

    expect(
      canTransitionSalesOrderStatus({ currentStatus: 'draft', nextStatus: 'released', quotationStatus: 'approved' }).ok,
    ).toBe(false);
    expect(
      canTransitionSalesOrderStatus({ currentStatus: 'draft', nextStatus: 'released', quotationStatus: 'won' }).ok,
    ).toBe(true);
  });

  it('only allows delivery completion after all lines are delivered or closed', () => {
    expect(canCompleteDelivery(['delivered', 'closed']).ok).toBe(true);
    expect(canCompleteDelivery(['partially_delivered', 'delivered']).ok).toBe(false);
  });

  it('resolves approval owners for milestone gates', () => {
    expect(resolveApprovalOwners('sales_order_release', {}).requiredApprovers).toEqual(['director']);
    expect(resolveApprovalOwners('delivery_completion', {}).requiredApprovers).toEqual(['sales', 'director']);
    expect(
      resolveApprovalOwners('quotation_commercial', { requireFinanceReview: true, requireLegalReview: true }).optionalApprovers,
    ).toEqual(['accounting', 'legal']);
  });
});
