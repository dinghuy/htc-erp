import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { AddressInfo } from 'node:net';

const backendDir = path.resolve(__dirname, '..');
const tmpDir = path.join(backendDir, 'tmp');
fs.mkdirSync(tmpDir, { recursive: true });
const dbPath = path.join(tmpDir, `project-contract-workspace-${Date.now()}.sqlite`);

process.env.DB_PATH = dbPath;
process.env.SEED_DB = 'false';
process.env.JWT_SECRET = 'test-secret';

const { initDb, getDb } = require('../sqlite-db');
const { app } = require('../server');

type JsonRecord = Record<string, any>;

async function api<T = JsonRecord>(baseUrl: string, pathname: string, init: RequestInit = {}) {
  const res = await fetch(`${baseUrl}${pathname}`, init);
  const text = await res.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { rawText: text };
    }
  }
  return { res, data: data as T };
}

async function login(baseUrl: string) {
  const { res, data } = await api<{ token: string }>(baseUrl, '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  assert.equal(res.status, 200, `login failed: ${JSON.stringify(data)}`);
  return data.token;
}

async function main() {
  await initDb();
  const db = getDb();
  const server = app.listen(0);
  const baseUrl = await new Promise<string>((resolve) => {
    server.on('listening', () => {
      const address = server.address() as AddressInfo;
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });

  try {
    const token = await login(baseUrl);
    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    const accountId = 'acc-contract-hub';
    const supplierId = 'sup-contract-hub';

    await db.run(
      `INSERT INTO Account (id, companyName, accountType, status) VALUES (?, ?, 'Customer', 'active')`,
      [accountId, 'Contract Workspace Customer']
    );
    await db.run(
      `INSERT INTO Account (id, companyName, accountType, status) VALUES (?, ?, 'Supplier', 'active')`,
      [supplierId, 'Contract Workspace Supplier']
    );

    const createQuotation = await api<JsonRecord>(baseUrl, '/api/quotations', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        quoteNumber: 'QT-CT-001',
        quoteDate: '2026-03-25',
        subject: 'Contract-centric workspace',
        accountId,
        salesperson: 'Administrator',
        currency: 'VND',
        items: [{ sku: 'PRD-01', name: 'Main unit', quantity: 2, unitPrice: 1000000 }],
        subtotal: 2000000,
        taxTotal: 160000,
        grandTotal: 2160000,
        status: 'draft',
      }),
    });
    assert.equal(createQuotation.res.status, 201, `create quotation failed: ${JSON.stringify(createQuotation.data)}`);
    const projectId = createQuotation.data.projectId;
    assert.ok(projectId, 'quotation should auto-create project');

    const createQbu = await api<JsonRecord>(baseUrl, '/api/pricing/quotations', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        projectId,
        projectCode: 'PRJ-CT-001',
        customerName: 'Contract Workspace Customer',
        supplierName: 'Contract Workspace Supplier',
        salePerson: 'Administrator',
        date: '2026-03-25',
        lineItems: [
          {
            section: 'A_MAIN',
            description: 'Main unit',
            quantityLabel: '2 units',
            unitCount: 2,
            costRoutingType: 'DIRECT_IMPORT',
            sellUnitPriceVnd: 1000000,
            buyUnitPriceVnd: 800000,
            buyUnitPriceUsd: 30,
          },
        ],
      }),
    });
    assert.equal(createQbu.res.status, 201, `create qbu failed: ${JSON.stringify(createQbu.data)}`);

    const submitQbu = await api<JsonRecord>(baseUrl, `/api/pricing/quotations/${createQbu.data.id}/submit-qbu`, {
      method: 'POST',
      headers: authHeaders,
    });
    assert.equal(submitQbu.res.status, 200, `submit qbu failed: ${JSON.stringify(submitQbu.data)}`);

    const createMainContract = await api<JsonRecord>(baseUrl, `/api/projects/${projectId}/contracts`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        contractNumber: 'HD-001',
        title: 'Hop dong chinh',
        signedDate: '2026-03-26',
        effectiveDate: '2026-03-27',
        status: 'signed',
        currency: 'VND',
        totalValue: 2160000,
        summary: 'Baseline theo hop dong da ky',
        lineItems: [
          {
            itemCode: 'PRD-01',
            itemName: 'Main unit',
            description: 'Main unit from signed contract',
            unit: 'unit',
            contractQty: 2,
            unitPrice: 1080000,
            etaDate: '2026-04-10',
            committedDeliveryDate: '2026-04-20',
          },
        ],
      }),
    });
    assert.equal(createMainContract.res.status, 201, `create main contract failed: ${JSON.stringify(createMainContract.data)}`);

    let workspace = await api<JsonRecord>(baseUrl, `/api/projects/${projectId}`);
    assert.equal(workspace.res.status, 200);
    assert.ok(workspace.data.mainContract?.id, 'workspace should expose main contract');
    assert.ok(Array.isArray(workspace.data.executionBaselines), 'workspace should expose baselines');
    assert.equal(workspace.data.executionBaselines.length, 1, 'main contract should generate first baseline');
    assert.ok(Array.isArray(workspace.data.procurementLines), 'workspace should expose procurement lines');
    assert.equal(workspace.data.procurementLines.length, 1, 'main contract baseline should create procurement line');

    const createAppendix = await api<JsonRecord>(baseUrl, `/api/projects/${projectId}/contracts/${createMainContract.data.id}/appendices`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        appendixNumber: 'PL-001',
        title: 'Phu luc tang so luong',
        signedDate: '2026-03-28',
        effectiveDate: '2026-03-29',
        status: 'effective',
        totalDeltaValue: 1080000,
        summary: 'Tang so luong giao hang',
        lineItems: [
          {
            itemCode: 'PRD-01',
            itemName: 'Main unit',
            description: 'Main unit updated by appendix',
            unit: 'unit',
            contractQty: 3,
            unitPrice: 1080000,
            etaDate: '2026-04-12',
            committedDeliveryDate: '2026-04-24',
          },
        ],
      }),
    });
    assert.equal(createAppendix.res.status, 201, `create appendix failed: ${JSON.stringify(createAppendix.data)}`);

    const updateAppendix = await api<JsonRecord>(baseUrl, `/api/project-contract-appendices/${createAppendix.data.id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        appendixNumber: 'PL-001-R1',
        title: 'Phu luc tang them so luong',
        signedDate: '2026-03-29',
        effectiveDate: '2026-03-30',
        status: 'effective',
        totalDeltaValue: 2160000,
        summary: 'Tang so luong len 4',
        lineItems: [
          {
            itemCode: 'PRD-01',
            itemName: 'Main unit',
            description: 'Main unit updated by appendix revision',
            unit: 'unit',
            contractQty: 4,
            unitPrice: 1080000,
            etaDate: '2026-04-13',
            committedDeliveryDate: '2026-04-25',
          },
        ],
      }),
    });
    assert.equal(updateAppendix.res.status, 200, `update appendix failed: ${JSON.stringify(updateAppendix.data)}`);

    workspace = await api<JsonRecord>(baseUrl, `/api/projects/${projectId}`);
    assert.equal(workspace.res.status, 200);
    assert.equal(workspace.data.executionBaselines.length, 3, 'appendix update should create another baseline');
    assert.equal(workspace.data.currentBaseline?.sourceType, 'appendix');
    assert.equal(workspace.data.procurementLines[0].contractQty, 4, 'procurement line should sync to current baseline qty');

    const updateProcurement = await api<JsonRecord>(baseUrl, `/api/project-procurement-lines/${workspace.data.procurementLines[0].id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        supplierId,
        poNumber: 'PO-001',
        orderedQty: 4,
        etaDate: '2026-04-11',
        status: 'ordered',
        note: 'PO sent to supplier',
      }),
    });
    assert.equal(updateProcurement.res.status, 200, `update procurement failed: ${JSON.stringify(updateProcurement.data)}`);
    assert.equal(updateProcurement.data.orderedQty, 4);

    const createInbound = await api<JsonRecord>(baseUrl, `/api/projects/${projectId}/inbound-lines`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        procurementLineId: updateProcurement.data.id,
        receivedQty: 2,
        etaDate: '2026-04-11',
        actualReceivedDate: '2026-04-12',
        status: 'partial',
        receiptRef: 'GRN-001',
        note: 'First inbound batch',
      }),
    });
    assert.equal(createInbound.res.status, 201, `create inbound failed: ${JSON.stringify(createInbound.data)}`);

    const updateInbound = await api<JsonRecord>(baseUrl, `/api/project-inbound-lines/${createInbound.data.id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        procurementLineId: updateProcurement.data.id,
        receivedQty: 3,
        etaDate: '2026-04-12',
        actualReceivedDate: '2026-04-13',
        status: 'partial',
        receiptRef: 'GRN-001-R1',
        note: 'Updated inbound batch',
      }),
    });
    assert.equal(updateInbound.res.status, 200, `update inbound failed: ${JSON.stringify(updateInbound.data)}`);

    const createDelivery = await api<JsonRecord>(baseUrl, `/api/projects/${projectId}/delivery-lines`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        procurementLineId: updateProcurement.data.id,
        deliveredQty: 1,
        committedDate: '2026-04-24',
        actualDeliveryDate: '2026-04-22',
        status: 'partial',
        deliveryRef: 'DN-001',
        note: 'Delivered batch 1',
      }),
    });
    assert.equal(createDelivery.res.status, 201, `create delivery failed: ${JSON.stringify(createDelivery.data)}`);

    const updateDelivery = await api<JsonRecord>(baseUrl, `/api/project-delivery-lines/${createDelivery.data.id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        procurementLineId: updateProcurement.data.id,
        deliveredQty: 2,
        committedDate: '2026-04-25',
        actualDeliveryDate: '2026-04-24',
        status: 'partial',
        deliveryRef: 'DN-001-R1',
        note: 'Updated delivery batch',
      }),
    });
    assert.equal(updateDelivery.res.status, 200, `update delivery failed: ${JSON.stringify(updateDelivery.data)}`);

    const createMilestone = await api<JsonRecord>(baseUrl, `/api/projects/${projectId}/milestones`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        title: 'Kickoff after signed contract',
        milestoneType: 'kickoff',
        plannedDate: '2026-03-30',
        actualDate: '2026-03-30',
        status: 'completed',
        note: 'Kickoff completed',
      }),
    });
    assert.equal(createMilestone.res.status, 201, `create milestone failed: ${JSON.stringify(createMilestone.data)}`);

    const updateMilestone = await api<JsonRecord>(baseUrl, `/api/project-milestones/${createMilestone.data.id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        title: 'Kickoff revised',
        milestoneType: 'kickoff',
        plannedDate: '2026-03-31',
        actualDate: '2026-03-31',
        status: 'completed',
        note: 'Kickoff revised and completed',
      }),
    });
    assert.equal(updateMilestone.res.status, 200, `update milestone failed: ${JSON.stringify(updateMilestone.data)}`);

    workspace = await api<JsonRecord>(baseUrl, `/api/projects/${projectId}`);
    assert.equal(workspace.res.status, 200);
    assert.ok(Array.isArray(workspace.data.contractAppendices), 'workspace should expose appendices');
    assert.equal(workspace.data.contractAppendices.length, 1);
    assert.ok(Array.isArray(workspace.data.inboundLines), 'workspace should expose inbound lines');
    assert.equal(workspace.data.inboundLines.length, 1);
    assert.ok(Array.isArray(workspace.data.deliveryLines), 'workspace should expose delivery lines');
    assert.equal(workspace.data.deliveryLines.length, 1);
    assert.ok(Array.isArray(workspace.data.milestones), 'workspace should expose milestones');
    assert.equal(workspace.data.milestones.length, 1);
    assert.ok(Array.isArray(workspace.data.qbuRounds), 'workspace should expose QBU rounds');
    assert.ok(workspace.data.qbuRounds.length >= 1);
    assert.ok(Array.isArray(workspace.data.timeline), 'workspace should expose contract timeline');
    assert.ok(
      workspace.data.timeline.some((event: any) => String(event.eventType || '').includes('contract.main.created')),
      'timeline should include main contract creation event'
    );
    assert.ok(
      workspace.data.timeline.some((event: any) => String(event.eventType || '').includes('appendix.created')),
      'timeline should include appendix creation event'
    );
    assert.ok(
      workspace.data.timeline.some((event: any) => String(event.eventType || '').includes('inbound.updated')),
      'timeline should include inbound update event'
    );
    assert.ok(
      workspace.data.timeline.some((event: any) => String(event.eventType || '').includes('delivery.updated')),
      'timeline should include delivery update event'
    );
    assert.ok(
      workspace.data.timeline.some((event: any) => String(event.eventType || '').includes('milestone.updated')),
      'timeline should include milestone update event'
    );
    assert.equal(workspace.data.procurementLines[0].receivedQty, 3, 'updated inbound should roll up to procurement line');
    assert.equal(workspace.data.procurementLines[0].deliveredQty, 2, 'updated delivery should roll up to procurement line');
    assert.equal(workspace.data.milestones[0].title, 'Kickoff revised', 'milestone should be updated');

    console.log('project contract workspace tests passed');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err?: Error) => (err ? reject(err) : resolve())));
    try {
      fs.rmSync(dbPath, { force: true });
      fs.rmSync(`${dbPath}-wal`, { force: true });
      fs.rmSync(`${dbPath}-shm`, { force: true });
    } catch {
      // ignore cleanup issues
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
