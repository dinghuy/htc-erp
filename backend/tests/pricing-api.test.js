require('ts-node/register');

const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-pricing-'));
process.env.DB_PATH = path.join(tempDir, 'crm-pricing.db');

const { initDb, getDb } = require('../sqlite-db.ts');
const { app } = require('../server.ts');

let server;
let baseUrl;
let authHeaders;
let quotationId;
let projectId;
let projectQuotationId;
let importLineItemId;
let otherLineItemId;
let failures = 0;

async function api(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  return { response, body };
}

async function login(username, password) {
  return api('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
}

async function seedUser({ username, password, systemRole, fullName }) {
  const db = getDb();
  const passwordHash = await bcrypt.hash(password, 10);
  const id = uuidv4();
  await db.run(
    `INSERT INTO User (
      id, fullName, gender, email, phone, role, department, status,
      username, passwordHash, systemRole, accountStatus, mustChangePassword, language
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      fullName,
      'unknown',
      `${username}@example.com`,
      '',
      systemRole,
      'Sales',
      'Active',
      username,
      passwordHash,
      systemRole,
      'active',
      0,
      'vi',
    ]
  );
  return id;
}

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

async function setup() {
  await initDb();
  await seedUser({
    username: 'pricing.viewer',
    password: 'Viewer@123',
    systemRole: 'viewer',
    fullName: 'Pricing Viewer',
  });
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;

  const login = await api('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });

  assert.equal(login.response.status, 200);
  authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${login.body.token}`,
  };
}

async function teardown() {
  if (server) {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

async function main() {
  await setup();

  await run('pricing quotation CRUD and summary endpoints work', async () => {
    const project = await api('/api/projects', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        code: 'PRJ-QBU-001',
        name: 'QBU Workflow Project',
        projectStage: 'quoting',
      }),
    });

    assert.equal(project.response.status, 201);
    projectId = project.body.id;

    const create = await api('/api/pricing/quotations', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        projectId,
        projectCode: 'ETT-001',
        customerName: 'E-TT Customer',
        supplierName: 'SHACMAN',
        salePerson: 'Mr Sales',
        date: '2026-03-24',
        vatRate: 0.08,
        discountRate: 0,
        citRate: 0.2,
        tpcType: 'Net',
        tpcRate: 0.01,
        sellFxRate: 25500,
        buyFxRate: 26300,
        loanInterestDays: 240,
        loanInterestRate: 0.08,
        lineItems: [
          {
            section: 'A_MAIN',
            description: 'SHACMAN E-TT',
            quantityLabel: 'xe',
            unitCount: 4,
            sellUnitPriceVnd: 3240000000,
            buyUnitPriceUsd: 100000,
          },
          {
            section: 'B_AUXILIARY',
            description: 'Import handling',
            quantityLabel: 'xe',
            unitCount: 4,
            buyUnitPriceVnd: 100000000,
            costRoutingType: 'IMPORT_COST',
          },
          {
            section: 'C_OTHER',
            description: 'Insurance support',
            quantityLabel: 'goi',
            unitCount: 1,
            buyUnitPriceVnd: 50000000,
            costRoutingType: 'OTHER_COST',
          },
        ],
      }),
    });

    assert.equal(create.response.status, 201);
    quotationId = create.body.id;
    assert.equal(create.body.projectId, projectId);
    assert.equal(create.body.qbuType, 'INITIAL');
    assert.equal(create.body.batchNo, 0);
    assert.equal(create.body.projectCode, 'ETT-001');
    assert.equal(create.body.lineItems.length, 3);
    importLineItemId = create.body.lineItems.find((item) => item.costRoutingType === 'IMPORT_COST')?.id;
    otherLineItemId = create.body.lineItems.find((item) => item.costRoutingType === 'OTHER_COST')?.id;
    assert.ok(importLineItemId);
    assert.ok(otherLineItemId);

    const summary = await api(`/api/pricing/quotations/${quotationId}/summary`, {
      headers: authHeaders,
    });

    assert.equal(summary.response.status, 200);
    assert.equal(summary.body.totalSell, 12960000000);
    assert.ok(summary.body.netProfit > 0);

    const update = await api(`/api/pricing/quotations/${quotationId}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        ...create.body,
        customerName: 'Updated Customer',
        lineItems: create.body.lineItems,
      }),
    });

    assert.equal(update.response.status, 200);
    assert.equal(update.body.customerName, 'Updated Customer');
    assert.equal(update.body.lineItems.length, 3);
  });

  await run('rental config, maintenance, schedule, and amortization endpoints work', async () => {
    const rental = await api(`/api/pricing/quotations/${quotationId}/rental-config`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        investmentQty: 2,
        depreciationMonths: 60,
        stlPct: 0.3,
        stlPeriodMonths: 24,
        stlRate: 0.09,
        stlRateChange: 0.05,
        ltlPeriodMonths: 60,
        ltlRate: 0.12,
        ltlRateChange: 0.03,
        rentPeriodMonths: 60,
        downpaymentMonths: 3,
        paymentDelayDays: 30,
        expectedProfitPct: 0.185,
        contingencyPct: 0.03,
        operationConfig: {
          workingDaysMonth: 30,
          dailyHours: 20,
          movesPerDay: 70,
          kmPerMove: 1,
          electricityPriceVnd: 3000,
          kwhPerKm: 2.3,
          driversPerUnit: 2,
          driverSalaryVnd: 20000000,
          insuranceRate: 0.225,
          pmIntervalsHours: [500, 1000, 2000, 3000, 4000],
        },
      }),
    });

    assert.equal(rental.response.status, 200);
    assert.equal(rental.body.operationConfig.pmIntervalsHours[0], 500);

    const part = await api(`/api/pricing/quotations/${quotationId}/maintenance/parts`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        systemName: 'Lubrication',
        itemDescription: 'Engine oil',
        modelSpec: 'E-TT',
        unit: 'L',
        qty: 1,
        unitPriceVnd: 357750,
        level500h: true,
        level1000h: false,
        level2000h: false,
        level3000h: false,
        level4000h: false,
        note: 'Base PM',
      }),
    });

    assert.equal(part.response.status, 201);

    const levelCosts = await api(`/api/pricing/quotations/${quotationId}/maintenance/level-costs`, {
      headers: authHeaders,
    });

    assert.equal(levelCosts.response.status, 200);
    assert.equal(levelCosts.body.levelCosts[0], 357750);

    const schedule = await api(`/api/pricing/quotations/${quotationId}/schedule`, {
      headers: authHeaders,
    });

    assert.equal(schedule.response.status, 200);
    assert.equal(schedule.body.rows.length, 61);
    assert.equal(schedule.body.rows[1].triggers[0], 1);

    const amortization = await api(`/api/pricing/quotations/${quotationId}/amortization`, {
      headers: authHeaders,
    });

    assert.equal(amortization.response.status, 200);
    assert.equal(amortization.body.stlTable.length, 2);
    assert.equal(amortization.body.ltlTable.length, 5);
  });

  await run('submit qbu creates procurement workflow then finance after approval', async () => {
    const submit = await api(`/api/pricing/quotations/${quotationId}/submit-qbu`, {
      method: 'POST',
      headers: authHeaders,
    });

    assert.equal(submit.response.status, 200);
    assert.equal(submit.body.qbuWorkflowStage, 'procurement_review');
    assert.ok(Array.isArray(submit.body.costEntries));
    assert.ok(submit.body.costEntries.some((entry) => entry.entryType === 'ESTIMATE_APPROVED'));

    const projectWorkspace1 = await api(`/api/projects/${projectId}`, { headers: authHeaders });
    assert.equal(projectWorkspace1.response.status, 200);
    const procurementApproval = projectWorkspace1.body.approvals.find((item) => item.requestType === 'pricing-qbu-procurement');
    assert.ok(procurementApproval);
    assert.equal(projectWorkspace1.body.approvals.some((item) => item.requestType === 'pricing-qbu-finance'), false);

    const procurementDecision = await api(`/api/approval-requests/${procurementApproval.id}/decision`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ decision: 'approved' }),
    });

    assert.equal(procurementDecision.response.status, 200);

    const projectWorkspace2 = await api(`/api/projects/${projectId}`, { headers: authHeaders });
    const financeApproval = projectWorkspace2.body.approvals.find((item) => item.requestType === 'pricing-qbu-finance');
    assert.ok(financeApproval);

    const financeDecision = await api(`/api/approval-requests/${financeApproval.id}/decision`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ decision: 'approved' }),
    });

    assert.equal(financeDecision.response.status, 200);

    const detail = await api(`/api/pricing/quotations/${quotationId}`, { headers: authHeaders });
    assert.equal(detail.body.qbuWorkflowStage, 'completed');
  });

  await run('actual costs track variance and require supplemental approval only when thresholds exceeded', async () => {
    const actual1 = await api(`/api/pricing/quotations/${quotationId}/actual-costs`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        lineItemId: importLineItemId,
        amountVnd: 130000000,
        quantity: 1,
        note: 'Actual import cost',
      }),
    });

    assert.equal(actual1.response.status, 201);

    const actual2 = await api(`/api/pricing/quotations/${quotationId}/actual-costs`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        lineItemId: otherLineItemId,
        amountVnd: 52000000,
        quantity: 1,
        note: 'Actual other cost',
      }),
    });

    assert.equal(actual2.response.status, 201);

    const variance = await api(`/api/pricing/quotations/${quotationId}/variance`, {
      headers: authHeaders,
    });

    assert.equal(variance.response.status, 200);
    assert.equal(variance.body.requiresSupplementalApproval, true);
    assert.ok(variance.body.lines.some((line) => line.requiresSupplementalApproval === true));
  });

  await run('appendix/inbound/delivery/milestone edit flows refresh baseline, rollup, and timeline', async () => {
    const createMainContract = await api(`/api/projects/${projectId}/contracts`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        contractNumber: 'HD-001',
        title: 'Hop dong tong',
        signedDate: '2026-03-24',
        effectiveDate: '2026-03-24',
        status: 'signed',
        currency: 'VND',
        lineItems: [
          {
            itemCode: 'SKU-001',
            itemName: 'Xe nang dien',
            contractQty: 10,
            unitPrice: 1000000,
            etaDate: '2026-04-10',
            committedDeliveryDate: '2026-04-20',
          },
          {
            itemCode: 'SKU-002',
            itemName: 'Bo sac nhanh',
            contractQty: 3,
            unitPrice: 200000,
            etaDate: '2026-04-11',
            committedDeliveryDate: '2026-04-21',
          },
        ],
      }),
    });
    assert.equal(createMainContract.response.status, 201);
    const contractId = createMainContract.body.id;
    assert.ok(contractId);
    assert.equal(createMainContract.body?.baseline?.isCurrent, true);

    const createAppendix = await api(`/api/projects/${projectId}/contracts/${contractId}/appendices`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        appendixNumber: 'PL-001',
        title: 'Phu luc tang so luong',
        signedDate: '2026-03-25',
        effectiveDate: '2026-03-25',
        status: 'effective',
        totalDeltaValue: 5000000,
        lineItems: [
          {
            itemCode: 'SKU-001',
            itemName: 'Xe nang dien',
            contractQty: 12,
            unitPrice: 1000000,
            etaDate: '2026-04-12',
            committedDeliveryDate: '2026-04-22',
          },
          {
            itemCode: 'SKU-002',
            itemName: 'Bo sac nhanh',
            contractQty: 4,
            unitPrice: 200000,
            etaDate: '2026-04-13',
            committedDeliveryDate: '2026-04-23',
          },
        ],
      }),
    });
    assert.equal(createAppendix.response.status, 201);
    const appendixId = createAppendix.body.id;
    assert.ok(appendixId);

    const updateAppendix = await api(`/api/project-contract-appendices/${appendixId}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        title: 'Phu luc dieu chinh lan 1',
        effectiveDate: '2026-03-26',
        totalDeltaValue: 7000000,
        lineItems: [
          {
            itemCode: 'SKU-001',
            itemName: 'Xe nang dien',
            contractQty: 15,
            unitPrice: 1000000,
            etaDate: '2026-04-15',
            committedDeliveryDate: '2026-04-25',
          },
        ],
      }),
    });
    assert.equal(updateAppendix.response.status, 200);
    assert.equal(updateAppendix.body?.baseline?.isCurrent, true);

    const workspaceAfterAppendix = await api(`/api/projects/${projectId}`, { headers: authHeaders });
    assert.equal(workspaceAfterAppendix.response.status, 200);
    assert.ok(workspaceAfterAppendix.body.executionBaselines.length >= 3);
    assert.equal(workspaceAfterAppendix.body.currentBaseline?.sourceType, 'appendix');
    assert.equal(workspaceAfterAppendix.body.currentBaseline?.lineItems?.[0]?.contractQty, 15);
    const procurementLine = workspaceAfterAppendix.body.procurementLines.find((line) => line.itemCode === 'SKU-001');
    const supersededLine = workspaceAfterAppendix.body.procurementLines.find((line) => line.itemCode === 'SKU-002');
    assert.ok(procurementLine);
    assert.ok(supersededLine);
    assert.equal(procurementLine.contractQty, 15);
    assert.equal(supersededLine.status, 'superseded');
    assert.notEqual(supersededLine.baselineId, workspaceAfterAppendix.body.currentBaseline?.id);
    assert.ok(workspaceAfterAppendix.body.timeline.some((event) => event.eventType === 'procurement.superseded' && event.entityId === supersededLine.id));

    const createExecutionQuotation = await api(`/api/projects/${projectId}/quotations`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        quoteNumber: 'Q-LOG-001',
        subject: 'Execution release quote',
        salesperson: 'Admin User',
        currency: 'VND',
        items: [
          { sku: 'SKU-001', name: 'Xe nang dien', qty: 1, unitPrice: 1000000 },
        ],
        subtotal: 1000000,
        taxTotal: 80000,
        grandTotal: 1080000,
        status: 'won',
      }),
    });
    assert.equal(createExecutionQuotation.response.status, 201);

    const createSalesOrder = await api(`/api/sales-orders/from-quotation/${createExecutionQuotation.body.id}`, {
      method: 'POST',
      headers: authHeaders,
    });
    assert.equal(createSalesOrder.response.status, 201);

    const releaseSalesOrder = await api(`/api/sales-orders/${createSalesOrder.body.salesOrder.id}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ status: 'released' }),
    });
    assert.equal(releaseSalesOrder.response.status, 200);

    const createInbound = await api(`/api/projects/${projectId}/inbound-lines`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        procurementLineId: procurementLine.id,
        receivedQty: 4,
        etaDate: '2026-04-13',
        actualReceivedDate: '2026-04-14',
        status: 'received',
        receiptRef: 'RCV-001',
        note: 'Dot 1',
      }),
    });
    assert.equal(createInbound.response.status, 201);
    const inboundLineId = createInbound.body.id;
    assert.ok(inboundLineId);

    const updateInbound = await api(`/api/project-inbound-lines/${inboundLineId}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        receivedQty: 6,
        actualReceivedDate: '2026-04-16',
        status: 'closed',
        receiptRef: 'RCV-001-UPDATED',
        note: 'Cap nhat so luong',
      }),
    });
    assert.equal(updateInbound.response.status, 200);
    assert.equal(updateInbound.body.receivedQty, 6);

    const workspaceAfterInbound = await api(`/api/projects/${projectId}`, { headers: authHeaders });
    const procurementAfterInbound = workspaceAfterInbound.body.procurementLines.find((line) => line.id === procurementLine.id);
    assert.ok(procurementAfterInbound);
    assert.equal(procurementAfterInbound.receivedQty, 6);
    assert.equal(procurementAfterInbound.shortageQty, 9);
    assert.equal(procurementAfterInbound.shortageStatus, 'partial');
    assert.equal(procurementAfterInbound.actualReceivedDate, '2026-04-16');
    assert.ok(workspaceAfterInbound.body.timeline.some((event) => event.eventType === 'inbound.updated' && event.entityId === inboundLineId));

    const createDelivery = await api(`/api/projects/${projectId}/delivery-lines`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        procurementLineId: procurementLine.id,
        deliveredQty: 5,
        committedDate: '2026-04-25',
        actualDeliveryDate: '2026-04-26',
        status: 'partially_delivered',
        deliveryRef: 'DLV-001',
        note: 'Dot giao 1',
      }),
    });
    assert.equal(createDelivery.response.status, 201);
    const deliveryLineId = createDelivery.body.id;
    assert.ok(deliveryLineId);

    const updateDelivery = await api(`/api/project-delivery-lines/${deliveryLineId}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        deliveredQty: 7,
        actualDeliveryDate: '2026-04-27',
        status: 'delivered',
        deliveryRef: 'DLV-001-UPDATED',
        note: 'Cap nhat dot giao',
      }),
    });
    assert.equal(updateDelivery.response.status, 200);
    assert.equal(updateDelivery.body.deliveredQty, 7);

    const workspaceAfterDelivery = await api(`/api/projects/${projectId}`, { headers: authHeaders });
    const procurementAfterDelivery = workspaceAfterDelivery.body.procurementLines.find((line) => line.id === procurementLine.id);
    assert.ok(procurementAfterDelivery);
    assert.equal(procurementAfterDelivery.deliveredQty, 7);
    assert.equal(procurementAfterDelivery.shortageQty, 8);
    assert.equal(procurementAfterDelivery.shortageStatus, 'partial');
    assert.equal(procurementAfterDelivery.actualDeliveryDate, '2026-04-27');
    assert.ok(workspaceAfterDelivery.body.timeline.some((event) => event.eventType === 'delivery.updated' && event.entityId === deliveryLineId));

    const createMilestone = await api(`/api/projects/${projectId}/milestones`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        milestoneType: 'handover',
        title: 'Ban giao dot 1',
        plannedDate: '2026-04-30',
        status: 'pending',
      }),
    });
    assert.equal(createMilestone.response.status, 201);
    const milestoneId = createMilestone.body.id;
    assert.ok(milestoneId);

    const updateMilestone = await api(`/api/project-milestones/${milestoneId}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        title: 'Ban giao dot 1 (cap nhat)',
        actualDate: '2026-05-01',
        status: 'completed',
        note: 'Da hoan tat',
      }),
    });
    assert.equal(updateMilestone.response.status, 200);
    assert.equal(updateMilestone.body.status, 'completed');

    const workspaceAfterMilestone = await api(`/api/projects/${projectId}`, { headers: authHeaders });
    const updatedMilestone = workspaceAfterMilestone.body.milestones.find((item) => item.id === milestoneId);
    assert.ok(updatedMilestone);
    assert.equal(updatedMilestone.status, 'completed');
    assert.ok(workspaceAfterMilestone.body.timeline.some((event) => event.eventType === 'milestone.updated' && event.entityId === milestoneId));
  });

  await run('governance and workflow routes support approval, document, dedupe, and handoff flows', async () => {
    const createProjectQuotation = await api(`/api/projects/${projectId}/quotations`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        quoteNumber: 'Q-PROJ-001',
        subject: 'Project delivery quote',
        salesperson: 'Admin User',
        currency: 'VND',
        items: [
          { sku: 'SKU-001', name: 'Xe nang dien', qty: 1, unitPrice: 1000000 },
        ],
        subtotal: 1000000,
        taxTotal: 80000,
        grandTotal: 1080000,
        status: 'won',
      }),
    });

    assert.equal(createProjectQuotation.response.status, 201);
    projectQuotationId = createProjectQuotation.body.id;
    assert.ok(projectQuotationId);

    const createApproval = await api(`/api/projects/${projectId}/approval-requests`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        quotationId: projectQuotationId,
        requestType: 'legal-review',
        title: 'Legal review handoff',
        department: 'legal',
        approverRole: 'manager',
        note: 'Need legal confirmation',
      }),
    });

    assert.equal(createApproval.response.status, 201);
    const approvalId = createApproval.body.id;
    assert.ok(approvalId);

    const updateApproval = await api(`/api/approval-requests/${approvalId}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        title: 'Legal review handoff updated',
        requestType: 'legal-review',
        status: 'pending',
        note: 'Updated legal confirmation',
      }),
    });

    assert.equal(updateApproval.response.status, 200);
    assert.equal(updateApproval.body.title, 'Legal review handoff updated');

    const decideApproval = await api(`/api/approval-requests/${approvalId}/decision`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ decision: 'approved', note: 'Approved for delivery' }),
    });

    assert.equal(decideApproval.response.status, 200);
    assert.equal(decideApproval.body.status, 'approved');

    const createDocument = await api(`/api/projects/${projectId}/project-documents`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        quotationId: projectQuotationId,
        documentCode: 'DOC-001',
        documentName: 'Delivery checklist',
        category: 'operations',
        department: 'warehouse',
        status: 'requested',
      }),
    });

    assert.equal(createDocument.response.status, 201);
    const documentId = createDocument.body.id;
    assert.ok(documentId);

    const updateDocument = await api(`/api/project-documents/${documentId}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        status: 'approved',
        note: 'Checklist verified',
      }),
    });

    assert.equal(updateDocument.response.status, 200);
    assert.equal(updateDocument.body.status, 'approved');
    assert.ok(updateDocument.body.receivedAt);

    const workflowPack1 = await api(`/api/projects/${projectId}/workflow-pack`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        packKey: 'sales-finance-procurement-warehouse',
        quotationId: projectQuotationId,
      }),
    });

    assert.equal(workflowPack1.response.status, 201);
    assert.ok(workflowPack1.body.tasks.length > 0);
    assert.ok(workflowPack1.body.approvals.length > 0);
    assert.ok(workflowPack1.body.documents.length > 0);

    const workflowPack2 = await api(`/api/projects/${projectId}/workflow-pack`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        packKey: 'sales-finance-procurement-warehouse',
        quotationId: projectQuotationId,
      }),
    });

    assert.equal(workflowPack2.response.status, 201);
    assert.deepEqual(
      workflowPack2.body.tasks.map((item) => item.id).sort(),
      workflowPack1.body.tasks.map((item) => item.id).sort()
    );
    assert.deepEqual(
      workflowPack2.body.approvals.map((item) => item.id).sort(),
      workflowPack1.body.approvals.map((item) => item.id).sort()
    );
    assert.deepEqual(
      workflowPack2.body.documents.map((item) => item.id).sort(),
      workflowPack1.body.documents.map((item) => item.id).sort()
    );

    const handoff = await api(`/api/projects/${projectId}/handoff`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        quotationId: projectQuotationId,
      }),
    });

    assert.equal(handoff.response.status, 201);
    assert.equal(handoff.body.projectStage, 'delivery');
    assert.equal(handoff.body.quotationId, projectQuotationId);
    assert.ok(handoff.body.salesOrder?.id);
    assert.ok(Array.isArray(handoff.body.tasks));

    const deleteApproval = await api(`/api/approval-requests/${approvalId}`, {
      method: 'DELETE',
      headers: authHeaders,
    });

    assert.equal(deleteApproval.response.status, 200);

    const deleteDocument = await api(`/api/project-documents/${documentId}`, {
      method: 'DELETE',
      headers: authHeaders,
    });

    assert.equal(deleteDocument.response.status, 200);
  });

  await run('project supplier quote rejects linked quotation from another project', async () => {
    const otherProject = await api('/api/projects', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        code: 'PRJ-QBU-002',
        name: 'Supplier quote validation project',
        projectStage: 'quoting',
      }),
    });

    assert.equal(otherProject.response.status, 201);
    const otherProjectId = otherProject.body.id;
    assert.ok(otherProjectId);

    const otherQuotation = await api(`/api/projects/${otherProjectId}/quotations`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        quoteNumber: 'Q-PROJ-002',
        subject: 'Other project quote',
        currency: 'VND',
        subtotal: 1000,
        taxTotal: 80,
        grandTotal: 1080,
        status: 'draft',
      }),
    });

    assert.equal(otherQuotation.response.status, 201);
    const otherQuotationId = otherQuotation.body.id;
    assert.ok(otherQuotationId);

    const invalidSupplierQuote = await api(`/api/projects/${projectId}/supplier-quotes`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        supplierId: null,
        linkedQuotationId: otherQuotationId,
        category: 'validation',
        quoteDate: '2026-03-27',
        validUntil: '2026-04-27',
        items: [],
        attachments: [],
      }),
    });

    assert.equal(invalidSupplierQuote.response.status, 400);
    assert.equal(invalidSupplierQuote.body.error, 'linkedQuotationId does not belong to this project');
  });

  await run('quotation create without grandTotal does not partially fail after insert', async () => {
    const create = await api('/api/quotations', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        quoteNumber: 'Q-NO-GRAND-001',
        subject: 'Missing grand total should not crash',
        currency: 'VND',
        subtotal: 2000,
        taxTotal: 160,
        status: 'draft',
        autoCreateProject: false,
      }),
    });

    assert.equal(create.response.status, 201);
    assert.equal(create.body.quoteNumber, 'Q-NO-GRAND-001');
    assert.equal(create.body.grandTotal, 0);

    const list = await api('/api/quotations');
    assert.equal(list.response.status, 200);
    assert.equal(list.body.filter((item) => item.quoteNumber === 'Q-NO-GRAND-001').length, 1);
  });

  await run('viewer cannot create standalone quotation', async () => {
    const viewerLogin = await login('pricing.viewer', 'Viewer@123');
    assert.equal(viewerLogin.response.status, 200);

    const forbidden = await api('/api/quotations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${viewerLogin.body.token}`,
      },
      body: JSON.stringify({
        quoteNumber: 'Q-VIEWER-001',
        subject: 'Viewer should be forbidden',
        currency: 'VND',
        subtotal: 1000,
        taxTotal: 80,
        grandTotal: 1080,
        status: 'draft',
        autoCreateProject: false,
      }),
    });

    assert.equal(forbidden.response.status, 403);
  });

  await run('project contract update rejects quotation from another project', async () => {
    const firstProject = await api('/api/projects', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        code: 'PRJ-CONTRACT-001',
        name: 'Contract validation project A',
        projectStage: 'quoting',
      }),
    });
    assert.equal(firstProject.response.status, 201);

    const secondProject = await api('/api/projects', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        code: 'PRJ-CONTRACT-002',
        name: 'Contract validation project B',
        projectStage: 'quoting',
      }),
    });
    assert.equal(secondProject.response.status, 201);

    const foreignQuotation = await api(`/api/projects/${secondProject.body.id}/quotations`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        quoteNumber: 'Q-FOREIGN-001',
        subject: 'Foreign project quotation',
        currency: 'VND',
        subtotal: 1000,
        taxTotal: 80,
        grandTotal: 1080,
        status: 'draft',
      }),
    });
    assert.equal(foreignQuotation.response.status, 201);

    const contract = await api(`/api/projects/${firstProject.body.id}/contracts`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        contractNumber: 'HD-CROSS-001',
        title: 'Contract cross validation',
        effectiveDate: '2026-03-26',
        quotationId: null,
        lineItems: [
          {
            itemCode: 'SKU-CROSS',
            itemName: 'Cross project item',
            contractQty: 1,
            unitPrice: 1000,
          },
        ],
      }),
    });
    assert.equal(contract.response.status, 201);

    const patched = await api(`/api/project-contracts/${contract.body.id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        quotationId: foreignQuotation.body.id,
      }),
    });

    assert.equal(patched.response.status, 400);
    assert.equal(patched.body.error, 'Quotation does not belong to this project');
  });

  await run('supplemental batch is created for delta and blocked once project is closed', async () => {
    const supplemental = await api(`/api/pricing/quotations/${quotationId}/supplemental-batches`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        projectId,
        reason: 'Actual chi phi vuot nguong, can mo batch bo sung',
        lineItems: [
          {
            section: 'C_OTHER',
            description: 'Supplemental support cost',
            quantityLabel: 'goi',
            unitCount: 1,
            buyUnitPriceVnd: 25000000,
            costRoutingType: 'OTHER_COST',
          },
        ],
      }),
    });

    assert.equal(supplemental.response.status, 201);
    assert.equal(supplemental.body.qbuType, 'SUPPLEMENTAL');
    assert.equal(supplemental.body.parentPricingQuotationId, quotationId);
    assert.equal(supplemental.body.batchNo, 1);

    const batches = await api(`/api/pricing/quotations/${quotationId}/batches`, {
      headers: authHeaders,
    });

    assert.equal(batches.response.status, 200);
    assert.equal(batches.body.length, 2);

    const closeProject = await api(`/api/projects/${projectId}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        code: 'PRJ-QBU-001',
        name: 'QBU Workflow Project',
        projectStage: 'closed',
        status: 'completed',
      }),
    });

    assert.equal(closeProject.response.status, 200);

    const blockedSupplemental = await api(`/api/pricing/quotations/${quotationId}/supplemental-batches`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        projectId,
        reason: 'Should be blocked because project is closed',
        lineItems: [
          {
            section: 'C_OTHER',
            description: 'Blocked supplemental',
            quantityLabel: 'goi',
            unitCount: 1,
            buyUnitPriceVnd: 10000000,
            costRoutingType: 'OTHER_COST',
          },
        ],
      }),
    });

    assert.equal(blockedSupplemental.response.status, 400);
  });

  await teardown();

  if (failures > 0) {
    process.exitCode = 1;
  }
}

main().catch(async (error) => {
  failures += 1;
  console.error(error);
  await teardown();
  process.exitCode = 1;
});
