require('ts-node/register/transpile-only');

const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { Jimp } = require('jimp');
const XLSX = require('xlsx');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-products-'));
process.env.DB_PATH = path.join(tempDir, 'crm-products.db');

const { initDb, getDb } = require('../sqlite-db.ts');
const { app } = require('../server.ts');

let server;
let baseUrl;
let failures = 0;
let authToken = '';

async function api(pathname, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (authToken && !Object.prototype.hasOwnProperty.call(headers, 'Authorization')) {
    headers.Authorization = `Bearer ${authToken}`;
  }
  const response = await fetch(`${baseUrl}${pathname}`, { ...options, headers });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  return { response, body };
}

async function fetchBinary(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const buffer = Buffer.from(await response.arrayBuffer());
  return { response, buffer };
}

async function createPngBuffer(color) {
  const image = new Jimp({ width: 8, height: 8, color });
  return Buffer.from(await image.getBuffer('image/png'));
}

async function createVideoBuffer() {
  return fs.readFileSync(path.join(__dirname, 'tiny.mp4'));
}

function createWebpStandInBuffer() {
  return Buffer.from('RIFF-webp-runtime-standin-payload', 'utf8');
}

async function login() {
  const result = await api('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  assert.equal(result.response.status, 200);
  assert.ok(result.body?.token);
  authToken = result.body.token;
}

function withAuth(options = {}) {
  return {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${authToken}`,
    },
  };
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

let legacyProductOneId = '';
let legacyProductTwoId = '';

async function setup() {
  await initDb();
  const db = getDb();
  const legacyProductOne = await db.run(
    `INSERT INTO Product (
      sku, name, category, unit, basePrice, currency, specifications, media, qbuData, technicalSpecs, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'LEG-001',
      'Legacy Product One',
      'Legacy',
      'Chiếc',
      12345,
      'USD',
      'plain legacy specification text',
      'not-json-array',
      'not-json-object',
      'Legacy technical specs',
      'available',
    ]
  );

  const legacyProductTwo = await db.run(
    `INSERT INTO Product (
      sku, name, category, unit, basePrice, currency, specifications, media, qbuData, technicalSpecs, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'LEG-002',
      'Legacy Product Two',
      'Legacy',
      'Chiếc',
      18000,
      'USD',
      '{}',
      JSON.stringify([
        { title: 'Front view', url: '/uploads/legacy/front-view.png', mimeType: 'image/png' },
        { title: 'Catalogue PDF', url: '/uploads/legacy/catalogue.pdf', mimeType: 'application/pdf' },
      ]),
      '{}',
      'Legacy technical specs 2',
      'available',
    ]
  );

  await db.run(
    `INSERT INTO ExchangeRate (
      baseCurrency, quoteCurrency, effectiveDate, rateValue, source
    ) VALUES (?, ?, ?, ?, ?)`,
    ['USD', 'VND', '2026-03-25', 25888, 'vcb']
  );

  legacyProductOneId = String(legacyProductOne.lastID);
  legacyProductTwoId = String(legacyProductTwo.lastID);

  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
  await login();
}

async function teardown() {
  if (server) {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

async function main() {
  await setup();

  const transparentPngBuffer = await createPngBuffer(0x00000000);
  const solidPngBuffer = await createPngBuffer(0xff0000ff);
  const sourceWebpBuffer = createWebpStandInBuffer();
  const sourceVideoBuffer = await createVideoBuffer();

  await run('product catalog endpoints require authentication', async () => {
    const list = await api('/api/products', { headers: { Authorization: '' } });
    assert.equal(list.response.status, 401);

    const detail = await api(`/api/products/${legacyProductOneId}`, { headers: { Authorization: '' } });
    assert.equal(detail.response.status, 401);
  });

  await run('legacy product rows do not crash GET /api/products and return safe fallback types', async () => {
    const result = await api('/api/products');

    assert.equal(result.response.status, 200);
    assert.equal(Array.isArray(result.body), true);

    const row = result.body.find((item) => String(item.id) === legacyProductOneId);
    assert.ok(row);
    assert.deepEqual(row.specifications, { text: 'plain legacy specification text' });
    assert.deepEqual(row.media, []);
    assert.deepEqual(row.qbuData, {});
  });

  await run('legacy product rows do not crash GET /api/products/:id and return safe fallback types', async () => {
    const result = await api(`/api/products/${legacyProductOneId}`);

    assert.equal(result.response.status, 200);
    assert.equal(String(result.body.id), legacyProductOneId);
    assert.deepEqual(result.body.specifications, { text: 'plain legacy specification text' });
    assert.deepEqual(result.body.media, []);
    assert.deepEqual(result.body.qbuData, {});
  });

  await run('legacy media is split into productImages and productDocuments fallback fields', async () => {
    const result = await api(`/api/products/${legacyProductTwoId}`);

    assert.equal(result.response.status, 200);
    assert.equal(Array.isArray(result.body.productImages), true);
    assert.equal(Array.isArray(result.body.productDocuments), true);
    assert.equal(result.body.productImages.length, 1);
    assert.equal(result.body.productDocuments.length, 1);
    assert.equal(result.body.productImages[0].title, 'Front view');
    assert.equal(result.body.productDocuments[0].title, 'Catalogue PDF');
  });

  await run('POST /api/products persists productImages and productDocuments', async () => {
    const payload = {
      sku: 'NEW-IMG-001',
      name: 'Product With Assets',
      category: 'Service',
      unit: 'Gói',
      basePrice: 1500,
      technicalSpecs: 'SLA 4h',
      productImages: [
        { id: 'img-1', title: 'Hero image', url: 'https://example.com/hero.webp', sourceType: 'url' },
      ],
      productDocuments: [
        { id: 'doc-1', title: 'Brochure', url: 'https://example.com/brochure.pdf', sourceType: 'url' },
      ],
    };
    const create = await api('/api/products', withAuth({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }));

    assert.equal(create.response.status, 201);
    assert.equal(create.body.productImages.length, 1);
    assert.equal(create.body.productDocuments.length, 1);
    assert.equal(create.body.productImages[0].title, 'Hero image');
    assert.equal(create.body.productDocuments[0].title, 'Brochure');

    const readBack = await api(`/api/products/${create.body.id}`);
    assert.equal(readBack.response.status, 200);
    assert.equal(readBack.body.productImages[0].url, 'https://example.com/hero.webp');
    assert.equal(readBack.body.productDocuments[0].url, 'https://example.com/brochure.pdf');
  });

  await run('product asset upload endpoints store file metadata and append /uploads urls', async () => {
    const create = await api('/api/products', withAuth({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sku: 'UPLOAD-001',
        name: 'Upload Product',
        category: 'Parts',
        unit: 'Chiếc',
        basePrice: 10,
      }),
    }));

    assert.equal(create.response.status, 201);

    const imageForm = new FormData();
    imageForm.append('file', new Blob([solidPngBuffer], { type: 'image/png' }), 'product-shot.png');
    imageForm.append('title', 'Product shot');
    imageForm.append('isPrimary', 'true');

    const imageUpload = await api(`/api/products/${create.body.id}/images`, withAuth({
      method: 'POST',
      body: imageForm,
    }));

    assert.equal(imageUpload.response.status, 200);
    assert.equal(imageUpload.body.title, 'Product shot');
    assert.match(imageUpload.body.url, /^\/uploads\/products\//);
    assert.equal(imageUpload.body.mimeType, 'image/jpeg');

    const documentForm = new FormData();
    documentForm.append('file', new Blob(['fake-pdf'], { type: 'application/pdf' }), 'manual.pdf');
    documentForm.append('title', 'Manual');
    documentForm.append('description', 'Installation guide');

    const documentUpload = await api(`/api/products/${create.body.id}/documents`, withAuth({
      method: 'POST',
      body: documentForm,
    }));

    assert.equal(documentUpload.response.status, 200);
    assert.equal(documentUpload.body.title, 'Manual');
    assert.equal(documentUpload.body.description, 'Installation guide');
    assert.match(documentUpload.body.url, /^\/uploads\/products\//);
    assert.equal(documentUpload.body.mimeType, 'application/pdf');

    const readBack = await api(`/api/products/${create.body.id}`);
    assert.equal(readBack.response.status, 200);
    assert.equal(readBack.body.productImages.length, 1);
    assert.equal(readBack.body.productDocuments.length, 1);
    assert.equal(readBack.body.productImages[0].title, 'Product shot');
    assert.equal(readBack.body.productImages[0].isPrimary, true);
    assert.equal(readBack.body.productDocuments[0].title, 'Manual');
  });

  await run('replacing and deleting uploaded product images updates DB and cleans stored files', async () => {
    const create = await api('/api/products', withAuth({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sku: 'UPLOAD-REPLACE-001',
        name: 'Replace Upload Product',
        category: 'Parts',
        unit: 'Chiếc',
        basePrice: 10,
      }),
    }));

    assert.equal(create.response.status, 201);

    const firstImageForm = new FormData();
    firstImageForm.append('file', new Blob([solidPngBuffer], { type: 'image/png' }), 'first-shot.png');
    firstImageForm.append('title', 'First shot');

    const firstUpload = await api(`/api/products/${create.body.id}/images`, withAuth({
      method: 'POST',
      body: firstImageForm,
    }));

    assert.equal(firstUpload.response.status, 200);
    const firstAssetId = firstUpload.body.id;
    const firstAssetUrl = firstUpload.body.url;

    const secondImageForm = new FormData();
    secondImageForm.append('file', new Blob([transparentPngBuffer], { type: 'image/png' }), 'replaced-shot.png');
    secondImageForm.append('title', 'Primary recrop');
    secondImageForm.append('isPrimary', 'true');
    secondImageForm.append('replaceAssetId', firstAssetId);

    const replaceUpload = await api(`/api/products/${create.body.id}/images`, withAuth({
      method: 'POST',
      body: secondImageForm,
    }));

    assert.equal(replaceUpload.response.status, 200);
    assert.notEqual(replaceUpload.body.url, firstAssetUrl);

    const oldDownload = await fetchBinary(firstAssetUrl);
    assert.equal(oldDownload.response.status, 404);

    const afterReplace = await api(`/api/products/${create.body.id}`);
    assert.equal(afterReplace.response.status, 200);
    assert.equal(afterReplace.body.productImages.length, 1);
    assert.equal(afterReplace.body.productImages[0].title, 'Primary recrop');
    assert.equal(afterReplace.body.productImages[0].isPrimary, true);

    const deleteAsset = await api(`/api/products/${create.body.id}/assets/image/${replaceUpload.body.id}`, withAuth({
      method: 'DELETE',
    }));
    assert.equal(deleteAsset.response.status, 200);
    assert.equal(deleteAsset.body.success, true);

    const deletedDownload = await fetchBinary(replaceUpload.body.url);
    assert.equal(deletedDownload.response.status, 404);

    const afterDelete = await api(`/api/products/${create.body.id}`);
    assert.equal(afterDelete.response.status, 200);
    assert.equal(afterDelete.body.productImages.length, 0);
  });

  await run('product image uploads preserve transparent PNG assets and remain downloadable', async () => {
    const create = await api('/api/products', withAuth({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sku: 'UPLOAD-PNG-ALPHA',
        name: 'Transparent Upload Product',
        category: 'Parts',
        unit: 'Chiếc',
        basePrice: 10,
      }),
    }));

    assert.equal(create.response.status, 201);

    const imageForm = new FormData();
    imageForm.append('file', new Blob([transparentPngBuffer], { type: 'image/png' }), 'transparent-logo.png');
    imageForm.append('title', 'Transparent logo');

    const imageUpload = await api(`/api/products/${create.body.id}/images`, withAuth({
      method: 'POST',
      body: imageForm,
    }));

    assert.equal(imageUpload.response.status, 200);
    assert.equal(imageUpload.body.mimeType, 'image/png');
    assert.match(imageUpload.body.url, /\.png$/);
    assert.equal(imageUpload.body.fileName, 'transparent-logo.png');

    const download = await fetchBinary(imageUpload.body.url);
    assert.equal(download.response.status, 200);
    assert.equal(download.response.headers.get('content-type'), 'image/png');
    assert.ok(download.buffer.length > 0);
  });

  await run('opaque PNG product images are normalized to JPEG and remain downloadable', async () => {
    const create = await api('/api/products', withAuth({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sku: 'UPLOAD-PNG-JPEG',
        name: 'Opaque Upload Product',
        category: 'Parts',
        unit: 'Chiếc',
        basePrice: 10,
      }),
    }));

    assert.equal(create.response.status, 201);

    const imageForm = new FormData();
    imageForm.append('file', new Blob([solidPngBuffer], { type: 'image/png' }), 'product-shot.png');
    imageForm.append('title', 'Product shot');

    const imageUpload = await api(`/api/products/${create.body.id}/images`, withAuth({
      method: 'POST',
      body: imageForm,
    }));

    assert.equal(imageUpload.response.status, 200);
    assert.equal(imageUpload.body.mimeType, 'image/jpeg');
    assert.match(imageUpload.body.url, /\.jpg$/);
    assert.equal(imageUpload.body.fileName, 'product-shot.jpg');

    const download = await fetchBinary(imageUpload.body.url);
    assert.equal(download.response.status, 200);
    assert.equal(download.response.headers.get('content-type'), 'image/jpeg');
    assert.ok(download.buffer.length > 0);
  });

  await run('product image uploads accept WEBP payloads and remain downloadable', async () => {
    const create = await api('/api/products', withAuth({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sku: 'UPLOAD-WEBP-001',
        name: 'WEBP Upload Product',
        category: 'Parts',
        unit: 'Chiếc',
        basePrice: 10,
      }),
    }));

    assert.equal(create.response.status, 201);

    const imageForm = new FormData();
    imageForm.append('file', new Blob([sourceWebpBuffer], { type: 'image/webp' }), 'product-shot.webp');
    imageForm.append('title', 'Product shot webp');

    const imageUpload = await api(`/api/products/${create.body.id}/images`, withAuth({
      method: 'POST',
      body: imageForm,
    }));

    assert.equal(imageUpload.response.status, 200);
    assert.equal(imageUpload.body.mimeType, 'image/webp');
    assert.match(imageUpload.body.url, /\.webp$/);
    assert.equal(imageUpload.body.fileName, 'product-shot.webp');

    const download = await fetchBinary(imageUpload.body.url);
    assert.equal(download.response.status, 200);
    assert.equal(download.response.headers.get('content-type'), 'image/webp');
    assert.deepEqual(download.buffer, sourceWebpBuffer);
  });

  await run('product video uploads preserve MP4 assets and remain downloadable', async () => {
    const create = await api('/api/products', withAuth({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sku: 'UPLOAD-VIDEO-MP4',
        name: 'Video Upload Product',
        category: 'Parts',
        unit: 'Chiếc',
        basePrice: 10,
      }),
    }));

    assert.equal(create.response.status, 201);

    const videoForm = new FormData();
    videoForm.append('file', new Blob([sourceVideoBuffer], { type: 'video/mp4' }), 'demo-source.mp4');
    videoForm.append('title', 'Demo walkthrough');
    videoForm.append('description', 'Share-ready walkthrough');
    videoForm.append('durationSeconds', '1');
    videoForm.append('width', '320');
    videoForm.append('height', '240');

    const videoUpload = await api(`/api/products/${create.body.id}/videos`, withAuth({
      method: 'POST',
      body: videoForm,
    }));

    assert.equal(videoUpload.response.status, 200);
    assert.equal(videoUpload.body.mimeType, 'video/mp4');
    assert.match(videoUpload.body.url, /\.mp4$/);
    assert.equal(videoUpload.body.fileName, 'demo-source.mp4');
    assert.ok(videoUpload.body.durationSeconds > 0);
    assert.equal(videoUpload.body.width, 320);
    assert.equal(videoUpload.body.height, 240);

    const download = await fetchBinary(videoUpload.body.url);
    assert.equal(download.response.status, 200);
    assert.equal(download.response.headers.get('content-type'), 'video/mp4');
    assert.ok(download.buffer.length > 0);

    const readBack = await api(`/api/products/${create.body.id}`);
    assert.equal(readBack.response.status, 200);
    assert.equal(readBack.body.productVideos.length, 1);
    assert.equal(readBack.body.productVideos[0].title, 'Demo walkthrough');
  });

  await run('deleting a product removes its uploaded asset directory', async () => {
    const create = await api('/api/products', withAuth({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sku: 'UPLOAD-DELETE-001',
        name: 'Delete Upload Product',
        category: 'Parts',
        unit: 'Chiếc',
        basePrice: 10,
      }),
    }));

    assert.equal(create.response.status, 201);

    const imageForm = new FormData();
    imageForm.append('file', new Blob([solidPngBuffer], { type: 'image/png' }), 'delete-shot.png');
    imageForm.append('title', 'Delete shot');

    const imageUpload = await api(`/api/products/${create.body.id}/images`, withAuth({
      method: 'POST',
      body: imageForm,
    }));

    assert.equal(imageUpload.response.status, 200);

    const deleteProduct = await api(`/api/products/${create.body.id}`, withAuth({
      method: 'DELETE',
    }));
    assert.equal(deleteProduct.response.status, 200);

    const deletedDownload = await fetchBinary(imageUpload.body.url);
    assert.equal(deletedDownload.response.status, 404);
  });

  await run('POST /api/products/import upserts CSV rows and returns detailed row report', async () => {
    const csv = [
      'sku,name,category,unit,basePrice,currency,technicalSpecs,status,qbu.exWorks,qbu.shipping,qbu.importTax,qbu.customFees,qbu.other,imageUrls,documentUrls',
      'LEG-001,Updated Legacy,Heavy Equipment,Bộ,456.5,USD,Updated specs,available,100,20,30,40,50,https://example.com/image-1.webp|https://example.com/image-2.png,https://example.com/doc-1.pdf',
      'NEW-BULK-001,New Bulk Product,Spare Parts,Chiếc,99.95,USD,Fresh specs,available,1,2,3,4,5,https://example.com/new-image.png,https://example.com/new-doc.pdf',
      ',Missing SKU,Spare Parts,Chiếc,10,USD,,,0,0,0,0,0,,',
      'BAD-URL-001,Bad URL Product,Spare Parts,Chiếc,10,USD,,,0,0,0,0,0,notaurl,https://example.com/ok.pdf',
      'BAD-PRICE-001,Bad Price Product,Spare Parts,Chiếc,abc,USD,,,0,0,0,0,0,,',
    ].join('\n');

    const form = new FormData();
    form.append('file', new Blob([csv], { type: 'text/csv' }), 'products-import.csv');
    form.append('duplicateStrategy', 'replace');

    const result = await api('/api/products/import', withAuth({
      method: 'POST',
      body: form,
    }));

    assert.equal(result.response.status, 200);
    assert.equal(result.body.totalRows, 5);
    assert.equal(result.body.created, 1);
    assert.equal(result.body.updated, 1);
    assert.equal(result.body.skipped, 0);
    assert.equal(result.body.errors, 3);
    assert.equal(Array.isArray(result.body.rows), true);
    assert.deepEqual(
      result.body.rows.map((row) => ({ rowNumber: row.rowNumber, action: row.action })),
      [
        { rowNumber: 2, action: 'updated' },
        { rowNumber: 3, action: 'created' },
        { rowNumber: 4, action: 'error' },
        { rowNumber: 5, action: 'error' },
        { rowNumber: 6, action: 'error' },
      ]
    );

    const updatedLegacy = await api(`/api/products/${legacyProductOneId}`);
    assert.equal(updatedLegacy.response.status, 200);
    assert.equal(updatedLegacy.body.name, 'Updated Legacy');
    assert.equal(updatedLegacy.body.unit, 'Bộ');
    assert.equal(updatedLegacy.body.basePrice, 456.5);
    assert.equal(updatedLegacy.body.technicalSpecs, 'Updated specs');
    assert.equal(updatedLegacy.body.productImages.length, 2);
    assert.equal(updatedLegacy.body.productDocuments.length, 1);
    assert.equal(updatedLegacy.body.productImages[0].url, 'https://example.com/image-1.webp');
    assert.equal(updatedLegacy.body.productImages[0].isPrimary, true);
    assert.equal(updatedLegacy.body.productImages[0].sourceType, 'url');
    assert.ok(updatedLegacy.body.productImages[0].createdAt);
    assert.equal(updatedLegacy.body.productImages[1].url, 'https://example.com/image-2.png');
    assert.equal(updatedLegacy.body.productImages[1].isPrimary, false);
    assert.equal(updatedLegacy.body.productDocuments[0].url, 'https://example.com/doc-1.pdf');
    assert.equal(updatedLegacy.body.productDocuments[0].sourceType, 'url');
    assert.ok(updatedLegacy.body.productDocuments[0].createdAt);
    assert.equal(updatedLegacy.body.qbuData.exWorks, 100);
    assert.equal(updatedLegacy.body.qbuData.shipping, 20);
    assert.equal(updatedLegacy.body.qbuData.importTax, 30);
    assert.equal(updatedLegacy.body.qbuData.customFees, 40);
    assert.equal(updatedLegacy.body.qbuData.other, 50);
    assert.equal(updatedLegacy.body.qbuData.rateSnapshot.rate, 25888);
    assert.equal(updatedLegacy.body.qbuRateValue, 25888);
    assert.equal(updatedLegacy.body.qbuRateDate, '2026-03-25');
    assert.equal(updatedLegacy.body.qbuRateSource, 'vcb');

    const createdProduct = await api('/api/products');
    const newProduct = createdProduct.body.find((row) => row.sku === 'NEW-BULK-001');
    assert.ok(newProduct);
    assert.equal(newProduct.productImages.length, 1);
    assert.equal(newProduct.productDocuments.length, 1);
  });

  await run('POST /api/products/import keeps existing assets in merge mode when XLSX asset columns are blank', async () => {
    const worksheet = XLSX.utils.json_to_sheet([
      {
        sku: 'LEG-002',
        name: 'Legacy Product Two Overwritten',
        category: '',
        unit: '',
        basePrice: '',
        currency: '',
        technicalSpecs: '',
        status: '',
        'qbu.exWorks': '',
        'qbu.shipping': '',
        'qbu.importTax': '',
        'qbu.customFees': '',
        'qbu.other': '',
        imageUrls: '',
        documentUrls: '',
      },
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
    const fileBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const form = new FormData();
    form.append(
      'file',
      new Blob([fileBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      'products-import.xlsx'
    );
    form.append('duplicateStrategy', 'replace');

    const result = await api('/api/products/import', withAuth({
      method: 'POST',
      body: form,
    }));

    assert.equal(result.response.status, 200);
    assert.equal(result.body.totalRows, 1);
    assert.equal(result.body.created, 0);
    assert.equal(result.body.updated, 1);
    assert.equal(result.body.errors, 0);
    assert.equal(result.body.rows[0].rowNumber, 2);
    assert.equal(result.body.rows[0].action, 'updated');

    const updated = await api(`/api/products/${legacyProductTwoId}`);
    assert.equal(updated.response.status, 200);
    assert.equal(updated.body.name, 'Legacy Product Two Overwritten');
    assert.equal(updated.body.category, '');
    assert.equal(updated.body.unit, '');
    assert.equal(updated.body.basePrice, 0);
    assert.equal(updated.body.currency, '');
    assert.equal(updated.body.technicalSpecs, '');
    assert.equal(updated.body.status, 'available');
    assert.equal(updated.body.productImages.length, 1);
    assert.equal(updated.body.productDocuments.length, 1);
    assert.equal(updated.body.productImages[0].title, 'Front view');
    assert.equal(updated.body.productDocuments[0].title, 'Catalogue PDF');
    assert.equal(updated.body.qbuData.exWorks, 0);
    assert.equal(updated.body.qbuData.shipping, 0);
    assert.equal(updated.body.qbuData.importTax, 0);
    assert.equal(updated.body.qbuData.customFees, 0);
    assert.equal(updated.body.qbuData.other, 0);
    assert.equal(updated.body.qbuData.rateSnapshot.rate, 25888);
  });

  await run('POST /api/products/import replace mode clears existing assets when asset columns are blank', async () => {
    const worksheet = XLSX.utils.json_to_sheet([
      {
        sku: 'LEG-002',
        name: 'Legacy Product Two Cleared',
        category: '',
        unit: '',
        basePrice: '',
        currency: '',
        technicalSpecs: '',
        status: '',
        'qbu.exWorks': '',
        'qbu.shipping': '',
        'qbu.importTax': '',
        'qbu.customFees': '',
        'qbu.other': '',
        imageUrls: '',
        documentUrls: '',
      },
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
    const fileBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const form = new FormData();
    form.append(
      'file',
      new Blob([fileBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      'products-import-replace.xlsx'
    );
    form.append('mode', 'replace');
    form.append('duplicateStrategy', 'replace');

    const result = await api('/api/products/import', withAuth({
      method: 'POST',
      body: form,
    }));

    assert.equal(result.response.status, 200);
    assert.equal(result.body.updated, 1);

    const updated = await api(`/api/products/${legacyProductTwoId}`);
    assert.equal(updated.response.status, 200);
    assert.equal(updated.body.name, 'Legacy Product Two Cleared');
    assert.deepEqual(updated.body.productImages, []);
    assert.deepEqual(updated.body.productDocuments, []);
  });

  await run('POST /api/products/import merge mode supports clearing documents without touching images', async () => {
    const reseed = await api(`/api/products/${legacyProductTwoId}`, withAuth({
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sku: 'LEG-002',
        name: 'Legacy Product Two Seeded',
        category: 'Legacy',
        unit: 'Chiếc',
        basePrice: 18000,
        currency: 'USD',
        technicalSpecs: 'Legacy technical specs 2',
        status: 'available',
        productImages: [
          { id: 'img-seed-1', title: 'Seed image', url: 'https://example.com/seed-image.png', sourceType: 'url' },
        ],
        productDocuments: [
          { id: 'doc-seed-1', title: 'Seed doc', url: 'https://example.com/seed-doc.pdf', sourceType: 'url' },
        ],
        productVideos: [
          { id: 'vid-seed-1', title: 'Seed video', url: 'https://example.com/seed-video.mp4', sourceType: 'url' },
        ],
        qbuData: { exWorks: 10, shipping: 0, importTax: 0, customFees: 0, other: 0 },
      }),
    }));
    assert.equal(reseed.response.status, 200);

    const worksheet = XLSX.utils.json_to_sheet([
      {
        sku: 'LEG-002',
        name: 'Legacy Product Two Doc Reset',
        category: 'Legacy',
        unit: 'Chiếc',
        basePrice: 18000,
        currency: 'USD',
        technicalSpecs: 'Legacy technical specs 2',
        status: 'available',
        'qbu.exWorks': '10',
        'qbu.shipping': '',
        'qbu.importTax': '',
        'qbu.customFees': '',
        'qbu.other': '',
        imageUrls: '',
        videoUrls: '',
        documentUrls: '',
      },
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
    const fileBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const form = new FormData();
    form.append(
      'file',
      new Blob([fileBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      'products-import-clear-docs.xlsx'
    );
    form.append('mode', 'merge');
    form.append('clearDocuments', 'true');
    form.append('duplicateStrategy', 'replace');

    const result = await api('/api/products/import', withAuth({
      method: 'POST',
      body: form,
    }));

    assert.equal(result.response.status, 200);
    assert.equal(result.body.mode, 'merge');
    assert.equal(result.body.clearDocuments, true);
    assert.equal(result.body.clearImages, false);
    assert.equal(result.body.clearVideos, false);

    const updated = await api(`/api/products/${legacyProductTwoId}`);
    assert.equal(updated.response.status, 200);
    assert.equal(updated.body.productImages.length, 1);
    assert.equal(updated.body.productVideos.length, 1);
    assert.deepEqual(updated.body.productDocuments, []);
  });

  await run('POST /api/products/import/preview groups new rows, duplicates, and errors before import', async () => {
    const csv = [
      'sku,name,category,unit,basePrice,currency,technicalSpecs,status,imageUrls,documentUrls',
      'LEG-001,Preview Legacy,Heavy Equipment,Bộ,456.5,USD,Preview specs,available,https://example.com/image-1.webp,https://example.com/doc-1.pdf',
      'PREVIEW-NEW-001,Preview New Product,Spare Parts,Chiếc,99.95,USD,Fresh specs,available,https://example.com/new-image.png,',
      ',Missing SKU,Spare Parts,Chiếc,10,USD,,,,',
    ].join('\n');

    const form = new FormData();
    form.append('file', new Blob([csv], { type: 'text/csv' }), 'products-preview.csv');

    const result = await api('/api/products/import/preview', withAuth({
      method: 'POST',
      body: form,
    }));

    assert.equal(result.response.status, 200);
    assert.equal(result.body.totalRows, 3);
    assert.equal(result.body.newRows, 1);
    assert.equal(result.body.duplicateRows, 1);
    assert.equal(result.body.errorRows, 1);

    const duplicate = result.body.rows.find((row) => row.sku === 'LEG-001');
    assert.ok(duplicate);
    assert.equal(duplicate.action, 'duplicate');
    assert.ok(Array.isArray(duplicate.changes));
    assert.ok(Array.isArray(duplicate.compare));
    assert.ok(duplicate.compare.some((entry) => entry.label === 'Tên'));

    const created = result.body.rows.find((row) => row.sku === 'PREVIEW-NEW-001');
    assert.ok(created);
    assert.equal(created.action, 'new');

    const error = result.body.rows.find((row) => row.action === 'error');
    assert.ok(error);
    assert.match(error.messages.join(' '), /Thiếu SKU/);
  });

  await run('POST /api/products/import skips duplicates by default when duplicateStrategy is omitted', async () => {
    const csv = [
      'sku,name,category,unit,basePrice,currency,technicalSpecs,status',
      'LEG-001,Skipped Legacy Update,Heavy Equipment,Bộ,888,USD,Skip me,available',
      'SKIP-NEW-001,Fresh Product,Spare Parts,Chiếc,11,USD,Fresh specs,available',
    ].join('\n');

    const form = new FormData();
    form.append('file', new Blob([csv], { type: 'text/csv' }), 'products-skip-duplicates.csv');

    const result = await api('/api/products/import', withAuth({
      method: 'POST',
      body: form,
    }));

    assert.equal(result.response.status, 200);
    assert.equal(result.body.created, 1);
    assert.equal(result.body.updated, 0);
    assert.equal(result.body.skipped, 1);

    const legacy = await api(`/api/products/${legacyProductOneId}`);
    assert.equal(legacy.response.status, 200);
    assert.equal(legacy.body.name, 'Updated Legacy');

    const created = await api('/api/products');
    assert.equal(created.response.status, 200);
    assert.ok(created.body.some((row) => row.sku === 'SKIP-NEW-001'));
  });

  await run('POST /api/products/import replaces only selected duplicate SKUs when replaceSkus is provided', async () => {
    const createOther = await api('/api/products', withAuth({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sku: 'LEG-003',
        name: 'Legacy Product Three',
        category: 'Legacy',
        unit: 'Chiếc',
        basePrice: 200,
      }),
    }));
    assert.equal(createOther.response.status, 201);

    const csv = [
      'sku,name,category,unit,basePrice,currency,technicalSpecs,status',
      'LEG-001,Selected Replace Legacy,Heavy Equipment,Bộ,901,USD,Selected replace,available',
      'LEG-003,Should Stay Unchanged,Legacy,Chiếc,777,USD,Do not replace,available',
    ].join('\n');

    const form = new FormData();
    form.append('file', new Blob([csv], { type: 'text/csv' }), 'products-selective-replace.csv');
    form.append('duplicateStrategy', 'replace');
    form.append('replaceSkus', 'LEG-001');

    const result = await api('/api/products/import', withAuth({
      method: 'POST',
      body: form,
    }));

    assert.equal(result.response.status, 200);
    assert.equal(result.body.updated, 1);
    assert.equal(result.body.skipped, 1);

    const first = await api(`/api/products/${legacyProductOneId}`);
    assert.equal(first.response.status, 200);
    assert.equal(first.body.name, 'Selected Replace Legacy');

    const second = await api(`/api/products/${createOther.body.id}`);
    assert.equal(second.response.status, 200);
    assert.equal(second.body.name, 'Legacy Product Three');
  });

  await run('product template and export endpoints support XLSX format', async () => {
    const template = await fetchBinary('/api/template/products?format=xlsx');
    assert.equal(template.response.status, 200);
    assert.match(template.response.headers.get('content-type') || '', /spreadsheetml/);

    const templateBook = XLSX.read(template.buffer, { type: 'buffer' });
    const templateRows = XLSX.utils.sheet_to_json(templateBook.Sheets[templateBook.SheetNames[0]], { defval: '' });
    assert.equal(templateRows.length, 1);
    assert.equal(templateRows[0].sku, 'PC1250-8');
    assert.equal(Number(templateRows[0]['qbu.exWorks']), 2500000);
    assert.match(String(templateRows[0].imageUrls), /pc1250-hero/);

    const exportResult = await fetchBinary('/api/products/export?format=xlsx');
    assert.equal(exportResult.response.status, 200);
    assert.match(exportResult.response.headers.get('content-type') || '', /spreadsheetml/);

    const exportBook = XLSX.read(exportResult.buffer, { type: 'buffer' });
    const exportRows = XLSX.utils.sheet_to_json(exportBook.Sheets[exportBook.SheetNames[0]], { defval: '' });
    const legacyRow = exportRows.find((row) => row.sku === 'LEG-001');
    assert.ok(legacyRow);
    assert.equal(legacyRow.name, 'Selected Replace Legacy');
    assert.equal(Number(legacyRow.basePrice), 901);
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
