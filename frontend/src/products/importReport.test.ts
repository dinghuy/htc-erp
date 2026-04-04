import { describe, expect, it } from 'vitest';
import {
  buildProductImportPreviewSummary,
  buildProductImportSummary,
  normalizeProductImportPreview,
  normalizeProductImportReport,
} from './importReport';

describe('product import report helpers', () => {
  it('normalizes report counts and row details', () => {
    const report = normalizeProductImportReport({
      totalRows: '4',
      created: 1,
      updated: '2',
      skipped: undefined,
      errors: '1',
      rows: [
        { rowNumber: '2', sku: 'SKU-001', action: 'created', messages: ['created'] },
        { sku: '', action: 'unexpected', messages: [' bad input ', ''] },
      ],
    });

    expect(report).toEqual({
      mode: 'merge',
      clearImages: false,
      clearVideos: false,
      clearDocuments: false,
      totalRows: 4,
      created: 1,
      updated: 2,
      skipped: 0,
      errors: 1,
      rows: [
        { rowNumber: 2, sku: 'SKU-001', action: 'created', messages: ['created'] },
        { rowNumber: 3, sku: null, action: 'error', messages: ['bad input'] },
      ],
    });
  });

  it('builds a summary string for the import modal and notification', () => {
    expect(buildProductImportSummary({
      mode: 'replace',
      clearImages: true,
      clearVideos: false,
      clearDocuments: true,
      totalRows: 5,
      created: 2,
      updated: 1,
      skipped: 1,
      errors: 2,
      rows: [],
    })).toBe('Import hoàn tất (replace toàn phần; reset ảnh, reset tài liệu): 2 tạo mới, 1 cập nhật, 1 bỏ qua, 2 lỗi.');
  });

  it('normalizes preview counts and duplicate rows', () => {
    const preview = normalizeProductImportPreview({
      totalRows: '3',
      newRows: '1',
      duplicateRows: 1,
      errorRows: '1',
      rows: [
        {
          rowNumber: '2',
          sku: 'SKU-001',
          action: 'duplicate',
          incomingName: 'Incoming',
          existingName: 'Existing',
          changes: ['Giá', 'Ảnh'],
          compare: [{ label: 'Giá', currentValue: '100', incomingValue: '200', changed: true }],
          messages: ['duplicate'],
        },
        { sku: '', action: 'weird', incomingName: 'Broken', changes: [''], messages: [' bad input ', ''] },
      ],
    });

    expect(preview).toEqual({
      totalRows: 3,
      newRows: 1,
      duplicateRows: 1,
      errorRows: 1,
      rows: [
        {
          rowNumber: 2,
          sku: 'SKU-001',
          action: 'duplicate',
          incomingName: 'Incoming',
          existingName: 'Existing',
          changes: ['Giá', 'Ảnh'],
          compare: [{ label: 'Giá', currentValue: '100', incomingValue: '200', changed: true }],
          messages: ['duplicate'],
        },
        { rowNumber: 3, sku: null, action: 'error', incomingName: 'Broken', existingName: undefined, changes: [], compare: [], messages: ['bad input'] },
      ],
    });
  });

  it('builds a preview summary string', () => {
    expect(buildProductImportPreviewSummary({
      totalRows: 8,
      newRows: 3,
      duplicateRows: 4,
      errorRows: 1,
      rows: [],
    })).toBe('Phân tích file hoàn tất: 3 sản phẩm mới, 4 dòng trùng SKU, 1 dòng lỗi.');
  });
});
