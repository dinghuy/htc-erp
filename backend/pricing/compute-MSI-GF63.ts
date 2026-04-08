export {
  DEFAULT_OPERATION_CONFIG,
  DEFAULT_PM_INTERVALS_HOURS,
  DEFAULT_RENTAL_CONFIG,
  computeAmortization,
  computeMonthlySchedule,
  computePmLevelCosts,
  computeQuotationSummary,
  derivePricingInvestment,
  normalizeOperationConfig,
  normalizeQuotationInput,
  normalizeRentalConfig,
} from '../src/shared-kernel/pricing';

export type {
  AmortizationResult,
  AmortizationRow,
  MonthlyScheduleResult,
  MonthlyScheduleRow,
  PricingLineItemComputed,
  PricingLineItemInput,
  PricingMaintenancePartInput,
  PricingOperationConfigInput,
  PricingQuotationInput,
  PricingRentalConfigInput,
  PricingSection,
  PricingSummary,
  TpcType,
} from '../src/shared-kernel/pricing';

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

function num(value: unknown, fallback = 0): number {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

export function computeVarianceSummary(
  lineItemsInput: Array<Pick<import('../src/shared-kernel/pricing').PricingLineItemInput, 'id' | 'description'>> = [],
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
      .filter((entry) => entry?.lineItemId === lineItemId && entry.entryType === 'ESTIMATE_APPROVED')
      .reduce((total, entry) => total + num(entry.amountVnd, 0), 0);
    const actualAmountVnd = (costEntriesInput || [])
      .filter((entry) => entry?.lineItemId === lineItemId && entry.entryType === 'ACTUAL')
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
    requiresSupplementalApproval: lines.some((line) => line.requiresSupplementalApproval),
  };
}
