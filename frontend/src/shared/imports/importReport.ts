export type ImportRowResult = {
  rowNumber: number;
  key: string | null;
  action: 'created' | 'updated' | 'skipped' | 'error';
  messages: string[];
};

export type ImportReport = {
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  rows: ImportRowResult[];
};

function toNumber(value: unknown) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : 0;
}

export function normalizeImportReport(raw: any): ImportReport {
  const rows = Array.isArray(raw?.rows)
    ? raw.rows.map((row: any, index: number) => ({
      rowNumber: toNumber(row?.rowNumber) || index + 2,
      key: typeof row?.key === 'string' && row.key.trim()
        ? row.key.trim()
        : typeof row?.sku === 'string' && row.sku.trim()
          ? row.sku.trim()
          : null,
      action: row?.action === 'created' || row?.action === 'updated' || row?.action === 'skipped' || row?.action === 'error'
        ? row.action
        : 'error',
      messages: Array.isArray(row?.messages)
        ? row.messages.map((message: unknown) => String(message).trim()).filter(Boolean)
        : [],
    }))
    : [];

  return {
    totalRows: toNumber(raw?.totalRows),
    created: toNumber(raw?.created),
    updated: toNumber(raw?.updated),
    skipped: toNumber(raw?.skipped),
    errors: toNumber(raw?.errors),
    rows,
  };
}

export function buildImportSummary(report: ImportReport) {
  return `Import hoàn tất: ${report.created} tạo mới, ${report.updated} cập nhật, ${report.skipped} bỏ qua, ${report.errors} lỗi.`;
}
