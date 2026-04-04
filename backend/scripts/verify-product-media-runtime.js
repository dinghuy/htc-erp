const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Jimp } = require('jimp');

async function createPngBuffer(color) {
  const image = new Jimp({ width: 8, height: 8, color });
  return Buffer.from(await image.getBuffer('image/png'));
}

async function api(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  return { response, body };
}

function withAuth(token, options = {}) {
  return {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  };
}

async function main() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-media-runtime-'));
  process.env.DB_PATH = path.join(tempDir, 'crm-media-runtime.db');
  process.env.PORT = '0';

  const { bootApplication } = require('../dist/src/app.js');
  const server = await bootApplication();

  try {
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    assert.ok(port, 'Ephemeral runtime port was not assigned');
    const baseUrl = `http://127.0.0.1:${port}`;

    const login = await api(baseUrl, '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    assert.equal(login.response.status, 200, 'Admin login failed against built runtime');
    assert.match(login.body?.token || '', /\S+/, 'Admin token missing from built runtime');
    const token = login.body.token;

    const createProduct = await api(
      baseUrl,
      '/api/products',
      withAuth(token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: 'RUNTIME-MEDIA-001',
          name: 'Runtime Media Verification Product',
          category: 'QA',
          unit: 'Chiếc',
          basePrice: 1,
        }),
      })
    );
    assert.equal(createProduct.response.status, 201, 'Product creation failed on built runtime');
    const productId = createProduct.body.id;
    assert.match(productId || '', /\S+/, 'Created product id missing from built runtime');

    const imageBuffer = await createPngBuffer(0xff0000ff);
    const videoBuffer = fs.readFileSync(path.join(__dirname, '..', 'tests', 'tiny.mp4'));
    const documentBuffer = Buffer.from('%PDF-1.4\n% runtime media verification\n');

    const imageForm = new FormData();
    imageForm.append('file', new Blob([imageBuffer], { type: 'image/png' }), 'runtime-image.png');
    imageForm.append('title', 'Runtime image');
    const imageUpload = await api(
      baseUrl,
      `/api/products/${productId}/images`,
      withAuth(token, { method: 'POST', body: imageForm })
    );
    assert.equal(imageUpload.response.status, 200, 'Image upload route failed on built runtime');
    assert.match(imageUpload.body?.url || '', /^\/uploads\/products\//, 'Image upload did not return a product upload URL');

    const videoForm = new FormData();
    videoForm.append('file', new Blob([videoBuffer], { type: 'video/mp4' }), 'runtime-video.mp4');
    videoForm.append('title', 'Runtime video');
    const videoUpload = await api(
      baseUrl,
      `/api/products/${productId}/videos`,
      withAuth(token, { method: 'POST', body: videoForm })
    );
    assert.equal(videoUpload.response.status, 200, 'Video upload route failed on built runtime');
    assert.equal(videoUpload.body?.mimeType, 'video/mp4', 'Video upload returned an unexpected mime type');

    const documentForm = new FormData();
    documentForm.append('file', new Blob([documentBuffer], { type: 'application/pdf' }), 'runtime-manual.pdf');
    documentForm.append('title', 'Runtime manual');
    const documentUpload = await api(
      baseUrl,
      `/api/products/${productId}/documents`,
      withAuth(token, { method: 'POST', body: documentForm })
    );
    assert.equal(documentUpload.response.status, 200, 'Document upload route failed on built runtime');
    assert.equal(documentUpload.body?.mimeType, 'application/pdf', 'Document upload returned an unexpected mime type');

    const detail = await api(baseUrl, `/api/products/${productId}`, withAuth(token));
    assert.equal(detail.response.status, 200, 'Product detail fetch failed after media uploads');
    assert.equal(detail.body?.productImages?.length, 1, 'Built runtime did not persist uploaded image');
    assert.equal(detail.body?.productVideos?.length, 1, 'Built runtime did not persist uploaded video');
    assert.equal(detail.body?.productDocuments?.length, 1, 'Built runtime did not persist uploaded document');

    console.log(`PASS built runtime exposes image/video/document upload routes for product ${productId}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

main().catch((error) => {
  console.error('FAIL built runtime media verification');
  console.error(error);
  process.exitCode = 1;
});
