import {
  DEFAULT_OPERATION_CONFIG as KERNEL_DEFAULT_OPERATION_CONFIG,
  DEFAULT_PM_INTERVALS_HOURS,
  DEFAULT_RENTAL_CONFIG as KERNEL_DEFAULT_RENTAL_CONFIG,
  computeAmortization as computeKernelAmortization,
  computeMonthlySchedule as computeKernelMonthlySchedule,
  computePmLevelCosts as computeKernelPmLevelCosts,
  computeQuotationSummary as computeKernelQuotationSummary,
  derivePricingInvestment,
} from '../../../backend/src/shared-kernel/pricing.ts';

export { DEFAULT_PM_INTERVALS_HOURS };

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
  ...KERNEL_DEFAULT_RENTAL_CONFIG,
};

export const DEFAULT_OPERATION_CONFIG: PricingOperationConfig = {
  ...KERNEL_DEFAULT_OPERATION_CONFIG,
  pmIntervalsHours: [...KERNEL_DEFAULT_OPERATION_CONFIG.pmIntervalsHours],
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
  const normalized = normalizePricingDraft(draft);
  const { lineItems, maintenanceParts, operationConfig, rentalConfig, costEntries, varianceSummary, ...quotationInput } = normalized;
  return computeKernelQuotationSummary(quotationInput, lineItems);
}

export function deriveInvestment(summary: ReturnType<typeof computeQuotationSummary>, investmentQty: number) {
  return derivePricingInvestment(summary, investmentQty);
}

export function computePmLevelCosts(parts: PricingMaintenancePart[]) {
  return computeKernelPmLevelCosts(parts);
}

export function computeAmortization(rentalConfig: PricingRentalConfig, totalInvestment: number) {
  return computeKernelAmortization(rentalConfig, totalInvestment);
}

export function computeMonthlySchedule(
  rentalConfig: PricingRentalConfig,
  operationConfig: PricingOperationConfig,
  pmCosts: number[],
  amortization: ReturnType<typeof computeAmortization>,
  totalInvestment: number,
) {
  return computeKernelMonthlySchedule(rentalConfig, operationConfig, pmCosts, amortization, totalInvestment);
}
