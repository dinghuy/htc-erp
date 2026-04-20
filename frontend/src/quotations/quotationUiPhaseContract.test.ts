import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const quotationsSource = readFileSync(path.resolve(__dirname, '..', 'Quotations.tsx'), 'utf8');
const editorSource = readFileSync(path.resolve(__dirname, 'QuotationEditor.tsx'), 'utf8');
const previewSource = readFileSync(path.resolve(__dirname, 'QuotationPreviewBlocks.tsx'), 'utf8');

describe('quotation UI phase contract', () => {
  it('forces new quotation creates to disable implicit project auto-creation', () => {
    expect(quotationsSource).toContain('autoCreateProject: false');
  });

  it('loads quotation product catalog through the authenticated client', () => {
    expect(quotationsSource).toContain("fetchWithAuth(token, `${API}/products`)");
  });

  it('removes project and revision authoring controls from the editor source', () => {
    expect(editorSource).not.toContain('Project / Deal Workspace');
    expect(editorSource).not.toContain('Revision');
  });

  it('keeps the new pricing controls below the item workspace', () => {
    expect(editorSource).toContain('Tính VAT');
    expect(editorSource).toContain('Tính tổng');
    expect(editorSource).toContain('VAT %');
    expect(editorSource).toContain('Các phương án báo giá');
    expect(editorSource).toContain('+ Line');
    expect(editorSource).toContain('+ Thêm phương án');
    expect(editorSource).toContain('Chi tiết dòng đang chọn');
    expect(editorSource).toContain('Kéo để đổi thứ tự phương án');
    expect(editorSource).not.toContain('Tiền tệ mặc định của phương án');
    expect(editorSource).toContain('showVatRate');
    expect(editorSource).toContain('Kéo để đổi thứ tự dòng trong phương án');
    expect(editorSource).toContain("minHeight: '168px'");
  });

  it('adds per-line currency and VAT controls from the historical quotation pricing backlog', () => {
    expect(editorSource).toContain('Tiền tệ');
    expect(editorSource).toContain('VAT mode');
    expect(editorSource).toContain('NET');
    expect(editorSource).toContain('Gross');
    expect(previewSource).toContain('VAT:');
    expect(previewSource).toContain('MIXED');
  });

  it('removes revision, project, totals, and sales-order clutter from the list source', () => {
    expect(quotationsSource).not.toContain("'Revision'");
    expect(quotationsSource).not.toContain("'Project'");
    expect(quotationsSource).not.toContain("'Tổng GT'");
    expect(quotationsSource).not.toContain('Tạo SO');
    expect(quotationsSource).not.toContain('handleCreateRevision');
    expect(quotationsSource).not.toContain('createSalesOrderFromQuotation');
  });

  it('removes visible quotation status-changing controls while preserving status badges', () => {
    expect(quotationsSource).toContain('getQuotationStatusMeta');
    expect(quotationsSource).not.toContain('Đổi trạng thái');
    expect(previewSource).not.toContain("t('sales.quotations.change_status')");
    expect(previewSource).not.toContain("t('sales.quotations.reminder')");
  });

  it('uses live VAT and total-visibility semantics in preview', () => {
    expect(previewSource).toContain('formatCurrencyValue(group.summary.vatTotal, group.currency)');
    expect(previewSource).toContain('group.totalComputed');
    expect(previewSource).toContain('group.displayLabel');
  });

  it('keeps desktop overflow containment on the editor shell', () => {
    expect(editorSource).toContain("overflowX: 'auto'");
    expect(editorSource).toContain("minWidth: '1180px'");
  });
});
