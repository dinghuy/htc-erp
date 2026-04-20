require('ts-node/register');

const assert = require('node:assert/strict');

const {
  validateCreateProjectQuotationRequest,
  validateCreateQuotationRequest,
  validateCreateStandaloneQuotationRequest,
  validateReviseQuotationRequest,
  validateUpdateQuotationRequest,
} = require('../src/modules/quotations/validators.ts');
const {
  mapProjectQuotationInput,
  mapStandaloneQuotationInput,
  mapUpdateQuotationInput,
  mapReviseQuotationInput,
} = require('../src/modules/quotations/mapper.ts');
const {
  parseCreateProjectQuotationBody,
} = require('../src/modules/quotations/schemas/createProjectQuotationSchema.ts');
const {
  parseCreateStandaloneQuotationBody,
} = require('../src/modules/quotations/schemas/createStandaloneQuotationSchema.ts');
const {
  parseUpdateQuotationBody,
} = require('../src/modules/quotations/schemas/updateQuotationSchema.ts');
const {
  parseReviseQuotationBody,
} = require('../src/modules/quotations/schemas/reviseQuotationSchema.ts');

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
  await run('validator rejects unsupported create status', async () => {
    const result = validateCreateQuotationRequest({ status: 'in_review' });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'INVALID_STATUS_TRANSITION');
    assert.deepEqual(result.allowed, [
      'draft',
      'submitted_for_approval',
      'revision_required',
      'approved',
      'rejected',
      'won',
      'lost',
      'sent',
      'accepted',
      'expired',
    ]);
  });

  await run('validator accepts empty body and defaults downstream', async () => {
    const result = validateCreateQuotationRequest({});
    assert.equal(result.ok, true);
  });

  await run('project-create validator rejects unsupported status', async () => {
    const result = validateCreateProjectQuotationRequest({ status: 'invalid-status' });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'INVALID_STATUS_TRANSITION');
  });

  await run('create-project schema rejects non-object body', async () => {
    const parsed = parseCreateProjectQuotationBody('invalid');
    assert.equal(parsed.ok, false);
    assert.equal(parsed.httpStatus, 400);
    assert.equal(parsed.payload.code, 'INVALID_REQUEST_BODY');
  });

  await run('create-standalone schema normalizes null body to empty object', async () => {
    const parsed = parseCreateStandaloneQuotationBody(null);
    assert.equal(parsed.ok, true);
    assert.deepEqual(parsed.normalizedBody, {});
  });

  await run('update schema rejects array body', async () => {
    const parsed = parseUpdateQuotationBody([]);
    assert.equal(parsed.ok, false);
    assert.equal(parsed.httpStatus, 400);
  });

  await run('revise schema accepts object body', async () => {
    const parsed = parseReviseQuotationBody({ quoteNumber: 'Q-1' });
    assert.equal(parsed.ok, true);
    assert.deepEqual(parsed.normalizedBody, { quoteNumber: 'Q-1' });
  });

  await run('standalone-create validator accepts valid status', async () => {
    const result = validateCreateStandaloneQuotationRequest({ status: 'sent' });
    assert.equal(result.ok, true);
  });

  await run('mapper normalizes status and totals for standalone create', async () => {
    const mapped = mapStandaloneQuotationInput({
      quoteNumber: 'Q-2026-001',
      status: '',
      subtotal: '1000',
      taxTotal: '80',
      grandTotal: null,
      accountId: 'acc-1',
    });

    assert.equal(mapped.finalStatus, 'draft');
    assert.equal(mapped.normalizedSubtotal, 1000);
    assert.equal(mapped.normalizedTaxTotal, 80);
    assert.equal(mapped.normalizedGrandTotal, 0);
    assert.equal(mapped.projectId, null);
    assert.equal(mapped.accountId, 'acc-1');
  });

  await run('mapper keeps explicit project id and status', async () => {
    const mapped = mapStandaloneQuotationInput({
      projectId: '  project-123  ',
      status: 'sent',
      subtotal: 10,
      taxTotal: 1,
      grandTotal: 11,
    });

    assert.equal(mapped.projectId, 'project-123');
    assert.equal(mapped.finalStatus, 'submitted_for_approval');
  });

  await run('project mapper normalizes payload with project-bound account fallback', async () => {
    const mapped = mapProjectQuotationInput({
      body: {
        quoteNumber: 'Q-PROJ-01',
        status: '',
        subtotal: '500',
        taxTotal: '40',
        grandTotal: '540',
      },
      projectId: 'project-1',
      projectAccountId: 'acc-from-project',
    });

    assert.equal(mapped.projectId, 'project-1');
    assert.equal(mapped.accountId, 'acc-from-project');
    assert.equal(mapped.finalStatus, 'draft');
    assert.equal(mapped.normalizedSubtotal, 500);
    assert.equal(mapped.normalizedTaxTotal, 40);
    assert.equal(mapped.normalizedGrandTotal, 540);
  });

  await run('update validator reports status conflict from expectedStatus', async () => {
    const validation = validateUpdateQuotationRequest({
      currentStatus: 'sent',
      body: { status: 'accepted', expectedStatus: 'draft' },
    });
    assert.equal(validation.ok, false);
    assert.equal(validation.httpStatus, 409);
    assert.equal(validation.payload.code, 'STATUS_CONFLICT');
  });

  await run('update validator keeps current status when body has no status', async () => {
    const validation = validateUpdateQuotationRequest({
      currentStatus: 'sent',
      body: { subject: 'Updated subject' },
    });
    assert.equal(validation.ok, true);
    assert.equal(validation.nextStatus, 'sent');
    assert.equal(validation.hasStatusField, false);
  });

  await run('update mapper normalizes repository payload', async () => {
    const mapped = mapUpdateQuotationInput({
      body: {
        projectId: ' project-9 ',
        lineItems: [{ sku: 'A', currency: 'USD', vatMode: 'included', vatRate: 10 }],
        financialConfig: { exchangeRate: 26000, calculateTotals: false },
        commercialTerms: { remarksVi: 'Term remark', termItems: [{ labelViPrint: 'Thanh toán', labelEn: 'Payment', textVi: '50/50' }] },
      },
      current: {
        revisionNo: 3,
        revisionLabel: 'R3',
        parentQuotationId: null,
        changeReason: null,
        isWinningVersion: 1,
        lineItems: [],
        financialConfig: { interestRate: 8.5, exchangeRate: 25400, loanTermMonths: 36, markup: 15, vatRate: 8, calculateTotals: true },
        commercialTerms: { remarksVi: null, remarksEn: null, termItems: [] },
      },
      nextStatus: 'accepted',
      buildRevisionLabel: (no) => `R${no}`,
    });

    assert.equal(mapped.projectId, 'project-9');
    assert.equal(mapped.revisionNo, 3);
    assert.equal(mapped.revisionLabel, 'R3');
    assert.equal(mapped.status, 'won');
    assert.deepEqual(mapped.lineItems, [{ sku: 'A', sortOrder: 0, name: null, unit: 'Chiếc', currency: 'USD', vatMode: 'included', vatRate: 10, technicalSpecs: null, remarks: null, quantity: 1, unitPrice: 0, id: null, isOption: false }]);
    assert.equal(mapped.financialConfig.exchangeRate, 26000);
    assert.equal(mapped.financialConfig.calculateTotals, false);
    assert.equal(mapped.commercialTerms.termItems[0].textVi, '50/50');
  });

  await run('update mapper allows explicit parentQuotationId clearing', async () => {
    const mapped = mapUpdateQuotationInput({
      body: {
        parentQuotationId: null,
      },
      current: {
        revisionNo: 2,
        revisionLabel: 'R2',
        parentQuotationId: 'q-parent',
        changeReason: 'legacy revision',
        isWinningVersion: 0,
        lineItems: [],
        financialConfig: { interestRate: 8.5, exchangeRate: 25400, loanTermMonths: 36, markup: 15, vatRate: 8, calculateTotals: true },
        commercialTerms: { remarksVi: null, remarksEn: null, termItems: [] },
      },
      nextStatus: 'draft',
      buildRevisionLabel: (no) => `R${no}`,
    });

    assert.equal(mapped.parentQuotationId, null);
  });

  await run('revise mapper builds draft revision payload from source + overrides', async () => {
    const mapped = mapReviseQuotationInput({
      source: {
        id: 'q-1',
        quoteNumber: 'Q-001',
        quoteDate: '2026-03-01',
        subject: 'Initial',
        accountId: 'acc-1',
        contactId: 'contact-1',
        projectId: 'project-1',
        salesperson: 'Alice',
        salespersonPhone: '0900',
        currency: 'VND',
        opportunityId: 'opp-1',
        lineItems: [{ sku: 'SKU-1' }],
        financialConfig: { interestRate: 8.5, exchangeRate: 25400, loanTermMonths: 36, markup: 15, vatRate: 8, calculateTotals: true },
        commercialTerms: {
          remarksVi: null,
          remarksEn: null,
          termItems: [{ labelViPrint: 'Thanh toán', labelEn: 'Payment', textVi: '100%', textEn: '100%' }],
        },
        subtotal: 100,
        taxTotal: 8,
        grandTotal: 108,
        validUntil: '2026-03-31',
      },
      body: {
        quoteNumber: 'Q-001-R2',
        subject: 'Revised',
        subtotal: 200,
      },
      id: 'q-2',
      revisionNo: 2,
      buildRevisionLabel: (no) => `R${no}`,
    });

    assert.equal(mapped.id, 'q-2');
    assert.equal(mapped.quoteNumber, 'Q-001-R2');
    assert.equal(mapped.revisionNo, 2);
    assert.equal(mapped.revisionLabel, 'R2');
    assert.equal(mapped.parentQuotationId, 'q-1');
    assert.equal(mapped.status, 'draft');
    assert.equal(mapped.subject, 'Revised');
    assert.equal(mapped.subtotal, 200);
    assert.equal(mapped.taxTotal, 8);
    assert.deepEqual(mapped.lineItems, [{ sku: 'SKU-1', sortOrder: 0, name: null, unit: 'Chiếc', currency: 'VND', vatMode: 'excluded', vatRate: 8, technicalSpecs: null, remarks: null, quantity: 1, unitPrice: 0, id: null, isOption: false }]);
    assert.equal(mapped.financialConfig.exchangeRate, 25400);
    assert.equal(mapped.financialConfig.calculateTotals, true);
    assert.equal(mapped.commercialTerms.termItems[0].textVi, '100%');
  });

  await run('revise validator rejects non-object body', async () => {
    const validation = validateReviseQuotationRequest('invalid-body');
    assert.equal(validation.ok, false);
    assert.equal(validation.httpStatus, 400);
    assert.equal(validation.payload.code, 'INVALID_REQUEST_BODY');
  });

  await run('revise validator normalizes null body to empty object', async () => {
    const validation = validateReviseQuotationRequest(null);
    assert.equal(validation.ok, true);
    assert.deepEqual(validation.normalizedBody, {});
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
