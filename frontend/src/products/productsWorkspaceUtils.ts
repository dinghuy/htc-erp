import type { ProductImportPreviewReport } from './importReport';
import type {
  ProductListItemWithHealth,
  ProductWorkspaceColumn,
  ProductWorkspaceSortKey,
  ProductWorkspaceViewMode,
} from './productsWorkspaceData';

export const PRODUCT_COLUMNS: ProductWorkspaceColumn[] = [
  { k: 'name', l: 'Tên' },
  { k: 'category', l: 'Danh mục' },
  { k: 'basePrice', l: 'Giá bán ($)' },
  { k: '_completenessScore', l: 'Completeness' },
  { k: '_missingSummary', l: 'Thiếu gì' },
  { k: '_qbuWarningSummary', l: 'QBU warning' },
];

export const ADVANCED_FILTER_FIELDS = [
  { key: 'sku', label: 'SKU' },
  { key: 'unit', label: 'Đơn vị' },
  { key: 'basePrice', label: 'Giá bán ($)' },
] as const;

export function getModeButtonLabel(mode: ProductWorkspaceViewMode) {
  return mode === 'cards' ? 'Chế độ thẻ' : 'Chế độ bảng';
}

export function getSortLabel(
  sortConfig: { key: ProductWorkspaceSortKey; direction: 'asc' | 'desc' } | null,
  key: ProductWorkspaceSortKey,
) {
  if (sortConfig?.key !== key) return 'Chưa sắp xếp';
  return sortConfig.direction === 'asc' ? 'Tăng dần' : 'Giảm dần';
}

export function getSortIcon(
  sortConfig: { key: ProductWorkspaceSortKey; direction: 'asc' | 'desc' } | null,
  key: ProductWorkspaceSortKey,
) {
  if (sortConfig?.key !== key) return '↕';
  return sortConfig.direction === 'asc' ? '↑' : '↓';
}

export function getColumnAriaSort(
  sortConfig: { key: ProductWorkspaceSortKey; direction: 'asc' | 'desc' } | null,
  key: ProductWorkspaceSortKey,
): 'none' | 'ascending' | 'descending' {
  if (sortConfig?.key !== key) return 'none';
  return sortConfig.direction === 'asc' ? 'ascending' : 'descending';
}

export function extractDuplicateSkusFromPreview(report: ProductImportPreviewReport | null): string[] {
  if (!report) return [];
  return report.rows.flatMap((row) => {
    if (row.action !== 'duplicate') return [];
    const sku = String(row.sku ?? '').trim();
    return sku ? [sku] : [];
  });
}

export function getTopProblemProducts(items: ProductListItemWithHealth[]): ProductListItemWithHealth[] {
  return [...items].sort((a, b) => b._riskScore - a._riskScore).slice(0, 5);
}

export function getCompletenessSummary(items: ProductListItemWithHealth[]) {
  if (!items.length) {
    return { averageScore: 0, healthyCount: 0, warningCount: 0, missingCount: 0 };
  }

  const healthyCount = items.filter((item) => item._completenessScore >= 80 && item._qbuWarningCount === 0).length;
  const warningCount = items.filter((item) => item._qbuWarningCount > 0).length;
  const missingCount = items.filter((item) => item._missingItems.length > 0).length;
  const averageScore = Math.round(items.reduce((sum, item) => sum + item._completenessScore, 0) / items.length);

  return { averageScore, healthyCount, warningCount, missingCount };
}
