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
  rateSnapshot?: { source: string; date: string; rate: number } | null;
};

export type ProductQbuPreviewSummary = {
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
};

const DEFAULT_PRODUCT_QBU_INCOTERM = 'EXW';
const DEFAULT_PRODUCT_QBU_CURRENCY = 'USD';

export const PRODUCT_QBU_GROUP_LABELS: Record<ProductQbuLineGroup, string> = {
  main: 'Commercial / Main',
  freight: 'Freight',
  import: 'Import / Tax',
  local: 'Local / On-top',
  other: 'Other',
};

function num(value: unknown, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

export function normalizeIncoterm(value: unknown) {
  const normalized = String(value ?? '').trim().toUpperCase();
  return normalized || DEFAULT_PRODUCT_QBU_INCOTERM;
}

export function normalizeCurrency(value: unknown) {
  const normalized = String(value ?? '').trim().toUpperCase();
  return normalized || DEFAULT_PRODUCT_QBU_CURRENCY;
}

function lineId(prefix: string, index: number) {
  return `${prefix}-${index + 1}`;
}

export function createSuggestedWorkbookLines(incotermInput: unknown, currencyInput: unknown): ProductQbuWorkbookLine[] {
  const incoterm = normalizeIncoterm(incotermInput);
  const currency = normalizeCurrency(currencyInput);
  const lines: Array<Pick<ProductQbuWorkbookLine, 'name' | 'group' | 'legacyField'>> = [
    { name: incoterm === 'CIF' ? 'Giá CIF' : incoterm === 'FOB' ? 'Giá FOB' : 'Giá Ex-works', group: 'main', legacyField: 'exWorks' },
  ];

  if (incoterm !== 'CIF') {
    lines.push({ name: 'Phí vận tải', group: 'freight', legacyField: 'shipping' });
  }
  if (incoterm !== 'DDP') {
    lines.push({ name: 'Thuế nhập khẩu', group: 'import', legacyField: 'importTax' });
    lines.push({ name: 'Phí HQ / bảo lãnh', group: 'local', legacyField: 'customFees' });
  }
  lines.push({ name: 'Chi phí khác', group: 'other', legacyField: 'other' });

  return lines.map((line, index) => ({
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

function normalizeLines(rawLines: unknown, basisCurrency: string, incoterm: string): ProductQbuWorkbookLine[] {
  if (!Array.isArray(rawLines)) {
    return createSuggestedWorkbookLines(incoterm, basisCurrency);
  }

  const normalized = rawLines.map((line: any, index) => ({
    id: String(line?.id ?? lineId('line', index)),
    name: String(line?.name ?? line?.label ?? `Chi phí ${index + 1}`).trim() || `Chi phí ${index + 1}`,
    group: (['main', 'freight', 'import', 'local', 'other'].includes(String(line?.group ?? '')) ? line.group : 'other') as ProductQbuLineGroup,
    amount: Math.max(0, num(line?.amount, 0)),
    currency: normalizeCurrency(line?.currency ?? basisCurrency),
    provenance: line?.provenance === 'suggested' || line?.provenance === 'legacy' ? line.provenance : 'manual',
    legacyField: ['exWorks', 'shipping', 'importTax', 'customFees', 'other'].includes(String(line?.legacyField ?? ''))
      ? line.legacyField
      : undefined,
    note: typeof line?.note === 'string' && line.note.trim() ? line.note.trim() : undefined,
  }));

  return normalized.length ? normalized : createSuggestedWorkbookLines(incoterm, basisCurrency);
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
  const incoming = raw.financialDefaults && typeof raw.financialDefaults === 'object' && !Array.isArray(raw.financialDefaults)
    ? raw.financialDefaults as Record<string, unknown>
    : raw;

  return {
    vatRate: num(incoming.vatRate, 0.08),
    discountRate: num(incoming.discountRate, 0),
    citRate: num(incoming.citRate, 0.2),
    tpcType: incoming.tpcType === 'Net' || incoming.tpcType === 'Gross' ? incoming.tpcType : null,
    tpcRate: num(incoming.tpcRate, 0),
    buyFxRate: num(incoming.buyFxRate, 26300),
    sellFxRate: num(incoming.sellFxRate, 25500),
    loanInterestDays: num(incoming.loanInterestDays, 240),
    loanInterestRate: num(incoming.loanInterestRate, 0.08),
  } satisfies ProductQbuFinancialDefaults;
}

export function normalizeProductQbuWorkbook(raw: unknown): ProductQbuWorkbook {
  const parsed = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const hasAnyQbuSignal = Array.isArray(parsed.lines)
    || ['incoterm', 'basisCurrency', 'currency', 'financialDefaults', 'rateSnapshot', 'exWorks', 'shipping', 'importTax', 'customFees', 'other']
      .some((key) => Object.prototype.hasOwnProperty.call(parsed, key));
  const incoterm = normalizeIncoterm(parsed.incoterm);
  const basisCurrency = normalizeCurrency(parsed.basisCurrency ?? parsed.currency);
  const lines = !hasAnyQbuSignal
    ? []
    : Array.isArray(parsed.lines)
      ? normalizeLines(parsed.lines, basisCurrency, incoterm)
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
    rateSnapshot: parsed.rateSnapshot && typeof parsed.rateSnapshot === 'object' ? parsed.rateSnapshot as any : null,
  };
}

export function createEmptyWorkbookDraft() {
  return normalizeProductQbuWorkbook({});
}

export function buildGroupedWorkbookLines(lines: ProductQbuWorkbookLine[]) {
  return (['main', 'freight', 'import', 'local', 'other'] as ProductQbuLineGroup[]).map((group) => ({
    group,
    label: PRODUCT_QBU_GROUP_LABELS[group],
    items: lines.filter((line) => line.group === group),
    subtotal: lines.filter((line) => line.group === group).reduce((total, line) => total + Math.max(0, num(line.amount, 0)), 0),
  }));
}
