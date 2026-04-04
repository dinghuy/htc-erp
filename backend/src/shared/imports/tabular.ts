import path from 'path';
import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';

export type ImportRowAction = 'created' | 'updated' | 'skipped' | 'error';

export type ImportRowResult = {
  rowNumber: number;
  key: string | null;
  action: ImportRowAction;
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

export type ParsedImportRow = {
  rowNumber: number;
  values: Record<string, string>;
};

function normalizeHeaderKey(raw: unknown) {
  return String(raw ?? '').trim();
}

function normalizeCellValue(raw: unknown) {
  if (raw === null || raw === undefined) return '';
  return String(raw).trim();
}

function parseCsvRows(buffer: Buffer): ParsedImportRow[] {
  const records = parse(buffer.toString('utf-8'), {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, unknown>[];

  return records.map((record, index) => ({
    rowNumber: index + 2,
    values: Object.fromEntries(
      Object.entries(record).map(([key, value]) => [normalizeHeaderKey(key), normalizeCellValue(value)]),
    ),
  }));
}

function parseXlsxRows(buffer: Buffer): ParsedImportRow[] {
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
      Object.entries(record).map(([key, value]) => [normalizeHeaderKey(key), normalizeCellValue(value)]),
    ),
  }));
}

export function parseTabularRowsFromFile(file: Express.Multer.File): ParsedImportRow[] {
  const extension = path.extname(file.originalname || '').toLowerCase();
  if (extension === '.csv') return parseCsvRows(file.buffer);
  if (extension === '.xlsx') return parseXlsxRows(file.buffer);
  throw new Error('Unsupported file format. Please upload a CSV or XLSX file.');
}

export function createImportReport(totalRows: number): ImportReport {
  return {
    totalRows,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    rows: [],
  };
}
