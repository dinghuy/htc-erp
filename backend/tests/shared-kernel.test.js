require('ts-node/register');

const assert = require('node:assert/strict');

const pricing = require('../src/shared-kernel/pricing.ts');
const revenueFlow = require('../src/shared-kernel/revenueFlow.ts');

let failures = 0;

function run(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}

run('shared revenue-flow normalizes statuses and handoff activation', () => {
  assert.equal(revenueFlow.normalizeLegacyQuotationStatus('accepted'), 'won');
  assert.equal(revenueFlow.canStartLogisticsExecution('released'), true);
  assert.equal(revenueFlow.resolveReleasedSalesOrderStatus('locked_for_execution'), 'locked_for_execution');

  const handoff = revenueFlow.resolveHandoffActivation({
    quotationId: 'q-1',
    quotationStatus: 'won',
    salesOrderId: 'so-1',
    salesOrderStatus: 'draft',
    releaseGateStatus: 'approved',
    canReleaseSalesOrder: true,
  });

  assert.equal(handoff.status, 'ready_to_release');
  assert.equal(handoff.nextActionKey, 'release_sales_order');
});

run('shared pricing kernel computes amortization and rental schedule', () => {
  const summary = pricing.computeQuotationSummary(
    {
      vatRate: 0.08,
      discountRate: 0,
      citRate: 0.2,
      tpcType: null,
      tpcRate: 0,
      sellFxRate: 25500,
      buyFxRate: 26300,
      loanInterestDays: 240,
      loanInterestRate: 0.08,
    },
    [
      {
        section: 'A_MAIN',
        description: 'E-TT',
        quantityLabel: 'xe',
        unitCount: 2,
        sellUnitPriceVnd: 3000000000,
        buyUnitPriceVnd: 2500000000,
      },
    ],
  );

  const investment = pricing.derivePricingInvestment(summary, 2);
  const amortization = pricing.computeAmortization(
    {
      investmentQty: 2,
      depreciationMonths: 60,
      stlPct: 0.3,
      stlPeriodMonths: 24,
      stlRate: 0.09,
      stlRateChange: 0.05,
      ltlPeriodMonths: 60,
      ltlRate: 0.12,
      ltlRateChange: 0.03,
      rentPeriodMonths: 60,
      downpaymentMonths: 3,
      paymentDelayDays: 30,
      expectedProfitPct: 0.185,
      contingencyPct: 0.03,
    },
    investment.totalInvestment,
  );
  const schedule = pricing.computeMonthlySchedule(
    { rentPeriodMonths: 60, depreciationMonths: 60, expectedProfitPct: 0.185, contingencyPct: 0.03 },
    {
      workingDaysMonth: 30,
      dailyHours: 20,
      movesPerDay: 70,
      kmPerMove: 1,
      electricityPriceVnd: 3000,
      kwhPerKm: 2.3,
      driversPerUnit: 2,
      driverSalaryVnd: 20000000,
      insuranceRate: 0.225,
      pmIntervalsHours: pricing.DEFAULT_PM_INTERVALS_HOURS,
    },
    [357750, 4886600, 5750500, 3195900, 18186950],
    amortization,
    investment.totalInvestment,
  );

  assert.equal(amortization.stlTable.length, 2);
  assert.equal(schedule.rows.length, 61);
  assert.equal(schedule.rows[1].triggers[0], 1);
  assert.ok(schedule.recommendedMonthlyRental > 0);
});

if (failures > 0) {
  process.exitCode = 1;
}
