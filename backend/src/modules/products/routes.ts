import type { Express, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { createProductImportService } from './importService';
import { buildProductQbuFinancialPreview } from './qbuWorkbook';
import { createProductRepository } from './repository';
import { createProductService } from './service';
import { optimizeUploadedImage } from '../../shared/uploads/imageOptimizer';
import { optimizeUploadedVideo } from '../../shared/uploads/videoOptimizer';

type AsyncRouteFactory = (handler: (req: Request, res: Response) => Promise<unknown>) => any;

type RegisterProductRoutesDeps = {
  ah: AsyncRouteFactory;
  requireAuth: any;
  requireRole: (...roles: string[]) => any;
  upload: any;
  assetUpload: any;
  serializeProductRow: (row: any) => any;
  parseJsonObject: <T extends Record<string, any> | null>(raw: unknown, fallback: T) => T;
  stringifyNormalizedJson: (value: unknown) => string;
  getLatestExchangeRatePayload: (baseCurrency: string, quoteCurrency: string) => Promise<any>;
};

type ProductAssetKind = 'image' | 'video' | 'document';

function readSingleField(value: unknown) {
  if (Array.isArray(value)) return String(value[0] ?? '').trim();
  return String(value ?? '').trim();
}

function readOptionalNumberField(value: unknown) {
  const raw = readSingleField(value);
  if (!raw) return undefined;
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : undefined;
}

async function buildUploadedAsset(req: Request, kind: ProductAssetKind) {
  if (!req.file) return null;
  const productId = String(req.params.id ?? '');
  const safeTitle = readSingleField(req.body?.title);
  const description = readSingleField(req.body?.description);
  const uploadsFolder = kind === 'image' ? 'images' : kind === 'video' ? 'videos' : 'documents';
  const uploadsRoot = path.join(__dirname, '..', '..', '..', 'uploads', 'products', productId, uploadsFolder);
  const optimizedImage = kind === 'image' ? await optimizeUploadedImage(req.file, 'product-image') : null;
  const optimizedVideo = kind === 'video' ? await optimizeUploadedVideo(req.file) : null;
  const ext = optimizedImage?.extension || optimizedVideo?.extension || path.extname(req.file.originalname) || (kind === 'image' ? '.jpg' : kind === 'video' ? '.mp4' : '.bin');

  fs.mkdirSync(uploadsRoot, { recursive: true });

  const filename = `${Date.now()}-${uuidv4()}${ext.toLowerCase()}`;
  const absoluteFilePath = path.join(uploadsRoot, filename);
  fs.writeFileSync(absoluteFilePath, optimizedImage?.buffer || optimizedVideo?.buffer || req.file.buffer);

  const publicUrl = `/uploads/products/${productId}/${uploadsFolder}/${filename}`;
  const title = safeTitle || req.file.originalname;

  return {
    id: uuidv4(),
    title,
    url: publicUrl,
    ...(kind === 'image'
      ? {
          alt: readSingleField(req.body?.alt) || title,
          isPrimary: readSingleField(req.body?.isPrimary).toLowerCase() === 'true',
        }
      : {
          description: description || undefined,
          durationSeconds: optimizedVideo?.durationSeconds ?? readOptionalNumberField(req.body?.durationSeconds),
          width: optimizedVideo?.width ?? readOptionalNumberField(req.body?.width),
          height: optimizedVideo?.height ?? readOptionalNumberField(req.body?.height),
        }),
    sourceType: 'upload',
    fileName: optimizedImage?.downloadFileName || optimizedVideo?.downloadFileName || req.file.originalname,
    mimeType: optimizedImage?.mimeType || optimizedVideo?.mimeType || req.file.mimetype || undefined,
    size: optimizedImage?.size || optimizedVideo?.size || req.file.size,
    createdAt: new Date().toISOString(),
  };
}

async function appendUploadedAssetToProduct(
  productId: string,
  kind: ProductAssetKind,
  asset: Record<string, unknown>,
  appendAsset: (
    productId: string,
    kind: ProductAssetKind,
    asset: Record<string, unknown>,
    serializeProductRow: (row: any) => any,
    options?: { replaceAssetId?: string },
  ) => Promise<{ asset: Record<string, unknown>; replacedAsset: any } | null>,
  serializeProductRow: (row: any) => any,
  options?: { replaceAssetId?: string },
) {
  const result = await appendAsset(productId, kind, asset, serializeProductRow, options);
  if (!result) return null;
  if (result.replacedAsset?.url && result.replacedAsset.url !== asset.url) {
    deleteStoredProductFile(productId, String(result.replacedAsset.url));
  }
  return result.asset;
}

function deleteStoredProductFile(productId: string, assetUrl: string) {
  if (!assetUrl.startsWith(`/uploads/products/${productId}/`)) return;
  const relativePath = assetUrl.replace(/^\/+/, '').replace(/\//g, path.sep);
  const absoluteFilePath = path.join(__dirname, '..', '..', '..', relativePath);
  if (fs.existsSync(absoluteFilePath)) {
    fs.unlinkSync(absoluteFilePath);
  }
}

function deleteStoredProductDirectory(productId: string) {
  const uploadsRoot = path.join(__dirname, '..', '..', '..', 'uploads', 'products', productId);
  if (fs.existsSync(uploadsRoot)) {
    fs.rmSync(uploadsRoot, { recursive: true, force: true });
  }
}

async function removeProductAsset(
  productId: string,
  kind: ProductAssetKind,
  assetId: string,
  removeAsset: (
    productId: string,
    kind: ProductAssetKind,
    assetId: string,
    serializeProductRow: (row: any) => any,
  ) => Promise<{ removed: boolean; nextAssets: any[]; removedAsset?: any } | null>,
  serializeProductRow: (row: any) => any,
) {
  const result = await removeAsset(productId, kind, assetId, serializeProductRow);
  if (!result) return null;
  if (result.removedAsset?.url && result.removedAsset?.sourceType === 'upload') {
    deleteStoredProductFile(productId, String(result.removedAsset.url));
  }
  return result;
}

export function registerProductRoutes(app: Express, deps: RegisterProductRoutesDeps) {
  const {
    ah,
    requireAuth,
    requireRole,
    upload,
    assetUpload,
    serializeProductRow,
    parseJsonObject,
    stringifyNormalizedJson,
    getLatestExchangeRatePayload,
  } = deps;
  const productRepository = createProductRepository();
  const productService = createProductService({
    repository: productRepository,
    parseJsonObject,
    stringifyNormalizedJson,
    getLatestExchangeRatePayload,
  });
  const productImportService = createProductImportService({
    repository: productRepository,
    getLatestExchangeRatePayload,
  });

  app.get('/api/products', requireAuth, ah(async (req: Request, res: Response) => {
    const { category } = req.query;
    const rows = await productService.listProducts(category);
    res.json(rows.map(serializeProductRow));
  }));

  app.get('/api/products/:id', requireAuth, ah(async (req: Request, res: Response) => {
    const row = await productService.getProductById(String(req.params.id));
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(serializeProductRow(row));
  }));

  app.post('/api/products', requireAuth, requireRole('admin', 'manager'), ah(async (req: Request, res: Response) => {
    const row = await productService.createProduct(req.body);
    res.status(201).json(serializeProductRow(row));
  }));

  app.put('/api/products/:id', requireAuth, requireRole('admin', 'manager'), ah(async (req: Request, res: Response) => {
    const result = await productService.updateProduct(String(req.params.id), req.body);
    if ('notFound' in result) return res.status(404).json({ error: 'Not found' });
    if ('invalidQbuData' in result) {
      return res.status(400).json({ error: 'Invalid qbuData. Expected an object.' });
    }
    res.json(serializeProductRow(result.row));
  }));

  app.post('/api/products/qbu/preview', requireAuth, ah(async (req: Request, res: Response) => {
    const payload = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    const result = buildProductQbuFinancialPreview({
      qbuData: payload.qbuData || {},
      basePrice: payload.basePrice,
      currency: payload.currency,
    });
    res.json(result);
  }));

  app.post('/api/products/:id/images', requireAuth, requireRole('admin', 'manager'), assetUpload.single('file'), ah(async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    if (!String(req.file.mimetype || '').startsWith('image/')) {
      return res.status(400).json({ error: 'Product image upload requires an image file' });
    }
    const existing = await productService.getProductById(String(req.params.id));
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const asset = await buildUploadedAsset(req, 'image');
    if (!asset) return res.status(400).json({ error: 'No file uploaded' });
    await appendUploadedAssetToProduct(String(req.params.id), 'image', asset, productService.appendUploadedAsset, serializeProductRow, {
      replaceAssetId: readSingleField(req.body?.replaceAssetId) || undefined,
    });
    res.json(asset);
  }));

  app.post('/api/products/:id/videos', requireAuth, requireRole('admin', 'manager'), assetUpload.single('file'), ah(async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    if (!String(req.file.mimetype || '').startsWith('video/')) {
      return res.status(400).json({ error: 'Product video upload requires a video file' });
    }
    const existing = await productService.getProductById(String(req.params.id));
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const asset = await buildUploadedAsset(req, 'video');
    if (!asset) return res.status(400).json({ error: 'No file uploaded' });
    await appendUploadedAssetToProduct(String(req.params.id), 'video', asset, productService.appendUploadedAsset, serializeProductRow, {
      replaceAssetId: readSingleField(req.body?.replaceAssetId) || undefined,
    });
    res.json(asset);
  }));

  app.post('/api/products/:id/documents', requireAuth, requireRole('admin', 'manager'), assetUpload.single('file'), ah(async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const existing = await productService.getProductById(String(req.params.id));
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const asset = await buildUploadedAsset(req, 'document');
    if (!asset) return res.status(400).json({ error: 'No file uploaded' });
    await appendUploadedAssetToProduct(String(req.params.id), 'document', asset, productService.appendUploadedAsset, serializeProductRow, {
      replaceAssetId: readSingleField(req.body?.replaceAssetId) || undefined,
    });
    res.json(asset);
  }));

  app.delete('/api/products/:id/assets/:kind/:assetId', requireAuth, requireRole('admin', 'manager'), ah(async (req: Request, res: Response) => {
    const rawKind = String(req.params.kind ?? '').toLowerCase();
    const kind = rawKind === 'image' || rawKind === 'video' || rawKind === 'document' ? rawKind : null;
    if (!kind) return res.status(400).json({ error: 'Unsupported asset kind' });

    const result = await removeProductAsset(
      String(req.params.id),
      kind,
      String(req.params.assetId),
      productService.removeProductAsset,
      serializeProductRow,
    );
    if (!result) return res.status(404).json({ error: 'Not found' });
    if (!result.removed) return res.status(404).json({ error: 'Asset not found' });
    res.json({ success: true });
  }));

  app.delete('/api/products/:id', requireAuth, requireRole('admin', 'manager'), ah(async (req: Request, res: Response) => {
    await productService.deleteProduct(String(req.params.id));
    deleteStoredProductDirectory(String(req.params.id));
    res.json({ success: true });
  }));

  app.post('/api/products/import/preview', requireAuth, requireRole('admin', 'manager'), upload.single('file'), ah(async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const report = await productImportService.previewFile(req.file);
    res.json(report);
  }));

  app.post('/api/products/import', requireAuth, requireRole('admin', 'manager'), upload.single('file'), ah(async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const mode = String(req.body?.mode ?? '').toLowerCase() === 'replace' ? 'replace' : 'merge';
    const duplicateStrategy = String(req.body?.duplicateStrategy ?? '').toLowerCase() === 'replace' ? 'replace' : 'skip';
    const parseFlag = (value: unknown) => ['1', 'true', 'yes', 'on'].includes(String(value ?? '').toLowerCase());
    const replaceSkus = Array.isArray(req.body?.replaceSkus)
      ? req.body.replaceSkus
      : typeof req.body?.replaceSkus === 'string' && req.body.replaceSkus.trim()
        ? req.body.replaceSkus.split('|')
        : [];
    const report = await productImportService.importFile(req.file, {
      mode,
      duplicateStrategy,
      replaceSkus,
      clearImages: parseFlag(req.body?.clearImages),
      clearVideos: parseFlag(req.body?.clearVideos),
      clearDocuments: parseFlag(req.body?.clearDocuments),
    });
    res.json(report);
  }));
}
