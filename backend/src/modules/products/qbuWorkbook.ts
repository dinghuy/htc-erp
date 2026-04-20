import {
  computeQuotationSummary,
  normalizeQuotationInput,
  type PricingLineItemInput,
  type PricingSummary,
} from '../../../pricing/compute';

export type ProductQbuLineGroup = 'main' | 'freight' | 'import' | 'local' | 'other';
export type ProductQbuLineProvenance = 'suggested' | 'manual' | 'legacy';

export type ProductQbuWorkbookLine = {
  id: string;
  name: string;
  group: ProductQbuLineGroup;
  amount: number;
  currency: string;
  provenance: ProductQbuLineProvenance;
  legacyField?: 'exWorks' | 'shipping' | 'importTax' | 'customFees' | 'other';
  note?: string;
};

export type ProductQbuFinancialDefaults = {
  vatRate: number;
  discountRate: number;
  citRate: number;
  tpcType: 'Net' | 'Gross' | null;
  tpcRate: number;
  buyFxRate: number;
  sellFxRate: number;
  loanInterestDays: number;
  loanInterestRate: number;
};

export type ProductQbuWorkbook = {
  version: 2;
  incoterm: string;
  basisCurrency: string;
  lines: ProductQbuWorkbookLine[];
  financialDefaults: ProductQbuFinancialDefaults;
  exWorks: number;
  shipping: number;
  importTax: number;
  customFees: number;
  other: number;
  totalAmount: number;
  rateSnapshot?: unknown;
};

const DEFAULT_PRODUCT_QBU_INCOTERM = 'EXW';
const DEFAULT_PRODUCT_QBU_CURRENCY = 'USD';

function num(value: unknown, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function normalizeIncoterm(value: unknown) {
  const normalized = String(value ?? '').trim().toUpperCase();
  return normalized || DEFAULT_PRODUCT_QBU_INCOTERM;
}

function normalizeCurrency(value: unknown) {
  const normalized = String(value ?? '').trim().toUpperCase();
  return normalized || DEFAULT_PRODUCT_QBU_CURRENCY;
}

function lineId(prefix: string, index: number) {
  return `${prefix}-${index + 1}`;
}

export function createSuggestedWorkbookLines(incotermInput: unknown, currencyInput: unknown): ProductQbuWorkbookLine[] {
  const incoterm = normalizeIncoterm(incotermInput);
  const currency = normalizeCurrency(currencyInput);
  const baseLines: Array<Pick<ProductQbuWorkbookLine, 'name' | 'group' | 'legacyField'>> = [
    { name: incoterm === 'CIF' ? 'Giá CIF' : incoterm === 'FOB' ? 'Giá FOB' : 'Giá Ex-works', group: 'main', legacyField: 'exWorks' },
  ];

  if (incoterm !== 'CIF') {
    baseLines.push({ name: 'Phí vận tải', group: 'freight', legacyField: 'shipping' });
  }
  if (incoterm !== 'DDP') {
    baseLines.push({ name: 'Thuế nhập khẩu', group: 'import', legacyField: 'importTax' });
    baseLines.push({ name: 'Phí HQ / bảo lãnh', group: 'local', legacyField: 'customFees' });
  }
  baseLines.push({ name: 'Chi phí khác', group: 'other', legacyField: 'other' });

  return baseLines.map((line, index) => ({
    id: lineId(`seed-${incoterm.toLowerCase()}`, index),
    name: line.name,
    group: line.group,
    amount: 0,
    currency,
    provenance: 'suggested',
    legacyField: line.legacyField,
  }));
}

function createLegacyWorkbookLines(raw: Record<string, unknown>, currency: string): ProductQbuWorkbookLine[] {
  return [
    { id: 'legacy-exworks', name: 'Giá Ex-works', group: 'main', amount: num(raw.exWorks, 0), currency, provenance: 'legacy', legacyField: 'exWorks' },
    { id: 'legacy-shipping', name: 'Phí vận tải', group: 'freight', amount: num(raw.shipping, 0), currency, provenance: 'legacy', legacyField: 'shipping' },
    { id: 'legacy-import-tax', name: 'Thuế nhập khẩu', group: 'import', amount: num(raw.importTax, 0), currency, provenance: 'legacy', legacyField: 'importTax' },
    { id: 'legacy-custom-fees', name: 'Phí HQ / bảo lãnh', group: 'local', amount: num(raw.customFees, 0), currency, provenance: 'legacy', legacyField: 'customFees' },
    { id: 'legacy-other', name: 'Chi phí khác', group: 'other', amount: num(raw.other, 0), currency, provenance: 'legacy', legacyField: 'other' },
  ];
}

function normalizeWorkbookLines(rawLines: unknown, basisCurrency: string, incoterm: string): ProductQbuWorkbookLine[] {
  if (!Array.isArray(rawLines)) {
    return createSuggestedWorkbookLines(incoterm, basisCurrency);
  }

  const lines = rawLines.map((line: any, index: number) => {
    const normalizedGroup = ['main', 'freight', 'import', 'local', 'other'].includes(String(line?.group ?? ''))
      ? String(line.group)
      : 'other';
    const normalizedCurrency = normalizeCurrency(line?.currency ?? basisCurrency);
    return {
      id: String(line?.id ?? lineId('line', index)),
      name: String(line?.name ?? line?.label ?? `Chi phí ${index + 1}`).trim() || `Chi phí ${index + 1}`,
      group: normalizedGroup as ProductQbuLineGroup,
      amount: Math.max(0, num(line?.amount, 0)),
      currency: normalizedCurrency,
      provenance: line?.provenance === 'suggested' || line?.provenance === 'legacy' ? line.provenance : 'manual',
      legacyField: ['exWorks', 'shipping', 'importTax', 'customFees', 'other'].includes(String(line?.legacyField ?? ''))
        ? line.legacyField
        : undefined,
      note: typeof line?.note === 'string' && line.note.trim() ? line.note.trim() : undefined,
    };
  });

  return lines.length ? lines : createSuggestedWorkbookLines(incoterm, basisCurrency);
}

function deriveLegacyTotals(lines: ProductQbuWorkbookLine[]) {
  const totals = {
    exWorks: 0,
    shipping: 0,
    importTax: 0,
    customFees: 0,
    other: 0,
  };

  lines.forEach((line) => {
    const amount = Math.max(0, num(line.amount, 0));
    if (line.legacyField && Object.prototype.hasOwnProperty.call(totals, line.legacyField)) {
      totals[line.legacyField] += amount;
      return;
    }
    if (line.group === 'main') totals.exWorks += amount;
    else if (line.group === 'freight') totals.shipping += amount;
    else if (line.group === 'import') totals.importTax += amount;
    else if (line.group === 'local') totals.customFees += amount;
    else totals.other += amount;
  });

  return totals;
}

function normalizeFinancialDefaults(raw: Record<string, unknown>) {
  const quotationDefaults = normalizeQuotationInput({});
  const incoming = raw.financialDefaults && typeof raw.financialDefaults === 'object' && !Array.isArray(raw.financialDefaults)
    ? raw.financialDefaults as Record<string, unknown>
    : raw;

  return {
    vatRate: num(incoming.vatRate, quotationDefaults.vatRate),
    discountRate: num(incoming.discountRate, quotationDefaults.discountRate),
    citRate: num(incoming.citRate, quotationDefaults.citRate),
    tpcType: incoming.tpcType === 'Net' || incoming.tpcType === 'Gross' ? incoming.tpcType : quotationDefaults.tpcType,
    tpcRate: num(incoming.tpcRate, quotationDefaults.tpcRate),
    buyFxRate: num(incoming.buyFxRate, quotationDefaults.buyFxRate),
    sellFxRate: num(incoming.sellFxRate, quotationDefaults.sellFxRate),
    loanInterestDays: num(incoming.loanInterestDays, quotationDefaults.loanInterestDays),
    loanInterestRate: num(incoming.loanInterestRate, quotationDefaults.loanInterestRate),
  } satisfies ProductQbuFinancialDefaults;
}

export function normalizeProductQbuData(raw: unknown): ProductQbuWorkbook {
  const parsed = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const hasAnyQbuSignal = Array.isArray(parsed.lines)
    || ['incoterm', 'basisCurrency', 'currency', 'financialDefaults', 'rateSnapshot', 'exWorks', 'shipping', 'importTax', 'customFees', 'other']
      .some((key) => Object.prototype.hasOwnProperty.call(parsed, key));
  const incoterm = normalizeIncoterm(parsed.incoterm);
  const basisCurrency = normalizeCurrency(parsed.basisCurrency ?? parsed.currency);
  const lines = !hasAnyQbuSignal
    ? []
    : Array.isArray(parsed.lines)
      ? normalizeWorkbookLines(parsed.lines, basisCurrency, incoterm)
      : createLegacyWorkbookLines(parsed, basisCurrency);
  const totals = deriveLegacyTotals(lines);

  return {
    version: 2,
    incoterm,
    basisCurrency,
    lines,
    financialDefaults: normalizeFinancialDefaults(parsed),
    exWorks: totals.exWorks,
    shipping: totals.shipping,
    importTax: totals.importTax,
    customFees: totals.customFees,
    other: totals.other,
    totalAmount: totals.exWorks + totals.shipping + totals.importTax + totals.customFees + totals.other,
    rateSnapshot: parsed.rateSnapshot ?? null,
  };
}

function convertSellPriceToVnd(basePrice: unknown, currency: unknown, sellFxRate: number) {
  const price = Math.max(0, num(basePrice, 0));
  const normalizedCurrency = normalizeCurrency(currency);
  if (normalizedCurrency === 'VND') return price;
  return price * sellFxRate;
}

function mapWorkbookLinesToPricingLines(lines: ProductQbuWorkbookLine[]): PricingLineItemInput[] {
  return lines.map((line, index) => {
    const section = line.group === 'main' ? 'A_MAIN' : line.group === 'other' ? 'C_OTHER' : 'B_AUXILIARY';
    const isUsd = normalizeCurrency(line.currency) === 'USD';
    return {
      id: line.id,
      section,
      description: line.name,
      quantityLabel: 'gói',
      unitCount: 1,
      sellUnitPriceVnd: 0,
      buyUnitPriceVnd: isUsd ? null : line.amount,
      buyUnitPriceUsd: isUsd ? line.amount : null,
      costRoutingType: line.group === 'other' ? 'OTHER_COST' : 'IMPORT_COST',
    } satisfies PricingLineItemInput;
  });
}

export function buildProductQbuFinancialPreview(input: {
  qbuData: unknown;
  basePrice: unknown;
  currency: unknown;
}): { normalizedQbuData: ProductQbuWorkbook; preview: PricingSummary } {
  const normalizedQbuData = normalizeProductQbuData(input.qbuData);
  const pricingLines = mapWorkbookLinesToPricingLines(normalizedQbuData.lines);
  const sellUnitPriceVnd = convertSellPriceToVnd(
    input.basePrice,
    input.currency,
    normalizedQbuData.financialDefaults.sellFxRate,
  );

  const hasMainLine = pricingLines.some((line) => line.section === 'A_MAIN');
  if (hasMainLine) {
    const firstMainLine = pricingLines.find((line) => line.section === 'A_MAIN');
    if (firstMainLine) {
      firstMainLine.sellUnitPriceVnd = sellUnitPriceVnd;
    }
  } else {
    pricingLines.unshift({
      id: 'synthetic-main-sell-line',
      section: 'A_MAIN',
      description: 'Giá bán tham chiếu',
      quantityLabel: 'gói',
      unitCount: 1,
      sellUnitPriceVnd,
      buyUnitPriceVnd: 0,
      buyUnitPriceUsd: null,
      costRoutingType: null,
    });
  }

  return {
    normalizedQbuData,
    preview: computeQuotationSummary(normalizedQbuData.financialDefaults, pricingLines),
  };
}
