require('ts-node/register');

const assert = require('node:assert/strict');

const {
  computeQuotationSummary,
  computePmLevelCosts,
  computeAmortization,
  computeMonthlySchedule,
  derivePricingInvestment,
  computeVarianceSummary,
  DEFAULT_PM_INTERVALS_HOURS,
} = require('../pricing/compute.ts');

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

const baseQuotation = {
  vatRate: 0.08,
  discountRate: 0,
  citRate: 0.2,
  tpcType: null,
  tpcRate: 0,
  sellFxRate: 25500,
  buyFxRate: 26300,
  loanInterestDays: 240,
  loanInterestRate: 0.08,
};

run('computeQuotationSummary converts USD buys and computes totals', () => {
  const items = [
    {
      section: 'A_MAIN',
      description: 'SHACMAN E-TT',
      quantityLabel: 'xe',
      unitCount: 4,
      sellUnitPriceVnd: 3240000000,
      buyUnitPriceUsd: 100000,
    },
    {
      section: 'B_AUXILIARY',
      description: 'Import handling',
      quantityLabel: 'xe',
      unitCount: 4,
      buyUnitPriceVnd: 100000000,
    },
  ];

  const summary = computeQuotationSummary(baseQuotation, items);

  assert.equal(summary.lineItems[0].buyUnitPriceVnd, 2630000000);
  assert.equal(summary.totalSell, 12960000000);
  assert.equal(summary.totalBuyMain, 10520000000);
  assert.equal(summary.totalBuyAuxiliary, 400000000);
  assert.equal(summary.loanInterest, 620375671.2328768);
  assert.equal(summary.totalCost, 11540375671.232876);
  assert.equal(summary.vatSell, 1036800000);
  assert.equal(summary.vatCost, 923230053.6986301);
  assert.equal(summary.netProfit, 1226555420.0547957);
  assert.equal(summary.netRos, 0.09464162191780831);
  assert.equal(summary.overallGm, 0.1882716049382716);
});

run('computeQuotationSummary applies gross and net TPC correctly', () => {
  const items = [
    {
      section: 'A_MAIN',
      description: 'E-TT',
      quantityLabel: 'xe',
      unitCount: 2,
      sellUnitPriceVnd: 3000000000,
      buyUnitPriceVnd: 2500000000,
    },
  ];

  const gross = computeQuotationSummary({ ...baseQuotation, tpcType: 'Gross', tpcRate: 0.02 }, items);
  const net = computeQuotationSummary({ ...baseQuotation, tpcType: 'Net', tpcRate: 0.02 }, items);

  assert.equal(gross.tpc, 120000000);
  assert.equal(net.tpc, 153600000);
  assert.ok(net.netProfit < gross.netProfit);
});

run('computeQuotationSummary does not apply CIT on losses', () => {
  const items = [
    {
      section: 'A_MAIN',
      description: 'Loss case',
      quantityLabel: 'xe',
      unitCount: 1,
      sellUnitPriceVnd: 100000000,
      buyUnitPriceVnd: 200000000,
    },
  ];

  const summary = computeQuotationSummary(baseQuotation, items);
  assert.ok(summary.profitBeforeTax < 0);
  assert.equal(summary.cit, 0);
});

run('computePmLevelCosts sums all five PM levels', () => {
  const levelCosts = computePmLevelCosts([
    {
      qty: 1,
      unitPriceVnd: 357750,
      level500h: true,
      level1000h: false,
      level2000h: false,
      level3000h: false,
      level4000h: false,
    },
    {
      qty: 2,
      unitPriceVnd: 2443300,
      level500h: false,
      level1000h: true,
      level2000h: false,
      level3000h: false,
      level4000h: false,
    },
    {
      qty: 1,
      unitPriceVnd: 5750500,
      level500h: false,
      level1000h: false,
      level2000h: true,
      level3000h: false,
      level4000h: false,
    },
    {
      qty: 1,
      unitPriceVnd: 3195900,
      level500h: false,
      level1000h: false,
      level2000h: false,
      level3000h: true,
      level4000h: false,
    },
    {
      qty: 1,
      unitPriceVnd: 18186950,
      level500h: false,
      level1000h: false,
      level2000h: false,
      level3000h: false,
      level4000h: true,
    },
  ]);

  assert.deepEqual(levelCosts, [357750, 4886600, 5750500, 3195900, 18186950]);
});

run('computeAmortization builds STL/LTL tables with annual escalation', () => {
  const amortization = computeAmortization(
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
    6007399357
  );

  assert.equal(amortization.stlTable.length, 2);
  assert.equal(amortization.ltlTable.length, 5);
  assert.equal(amortization.stlTable[0].rate, 0.09);
  assert.equal(amortization.stlTable[1].rate, 0.0945);
  assert.equal(amortization.ltlTable[1].rate, 0.1236);
  assert.ok(amortization.totalStlInterest > 0);
  assert.ok(amortization.totalLtlInterest > amortization.totalStlInterest);
});

run('computeMonthlySchedule includes 500h trigger and driver cost in rental output', () => {
  const amortization = computeAmortization(
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
    6007399357
  );

  const schedule = computeMonthlySchedule(
    {
      rentPeriodMonths: 60,
      expectedProfitPct: 0.185,
      contingencyPct: 0.03,
      depreciationMonths: 60,
    },
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
      pmIntervalsHours: DEFAULT_PM_INTERVALS_HOURS,
    },
    [357750, 4886600, 5750500, 3195900, 18186950],
    amortization,
    6007399357
  );

  assert.equal(schedule.rows.length, 61);
  assert.equal(schedule.rows[1].triggers[0], 1);
  assert.equal(schedule.rows[1].maintenanceCost, 357750);
  assert.equal(schedule.rows[2].triggers[0], 1);
  assert.equal(schedule.rows[2].triggers[1], 1);
  assert.equal(schedule.rows[2].fuelCost, 14490000);
  assert.equal(schedule.rows[2].driverCost, 49000000);
  assert.ok(schedule.recommendedMonthlyRental > schedule.rows[2].totalOperatingCost);
});

run('derivePricingInvestment uses main-unit count and rental qty', () => {
  const summary = computeQuotationSummary(baseQuotation, [
    {
      section: 'A_MAIN',
      description: 'E-TT',
      quantityLabel: 'xe',
      unitCount: 4,
      sellUnitPriceVnd: 3240000000,
      buyUnitPriceVnd: 2800000000,
    },
    {
      section: 'B_AUXILIARY',
      description: 'Aux',
      quantityLabel: 'xe',
      unitCount: 4,
      buyUnitPriceVnd: 100000000,
    },
  ]);

  const investment = derivePricingInvestment(summary, 2);
  assert.equal(investment.mainUnitCount, 4);
  assert.equal(investment.investmentQty, 2);
  assert.equal(investment.totalInvestment, summary.totalCost / 2);
});

run('computeVarianceSummary compares approved estimate and actual by line item and threshold', () => {
  const variance = computeVarianceSummary(
    [
      {
        id: 'line-import',
        description: 'Import handling',
      },
      {
        id: 'line-other',
        description: 'Other cost',
      },
    ],
    [
      {
        lineItemId: 'line-import',
        entryType: 'ESTIMATE_APPROVED',
        amountVnd: 100000000,
      },
      {
        lineItemId: 'line-other',
        entryType: 'ESTIMATE_APPROVED',
        amountVnd: 50000000,
      },
      {
        lineItemId: 'line-import',
        entryType: 'ACTUAL',
        amountVnd: 130000000,
      },
      {
        lineItemId: 'line-other',
        entryType: 'ACTUAL',
        amountVnd: 52000000,
      },
    ],
    {
      thresholdPct: 0.1,
      thresholdVnd: 20000000,
    }
  );

  assert.equal(variance.totals.approvedAmountVnd, 150000000);
  assert.equal(variance.totals.actualAmountVnd, 182000000);
  assert.equal(variance.totals.varianceAmountVnd, 32000000);
  assert.equal(variance.lines[0].varianceAmountVnd, 30000000);
  assert.equal(variance.lines[0].requiresSupplementalApproval, true);
  assert.equal(variance.lines[1].requiresSupplementalApproval, false);
  assert.equal(variance.requiresSupplementalApproval, true);
});

if (failures > 0) {
  process.exitCode = 1;
}
