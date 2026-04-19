import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const quotationsSource = readFileSync(resolve(process.cwd(), 'src/Quotations.tsx'), 'utf8');
const editorSource = readFileSync(resolve(process.cwd(), 'src/quotations/QuotationEditor.tsx'), 'utf8');
const previewSource = readFileSync(resolve(process.cwd(), 'src/quotations/QuotationPreviewBlocks.tsx'), 'utf8');

describe('Quotation UX Flow Redesign v1', () => {
  it('treats the list as an operational entry surface instead of a finance-heavy grid', () => {
    expect(quotationsSource).not.toContain('Project');
    expect(quotationsSource).not.toContain('Tổng GT');
    expect(quotationsSource).not.toContain('Tạo SO');
  });

  it('keeps the editor and preview/action area as the primary working surfaces', () => {
    expect(editorSource).toContain('Thông tin Khách hàng');
    expect(previewSource.toLowerCase()).toContain('preview');
    expect(editorSource).toContain('Có cần tính toán tổng giá');
  });

  it('shows approval or revision entry points without restoring a full workflow console', () => {
    expect(previewSource.toLowerCase()).not.toContain('pending approvals');
    expect(previewSource.toLowerCase()).not.toContain('workflow console');
  });
});
