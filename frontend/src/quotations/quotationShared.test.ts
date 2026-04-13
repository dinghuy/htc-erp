import { describe, expect, it } from 'vitest';

import {
  CURRENCIES,
  DELIVERY_PRESETS,
  PAYMENT_PRESETS,
  UNITS,
  VALID_STATUSES,
  VALIDITY_PRESETS,
  WARRANTY_PRESETS,
  allowedTransitions,
  createInitialQuotationTerms,
  createNewQuotationTerms,
  ensureArray,
  hasQbuStaleWarning,
  hasRateIncreaseWarning,
  hasSnapshotMissingWarning,
  isLegacyStatus,
  normalizeCommercialTerms,
  normalizeQuotationLineItems,
} from './quotationShared';

// ── Product / Line-Item normalisation ──────────────────────────────────────────

describe('normalizeQuotationLineItems – product data used in quotation export', () => {
  it('returns empty array for empty input', () => {
    expect(normalizeQuotationLineItems([])).toEqual([]);
  });

  it('fills default unit "Chiếc" when unit is missing', () => {
    const items = normalizeQuotationLineItems([{ name: 'Máy bơm' }]);
    expect(items[0].unit).toBe('Chiếc');
  });

  it('preserves explicit unit value from product catalog', () => {
    const items = normalizeQuotationLineItems([{ name: 'Cáp điện', unit: 'Kg' }]);
    expect(items[0].unit).toBe('Kg');
  });

  it('defaults quantity to 1 and unitPrice to 0 when absent', () => {
    const items = normalizeQuotationLineItems([{ sku: 'SKU-001' }]);
    expect(items[0].quantity).toBe(1);
    expect(items[0].unitPrice).toBe(0);
  });

  it('preserves product SKU, name, technicalSpecs and remarks', () => {
    const raw = {
      sku: 'EV-001',
      name: 'Electric Vehicle Charger',
      technicalSpecs: '22 kW, AC Type 2',
      remarks: 'CE certified',
      quantity: 5,
      unitPrice: 12000,
    };
    const [item] = normalizeQuotationLineItems([raw]);
    expect(item.sku).toBe('EV-001');
    expect(item.name).toBe('Electric Vehicle Charger');
    expect(item.technicalSpecs).toBe('22 kW, AC Type 2');
    expect(item.remarks).toBe('CE certified');
    expect(item.quantity).toBe(5);
    expect(item.unitPrice).toBe(12000);
  });

  it('normalises multiple line items preserving per-item fields', () => {
    const raw = [
      { sku: 'A', name: 'Item A', quantity: 2, unitPrice: 100 },
      { sku: 'B', name: 'Item B', quantity: 3, unitPrice: 200 },
    ];
    const items = normalizeQuotationLineItems(raw);
    expect(items).toHaveLength(2);
    expect(items[1].sku).toBe('B');
    expect(items[1].unitPrice).toBe(200);
  });

  it('falls back to defaults for null/undefined quantity and unitPrice', () => {
    // null/undefined are treated as absent – coercion guard (item != null) fires the fallback
    const items = normalizeQuotationLineItems([{ quantity: null, unitPrice: undefined }]);
    expect(items[0].quantity).toBe(1);
    expect(items[0].unitPrice).toBe(0);
  });

  it('falls back to defaults for non-numeric string quantity and unitPrice', () => {
    // After Phase 3: non-parseable strings now coerce to default instead of passing through
    const items = normalizeQuotationLineItems([{ quantity: 'abc', unitPrice: 'xyz' }]);
    expect(items[0].quantity).toBe(1);
    expect(items[0].unitPrice).toBe(0);
  });
});

// ── Customer / Contact fields in commercial terms ──────────────────────────────

describe('normalizeCommercialTerms – terms attached to customer quotation', () => {
  it('returns empty termItems and blank remarks when given null', () => {
    const result = normalizeCommercialTerms(null);
    expect(result.termItems).toEqual([]);
    expect(result.remarks).toBe('');
    expect(result.remarksEn).toBe('');
  });

  it('preserves explicit termItems with bilingual labels', () => {
    const input = {
      termItems: [
        { labelViPrint: 'Thanh toán', labelEn: 'Payment', textVi: '30% khi ký HĐ', textEn: '30% on signing' },
      ],
    };
    const result = normalizeCommercialTerms(input);
    expect(result.termItems).toHaveLength(1);
    expect(result.termItems[0].labelViPrint).toBe('Thanh toán');
    expect(result.termItems[0].textVi).toBe('30% khi ký HĐ');
    expect(result.termItems[0].textEn).toBe('30% on signing');
  });

  it('falls back to legacy scalar fields (payment, delivery, validity, warranty)', () => {
    const input = {
      payment: '100% khi ký HĐ',
      delivery: '3 tháng',
      validity: '30 ngày',
      warranty: '12 tháng',
    };
    const result = normalizeCommercialTerms(input);
    expect(result.termItems.length).toBeGreaterThan(0);
    const labels = result.termItems.map((t) => t.labelViPrint);
    expect(labels).toContain('Thanh toán');
    expect(labels).toContain('Giao hàng');
  });

  it('surfaces customer-visible remarks in both languages', () => {
    const input = {
      remarks: 'Giá đã bao gồm VAT',
      remarksEn: 'Price includes VAT',
    };
    const result = normalizeCommercialTerms(input);
    expect(result.remarks).toBe('Giá đã bao gồm VAT');
    expect(result.remarksEn).toBe('Price includes VAT');
  });
});

// ── Initial / new quotation term templates ─────────────────────────────────────

describe('createInitialQuotationTerms – default customer-facing terms', () => {
  it('contains 4 standard term items', () => {
    const terms = createInitialQuotationTerms();
    expect(terms.termItems).toHaveLength(4);
  });

  it('all 4 term items have bilingual labels', () => {
    const terms = createInitialQuotationTerms();
    for (const item of terms.termItems) {
      expect(item.labelViPrint).toBeTruthy();
      expect(item.labelEn).toBeTruthy();
    }
  });

  it('includes a non-empty default VAT remark for customers', () => {
    const terms = createInitialQuotationTerms();
    expect(terms.remarks).toContain('VAT');
    expect(terms.remarksEn).toContain('VAT');
  });
});

describe('createNewQuotationTerms – blank new quotation template', () => {
  it('contains 4 term items with bilingual labels', () => {
    const terms = createNewQuotationTerms();
    expect(terms.termItems).toHaveLength(4);
    for (const item of terms.termItems) {
      expect(item.labelViPrint).toBeTruthy();
      expect(item.labelEn).toBeTruthy();
    }
  });

  it('has blank remarks (no pre-filled customer text)', () => {
    const terms = createNewQuotationTerms();
    expect(terms.remarks).toBe('');
    expect(terms.remarksEn).toBe('');
  });
});

// ── Quotation status / lifecycle for customer-facing flow ──────────────────────

describe('allowedTransitions – quotation lifecycle toward customer', () => {
  it('draft can only move to sent', () => {
    expect(allowedTransitions('draft')).toEqual(['sent']);
  });

  it('sent can be accepted or rejected by customer', () => {
    const transitions = allowedTransitions('sent');
    expect(transitions).toContain('accepted');
    expect(transitions).toContain('rejected');
  });

  it('accepted/rejected/undefined have no further transitions', () => {
    expect(allowedTransitions('accepted')).toEqual([]);
    expect(allowedTransitions('rejected')).toEqual([]);
    expect(allowedTransitions(undefined)).toEqual([]);
  });
});

describe('isLegacyStatus', () => {
  it('flags missing or unrecognised statuses as legacy', () => {
    expect(isLegacyStatus(undefined)).toBe(true);
    expect(isLegacyStatus('')).toBe(true);
    expect(isLegacyStatus('in_review')).toBe(true);
  });

  it('accepts all canonical quotation statuses as non-legacy', () => {
    for (const s of VALID_STATUSES) {
      expect(isLegacyStatus(s)).toBe(false);
    }
  });
});

// ── Supplier / QBU rate warnings (affects quoted price to customer) ────────────

describe('hasRateIncreaseWarning – supplier exchange rate drift', () => {
  it('warns when latest rate is >= 2.5% above QBU base rate', () => {
    expect(hasRateIncreaseWarning(26000, 25000)).toBe(true); // 4% increase
  });

  it('does not warn when rate is within tolerance', () => {
    expect(hasRateIncreaseWarning(25000, 25000)).toBe(false);
    expect(hasRateIncreaseWarning(25200, 25000)).toBe(false); // 0.8% – below threshold
  });

  it('does not warn when latestRate is null', () => {
    expect(hasRateIncreaseWarning(null, 25000)).toBe(false);
  });
});

describe('hasQbuStaleWarning – supplier QBU outdated > 6 months', () => {
  it('returns false when qbuUpdatedAt is null', () => {
    expect(hasQbuStaleWarning(null)).toBe(false);
    expect(hasQbuStaleWarning(undefined)).toBe(false);
  });

  it('warns for QBU last updated more than 6 months ago', () => {
    const sevenMonthsAgo = new Date();
    sevenMonthsAgo.setMonth(sevenMonthsAgo.getMonth() - 7);
    expect(hasQbuStaleWarning(sevenMonthsAgo.toISOString())).toBe(true);
  });

  it('does not warn for QBU updated 2 months ago', () => {
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    expect(hasQbuStaleWarning(twoMonthsAgo.toISOString())).toBe(false);
  });
});

describe('hasSnapshotMissingWarning – supplier rate snapshot required for export', () => {
  it('returns false when qbuUpdatedAt is absent', () => {
    expect(hasSnapshotMissingWarning(null, 25000, '2026-01-01')).toBe(false);
  });

  it('warns when rate value or date is missing but qbu is set', () => {
    expect(hasSnapshotMissingWarning('2026-01-01', null, '2026-01-01')).toBe(true);
    expect(hasSnapshotMissingWarning('2026-01-01', 25000, null)).toBe(true);
  });

  it('does not warn when all fields are present', () => {
    expect(hasSnapshotMissingWarning('2026-01-01', 25000, '2026-01-01')).toBe(false);
  });
});

// ── Catalogue constants ────────────────────────────────────────────────────────

describe('product / quotation export catalogue constants', () => {
  it('UNITS includes standard Vietnamese trade units', () => {
    expect(UNITS).toContain('Chiếc');
    expect(UNITS).toContain('Bộ');
    expect(UNITS).toContain('Kg');
  });

  it('CURRENCIES includes VND and major foreign currencies', () => {
    expect(CURRENCIES).toContain('VND');
    expect(CURRENCIES).toContain('USD');
    expect(CURRENCIES).toContain('EUR');
  });

  it('PAYMENT_PRESETS contains at least one preset', () => {
    expect(PAYMENT_PRESETS.length).toBeGreaterThan(0);
  });

  it('DELIVERY_PRESETS contains at least one preset', () => {
    expect(DELIVERY_PRESETS.length).toBeGreaterThan(0);
  });

  it('VALIDITY_PRESETS contains at least one preset', () => {
    expect(VALIDITY_PRESETS.length).toBeGreaterThan(0);
  });

  it('WARRANTY_PRESETS contains at least one preset', () => {
    expect(WARRANTY_PRESETS.length).toBeGreaterThan(0);
  });
});

// ── ensureArray utility ────────────────────────────────────────────────────────

describe('ensureArray', () => {
  it('returns the value when already an array', () => {
    expect(ensureArray([1, 2])).toEqual([1, 2]);
  });

  it('wraps non-array values in an empty array', () => {
    expect(ensureArray(null)).toEqual([]);
    expect(ensureArray(undefined)).toEqual([]);
    expect(ensureArray('string')).toEqual([]);
    expect(ensureArray(42)).toEqual([]);
  });
});
