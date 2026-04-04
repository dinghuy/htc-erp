export type ProductImportRowResult = {
  rowNumber: number;
  sku: string | null;
  action: 'created' | 'updated' | 'skipped' | 'error';
  messages: string[];
};

export type ProductImportReport = {
  mode: 'merge' | 'replace';
  clearImages: boolean;
  clearVideos: boolean;
  clearDocuments: boolean;
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  rows: ProductImportRowResult[];
};

export type ProductImportPreviewRow = {
  rowNumber: number;
  sku: string | null;
  action: 'new' | 'duplicate' | 'error';
  incomingName: string;
  existingName?: string;
  changes: string[];
  compare: Array<{
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

function toNumber(value: unknown) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : 0;
}

export function normalizeProductImportReport(raw: any): ProductImportReport {
  const rows = Array.isArray(raw?.rows)
    ? raw.rows.map((row: any, index: number) => ({
      rowNumber: toNumber(row?.rowNumber) || index + 2,
      sku: typeof row?.sku === 'string' && row.sku.trim() ? row.sku.trim() : null,
      action: row?.action === 'created' || row?.action === 'updated' || row?.action === 'skipped' || row?.action === 'error'
        ? row.action
        : 'error',
      messages: Array.isArray(row?.messages)
        ? row.messages.map((message: unknown) => String(message).trim()).filter(Boolean)
        : [],
    }))
    : [];

  return {
    mode: raw?.mode === 'replace' ? 'replace' : 'merge',
    clearImages: raw?.clearImages === true,
    clearVideos: raw?.clearVideos === true,
    clearDocuments: raw?.clearDocuments === true,
    totalRows: toNumber(raw?.totalRows),
    created: toNumber(raw?.created),
    updated: toNumber(raw?.updated),
    skipped: toNumber(raw?.skipped),
    errors: toNumber(raw?.errors),
    rows,
  };
}

export function normalizeProductImportPreview(raw: any): ProductImportPreviewReport {
  const rows = Array.isArray(raw?.rows)
    ? raw.rows.map((row: any, index: number) => ({
      rowNumber: toNumber(row?.rowNumber) || index + 2,
      sku: typeof row?.sku === 'string' && row.sku.trim() ? row.sku.trim() : null,
      action: row?.action === 'new' || row?.action === 'duplicate' || row?.action === 'error'
        ? row.action
        : 'error',
      incomingName: typeof row?.incomingName === 'string' ? row.incomingName.trim() : '',
      existingName: typeof row?.existingName === 'string' && row.existingName.trim() ? row.existingName.trim() : undefined,
      changes: Array.isArray(row?.changes) ? row.changes.map((value: unknown) => String(value).trim()).filter(Boolean) : [],
      compare: Array.isArray(row?.compare)
        ? row.compare.map((entry: any) => ({
          label: String(entry?.label ?? '').trim(),
          currentValue: String(entry?.currentValue ?? '').trim(),
          incomingValue: String(entry?.incomingValue ?? '').trim(),
          changed: entry?.changed === true,
        })).filter((entry: { label: string }) => entry.label)
        : [],
      messages: Array.isArray(row?.messages) ? row.messages.map((value: unknown) => String(value).trim()).filter(Boolean) : [],
    }))
    : [];

  return {
    totalRows: toNumber(raw?.totalRows),
    newRows: toNumber(raw?.newRows),
    duplicateRows: toNumber(raw?.duplicateRows),
    errorRows: toNumber(raw?.errorRows),
    rows,
  };
}

export function buildProductImportSummary(report: ProductImportReport) {
  const modeLabel = report.mode === 'replace' ? 'replace toàn phần' : 'merge an toàn';
  const clears = [
    report.clearImages ? 'reset ảnh' : '',
    report.clearVideos ? 'reset video' : '',
    report.clearDocuments ? 'reset tài liệu' : '',
  ].filter(Boolean);
  const clearLabel = clears.length ? `; ${clears.join(', ')}` : '';
  return `Import hoàn tất (${modeLabel}${clearLabel}): ${report.created} tạo mới, ${report.updated} cập nhật, ${report.skipped} bỏ qua, ${report.errors} lỗi.`;
}

export function buildProductImportPreviewSummary(report: ProductImportPreviewReport) {
  return `Phân tích file hoàn tất: ${report.newRows} sản phẩm mới, ${report.duplicateRows} dòng trùng SKU, ${report.errorRows} dòng lỗi.`;
}
