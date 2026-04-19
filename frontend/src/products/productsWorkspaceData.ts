import { useMemo, useState } from 'preact/hooks';
import { getProductQbuWarnings } from './ProductDetailModal';
import type {
  ProductDocumentAsset,
  ProductImageAsset,
  ProductVideoAsset,
} from './productAssetUi';

const PRODUCTS_WORKSPACE_STATE_KEY = 'products.workspace.state.v1';

export type ProductWorkspaceViewMode = 'cards' | 'table';

type ProductQbuData = {
  exWorks?: number;
  shipping?: number;
  importTax?: number;
  customFees?: number;
  other?: number;
};

export type ProductListItem = {
  id: string;
  sku?: string;
  name?: string;
  category?: string;
  unit?: string;
  basePrice?: number;
  technicalSpecs?: string;
  productImages?: ProductImageAsset[];
  productVideos?: ProductVideoAsset[];
  productDocuments?: ProductDocumentAsset[];
  qbuData?: ProductQbuData;
};

export type ProductListItemWithHealth = ProductListItem & {
  _completenessScore: number;
  _missingSummary: string;
  _missingItems: string[];
  _qbuWarningSummary: string;
  _qbuWarningCount: number;
  _riskScore: number;
};

export type ProductWorkspaceFilterKey = 'sku' | 'unit' | 'basePrice';

export type ProductWorkspaceSortKey =
  | 'name'
  | 'category'
  | 'basePrice'
  | '_completenessScore'
  | '_missingSummary'
  | '_qbuWarningSummary';

export type ProductWorkspaceColumn = { k: ProductWorkspaceSortKey; l: string };

type WorkspaceFilters = Partial<Record<ProductWorkspaceFilterKey, string>>;

type SortConfig = { key: ProductWorkspaceSortKey; direction: 'asc' | 'desc' } | null;

type PersistedWorkspaceState = {
  searchTerm?: string;
  categoryFilter?: string;
  desktopViewMode?: ProductWorkspaceViewMode;
  showAdvancedFilters?: boolean;
  advancedFilters?: WorkspaceFilters;
};

const FILTER_KEYS: ProductWorkspaceFilterKey[] = ['sku', 'unit', 'basePrice'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getFilterValue(item: ProductListItemWithHealth, key: ProductWorkspaceFilterKey): string {
  if (key === 'sku') return String(item.sku ?? '');
  if (key === 'unit') return String(item.unit ?? '');
  return String(item.basePrice ?? '');
}

function getSortValue(item: ProductListItemWithHealth, key: ProductWorkspaceSortKey): string | number {
  if (key === 'name') return String(item.name ?? '');
  if (key === 'category') return String(item.category ?? '');
  if (key === 'basePrice') return Number(item.basePrice ?? 0);
  if (key === '_completenessScore') return Number(item._completenessScore ?? 0);
  if (key === '_missingSummary') return String(item._missingSummary ?? '');
  return String(item._qbuWarningSummary ?? '');
}

function parseWorkspaceFilters(value: unknown): WorkspaceFilters {
  if (!isRecord(value)) return {};
  return FILTER_KEYS.reduce<WorkspaceFilters>((acc, key) => {
    const raw = value[key];
    if (typeof raw === 'string') {
      acc[key] = raw;
    }
    return acc;
  }, {});
}

function parsePersistedWorkspaceState(value: unknown): PersistedWorkspaceState {
  if (!isRecord(value)) return {};
  return {
    searchTerm: typeof value.searchTerm === 'string' ? value.searchTerm : undefined,
    categoryFilter: typeof value.categoryFilter === 'string' ? value.categoryFilter : undefined,
    desktopViewMode: value.desktopViewMode === 'cards' || value.desktopViewMode === 'table' ? value.desktopViewMode : undefined,
    showAdvancedFilters: typeof value.showAdvancedFilters === 'boolean' ? value.showAdvancedFilters : undefined,
    advancedFilters: parseWorkspaceFilters(value.advancedFilters),
  };
}

export function matchesQuery(value: unknown, needle: string) {
  if (!needle) return true;
  return String(value ?? '').toLowerCase().includes(needle.toLowerCase());
}

export function useSortableData(items: ProductListItemWithHealth[]) {
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [filters, setFilters] = useState<WorkspaceFilters>({});

  const filteredItems = useMemo(() => {
    let result = [...items];

    FILTER_KEYS.forEach((key) => {
      const filterValue = String(filters[key] ?? '').trim().toLowerCase();
      if (!filterValue) return;
      result = result.filter((item) => getFilterValue(item, key).toLowerCase().includes(filterValue));
    });

    if (sortConfig) {
      result.sort((a, b) => {
        const aValue = getSortValue(a, sortConfig.key);
        const bValue = getSortValue(b, sortConfig.key);

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
        }

        const vA = String(aValue).toLowerCase();
        const vB = String(bValue).toLowerCase();
        if (vA < vB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (vA > vB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [items, sortConfig, filters]);

  return {
    items: filteredItems,
    requestSort: (key: ProductWorkspaceSortKey) => {
      const direction = sortConfig?.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc';
      setSortConfig({ key, direction });
    },
    sortConfig,
    filters,
    setFilters,
  };
}

export function computeProductHealth(product: ProductListItem, latestRate: number | null): ProductListItemWithHealth {
  const qbuWarnings = getProductQbuWarnings(product, latestRate);
  const qbuData = product.qbuData || {};
  const totalQbu =
    (Number(qbuData.exWorks) || 0) +
    (Number(qbuData.shipping) || 0) +
    (Number(qbuData.importTax) || 0) +
    (Number(qbuData.customFees) || 0) +
    (Number(qbuData.other) || 0);

  const coreChecks = [
    Boolean(String(product.sku || '').trim()),
    Boolean(String(product.name || '').trim()),
    Boolean(String(product.category || '').trim()),
    Boolean(String(product.unit || '').trim()),
    Number(product.basePrice || 0) > 0,
  ];
  const coreReadyCount = coreChecks.filter(Boolean).length;
  const images = Array.isArray(product.productImages) ? product.productImages : [];
  const videos = Array.isArray(product.productVideos) ? product.productVideos : [];
  const documents = Array.isArray(product.productDocuments) ? product.productDocuments : [];
  const hasHeroImage = images.some((image) => Boolean(image?.isPrimary));
  const hasSupportingMedia = images.filter((image) => !image?.isPrimary).length + videos.length > 0;
  const hasDocuments = documents.length > 0;
  const hasTechnicalSpecs = Boolean(String(product.technicalSpecs || '').trim());
  const hasQbu = totalQbu > 0;
  const hasSevereQbuWarning = qbuWarnings.some((warning) => warning.key === 'snapshot');
  const healthyQbu = hasQbu && !hasSevereQbuWarning;

  const completenessScore = Math.round(
    (coreReadyCount / coreChecks.length) * 40 +
      (hasHeroImage ? 15 : 0) +
      (hasSupportingMedia ? 10 : 0) +
      (hasDocuments ? 15 : 0) +
      (hasTechnicalSpecs ? 10 : 0) +
      (healthyQbu ? 10 : hasQbu ? 5 : 0),
  );

  const missingItems = [
    coreReadyCount < coreChecks.length ? 'Nhận diện cốt lõi' : '',
    !hasHeroImage ? 'Ảnh đại diện' : '',
    !hasSupportingMedia ? 'Media bổ trợ' : '',
    !hasDocuments ? 'Tài liệu' : '',
    !hasTechnicalSpecs ? 'Thông số kỹ thuật' : '',
    !hasQbu ? 'QBU' : '',
    hasSevereQbuWarning ? 'QBU thiếu FX' : '',
  ].filter(Boolean);

  const qbuWarningCount = qbuWarnings.length;
  const qbuWarningSummary = qbuWarnings.map((warning) => warning.label).join(', ');
  const riskScore = (100 - completenessScore) + qbuWarningCount * 15;

  return {
    ...product,
    _completenessScore: completenessScore,
    _missingSummary: missingItems.length ? missingItems.join(', ') : 'Đầy đủ',
    _missingItems: missingItems,
    _qbuWarningSummary: qbuWarningSummary || 'Ổn định',
    _qbuWarningCount: qbuWarningCount,
    _riskScore: riskScore,
  };
}

export function readPersistedWorkspaceState(): PersistedWorkspaceState {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(PRODUCTS_WORKSPACE_STATE_KEY);
    if (!raw) return {};
    return parsePersistedWorkspaceState(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function persistWorkspaceState(state: PersistedWorkspaceState) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PRODUCTS_WORKSPACE_STATE_KEY, JSON.stringify(state));
  } catch {
  }
}
