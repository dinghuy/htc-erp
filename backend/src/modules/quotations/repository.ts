import { getDb } from '../../../sqlite-db';
import { v4 as uuidv4 } from 'uuid';
import {
  buildPdfTermsFromCommercialTerms,
  buildTypedQuotationStateFromBody,
  parseLegacyQuotationCommercialTerms,
  parseLegacyQuotationFinancialConfig,
  parseLegacyQuotationOfferGroups,
  parseLegacyQuotationLineItems,
  type QuotationCommercialTerms,
  type QuotationFinancialConfig,
  type QuotationOfferGroupRecord,
  type QuotationLineItemInput,
  normalizeVatMode,
} from './typedState';

type DatabaseLike = {
  get: (sql: string, params?: unknown[]) => Promise<any>;
  all: (sql: string, params?: unknown[]) => Promise<any[]>;
  run: (sql: string, params?: unknown[]) => Promise<any>;
};

type QuotationHeaderWriteRecord = {
  id: string | null;
  quoteNumber: string;
  quoteDate: string;
  subject: string | null;
  accountId: string | null;
  contactId: string | null;
  projectId: string | null;
  salesperson: string | null;
  salespersonPhone: string | null;
  currency: string;
  opportunityId: string | null;
  revisionNo: number;
  revisionLabel: string;
  parentQuotationId: string | null;
  changeReason: string | null;
  isWinningVersion: number;
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  status: string;
  validUntil: string | null;
};

export type QuotationRecord = QuotationHeaderWriteRecord & {
  lineItems: QuotationLineItemInput[];
  offerGroups: QuotationOfferGroupRecord[];
  financialConfig: QuotationFinancialConfig;
  commercialTerms: QuotationCommercialTerms;
};

function resolveDb(db?: DatabaseLike) {
  return db || getDb();
}

function stripLegacyBlobFields<T extends Record<string, any>>(row: T) {
  if (!row || typeof row !== 'object') return row;
  const { items, financialParams, terms, ...rest } = row;
  return rest as T;
}

function normalizeLineItemRow(row: any) {
  return {
    id: String(row?.id || ''),
    sortOrder: Number.isFinite(Number(row?.sortOrder)) ? Number(row.sortOrder) : 0,
    sku: row?.sku || null,
    name: row?.name || null,
    unit: row?.unit || null,
    currency: row?.currency || 'VND',
    vatMode: normalizeVatMode(row?.vatMode, 'net'),
    vatRate: Number.isFinite(Number(row?.vatRate)) ? Number(row.vatRate) : 8,
    technicalSpecs: row?.technicalSpecs || null,
    remarks: row?.remarks || null,
    quantity: Number.isFinite(Number(row?.quantity)) ? Number(row.quantity) : 1,
    unitPrice: Number.isFinite(Number(row?.unitPrice)) ? Number(row.unitPrice) : 0,
    isOption: Number(row?.isOption) === 1,
    offerGroupKey: String(row?.offerGroupKey || (Number(row?.isOption) === 1 ? 'group-b' : 'group-a')),
  };
}

function normalizeOfferGroupRow(row: any) {
  return {
    id: row?.id ? String(row.id) : null,
    groupKey: String(row?.groupKey || 'group-a'),
    label: row?.label || null,
    currency: row?.currency || 'VND',
    vatComputed: Number(row?.vatComputed) === 1,
    totalComputed: Number(row?.totalComputed) === 1,
    sortOrder: Number.isFinite(Number(row?.sortOrder)) ? Number(row.sortOrder) : 0,
  };
}

function normalizeCommercialTermItemRow(row: any) {
  return {
    id: String(row?.id || ''),
    sortOrder: Number.isFinite(Number(row?.sortOrder)) ? Number(row.sortOrder) : 0,
    labelViPrint: row?.labelViPrint || null,
    labelEn: row?.labelEn || null,
    textVi: row?.textVi || null,
    textEn: row?.textEn || null,
  };
}

async function readTypedState(db: DatabaseLike, sourceRow: any) {
  const quotationId = String(sourceRow?.id || '').trim();
  if (!quotationId) {
    return {
      lineItems: [],
      offerGroups: parseLegacyQuotationOfferGroups(null, [], {}),
      financialConfig: parseLegacyQuotationFinancialConfig(null),
      commercialTerms: parseLegacyQuotationCommercialTerms(null),
    };
  }

  const [lineItemRows, financialConfigRow, offerGroupRows, termProfileRow, termItemRows] = await Promise.all([
    db.all(
      `SELECT id, sortOrder, sku, name, unit, currency, vatMode, vatRate, technicalSpecs, remarks, quantity, unitPrice, isOption, offerGroupKey
       FROM QuotationLineItem
       WHERE quotationId = ?
       ORDER BY sortOrder ASC, createdAt ASC`,
      [quotationId]
    ),
    Promise.resolve({
      interestRate: sourceRow?.interestRate,
      exchangeRate: sourceRow?.exchangeRate,
      loanTermMonths: sourceRow?.loanTermMonths,
      markup: sourceRow?.markup,
      vatRate: sourceRow?.vatRate,
      calculateTotals: sourceRow?.calculateTotals,
    }),
    db.all(
      `SELECT id, groupKey, label, currency, vatComputed, totalComputed, sortOrder
       FROM QuotationOfferGroup
       WHERE quotationId = ?
       ORDER BY sortOrder ASC, createdAt ASC`,
      [quotationId]
    ),
    Promise.resolve({
      remarksVi: sourceRow?.remarksVi,
      remarksEn: sourceRow?.remarksEn,
    }),
    db.all(
      `SELECT id, sortOrder, labelViPrint, labelEn, textVi, textEn
       FROM QuotationTermItem
       WHERE quotationId = ?
       ORDER BY sortOrder ASC, createdAt ASC`,
      [quotationId]
    ),
  ]);

  const lineItems = Array.isArray(lineItemRows) && lineItemRows.length > 0
    ? lineItemRows.map(normalizeLineItemRow)
    : [];
  const offerGroups = parseLegacyQuotationOfferGroups(
    Array.isArray(offerGroupRows) && offerGroupRows.length > 0
      ? offerGroupRows.map(normalizeOfferGroupRow)
      : null,
    lineItems,
    {
      currency: sourceRow?.currency,
      calculateTotals: sourceRow?.calculateTotals,
    },
  );

  const financialConfig = financialConfigRow
    ? parseLegacyQuotationFinancialConfig(financialConfigRow)
    : parseLegacyQuotationFinancialConfig(null);

  const commercialTerms = termProfileRow || (Array.isArray(termItemRows) && termItemRows.length > 0)
    ? {
        remarksVi: termProfileRow?.remarksVi || null,
        remarksEn: termProfileRow?.remarksEn || null,
        termItems: (termItemRows || []).map(normalizeCommercialTermItemRow),
      }
    : parseLegacyQuotationCommercialTerms(null);

  return {
    lineItems,
    offerGroups,
    financialConfig,
    commercialTerms,
  };
}

async function hydrateQuotationRow(db: DatabaseLike, sourceRow: any) {
  if (!sourceRow) return null;
  const typedState = await readTypedState(db, sourceRow);
  return {
    ...stripLegacyBlobFields(sourceRow),
    ...typedState,
  };
}

async function replaceTypedState(db: DatabaseLike, quotationId: string, record: Pick<QuotationRecord, 'lineItems' | 'offerGroups' | 'financialConfig' | 'commercialTerms'>) {
  await db.run('DELETE FROM QuotationOfferGroup WHERE quotationId = ?', [quotationId]);
  for (const [index, offerGroup] of record.offerGroups.entries()) {
    await db.run(
      `INSERT INTO QuotationOfferGroup (
        id, quotationId, groupKey, label, currency, vatComputed, totalComputed, sortOrder, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        offerGroup.id || uuidv4(),
        quotationId,
        offerGroup.groupKey,
        offerGroup.label || null,
        offerGroup.currency || 'VND',
        offerGroup.vatComputed ? 1 : 0,
        offerGroup.totalComputed ? 1 : 0,
        Number.isFinite(Number(offerGroup.sortOrder)) ? Number(offerGroup.sortOrder) : index,
      ]
    );
  }

  await db.run('DELETE FROM QuotationLineItem WHERE quotationId = ?', [quotationId]);
  for (const [index, lineItem] of record.lineItems.entries()) {
    await db.run(
      `INSERT INTO QuotationLineItem (
        id, quotationId, sortOrder, sku, name, unit, currency, vatMode, vatRate, technicalSpecs, remarks, quantity, unitPrice, isOption, offerGroupKey, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        lineItem.id || uuidv4(),
        quotationId,
        Number.isFinite(Number(lineItem.sortOrder)) ? Number(lineItem.sortOrder) : index,
        lineItem.sku || null,
        lineItem.name || null,
        lineItem.unit || null,
        lineItem.currency || 'VND',
        normalizeVatMode(lineItem.vatMode, 'net'),
        Number.isFinite(Number(lineItem.vatRate)) ? Number(lineItem.vatRate) : record.financialConfig.vatRate,
        lineItem.technicalSpecs || null,
        lineItem.remarks || null,
        Number.isFinite(Number(lineItem.quantity)) ? Number(lineItem.quantity) : 1,
        Number.isFinite(Number(lineItem.unitPrice)) ? Number(lineItem.unitPrice) : 0,
        lineItem.isOption ? 1 : 0,
        lineItem.offerGroupKey || (lineItem.isOption ? 'group-b' : 'group-a'),
      ]
    );
  }

  await db.run('DELETE FROM QuotationTermItem WHERE quotationId = ?', [quotationId]);
  for (const [index, termItem] of record.commercialTerms.termItems.entries()) {
    await db.run(
      `INSERT INTO QuotationTermItem (
        id, quotationId, sortOrder, labelViPrint, labelEn, textVi, textEn, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        termItem.id || uuidv4(),
        quotationId,
        Number.isFinite(Number(termItem.sortOrder)) ? Number(termItem.sortOrder) : index,
        termItem.labelViPrint || null,
        termItem.labelEn || null,
        termItem.textVi || null,
        termItem.textEn || null,
      ]
    );
  }
}

export function createQuotationRepository() {
  async function listDetailed() {
    return resolveDb().all(
      `SELECT q.*, a.companyName as accountName, p.name AS projectName, p.projectStage
       FROM Quotation q
       LEFT JOIN Account a ON q.accountId = a.id
       LEFT JOIN Project p ON q.projectId = p.id
       ORDER BY q.createdAt DESC`
    );
  }

  async function findDetailedById(id: string, db?: DatabaseLike) {
    const resolvedDb = resolveDb(db);
    const row = await resolvedDb.get(
      `SELECT q.*, a.companyName as accountName, p.name AS projectName, p.projectStage
       FROM Quotation q
       LEFT JOIN Account a ON q.accountId = a.id
       LEFT JOIN Project p ON q.projectId = p.id
       WHERE q.id = ?`,
      [id]
    );
    return hydrateQuotationRow(resolvedDb, row);
  }

  async function findById(id: string, db?: DatabaseLike) {
    const resolvedDb = resolveDb(db);
    const row = await resolvedDb.get('SELECT * FROM Quotation WHERE id = ?', [id]);
    return hydrateQuotationRow(resolvedDb, row);
  }

  async function insert(record: QuotationRecord, db?: DatabaseLike) {
    const resolvedDb = resolveDb(db);
    const quotationId = record.id || uuidv4();
    await resolvedDb.run(
      `INSERT INTO Quotation (
        id, quoteNumber, quoteDate, subject, accountId, contactId, projectId, salesperson, salespersonPhone, currency, opportunityId, revisionNo, revisionLabel, parentQuotationId, changeReason, isWinningVersion, items, financialParams, terms, interestRate, exchangeRate, loanTermMonths, markup, vatRate, calculateTotals, remarksVi, remarksEn, subtotal, taxTotal, grandTotal, status, validUntil
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        quotationId,
        record.quoteNumber,
        record.quoteDate,
        record.subject,
        record.accountId,
        record.contactId,
        record.projectId,
        record.salesperson,
        record.salespersonPhone,
        record.currency,
        record.opportunityId,
        record.revisionNo,
        record.revisionLabel,
        record.parentQuotationId,
        record.changeReason,
        record.isWinningVersion,
        record.financialConfig.interestRate,
        record.financialConfig.exchangeRate,
        record.financialConfig.loanTermMonths,
        record.financialConfig.markup,
        record.financialConfig.vatRate,
        record.financialConfig.calculateTotals ? 1 : 0,
        record.commercialTerms.remarksVi || null,
        record.commercialTerms.remarksEn || null,
        record.subtotal,
        record.taxTotal,
        record.grandTotal,
        record.status,
        record.validUntil,
      ]
    );
    await replaceTypedState(resolvedDb, quotationId, record);
    return quotationId;
  }

  async function updateById(id: string, record: Omit<QuotationRecord, 'id' | 'quoteNumber' | 'opportunityId'>, db?: DatabaseLike) {
    const resolvedDb = resolveDb(db);
    await resolvedDb.run(
      `UPDATE Quotation
       SET quoteDate = ?, subject = ?, accountId = ?, contactId = ?, projectId = ?, salesperson = ?, salespersonPhone = ?, currency = ?,
           revisionNo = ?, revisionLabel = ?, parentQuotationId = ?, changeReason = ?, isWinningVersion = ?, items = NULL, financialParams = NULL, terms = NULL,
           interestRate = ?, exchangeRate = ?, loanTermMonths = ?, markup = ?, vatRate = ?, calculateTotals = ?, remarksVi = ?, remarksEn = ?,
           subtotal = ?, taxTotal = ?, grandTotal = ?, status = ?, validUntil = ?
       WHERE id = ?`,
      [
        record.quoteDate,
        record.subject,
        record.accountId,
        record.contactId,
        record.projectId,
        record.salesperson,
        record.salespersonPhone,
        record.currency,
        record.revisionNo,
        record.revisionLabel,
        record.parentQuotationId,
        record.changeReason,
        record.isWinningVersion,
        record.financialConfig.interestRate,
        record.financialConfig.exchangeRate,
        record.financialConfig.loanTermMonths,
        record.financialConfig.markup,
        record.financialConfig.vatRate,
        record.financialConfig.calculateTotals ? 1 : 0,
        record.commercialTerms.remarksVi || null,
        record.commercialTerms.remarksEn || null,
        record.subtotal,
        record.taxTotal,
        record.grandTotal,
        record.status,
        record.validUntil,
        id,
      ]
    );
    await replaceTypedState(resolvedDb, id, record);
  }

  async function deleteById(id: string) {
    await resolveDb().run('DELETE FROM Quotation WHERE id = ?', [id]);
  }

  async function findPdfPayloadById(id: string, db?: DatabaseLike) {
    const resolvedDb = resolveDb(db);
    const row = await resolvedDb.get(
      `SELECT q.*, a.companyName, a.address, a.taxCode
       FROM Quotation q
       LEFT JOIN Account a ON q.accountId = a.id
       WHERE q.id = ?`,
      [id]
    );
    if (!row) return null;
    const typed = await readTypedState(resolvedDb, row);
    return {
      ...stripLegacyBlobFields(row),
      lineItems: typed.lineItems,
      offerGroups: typed.offerGroups,
      financialConfig: typed.financialConfig,
      commercialTerms: typed.commercialTerms,
      pdfTerms: buildPdfTermsFromCommercialTerms(typed.commercialTerms),
    };
  }

  async function findTypedStateById(id: string, db?: DatabaseLike) {
    const resolvedDb = resolveDb(db);
    const row = await resolvedDb.get('SELECT * FROM Quotation WHERE id = ?', [id]);
    if (!row) return null;
    return readTypedState(resolvedDb, row);
  }

  return {
    listDetailed,
    findDetailedById,
    findById,
    insert,
    updateById,
    deleteById,
    findPdfPayloadById,
    findTypedStateById,
    buildTypedQuotationStateFromBody,
  };
}
