export const DEFAULT_PM_INTERVALS_HOURS = [500, 1000, 2000, 3000, 4000];

export type PricingSection = 'A_MAIN' | 'B_AUXILIARY' | 'C_OTHER';
export type TpcType = 'Net' | 'Gross' | null;

export interface PricingLineItem {
  id?: string;
  section: PricingSection;
  description: string;
  quantityLabel?: string | null;
  unitCount: number;
  sellUnitPriceVnd?: number | null;
  buyUnitPriceVnd?: number | null;
  buyUnitPriceUsd?: number | null;
  costRoutingType?: 'IMPORT_COST' | 'OTHER_COST' | null;
}

export interface PricingCostEntry {
  id?: string;
  pricingQuotationId?: string | null;
  lineItemId?: string | null;
  entryType: 'ESTIMATE_APPROVED' | 'ACTUAL';
  amountVnd?: number | null;
  quantity?: number | null;
  note?: string | null;
  recordedAt?: string | null;
  recordedBy?: string | null;
}

export interface PricingVarianceLine {
  lineItemId: string | null;
  description: string;
  approvedAmountVnd: number;
  actualAmountVnd: number;
  varianceAmountVnd: number;
  variancePct: number;
  requiresSupplementalApproval: boolean;
}

export interface PricingVarianceSummary {
  lines: PricingVarianceLine[];
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

export interface PricingMaintenancePart {
  id?: string;
  systemName?: string;
  itemDescription?: string;
  modelSpec?: string;
  unit?: string;
  qty?: number | null;
  unitPriceVnd?: number | null;
  level500h?: boolean | null;
  level1000h?: boolean | null;
  level2000h?: boolean | null;
  level3000h?: boolean | null;
  level4000h?: boolean | null;
  note?: string;
}

export interface PricingQuotationDraft {
  id?: string;
  projectId?: string | null;
  projectCode: string;
  customerName: string;
  supplierName: string;
  salePerson: string;
  changeReason?: string | null;
  qbuType?: 'INITIAL' | 'SUPPLEMENTAL';
  parentPricingQuotationId?: string | null;
  batchNo?: number;
  qbuWorkflowStage?: 'draft' | 'procurement_review' | 'finance_review' | 'completed' | 'closed';
  qbuSubmittedAt?: string | null;
  qbuSubmittedBy?: string | null;
  qbuCompletedAt?: string | null;
  date: string;
  vatRate: number;
  discountRate: number;
  citRate: number;
  tpcType: TpcType;
  tpcRate: number;
  sellFxRate: number;
  buyFxRate: number;
  loanInterestDays: number;
  loanInterestRate: number;
  lineItems: PricingLineItem[];
  rentalConfig: PricingRentalConfig;
  operationConfig: PricingOperationConfig;
  maintenanceParts: PricingMaintenancePart[];
  costEntries?: PricingCostEntry[];
  varianceSummary?: PricingVarianceSummary | null;
}

export interface PricingRentalConfig {
  investmentQty: number;
  depreciationMonths: number;
  stlPct: number;
  stlPeriodMonths: number;
  stlRate: number;
  stlRateChange: number;
  ltlPeriodMonths: number;
  ltlRate: number;
  ltlRateChange: number;
  rentPeriodMonths: number;
  downpaymentMonths: number;
  paymentDelayDays: number;
  expectedProfitPct: number;
  contingencyPct: number;
}

export interface PricingOperationConfig {
  workingDaysMonth: number;
  dailyHours: number;
  movesPerDay: number;
  kmPerMove: number;
  electricityPriceVnd: number;
  kwhPerKm: number;
  driversPerUnit: number;
  driverSalaryVnd: number;
  insuranceRate: number;
  pmIntervalsHours: number[];
}

const num = (value: unknown, fallback = 0) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

export const DEFAULT_RENTAL_CONFIG: PricingRentalConfig = {
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

export const DEFAULT_OPERATION_CONFIG: PricingOperationConfig = {
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

export const createEmptyPricingDraft = (): PricingQuotationDraft => ({
  projectId: null,
  projectCode: '',
  customerName: '',
  supplierName: '',
  salePerson: '',
  changeReason: null,
  qbuType: 'INITIAL',
  parentPricingQuotationId: null,
  batchNo: 0,
  qbuWorkflowStage: 'draft',
  qbuSubmittedAt: null,
  qbuSubmittedBy: null,
  qbuCompletedAt: null,
  date: new Date().toISOString().slice(0, 10),
  vatRate: 0.08,
  discountRate: 0,
  citRate: 0.2,
  tpcType: null,
  tpcRate: 0,
  sellFxRate: 25500,
  buyFxRate: 26300,
  loanInterestDays: 240,
  loanInterestRate: 0.08,
  lineItems: [],
  rentalConfig: { ...DEFAULT_RENTAL_CONFIG },
  operationConfig: { ...DEFAULT_OPERATION_CONFIG, pmIntervalsHours: [...DEFAULT_OPERATION_CONFIG.pmIntervalsHours] },
  maintenanceParts: [],
  costEntries: [],
  varianceSummary: null,
});

export function normalizePricingDraft(raw: Partial<PricingQuotationDraft> | null | undefined): PricingQuotationDraft {
  const base = createEmptyPricingDraft();
  return {
    ...base,
    ...raw,
    lineItems: Array.isArray(raw?.lineItems) ? raw!.lineItems.map((item) => ({
      ...item,
      section: item.section,
      description: item.description || '',
      quantityLabel: item.quantityLabel || '',
      unitCount: Math.max(0, Math.trunc(num(item.unitCount, 0))),
      sellUnitPriceVnd: item.sellUnitPriceVnd == null ? null : num(item.sellUnitPriceVnd, 0),
      buyUnitPriceVnd: item.buyUnitPriceVnd == null ? null : num(item.buyUnitPriceVnd, 0),
      buyUnitPriceUsd: item.buyUnitPriceUsd == null ? null : num(item.buyUnitPriceUsd, 0),
      costRoutingType: item.costRoutingType || null,
    })) : [],
    rentalConfig: { ...DEFAULT_RENTAL_CONFIG, ...(raw?.rentalConfig || {}) },
    operationConfig: {
      ...DEFAULT_OPERATION_CONFIG,
      ...(raw?.operationConfig || {}),
      pmIntervalsHours: Array.isArray(raw?.operationConfig?.pmIntervalsHours) && raw?.operationConfig?.pmIntervalsHours.length
        ? raw!.operationConfig!.pmIntervalsHours!.map((value) => Math.max(1, Math.trunc(num(value, 0)))).sort((a, b) => a - b)
        : [...DEFAULT_OPERATION_CONFIG.pmIntervalsHours],
    },
    maintenanceParts: Array.isArray(raw?.maintenanceParts) ? raw!.maintenanceParts.map((part) => ({
      ...part,
      qty: num(part.qty, 0),
      unitPriceVnd: num(part.unitPriceVnd, 0),
    })) : [],
    costEntries: Array.isArray(raw?.costEntries) ? raw.costEntries.map((entry) => ({
      ...entry,
      pricingQuotationId: entry.pricingQuotationId || null,
      lineItemId: entry.lineItemId || null,
      amountVnd: entry.amountVnd == null ? null : num(entry.amountVnd, 0),
      quantity: entry.quantity == null ? null : num(entry.quantity, 0),
      note: entry.note || '',
      recordedAt: entry.recordedAt || null,
      recordedBy: entry.recordedBy || null,
    })) : [],
    varianceSummary: raw?.varianceSummary ? {
      ...raw.varianceSummary,
      lines: Array.isArray(raw.varianceSummary.lines) ? raw.varianceSummary.lines.map((line) => ({
        ...line,
        approvedAmountVnd: num(line.approvedAmountVnd, 0),
        actualAmountVnd: num(line.actualAmountVnd, 0),
        varianceAmountVnd: num(line.varianceAmountVnd, 0),
        variancePct: num(line.variancePct, 0),
        requiresSupplementalApproval: Boolean(line.requiresSupplementalApproval),
      })) : [],
      totals: {
        approvedAmountVnd: num(raw.varianceSummary.totals?.approvedAmountVnd, 0),
        actualAmountVnd: num(raw.varianceSummary.totals?.actualAmountVnd, 0),
        varianceAmountVnd: num(raw.varianceSummary.totals?.varianceAmountVnd, 0),
        variancePct: num(raw.varianceSummary.totals?.variancePct, 0),
      },
      thresholds: {
        thresholdPct: num(raw.varianceSummary.thresholds?.thresholdPct, 0),
        thresholdVnd: num(raw.varianceSummary.thresholds?.thresholdVnd, 0),
      },
      requiresSupplementalApproval: Boolean(raw.varianceSummary.requiresSupplementalApproval),
    } : null,
  };
}

export function computeQuotationSummary(draft: PricingQuotationDraft) {
  const lineItems = draft.lineItems.map((item) => {
    const buyUnitPriceVnd = item.buyUnitPriceUsd != null && item.buyUnitPriceVnd == null
      ? item.buyUnitPriceUsd * draft.buyFxRate
      : num(item.buyUnitPriceVnd, 0);
    const sellUnitPriceVnd = num(item.sellUnitPriceVnd, 0);
    const unitCount = Math.max(0, Math.trunc(num(item.unitCount, 0)));
    const sellAmount = sellUnitPriceVnd * unitCount;
    const buyAmount = buyUnitPriceVnd * unitCount;
    return {
      ...item,
      unitCount,
      sellUnitPriceVnd,
      buyUnitPriceVnd,
      sellAmount,
      buyAmount,
      gmPct: sellAmount > 0 ? (sellAmount - buyAmount) / sellAmount : 0,
    };
  });

  const totalSellMain = lineItems.filter((item) => item.section === 'A_MAIN').reduce((total, item) => total + item.sellAmount, 0);
  const totalBuyMain = lineItems.filter((item) => item.section === 'A_MAIN').reduce((total, item) => total + item.buyAmount, 0);
  const totalBuyAuxiliary = lineItems.filter((item) => item.section === 'B_AUXILIARY').reduce((total, item) => total + item.buyAmount, 0);
  const totalSellOther = lineItems.filter((item) => item.section === 'C_OTHER').reduce((total, item) => total + item.sellAmount, 0);
  const totalBuyOther = lineItems.filter((item) => item.section === 'C_OTHER').reduce((total, item) => total + item.buyAmount, 0);
  const loanInterest = draft.loanInterestRate * (draft.loanInterestDays / 365) * (totalBuyMain + totalBuyAuxiliary) * (1 + draft.vatRate);
  const totalSell = totalSellMain + totalSellOther;
  const totalCost = totalBuyMain + totalBuyAuxiliary + totalBuyOther + loanInterest;
  const vatSell = totalSell * draft.vatRate;
  const vatCost = totalCost * draft.vatRate;
  const discountAmount = totalSell * draft.discountRate;
  const totalSellIncl = totalSell + vatSell - discountAmount;
  const totalCostIncl = totalCost + vatCost;
  const tpc = draft.tpcType === 'Net'
    ? totalSell * draft.tpcRate * 1.28
    : draft.tpcType === 'Gross'
      ? totalSell * draft.tpcRate
      : 0;
  const profitBeforeTax = totalSellIncl - totalCostIncl - tpc;
  const cit = profitBeforeTax > 0 ? profitBeforeTax * draft.citRate : 0;
  const netProfit = profitBeforeTax - cit;

  return {
    lineItems,
    totalSellMain,
    totalBuyMain,
    totalBuyAuxiliary,
    totalSellOther,
    totalBuyOther,
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

export function deriveInvestment(summary: ReturnType<typeof computeQuotationSummary>, investmentQty: number) {
  const mainUnitCount = Math.max(1, summary.lineItems.filter((item) => item.section === 'A_MAIN').reduce((total, item) => total + item.unitCount, 0));
  const unitInvestment = summary.totalCost / mainUnitCount;
  return {
    mainUnitCount,
    investmentQty,
    unitInvestment,
    totalInvestment: unitInvestment * investmentQty,
  };
}

export function computePmLevelCosts(parts: PricingMaintenancePart[]) {
  const costs = [0, 0, 0, 0, 0];
  parts.forEach((part) => {
    const amount = num(part.qty, 0) * num(part.unitPriceVnd, 0);
    if (part.level500h) costs[0] += amount;
    if (part.level1000h) costs[1] += amount;
    if (part.level2000h) costs[2] += amount;
    if (part.level3000h) costs[3] += amount;
    if (part.level4000h) costs[4] += amount;
  });
  return costs;
}

function buildAmortizationTable(totalAmount: number, periodMonths: number, initialRate: number, annualRateChange: number) {
  const years = Math.max(1, Math.ceil(periodMonths / 12));
  const principal = totalAmount / years;
  return Array.from({ length: years }, (_, index) => {
    const year = index + 1;
    const balance = Math.max(0, totalAmount - principal * index);
    const rate = initialRate * Math.pow(1 + annualRateChange, index);
    return { year, balance, rate, interest: balance * rate, principal };
  });
}

export function computeAmortization(rentalConfig: PricingRentalConfig, totalInvestment: number) {
  const investmentVat = totalInvestment * 0.1;
  const investmentTotalWithVat = totalInvestment + investmentVat;
  const stlAmount = investmentTotalWithVat * rentalConfig.stlPct;
  const ltlAmount = investmentTotalWithVat * (1 - rentalConfig.stlPct);
  const stlTable = buildAmortizationTable(stlAmount, rentalConfig.stlPeriodMonths, rentalConfig.stlRate, rentalConfig.stlRateChange);
  const ltlTable = buildAmortizationTable(ltlAmount, rentalConfig.ltlPeriodMonths, rentalConfig.ltlRate, rentalConfig.ltlRateChange);
  const totalStlInterest = stlTable.reduce((total, row) => total + row.interest, 0);
  const totalLtlInterest = ltlTable.reduce((total, row) => total + row.interest, 0);
  return {
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

export function computeMonthlySchedule(
  rentalConfig: PricingRentalConfig,
  operationConfig: PricingOperationConfig,
  pmCosts: number[],
  amortization: ReturnType<typeof computeAmortization>,
  totalInvestment: number,
) {
  const hoursPerMonth = operationConfig.dailyHours * operationConfig.workingDaysMonth;
  const kmPerMonth = operationConfig.movesPerDay * operationConfig.workingDaysMonth * operationConfig.kmPerMove;
  const fuelCostPerMonth = kmPerMonth * operationConfig.kwhPerKm * operationConfig.electricityPriceVnd;
  const driverCostPerMonth = operationConfig.driversPerUnit * operationConfig.driverSalaryVnd * (1 + operationConfig.insuranceRate);
  const monthlyDepreciation = totalInvestment / rentalConfig.depreciationMonths;
  const monthlyFinanceCost = amortization.totalFinanceInterest / rentalConfig.rentPeriodMonths;

  let accumulatedHours = 0;
  let accumulatedKm = 0;
  let totalFuelCost = 0;
  let totalMaintenanceCost = 0;
  let totalDriverCost = 0;
  let totalBaseCost = 0;

  const rows = [];

  for (let month = 0; month <= rentalConfig.rentPeriodMonths; month += 1) {
    const active = month > 0;
    const previousHours = accumulatedHours;
    const previousKm = accumulatedKm;
    if (active) {
      accumulatedHours += hoursPerMonth;
      accumulatedKm += kmPerMonth;
    }

    const triggers = operationConfig.pmIntervalsHours.map((interval) => (
      active ? Math.max(0, Math.floor(accumulatedHours / interval) - Math.floor(previousHours / interval)) : 0
    ));
    const maintenanceCost = triggers.reduce((total, count, index) => total + count * num(pmCosts[index], 0), 0);
    const fuelCost = active ? (accumulatedKm - previousKm) * operationConfig.kwhPerKm * operationConfig.electricityPriceVnd : 0;
    const driverCost = active ? driverCostPerMonth : 0;
    const totalOperatingCost = fuelCost + maintenanceCost + driverCost;
    const monthlyCostBeforeMargin = active ? monthlyDepreciation + monthlyFinanceCost + totalOperatingCost : 0;

    totalFuelCost += fuelCost;
    totalMaintenanceCost += maintenanceCost;
    totalDriverCost += driverCost;
    totalBaseCost += monthlyCostBeforeMargin;

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

  const baseMonthlyCost = totalBaseCost / Math.max(1, rentalConfig.rentPeriodMonths);
  const recommendedMonthlyRental = baseMonthlyCost * (1 + rentalConfig.expectedProfitPct + rentalConfig.contingencyPct);

  rows.forEach((row) => {
    row.recommendedRental = row.active ? recommendedMonthlyRental : 0;
  });

  return {
    rows,
    fuelCostPerMonth,
    driverCostPerMonth,
    monthlyDepreciation,
    monthlyFinanceCost,
    totalFuelCost,
    totalMaintenanceCost,
    totalDriverCost,
    recommendedMonthlyRental,
  };
}
