import path from 'path';
import { parse } from 'csv-parse/sync';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';
import { buildQbuSnapshotState, normalizeProductAssetArray } from './persistence';
import { createProductRepository } from './repository';

export type ProductImportRowResult = {
  rowNumber: number;
  sku: string | null;
  action: 'created' | 'updated' | 'skipped' | 'error';
  messages: string[];
};

export type ProductImportPreviewRow = {
  rowNumber: number;
  sku: string | null;
  action: 'new' | 'duplicate' | 'error';
  incomingName: string;
  existingName?: string;
  changes: string[];
  compare?: Array<{
    label: string;
    currentValue: string;
    incomingValue: string;
    changed: boolean;
  }>;
  messages: string[];
};

export type ProductImportPreviewReport = {
  totalRows: number;
  newRows: number;
  duplicateRows: number;
  errorRows: number;
  rows: ProductImportPreviewRow[];
};

export type ProductImportReport = {
  mode?: ProductImportMode;
  clearImages?: boolean;
  clearVideos?: boolean;
  clearDocuments?: boolean;
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  rows: ProductImportRowResult[];
};

type ImportServiceDeps = {
  getLatestExchangeRatePayload: (baseCurrency: string, quoteCurrency: string) => Promise<any>;
  repository?: ReturnType<typeof createProductRepository>;
};

type ProductImportMode = 'merge' | 'replace';
type ProductDuplicateStrategy = 'skip' | 'replace';

type ParsedImportRow = {
  rowNumber: number;
  values: Record<string, string>;
};

type NormalizedImportRow = {
  sku: string;
  name: string;
  category: string;
  unit: string;
  basePrice: number;
  currency: string;
  technicalSpecs: string;
  status: string;
  qbuData: Record<string, number>;
  productImages: Record<string, unknown>[];
  productVideos: Record<string, unknown>[];
  productDocuments: Record<string, unknown>[];
};

const QBU_FIELDS = [
  { key: 'qbu.exWorks', target: 'exWorks', label: 'QBU exWorks' },
  { key: 'qbu.shipping', target: 'shipping', label: 'QBU shipping' },
  { key: 'qbu.importTax', target: 'importTax', label: 'QBU importTax' },
  { key: 'qbu.customFees', target: 'customFees', label: 'QBU customFees' },
  { key: 'qbu.other', target: 'other', label: 'QBU other' },
] as const;

function normalizeHeaderKey(raw: unknown) {
  return String(raw ?? '').trim();
}

function normalizeCellValue(raw: unknown) {
  if (raw === null || raw === undefined) return '';
  return String(raw).trim();
}

function parseCsvRows(buffer: Buffer) {
  const records = parse(buffer.toString('utf-8'), {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, unknown>[];

  return records.map((record, index) => ({
    rowNumber: index + 2,
    values: Object.fromEntries(
      Object.entries(record).map(([key, value]) => [normalizeHeaderKey(key), normalizeCellValue(value)])
    ),
  }));
}

function parseXlsxRows(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  const worksheet = workbook.Sheets[firstSheetName];
  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: '',
    raw: false,
  });

  return records.map((record, index) => ({
    rowNumber: index + 2,
    values: Object.fromEntries(
      Object.entries(record).map(([key, value]) => [normalizeHeaderKey(key), normalizeCellValue(value)])
    ),
  }));
}

function parseRowsFromFile(file: Express.Multer.File): ParsedImportRow[] {
  const extension = path.extname(file.originalname || '').toLowerCase();
  if (extension === '.csv') return parseCsvRows(file.buffer);
  if (extension === '.xlsx') return parseXlsxRows(file.buffer);
  throw new Error('Unsupported file format. Please upload a CSV or XLSX file.');
}

function isAbsoluteHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function parseNumericField(raw: string, label: string, messages: string[]) {
  if (!raw) return 0;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    messages.push(`${label} không hợp lệ`);
    return 0;
  }
  return value;
}

function buildUrlAssets(raw: string, kind: 'image' | 'video' | 'document', messages: string[], label: string) {
  const urls = raw
    .split('|')
    .map((value) => value.trim())
    .filter(Boolean);

  const invalidUrls = urls.filter((value) => !isAbsoluteHttpUrl(value));
  if (invalidUrls.length > 0) {
    messages.push(`${label} chứa URL không hợp lệ`);
    return [];
  }

  const createdAt = new Date().toISOString();
  return normalizeProductAssetArray(urls.map((url, index) => {
    const fileName = url.split('/').pop() || '';
    const title = fileName || `${kind === 'image' ? 'Image' : kind === 'video' ? 'Video' : 'Document'} ${index + 1}`;

    return {
      id: `${kind}-import-${index + 1}`,
      title,
      url,
      ...(kind === 'image' ? { alt: title, isPrimary: index === 0 } : { description: title }),
      sourceType: 'url',
      fileName,
      createdAt,
    };
  }), kind);
}

function parseStoredAssetArray(raw: unknown, kind: 'image' | 'video' | 'document') {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    return normalizeProductAssetArray(JSON.parse(raw), kind);
  } catch {
    return [];
  }
}

function parseLegacyMediaAssets(raw: unknown, kind: 'image' | 'video' | 'document') {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const filtered = parsed.filter((entry: any) => {
      const url = String(entry?.url ?? entry?.href ?? '').trim();
      const mimeType = String(entry?.mimeType ?? entry?.type ?? '').trim().toLowerCase();
      if (!url) return false;
      if (kind === 'image') return mimeType.startsWith('image/') || /\.(avif|gif|jpe?g|png|svg|webp)$/i.test(url);
      if (kind === 'video') return mimeType.startsWith('video/') || /\.(avi|mkv|mov|mp4|mpe?g|ogv|webm)$/i.test(url);
      return !(mimeType.startsWith('image/') || mimeType.startsWith('video/')) && !/\.(avif|gif|jpe?g|png|svg|webp|avi|mkv|mov|mp4|mpe?g|ogv|webm)$/i.test(url);
    });
    return normalizeProductAssetArray(filtered, kind);
  } catch {
    return [];
  }
}

function normalizeImportRow(row: ParsedImportRow): { normalized: NormalizedImportRow | null; messages: string[]; sku: string | null } {
  const messages: string[] = [];
  const sku = normalizeCellValue(row.values.sku);

  if (!sku) {
    messages.push('Thiếu SKU');
    return { normalized: null, messages, sku: null };
  }

  const basePrice = parseNumericField(normalizeCellValue(row.values.basePrice), 'Giá basePrice', messages);
  const qbuData = Object.fromEntries(QBU_FIELDS.map((field) => [
    field.target,
    parseNumericField(normalizeCellValue(row.values[field.key]), field.label, messages),
  ]));
  const productImages = buildUrlAssets(normalizeCellValue(row.values.imageUrls), 'image', messages, 'imageUrls');
  const productVideos = buildUrlAssets(normalizeCellValue(row.values.videoUrls), 'video', messages, 'videoUrls');
  const productDocuments = buildUrlAssets(normalizeCellValue(row.values.documentUrls), 'document', messages, 'documentUrls');

  if (messages.length > 0) {
    return { normalized: null, messages, sku };
  }

  return {
    normalized: {
      sku,
      name: normalizeCellValue(row.values.name),
      category: normalizeCellValue(row.values.category),
      unit: normalizeCellValue(row.values.unit),
      basePrice,
      currency: normalizeCellValue(row.values.currency),
      technicalSpecs: normalizeCellValue(row.values.technicalSpecs),
      status: normalizeCellValue(row.values.status) || 'available',
      qbuData,
      productImages,
      productVideos,
      productDocuments,
    },
    messages,
    sku,
  };
}

function shallowEqualNumbers(a: Record<string, number>, b: Record<string, number>) {
  return QBU_FIELDS.every((field) => Number(a[field.target] || 0) === Number(b[field.target] || 0));
}

function readStoredQbuData(raw: unknown) {
  if (typeof raw !== 'string' || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function getAssetUrls(items: Array<Record<string, unknown>>) {
  return items.map((item) => String(item.url || '').trim()).filter(Boolean).join('|');
}

function summarizeAssets(items: Array<Record<string, unknown>>, emptyLabel: string) {
  if (!items.length) return emptyLabel;
  const titles = items
    .map((item) => String(item.title || item.fileName || item.url || '').trim())
    .filter(Boolean)
    .slice(0, 2);
  const label = titles.length > 0 ? titles.join(', ') : `${items.length} mục`;
  return items.length > 2 ? `${label} +${items.length - 2}` : label;
}

function buildPreviewCompare(existing: any, normalized: NormalizedImportRow) {
  const existingQbu = readStoredQbuData(existing.qbuData);
  const existingImages = parseStoredAssetArray(existing.productImages, 'image').length
    ? parseStoredAssetArray(existing.productImages, 'image')
    : parseLegacyMediaAssets(existing.media, 'image');
  const existingVideos = parseStoredAssetArray(existing.productVideos, 'video').length
    ? parseStoredAssetArray(existing.productVideos, 'video')
    : parseLegacyMediaAssets(existing.media, 'video');
  const existingDocuments = parseStoredAssetArray(existing.productDocuments, 'document').length
    ? parseStoredAssetArray(existing.productDocuments, 'document')
    : parseLegacyMediaAssets(existing.media, 'document');

  const compare = [
    {
      label: 'Tên',
      currentValue: String(existing.name || 'Chưa có'),
      incomingValue: normalized.name || 'Chưa có',
      changed: String(existing.name || '') !== normalized.name,
    },
    {
      label: 'Danh mục',
      currentValue: String(existing.category || 'Chưa có'),
      incomingValue: normalized.category || 'Chưa có',
      changed: String(existing.category || '') !== normalized.category,
    },
    {
      label: 'Đơn vị',
      currentValue: String(existing.unit || 'Chưa có'),
      incomingValue: normalized.unit || 'Chưa có',
      changed: String(existing.unit || '') !== normalized.unit,
    },
    {
      label: 'Giá bán',
      currentValue: String(Number(existing.basePrice || 0)),
      incomingValue: String(Number(normalized.basePrice || 0)),
      changed: Number(existing.basePrice || 0) !== Number(normalized.basePrice || 0),
    },
    {
      label: 'Thông số kỹ thuật',
      currentValue: String(existing.technicalSpecs || 'Chưa có'),
      incomingValue: normalized.technicalSpecs || 'Chưa có',
      changed: String(existing.technicalSpecs || '') !== normalized.technicalSpecs,
    },
    {
      label: 'Trạng thái',
      currentValue: String(existing.status || 'Chưa có'),
      incomingValue: normalized.status || 'Chưa có',
      changed: String(existing.status || '') !== normalized.status,
    },
    {
      label: 'QBU tổng',
      currentValue: String(QBU_FIELDS.reduce((sum, field) => sum + Number(existingQbu[field.target] || 0), 0)),
      incomingValue: String(QBU_FIELDS.reduce((sum, field) => sum + Number(normalized.qbuData[field.target] || 0), 0)),
      changed: !shallowEqualNumbers(existingQbu, normalized.qbuData),
    },
    {
      label: 'Ảnh',
      currentValue: summarizeAssets(existingImages, 'Chưa có ảnh'),
      incomingValue: summarizeAssets(normalized.productImages, 'Không có trong file'),
      changed: getAssetUrls(existingImages) !== getAssetUrls(normalized.productImages),
    },
    {
      label: 'Video',
      currentValue: summarizeAssets(existingVideos, 'Chưa có video'),
      incomingValue: summarizeAssets(normalized.productVideos, 'Không có trong file'),
      changed: getAssetUrls(existingVideos) !== getAssetUrls(normalized.productVideos),
    },
    {
      label: 'Tài liệu',
      currentValue: summarizeAssets(existingDocuments, 'Chưa có tài liệu'),
      incomingValue: summarizeAssets(normalized.productDocuments, 'Không có trong file'),
      changed: getAssetUrls(existingDocuments) !== getAssetUrls(normalized.productDocuments),
    },
  ];

  return compare;
}

export function createProductImportService(deps: ImportServiceDeps) {
  const { getLatestExchangeRatePayload } = deps;
  const repository = deps.repository ?? createProductRepository();

  return {
    async previewFile(file: Express.Multer.File): Promise<ProductImportPreviewReport> {
      const rows = parseRowsFromFile(file);
      const report: ProductImportPreviewReport = {
        totalRows: rows.length,
        newRows: 0,
        duplicateRows: 0,
        errorRows: 0,
        rows: [],
      };

      for (const row of rows) {
        const { normalized, messages, sku } = normalizeImportRow(row);
        if (!normalized) {
          report.errorRows += 1;
          report.rows.push({
            rowNumber: row.rowNumber,
            sku,
            action: 'error',
            incomingName: normalizeCellValue(row.values.name),
            changes: [],
            messages,
          });
          continue;
        }

        const existing = await repository.findPreviewProductBySku(normalized.sku);

        if (!existing) {
          report.newRows += 1;
          report.rows.push({
            rowNumber: row.rowNumber,
            sku: normalized.sku,
            action: 'new',
            incomingName: normalized.name,
            changes: [],
            messages: ['Sẽ tạo sản phẩm mới'],
          });
          continue;
        }

        report.duplicateRows += 1;
        const compare = buildPreviewCompare(existing, normalized);
        const changes = compare.filter((item) => item.changed).map((item) => item.label);
        report.rows.push({
          rowNumber: row.rowNumber,
          sku: normalized.sku,
          action: 'duplicate',
          incomingName: normalized.name,
          existingName: String(existing.name || ''),
          changes,
          compare,
          messages: changes.length > 0 ? ['SKU đã tồn tại, cần chọn replace hoặc bỏ qua'] : ['SKU đã tồn tại nhưng không có khác biệt rõ ràng'],
        });
      }

      return report;
    },

    async importFile(
      file: Express.Multer.File,
      options?: { mode?: ProductImportMode; clearImages?: boolean; clearVideos?: boolean; clearDocuments?: boolean; duplicateStrategy?: ProductDuplicateStrategy; replaceSkus?: string[] }
    ): Promise<ProductImportReport> {
      const mode: ProductImportMode = options?.mode === 'replace' ? 'replace' : 'merge';
      const duplicateStrategy: ProductDuplicateStrategy = options?.duplicateStrategy === 'replace' ? 'replace' : 'skip';
      const replaceSkuSet = new Set((options?.replaceSkus || []).map((sku) => String(sku || '').trim()).filter(Boolean));
      const clearImages = mode === 'replace' || options?.clearImages === true;
      const clearVideos = mode === 'replace' || options?.clearVideos === true;
      const clearDocuments = mode === 'replace' || options?.clearDocuments === true;
      const rows = parseRowsFromFile(file);
      const report: ProductImportReport = {
        mode,
        clearImages,
        clearVideos,
        clearDocuments,
        totalRows: rows.length,
        created: 0,
        updated: 0,
        skipped: 0,
        errors: 0,
        rows: [],
      };

      for (const row of rows) {
        const { normalized, messages, sku } = normalizeImportRow(row);
        if (!normalized) {
          report.errors += 1;
          report.rows.push({
            rowNumber: row.rowNumber,
            sku,
            action: 'error',
            messages,
          });
          continue;
        }

        const snapshot = await buildQbuSnapshotState(normalized.qbuData, getLatestExchangeRatePayload);
        const existing = await repository.findImportProductBySku(normalized.sku);

        if (existing) {
          const shouldReplace = replaceSkuSet.size > 0
            ? replaceSkuSet.has(normalized.sku)
            : duplicateStrategy === 'replace';

          if (!shouldReplace) {
            report.skipped += 1;
            report.rows.push({
              rowNumber: row.rowNumber,
              sku: normalized.sku,
              action: 'skipped',
              messages: ['SKU đã tồn tại, bỏ qua theo lựa chọn import'],
            });
            continue;
          }

          const nextMedia = mode === 'replace'
            ? JSON.stringify([])
            : typeof existing.media === 'string' && existing.media.trim()
              ? existing.media
              : JSON.stringify([]);
          const nextImages = clearImages || normalized.productImages.length > 0
            ? normalized.productImages
            : (parseStoredAssetArray(existing.productImages, 'image').length
              ? parseStoredAssetArray(existing.productImages, 'image')
              : parseLegacyMediaAssets(existing.media, 'image'));
          const nextVideos = clearVideos || normalized.productVideos.length > 0
            ? normalized.productVideos
            : (parseStoredAssetArray(existing.productVideos, 'video').length
              ? parseStoredAssetArray(existing.productVideos, 'video')
              : parseLegacyMediaAssets(existing.media, 'video'));
          const nextDocuments = clearDocuments || normalized.productDocuments.length > 0
            ? normalized.productDocuments
            : (parseStoredAssetArray(existing.productDocuments, 'document').length
              ? parseStoredAssetArray(existing.productDocuments, 'document')
              : parseLegacyMediaAssets(existing.media, 'document'));

          await repository.updateProductById(existing.id, {
            sku: normalized.sku,
            name: normalized.name,
            category: normalized.category,
            unit: normalized.unit,
            basePrice: normalized.basePrice,
            currency: normalized.currency,
            specifications: JSON.stringify({}),
            technicalSpecs: normalized.technicalSpecs,
            media: nextMedia,
            productImages: JSON.stringify(nextImages),
            productVideos: JSON.stringify(nextVideos),
            productDocuments: JSON.stringify(nextDocuments),
            qbuData: snapshot.qbuDataStr,
            qbuUpdatedAt: snapshot.qbuUpdatedAt,
            qbuRateSource: snapshot.qbuRateSource,
            qbuRateDate: snapshot.qbuRateDate,
            qbuRateValue: snapshot.qbuRateValue,
            status: normalized.status,
          });

          report.updated += 1;
          report.rows.push({
            rowNumber: row.rowNumber,
            sku: normalized.sku,
            action: 'updated',
            messages: [
              `Đã cập nhật sản phẩm theo SKU (${mode === 'replace' ? 'replace' : 'merge'} mode)`,
              ...(clearImages ? ['Đã reset ảnh theo file import'] : []),
              ...(clearVideos ? ['Đã reset video theo file import'] : []),
              ...(clearDocuments ? ['Đã reset tài liệu theo file import'] : []),
            ],
          });
          continue;
        }

        await repository.insertProduct({
          id: uuidv4(),
          sku: normalized.sku,
          name: normalized.name,
          category: normalized.category,
          unit: normalized.unit,
          basePrice: normalized.basePrice,
          currency: normalized.currency,
          specifications: JSON.stringify({}),
          technicalSpecs: normalized.technicalSpecs,
          media: JSON.stringify([]),
          productImages: JSON.stringify(normalized.productImages),
          productVideos: JSON.stringify(normalized.productVideos),
          productDocuments: JSON.stringify(normalized.productDocuments),
          qbuData: snapshot.qbuDataStr,
          qbuUpdatedAt: snapshot.qbuUpdatedAt,
          qbuRateSource: snapshot.qbuRateSource,
          qbuRateDate: snapshot.qbuRateDate,
          qbuRateValue: snapshot.qbuRateValue,
          status: normalized.status,
        });

        report.created += 1;
        report.rows.push({
          rowNumber: row.rowNumber,
          sku: normalized.sku,
          action: 'created',
          messages: ['Đã tạo sản phẩm mới'],
        });
      }

      return report;
    },
  };
}
