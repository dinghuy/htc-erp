require('ts-node/register');

const assert = require('node:assert/strict');

const {
  QUOTATION_STATUSES,
  APPROVAL_STATUSES,
  PROJECT_STAGES,
  SALES_ORDER_STATUSES,
  PROCUREMENT_LINE_STATUSES,
  INBOUND_LINE_STATUSES,
  DELIVERY_LINE_STATUSES,
  APPROVAL_GATE_TYPES,
} = require('../src/shared/contracts/domain.ts');
const {
  canCreateSalesOrderFromQuotation,
  canTransitionSalesOrderStatus,
  canStartLogisticsExecution,
  canCompleteDelivery,
  resolveApprovalOwners,
  resolveHandoffActivation,
} = require('../src/shared/workflow/revenueFlow.ts');
const { canUserApproveRequest } = require('../src/shared/auth/permissions.ts');

let failures = 0;

async function run(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}

async function main() {
  await run('publishes end-to-end revenue status enums', async () => {
    assert.deepEqual(QUOTATION_STATUSES, [
      'draft',
      'submitted_for_approval',
      'revision_required',
      'approved',
      'rejected',
      'won',
      'lost',
    ]);
    assert.deepEqual(APPROVAL_STATUSES, [
      'pending',
      'approved',
      'rejected',
      'changes_requested',
      'cancelled',
    ]);
    assert.deepEqual(SALES_ORDER_STATUSES, ['draft', 'released', 'locked_for_execution', 'cancelled']);
    assert.deepEqual(PROCUREMENT_LINE_STATUSES, ['planned', 'ordered', 'partially_received', 'received', 'cancelled']);
    assert.deepEqual(INBOUND_LINE_STATUSES, ['pending', 'received', 'closed']);
    assert.deepEqual(DELIVERY_LINE_STATUSES, ['pending', 'scheduled', 'partially_delivered', 'delivered', 'blocked', 'closed']);
    assert.equal(PROJECT_STAGES.includes('commercial_approved'), true);
    assert.equal(PROJECT_STAGES.includes('delivery_completed'), true);
    assert.deepEqual(APPROVAL_GATE_TYPES, [
      'quotation_commercial',
      'sales_order_release',
      'procurement_commitment',
      'delivery_release',
      'delivery_completion',
    ]);
  });

  await run('sales order creation only opens after approved or won quotation', async () => {
    assert.equal(canCreateSalesOrderFromQuotation('draft'), false);
    assert.equal(canCreateSalesOrderFromQuotation('submitted_for_approval'), false);
    assert.equal(canCreateSalesOrderFromQuotation('approved'), true);
    assert.equal(canCreateSalesOrderFromQuotation('won'), true);
    assert.equal(canCreateSalesOrderFromQuotation('accepted'), true);
  });

  await run('sales order release is blocked until quotation is won', async () => {
    assert.equal(canTransitionSalesOrderStatus({ currentStatus: 'draft', nextStatus: 'released', quotationStatus: 'approved' }).ok, false);
    assert.equal(canTransitionSalesOrderStatus({ currentStatus: 'draft', nextStatus: 'released', quotationStatus: 'won' }).ok, true);
    assert.equal(canTransitionSalesOrderStatus({ currentStatus: 'released', nextStatus: 'locked_for_execution', quotationStatus: 'won' }).ok, true);
    assert.equal(canTransitionSalesOrderStatus({ currentStatus: 'draft', nextStatus: 'locked_for_execution', quotationStatus: 'won' }).ok, false);
  });

  await run('logistics and delivery require a released order', async () => {
    assert.equal(canStartLogisticsExecution('draft'), false);
    assert.equal(canStartLogisticsExecution('cancelled'), false);
    assert.equal(canStartLogisticsExecution('released'), true);
    assert.equal(canStartLogisticsExecution('locked_for_execution'), true);
  });

  await run('delivery completion requires all lines delivered or closed', async () => {
    assert.equal(canCompleteDelivery([]).ok, false);
    assert.equal(canCompleteDelivery(['scheduled', 'delivered']).ok, false);
    assert.equal(canCompleteDelivery(['delivered', 'closed']).ok, true);
  });

  await run('approval owners follow gate-specific defaults and conditional reviewers', async () => {
    assert.deepEqual(resolveApprovalOwners('quotation_commercial', {}).requiredApprovers, ['director']);
    assert.deepEqual(resolveApprovalOwners('quotation_commercial', { requireLegalReview: true, requireFinanceReview: true }).optionalApprovers, ['accounting', 'legal']);
    assert.deepEqual(resolveApprovalOwners('delivery_completion', {}).requiredApprovers, ['sales', 'director']);
    assert.deepEqual(resolveApprovalOwners('procurement_commitment', { requireFinanceReview: true }).optionalApprovers, ['accounting']);
  });

  await run('handoff activation resolves canonical states across the won-quote boundary', async () => {
    assert.equal(
      resolveHandoffActivation({
        quotationId: 'q-1',
        quotationStatus: 'won',
        salesOrderId: null,
        canCreateSalesOrder: true,
      }).status,
      'ready_to_create_sales_order',
    );

    assert.equal(
      resolveHandoffActivation({
        quotationId: 'q-1',
        quotationStatus: 'won',
        salesOrderId: 'so-1',
        salesOrderStatus: 'draft',
        releaseGateStatus: 'pending',
        canRequestReleaseApproval: false,
        salesOrderBlockers: ['Sales order release gate must be approved before releasing the order.'],
      }).status,
      'awaiting_release_approval',
    );

    const readyToRelease = resolveHandoffActivation({
      quotationId: 'q-1',
      quotationStatus: 'won',
      salesOrderId: 'so-1',
      salesOrderStatus: 'draft',
      releaseGateStatus: 'approved',
      canReleaseSalesOrder: true,
    });
    assert.equal(readyToRelease.status, 'ready_to_release');
    assert.equal(readyToRelease.nextActionKey, 'release_sales_order');

    const activated = resolveHandoffActivation({
      quotationId: 'q-1',
      quotationStatus: 'won',
      salesOrderId: 'so-1',
      salesOrderStatus: 'released',
    });
    assert.equal(activated.status, 'activated');
    assert.equal(activated.isActivated, true);
  });

  await run('requester cannot self-approve and changes_requested remains actionable', async () => {
    const approval = {
      requestType: 'delivery_release',
      approverRole: 'director',
      status: 'pending',
      requestedBy: 'qa-user-director',
    };
    assert.equal(
      canUserApproveRequest({ id: 'qa-user-director', systemRole: 'director', roleCodes: ['director'] }, approval),
      false,
    );
    assert.equal(
      canUserApproveRequest({ id: 'qa-user-director-2', systemRole: 'director', roleCodes: ['director'] }, approval),
      true,
    );
    assert.equal(
      canUserApproveRequest(
        { id: 'qa-user-director-2', systemRole: 'director', roleCodes: ['director'] },
        { ...approval, status: 'changes_requested' },
      ),
      false,
    );
  });

  if (failures > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  failures += 1;
  console.error(error);
  process.exitCode = 1;
});
