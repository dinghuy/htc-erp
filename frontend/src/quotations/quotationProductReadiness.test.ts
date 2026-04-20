import { describe, expect, it, vi } from 'vitest';

vi.mock('../config', () => ({ API_BASE: '/api' }));
vi.mock('../ui/tokens', () => ({
  tokens: {
    colors: {
      textSecondary: '#000000',
      primary: '#000000',
      border: '#000000',
    },
    spacing: {
      sm: '8px',
    },
  },
}));
vi.mock('../ui/styles', () => ({
  ui: {
    badge: { info: {}, success: {}, error: {}, neutral: {} },
    card: { base: {} },
    btn: { primary: {}, outline: {}, ghost: {} },
    table: { thSortable: {}, thStatic: {}, td: {} },
    input: { base: {} },
    form: { label: {} },
  },
}));

import { normalizeQuotationLineItems } from './quotationShared';

describe('normalizeQuotationLineItems product readiness regression', () => {
  it('applies stable defaults for sparse product rows used by quotation flow', () => {
    const items = normalizeQuotationLineItems([
      {
        id: 'line-1',
        name: 'Sparse product',
        unit: null,
        quantity: null,
        unitPrice: undefined,
      },
      {},
    ]);

    expect(items).toEqual([
      {
        id: 'line-1',
        sku: '',
        name: 'Sparse product',
        unit: 'Chiếc',
        technicalSpecs: '',
        remarks: '',
        quantity: 1,
        unitPrice: 0,
        sortOrder: null,
        isOption: false,
        currency: 'VND',
        vatMode: 'net',
        vatRate: 8,
      },
      {
        id: null,
        sku: '',
        name: '',
        unit: 'Chiếc',
        technicalSpecs: '',
        remarks: '',
        quantity: 1,
        unitPrice: 0,
        sortOrder: null,
        isOption: false,
        currency: 'VND',
        vatMode: 'net',
        vatRate: 8,
      },
    ]);
  });
});
