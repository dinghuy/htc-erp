import express, { Express, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../sqlite-db';
import {
  DEFAULT_OPERATION_CONFIG,
  DEFAULT_RENTAL_CONFIG,
  PricingLineItemInput,
  PricingMaintenancePartInput,
  PricingOperationConfigInput,
  PricingQuotationInput,
  PricingRentalConfigInput,
  computeAmortization,
  computeMonthlySchedule,
  computePmLevelCosts,
  computeQuotationSummary,
  computeVarianceSummary,
  derivePricingInvestment,
  normalizeOperationConfig,
  normalizeQuotationInput,
  normalizeRentalConfig,
} from './compute';
import {
  createQbuApprovalStage,
  QBU_FINANCE_REQUEST_TYPE,
  QBU_PROCUREMENT_REQUEST_TYPE,
} from './workflow';

const ah = (fn: any) => (req: Request, res: Response, next: any) =>
  Promise.resolve(fn(req, res, next)).catch(next);

function num(value: unknown, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function getCurrentUserId(req: Request) {
  return (req as any)?.user?.id || null;
}

function routeParam(req: Request, key: string) {
  const value = (req.params as Record<string, string | string[] | undefined>)[key];
  return Array.isArray(value) ? value[0] : (value || '');
}

function mapLineItemRow(row: any) {
  return {
    id: row.id,
    section: row.section,
    description: row.description || '',
    quantityLabel: row.quantityLabel || '',
    unitCount: num(row.unitCount, 0),
    costRoutingType: row.costRoutingType || null,
    sellUnitPriceVnd: row.sellUnitPriceVnd == null ? null : num(row.sellUnitPriceVnd, 0),
    buyUnitPriceVnd: row.buyUnitPriceVnd == null ? null : num(row.buyUnitPriceVnd, 0),
    buyUnitPriceUsd: row.buyUnitPriceUsd == null ? null : num(row.buyUnitPriceUsd, 0),
  };
}

function mapMaintenancePartRow(row: any) {
  return {
    id: row.id,
    systemName: row.systemName || '',
    itemDescription: row.itemDescription || '',
    modelSpec: row.modelSpec || '',
    unit: row.unit || '',
    qty: num(row.qty, 0),
    unitPriceVnd: num(row.unitPriceVnd, 0),
    level500h: Boolean(row.level500h),
    level1000h: Boolean(row.level1000h),
    level2000h: Boolean(row.level2000h),
    level3000h: Boolean(row.level3000h),
    level4000h: Boolean(row.level4000h),
    note: row.note || '',
  };
}

function mapCostEntryRow(row: any) {
  return {
    id: row.id,
    pricingQuotationId: row.pricingQuotationId,
    lineItemId: row.lineItemId || null,
    entryType: row.entryType,
    amountVnd: num(row.amountVnd, 0),
    quantity: num(row.quantity, 1),
    note: row.note || '',
    recordedAt: row.recordedAt || null,
    recordedBy: row.recordedBy || null,
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
  };
}

function buildQuotationPayload(row: any) {
  return {
    id: row.id,
    projectId: row.projectId || null,
    projectCode: row.projectCode || '',
    customerName: row.customerName || '',
    supplierName: row.supplierName || '',
    salePerson: row.salePerson || '',
    changeReason: row.changeReason || null,
    qbuType: row.qbuType || 'INITIAL',
    parentPricingQuotationId: row.parentPricingQuotationId || null,
    batchNo: num(row.batchNo, 0),
    qbuWorkflowStage: row.qbuWorkflowStage || 'draft',
    qbuSubmittedAt: row.qbuSubmittedAt || null,
    qbuSubmittedBy: row.qbuSubmittedBy || null,
    qbuCompletedAt: row.qbuCompletedAt || null,
    date: row.date || '',
    vatRate: num(row.vatRate, 0.08),
    discountRate: num(row.discountRate, 0),
    citRate: num(row.citRate, 0.2),
    tpcType: row.tpcType === 'Net' || row.tpcType === 'Gross' ? row.tpcType : null,
    tpcRate: num(row.tpcRate, 0),
    sellFxRate: num(row.sellFxRate, 25500),
    buyFxRate: num(row.buyFxRate, 26300),
    loanInterestDays: num(row.loanInterestDays, 240),
    loanInterestRate: num(row.loanInterestRate, 0.08),
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
  };
}

async function getLineItems(db: any, quotationId: string) {
  const rows = await db.all(
    `SELECT *
     FROM PricingLineItem
     WHERE quotationId = ?
     ORDER BY sortOrder ASC, createdAt ASC`,
    [quotationId]
  );
  return rows.map(mapLineItemRow);
}

async function getMaintenanceParts(db: any, quotationId: string) {
  const rows = await db.all(
    `SELECT *
     FROM PricingMaintenancePart
     WHERE quotationId = ?
     ORDER BY sortOrder ASC, createdAt ASC`,
    [quotationId]
  );
  return rows.map(mapMaintenancePartRow);
}

async function getCostEntries(db: any, quotationId: string) {
  const rows = await db.all(
    `SELECT *
     FROM PricingCostEntry
     WHERE pricingQuotationId = ?
     ORDER BY createdAt ASC, id ASC`,
    [quotationId]
  );
  return rows.map(mapCostEntryRow);
}

async function getRentalConfig(db: any, quotationId: string): Promise<Required<PricingRentalConfigInput>> {
  const row = await db.get(`SELECT * FROM PricingQuotation WHERE id = ?`, [quotationId]);
  return normalizeRentalConfig(row || DEFAULT_RENTAL_CONFIG);
}

async function getOperationConfig(db: any, quotationId: string): Promise<Required<PricingOperationConfigInput>> {
  const row = await db.get(`SELECT * FROM PricingQuotation WHERE id = ?`, [quotationId]);
  const pmIntervalsHours = row?.pmIntervalsHours ? JSON.parse(row.pmIntervalsHours) : undefined;
  return normalizeOperationConfig({ ...(row || DEFAULT_OPERATION_CONFIG), pmIntervalsHours });
}

async function getVarianceThresholds(db: any) {
  const rows = await db.all(
    `SELECT key, value
     FROM SystemSetting
     WHERE key IN ('qbu_variance_threshold_pct', 'qbu_variance_threshold_vnd')`
  );
  const byKey = Object.fromEntries(rows.map((row: any) => [row.key, row.value]));
  let thresholdPct = num(byKey.qbu_variance_threshold_pct, 10);
  if (thresholdPct > 1) thresholdPct /= 100;
  return {
    thresholdPct,
    thresholdVnd: num(byKey.qbu_variance_threshold_vnd, 20000000),
  };
}

async function upsertRentalConfig(db: any, quotationId: string, input: PricingRentalConfigInput | null | undefined) {
  const rental = normalizeRentalConfig(input || DEFAULT_RENTAL_CONFIG);
  await db.run(
    `UPDATE PricingQuotation
     SET investmentQty = ?, depreciationMonths = ?, stlPct = ?, stlPeriodMonths = ?, stlRate = ?, stlRateChange = ?,
         ltlPeriodMonths = ?, ltlRate = ?, ltlRateChange = ?, rentPeriodMonths = ?, downpaymentMonths = ?, paymentDelayDays = ?,
         expectedProfitPct = ?, contingencyPct = ?, updatedAt = datetime('now')
     WHERE id = ?`,
    [
      rental.investmentQty,
      rental.depreciationMonths,
      rental.stlPct,
      rental.stlPeriodMonths,
      rental.stlRate,
      rental.stlRateChange,
      rental.ltlPeriodMonths,
      rental.ltlRate,
      rental.ltlRateChange,
      rental.rentPeriodMonths,
      rental.downpaymentMonths,
      rental.paymentDelayDays,
      rental.expectedProfitPct,
      rental.contingencyPct,
      quotationId,
    ]
  );
}

async function upsertOperationConfig(db: any, quotationId: string, input: PricingOperationConfigInput | null | undefined) {
  const ops = normalizeOperationConfig(input || DEFAULT_OPERATION_CONFIG);
  await db.run(
    `UPDATE PricingQuotation
     SET workingDaysMonth = ?, dailyHours = ?, movesPerDay = ?, kmPerMove = ?, electricityPriceVnd = ?,
         kwhPerKm = ?, driversPerUnit = ?, driverSalaryVnd = ?, insuranceRate = ?, pmIntervalsHours = ?,
         updatedAt = datetime('now')
     WHERE id = ?`,
    [
      ops.workingDaysMonth,
      ops.dailyHours,
      ops.movesPerDay,
      ops.kmPerMove,
      ops.electricityPriceVnd,
      ops.kwhPerKm,
      ops.driversPerUnit,
      ops.driverSalaryVnd,
      ops.insuranceRate,
      JSON.stringify(ops.pmIntervalsHours),
      quotationId,
    ]
  );
}

async function replaceLineItems(db: any, quotationId: string, lineItemsInput: PricingLineItemInput[] = []) {
  await db.run(`DELETE FROM PricingLineItem WHERE quotationId = ?`, [quotationId]);
  for (const [index, item] of (lineItemsInput || []).entries()) {
    await db.run(
      `INSERT INTO PricingLineItem (
        id, quotationId, sortOrder, section, description, quantityLabel, unitCount, costRoutingType,
        sellUnitPriceVnd, buyUnitPriceVnd, buyUnitPriceUsd, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        item.id || uuidv4(),
        quotationId,
        index,
        item.section,
        item.description || '',
        item.quantityLabel || '',
        Math.max(0, Math.trunc(num(item.unitCount, 0))),
        item.costRoutingType || null,
        item.sellUnitPriceVnd == null ? null : num(item.sellUnitPriceVnd, 0),
        item.buyUnitPriceVnd == null ? null : num(item.buyUnitPriceVnd, 0),
        item.buyUnitPriceUsd == null ? null : num(item.buyUnitPriceUsd, 0),
      ]
    );
  }
}

async function replaceMaintenanceParts(db: any, quotationId: string, parts: PricingMaintenancePartInput[] = []) {
  await db.run(`DELETE FROM PricingMaintenancePart WHERE quotationId = ?`, [quotationId]);
  for (const [index, part] of (parts || []).entries()) {
    await db.run(
      `INSERT INTO PricingMaintenancePart (
        id, quotationId, sortOrder, systemName, itemDescription, modelSpec, unit, qty, unitPriceVnd,
        level500h, level1000h, level2000h, level3000h, level4000h, note, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        (part as any).id || uuidv4(),
        quotationId,
        index,
        (part as any).systemName || '',
        (part as any).itemDescription || '',
        (part as any).modelSpec || '',
        (part as any).unit || '',
        num((part as any).qty, 0),
        num((part as any).unitPriceVnd, 0),
        (part as any).level500h ? 1 : 0,
        (part as any).level1000h ? 1 : 0,
        (part as any).level2000h ? 1 : 0,
        (part as any).level3000h ? 1 : 0,
        (part as any).level4000h ? 1 : 0,
        (part as any).note || '',
      ]
    );
  }
}

function getRoutedLineItems(lineItems: PricingLineItemInput[]) {
  return (lineItems || []).filter(
    item =>
      (item.section === 'B_AUXILIARY' || item.section === 'C_OTHER') &&
      (item.costRoutingType === 'IMPORT_COST' || item.costRoutingType === 'OTHER_COST')
  );
}

async function buildQuotationDetail(db: any, quotationId: string) {
  const row = await db.get(`SELECT * FROM PricingQuotation WHERE id = ?`, [quotationId]);
  if (!row) return null;

  const quotation = buildQuotationPayload(row);
  const sourceLineItems = await getLineItems(db, quotationId);
  const rentalConfig = await getRentalConfig(db, quotationId);
  const operationConfig = await getOperationConfig(db, quotationId);
  const maintenanceParts = await getMaintenanceParts(db, quotationId);
  const summary = computeQuotationSummary(quotation, sourceLineItems);
  const costEntries = await getCostEntries(db, quotationId);
  const thresholds = await getVarianceThresholds(db);
  const varianceSummary = computeVarianceSummary(
    getRoutedLineItems(summary.lineItems).map(item => ({ id: item.id || null, description: item.description || '' })),
    costEntries,
    thresholds
  );

  return {
    ...quotation,
    ...summary,
    lineItems: summary.lineItems,
    rentalConfig,
    operationConfig,
    maintenanceParts,
    costEntries,
    varianceSummary,
  };
}

async function snapshotApprovedEstimateEntries(db: any, quotationId: string) {
  const detail = await buildQuotationDetail(db, quotationId);
  if (!detail) return [];
  await db.run(
    `DELETE FROM PricingCostEntry
     WHERE pricingQuotationId = ? AND entryType = 'ESTIMATE_APPROVED'`,
    [quotationId]
  );

  const entries = [];
  for (const item of getRoutedLineItems(detail.lineItems)) {
    const entryId = uuidv4();
    const amountVnd = num((item as any).buyAmount, 0);
    await db.run(
      `INSERT INTO PricingCostEntry (
        id, pricingQuotationId, lineItemId, entryType, amountVnd, quantity, note, recordedAt, recordedBy, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        entryId,
        quotationId,
        item.id || null,
        'ESTIMATE_APPROVED',
        amountVnd,
        item.unitCount || 1,
        `Approved estimate snapshot for ${item.description || 'line item'}`,
        new Date().toISOString(),
        null,
      ]
    );
    entries.push(entryId);
  }

  return entries;
}

async function ensureProjectOpen(db: any, projectId: string | null) {
  if (!projectId) {
    const error: any = new Error('Phải chọn Project trước khi trình QBU');
    error.status = 400;
    throw error;
  }
  const project = await db.get(`SELECT * FROM Project WHERE id = ?`, [projectId]);
  if (!project) {
    const error: any = new Error('Project không tồn tại');
    error.status = 400;
    throw error;
  }
  if (String(project.projectStage || '').toLowerCase() === 'closed') {
    const error: any = new Error('Project đã close, không thể tạo hoặc trình QBU mới');
    error.status = 400;
    throw error;
  }
  return project;
}

async function listBatches(db: any, quotationId: string) {
  const current = await db.get(`SELECT id, parentPricingQuotationId FROM PricingQuotation WHERE id = ?`, [quotationId]);
  if (!current) return [];
  const rootId = current.parentPricingQuotationId || current.id;
  const rows = await db.all(
    `SELECT id
     FROM PricingQuotation
     WHERE id = ? OR parentPricingQuotationId = ?
     ORDER BY batchNo ASC, createdAt ASC`,
    [rootId, rootId]
  );
  const items = [];
  for (const row of rows) {
    const detail = await buildQuotationDetail(db, row.id);
    if (detail) items.push(detail);
  }
  return items;
}

export function registerPricingRoutes(app: Express) {
  const router = express.Router();

  router.get('/quotations', ah(async (req: Request, res: Response) => {
    const db = getDb();
    const projectId = typeof req.query.projectId === 'string' && req.query.projectId.trim() ? req.query.projectId.trim() : null;
    const rows = await db.all(
      `SELECT id
       FROM PricingQuotation
       ${projectId ? 'WHERE projectId = ?' : ''}
       ORDER BY datetime(updatedAt) DESC, datetime(createdAt) DESC`,
      projectId ? [projectId] : []
    );
    const items = [];
    for (const row of rows) {
      const detail = await buildQuotationDetail(db, row.id);
      if (detail) items.push(detail);
    }
    res.json(items);
  }));

  router.post('/quotations', ah(async (req: Request, res: Response) => {
    const db = getDb();
    const body = req.body || {};
    const quotation = normalizeQuotationInput(body as PricingQuotationInput);
    const projectId = body.projectId || null;
    const qbuType = body.qbuType === 'SUPPLEMENTAL' ? 'SUPPLEMENTAL' : 'INITIAL';
    if (projectId && qbuType === 'INITIAL') {
      const existingRoot = await db.get(
        `SELECT id
         FROM PricingQuotation
         WHERE projectId = ? AND IFNULL(parentPricingQuotationId, '') = '' AND IFNULL(qbuType, 'INITIAL') = 'INITIAL'
         LIMIT 1`,
        [projectId]
      );
      if (existingRoot?.id) {
        return res.status(400).json({ error: 'Project đã có QBU gốc. Hãy làm việc trên batch hiện tại hoặc tạo QBU bổ sung.' });
      }
    }
    const id = uuidv4();
    await db.run(
      `INSERT INTO PricingQuotation (
        id, projectId, projectCode, customerName, supplierName, salePerson, changeReason, qbuType, parentPricingQuotationId, batchNo,
        qbuWorkflowStage, qbuSubmittedAt, qbuSubmittedBy, qbuCompletedAt, date, vatRate, discountRate, citRate, tpcType,
        tpcRate, sellFxRate, buyFxRate, loanInterestDays, loanInterestRate, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        id,
        projectId,
        quotation.projectCode,
        quotation.customerName,
        quotation.supplierName,
        quotation.salePerson,
        body.changeReason || null,
        qbuType,
        body.parentPricingQuotationId || null,
        qbuType === 'SUPPLEMENTAL' ? Math.max(1, Math.trunc(num(body.batchNo, 1))) : 0,
        body.qbuWorkflowStage || 'draft',
        body.qbuSubmittedAt || null,
        body.qbuSubmittedBy || null,
        body.qbuCompletedAt || null,
        quotation.date,
        quotation.vatRate,
        quotation.discountRate,
        quotation.citRate,
        quotation.tpcType,
        quotation.tpcRate,
        quotation.sellFxRate,
        quotation.buyFxRate,
        quotation.loanInterestDays,
        quotation.loanInterestRate,
      ]
    );
    await replaceLineItems(db, id, body.lineItems || []);
    await upsertRentalConfig(db, id, body.rentalConfig || DEFAULT_RENTAL_CONFIG);
    await upsertOperationConfig(db, id, body.operationConfig || DEFAULT_OPERATION_CONFIG);
    await replaceMaintenanceParts(db, id, body.maintenanceParts || []);
    res.status(201).json(await buildQuotationDetail(db, id));
  }));

  router.get('/quotations/:id', ah(async (req: Request, res: Response) => {
    const quotationId = routeParam(req, 'id');
    const detail = await buildQuotationDetail(getDb(), quotationId);
    if (!detail) return res.status(404).json({ error: 'Pricing quotation not found' });
    res.json(detail);
  }));

  router.put('/quotations/:id', ah(async (req: Request, res: Response) => {
    const quotationId = routeParam(req, 'id');
    const db = getDb();
    const existing = await db.get(`SELECT * FROM PricingQuotation WHERE id = ?`, [quotationId]);
    if (!existing) return res.status(404).json({ error: 'Pricing quotation not found' });
    if ((existing.qbuWorkflowStage || 'draft') !== 'draft') {
      return res.status(400).json({ error: 'QBU đã submit, không thể sửa draft hiện tại' });
    }
    const body = req.body || {};
    const quotation = normalizeQuotationInput(body as PricingQuotationInput);
    await db.run(
      `UPDATE PricingQuotation
       SET projectId = ?, projectCode = ?, customerName = ?, supplierName = ?, salePerson = ?, changeReason = ?, date = ?, vatRate = ?,
           discountRate = ?, citRate = ?, tpcType = ?, tpcRate = ?, sellFxRate = ?, buyFxRate = ?, loanInterestDays = ?,
           loanInterestRate = ?, updatedAt = datetime('now')
       WHERE id = ?`,
      [
        body.projectId || null,
        quotation.projectCode,
        quotation.customerName,
        quotation.supplierName,
        quotation.salePerson,
        body.changeReason ?? existing.changeReason ?? null,
        quotation.date,
        quotation.vatRate,
        quotation.discountRate,
        quotation.citRate,
        quotation.tpcType,
        quotation.tpcRate,
        quotation.sellFxRate,
        quotation.buyFxRate,
        quotation.loanInterestDays,
        quotation.loanInterestRate,
        quotationId,
      ]
    );
    await replaceLineItems(db, quotationId, body.lineItems || []);
    await upsertRentalConfig(db, quotationId, body.rentalConfig || DEFAULT_RENTAL_CONFIG);
    await upsertOperationConfig(db, quotationId, body.operationConfig || DEFAULT_OPERATION_CONFIG);
    await replaceMaintenanceParts(db, quotationId, body.maintenanceParts || []);
    res.json(await buildQuotationDetail(db, quotationId));
  }));

  router.delete('/quotations/:id', ah(async (req: Request, res: Response) => {
    const quotationId = routeParam(req, 'id');
    await getDb().run(`DELETE FROM PricingQuotation WHERE id = ?`, [quotationId]);
    res.json({ success: true });
  }));

  router.get('/quotations/:id/summary', ah(async (req: Request, res: Response) => {
    const quotationId = routeParam(req, 'id');
    const detail = await buildQuotationDetail(getDb(), quotationId);
    if (!detail) return res.status(404).json({ error: 'Pricing quotation not found' });
    res.json(computeQuotationSummary(detail, detail.lineItems));
  }));

  router.put('/quotations/:id/rental-config', ah(async (req: Request, res: Response) => {
    const quotationId = routeParam(req, 'id');
    const db = getDb();
    const existing = await db.get(`SELECT id FROM PricingQuotation WHERE id = ?`, [quotationId]);
    if (!existing) return res.status(404).json({ error: 'Pricing quotation not found' });
    await upsertRentalConfig(db, quotationId, req.body || {});
    await upsertOperationConfig(db, quotationId, req.body?.operationConfig || {});
    res.json(await buildQuotationDetail(db, quotationId));
  }));

  router.get('/quotations/:id/amortization', ah(async (req: Request, res: Response) => {
    const quotationId = routeParam(req, 'id');
    const detail = await buildQuotationDetail(getDb(), quotationId);
    if (!detail) return res.status(404).json({ error: 'Pricing quotation not found' });
    const investment = derivePricingInvestment(detail, detail.rentalConfig.investmentQty);
    res.json(computeAmortization(detail.rentalConfig, investment.totalInvestment));
  }));

  router.get('/quotations/:id/schedule', ah(async (req: Request, res: Response) => {
    const quotationId = routeParam(req, 'id');
    const detail = await buildQuotationDetail(getDb(), quotationId);
    if (!detail) return res.status(404).json({ error: 'Pricing quotation not found' });
    const pmLevelCosts = computePmLevelCosts(detail.maintenanceParts);
    const investment = derivePricingInvestment(detail, detail.rentalConfig.investmentQty);
    const amortization = computeAmortization(detail.rentalConfig, investment.totalInvestment);
    res.json(
      computeMonthlySchedule(
        detail.rentalConfig,
        detail.operationConfig,
        pmLevelCosts,
        amortization,
        investment.totalInvestment
      )
    );
  }));

  router.get('/quotations/:id/maintenance/parts', ah(async (req: Request, res: Response) => {
    const quotationId = routeParam(req, 'id');
    const existing = await getDb().get(`SELECT id FROM PricingQuotation WHERE id = ?`, [quotationId]);
    if (!existing) return res.status(404).json({ error: 'Pricing quotation not found' });
    res.json(await getMaintenanceParts(getDb(), quotationId));
  }));

  router.post('/quotations/:id/maintenance/parts', ah(async (req: Request, res: Response) => {
    const quotationId = routeParam(req, 'id');
    const db = getDb();
    const existing = await db.get(`SELECT id FROM PricingQuotation WHERE id = ?`, [quotationId]);
    if (!existing) return res.status(404).json({ error: 'Pricing quotation not found' });
    const current = await getMaintenanceParts(db, quotationId);
    const part = req.body || {};
    await replaceMaintenanceParts(db, quotationId, [...current, part]);
    const parts = await getMaintenanceParts(db, quotationId);
    res.status(201).json(parts[parts.length - 1]);
  }));

  router.put('/quotations/:id/maintenance/parts/:partId', ah(async (req: Request, res: Response) => {
    const quotationId = routeParam(req, 'id');
    const partId = routeParam(req, 'partId');
    const db = getDb();
    const parts = await getMaintenanceParts(db, quotationId);
    if (!parts.length) return res.status(404).json({ error: 'Maintenance part not found' });
    const next = parts.map((part: any) => (part.id === partId ? { ...part, ...(req.body || {}) } : part));
    if (!next.some((part: any) => part.id === partId)) {
      return res.status(404).json({ error: 'Maintenance part not found' });
    }
    await replaceMaintenanceParts(db, quotationId, next);
    const updated = (await getMaintenanceParts(db, quotationId)).find((part: any) => part.id === partId);
    res.json(updated);
  }));

  router.delete('/quotations/:id/maintenance/parts/:partId', ah(async (req: Request, res: Response) => {
    const quotationId = routeParam(req, 'id');
    const partId = routeParam(req, 'partId');
    const db = getDb();
    const parts = await getMaintenanceParts(db, quotationId);
    await replaceMaintenanceParts(
      db,
      quotationId,
      parts.filter((part: any) => part.id !== partId)
    );
    res.json({ success: true });
  }));

  router.get('/quotations/:id/maintenance/level-costs', ah(async (req: Request, res: Response) => {
    const quotationId = routeParam(req, 'id');
    const existing = await getDb().get(`SELECT id FROM PricingQuotation WHERE id = ?`, [quotationId]);
    if (!existing) return res.status(404).json({ error: 'Pricing quotation not found' });
    res.json({ levelCosts: computePmLevelCosts(await getMaintenanceParts(getDb(), quotationId)) });
  }));

  router.post('/quotations/:id/submit-qbu', ah(async (req: Request, res: Response) => {
    const quotationId = routeParam(req, 'id');
    const db = getDb();
    const detail = await buildQuotationDetail(db, quotationId);
    if (!detail) return res.status(404).json({ error: 'Pricing quotation not found' });
    if (detail.qbuWorkflowStage !== 'draft') {
      return res.json(detail);
    }

    await ensureProjectOpen(db, detail.projectId);
    const routed = detail.lineItems.filter((item: any) => item.section === 'B_AUXILIARY' || item.section === 'C_OTHER');
    if (routed.some((item: any) => !item.costRoutingType)) {
      return res.status(400).json({ error: 'Các dòng B/C phải chọn loại phí xử lý trước khi trình QBU' });
    }

    await snapshotApprovedEstimateEntries(db, quotationId);
    const submittedAt = new Date().toISOString();
    const actorUserId = getCurrentUserId(req);
    const importItems = routed.filter((item: any) => item.costRoutingType === 'IMPORT_COST');
    const otherItems = routed.filter((item: any) => item.costRoutingType === 'OTHER_COST');

    let nextStage = 'completed';
    if (importItems.length) {
      await createQbuApprovalStage(db, {
        pricingQuotationId: quotationId,
        projectId: detail.projectId,
        batchNo: detail.batchNo,
        actorUserId,
        projectCode: detail.projectCode,
        requestType: QBU_PROCUREMENT_REQUEST_TYPE,
        department: 'Procurement',
        title: `QBU Procurement Review - ${detail.batchNo > 0 ? `Bo sung dot ${detail.batchNo}` : 'QBU goc'}`,
        lineItems: importItems,
      });
      nextStage = 'procurement_review';
    } else if (otherItems.length) {
      await createQbuApprovalStage(db, {
        pricingQuotationId: quotationId,
        projectId: detail.projectId,
        batchNo: detail.batchNo,
        actorUserId,
        projectCode: detail.projectCode,
        requestType: QBU_FINANCE_REQUEST_TYPE,
        department: 'Finance',
        title: `QBU Finance Review - ${detail.batchNo > 0 ? `Bo sung dot ${detail.batchNo}` : 'QBU goc'}`,
        lineItems: otherItems,
      });
      nextStage = 'finance_review';
    }

    await db.run(
      `UPDATE PricingQuotation
       SET qbuWorkflowStage = ?, qbuSubmittedAt = ?, qbuSubmittedBy = ?, qbuCompletedAt = CASE WHEN ? = 'completed' THEN ? ELSE qbuCompletedAt END,
           updatedAt = datetime('now')
       WHERE id = ?`,
      [nextStage, submittedAt, actorUserId, nextStage, nextStage === 'completed' ? submittedAt : null, quotationId]
    );

    res.json(await buildQuotationDetail(db, quotationId));
  }));

  router.post('/quotations/:id/supplemental-batches', ah(async (req: Request, res: Response) => {
    const quotationId = routeParam(req, 'id');
    const db = getDb();
    const source = await buildQuotationDetail(db, quotationId);
    if (!source) return res.status(404).json({ error: 'Pricing quotation not found' });
    const rootId = source.parentPricingQuotationId || source.id;
    const projectId = req.body?.projectId || source.projectId;
    await ensureProjectOpen(db, projectId);
    const changeReason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (!changeReason) {
      return res.status(400).json({ error: 'Cần nhập lý do tạo QBU bổ sung' });
    }
    const lineItems = Array.isArray(req.body?.lineItems) ? req.body.lineItems : [];
    if (!lineItems.length) {
      return res.status(400).json({ error: 'QBU bổ sung phải có ít nhất 1 dòng chi phí' });
    }

    const row = await db.get(
      `SELECT COALESCE(MAX(batchNo), 0) AS maxBatchNo
       FROM PricingQuotation
       WHERE id = ? OR parentPricingQuotationId = ?`,
      [rootId, rootId]
    );
    const batchNo = num(row?.maxBatchNo, 0) + 1;
    const newId = uuidv4();
    await db.run(
      `INSERT INTO PricingQuotation (
        id, projectId, projectCode, customerName, supplierName, salePerson, changeReason, qbuType, parentPricingQuotationId, batchNo,
        qbuWorkflowStage, date, vatRate, discountRate, citRate, tpcType, tpcRate, sellFxRate, buyFxRate,
        loanInterestDays, loanInterestRate, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        newId,
        projectId,
        source.projectCode,
        source.customerName,
        source.supplierName,
        source.salePerson,
        changeReason,
        'SUPPLEMENTAL',
        rootId,
        batchNo,
        source.date,
        source.vatRate,
        source.discountRate,
        source.citRate,
        source.tpcType,
        source.tpcRate,
        source.sellFxRate,
        source.buyFxRate,
        source.loanInterestDays,
        source.loanInterestRate,
      ]
    );
    await replaceLineItems(db, newId, lineItems);
    await upsertRentalConfig(db, newId, req.body?.rentalConfig || source.rentalConfig);
    await upsertOperationConfig(db, newId, req.body?.operationConfig || source.operationConfig);
    await replaceMaintenanceParts(db, newId, req.body?.maintenanceParts || []);
    res.status(201).json(await buildQuotationDetail(db, newId));
  }));

  router.get('/quotations/:id/batches', ah(async (req: Request, res: Response) => {
    const quotationId = routeParam(req, 'id');
    const db = getDb();
    const batches = await listBatches(db, quotationId);
    if (!batches.length) return res.status(404).json({ error: 'Pricing quotation not found' });
    res.json(batches);
  }));

  router.post('/quotations/:id/actual-costs', ah(async (req: Request, res: Response) => {
    const quotationId = routeParam(req, 'id');
    const db = getDb();
    const detail = await buildQuotationDetail(db, quotationId);
    if (!detail) return res.status(404).json({ error: 'Pricing quotation not found' });
    const lineItemId = req.body?.lineItemId || null;
    if (!lineItemId) return res.status(400).json({ error: 'Thiếu lineItemId' });
    const lineItem = detail.lineItems.find((item: any) => item.id === lineItemId);
    if (!lineItem) return res.status(400).json({ error: 'Line item không thuộc quotation hiện tại' });

    const entryId = uuidv4();
    await db.run(
      `INSERT INTO PricingCostEntry (
        id, pricingQuotationId, lineItemId, entryType, amountVnd, quantity, note, recordedAt, recordedBy, createdAt, updatedAt
      ) VALUES (?, ?, ?, 'ACTUAL', ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        entryId,
        quotationId,
        lineItemId,
        num(req.body?.amountVnd, 0),
        num(req.body?.quantity, 1),
        req.body?.note || '',
        req.body?.recordedAt || new Date().toISOString(),
        getCurrentUserId(req),
      ]
    );
    const row = await db.get(`SELECT * FROM PricingCostEntry WHERE id = ?`, [entryId]);
    res.status(201).json(mapCostEntryRow(row));
  }));

  router.put('/quotations/:id/actual-costs/:entryId', ah(async (req: Request, res: Response) => {
    const quotationId = routeParam(req, 'id');
    const entryId = routeParam(req, 'entryId');
    const db = getDb();
    const existing = await db.get(
      `SELECT * FROM PricingCostEntry WHERE id = ? AND pricingQuotationId = ? AND entryType = 'ACTUAL'`,
      [entryId, quotationId]
    );
    if (!existing) return res.status(404).json({ error: 'Actual cost entry not found' });
    await db.run(
      `UPDATE PricingCostEntry
       SET amountVnd = ?, quantity = ?, note = ?, recordedAt = ?, recordedBy = ?, updatedAt = datetime('now')
       WHERE id = ?`,
      [
        num(req.body?.amountVnd, existing.amountVnd),
        num(req.body?.quantity, existing.quantity),
        req.body?.note ?? existing.note,
        req.body?.recordedAt ?? existing.recordedAt,
        getCurrentUserId(req) || existing.recordedBy,
        entryId,
      ]
    );
    res.json(mapCostEntryRow(await db.get(`SELECT * FROM PricingCostEntry WHERE id = ?`, [entryId])));
  }));

  router.get('/quotations/:id/variance', ah(async (req: Request, res: Response) => {
    const quotationId = routeParam(req, 'id');
    const db = getDb();
    const detail = await buildQuotationDetail(db, quotationId);
    if (!detail) return res.status(404).json({ error: 'Pricing quotation not found' });
    res.json(detail.varianceSummary);
  }));

  app.use('/api/pricing', router);
}
