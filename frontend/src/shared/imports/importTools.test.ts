import { describe, expect, it } from 'vitest';
import { buildImportSummary, normalizeImportReport } from './importReport';
import { buildTabularFileUrl } from './tabularFiles';

describe('shared import tools', () => {
  it('normalizes generic import report rows', () => {
    const report = normalizeImportReport({
      totalRows: '3',
      created: 1,
      updated: '0',
      skipped: null,
      errors: '2',
      rows: [
        { rowNumber: '2', key: 'ACC-01', action: 'created', messages: ['ok'] },
        { rowNumber: '3', sku: 'SKU-02', action: 'error', messages: ['bad row'] },
      ],
    });

    expect(report.totalRows).toBe(3);
    expect(report.created).toBe(1);
    expect(report.errors).toBe(2);
    expect(report.rows[0].key).toBe('ACC-01');
    expect(report.rows[1].key).toBe('SKU-02');
  });

  it('builds summary and format-aware file urls', () => {
    expect(buildImportSummary({
      totalRows: 4,
      created: 2,
      updated: 1,
      skipped: 0,
      errors: 1,
      rows: [],
    })).toContain('2 tạo mới');
    expect(buildTabularFileUrl('/api/template/products', 'xlsx')).toBe('/api/template/products?format=xlsx');
  });
});
