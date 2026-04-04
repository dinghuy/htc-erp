export const PRODUCT_FORM_FIELD_IDS = {
  sku: 'product-form-sku',
  name: 'product-form-name',
  category: 'product-form-category',
  unit: 'product-form-unit',
  basePrice: 'product-form-base-price',
  technicalSpecs: 'product-form-technical-specs',
} as const;

export function getProductFormDismissLabel(mode: 'create' | 'edit') {
  return mode === 'edit' ? 'Huỷ' : 'Đóng';
}

export function getProductFormSubmitLabel({
  saving,
  hasPersistedProduct,
}: {
  saving: boolean;
  hasPersistedProduct: boolean;
}) {
  if (saving) return 'Đang lưu...';
  return hasPersistedProduct ? 'Lưu thay đổi' : 'Tạo sản phẩm';
}

export function formatProductPricePreview(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return null;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return `$${amount.toLocaleString()}`;
}
