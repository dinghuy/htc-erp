import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { AddressInfo } from 'node:net';

const backendDir = path.resolve(__dirname, '..');
const tmpDir = path.join(backendDir, 'tmp');
fs.mkdirSync(tmpDir, { recursive: true });
const dbPath = path.join(tmpDir, `project-centric-${Date.now()}.sqlite`);

process.env.DB_PATH = dbPath;
process.env.SEED_DB = 'false';
process.env.JWT_SECRET = 'test-secret';

const { initDb, getDb } = require('../sqlite-db');
const { app } = require('../server');

type JsonRecord = Record<string, any>;

async function api<T = JsonRecord>(baseUrl: string, pathname: string, init: RequestInit = {}) {
  const res = await fetch(`${baseUrl}${pathname}`, init);
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
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

    const accountId = 'acc-project-centric';
    await db.run(
      `INSERT INTO Account (id, companyName, accountType, status) VALUES (?, ?, 'Customer', 'active')`,
      [accountId, 'Project Centric Customer']
    );

    const supplierId = 'sup-project-centric';
    await db.run(
      `INSERT INTO Account (id, companyName, accountType, status) VALUES (?, ?, 'Supplier', 'active')`,
      [supplierId, 'Project Centric Supplier']
    );

    const createQuotation = await api<JsonRecord>(baseUrl, '/api/quotations', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        quoteNumber: 'QT-PC-001',
        quoteDate: '2026-03-24',
        subject: 'Quotation drives project workspace',
        accountId,
        salesperson: 'Administrator',
        currency: 'VND',
        items: [{ sku: 'SKU-1', name: 'Item 1', quantity: 1, unitPrice: 1000000 }],
        subtotal: 1000000,
        taxTotal: 80000,
        grandTotal: 1080000,
        status: 'draft',
      }),
    });

    assert.equal(createQuotation.res.status, 201, `create quotation failed: ${JSON.stringify(createQuotation.data)}`);
    assert.ok(createQuotation.data.projectId, 'quotation should be linked to an auto-created project');
    assert.equal(createQuotation.data.revisionNo, 1, 'first quotation should start at revision 1');

    const projectId = createQuotation.data.projectId;
    const projectWorkspace = await api<JsonRecord>(baseUrl, `/api/projects/${projectId}`);
    assert.equal(projectWorkspace.res.status, 200, `project detail failed: ${JSON.stringify(projectWorkspace.data)}`);
    assert.equal(projectWorkspace.data.id, projectId);
    assert.equal(projectWorkspace.data.quotationCount, 1);
    assert.equal(projectWorkspace.data.latestQuotationId, createQuotation.data.id);
    assert.ok(Array.isArray(projectWorkspace.data.quotations), 'workspace should include quotation history');
    assert.equal(projectWorkspace.data.quotations.length, 1);

    const reviseQuotation = await api<JsonRecord>(baseUrl, `/api/quotations/${createQuotation.data.id}/revise`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        quoteNumber: 'QT-PC-001-R2',
        changeReason: 'Customer asked for revised price',
        subtotal: 1200000,
        taxTotal: 96000,
        grandTotal: 1296000,
      }),
    });

    assert.equal(reviseQuotation.res.status, 201, `revise quotation failed: ${JSON.stringify(reviseQuotation.data)}`);
    assert.equal(reviseQuotation.data.projectId, projectId);
    assert.equal(reviseQuotation.data.parentQuotationId, createQuotation.data.id);
    assert.equal(reviseQuotation.data.revisionNo, 2);

    const supplierQuote = await api<JsonRecord>(baseUrl, `/api/projects/${projectId}/supplier-quotes`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        supplierId,
        category: 'Máy nguyên chiếc',
        quoteDate: '2026-03-24',
        validUntil: '2026-04-15',
        linkedQuotationId: reviseQuotation.data.id,
        changeReason: 'Input for revision 2',
      }),
    });
    assert.equal(supplierQuote.res.status, 201, `project supplier quote failed: ${JSON.stringify(supplierQuote.data)}`);
    assert.equal(supplierQuote.data.projectId, projectId);

    const taskTemplates = await api<JsonRecord>(baseUrl, `/api/projects/${projectId}/task-templates`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        templateKey: 'quotation-sent',
        quotationId: reviseQuotation.data.id,
      }),
    });
    assert.equal(taskTemplates.res.status, 201, `task template generation failed: ${JSON.stringify(taskTemplates.data)}`);
    assert.ok(Array.isArray(taskTemplates.data.tasks));
    assert.ok(taskTemplates.data.tasks.length >= 1);

    const workflowPack = await api<JsonRecord>(baseUrl, `/api/projects/${projectId}/workflow-pack`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        packKey: 'sales-finance-procurement-warehouse',
        quotationId: reviseQuotation.data.id,
      }),
    });
    assert.equal(workflowPack.res.status, 201, `workflow pack failed: ${JSON.stringify(workflowPack.data)}`);
    assert.ok(Array.isArray(workflowPack.data.tasks));
    assert.ok(workflowPack.data.tasks.some((t: any) => t.department === 'Finance'));
    assert.ok(Array.isArray(workflowPack.data.approvals));
    assert.ok(workflowPack.data.approvals.length >= 1);
    assert.ok(Array.isArray(workflowPack.data.documents));
    assert.ok(workflowPack.data.documents.length >= 1);

    const sendRevision = await api<JsonRecord>(baseUrl, `/api/quotations/${reviseQuotation.data.id}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        ...reviseQuotation.data,
        status: 'sent',
        expectedStatus: 'draft',
      }),
    });
    assert.equal(sendRevision.res.status, 200, `send revision failed: ${JSON.stringify(sendRevision.data)}`);

    const acceptRevision = await api<JsonRecord>(baseUrl, `/api/quotations/${reviseQuotation.data.id}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        ...sendRevision.data,
        status: 'accepted',
        expectedStatus: 'sent',
      }),
    });
    assert.equal(acceptRevision.res.status, 200, `accept revision failed: ${JSON.stringify(acceptRevision.data)}`);

    const projectAfterAccept = await api<JsonRecord>(baseUrl, `/api/projects/${projectId}`);
    assert.equal(projectAfterAccept.res.status, 200);
    assert.equal(projectAfterAccept.data.projectStage, 'won');
    assert.equal(projectAfterAccept.data.latestQuotationId, reviseQuotation.data.id);
    assert.equal(projectAfterAccept.data.supplierQuoteCount, 1);
    assert.ok(projectAfterAccept.data.openTaskCount >= 1);
    assert.ok(Array.isArray(projectAfterAccept.data.approvals), 'workspace should include approvals');
    assert.ok(Array.isArray(projectAfterAccept.data.documents), 'workspace should include project documents');

    const firstApproval = projectAfterAccept.data.approvals[0];
    assert.ok(firstApproval?.id, 'approval request should exist');

    const approve = await api<JsonRecord>(baseUrl, `/api/approval-requests/${firstApproval.id}/decision`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        decision: 'approved',
        note: 'Approved in test',
      }),
    });
    assert.equal(approve.res.status, 200, `approval decision failed: ${JSON.stringify(approve.data)}`);
    assert.equal(approve.data.status, 'approved');

    const firstDocument = projectAfterAccept.data.documents[0];
    assert.ok(firstDocument?.id, 'project document checklist should exist');
    const markDocument = await api<JsonRecord>(baseUrl, `/api/project-documents/${firstDocument.id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        status: 'received',
        note: 'Uploaded in test',
      }),
    });
    assert.equal(markDocument.res.status, 200, `document update failed: ${JSON.stringify(markDocument.data)}`);
    assert.equal(markDocument.data.status, 'received');

    const customApproval = await api<JsonRecord>(baseUrl, `/api/projects/${projectId}/approval-requests`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        quotationId: reviseQuotation.data.id,
        requestType: 'technical-report',
        title: 'Technical report review by Tech Lead',
        department: 'Technical',
        approverRole: 'manager',
        note: 'Manual approval request from test',
      }),
    });
    assert.equal(customApproval.res.status, 201, `custom approval create failed: ${JSON.stringify(customApproval.data)}`);
    assert.equal(customApproval.data.department, 'Technical');

    const updateApproval = await api<JsonRecord>(baseUrl, `/api/approval-requests/${customApproval.data.id}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        title: 'Technical report review by Technical Manager',
        approverRole: 'manager',
        note: 'Updated in test',
      }),
    });
    assert.equal(updateApproval.res.status, 200, `approval update failed: ${JSON.stringify(updateApproval.data)}`);
    assert.equal(updateApproval.data.title, 'Technical report review by Technical Manager');

    const customDocument = await api<JsonRecord>(baseUrl, `/api/projects/${projectId}/project-documents`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        quotationId: reviseQuotation.data.id,
        documentCode: 'WR',
        documentName: 'Work Report',
        category: 'Service',
        department: 'Technical',
        requiredAtStage: 'delivery',
        note: 'Manual doc from test',
      }),
    });
    assert.equal(customDocument.res.status, 201, `custom document create failed: ${JSON.stringify(customDocument.data)}`);
    assert.equal(customDocument.data.documentCode, 'WR');

    const updateCustomDocument = await api<JsonRecord>(baseUrl, `/api/project-documents/${customDocument.data.id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        status: 'approved',
        note: 'Approved in test',
      }),
    });
    assert.equal(updateCustomDocument.res.status, 200, `custom document update failed: ${JSON.stringify(updateCustomDocument.data)}`);
    assert.equal(updateCustomDocument.data.status, 'approved');

    const handoff = await api<JsonRecord>(baseUrl, `/api/projects/${projectId}/handoff`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        quotationId: reviseQuotation.data.id,
      }),
    });
    assert.equal(handoff.res.status, 201, `project handoff failed: ${JSON.stringify(handoff.data)}`);
    assert.ok(handoff.data.salesOrder?.id, 'handoff should return sales order');
    assert.ok(Array.isArray(handoff.data.tasks), 'handoff should return delivery tasks');
    assert.ok(handoff.data.tasks.some((t: any) => t.department === 'Warehouse'));

    const projectAfterHandoff = await api<JsonRecord>(baseUrl, `/api/projects/${projectId}`);
    assert.equal(projectAfterHandoff.res.status, 200);
    assert.equal(projectAfterHandoff.data.projectStage, 'delivery');
    assert.ok(Array.isArray(projectAfterHandoff.data.salesOrders), 'workspace should include sales orders');
    assert.ok(projectAfterHandoff.data.salesOrders.length >= 1);

    const deleteApproval = await api<JsonRecord>(baseUrl, `/api/approval-requests/${customApproval.data.id}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    assert.equal(deleteApproval.res.status, 200, `approval delete failed: ${JSON.stringify(deleteApproval.data)}`);

    const deleteDocument = await api<JsonRecord>(baseUrl, `/api/project-documents/${customDocument.data.id}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    assert.equal(deleteDocument.res.status, 200, `document delete failed: ${JSON.stringify(deleteDocument.data)}`);

    console.log('project-centric tests passed');
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
