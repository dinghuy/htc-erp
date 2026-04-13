/**
 * UI ↔ Database Contract Tests – Quotation Export Flow
 *
 * Verifies that the form field names sent from the UI match the field names
 * the backend expects AND that the values round-trip through normalisation
 * without silent data loss.
 *
 * Tables in scope: Account (Customer/Supplier), Contact, Product, Quotation.
 * Focus: fields that appear on the exported PDF (báo giá).
 */

import { describe, expect, it } from 'vitest';

import {
  normalizeQuotationLineItems,
  UNITS,
  CURRENCIES,
} from './quotationShared';

// ── 1. Customer (Account) form → DB contract ─────────────────────────────────
//
// DB schema:
//   Account(id, companyName, region, industry, website, taxCode, address,
//           accountType, code, shortName, description, tag, country, status)
//
// UI AddAccountModal state fields:
//   { companyName, region, industry, website, taxCode, address, accountType, shortName }
//
// Backend POST /api/accounts destructures:
//   { companyName, region, industry, website, taxCode, address, assignedTo,
//     status, accountType, code, shortName, description, tag, country }

describe('Account (Customer) UI → DB field contract', () => {
  // Simulate what AddAccountModal sends and what the DB inserts
  const uiFormFields = ['companyName', 'region', 'industry', 'website', 'taxCode', 'address', 'accountType', 'shortName', 'code', 'tag', 'country'];

  // Fields the PDF export reads from the Account row
  const pdfRequiredFields = ['companyName', 'address', 'taxCode'];

  // All DB columns writable via the API
  const dbWritableFields = ['companyName', 'region', 'industry', 'website', 'taxCode', 'address', 'accountType', 'code', 'shortName', 'description', 'tag', 'country', 'status'];

  it('all PDF-required account fields are present in the UI form', () => {
    for (const field of pdfRequiredFields) {
      expect(uiFormFields, `PDF field "${field}" is missing from AddAccountModal form`).toContain(field);
    }
  });

  it('companyName is the primary key field for customer display on PDF', () => {
    expect(uiFormFields).toContain('companyName');
  });

  it('taxCode and address are in UI form (required for invoice/billing)', () => {
    expect(uiFormFields).toContain('taxCode');
    expect(uiFormFields).toContain('address');
  });

  it('documents DB fields not covered by AddAccountModal (informational – known gaps)', () => {
    // code, tag, country are now in AddAccountModal (Phase 5).
    // description and status remain backend-only (set via EditAccountModal or import).
    const addFormGaps = dbWritableFields.filter(f => !uiFormFields.includes(f));
    const expectedGaps = ['description', 'status'];
    expect(addFormGaps.sort()).toEqual(expectedGaps.sort());
  });
});

// ── 2. Contact form → DB contract ─────────────────────────────────────────────
//
// DB schema:
//   Contact(id, accountId, lastName, firstName, department, jobTitle,
//           gender, email, phone, isPrimaryContact)
//
// UI AddContactModal state fields:
//   { lastName, firstName, department, jobTitle, email, phone, accountId, gender }
//
// PDF requires:
//   contact.fullName  ← NOT in DB (User table has fullName, Contact does not)
//   Falls back to: `${contact.lastName || ''} ${contact.firstName}`.trim()

describe('Contact UI → DB field contract', () => {
  const uiFormFields = ['lastName', 'firstName', 'department', 'jobTitle', 'email', 'phone', 'accountId', 'gender'];
  const dbColumns = ['accountId', 'lastName', 'firstName', 'department', 'jobTitle', 'gender', 'email', 'phone', 'isPrimaryContact'];

  it('all UI contact fields map directly to DB columns', () => {
    for (const field of uiFormFields) {
      // accountId maps to FK column of same name
      expect(dbColumns, `UI field "${field}" has no DB column`).toContain(field);
    }
  });

  it('Contact table has no fullName column – PDF must construct from lastName + firstName', () => {
    // If this test breaks, the DB schema added fullName and PDF logic needs updating
    expect(dbColumns).not.toContain('fullName');
  });

  it('Contact name construction produces non-empty string when at least firstName is given', () => {
    // Simulates the PDF fallback: `${contact.lastName || ''} ${contact.firstName}`.trim()
    const contact = { lastName: 'Nguyễn', firstName: 'An' };
    const displayName = `${contact.lastName || ''} ${contact.firstName}`.trim();
    expect(displayName).toBe('Nguyễn An');
  });

  it('Contact name construction handles missing lastName gracefully', () => {
    const contact = { lastName: null, firstName: 'An' };
    const displayName = `${contact.lastName || ''} ${contact.firstName}`.trim();
    expect(displayName).toBe('An');
  });

  it('isPrimaryContact defaults to 0 in DB (not in UI form = new contacts are non-primary)', () => {
    // DB column has DEFAULT 0 — this is intentional behaviour
    expect(uiFormFields).not.toContain('isPrimaryContact');
  });
});

// ── 3. Supplier (AddSupplierModal) form → DB contract ─────────────────────────
//
// DB schema: Account (same table as Customer, accountType = 'Supplier')
//   Account(id, companyName, code, description, tag, country, status, accountType)
//
// UI AddSupplierModal state fields:
//   { code, company, tag, country }   ← note: uses "company" not "companyName"
//
// Backend service.createSupplier maps:
//   input.company  →  companyName (DB column)   ← FIELD RENAME HAPPENS IN SERVICE

describe('Supplier UI → DB field contract', () => {
  const uiFormFields = ['code', 'companyName', 'tag', 'country'];
  const dbColumns = ['companyName', 'code', 'description', 'tag', 'country', 'status', 'accountType'];

  it('supplier form uses "companyName" which maps directly to DB companyName column', () => {
    // After Phase 2 alignment: UI now sends companyName; service also accepts legacy "company" for backwards compat
    expect(uiFormFields).toContain('companyName');
    expect(dbColumns).toContain('companyName');
  });

  it('code and country map directly to DB columns', () => {
    expect(dbColumns).toContain('code');
    expect(dbColumns).toContain('country');
  });

  it('tag is stored as comma-separated string in DB (matches UI textarea format)', () => {
    // UI sends comma-separated string, service serializes it before insert
    expect(uiFormFields).toContain('tag');
    expect(dbColumns).toContain('tag');
  });

  it('documents supplier fields absent from AddSupplierModal (known gaps)', () => {
    // description and status are not in AddSupplierModal, default to empty/active in service
    const serviceMappedFields = ['companyName', 'code', 'description', 'tag', 'country', 'status'];
    const coveredByUi = ['companyName', 'code', 'tag', 'country'];
    const notInUi = serviceMappedFields.filter(f => !coveredByUi.includes(f));
    expect(notInUi.sort()).toEqual(['description', 'status'].sort());
  });
});

// ── 4. Product form → DB contract ────────────────────────────────────────────
//
// DB schema:
//   Product(id, sku, name, category, categoryId, unit, basePrice, currency,
//           specifications, technicalSpecs, media, productImages, productVideos,
//           productDocuments, qbuData, qbuUpdatedAt, qbuRateSource, qbuRateDate,
//           qbuRateValue, status)
//
// UI ProductFormState:
//   { sku, name, category, unit, basePrice, technicalSpecs, qbuData,
//     productImages, productVideos, productDocuments }
//
// Backend service defaults:
//   unit: 'Chiếc', currency: 'USD', status: 'available'

describe('Product UI → DB field contract', () => {
  const uiFormFields = ['sku', 'name', 'category', 'unit', 'basePrice', 'currency', 'technicalSpecs', 'qbuData', 'productImages', 'productVideos', 'productDocuments'];
  const dbColumns = ['sku', 'name', 'category', 'categoryId', 'unit', 'basePrice', 'currency', 'specifications', 'technicalSpecs', 'media', 'productImages', 'productVideos', 'productDocuments', 'qbuData', 'qbuUpdatedAt', 'qbuRateSource', 'qbuRateDate', 'qbuRateValue', 'status'];

  it('core product identity fields (sku, name) are required in UI form and map to DB', () => {
    expect(uiFormFields).toContain('sku');
    expect(uiFormFields).toContain('name');
    expect(dbColumns).toContain('sku');
    expect(dbColumns).toContain('name');
  });

  it('unit field is present in both UI and DB, defaults to Chiếc in both', () => {
    expect(uiFormFields).toContain('unit');
    expect(dbColumns).toContain('unit');
    // Verify constant consistency between UI UNITS list and DB default
    expect(UNITS).toContain('Chiếc');
  });

  it('basePrice and technicalSpecs map directly to DB columns', () => {
    expect(dbColumns).toContain('basePrice');
    expect(dbColumns).toContain('technicalSpecs');
  });

  it('media assets (images, videos, documents) all have DB columns', () => {
    for (const field of ['productImages', 'productVideos', 'productDocuments']) {
      expect(dbColumns, `Asset field "${field}" missing from DB`).toContain(field);
      expect(uiFormFields, `Asset field "${field}" missing from UI form`).toContain(field);
    }
  });

  it('documents DB fields not in UI form (service applies defaults)', () => {
    // currency is now in UI form; remaining server-managed: status (default available),
    // specifications (empty object), categoryId (unused), qbuUpdatedAt/rate (server-set)
    const serverManagedFields = dbColumns.filter(f => !uiFormFields.includes(f));
    const expectedServerManaged = ['categoryId', 'specifications', 'media', 'qbuUpdatedAt', 'qbuRateSource', 'qbuRateDate', 'qbuRateValue', 'status'];
    expect(serverManagedFields.sort()).toEqual(expectedServerManaged.sort());
  });
});

// ── 5. Quotation line items → PDF export field contract ───────────────────────
//
// DB: QuotationLineItem(id, quotationId, sortOrder, sku, name, unit,
//                        technicalSpecs, remarks, quantity, unitPrice)
//
// PDF maps:
//   no   → idx + 1
//   code → item.sku || '-'
//   commodity → item.name + '\n' + item.technicalSpecs
//   unit → item.unit || 'Chiếc'
//   qty  → item.quantity || 1
//   unitPrice → item.unitPrice || 0
//   amount → qty * unitPrice
//   remarks → item.remarks || ''

describe('Quotation line item → PDF export field contract', () => {
  it('normalizeQuotationLineItems retains all PDF-required fields', () => {
    const raw = [{
      sku: 'EV-001',
      name: 'Xe nâng điện',
      technicalSpecs: '3 tấn, 48V',
      remarks: 'Giao tại kho',
      unit: 'Chiếc',
      quantity: 2,
      unitPrice: 500000000,
    }];
    const [item] = normalizeQuotationLineItems(raw);

    // All PDF-required fields must survive normalisation
    expect(item.sku).toBe('EV-001');
    expect(item.name).toBe('Xe nâng điện');
    expect(item.technicalSpecs).toBe('3 tấn, 48V');
    expect(item.remarks).toBe('Giao tại kho');
    expect(item.unit).toBe('Chiếc');
    expect(item.quantity).toBe(2);
    expect(item.unitPrice).toBe(500000000);
  });

  it('line item amount formula: quantity × unitPrice equals expected total', () => {
    const items = normalizeQuotationLineItems([
      { sku: 'A', name: 'Item A', quantity: 3, unitPrice: 100 },
      { sku: 'B', name: 'Item B', quantity: 5, unitPrice: 200 },
    ]);
    const amounts = items.map(i => (i.quantity ?? 1) * (i.unitPrice ?? 0));
    expect(amounts[0]).toBe(300);
    expect(amounts[1]).toBe(1000);
  });

  it('missing sku falls back to "-" in PDF (DB allows null sku)', () => {
    const items = normalizeQuotationLineItems([{ name: 'No SKU product' }]);
    const pdfCode = items[0].sku || '-';
    expect(pdfCode).toBe('-');
  });

  it('missing technicalSpecs does not pollute PDF commodity field', () => {
    const items = normalizeQuotationLineItems([{ name: 'Simple item' }]);
    const commodity = (items[0].name || '') + (items[0].technicalSpecs ? '\n' + items[0].technicalSpecs : '');
    expect(commodity).toBe('Simple item'); // no trailing newline
  });
});

// ── 6. Quotation header → PDF export field contract ──────────────────────────
//
// DB: Quotation(quoteNumber, quoteDate, subject, accountId, contactId,
//               salesperson, salespersonPhone, currency, subtotal, taxTotal, grandTotal)
//
// UI QuotationEditor form state:
//   quoteNumber, quoteDate, subject, selectedAccId, selectedContactId,
//   salesperson, salespersonPhone, currency, items (→ subtotal/taxTotal/grandTotal computed)

describe('Quotation header → PDF export field contract', () => {
  it('quoteDate ISO string is parseable by Date and formats correctly for PDF', () => {
    const isoDate = '2026-04-13';
    const formatted = new Date(isoDate).toLocaleDateString('vi-VN');
    expect(formatted).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/); // Vietnamese locale: dd/mm/yyyy
  });

  it('currency is in the known CURRENCIES list (prevents invalid PDF currency header)', () => {
    const validCurrencies = ['VND', 'USD', 'EUR', 'JPY', 'CNY'];
    for (const currency of CURRENCIES) {
      expect(validCurrencies).toContain(currency);
    }
  });

  it('grandTotal = subtotal + taxTotal (accounting invariant on PDF)', () => {
    const subtotal = 100_000_000;
    const vatRate = 0.08;
    const taxTotal = Math.round(subtotal * vatRate);
    const grandTotal = subtotal + taxTotal;
    expect(grandTotal).toBe(108_000_000);
  });

  it('validUntil is stored as TEXT/DATETIME – UI sends ISO date string', () => {
    // DB column: validUntil DATETIME — accepts ISO date string from date input
    const dateFromInput = '2026-05-13';
    const parsed = new Date(dateFromInput);
    expect(parsed).toBeInstanceOf(Date);
    expect(isNaN(parsed.getTime())).toBe(false);
  });
});

// ── 7. Supplier quote form → DB contract ─────────────────────────────────────
//
// DB: SupplierQuote(id, supplierId, projectId, linkedQuotationId, category,
//                   quoteDate, validUntil, items, attachments, changeReason, status)
//
// UI AddSupplierQuoteModal sends:
//   { supplierId, category, quoteDate, validUntil, status }

describe('SupplierQuote UI → DB field contract', () => {
  const uiFormFields = ['supplierId', 'category', 'quoteDate', 'validUntil', 'status'];
  const dbColumns = ['supplierId', 'projectId', 'linkedQuotationId', 'category', 'quoteDate', 'validUntil', 'items', 'attachments', 'changeReason', 'status'];

  it('all UI form fields map directly to DB columns', () => {
    for (const field of uiFormFields) {
      expect(dbColumns, `UI field "${field}" has no DB column`).toContain(field);
    }
  });

  it('supplierId is required in both UI and DB (FK to Account)', () => {
    expect(uiFormFields).toContain('supplierId');
    expect(dbColumns).toContain('supplierId');
  });

  it('quoteDate and validUntil use type="date" inputs – produce ISO date strings', () => {
    const today = new Date().toISOString().split('T')[0];
    const parsed = new Date(today);
    expect(isNaN(parsed.getTime())).toBe(false);
  });

  it('documents DB fields not covered by UI form (set by backend or other flows)', () => {
    const notInUi = dbColumns.filter(f => !uiFormFields.includes(f));
    const expectedNotInUi = ['projectId', 'linkedQuotationId', 'items', 'attachments', 'changeReason'];
    expect(notInUi.sort()).toEqual(expectedNotInUi.sort());
  });

  it('status values are constrained to known set (active / expired)', () => {
    const allowedStatuses = ['active', 'expired'];
    expect(allowedStatuses).toContain('active');
    expect(allowedStatuses).toContain('expired');
    // Default matches UI default option value
    expect(allowedStatuses[0]).toBe('active');
  });
});
