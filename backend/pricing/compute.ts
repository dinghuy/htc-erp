export const DEFAULT_PM_INTERVALS_HOURS = [500, 1000, 2000, 3000, 4000];

export type PricingSection = 'A_MAIN' | 'B_AUXILIARY' | 'C_OTHER';
export type TpcType = 'Net' | 'Gross' | null;

export interface PricingQuotationInput {
  projectCode?: string | null;
  customerName?: string | null;
  supplierName?: string | null;
  salePerson?: string | null;
  date?: string | null;
  vatRate?: number | null;
  discountRate?: number | null;
  citRate?: number | null;
  tpcType?: TpcType;
  tpcRate?: number | null;
  sellFxRate?: number | null;
  buyFxRate?: number | null;
  loanInterestDays?: number | null;
  loanInterestRate?: number | null;
}

export interface PricingLineItemInput {
  id?: string | null;
  section: PricingSection;
  description: string;
  quantityLabel?: string | null;
  unitCount: number;
  sellUnitPriceVnd?: number | null;
  buyUnitPriceVnd?: number | null;
  buyUnitPriceUsd?: number | null;
  costRoutingType?: 'IMPORT_COST' | 'OTHER_COST' | null;
}

export interface PricingCostEntryInput {
  id?: string | null;
  pricingQuotationId?: string | null;
  lineItemId?: string | null;
  entryType: 'ESTIMATE_APPROVED' | 'ACTUAL';
  amountVnd?: number | null;
  quantity?: number | null;
  note?: string | null;
  recordedAt?: string | null;
  recordedBy?: string | null;
}

export interface VarianceSummaryLine {
  lineItemId: string | null;
  description: string;
  approvedAmountVnd: number;
  actualAmountVnd: number;
  varianceAmountVnd: number;
  variancePct: number;
  requiresSupplementalApproval: boolean;
}

export interface VarianceSummary {
  lines: VarianceSummaryLine[];
  totals: {
    approvedAmountVnd: number;
    actualAmountVnd: number;
    varianceAmountVnd: number;
    variancePct: number;
  };
  thresholds: {
    thresholdPct: number;
    thresholdVnd: number;
  };
  requiresSupplementalApproval: boolean;
}

export interface PricingLineItemComputed extends PricingLineItemInput {
  buyUnitPriceVnd: number;
  sellUnitPriceVnd: number;
  sellAmount: number;
  buyAmount: number;
  gmPct: number;
}

export interface PricingSummary {
  lineItems: PricingLineItemComputed[];
  totalSellMain: number;
  totalBuyMain: number;
  totalSellOther: number;
  totalBuyOther: number;
  totalBuyAuxiliary: number;
  totalSell: number;
  totalCost: number;
  vatSell: number;
  vatCost: number;
  discountAmount: number;
  totalSellIncl: number;
  totalCostIncl: number;
  loanInterest: number;
  tpc: number;
  profitBeforeTax: number;
  cit: number;
  netProfit: number;
  netRos: number;
  overallGm: number;
}

export interface PricingRentalConfigInput {
  investmentQty?: number | null;
  depreciationMonths?: number | null;
  stlPct?: number | null;
  stlPeriodMonths?: number | null;
  stlRate?: number | null;
  stlRateChange?: number | null;
  ltlPeriodMonths?: number | null;
  ltlRate?: number | null;
  ltlRateChange?: number | null;
  rentPeriodMonths?: number | null;
  downpaymentMonths?: number | null;
  paymentDelayDays?: number | null;
  expectedProfitPct?: number | null;
  contingencyPct?: number | null;
}

export interface PricingOperationConfigInput {
  workingDaysMonth?: number | null;
  dailyHours?: number | null;
  movesPerDay?: number | null;
  kmPerMove?: number | null;
  electricityPriceVnd?: number | null;
  kwhPerKm?: number | null;
  driversPerUnit?: number | null;
  driverSalaryVnd?: number | null;
  insuranceRate?: number | null;
  pmIntervalsHours?: number[] | null;
}

export interface PricingMaintenancePartInput {
  qty?: number | null;
  unitPriceVnd?: number | null;
  level500h?: boolean | null;
  level1000h?: boolean | null;
  level2000h?: boolean | null;
  level3000h?: boolean | null;
  level4000h?: boolean | null;
}

export interface AmortizationRow {
  year: number;
  balance: number;
  rate: number;
  interest: number;
  principal: number;
}

export interface AmortizationResult {
  totalInvestment: number;
  investmentVat: number;
  investmentTotalWithVat: number;
  stlAmount: number;
  ltlAmount: number;
  stlTable: AmortizationRow[];
  ltlTable: AmortizationRow[];
  totalStlInterest: number;
  totalLtlInterest: number;
  totalFinanceInterest: number;
}

export interface MonthlyScheduleRow {
  month: number;
  active: boolean;
  accumulatedHours: number;
  accumulatedKm: number;
  triggers: number[];
  fuelCost: number;
  maintenanceCost: number;
  driverCost: number;
  totalOperatingCost: number;
  monthlyDepreciation: number;
  monthlyFinanceCost: number;
  monthlyCostBeforeMargin: number;
  recommendedRental: number;
}

export interface MonthlyScheduleResult {
  rows: MonthlyScheduleRow[];
  monthlyDepreciation: number;
  monthlyFinanceCost: number;
  driverCostPerMonth: number;
  fuelCostPerMonth: number;
  totalFuelCost: number;
  totalMaintenanceCost: number;
  totalDriverCost: number;
  recommendedMonthlyRental: number;
}

const DEFAULT_QUOTATION: Required<PricingQuotationInput> = {
  projectCode: '',
  customerName: '',
  supplierName: '',
  salePerson: '',
  date: '',
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

export const DEFAULT_RENTAL_CONFIG: Required<PricingRentalConfigInput> = {
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
};

export const DEFAULT_OPERATION_CONFIG: Required<PricingOperationConfigInput> = {
  workingDaysMonth: 30,
  dailyHours: 20,
  movesPerDay: 70,
  kmPerMove: 1,
  electricityPriceVnd: 3000,
  kwhPerKm: 2.3,
  driversPerUnit: 2,
  driverSalaryVnd: 20000000,
  insuranceRate: 0.225,
  pmIntervalsHours: [...DEFAULT_PM_INTERVALS_HOURS],
};

function num(value: unknown, fallback = 0): number {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function roundMoney(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export function normalizeQuotationInput(input: PricingQuotationInput): Required<PricingQuotationInput> {
  return {
    ...DEFAULT_QUOTATION,
    ...input,
    vatRate: num(input.vatRate, DEFAULT_QUOTATION.vatRate),
    discountRate: num(input.discountRate, DEFAULT_QUOTATION.discountRate),
    citRate: num(input.citRate, DEFAULT_QUOTATION.citRate),
    tpcRate: num(input.tpcRate, DEFAULT_QUOTATION.tpcRate),
    sellFxRate: num(input.sellFxRate, DEFAULT_QUOTATION.sellFxRate),
    buyFxRate: num(input.buyFxRate, DEFAULT_QUOTATION.buyFxRate),
    loanInterestDays: num(input.loanInterestDays, DEFAULT_QUOTATION.loanInterestDays),
    loanInterestRate: num(input.loanInterestRate, DEFAULT_QUOTATION.loanInterestRate),
    tpcType: input.tpcType === 'Net' || input.tpcType === 'Gross' ? input.tpcType : null,
  };
}

export function normalizeRentalConfig(input: PricingRentalConfigInput): Required<PricingRentalConfigInput> {
  return {
    ...DEFAULT_RENTAL_CONFIG,
    ...input,
    investmentQty: Math.max(1, Math.trunc(num(input.investmentQty, DEFAULT_RENTAL_CONFIG.investmentQty))),
    depreciationMonths: Math.max(1, Math.trunc(num(input.depreciationMonths, DEFAULT_RENTAL_CONFIG.depreciationMonths))),
    stlPct: num(input.stlPct, DEFAULT_RENTAL_CONFIG.stlPct),
    stlPeriodMonths: Math.max(12, Math.trunc(num(input.stlPeriodMonths, DEFAULT_RENTAL_CONFIG.stlPeriodMonths))),
    stlRate: num(input.stlRate, DEFAULT_RENTAL_CONFIG.stlRate),
    stlRateChange: num(input.stlRateChange, DEFAULT_RENTAL_CONFIG.stlRateChange),
    ltlPeriodMonths: Math.max(12, Math.trunc(num(input.ltlPeriodMonths, DEFAULT_RENTAL_CONFIG.ltlPeriodMonths))),
    ltlRate: num(input.ltlRate, DEFAULT_RENTAL_CONFIG.ltlRate),
    ltlRateChange: num(input.ltlRateChange, DEFAULT_RENTAL_CONFIG.ltlRateChange),
    rentPeriodMonths: Math.max(1, Math.trunc(num(input.rentPeriodMonths, DEFAULT_RENTAL_CONFIG.rentPeriodMonths))),
    downpaymentMonths: Math.max(0, Math.trunc(num(input.downpaymentMonths, DEFAULT_RENTAL_CONFIG.downpaymentMonths))),
    paymentDelayDays: Math.max(0, Math.trunc(num(input.paymentDelayDays, DEFAULT_RENTAL_CONFIG.paymentDelayDays))),
    expectedProfitPct: num(input.expectedProfitPct, DEFAULT_RENTAL_CONFIG.expectedProfitPct),
    contingencyPct: num(input.contingencyPct, DEFAULT_RENTAL_CONFIG.contingencyPct),
  };
}

export function normalizeOperationConfig(input: PricingOperationConfigInput): Required<PricingOperationConfigInput> {
  const intervals = Array.isArray(input.pmIntervalsHours) && input.pmIntervalsHours.length
    ? input.pmIntervalsHours.map(value => Math.max(1, Math.trunc(num(value, 0)))).sort((a, b) => a - b)
    : [...DEFAULT_PM_INTERVALS_HOURS];

  return {
    ...DEFAULT_OPERATION_CONFIG,
    ...input,
    workingDaysMonth: Math.max(1, Math.trunc(num(input.workingDaysMonth, DEFAULT_OPERATION_CONFIG.workingDaysMonth))),
    dailyHours: Math.max(1, num(input.dailyHours, DEFAULT_OPERATION_CONFIG.dailyHours)),
    movesPerDay: Math.max(1, num(input.movesPerDay, DEFAULT_OPERATION_CONFIG.movesPerDay)),
    kmPerMove: Math.max(0.1, num(input.kmPerMove, DEFAULT_OPERATION_CONFIG.kmPerMove)),
    electricityPriceVnd: Math.max(0, num(input.electricityPriceVnd, DEFAULT_OPERATION_CONFIG.electricityPriceVnd)),
    kwhPerKm: Math.max(0, num(input.kwhPerKm, DEFAULT_OPERATION_CONFIG.kwhPerKm)),
    driversPerUnit: Math.max(0, num(input.driversPerUnit, DEFAULT_OPERATION_CONFIG.driversPerUnit)),
    driverSalaryVnd: Math.max(0, num(input.driverSalaryVnd, DEFAULT_OPERATION_CONFIG.driverSalaryVnd)),
    insuranceRate: Math.max(0, num(input.insuranceRate, DEFAULT_OPERATION_CONFIG.insuranceRate)),
    pmIntervalsHours: intervals,
  };
}

export function computeQuotationSummary(
  quotationInput: PricingQuotationInput,
  lineItemsInput: PricingLineItemInput[],
): PricingSummary {
  const quotation = normalizeQuotationInput(quotationInput);
  const lineItems = (lineItemsInput || []).map(item => {
    const sellUnitPriceVnd = roundMoney(num(item.sellUnitPriceVnd, 0));
    const buyUnitPriceVnd = item.buyUnitPriceUsd != null && item.buyUnitPriceVnd == null
      ? roundMoney(num(item.buyUnitPriceUsd, 0) * quotation.buyFxRate)
      : roundMoney(num(item.buyUnitPriceVnd, 0));
    const unitCount = Math.max(0, Math.trunc(num(item.unitCount, 0)));
    const sellAmount = sellUnitPriceVnd * unitCount;
    const buyAmount = buyUnitPriceVnd * unitCount;

    return {
      ...item,
      unitCount,
      sellUnitPriceVnd,
      buyUnitPriceVnd,
      buyUnitPriceUsd: item.buyUnitPriceUsd ?? null,
      sellAmount,
      buyAmount,
      gmPct: sellAmount > 0 ? (sellAmount - buyAmount) / sellAmount : 0,
    } as PricingLineItemComputed;
  });

  const sumBy = (section: PricingSection, pick: keyof PricingLineItemComputed) =>
    lineItems
      .filter(item => item.section === section)
      .reduce((total, item) => total + num(item[pick], 0), 0);

  const totalSellMain = sumBy('A_MAIN', 'sellAmount');
  const totalBuyMain = sumBy('A_MAIN', 'buyAmount');
  const totalBuyAuxiliary = sumBy('B_AUXILIARY', 'buyAmount');
  const totalSellOther = sumBy('C_OTHER', 'sellAmount');
  const totalBuyOther = sumBy('C_OTHER', 'buyAmount');
  const loanBase = totalBuyMain + totalBuyAuxiliary;
  const loanInterest = quotation.loanInterestRate * (quotation.loanInterestDays / 365) * loanBase * (1 + quotation.vatRate);
  const totalSell = totalSellMain + totalSellOther;
  const totalCost = totalBuyMain + totalBuyAuxiliary + totalBuyOther + loanInterest;
  const vatSell = totalSell * quotation.vatRate;
  const vatCost = totalCost * quotation.vatRate;
  const discountAmount = totalSell * quotation.discountRate;
  const totalSellIncl = totalSell + vatSell - discountAmount;
  const totalCostIncl = totalCost + vatCost;

  let tpc = 0;
  if (quotation.tpcType === 'Net') {
    tpc = totalSell * quotation.tpcRate * 1.28;
  } else if (quotation.tpcType === 'Gross') {
    tpc = totalSell * quotation.tpcRate;
  }

  const profitBeforeTax = totalSellIncl - totalCostIncl - tpc;
  const cit = profitBeforeTax > 0 ? profitBeforeTax * quotation.citRate : 0;
  const netProfit = profitBeforeTax - cit;

  return {
    lineItems,
    totalSellMain,
    totalBuyMain,
    totalSellOther,
    totalBuyOther,
    totalBuyAuxiliary,
    totalSell,
    totalCost,
    vatSell,
    vatCost,
    discountAmount,
    totalSellIncl,
    totalCostIncl,
    loanInterest,
    tpc,
    profitBeforeTax,
    cit,
    netProfit,
    netRos: totalSell > 0 ? netProfit / totalSell : 0,
    overallGm: totalSellMain > 0 ? (totalSellMain - totalBuyMain) / totalSellMain : 0,
  };
}

export function derivePricingInvestment(summary: PricingSummary, investmentQty: number) {
  const mainUnitCount = Math.max(
    1,
    summary.lineItems
      .filter(item => item.section === 'A_MAIN')
      .reduce((total, item) => total + item.unitCount, 0),
  );
  const normalizedQty = Math.max(1, Math.trunc(num(investmentQty, 1)));
  const unitInvestment = summary.totalCost / mainUnitCount;
  return {
    mainUnitCount,
    investmentQty: normalizedQty,
    unitInvestment,
    totalInvestment: unitInvestment * normalizedQty,
  };
}

function buildAmortizationTable(
  totalAmount: number,
  periodMonths: number,
  initialRate: number,
  annualRateChange: number,
): AmortizationRow[] {
  const years = Math.max(1, Math.ceil(periodMonths / 12));
  const principal = totalAmount / years;
  const rows: AmortizationRow[] = [];

  for (let year = 1; year <= years; year += 1) {
    const balance = Math.max(0, totalAmount - principal * (year - 1));
    const rate = initialRate * Math.pow(1 + annualRateChange, year - 1);
    rows.push({
      year,
      balance,
      rate,
      interest: balance * rate,
      principal,
    });
  }

  return rows;
}

export function computeAmortization(
  rentalInput: PricingRentalConfigInput,
  totalInvestment: number,
): AmortizationResult {
  const rental = normalizeRentalConfig(rentalInput);
  const investmentVat = totalInvestment * 0.1;
  const investmentTotalWithVat = totalInvestment + investmentVat;
  const stlAmount = investmentTotalWithVat * rental.stlPct;
  const ltlAmount = investmentTotalWithVat * Math.max(0, 1 - rental.stlPct);
  const stlTable = buildAmortizationTable(stlAmount, rental.stlPeriodMonths, rental.stlRate, rental.stlRateChange);
  const ltlTable = buildAmortizationTable(ltlAmount, rental.ltlPeriodMonths, rental.ltlRate, rental.ltlRateChange);
  const totalStlInterest = stlTable.reduce((total, row) => total + row.interest, 0);
  const totalLtlInterest = ltlTable.reduce((total, row) => total + row.interest, 0);

  return {
    totalInvestment,
    investmentVat,
    investmentTotalWithVat,
    stlAmount,
    ltlAmount,
    stlTable,
    ltlTable,
    totalStlInterest,
    totalLtlInterest,
    totalFinanceInterest: totalStlInterest + totalLtlInterest,
  };
}

export function computePmLevelCosts(parts: PricingMaintenancePartInput[]): number[] {
  const levelCosts = [0, 0, 0, 0, 0];

  (parts || []).forEach(part => {
    const amount = num(part.qty, 0) * num(part.unitPriceVnd, 0);
    if (part.level500h) levelCosts[0] += amount;
    if (part.level1000h) levelCosts[1] += amount;
    if (part.level2000h) levelCosts[2] += amount;
    if (part.level3000h) levelCosts[3] += amount;
    if (part.level4000h) levelCosts[4] += amount;
  });

  return levelCosts;
}

export function computeMonthlySchedule(
  rentalInput: Partial<PricingRentalConfigInput>,
  operationInput: PricingOperationConfigInput,
  pmCostsInput: number[],
  amortization: AmortizationResult,
  totalInvestment: number,
): MonthlyScheduleResult {
  const rental = normalizeRentalConfig(rentalInput);
  const ops = normalizeOperationConfig(operationInput);
  const pmIntervals = ops.pmIntervalsHours.length ? ops.pmIntervalsHours : [...DEFAULT_PM_INTERVALS_HOURS];
  const pmCosts = pmIntervals.map((_, index) => num(pmCostsInput[index], 0));
  const hoursPerMonth = ops.dailyHours * ops.workingDaysMonth;
  const kmPerMonth = ops.movesPerDay * ops.workingDaysMonth * ops.kmPerMove;
  const fuelCostPerMonth = kmPerMonth * ops.kwhPerKm * ops.electricityPriceVnd;
  const driverCostPerMonth = ops.driversPerUnit * ops.driverSalaryVnd * (1 + ops.insuranceRate);
  const monthlyDepreciation = totalInvestment / rental.depreciationMonths;
  const monthlyFinanceCost = amortization.totalFinanceInterest / rental.rentPeriodMonths;

  let accumulatedHours = 0;
  let accumulatedKm = 0;

  const rows: MonthlyScheduleRow[] = [];
  let totalFuelCost = 0;
  let totalMaintenanceCost = 0;
  let totalDriverCost = 0;
  let cumulativeBaseCost = 0;

  for (let month = 0; month <= rental.rentPeriodMonths; month += 1) {
    const active = month > 0 && month <= rental.rentPeriodMonths;
    const previousHours = accumulatedHours;
    const previousKm = accumulatedKm;

    if (active) {
      accumulatedHours += hoursPerMonth;
      accumulatedKm += kmPerMonth;
    }

    const triggers = pmIntervals.map(interval => {
      if (!active) return 0;
      return Math.max(0, Math.floor(accumulatedHours / interval) - Math.floor(previousHours / interval));
    });

    const maintenanceCost = triggers.reduce((total, count, index) => total + count * pmCosts[index], 0);
    const fuelCost = active ? (accumulatedKm - previousKm) * ops.kwhPerKm * ops.electricityPriceVnd : 0;
    const driverCost = active ? driverCostPerMonth : 0;
    const totalOperatingCost = fuelCost + maintenanceCost + driverCost;
    const monthlyCostBeforeMargin = active ? monthlyDepreciation + monthlyFinanceCost + totalOperatingCost : 0;

    totalFuelCost += fuelCost;
    totalMaintenanceCost += maintenanceCost;
    totalDriverCost += driverCost;
    cumulativeBaseCost += monthlyCostBeforeMargin;

    rows.push({
      month,
      active,
      accumulatedHours: active ? accumulatedHours : 0,
      accumulatedKm: active ? accumulatedKm : 0,
      triggers,
      fuelCost,
      maintenanceCost,
      driverCost,
      totalOperatingCost,
      monthlyDepreciation: active ? monthlyDepreciation : 0,
      monthlyFinanceCost: active ? monthlyFinanceCost : 0,
      monthlyCostBeforeMargin,
      recommendedRental: 0,
    });
  }

  const averageBaseMonthlyCost = cumulativeBaseCost / Math.max(1, rental.rentPeriodMonths);
  const recommendedMonthlyRental = averageBaseMonthlyCost * (1 + rental.expectedProfitPct + rental.contingencyPct);
  rows.forEach(row => {
    row.recommendedRental = row.active ? recommendedMonthlyRental : 0;
  });

  return {
    rows,
    monthlyDepreciation,
    monthlyFinanceCost,
    driverCostPerMonth,
    fuelCostPerMonth,
    totalFuelCost,
    totalMaintenanceCost,
    totalDriverCost,
    recommendedMonthlyRental,
  };
}

export function computeVarianceSummary(
  lineItemsInput: Array<Pick<PricingLineItemInput, 'id' | 'description'>> = [],
  costEntriesInput: PricingCostEntryInput[] = [],
  thresholds: {
    thresholdPct?: number | null;
    thresholdVnd?: number | null;
  } = {},
): VarianceSummary {
  const thresholdPct = Math.max(0, num(thresholds.thresholdPct, 0));
  const thresholdVnd = Math.max(0, num(thresholds.thresholdVnd, 0));
  const lines = (lineItemsInput || []).map((lineItem) => {
    const lineItemId = lineItem?.id ? String(lineItem.id) : null;
    const approvedAmountVnd = (costEntriesInput || [])
      .filter(entry => entry?.lineItemId === lineItemId && entry.entryType === 'ESTIMATE_APPROVED')
      .reduce((total, entry) => total + num(entry.amountVnd, 0), 0);
    const actualAmountVnd = (costEntriesInput || [])
      .filter(entry => entry?.lineItemId === lineItemId && entry.entryType === 'ACTUAL')
      .reduce((total, entry) => total + num(entry.amountVnd, 0), 0);
    const varianceAmountVnd = actualAmountVnd - approvedAmountVnd;
    const variancePct = approvedAmountVnd > 0 ? Math.abs(varianceAmountVnd) / approvedAmountVnd : (actualAmountVnd > 0 ? 1 : 0);
    const requiresSupplementalApproval = Math.abs(varianceAmountVnd) >= thresholdVnd && variancePct >= thresholdPct;

    return {
      lineItemId,
      description: lineItem?.description || '',
      approvedAmountVnd,
      actualAmountVnd,
      varianceAmountVnd,
      variancePct,
      requiresSupplementalApproval,
    };
  });

  const approvedAmountVnd = lines.reduce((total, line) => total + line.approvedAmountVnd, 0);
  const actualAmountVnd = lines.reduce((total, line) => total + line.actualAmountVnd, 0);
  const varianceAmountVnd = actualAmountVnd - approvedAmountVnd;
  const variancePct = approvedAmountVnd > 0 ? Math.abs(varianceAmountVnd) / approvedAmountVnd : (actualAmountVnd > 0 ? 1 : 0);

  return {
    lines,
    totals: {
      approvedAmountVnd,
      actualAmountVnd,
      varianceAmountVnd,
      variancePct,
    },
    thresholds: {
      thresholdPct,
      thresholdVnd,
    },
    requiresSupplementalApproval: lines.some(line => line.requiresSupplementalApproval),
  };
}
