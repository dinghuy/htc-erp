require('ts-node/register');

const assert = require('node:assert/strict');

const {
  normalizeQuotationLineItems,
  normalizeQuotationFinancialConfig,
  normalizeQuotationCommercialTerms,
  buildTypedQuotationStateFromBody,
  buildPdfTermsFromCommercialTerms,
  DEFAULT_QUOTATION_FINANCIAL_CONFIG,
  parseLegacyQuotationLineItems,
  parseLegacyQuotationFinancialConfig,
  parseLegacyQuotationCommercialTerms,
} = require('../src/modules/quotations/typedState.ts');

let failures = 0;

async function run(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}

async function main() {
  // ── Product / Line-Item normalisation ────────────────────────────────────────

  await run('normalizeQuotationLineItems – empty array', async () => {
    assert.deepEqual(normalizeQuotationLineItems([]), []);
  });

  await run('normalizeQuotationLineItems – defaults unit to Chiếc', async () => {
    const items = normalizeQuotationLineItems([{ name: 'Máy bơm' }]);
    assert.equal(items[0].unit, 'Chiếc');
  });

  await run('normalizeQuotationLineItems – preserves product SKU, name, specs, remarks', async () => {
    const items = normalizeQuotationLineItems([{
      sku: 'EV-001',
      name: 'Electric Charger',
      technicalSpecs: '22 kW',
      remarks: 'CE certified',
      quantity: 3,
      unitPrice: 15000,
      unit: 'Chiếc',
      currency: 'USD',
      vatMode: 'included',
      vatRate: 10,
    }]);
    assert.equal(items[0].sku, 'EV-001');
    assert.equal(items[0].name, 'Electric Charger');
    assert.equal(items[0].technicalSpecs, '22 kW');
    assert.equal(items[0].remarks, 'CE certified');
    assert.equal(items[0].quantity, 3);
    assert.equal(items[0].unitPrice, 15000);
    assert.equal(items[0].isOption, false);
    assert.equal(items[0].currency, 'USD');
    assert.equal(items[0].vatMode, 'included');
    assert.equal(items[0].vatRate, 10);
  });

  await run('normalizeQuotationLineItems – defaults quantity=1 and unitPrice=0', async () => {
    const items = normalizeQuotationLineItems([{ sku: 'SKU-A' }]);
    assert.equal(items[0].quantity, 1);
    assert.equal(items[0].unitPrice, 0);
    assert.equal(items[0].currency, 'VND');
    assert.equal(items[0].vatMode, 'excluded');
    assert.equal(items[0].vatRate, DEFAULT_QUOTATION_FINANCIAL_CONFIG.vatRate);
  });

  await run('normalizeQuotationLineItems – handles non-numeric values gracefully', async () => {
    const items = normalizeQuotationLineItems([{ quantity: 'bad', unitPrice: 'bad' }]);
    assert.equal(items[0].quantity, 1);
    assert.equal(items[0].unitPrice, 0);
  });

  await run('normalizeQuotationLineItems – assigns sortOrder from index when missing', async () => {
    const items = normalizeQuotationLineItems([
      { name: 'A' },
      { name: 'B' },
    ]);
    assert.equal(items[0].sortOrder, 0);
    assert.equal(items[1].sortOrder, 1);
  });

  await run('normalizeQuotationLineItems – normalizes optional-offer flag', async () => {
    const items = normalizeQuotationLineItems([{ sku: 'OPT-1', isOption: true }]);
    assert.equal(items[0].isOption, true);
  });

  await run('normalizeQuotationLineItems – parses JSON string input', async () => {
    const raw = JSON.stringify([{ sku: 'JSON-SKU', name: 'From JSON', quantity: 2, unitPrice: 500 }]);
    const items = normalizeQuotationLineItems(raw);
    assert.equal(items[0].sku, 'JSON-SKU');
    assert.equal(items[0].quantity, 2);
  });

  await run('normalizeQuotationLineItems – null produces empty array', async () => {
    assert.deepEqual(normalizeQuotationLineItems(null), []);
  });

  // ── Financial config (supplier QBU / rate applied to quotation) ──────────────

  await run('normalizeQuotationFinancialConfig – uses defaults for null input', async () => {
    const config = normalizeQuotationFinancialConfig(null);
    assert.equal(config.exchangeRate, DEFAULT_QUOTATION_FINANCIAL_CONFIG.exchangeRate);
    assert.equal(config.vatRate, DEFAULT_QUOTATION_FINANCIAL_CONFIG.vatRate);
    assert.equal(config.markup, DEFAULT_QUOTATION_FINANCIAL_CONFIG.markup);
    assert.equal(config.calculateTotals, DEFAULT_QUOTATION_FINANCIAL_CONFIG.calculateTotals);
  });

  await run('normalizeQuotationFinancialConfig – overrides individual fields', async () => {
    const config = normalizeQuotationFinancialConfig({ exchangeRate: 26000, vatRate: 10, calculateTotals: false });
    assert.equal(config.exchangeRate, 26000);
    assert.equal(config.vatRate, 10);
    assert.equal(config.calculateTotals, false);
    assert.equal(config.markup, DEFAULT_QUOTATION_FINANCIAL_CONFIG.markup); // fallback
  });

  await run('normalizeQuotationFinancialConfig – parses JSON string', async () => {
    const raw = JSON.stringify({ exchangeRate: 27000 });
    const config = normalizeQuotationFinancialConfig(raw);
    assert.equal(config.exchangeRate, 27000);
  });

  // ── Commercial terms (customer-facing terms on exported quotation) ──────────

  await run('normalizeQuotationCommercialTerms – empty input returns blank terms', async () => {
    const terms = normalizeQuotationCommercialTerms(null);
    assert.equal(terms.remarksVi, null);
    assert.equal(terms.remarksEn, null);
    assert.deepEqual(terms.termItems, []);
  });

  await run('normalizeQuotationCommercialTerms – preserves explicit termItems', async () => {
    const input = {
      termItems: [
        { id: 't1', labelViPrint: 'Thanh toán', labelEn: 'Payment', textVi: '30%', textEn: '30%', sortOrder: 0 },
      ],
    };
    const terms = normalizeQuotationCommercialTerms(input);
    assert.equal(terms.termItems.length, 1);
    assert.equal(terms.termItems[0].labelViPrint, 'Thanh toán');
    assert.equal(terms.termItems[0].textVi, '30%');
  });

  await run('normalizeQuotationCommercialTerms – falls back to legacy scalar fields', async () => {
    const input = {
      payment: '30% khi ký HĐ',
      delivery: '4 tháng',
      validity: '30 ngày',
      warranty: '12 tháng',
    };
    const terms = normalizeQuotationCommercialTerms(input);
    assert.ok(terms.termItems.length >= 4);
    const labels = terms.termItems.map((t) => t.labelViPrint);
    assert.ok(labels.includes('Thanh toán'));
    assert.ok(labels.includes('Giao hàng'));
    assert.ok(labels.includes('Hiệu lực'));
    assert.ok(labels.includes('Bảo hành'));
  });

  await run('normalizeQuotationCommercialTerms – surfaces customer remarks', async () => {
    const input = { remarksVi: 'Giá bao gồm VAT', remarksEn: 'Price incl. VAT' };
    const terms = normalizeQuotationCommercialTerms(input);
    assert.equal(terms.remarksVi, 'Giá bao gồm VAT');
    assert.equal(terms.remarksEn, 'Price incl. VAT');
  });

  await run('normalizeQuotationCommercialTerms – legacy "remarks" field maps to remarksVi', async () => {
    const input = { remarks: 'Legacy VAT remark' };
    const terms = normalizeQuotationCommercialTerms(input);
    assert.equal(terms.remarksVi, 'Legacy VAT remark');
  });

  await run('normalizeQuotationCommercialTerms – parses JSON string input', async () => {
    const raw = JSON.stringify({ remarksVi: 'JSON remark' });
    const terms = normalizeQuotationCommercialTerms(raw);
    assert.equal(terms.remarksVi, 'JSON remark');
  });

  // ── buildPdfTermsFromCommercialTerms (PDF export contract) ──────────────────

  await run('buildPdfTermsFromCommercialTerms – maps term items to PDF fields', async () => {
    const commercialTerms = {
      remarksVi: 'Ghi chú',
      remarksEn: 'Notes',
      termItems: [
        { id: 't1', sortOrder: 0, labelViPrint: 'Hiệu lực', labelEn: 'Validity', textVi: '30 ngày', textEn: '30 days' },
        { id: 't2', sortOrder: 1, labelViPrint: 'Thanh toán', labelEn: 'Payment', textVi: '30% khi ký', textEn: '30% on signing' },
        { id: 't3', sortOrder: 2, labelViPrint: 'Giao hàng', labelEn: 'Delivery', textVi: '4 tháng', textEn: '4 months' },
        { id: 't4', sortOrder: 3, labelViPrint: 'Bảo hành', labelEn: 'Warranty', textVi: '12 tháng', textEn: '12 months' },
      ],
    };
    const pdf = buildPdfTermsFromCommercialTerms(commercialTerms);
    assert.equal(pdf.validity, '30 ngày');
    assert.equal(pdf.validityEn, '30 days');
    assert.equal(pdf.payment, '30% khi ký');
    assert.equal(pdf.paymentEn, '30% on signing');
    assert.equal(pdf.delivery, '4 tháng');
    assert.equal(pdf.warranty, '12 tháng');
    assert.equal(pdf.remarks, 'Ghi chú');
    assert.equal(pdf.remarksEn, 'Notes');
  });

  await run('buildPdfTermsFromCommercialTerms – uses fallback text when term is absent', async () => {
    const pdf = buildPdfTermsFromCommercialTerms({ remarksVi: null, remarksEn: null, termItems: [] });
    assert.ok(pdf.validity.length > 0);
    assert.ok(pdf.payment.length > 0);
    assert.ok(pdf.delivery.length > 0);
    assert.ok(pdf.warranty.length > 0);
  });

  // ── buildTypedQuotationStateFromBody (combined state for create/update) ──────

  await run('buildTypedQuotationStateFromBody – builds all three typed sub-states', async () => {
    const body = {
      lineItems: [{ sku: 'P1', name: 'Product 1', quantity: 2.5, unitPrice: 500, currency: 'USD', vatMode: 'included' }],
      financialConfig: { exchangeRate: 26500, vatRate: 10 },
      commercialTerms: { remarksVi: 'VAT note' },
    };
    const state = buildTypedQuotationStateFromBody(body);
    assert.equal(state.lineItems[0].sku, 'P1');
    assert.equal(state.lineItems[0].quantity, 2.5);
    assert.equal(state.lineItems[0].currency, 'USD');
    assert.equal(state.lineItems[0].vatMode, 'included');
    assert.equal(state.lineItems[0].vatRate, 10);
    assert.equal(state.financialConfig.exchangeRate, 26500);
    assert.equal(state.commercialTerms.remarksVi, 'VAT note');
  });

  await run('buildTypedQuotationStateFromBody – handles empty body', async () => {
    const state = buildTypedQuotationStateFromBody({});
    assert.deepEqual(state.lineItems, []);
    assert.equal(state.financialConfig.exchangeRate, DEFAULT_QUOTATION_FINANCIAL_CONFIG.exchangeRate);
    assert.equal(state.commercialTerms.remarksVi, null);
  });

  // ── parseLegacy* – alias functions used for backward compatibility ──────────

  await run('parseLegacyQuotationLineItems – delegates to normalizeQuotationLineItems', async () => {
    const items = parseLegacyQuotationLineItems([{ name: 'Legacy item', unitPrice: 100 }]);
    assert.equal(items[0].name, 'Legacy item');
    assert.equal(items[0].unitPrice, 100);
  });

  await run('parseLegacyQuotationFinancialConfig – delegates to normalizeQuotationFinancialConfig', async () => {
    const config = parseLegacyQuotationFinancialConfig({ markup: 20 });
    assert.equal(config.markup, 20);
  });

  await run('parseLegacyQuotationCommercialTerms – delegates to normalizeQuotationCommercialTerms', async () => {
    const terms = parseLegacyQuotationCommercialTerms({ remarksVi: 'Legacy remark' });
    assert.equal(terms.remarksVi, 'Legacy remark');
  });

  if (failures > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  failures += 1;
  console.error(error);
  process.exitCode = 1;
});
