import { API_BASE } from './config';
import { useState, useEffect, useMemo, useRef } from 'preact/hooks';
import { showNotify } from './Notification';
import { tokens } from './ui/tokens';
import { ui } from './ui/styles';
import { canEdit, canDelete, fetchWithAuth, loadSession } from './auth';
import { useI18n } from './i18n';
import { OverlayModal } from './ui/OverlayModal';
import { ConfirmDialog } from './ui/ConfirmDialog';
import {
  buildProductImportPreviewSummary,
  buildProductImportSummary,
  normalizeProductImportPreview,
  normalizeProductImportReport,
  type ProductImportPreviewReport,
  type ProductImportReport,
} from './products/importReport';
import {
  ProductImportReportModal,
  ProductImportWizardModal,
} from './products/productImportModals';
import {
  ProductAssetGallery,
  ProductDocumentWorkspace,
  ProductVideoGallery,
  resolveAssetUrl,
} from './products/productAssetUi';
import type { PreparedVideoUploadMode } from './shared/uploads/videoUpload';
import { AssetListEditor } from './products/productAssetEditor';
import {
  PRODUCT_FORM_FIELD_IDS,
  formatProductPricePreview,
  getProductFormDismissLabel,
  getProductFormSubmitLabel,
} from './products/productFormPresentation';
import { getProductMediaCollections } from './products/productMedia';
import {
  DetailField,
  DetailSection,
  ProductProfileStatusPanel,
  ProductTimeline,
  formatDateTimeLabel,
  type ProductProfileStatus,
  type ProductTimelineEntry,
} from './products/productDetailSections';
import { buildTabularFileUrl } from './shared/imports/tabularFiles';
import { FormatActionButton } from './ui/FormatActionButton';
import { PageHeader } from './ui/PageHeader';
import {
  EditIcon,
  ExportIcon,
  EyeIcon,
  ImportIcon,
  LoaderIcon,
  PackageIcon,
  PlusIcon,
  SearchIcon,
  SheetIcon,
  TrashIcon,
} from './ui/icons';

const API = API_BASE;
const API_ORIGIN = API.replace(/\/api\/?$/, '');
const FX_PAIR = 'USDVND';
const VN_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const PRODUCT_DETAIL_PANEL_BG = tokens.surface.panelGradient;
const PRODUCT_DETAIL_HERO_BG = tokens.surface.heroGradient;
const PRODUCT_DETAIL_SURFACE_BG = tokens.colors.surfaceSubtle;

const S = {
  card: ui.card.base as any,
  btnPrimary: { ...ui.btn.primary, justifyContent: 'center', transition: 'all 0.2s ease' } as any,
  btnOutline: { ...ui.btn.outline, transition: 'all 0.2s ease' } as any,
  thSortable: ui.table.thSortable as any,
  thStatic: ui.table.thStatic as any,
  td: ui.table.td as any,
  input: { ...ui.input.base, transition: 'all 0.2s ease' } as any,
  kpiCard: ui.card.kpi as any,
  label: { ...ui.form.label, display: 'block', marginBottom: '6px' } as any,
  tabBtn: (active: boolean) => ({
    padding: `${tokens.spacing.md} ${tokens.spacing.xl}`,
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
    background: active ? tokens.colors.primary : 'transparent',
    color: active ? tokens.colors.textOnPrimary : tokens.colors.textSecondary,
    border: 'none',
    borderRadius: tokens.radius.lg,
    transition: 'all 0.2s ease'
  }) as any
};

const UNITS = ['Chiếc', 'Bộ', 'Cái', 'Cặp', 'Hộp', 'Thùng', 'Kg', 'Gói'];

type QbuWarning = {
  key: string;
  label: string;
  style: any;
};

type ProductImageAsset = {
  id?: string;
  title: string;
  url: string;
  alt?: string;
  isPrimary?: boolean;
  sourceType?: 'url' | 'upload';
  fileName?: string;
  mimeType?: string;
  size?: number;
  createdAt?: string;
};

type ProductDocumentAsset = {
  id?: string;
  title: string;
  url: string;
  description?: string;
  sourceType?: 'url' | 'upload';
  fileName?: string;
  mimeType?: string;
  size?: number;
  createdAt?: string;
};

type ProductVideoAsset = {
  id?: string;
  title: string;
  url: string;
  description?: string;
  sourceType?: 'url' | 'upload';
  fileName?: string;
  mimeType?: string;
  size?: number;
  createdAt?: string;
  durationSeconds?: number;
  width?: number;
  height?: number;
  uploadMode?: PreparedVideoUploadMode | 'external-url';
};

export type UploadFeedback = {
  tone: 'info' | 'success' | 'error';
  message: string;
  stage?: 'reading-metadata' | 'loading-engine' | 'transcoding' | 'uploading' | 'fallback' | 'completed' | 'deleting';
  progress?: number;
};

type ProductFormState = {
  sku: string;
  name: string;
  category: string;
  unit: string;
  basePrice: string | number;
  technicalSpecs: string;
  qbuData?: Record<string, any>;
  productImages: ProductImageAsset[];
  productVideos: ProductVideoAsset[];
  productDocuments: ProductDocumentAsset[];
  [key: string]: any;
};

function ensureAssetTitle(title: string | undefined, fallbackUrl: string, prefix: string) {
  const trimmed = String(title ?? '').trim();
  if (trimmed) return trimmed;
  const fileName = fallbackUrl.split('/').pop();
  return fileName || prefix;
}

function normalizePrimaryImageAssets(images: ProductImageAsset[]) {
  let primaryAssigned = false;
  const normalized = images.map((image) => {
    const nextIsPrimary = Boolean(image.isPrimary) && !primaryAssigned;
    if (nextIsPrimary) primaryAssigned = true;
    return { ...image, isPrimary: nextIsPrimary };
  });

  if (!normalized.length) return normalized;

  const primaryIndex = normalized.findIndex((image) => image.isPrimary);
  if (primaryIndex > 0) {
    const [primaryImage] = normalized.splice(primaryIndex, 1);
    normalized.unshift(primaryImage);
  }

  return normalized;
}

function getPrimaryImage(images: ProductImageAsset[]) {
  return normalizePrimaryImageAssets(images)[0] || null;
}

function normalizeImageAssets(raw: unknown): ProductImageAsset[] {
  if (!Array.isArray(raw)) return [];
  const normalized = raw.flatMap((entry: any, index: number) => {
    const url = String(entry?.url ?? '').trim();
    if (!url) return [];
    const title = ensureAssetTitle(entry?.title, url, `Image ${index + 1}`);
    return [{
      id: String(entry?.id ?? `image-${index + 1}`),
      title,
      url,
      alt: String(entry?.alt ?? '').trim() || title,
      isPrimary: entry?.isPrimary === true,
      sourceType: (entry?.sourceType === 'upload' ? 'upload' : 'url') as 'url' | 'upload',
      fileName: String(entry?.fileName ?? '').trim() || undefined,
      mimeType: String(entry?.mimeType ?? '').trim() || undefined,
      size: Number.isFinite(Number(entry?.size)) ? Number(entry.size) : undefined,
      createdAt: String(entry?.createdAt ?? '').trim() || undefined,
    }];
  });
  return normalizePrimaryImageAssets(normalized);
}

function normalizeDocumentAssets(raw: unknown): ProductDocumentAsset[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry: any, index: number) => {
    const url = String(entry?.url ?? '').trim();
    if (!url) return [];
    return [{
      id: String(entry?.id ?? `document-${index + 1}`),
      title: ensureAssetTitle(entry?.title, url, `Document ${index + 1}`),
      url,
      description: String(entry?.description ?? '').trim() || undefined,
      sourceType: (entry?.sourceType === 'upload' ? 'upload' : 'url') as 'url' | 'upload',
      fileName: String(entry?.fileName ?? '').trim() || undefined,
      mimeType: String(entry?.mimeType ?? '').trim() || undefined,
      size: Number.isFinite(Number(entry?.size)) ? Number(entry.size) : undefined,
      createdAt: String(entry?.createdAt ?? '').trim() || undefined,
    }];
  });
}

function normalizeVideoAssets(raw: unknown): ProductVideoAsset[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry: any, index: number) => {
    const url = String(entry?.url ?? '').trim();
    if (!url) return [];
    return [{
      id: String(entry?.id ?? `video-${index + 1}`),
      title: ensureAssetTitle(entry?.title, url, `Video ${index + 1}`),
      url,
      description: String(entry?.description ?? '').trim() || undefined,
      sourceType: (entry?.sourceType === 'upload' ? 'upload' : 'url') as 'url' | 'upload',
      fileName: String(entry?.fileName ?? '').trim() || undefined,
      mimeType: String(entry?.mimeType ?? '').trim() || undefined,
      size: Number.isFinite(Number(entry?.size)) ? Number(entry.size) : undefined,
      createdAt: String(entry?.createdAt ?? '').trim() || undefined,
      durationSeconds: Number.isFinite(Number(entry?.durationSeconds)) ? Number(entry.durationSeconds) : undefined,
      width: Number.isFinite(Number(entry?.width)) ? Number(entry.width) : undefined,
      height: Number.isFinite(Number(entry?.height)) ? Number(entry.height) : undefined,
      uploadMode:
        entry?.uploadMode === 'transcoded' || entry?.uploadMode === 'direct-mp4' || entry?.uploadMode === 'external-url'
          ? entry.uploadMode
          : entry?.sourceType === 'upload'
            ? 'direct-mp4'
            : 'external-url',
    }];
  });
}

export function createEmptyProductForm(): ProductFormState {
  return {
    sku: '',
    name: '',
    category: '',
    unit: 'Chiếc',
    basePrice: '',
    technicalSpecs: '',
    productImages: [],
    productVideos: [],
    productDocuments: [],
  };
}

export function createProductFormFromProduct(product: any): ProductFormState {
  const mediaCollections = getProductMediaCollections(product);
  return {
    ...product,
    qbuData: product?.qbuData || {},
    productImages: normalizeImageAssets(mediaCollections.images),
    productVideos: normalizeVideoAssets(mediaCollections.videos),
    productDocuments: normalizeDocumentAssets(mediaCollections.documents),
  };
}



function getVnCalendarParts(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: VN_TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(date);

  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);

  if (!year || !month || !day) return null;
  return { year, month, day };
}

function isOlderThanCalendarMonths(value: string | Date | null | undefined, months: number) {
  const current = getVnCalendarParts(new Date());
  const target = getVnCalendarParts(value);
  if (!current || !target) return false;

  const monthDiff = (current.year - target.year) * 12 + (current.month - target.month);
  if (monthDiff > months) return true;
  if (monthDiff < months) return false;
  return target.day <= current.day;
}

function hasQbuSnapshot(product: any) {
  const qbuData = product?.qbuData && typeof product.qbuData === 'object' && !Array.isArray(product.qbuData)
    ? product.qbuData
    : {};
  return Object.keys(qbuData).length > 0;
}

function getProductQbuWarnings(product: any, latestRate: number | null): QbuWarning[] {
  const warnings: QbuWarning[] = [];
  const qbuRateValue = Number(product?.qbuRateValue);
  const hasSnapshot = hasQbuSnapshot(product);

  if (latestRate != null && product?.qbuRateValue != null && qbuRateValue > 0 && latestRate >= qbuRateValue * 1.025) {
    warnings.push({ key: 'fx', label: 'FX +2.5%', style: ui.badge.warning });
  }

  if (isOlderThanCalendarMonths(product?.qbuUpdatedAt, 6)) {
    warnings.push({ key: 'stale', label: 'QBU 6M', style: ui.badge.warning });
  }

  if (hasSnapshot && (product?.qbuRateValue == null || product?.qbuRateDate == null)) {
    warnings.push({ key: 'snapshot', label: 'No FX', style: ui.badge.error });
  }

  return warnings;
}

function matchesQuery(value: unknown, needle: string) {
  if (!needle) return true;
  return String(value ?? '').toLowerCase().includes(needle.toLowerCase());
}

function QbuBadgeRow({ warnings }: { warnings: QbuWarning[] }) {
  if (!warnings.length) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
      {warnings.map((warning) => (
        <span
          key={warning.key}
          style={{
            ...warning.style,
            padding: '2px 8px',
            fontSize: '10px',
            lineHeight: 1.4,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            border: `1px solid ${tokens.colors.border}`,
            whiteSpace: 'nowrap',
          }}
        >
          {warning.label}
        </span>
      ))}
    </div>
  );
}

type ProductDocumentGroup = {
  key: 'sales' | 'technical' | 'other';
  title: string;
  description: string;
  items: ProductDocumentAsset[];
};

function getDocumentSearchText(asset: ProductDocumentAsset) {
  return [
    asset.title,
    asset.description,
    asset.fileName,
    asset.mimeType,
    asset.url,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function getDocumentGroupKey(asset: ProductDocumentAsset): ProductDocumentGroup['key'] {
  const haystack = getDocumentSearchText(asset);
  if (/(brochure|catalog|catalogue|profile|leaflet|sale kit|sales kit|company profile)/.test(haystack)) {
    return 'sales';
  }
  if (/(datasheet|data sheet|manual|guide|instruction|hdsd|spec|specification|technical|drawing|cad)/.test(haystack)) {
    return 'technical';
  }
  return 'other';
}

function groupProductDocuments(documents: ProductDocumentAsset[]): ProductDocumentGroup[] {
  const groups: Record<ProductDocumentGroup['key'], ProductDocumentGroup> = {
    sales: {
      key: 'sales',
      title: 'Tài liệu bán hàng',
      description: 'Brochure, catalogue và profile để đội sales mở nhanh khi làm việc với khách.',
      items: [],
    },
    technical: {
      key: 'technical',
      title: 'Tài liệu kỹ thuật',
      description: 'Datasheet, manual và file thông số để tra cứu cấu hình hoặc điều kiện vận hành.',
      items: [],
    },
    other: {
      key: 'other',
      title: 'Tài liệu khác',
      description: 'Các file thương mại hoặc phụ trợ chưa rơi vào nhóm bán hàng hay kỹ thuật.',
      items: [],
    },
  };

  documents.forEach((document) => {
    groups[getDocumentGroupKey(document)].items.push(document);
  });

  return (['sales', 'technical', 'other'] as const)
    .map((key) => groups[key])
    .filter((group) => group.items.length > 0);
}

function getPreferredDocument(
  groups: ProductDocumentGroup[],
  preferredKeys: Array<ProductDocumentGroup['key']> = ['sales', 'technical', 'other'],
) {
  for (const key of preferredKeys) {
    const match = groups.find((group) => group.key === key)?.items[0];
    if (match) return match;
  }
  return null;
}

function buildProductProfileStatus({
  product,
  heroImage,
  images,
  videos,
  documents,
  totalQbu,
  qbuWarnings,
}: {
  product: any;
  heroImage: ProductImageAsset | null;
  images: ProductImageAsset[];
  videos: ProductVideoAsset[];
  documents: ProductDocumentAsset[];
  totalQbu: number;
  qbuWarnings: QbuWarning[];
}): ProductProfileStatus {
  const coreChecks = [
    Boolean(String(product?.sku || '').trim()),
    Boolean(String(product?.name || '').trim()),
    Boolean(String(product?.category || '').trim()),
    Boolean(String(product?.unit || '').trim()),
    Number(product?.basePrice || 0) > 0,
  ];
  const coreReadyCount = coreChecks.filter(Boolean).length;
  const hasHeroImage = Boolean(heroImage);
  const supportingMediaCount = images.filter((image) => !image.isPrimary).length + videos.length;
  const hasSupportingMedia = supportingMediaCount > 0;
  const hasDocuments = documents.length > 0;
  const hasTechnicalSpecs = Boolean(String(product?.technicalSpecs || '').trim());
  const hasQbu = totalQbu > 0;
  const hasSevereQbuWarning = qbuWarnings.some((warning) => warning.key === 'snapshot');
  const healthyQbu = hasQbu && !hasSevereQbuWarning;

  const score = Math.round(
    (coreReadyCount / coreChecks.length) * 40 +
      (hasHeroImage ? 15 : 0) +
      (hasSupportingMedia ? 10 : 0) +
      (hasDocuments ? 15 : 0) +
      (hasTechnicalSpecs ? 10 : 0) +
      (healthyQbu ? 10 : hasQbu ? 5 : 0),
  );

  const coreReady = coreReadyCount === coreChecks.length;
  const salesReady = coreReady && hasHeroImage && hasDocuments && hasTechnicalSpecs;
  const quoteReady = salesReady && healthyQbu;

  let statusLabel = 'Chưa đầy đủ';
  let statusStyle: any = ui.badge.warning;
  let summary = 'Hồ sơ đã có nền tảng cơ bản nhưng vẫn còn thiếu vài mảnh quan trọng trước khi dùng rộng cho sales.';

  if (!coreReady) {
    statusLabel = 'Nháp';
    statusStyle = ui.badge.error;
    summary = 'Thiếu dữ liệu nhận diện hoặc giá tham chiếu, nên hồ sơ này vẫn ở trạng thái nháp.';
  } else if (quoteReady) {
    statusLabel = 'Sẵn sàng báo giá';
    statusStyle = ui.badge.success;
    summary = 'Thông tin thương mại, media, tài liệu và QBU đã đủ tốt để đội sales dùng khi chuẩn bị báo giá.';
  } else if (salesReady) {
    statusLabel = 'Sẵn sàng cho sales';
    statusStyle = ui.badge.info;
    summary = 'Hồ sơ đã đủ để sales tra cứu và gửi tài liệu, nhưng phần QBU vẫn nên được rà thêm trước khi chốt giá.';
  }

  const missing = [
    !coreReady ? 'Thiếu thông tin nhận diện cốt lõi' : '',
    !hasHeroImage ? 'Chưa có ảnh đại diện' : '',
    !hasSupportingMedia ? 'Chưa có ảnh/video bổ trợ' : '',
    !hasDocuments ? 'Chưa có tài liệu đính kèm' : '',
    !hasTechnicalSpecs ? 'Chưa có thông số kỹ thuật' : '',
    !hasQbu ? 'Chưa có QBU' : '',
    hasSevereQbuWarning ? 'Snapshot QBU còn thiếu dữ liệu FX' : '',
  ].filter(Boolean);

  const pillars = [
    {
      label: 'Nhận diện',
      detail: `${coreReadyCount}/${coreChecks.length} trường cốt lõi đã có`,
      complete: coreReady,
    },
    {
      label: 'Media',
      detail: hasHeroImage ? `${images.length} ảnh · ${videos.length} video` : 'Thiếu ảnh đại diện',
      complete: hasHeroImage && hasSupportingMedia,
    },
    {
      label: 'Tài liệu & Specs',
      detail: `${documents.length} tài liệu · ${hasTechnicalSpecs ? 'có thông số kỹ thuật' : 'chưa có specs'}`,
      complete: hasDocuments && hasTechnicalSpecs,
    },
    {
      label: 'QBU',
      detail: hasQbu ? `$${totalQbu.toLocaleString()} tổng giá vốn` : 'Chưa có snapshot QBU',
      complete: healthyQbu,
    },
  ];

  return { score, statusLabel, statusStyle, summary, missing, pillars };
}

function buildProductTimelineEntries({
  product,
  heroImage,
  images,
  videos,
  documents,
  totalQbu,
}: {
  product: any;
  heroImage: ProductImageAsset | null;
  images: ProductImageAsset[];
  videos: ProductVideoAsset[];
  documents: ProductDocumentAsset[];
  totalQbu: number;
}): ProductTimelineEntry[] {
  const entries: ProductTimelineEntry[] = [];
  const pushEntry = (entry: ProductTimelineEntry | null) => {
    if (!entry) return;
    const date = new Date(entry.at);
    if (Number.isNaN(date.getTime())) return;
    entries.push(entry);
  };

  const latestImage = [...images]
    .filter((asset) => asset.createdAt)
    .sort((a, b) => new Date(String(b.createdAt)).getTime() - new Date(String(a.createdAt)).getTime())[0];
  const latestVideo = [...videos]
    .filter((asset) => asset.createdAt)
    .sort((a, b) => new Date(String(b.createdAt)).getTime() - new Date(String(a.createdAt)).getTime())[0];
  const latestDocument = [...documents]
    .filter((asset) => asset.createdAt)
    .sort((a, b) => new Date(String(b.createdAt)).getTime() - new Date(String(a.createdAt)).getTime())[0];

  pushEntry(product?.createdAt
    ? {
        key: 'created',
        label: 'Tạo hồ sơ sản phẩm',
        detail: `SKU ${product?.sku || '-'} được đưa vào master data.`,
        at: product.createdAt,
        tone: tokens.colors.info,
      }
    : null);

  pushEntry(heroImage?.createdAt
    ? {
        key: 'hero',
        label: 'Chốt ảnh đại diện',
        detail: heroImage.title || 'Ảnh đại diện được gắn vào hồ sơ sản phẩm.',
        at: heroImage.createdAt,
        tone: tokens.colors.primary,
      }
    : null);

  pushEntry(latestImage?.createdAt
    ? {
        key: 'image',
        label: 'Cập nhật thư viện hình ảnh',
        detail: `${images.length} hình ảnh hiện có trong gallery.`,
        at: latestImage.createdAt,
        tone: tokens.colors.primary,
      }
    : null);

  pushEntry(latestVideo?.createdAt
    ? {
        key: 'video',
        label: 'Bổ sung video demo',
        detail: latestVideo.title || 'Video demo mới đã được gắn vào hồ sơ sản phẩm.',
        at: latestVideo.createdAt,
        tone: tokens.colors.info,
      }
    : null);

  pushEntry(latestDocument?.createdAt
    ? {
        key: 'document',
        label: 'Bổ sung tài liệu',
        detail: latestDocument.title || 'Tài liệu mới đã được thêm vào hồ sơ sản phẩm.',
        at: latestDocument.createdAt,
        tone: tokens.colors.success,
      }
    : null);

  pushEntry(product?.qbuUpdatedAt
    ? {
        key: 'qbu',
        label: 'Cập nhật QBU',
        detail: totalQbu > 0 ? `Tổng giá vốn dự kiến hiện là $${totalQbu.toLocaleString()}.` : 'Snapshot QBU đã được chạm gần đây.',
        at: product.qbuUpdatedAt,
        tone: tokens.colors.warning,
      }
    : null);

  return entries
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .filter((entry, index, all) => all.findIndex((candidate) => candidate.key === entry.key && candidate.at === entry.at) === index)
    .slice(0, 6);
}




function ProductDetailModal({ product, onClose, latestRate, latestRateWarnings, onEdit }: any) {
  const mediaCollections = getProductMediaCollections(product);
  const productImages = normalizeImageAssets(mediaCollections.images);
  const productVideos = normalizeVideoAssets(mediaCollections.videos);
  const productDocuments = normalizeDocumentAssets(mediaCollections.documents);
  const heroImage = getPrimaryImage(productImages);
  const documentGroups = groupProductDocuments(productDocuments);
  const preferredSalesDocument = getPreferredDocument(documentGroups, ['sales', 'technical', 'other']);
  const preferredTechnicalDocument = getPreferredDocument(documentGroups, ['technical', 'sales', 'other']);
  const qbu = product.qbuData || {};
  const totalQbu = (Number(qbu.exWorks)||0) + (Number(qbu.shipping)||0) + (Number(qbu.importTax)||0) + (Number(qbu.customFees)||0) + (Number(qbu.other)||0);
  const qbuWarnings = getProductQbuWarnings(product, latestRate);
  const showRateMissing = latestRateWarnings?.includes('RATE_MISSING');
  const profileStatus = buildProductProfileStatus({
    product,
    heroImage,
    images: productImages,
    videos: productVideos,
    documents: productDocuments,
    totalQbu,
    qbuWarnings,
  });
  const timelineEntries = buildProductTimelineEntries({
    product,
    heroImage,
    images: productImages,
    videos: productVideos,
    documents: productDocuments,
    totalQbu,
  });
  const createdAtLabel = formatDateTimeLabel(product?.createdAt, 'Chưa rõ thời điểm tạo');
  const qbuRateDateLabel = product.qbuRateDate
    ? new Date(product.qbuRateDate).toLocaleDateString('vi-VN')
    : 'Chưa chốt';
  const qbuUpdatedAtLabel = product.qbuUpdatedAt
    ? new Date(product.qbuUpdatedAt).toLocaleString('vi-VN')
    : 'Chưa cập nhật';
  const qbuRows = [
    { label: 'Giá xuất xưởng (Ex-works)', value: Number(qbu.exWorks || 0) },
    { label: 'Phí vận tải (Shipping)', value: Number(qbu.shipping || 0) },
    { label: 'Thuế nhập khẩu', value: Number(qbu.importTax || 0) },
    { label: 'Phí hải quan / bảo lãnh', value: Number(qbu.customFees || 0) },
    { label: 'Chi phí khác', value: Number(qbu.other || 0) },
  ];

  return (
    <OverlayModal
      title="Chi tiết Sản phẩm"
      subtitle="Hồ sơ chi tiết sản phẩm trong danh mục master data."
      onClose={onClose}
      closeOnBackdrop={false}
      maxWidth="1040px"
      variant="drawer"
      placement="center"
      contentPadding="24px"
    >
      <div style={{ display: 'grid', gap: '18px' }}>
        <section
          style={{
            ...ui.card.base,
            background: PRODUCT_DETAIL_HERO_BG,
            boxShadow: 'none',
            padding: '20px 20px 18px',
            display: 'grid',
            gap: '18px',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.45fr) 280px', gap: '18px', alignItems: 'stretch' }}>
            <div style={{ display: 'grid', gap: '10px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                <span style={{ ...ui.badge.info, background: tokens.colors.successTint }}>{product.sku}</span>
                <span style={profileStatus.statusStyle}>{profileStatus.statusLabel}</span>
                <span style={{ ...ui.badge.neutral, background: tokens.colors.surfaceSubtle }}>
                  {product.category || 'Chưa phân loại'}
                </span>
                <span style={{ ...ui.badge.neutral, background: tokens.colors.surfaceSubtle }}>
                  Đơn vị: {product.unit || 'Chiếc'}
                </span>
                <span style={{ ...ui.badge.neutral, background: tokens.colors.surfaceSubtle }}>
                  {productVideos.length} video
                </span>
                <span style={{ ...ui.badge.neutral, background: tokens.colors.surfaceSubtle }}>
                  {productDocuments.length} tài liệu
                </span>
              </div>
              <div
                style={{
                  fontSize: '26px',
                  fontWeight: 900,
                  lineHeight: 1.15,
                  color: tokens.colors.textPrimary,
                }}
              >
                {product.name}
              </div>
              <div style={{ fontSize: '13px', lineHeight: 1.6, color: tokens.colors.textSecondary, maxWidth: '72ch' }}>
                Hồ sơ này tổng hợp dữ liệu bán hàng tham chiếu, mô tả kỹ thuật, hình ảnh, tài liệu và cấu trúc giá vốn dự kiến
                để đội sales và pricing tra cứu nhanh trong quá trình báo giá.
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                {typeof onEdit === 'function' ? (
                  <button type="button" onClick={() => onEdit(product)} style={{ ...S.btnPrimary, padding: '10px 16px' }}>
                    Chỉnh sửa sản phẩm
                  </button>
                ) : null}
                {preferredSalesDocument ? (
                  <a
                    href={resolveAssetUrl(API_ORIGIN, preferredSalesDocument.url)}
                    target="_blank"
                    rel="noreferrer"
                    style={{ ...S.btnOutline, textDecoration: 'none', padding: '10px 16px' }}
                  >
                    {getDocumentGroupKey(preferredSalesDocument) === 'sales' ? 'Mở brochure / catalogue' : 'Mở tài liệu đầu tiên'}
                  </a>
                ) : null}
                {preferredTechnicalDocument && preferredTechnicalDocument.url !== preferredSalesDocument?.url ? (
                  <a
                    href={resolveAssetUrl(API_ORIGIN, preferredTechnicalDocument.url)}
                    target="_blank"
                    rel="noreferrer"
                    style={{ ...S.btnOutline, textDecoration: 'none', padding: '10px 16px' }}
                  >
                    Mở datasheet / manual
                  </a>
                ) : null}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '11px', color: tokens.colors.textMuted }}>
                <span>Tạo hồ sơ: {createdAtLabel}</span>
                <span>•</span>
                <span>{profileStatus.score}% hoàn thiện</span>
              </div>
            </div>

            <div
              style={{
                borderRadius: '20px',
                overflow: 'hidden',
                border: `1px solid ${tokens.colors.border}`,
                background: heroImage
                  ? PRODUCT_DETAIL_SURFACE_BG
                  : PRODUCT_DETAIL_PANEL_BG,
                minHeight: '220px',
                position: 'relative',
                display: 'grid',
              }}
            >
              {heroImage ? (
                <img
                  src={resolveAssetUrl(API_ORIGIN, heroImage.url)}
                  alt={heroImage.alt || heroImage.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <div style={{ display: 'grid', alignContent: 'space-between', padding: '18px' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: tokens.colors.textMuted }}>
                    Asset preview
                  </div>
                  <div style={{ display: 'grid', gap: '10px' }}>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: tokens.colors.textPrimary }}>
                      Chưa có ảnh đại diện
                    </div>
                    <div style={{ fontSize: '12px', lineHeight: 1.65, color: tokens.colors.textSecondary }}>
                      Thêm ảnh đầu tiên để tạo hero preview cho hồ sơ sản phẩm và giúp đội sales scan nhanh hơn.
                    </div>
                  </div>
                </div>
              )}
              <div
                style={{
                  position: 'absolute',
                  left: '14px',
                  right: '14px',
                  bottom: '14px',
                  padding: '10px 12px',
                  borderRadius: '14px',
                  // Intentional dark overlay on top of real product photography for text readability.
                  background: heroImage ? 'rgba(2, 6, 23, 0.66)' : tokens.colors.surface,
                  border: `1px solid ${tokens.colors.border}`,
                  display: 'grid',
                  gap: '2px',
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 800, color: tokens.colors.textPrimary }}>
                  {heroImage ? heroImage.title : 'Asset library'}
                </div>
                <div style={{ fontSize: '11px', color: tokens.colors.textMuted }}>
                  {productImages.length} hình ảnh khả dụng · {productVideos.length} video demo · {productDocuments.length} tài liệu liên quan
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px',
            }}
          >
            <div
              style={{
                ...ui.card.base,
                background: PRODUCT_DETAIL_SURFACE_BG,
                boxShadow: 'none',
                padding: '14px 16px',
                minHeight: '108px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <DetailField label="Giá bán tham chiếu" value={`$${Number(product.basePrice || 0).toLocaleString()}`} accent />
            </div>
            <div
              style={{
                ...ui.card.base,
                background: PRODUCT_DETAIL_SURFACE_BG,
                boxShadow: 'none',
                padding: '14px 16px',
                minHeight: '108px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <DetailField label="Danh mục" value={product.category || 'N/A'} />
            </div>
            <div
              style={{
                ...ui.card.base,
                background: PRODUCT_DETAIL_SURFACE_BG,
                boxShadow: 'none',
                padding: '14px 16px',
                minHeight: '108px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <DetailField label="Đơn vị" value={product.unit || 'Chiếc'} />
            </div>
            <div
              style={{
                ...ui.card.base,
                background: PRODUCT_DETAIL_SURFACE_BG,
                boxShadow: 'none',
                padding: '14px 16px',
                minHeight: '108px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <DetailField label="Tổng QBU" value={`$${totalQbu.toLocaleString()}`} />
            </div>
          </div>
        </section>

        <DetailSection
          title="Độ hoàn thiện hồ sơ"
          subtitle="Chấm điểm nhanh chất lượng hồ sơ sản phẩm dựa trên dữ liệu nhận diện, media, tài liệu và QBU hiện có."
        >
          <ProductProfileStatusPanel status={profileStatus} />
        </DetailSection>

        <DetailSection title="Thông tin chung" subtitle="Thông tin nhận diện và thương mại dùng cho danh mục master data.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '18px 20px' }}>
            <DetailField label="SKU" value={product.sku || '-'} />
            <DetailField label="Tên sản phẩm" value={product.name || '-'} />
            <DetailField label="Danh mục" value={product.category || '-'} />
            <DetailField label="Đơn vị" value={product.unit || '-'} />
            <DetailField label="Trạng thái hồ sơ" value={profileStatus.statusLabel} />
            <DetailField label="Thời điểm tạo hồ sơ" value={createdAtLabel} />
            <div style={{ gridColumn: '1 / -1' }}>
              <DetailField label="Giá bán tham chiếu" value={`$${Number(product.basePrice || 0).toLocaleString()}`} />
            </div>
          </div>
        </DetailSection>

        <DetailSection title="Thông số kỹ thuật" subtitle="Mô tả chuẩn dùng để tái sử dụng trong báo giá và tài liệu bán hàng.">
          <div
            style={{
              padding: '18px',
              borderRadius: '16px',
              border: `1px solid ${tokens.colors.border}`,
              background: PRODUCT_DETAIL_SURFACE_BG,
              fontSize: '14px',
              lineHeight: 1.75,
              color: tokens.colors.textSecondary,
              whiteSpace: 'pre-wrap',
            }}
          >
            {product.technicalSpecs || 'Chưa có thông số kỹ thuật.'}
          </div>
        </DetailSection>

        <DetailSection title="Hình ảnh sản phẩm" subtitle="Thư viện hình ảnh phục vụ tra cứu nhanh trong quá trình tư vấn và báo giá.">
          <ProductAssetGallery images={productImages} apiOrigin={API_ORIGIN} />
        </DetailSection>

        <DetailSection title="Video sản phẩm" subtitle="Video demo đã được chuẩn hóa MP4 để có thể mở trực tiếp hoặc gửi cho đối tác.">
          <ProductVideoGallery videos={productVideos} apiOrigin={API_ORIGIN} />
        </DetailSection>

        <DetailSection title="Tài liệu liên quan" subtitle="Catalogue, brochure, tài liệu kỹ thuật và hướng dẫn sử dụng được gom nhóm để đội sales mở nhanh đúng loại file cần dùng.">
          <ProductDocumentWorkspace documents={productDocuments} apiOrigin={API_ORIGIN} outlineButtonStyle={S.btnOutline} primaryButtonStyle={S.btnPrimary} />
        </DetailSection>

        <DetailSection title="QBU / Giá vốn" subtitle="Quote build up dùng để theo dõi cost structure dự kiến và độ tin cậy của dữ liệu giá vốn.">
          {(qbuWarnings.length > 0 || showRateMissing) && (
            <div
              style={{
                padding: '16px 18px',
                borderRadius: '16px',
                border: `1px solid ${tokens.colors.border}`,
                background: tokens.colors.warningTint,
                display: 'grid',
                gap: '10px',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: tokens.colors.warning }}>
                Cảnh báo dữ liệu
              </div>
              {qbuWarnings.length > 0 ? <QbuBadgeRow warnings={qbuWarnings} /> : null}
              {showRateMissing ? (
                <div style={{ fontSize: '13px', fontWeight: 700, color: tokens.colors.warning }}>
                  Chưa có tỷ giá VCB để đối chiếu snapshot QBU.
                </div>
              ) : null}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px' }}>
            <div
              style={{
                ...ui.card.base,
                background: PRODUCT_DETAIL_SURFACE_BG,
                boxShadow: 'none',
                padding: '14px 16px',
              }}
            >
              <DetailField label="Tổng QBU dự kiến" value={`$${totalQbu.toLocaleString()}`} accent />
            </div>
            <div
              style={{
                ...ui.card.base,
                background: PRODUCT_DETAIL_SURFACE_BG,
                boxShadow: 'none',
                padding: '14px 16px',
              }}
            >
              <DetailField label="Ngày tỷ giá" value={qbuRateDateLabel} />
            </div>
            <div
              style={{
                ...ui.card.base,
                background: PRODUCT_DETAIL_SURFACE_BG,
                boxShadow: 'none',
                padding: '14px 16px',
              }}
            >
              <DetailField label="Cập nhật lần cuối" value={qbuUpdatedAtLabel} />
            </div>
          </div>

          <div
            style={{
              borderRadius: '18px',
              border: `1px solid ${tokens.colors.border}`,
              overflow: 'hidden',
              background: PRODUCT_DETAIL_SURFACE_BG,
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) auto',
                padding: '14px 18px',
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: tokens.colors.textMuted,
                borderBottom: `1px solid ${tokens.colors.border}`,
              }}
            >
              <span>Hạng mục chi phí</span>
              <span>Giá trị</span>
            </div>
            {qbuRows.map((row) => (
              <div
                key={row.label}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) auto',
                  gap: '16px',
                  alignItems: 'center',
                  padding: '16px 18px',
                  borderBottom: `1px solid ${tokens.colors.border}`,
                }}
              >
                <span style={{ fontSize: '14px', color: tokens.colors.textSecondary }}>{row.label}</span>
                <span style={{ fontSize: '14px', fontWeight: 800, color: tokens.colors.textPrimary }}>
                  ${row.value.toLocaleString()}
                </span>
              </div>
            ))}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) auto',
                gap: '16px',
                alignItems: 'center',
                padding: '18px',
                background: tokens.colors.successTint,
              }}
            >
              <span style={{ fontSize: '14px', fontWeight: 800, color: tokens.colors.textPrimary }}>Tổng giá vốn dự kiến</span>
              <span style={{ fontSize: '20px', fontWeight: 900, color: tokens.colors.primary }}>
                ${totalQbu.toLocaleString()}
              </span>
            </div>
          </div>
        </DetailSection>

        <DetailSection
          title="Timeline cập nhật"
          subtitle="Các mốc dưới đây được suy luận từ thời gian tạo hồ sơ, asset timestamps và snapshot QBU hiện có."
        >
          <ProductTimeline entries={timelineEntries} />
        </DetailSection>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
            paddingTop: '2px',
          }}
        >
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {typeof onEdit === 'function' ? (
              <button type="button" onClick={() => onEdit(product)} style={{ ...S.btnOutline, padding: '10px 18px' }}>
                Chỉnh sửa
              </button>
            ) : null}
            {preferredSalesDocument ? (
              <a
                href={resolveAssetUrl(API_ORIGIN, preferredSalesDocument.url)}
                target="_blank"
                rel="noreferrer"
                style={{ ...S.btnOutline, textDecoration: 'none', padding: '10px 18px' }}
              >
                Mở tài liệu
              </a>
            ) : null}
          </div>
          <button onClick={onClose} style={{ ...S.btnPrimary, padding: '10px 22px', minWidth: '110px' }}>Đóng</button>
        </div>
      </div>
    </OverlayModal>
  );
}


function ProductFormModal({
  mode,
  product,
  onClose,
  onSaved,
  token,
}: {
  mode: 'create' | 'edit';
  product?: any;
  onClose: () => void;
  onSaved: () => void;
  token: string;
}) {
  const [form, setForm] = useState<ProductFormState>(mode === 'edit' && product ? createProductFormFromProduct(product) : createEmptyProductForm());
  const [tab, setTab] = useState<'info'|'assets'|'qbu'>('info');
  const [saving, setSaving] = useState(false);
  const [activeProduct, setActiveProduct] = useState<any>(mode === 'edit' ? product || null : null);
  const persistedProductId = activeProduct?.id || (mode === 'edit' ? product?.id : '');
  const hasPersistedProduct = Boolean(persistedProductId);
  const canConfigureQbu = mode === 'edit' || hasPersistedProduct;
  const modalTitle = mode === 'edit' || hasPersistedProduct ? 'Chỉnh sửa Sản phẩm' : 'Thêm Sản phẩm mới';

  useEffect(() => {
    setForm(mode === 'edit' && product ? createProductFormFromProduct(product) : createEmptyProductForm());
    setActiveProduct(mode === 'edit' ? product || null : null);
    setTab('info');
  }, [mode, product?.id]);

  const submit = async () => {
    if (!form.sku || !form.name) return showNotify('Thiếu SKU hoặc Tên', 'error');
    setSaving(true);
    try {
      const payload = {
        ...form,
        productImages: normalizeImageAssets(form.productImages),
        productVideos: normalizeVideoAssets(form.productVideos),
        productDocuments: normalizeDocumentAssets(form.productDocuments),
      };
      const shouldUpdate = Boolean(persistedProductId);
      const res = await fetchWithAuth(token, shouldUpdate ? `${API}/products/${persistedProductId}` : `${API}/products`, {
        method: shouldUpdate ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || 'Không thể lưu sản phẩm');
      setActiveProduct(result);
      setForm(createProductFormFromProduct(result));
      onSaved();
      if (!shouldUpdate) {
        setTab('assets');
        showNotify('Đã tạo sản phẩm. Có thể tiếp tục upload asset ngay trong cửa sổ này.', 'success');
        return;
      }
      showNotify(mode === 'edit' ? 'Đã cập nhật sản phẩm' : 'Đã lưu thay đổi sản phẩm', 'success');
      onClose();
    } catch (error: any) {
      showNotify(error?.message || 'Không thể lưu sản phẩm', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleQbuChange = (field: string, val: string) => {
    setForm((current) => ({ ...current, qbuData: { ...(current.qbuData || {}), [field]: Number(val) || 0 } }));
  };

  const qbu = form.qbuData || {};
  const totalQbu = (Number(qbu.exWorks)||0) + (Number(qbu.shipping)||0) + (Number(qbu.importTax)||0) + (Number(qbu.customFees)||0) + (Number(qbu.other)||0);
  const [isCompactForm, setIsCompactForm] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 720 : false));
  const modalContentPadding = isCompactForm ? '20px' : '24px';
  const pricePreview = formatProductPricePreview(form.basePrice);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setIsCompactForm(window.innerWidth <= 720);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <OverlayModal
      title={modalTitle}
      subtitle={mode === 'edit' ? 'Cập nhật hồ sơ sản phẩm theo cấu trúc gọn, rõ và sẵn sàng cho vận hành.' : 'Tạo hồ sơ sản phẩm mới với cấu trúc thông tin chuẩn cho sales và pricing.'}
      onClose={onClose}
      maxWidth="1040px"
      contentPadding={modalContentPadding}
    >
      <div style={{ display: 'grid', gap: '20px' }}>
        <div
          style={{
            display: 'flex',
            gap: '8px',
            borderBottom: `1px solid ${tokens.colors.border}`,
            paddingBottom: '12px',
            overflowX: isCompactForm ? 'auto' : 'visible',
            flexWrap: isCompactForm ? 'nowrap' : 'wrap',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
          }}
        >
          <button onClick={() => setTab('info')} style={{ ...S.tabBtn(tab === 'info'), whiteSpace: 'nowrap', padding: isCompactForm ? '10px 14px' : S.tabBtn(tab === 'info').padding }}>Thông tin chung</button>
          <button onClick={() => setTab('assets')} style={{ ...S.tabBtn(tab === 'assets'), whiteSpace: 'nowrap', padding: isCompactForm ? '10px 14px' : S.tabBtn(tab === 'assets').padding }}>Ảnh, Video & Tài liệu</button>
          {canConfigureQbu ? <button onClick={() => setTab('qbu')} style={{ ...S.tabBtn(tab === 'qbu'), whiteSpace: 'nowrap', padding: isCompactForm ? '10px 14px' : S.tabBtn(tab === 'qbu').padding }}>Cấu hình QBU</button> : null}
        </div>

        {tab === 'info' ? (
          <div style={{ display: 'grid', gap: '16px' }}>
            <section style={{ ...ui.card.base, boxShadow: 'none', padding: isCompactForm ? '16px' : '18px', display: 'grid', gap: '16px' }}>
              <div style={{ display: 'grid', gap: '4px' }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>Thông tin nhận diện</div>
                <div style={{ ...ui.form.help, lineHeight: 1.6 }}>Nhập các trường cốt lõi để đội sales, pricing và master data tra cứu nhất quán.</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px 20px' }}>
                <div style={{ gridColumn: '1/-1', minWidth: 0, display: 'grid', gap: '6px' }}>
                  <label htmlFor={PRODUCT_FORM_FIELD_IDS.sku} style={S.label}>Mã SKU *</label>
                  <input id={PRODUCT_FORM_FIELD_IDS.sku} type="text" placeholder="Mã SKU (HT-xxx) *" style={S.input} value={form.sku} onInput={(e:any)=>setForm({...form, sku: e.target.value})} />
                  <div style={ui.form.help}>Dùng mã duy nhất, ổn định theo quy ước nội bộ để tránh trùng khi import hoặc báo giá.</div>
                </div>
                <div style={{ gridColumn: '1/-1', minWidth: 0, display: 'grid', gap: '6px' }}>
                  <label htmlFor={PRODUCT_FORM_FIELD_IDS.name} style={S.label}>Tên Sản phẩm *</label>
                  <input id={PRODUCT_FORM_FIELD_IDS.name} type="text" placeholder="Tên Sản phẩm *" style={S.input} value={form.name} onInput={(e:any)=>setForm({...form, name: e.target.value})} />
                </div>
                <div style={{ minWidth: 0, display: 'grid', gap: '6px' }}>
                  <label htmlFor={PRODUCT_FORM_FIELD_IDS.category} style={S.label}>Danh mục</label>
                  <input id={PRODUCT_FORM_FIELD_IDS.category} type="text" placeholder="Danh mục" style={S.input} value={form.category} onInput={(e:any)=>setForm({...form, category: e.target.value})} />
                </div>
                <div style={{ minWidth: 0, display: 'grid', gap: '6px' }}>
                  <label htmlFor={PRODUCT_FORM_FIELD_IDS.unit} style={S.label}>Đơn vị</label>
                  <select id={PRODUCT_FORM_FIELD_IDS.unit} style={S.input} value={form.unit} onChange={(e:any)=>setForm({...form, unit: e.target.value})}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
            </section>
            <section style={{ ...ui.card.base, boxShadow: 'none', padding: isCompactForm ? '16px' : '18px', display: 'grid', gap: '16px' }}>
              <div style={{ display: 'grid', gap: '4px' }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>Thông tin thương mại</div>
                <div style={{ ...ui.form.help, lineHeight: 1.6 }}>Giá tham chiếu dùng cho trao đổi ban đầu. Giá chính thức vẫn được xác nhận trong báo giá hoặc QBU.</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px 20px' }}>
                <div style={{ gridColumn: '1/-1', minWidth: 0, display: 'grid', gap: '6px' }}>
                  <label htmlFor={PRODUCT_FORM_FIELD_IDS.basePrice} style={S.label}>Giá bán tham chiếu (USD)</label>
                  <input id={PRODUCT_FORM_FIELD_IDS.basePrice} type="number" placeholder="Giá bán tham chiếu (USD)" style={S.input} value={form.basePrice} onInput={(e:any)=>setForm({...form, basePrice: e.target.value})} />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                    <span style={ui.form.help}>Nhập giá không gồm phân cách, hệ thống sẽ chuẩn hoá khi hiển thị.</span>
                    {pricePreview ? <span style={{ ...ui.badge.info, background: 'rgba(16, 185, 129, 0.12)' }}>Preview: {pricePreview}</span> : null}
                  </div>
                </div>
              </div>
            </section>
            <section style={{ ...ui.card.base, boxShadow: 'none', padding: isCompactForm ? '16px' : '18px', display: 'grid', gap: '16px' }}>
              <div style={{ display: 'grid', gap: '4px' }}>
                <label htmlFor={PRODUCT_FORM_FIELD_IDS.technicalSpecs} style={{ ...S.label, marginBottom: 0 }}>
                  Thông số kỹ thuật
                </label>
                <div style={{ ...ui.form.help, lineHeight: 1.6 }}>
                  Nội dung này được dùng lại trong báo giá. Nên giữ cấu trúc theo từng dòng để sales có thể copy và đối chiếu nhanh.
                </div>
              </div>
              <textarea
                id={PRODUCT_FORM_FIELD_IDS.technicalSpecs}
                rows={isCompactForm ? 8 : 7}
                placeholder={"- Nhãn hiệu: SOCMA\n- Model: HNRS4531\n- Xuất xứ: Trung Quốc\n- Tình trạng: Mới 100%\n- Năm SX: 2025 trở về sau\n- Tải trọng: 45T, 31T, 16T\n- Chiều cao nâng: 15100mm"}
                      style={{ ...S.input, fontFamily: 'var(--font-family-sans)', fontSize: '12.5px', resize: 'vertical', lineHeight: 1.7 }}
                value={form.technicalSpecs}
                onInput={(e:any)=>setForm({...form, technicalSpecs: e.target.value})}
              />
              <div style={{ ...ui.form.help, display: 'grid', gap: '4px' }}>
                <span>Nên ưu tiên các dòng: nhãn hiệu, model, xuất xứ, tình trạng, năm sản xuất, tải trọng và kích thước chính.</span>
              </div>
            </section>
          </div>
        ) : null}

        {tab === 'assets' ? (
          <div style={{ display: 'grid', gap: '18px' }}>
            <section
              style={{
                ...ui.card.base,
                background: tokens.surface.heroGradient,
                boxShadow: 'none',
                padding: '18px 18px 16px',
                display: 'grid',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                <span style={{ ...ui.badge.info, background: tokens.colors.successTint }}>{form.productImages.length} ảnh</span>
                <span style={{ ...ui.badge.info, background: tokens.colors.infoAccentBg }}>{form.productVideos.length} video</span>
                <span style={{ ...ui.badge.neutral, background: tokens.colors.surfaceSubtle }}>{form.productDocuments.length} tài liệu</span>
                <span style={{ ...ui.badge.neutral, background: tokens.colors.surfaceSubtle }}>
                  {hasPersistedProduct ? 'Upload trực tiếp khả dụng' : 'Tạo sản phẩm để bật upload trực tiếp'}
                </span>
              </div>
              <div style={{ fontSize: '13px', lineHeight: 1.6, color: tokens.colors.textSecondary, maxWidth: '72ch' }}>
                Dùng khu này để quản lý toàn bộ asset phục vụ bán hàng. Ảnh đại diện luôn được ghim ở vị trí đầu, gallery giữ thứ tự bạn sắp xếp, video được chuẩn hoá MP4 để share, còn tài liệu sẽ hiển thị theo danh sách hành động.
              </div>
              {!hasPersistedProduct ? (
                <div style={{ fontSize: '12px', lineHeight: 1.6, color: tokens.colors.textMuted }}>
                  Bước 1: lưu SKU và tên sản phẩm để tạo record. Sau đó modal sẽ giữ nguyên và mở tab asset để bạn tiếp tục upload trong cùng phiên.
                </div>
              ) : null}
            </section>
            <DetailSection title="Hình ảnh sản phẩm" subtitle="Thêm ảnh bằng URL hoặc upload trực tiếp để hiển thị trong hồ sơ chi tiết.">
              <AssetListEditor
                title="Kho ảnh"
                apiBase={API}
                apiOrigin={API_ORIGIN}
                showNotify={showNotify}
                outlineButtonStyle={S.btnOutline}
                primaryButtonStyle={S.btnPrimary}
                inputStyle={S.input}
                labelStyle={S.label}
                subtitle="Ảnh đầu tiên sẽ được dùng làm hero image ở phần chi tiết sản phẩm."
                items={form.productImages}
                kind="image"
                onItemsChange={(items) => setForm((current) => ({ ...current, productImages: normalizeImageAssets(items) }))}
                productId={persistedProductId}
                token={token}
              />
            </DetailSection>

            <DetailSection title="Video sản phẩm" subtitle="Upload video demo hoặc gắn URL để hồ sơ sản phẩm luôn có clip share-ready cho đối tác.">
              <AssetListEditor
                title="Kho video"
                apiBase={API}
                apiOrigin={API_ORIGIN}
                showNotify={showNotify}
                outlineButtonStyle={S.btnOutline}
                primaryButtonStyle={S.btnPrimary}
                inputStyle={S.input}
                labelStyle={S.label}
                subtitle="Video upload trực tiếp sẽ được trình duyệt chuẩn hoá về MP4 H.264/AAC trước khi gửi lên, ưu tiên clip share-ready tối đa 1080p."
                items={form.productVideos}
                kind="video"
                onItemsChange={(items) => setForm((current) => ({ ...current, productVideos: normalizeVideoAssets(items) }))}
                productId={persistedProductId}
                token={token}
              />
            </DetailSection>

            <DetailSection title="Tài liệu liên quan" subtitle="Quản lý brochure, catalogue, datasheet và file kỹ thuật liên quan đến sản phẩm.">
              <AssetListEditor
                title="Kho tài liệu"
                apiBase={API}
                apiOrigin={API_ORIGIN}
                showNotify={showNotify}
                outlineButtonStyle={S.btnOutline}
                primaryButtonStyle={S.btnPrimary}
                inputStyle={S.input}
                labelStyle={S.label}
                subtitle="Tài liệu sẽ xuất hiện theo dạng danh sách trong màn hình chi tiết sản phẩm."
                items={form.productDocuments}
                kind="document"
                onItemsChange={(items) => setForm((current) => ({ ...current, productDocuments: normalizeDocumentAssets(items) }))}
                productId={persistedProductId}
                token={token}
              />
            </DetailSection>
          </div>
        ) : null}

        {tab === 'qbu' && canConfigureQbu ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
            <div style={{ gridColumn: '1/-1', padding: tokens.spacing.md, background: tokens.colors.badgeBgInfo, borderRadius: tokens.radius.md, color: tokens.colors.info, fontSize: '13px', fontWeight: 600, border: `1px solid ${tokens.colors.border}`, marginBottom: tokens.spacing.sm }}>
              QBU (Quote Build Up) là cơ sở dữ liệu để tính toán lợi nhuận khi tạo báo giá. Nhập các chi phí đầu vào dự kiến cho sản phẩm này (USD).
            </div>

            <div style={{ gridColumn: '1/-1' }}>
              <label style={S.label}>Giá xuất xưởng (Ex-works) USD</label>
              <input type="number" style={S.input} value={qbu.exWorks || ''} onInput={(e:any)=>handleQbuChange('exWorks', e.target.value)} />
            </div>
            <div>
              <label style={S.label}>Phí vận tải (Shipping) USD</label>
              <input type="number" style={S.input} value={qbu.shipping || ''} onInput={(e:any)=>handleQbuChange('shipping', e.target.value)} />
            </div>
            <div>
              <label style={S.label}>Thuế nhập khẩu USD</label>
              <input type="number" style={S.input} value={qbu.importTax || ''} onInput={(e:any)=>handleQbuChange('importTax', e.target.value)} />
            </div>
            <div>
              <label style={S.label}>Phí HQ / Bảo lãnh USD</label>
              <input type="number" style={S.input} value={qbu.customFees || ''} onInput={(e:any)=>handleQbuChange('customFees', e.target.value)} />
            </div>
            <div>
              <label style={S.label}>Chi phí khác USD</label>
              <input type="number" style={S.input} value={qbu.other || ''} onInput={(e:any)=>handleQbuChange('other', e.target.value)} />
            </div>

            <div style={{ gridColumn: '1/-1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', borderTop: `1px dashed ${tokens.colors.border}`, background: tokens.colors.background, padding: '16px', borderRadius: '12px' }}>
              <span style={{ fontSize: '15px', fontWeight: 800 }}>TỔNG CHÍ PHÍ (COGS):</span>
              <span style={{ fontSize: '20px', fontWeight: 900, color: tokens.colors.primary }}>${totalQbu.toLocaleString()}</span>
            </div>
          </div>
        ) : null}

        <div
          style={{
            display: 'flex',
            gap: '10px',
            marginTop: '4px',
            justifyContent: 'flex-end',
            alignItems: 'center',
            borderTop: `1px solid ${tokens.colors.border}`,
            padding: isCompactForm ? '14px 20px 0' : '16px 24px 0',
            marginLeft: isCompactForm ? '-20px' : '-24px',
            marginRight: isCompactForm ? '-20px' : '-24px',
            marginBottom: isCompactForm ? '-20px' : '-24px',
            position: 'sticky',
            bottom: isCompactForm ? '-20px' : '-24px',
            background: `${tokens.colors.surface}`,
            backdropFilter: `blur(${tokens.overlay.toastBlur})`,
            WebkitBackdropFilter: `blur(${tokens.overlay.toastBlur})`,
            flexWrap: isCompactForm ? 'wrap-reverse' : 'nowrap',
          }}
        >
          <div style={{ marginRight: 'auto', fontSize: '12px', color: tokens.colors.textMuted, lineHeight: 1.5 }}>
            {tab === 'info' ? 'Kiểm tra lại SKU, tên và giá trước khi lưu.' : tab === 'assets' ? 'Asset đã upload trực tiếp sẽ được giữ trong cùng phiên chỉnh sửa.' : 'QBU dùng để tính chi phí đầu vào tham chiếu cho báo giá.'}
          </div>
          <button onClick={onClose} style={S.btnOutline}>{getProductFormDismissLabel(mode)}</button>
          <button onClick={submit} style={S.btnPrimary}>
            {getProductFormSubmitLabel({ saving, hasPersistedProduct })}
          </button>
        </div>
      </div>
    </OverlayModal>
  );
}

function AddProductModal({ onClose, onSaved, token }: any) {
  return <ProductFormModal mode="create" onClose={onClose} onSaved={onSaved} token={token} />;
}

function EditProductModal({ product, onClose, onSaved, token }: any) {
  return <ProductFormModal mode="edit" product={product} onClose={onClose} onSaved={onSaved} token={token} />;
}


function useSortableData(items: any[]) {
  const [sortConfig, setSortConfig] = useState<any>(null);
  const [filters, setFilters] = useState<any>({});
  const filteredItems = useMemo(() => {
    let result = [...items];
    Object.keys(filters).forEach(k => { if (filters[k]) result = result.filter(i => String(i[k]||'').toLowerCase().includes(filters[k].toLowerCase())); });
    if (sortConfig) result.sort((a,b) => {
      const vA = (a[sortConfig.key]||'').toString().toLowerCase();
      const vB = (b[sortConfig.key]||'').toString().toLowerCase();
      if (vA < vB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (vA > vB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }, [items, sortConfig, filters]);
  return { items: filteredItems, requestSort: (key: string) => {
    let dir = 'asc'; if (sortConfig?.key === key && sortConfig.direction === 'asc') dir = 'desc';
    setSortConfig({ key, direction: dir });
  }, sortConfig, filters, setFilters };
}

export function Products({ isMobile, currentUser }: { isMobile?: boolean; currentUser?: any } = {}) {
  const sessionUser = currentUser ?? loadSession();
  const token = sessionUser?.token ?? '';
  const { t } = useI18n();
  const userCanEdit = sessionUser ? canEdit(sessionUser.roleCodes, sessionUser.systemRole) : false;
  const userCanDelete = sessionUser ? canDelete(sessionUser.roleCodes, sessionUser.systemRole) : false;
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [confirmState, setConfirmState] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [importReport, setImportReport] = useState<ProductImportReport | null>(null);
  const [importPreview, setImportPreview] = useState<ProductImportPreviewReport | null>(null);
  const [selectedDuplicateSkus, setSelectedDuplicateSkus] = useState<string[]>([]);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [latestRate, setLatestRate] = useState<number | null>(null);
  const [latestRateWarnings, setLatestRateWarnings] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categoryOptions = useMemo(() => {
    return Array.from(new Set(products.map((product) => String(product.category || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [products]);

  const primaryFilteredProducts = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    return products.filter((product: any) => {
      if (categoryFilter && String(product.category || '') !== categoryFilter) return false;
      if (!needle) return true;
      return (
        matchesQuery(product.sku, needle) ||
        matchesQuery(product.name, needle) ||
        matchesQuery(product.category, needle) ||
        matchesQuery(product.unit, needle) ||
        matchesQuery(product.basePrice, needle)
      );
    });
  }, [products, searchTerm, categoryFilter]);

  const data = useSortableData(primaryFilteredProducts);
  const hasFilters = !!(searchTerm.trim() || categoryFilter || Object.values(data.filters || {}).some(Boolean));

  const loadData = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetchWithAuth(token, `${API}/products`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      if (!Array.isArray(payload)) {
        setProducts([]);
        setLoadError('Không tải được catalog sản phẩm. Bạn vẫn có thể mở màn hình này, nhưng dữ liệu đang tạm thời rỗng.');
        return;
      }
      setProducts(payload);
    } catch {
      setProducts([]);
      setLoadError('Không tải được catalog sản phẩm. Vui lòng thử lại sau hoặc kiểm tra dữ liệu backend.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { loadData(); }, []);
  useEffect(() => {
    let active = true;
    const loadLatestRate = async () => {
      try {
        const res = await fetch(`${API}/exchange-rates/latest?pair=${FX_PAIR}`);
        const payload = await res.json();
        if (!active) return;
        setLatestRate(payload?.rate ?? null);
        setLatestRateWarnings(Array.isArray(payload?.warnings) ? payload.warnings : []);
      } catch {
        if (!active) return;
        setLatestRate(null);
        setLatestRateWarnings([]);
      }
    };

    loadLatestRate();
    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(() => {
    const total = products.length;
    const categories = new Set(products.map(p => p.category)).size;
    const avgPrice = total > 0 ? products.reduce((acc, p) => acc + (p.basePrice || 0), 0) / total : 0;
    return { total, categories, avgPrice };
  }, [products]);

  const resetImportWizard = () => {
    setPendingImportFile(null);
    setImportPreview(null);
    setSelectedDuplicateSkus([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImportFileSelection = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingImportFile(file);
    setImportPreview(null);
    setSelectedDuplicateSkus([]);
  };

  const handlePreviewImport = async () => {
    if (!pendingImportFile) {
      showNotify('Bạn chưa chọn file import', 'info');
      return;
    }
    const formData = new FormData();
    formData.append('file', pendingImportFile);
    setImporting(true);
    try {
      const res = await fetchWithAuth(token, `${API}/products/import/preview`, { method: 'POST', body: formData });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || 'Không thể phân tích file import');
      const report = normalizeProductImportPreview(result);
      setImportPreview(report);
      setSelectedDuplicateSkus(
        report.rows
          .filter((row) => row.action === 'duplicate' && row.sku)
          .map((row) => row.sku as string)
      );
      showNotify(buildProductImportPreviewSummary(report), report.errorRows > 0 ? 'info' : 'success');
    } catch (error: any) {
      showNotify(error?.message || 'Không thể phân tích file import', 'error');
    } finally {
      setImporting(false);
    }
  };

  const handleImport = async (duplicateStrategy: 'skip' | 'replace') => {
    if (!pendingImportFile) {
      showNotify('Bạn chưa chọn file import', 'info');
      return;
    }
    const formData = new FormData();
    formData.append('file', pendingImportFile);
    formData.append('duplicateStrategy', duplicateStrategy);
    if (duplicateStrategy === 'replace' && selectedDuplicateSkus.length > 0) {
      formData.append('replaceSkus', selectedDuplicateSkus.join('|'));
    }
    setImporting(true);
    try {
      const res = await fetchWithAuth(token, `${API}/products/import`, { method: 'POST', body: formData });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || 'Không thể import sản phẩm');
      const report = normalizeProductImportReport(result);
      setImportReport(report);
      setShowImportWizard(false);
      showNotify(buildProductImportSummary(report), report.errors > 0 ? 'info' : 'success');
      loadData();
    } catch (error: any) {
      showNotify(error?.message || 'Không thể import sản phẩm', 'error');
    } finally {
      setImporting(false);
      resetImportWizard();
    }
  };

  const openProductFile = (kind: 'template' | 'export', format: 'csv' | 'xlsx') => {
    const path = kind === 'template' ? `${API}/template/products` : `${API}/products/export`;
    window.open(buildTabularFileUrl(path, format), '_blank');
  };

  const deleteProduct = (id: string) => {
    setConfirmState({
      message: 'Xóa sản phẩm này?',
      onConfirm: async () => {
        setConfirmState(null);
        await fetchWithAuth(token, `${API}/products/${id}`, { method: 'DELETE' });
        setProducts(prev => prev.filter((p: any) => p.id !== id));
      },
    });
  };

  const cols = [ { k: 'sku', l: 'SKU' }, { k: 'name', l: 'Sản phẩm' }, { k: 'category', l: 'Danh mục' }, { k: 'basePrice', l: 'Giá bán ($)' } ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {confirmState && <ConfirmDialog message={confirmState.message} onConfirm={confirmState.onConfirm} onCancel={() => setConfirmState(null)} />}
      {showAdd && <AddProductModal onClose={()=>setShowAdd(false)} onSaved={loadData} token={token} />}
      {editingProduct && <EditProductModal product={editingProduct} onClose={()=>setEditingProduct(null)} onSaved={loadData} token={token} />}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          latestRate={latestRate}
          latestRateWarnings={latestRateWarnings}
          onClose={() => setSelectedProduct(null)}
          onEdit={userCanEdit ? (product: any) => {
            setSelectedProduct(null);
            setEditingProduct(product);
          } : undefined}
        />
      )}
      {showImportWizard && (
        <ProductImportWizardModal
          selectedFileName={pendingImportFile?.name || ''}
          preview={importPreview}
          importing={importing}
          selectedDuplicateSkus={selectedDuplicateSkus}
          onClose={() => {
            setShowImportWizard(false);
            resetImportWizard();
          }}
          onPickFile={() => fileInputRef.current?.click()}
          onAnalyze={handlePreviewImport}
          onImportNewOnly={() => handleImport('skip')}
          onReplaceDuplicates={() => handleImport('replace')}
          onToggleDuplicate={(sku) => setSelectedDuplicateSkus((current) => current.includes(sku) ? current.filter((item) => item !== sku) : [...current, sku])}
          onSelectAllDuplicates={() => setSelectedDuplicateSkus((importPreview?.rows || []).filter((row) => row.action === 'duplicate' && row.sku).map((row) => row.sku as string))}
          onClearAllDuplicates={() => setSelectedDuplicateSkus([])}
          outlineButtonStyle={S.btnOutline}
          primaryButtonStyle={S.btnPrimary}
        />
      )}
      {importReport && <ProductImportReportModal report={importReport} onClose={() => setImportReport(null)} primaryButtonStyle={S.btnPrimary} />}
      <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImportFileSelection} accept=".csv,.xlsx" />

      {/* Mini Dashboard */}
      <div style={ui.page.kpiRow}>
        <div style={{ ...S.kpiCard, ...ui.page.kpiCard }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase' }}>Danh mục Sản phẩm</span>
          <span style={{ fontSize: '24px', fontWeight: 800, color: tokens.colors.textPrimary }}>{stats.total}</span>
        </div>
        <div style={{ ...S.kpiCard, ...ui.page.kpiCard, borderLeft: `4px solid ${tokens.colors.warningDark}` }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.warningDark, textTransform: 'uppercase' }}>Số phân mục</span>
          <span style={{ fontSize: '24px', fontWeight: 800, color: tokens.colors.textPrimary }}>{stats.categories}</span>
        </div>
        <div style={{ ...S.kpiCard, ...ui.page.kpiCard, flex: '2 1 200px', borderLeft: `4px solid ${tokens.colors.success}` }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.success, textTransform: 'uppercase' }}>Giá tham chiếu trung bình</span>
          <span style={{ fontSize: '24px', fontWeight: 800, color: tokens.colors.textPrimary }}>${Math.round(stats.avgPrice).toLocaleString()}</span>
        </div>
      </div>

      <PageHeader
        icon={<PackageIcon size={22} />}
        title="Danh mục Sản phẩm"
        subtitle="Bảng giá tham chiếu và quản lý mã SKU"
        actions={<>
          <FormatActionButton label={t('common.import_template')} icon={SheetIcon} buttonStyle={S.btnOutline} onSelect={(format) => openProductFile('template', format)} />
          {userCanEdit && (
            <button style={S.btnOutline} title="Mở luồng import sản phẩm hàng loạt" onClick={() => setShowImportWizard(true)}>
              <ImportIcon size={14} /> {t('common.import_file')}
            </button>
          )}
          <FormatActionButton label={t('common.export_data')} icon={ExportIcon} buttonStyle={S.btnOutline} onSelect={(format) => openProductFile('export', format)} />
          {userCanEdit && <button style={S.btnPrimary} onClick={()=>setShowAdd(true)}><PlusIcon size={14} /> Thêm mới Sản phẩm</button>}
        </>}
      />

      <div style={{ ...S.card, display: 'flex', flexDirection: 'column', gap: '12px', border: `1px solid ${tokens.colors.border}` }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', flex: 1, minWidth: 0 }}>
            <div style={{ position: 'relative', minWidth: isMobile ? '100%' : '280px', flex: isMobile ? '1 1 100%' : '1 1 280px' }}>
              <SearchIcon size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
              <input
                type="text"
                placeholder="Tìm theo SKU, tên, danh mục..."
                value={searchTerm}
                onInput={(e: any) => setSearchTerm(e.target.value)}
                style={{ ...ui.input.base, padding: '9px 12px 9px 36px', fontSize: '13.5px', width: '100%', minWidth: 0 }}
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e: any) => setCategoryFilter(e.target.value)}
              style={{ ...ui.input.base, minWidth: isMobile ? '100%' : '220px' }}
            >
              <option value="">Tất cả danh mục</option>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setShowAdvancedFilters((prev) => !prev)} style={S.btnOutline}>
              {showAdvancedFilters ? 'Ẩn bộ lọc nâng cao' : 'Bộ lọc nâng cao'}
            </button>
            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setCategoryFilter('');
                  data.setFilters({});
                }}
                style={S.btnOutline}
              >
                Xóa bộ lọc
              </button>
            )}
          </div>
        </div>
        {showAdvancedFilters && (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: '12px' }}>
            {[
              { key: 'sku', label: 'SKU' },
              { key: 'unit', label: 'Đơn vị' },
              { key: 'basePrice', label: 'Giá bán ($)' },
            ].map((field) => (
              <div key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase' }}>{field.label}</label>
                <input
                  type="text"
                  placeholder={`Lọc ${field.label.toLowerCase()}`}
                  value={data.filters[field.key] || ''}
                  onInput={(e: any) => data.setFilters({ ...data.filters, [field.key]: e.target.value })}
                  style={{ ...ui.input.base, width: '100%', padding: '8px 10px', fontSize: '12px', fontWeight: 400 }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {loadError ? (
        <div style={{ ...S.card, border: `1px solid ${tokens.colors.warning}`, background: tokens.colors.badgeBgInfo, color: tokens.colors.textSecondary }}>
          {loadError}
        </div>
      ) : null}

      <div style={{ ...S.card, overflow: 'hidden', border: `1px solid ${tokens.colors.border}` }}>
        {loading ? <div style={{ padding: '80px', textAlign: 'center', color: tokens.colors.textMuted, fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><LoaderIcon size={16} /> Đang tải dữ liệu...</div> : (
          isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' }}>
                {data.items.map((p: any) => (
                  <div key={p.id} style={{ ...ui.card.base, border: `1px solid ${tokens.colors.border}`, padding: tokens.spacing.lg }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ fontSize: '15px', fontWeight: 800, color: tokens.colors.textPrimary }}>{p.name}</div>
                      <span style={{ background: tokens.colors.background, padding: '2px 8px', borderRadius: '8px', border: `1px solid ${tokens.colors.border}`, fontSize: '10px', fontWeight: 800, color: tokens.colors.textMuted }}>{p.sku}</span>
                    </div>
                    <QbuBadgeRow warnings={getProductQbuWarnings(p, latestRate)} />
                    <div style={{ display: 'grid', gap: '8px', marginTop: '10px' }}>
                      <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}><strong>Danh mục:</strong> {p.category || '-'}</div>
                      <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}><strong>Giá:</strong> ${p.basePrice?.toLocaleString() || '-'}</div>
                      <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}><strong>Đơn vị:</strong> {p.unit || '-'}</div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '12px', marginTop: '12px', borderTop: `1px solid ${tokens.colors.border}` }}>
                      <button aria-label={`Xem chi tiết ${p.name || p.sku || 'sản phẩm'}`} title="Xem chi tiết" onClick={() => setSelectedProduct(p)} style={{ ...ui.btn.outline, padding: '6px 10px' }}><EyeIcon size={14} /></button>
                      {userCanEdit && <button aria-label={`Chỉnh sửa ${p.name || p.sku || 'sản phẩm'}`} title="Chỉnh sửa" onClick={() => setEditingProduct(p)} style={{ ...ui.btn.outline, padding: '6px 10px' }}><EditIcon size={14} /></button>}
                      {userCanDelete && <button aria-label={`Xóa ${p.name || p.sku || 'sản phẩm'}`} title="Xóa" onClick={() => deleteProduct(p.id)} style={{ ...ui.btn.danger, padding: '6px 10px' }}><TrashIcon size={14} /></button>}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: tokens.colors.background }}>
                  {cols.map(c => (
                    <th key={c.k} style={S.thSortable} onClick={() => data.requestSort(c.k)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{c.l} {data.sortConfig?.key === c.k ? (data.sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
                      </div>
                    </th>
                  ))}
                  <th style={{ ...S.thStatic, cursor: 'default', textAlign: 'right' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((p: any) => (
                  <tr key={p.id} style={{ ...ui.table.row }} onMouseEnter={(e: any) => e.currentTarget.style.background = tokens.colors.background} onMouseLeave={(e: any) => e.currentTarget.style.background = ''}>
                    <td style={{ ...S.td, fontWeight: 800, color: tokens.colors.primary, verticalAlign: 'top' }}>{p.sku}</td>
                    <td style={{ ...S.td, fontWeight: 700, color: tokens.colors.textPrimary, verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {(() => {
                          const img = getPrimaryImage(p.productImages || []);
                          return img ? (
                            <img
                              src={resolveAssetUrl(API_ORIGIN, img.url)}
                              alt={img.alt || p.name}
                              style={{ width: 36, height: 36, borderRadius: '8px', objectFit: 'cover', flexShrink: 0, border: `1px solid ${tokens.colors.border}` }}
                            />
                          ) : (
                            <div style={{ width: 36, height: 36, borderRadius: '8px', background: tokens.colors.background, border: `1px solid ${tokens.colors.border}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 800, color: tokens.colors.textMuted }}>
                              {(p.name || p.sku || '?')[0].toUpperCase()}
                            </div>
                          );
                        })()}
                        <div>
                          <div>{p.name}</div>
                          <QbuBadgeRow warnings={getProductQbuWarnings(p, latestRate)} />
                        </div>
                      </div>
                    </td>
                    <td style={S.td}><span style={{ background: tokens.colors.background, padding: '3px 10px', borderRadius: '6px', border: `1px solid ${tokens.colors.border}`, fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted }}>{p.category}</span></td>
                    <td style={{ ...S.td, fontWeight: 800, color: tokens.colors.textPrimary }}>${p.basePrice?.toLocaleString()}</td>
                    <td style={{ ...S.td, textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <button 
                          aria-label={`Xem chi tiết ${p.name || p.sku || 'sản phẩm'}`}
                          title="Xem chi tiết"
                          onClick={() => setSelectedProduct(p)}
                          style={{ color: tokens.colors.info, background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700 }}
                        >
                          <EyeIcon size={14} />
                        </button>
                        {userCanEdit && <button
                          aria-label={`Chỉnh sửa ${p.name || p.sku || 'sản phẩm'}`}
                          title="Chỉnh sửa"
                          onClick={() => setEditingProduct(p)}
                          style={{ color: tokens.colors.primary, background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700 }}
                        >
                          <EditIcon size={14} />
                        </button>}
                        {userCanDelete && <button
                          aria-label={`Xóa ${p.name || p.sku || 'sản phẩm'}`}
                          title="Xóa"
                          onClick={() => deleteProduct(p.id)}
                          style={{ color: tokens.colors.error, background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700 }}
                        >
                          <TrashIcon size={14} />
                        </button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>
    </div>
  );
}
