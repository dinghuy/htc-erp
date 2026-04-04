import { describe, expect, it } from 'vitest';
import {
  PRODUCT_FORM_FIELD_IDS,
  formatProductPricePreview,
  getProductFormDismissLabel,
  getProductFormSubmitLabel,
} from './productFormPresentation';

describe('product form presentation helpers', () => {
  it('uses enterprise action labels for dismiss and submit states', () => {
    expect(getProductFormDismissLabel('edit')).toBe('Huỷ');
    expect(getProductFormDismissLabel('create')).toBe('Đóng');
    expect(getProductFormSubmitLabel({ saving: true, hasPersistedProduct: true })).toBe('Đang lưu...');
    expect(getProductFormSubmitLabel({ saving: false, hasPersistedProduct: true })).toBe('Lưu thay đổi');
    expect(getProductFormSubmitLabel({ saving: false, hasPersistedProduct: false })).toBe('Tạo sản phẩm');
  });

  it('formats the price preview in USD for quick visual confirmation', () => {
    expect(formatProductPricePreview('1234')).toBe('$1,234');
    expect(formatProductPricePreview(2500000)).toBe('$2,500,000');
    expect(formatProductPricePreview('')).toBeNull();
    expect(formatProductPricePreview('abc')).toBeNull();
  });

  it('exposes stable ids so labels can target the correct inputs', () => {
    expect(PRODUCT_FORM_FIELD_IDS).toEqual({
      sku: 'product-form-sku',
      name: 'product-form-name',
      category: 'product-form-category',
      unit: 'product-form-unit',
      basePrice: 'product-form-base-price',
      technicalSpecs: 'product-form-technical-specs',
    });
  });
});
