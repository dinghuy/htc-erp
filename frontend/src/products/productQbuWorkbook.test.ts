import { describe, expect, it } from 'vitest';
import {
  createSuggestedWorkbookLines,
  normalizeProductQbuWorkbook,
} from './productQbuWorkbook';

describe('productQbuWorkbook', () => {
  it('keeps an empty qbu payload empty instead of fabricating snapshot lines', () => {
    const workbook = normalizeProductQbuWorkbook({});
    expect(workbook.lines).toEqual([]);
    expect(workbook.totalAmount).toBe(0);
    expect(workbook.incoterm).toBe('EXW');
  });

  it('converts legacy qbu fields into workbook lines and derived totals', () => {
    const workbook = normalizeProductQbuWorkbook({
      exWorks: 100,
      shipping: 20,
      importTax: 30,
      customFees: 40,
      other: 50,
    });

    expect(workbook.lines).toHaveLength(5);
    expect(workbook.exWorks).toBe(100);
    expect(workbook.shipping).toBe(20);
    expect(workbook.importTax).toBe(30);
    expect(workbook.customFees).toBe(40);
    expect(workbook.other).toBe(50);
    expect(workbook.totalAmount).toBe(240);
  });

  it('seeds editable workbook lines from incoterm suggestions', () => {
    const lines = createSuggestedWorkbookLines('CIF', 'USD');
    expect(lines[0].name).toContain('CIF');
    expect(lines.some((line) => line.group === 'import')).toBe(true);
    expect(lines.every((line) => line.currency === 'USD')).toBe(true);
  });
});
