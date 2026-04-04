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
import { integrateUploadedAsset, integrateUploadedImageAsset } from './products/assetUploadState';
import { buildImageUploadPreviewQueue, IMAGE_UPLOAD_PREVIEW_FRAME } from './products/imageUploadBatch';
import {
  PRODUCT_FORM_FIELD_IDS,
  formatProductPricePreview,
  getProductFormDismissLabel,
  getProductFormSubmitLabel,
} from './products/productFormPresentation';
import {
  getDocumentAssetMetaLabel,
  getProductMediaCollections,
  getVideoAssetMetaLabel,
} from './products/productMedia';
import { buildTabularFileUrl } from './shared/imports/tabularFiles';
import { compressImageForUpload } from './shared/uploads/imageCompression';
import { prepareVideoForUpload, type PreparedVideoUploadMode } from './shared/uploads/videoUpload';
import { FormatActionButton } from './ui/FormatActionButton';
import { PageHeader } from './ui/PageHeader';
import {
  ArrowUpIcon,
  ArrowDownIcon,
  CropIcon,
  EditIcon,
  ExportIcon,
  EyeIcon,
  ImportIcon,
  LoaderIcon,
  PackageIcon,
  PlusIcon,
  SearchIcon,
  SheetIcon,
  StarIcon,
  TrashIcon,
} from './ui/icons';

const API = API_BASE;
const API_ORIGIN = API.replace(/\/api\/?$/, '');
const FX_PAIR = 'USDVND';
const VN_TIME_ZONE = 'Asia/Ho_Chi_Minh';

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

type PendingImageUploadPreview = {
  key: string;
  name: string;
  url: string;
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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
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

function markPrimaryImage(images: ProductImageAsset[], imageId?: string) {
  return normalizePrimaryImageAssets(
    images.map((image, index) => ({
      ...image,
      isPrimary: imageId ? image.id === imageId : index === 0,
    })),
  );
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

function getVideoUploadModeBadge(video: ProductVideoAsset) {
  switch (video.uploadMode) {
    case 'transcoded':
      return {
        label: 'Da chuan hoa',
        background: tokens.colors.successTint,
        border: tokens.colors.badgeBgSuccess,
        color: tokens.colors.success,
      };
    case 'direct-mp4':
      return {
        label: 'MP4 san',
        background: 'rgba(59, 130, 246, 0.12)',
        border: 'rgba(59, 130, 246, 0.28)',
        color: tokens.colors.primary,
      };
    case 'external-url':
      return {
        label: 'URL ngoai',
        background: tokens.colors.warningBg,
        border: tokens.colors.warningBorder,
        color: tokens.colors.warning,
      };
    default:
      return null;
  }
}

function VideoModeBadge({ video }: { video: ProductVideoAsset }) {
  const badge = getVideoUploadModeBadge(video);
  if (!badge) return null;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '3px 8px',
        borderRadius: '999px',
        border: `1px solid ${badge.border}`,
        background: badge.background,
        color: badge.color,
        fontSize: '10px',
        fontWeight: 800,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}
    >
      {badge.label}
    </span>
  );
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

function resolveAssetUrl(url: string) {
  if (!url) return '';
  if (/^(https?:)?\/\//i.test(url) || url.startsWith('blob:') || url.startsWith('data:')) return url;
  return `${API_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
}

function formatAssetSize(size?: number) {
  if (!size || size <= 0) return '';
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

function getDocumentBadge(asset: ProductDocumentAsset) {
  const mime = String(asset.mimeType || '').toLowerCase();
  const name = String(asset.fileName || asset.url || '').toLowerCase();
  if (mime.includes('pdf') || name.endsWith('.pdf')) return 'PDF';
  if (mime.includes('word') || /\.docx?$/.test(name)) return 'DOC';
  if (mime.includes('sheet') || /\.xlsx?$/.test(name)) return 'XLS';
  if (mime.includes('presentation') || /\.pptx?$/.test(name)) return 'PPT';
  return 'FILE';
}

function formatVideoDuration(durationSeconds?: number) {
  if (!durationSeconds || durationSeconds <= 0) return '';
  const rounded = Math.round(durationSeconds);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

const videoPosterCache = new Map<string, Promise<string | null> | string | null>();

async function captureVideoPosterFrame(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';

    let settled = false;
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      video.pause?.();
      video.removeAttribute('src');
      video.load?.();
      resolve(value);
    };

    const drawCurrentFrame = () => {
      if (!video.videoWidth || !video.videoHeight) {
        finish(null);
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (!context) {
        finish(null);
        return;
      }
      try {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        finish(canvas.toDataURL('image/jpeg', 0.82));
      } catch {
        finish(null);
      }
    };

    video.onloadeddata = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0.15) {
        drawCurrentFrame();
        return;
      }
      try {
        video.currentTime = Math.min(0.12, Math.max(video.duration * 0.05, 0.01));
      } catch {
        drawCurrentFrame();
      }
    };
    video.onseeked = drawCurrentFrame;
    video.onerror = () => finish(null);
    video.src = src;
  });
}

function useVideoPoster(src: string) {
  const [posterUrl, setPosterUrl] = useState<string | null>(() => {
    const cached = videoPosterCache.get(src);
    return typeof cached === 'string' ? cached : null;
  });

  useEffect(() => {
    let active = true;
    const cached = videoPosterCache.get(src);
    if (typeof cached === 'string' || cached === null) {
      setPosterUrl(cached);
      return () => {
        active = false;
      };
    }

    const pending = cached || captureVideoPosterFrame(src);
    if (!cached) {
      videoPosterCache.set(src, pending);
    }

    Promise.resolve(pending)
      .then((result) => {
        videoPosterCache.set(src, result);
        if (active) setPosterUrl(result);
      })
      .catch(() => {
        videoPosterCache.set(src, null);
        if (active) setPosterUrl(null);
      });

    return () => {
      active = false;
    };
  }, [src]);

  return posterUrl;
}

export function VideoPosterPreview({
  src,
  title,
  style,
}: {
  src: string;
  title: string;
  style: any;
}) {
  const posterUrl = useVideoPoster(src);

  if (posterUrl) {
    return <img src={posterUrl} alt={title} style={style} />;
  }

  return <video src={src} muted preload="metadata" style={style} />;
}

export function ManagedVideoPlayer({
  src,
  title,
  style,
}: {
  src: string;
  title: string;
  style: any;
}) {
  const posterUrl = useVideoPoster(src);

  return <video src={src} poster={posterUrl || undefined} controls preload="metadata" aria-label={title} style={style} />;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Không thể đọc file ảnh.'));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Không thể mở ảnh để crop.'));
    image.src = src;
  });
}

async function createSquareCroppedImage(
  sourceUrl: string,
  crop: { zoom: number; offsetX: number; offsetY: number },
  outputType = 'image/jpeg',
  outputSize = 1200,
) {
  const image = await loadImageElement(sourceUrl);
  const cropSize = 320;
  const baseScale = Math.max(cropSize / image.naturalWidth, cropSize / image.naturalHeight);
  const displayScale = baseScale * crop.zoom;
  const displayWidth = image.naturalWidth * displayScale;
  const displayHeight = image.naturalHeight * displayScale;
  const maxOffsetX = Math.max(0, (displayWidth - cropSize) / 2);
  const maxOffsetY = Math.max(0, (displayHeight - cropSize) / 2);
  const offsetX = clamp(crop.offsetX, -maxOffsetX, maxOffsetX);
  const offsetY = clamp(crop.offsetY, -maxOffsetY, maxOffsetY);
  const left = (cropSize - displayWidth) / 2 + offsetX;
  const top = (cropSize - displayHeight) / 2 + offsetY;
  const sourceX = Math.max(0, -left / displayScale);
  const sourceY = Math.max(0, -top / displayScale);
  const sourceSize = cropSize / displayScale;

  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Không thể khởi tạo canvas crop.');

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, outputSize, outputSize);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Không thể tạo ảnh crop.'));
        return;
      }
      resolve(blob);
    }, outputType, outputType === 'image/jpeg' ? 0.92 : undefined);
  });
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

type ProductProfileStatus = {
  score: number;
  statusLabel: string;
  statusStyle: any;
  summary: string;
  missing: string[];
  pillars: Array<{ label: string; detail: string; complete: boolean }>;
};

type ProductTimelineEntry = {
  key: string;
  label: string;
  detail: string;
  at: string;
  tone: string;
};

function formatDateTimeLabel(value: string | Date | null | undefined, fallback = 'Chưa có dữ liệu') {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString('vi-VN');
}

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

function DetailField({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: any;
  accent?: boolean;
}) {
  return (
    <div style={{ display: 'grid', gap: '8px', minWidth: 0 }}>
      <div
        style={{
          fontSize: '11px',
          fontWeight: 800,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: tokens.colors.textMuted,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: accent ? '28px' : '15px',
          fontWeight: accent ? 900 : 700,
          lineHeight: accent ? 1.1 : 1.45,
          color: accent ? tokens.colors.primary : tokens.colors.textPrimary,
          wordBreak: 'break-word',
          textAlign: accent ? 'center' : 'left',
        }}
      >
        {value}
      </div>
    </div>
  );
}

const PRODUCT_DETAIL_PANEL_BG = tokens.surface.panelGradient;
const PRODUCT_DETAIL_HERO_BG = tokens.surface.heroGradient;
const PRODUCT_DETAIL_SURFACE_BG = tokens.colors.surfaceSubtle;

function DetailSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: any;
}) {
  return (
    <section
      style={{
        ...ui.card.base,
        background: PRODUCT_DETAIL_PANEL_BG,
        boxShadow: 'none',
        display: 'grid',
        gap: '16px',
        padding: '20px',
      }}
    >
      <div style={{ display: 'grid', gap: subtitle ? '6px' : 0 }}>
        <div
          style={{
            fontSize: '13px',
            fontWeight: 800,
            color: tokens.colors.textPrimary,
            letterSpacing: '0.02em',
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div style={{ fontSize: '12px', lineHeight: 1.5, color: tokens.colors.textSecondary }}>
            {subtitle}
          </div>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function EmptyAssetState({ title, description }: { title: string; description: string }) {
  return (
    <div
      style={{
        borderRadius: '18px',
        border: `1px dashed ${tokens.colors.border}`,
        background: PRODUCT_DETAIL_PANEL_BG,
        padding: '24px 20px',
        display: 'grid',
        gap: '10px',
        justifyItems: 'center',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '16px',
          display: 'grid',
          placeItems: 'center',
          background: tokens.colors.successTint,
          border: `1px solid ${tokens.colors.border}`,
          color: tokens.colors.primary,
          fontSize: '12px',
          fontWeight: 900,
          letterSpacing: '0.08em',
        }}
      >
        {title.includes('video') ? 'VID' : title.includes('hình') ? 'IMG' : 'DOC'}
      </div>
      <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{title}</div>
      <div style={{ fontSize: '12px', lineHeight: 1.65, color: tokens.colors.textSecondary, maxWidth: '48ch' }}>{description}</div>
    </div>
  );
}

function ProductImagePreviewCard({
  asset,
  onClick,
  selected = false,
}: {
  asset: ProductImageAsset;
  onClick?: () => void;
  selected?: boolean;
}) {
  const Container = onClick ? 'button' : 'div';
  const [cardAspectRatio, setCardAspectRatio] = useState<'16 / 9' | '3 / 4'>('16 / 9');

  useEffect(() => {
    let active = true;
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      if (!active) return;
      const width = image.naturalWidth || 0;
      const height = image.naturalHeight || 0;
      const isPortrait = width > 0 && height > width * 1.05;
      setCardAspectRatio(isPortrait ? '3 / 4' : '16 / 9');
    };
    image.onerror = () => {
      if (!active) return;
      setCardAspectRatio('16 / 9');
    };
    image.src = resolveAssetUrl(asset.url);
    return () => {
      active = false;
    };
  }, [asset.url]);

  return (
    <Container
      {...(onClick ? { type: 'button', onClick } : {})}
      title={asset.title}
      style={{
        borderRadius: '16px',
        overflow: 'hidden',
        border: selected ? `1px solid ${tokens.colors.primary}` : `1px solid ${tokens.colors.border}`,
        background: PRODUCT_DETAIL_SURFACE_BG,
        padding: '0',
        cursor: onClick ? 'pointer' : 'default',
        textAlign: 'left',
        boxShadow: selected ? '0 10px 24px rgba(16, 185, 129, 0.12)' : 'none',
        display: 'grid',
        minWidth: 0,
        aspectRatio: cardAspectRatio,
        alignSelf: 'start',
      } as any}
    >
      <img
        src={resolveAssetUrl(asset.url)}
        alt={asset.alt || asset.title}
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', background: tokens.colors.background, imageOrientation: 'from-image' as any }}
      />
    </Container>
  );
}

function ProductVideoPreviewCard({
  asset,
  height = '88px',
}: {
  asset: ProductVideoAsset;
  height?: string;
}) {
  return (
    <div
      style={{
        borderRadius: '16px',
        overflow: 'hidden',
        border: `1px solid ${tokens.colors.border}`,
        background: PRODUCT_DETAIL_SURFACE_BG,
        display: 'grid',
        minWidth: 0,
      }}
    >
      <VideoPosterPreview
        src={resolveAssetUrl(asset.url)}
        title={asset.title}
        style={{ width: '100%', height, objectFit: 'cover', display: 'block', background: tokens.colors.background }}
      />
      <div style={{ padding: '10px 10px 12px', display: 'grid', gap: '4px', minWidth: 0 }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: tokens.colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {asset.title}
        </div>
        <div style={{ fontSize: '11px', color: tokens.colors.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {getVideoAssetMetaLabel(asset)}
        </div>
      </div>
    </div>
  );
}

function ProductDocumentPreviewCard({ asset }: { asset: ProductDocumentAsset }) {
  return (
    <div
      style={{
        borderRadius: '16px',
        overflow: 'hidden',
        border: `1px solid ${tokens.colors.border}`,
        background: PRODUCT_DETAIL_SURFACE_BG,
        display: 'grid',
        minWidth: 0,
      }}
    >
      <div
        style={{
          height: '88px',
          display: 'grid',
          placeItems: 'center',
          background: tokens.colors.successTint,
          color: tokens.colors.primary,
          fontSize: '13px',
          fontWeight: 900,
          letterSpacing: '0.08em',
        }}
      >
        {getDocumentBadge(asset)}
      </div>
      <div style={{ padding: '10px 10px 12px', display: 'grid', gap: '4px', minWidth: 0 }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: tokens.colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {asset.title}
        </div>
        <div style={{ fontSize: '11px', color: tokens.colors.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {getDocumentAssetMetaLabel(asset)}
        </div>
      </div>
    </div>
  );
}

export function ProductAssetGallery({ images }: { images: ProductImageAsset[] }) {
  const orderedImages = normalizePrimaryImageAssets(images);
  const [isCompactGallery, setIsCompactGallery] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 720 : false));

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setIsCompactGallery(window.innerWidth <= 720);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!orderedImages.length) {
    return <EmptyAssetState title="Chưa có hình ảnh" description="Thêm ảnh sản phẩm để đội sales xem nhanh layout, model và tình trạng thực tế." />;
  }

  return (
    <div style={{ display: 'grid', gap: '12px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: isCompactGallery ? 'repeat(3, minmax(0, 1fr))' : 'repeat(5, minmax(0, 1fr))', gap: '10px' }}>
        {orderedImages.map((asset, index) => (
          <ProductImagePreviewCard
            key={asset.id || `${asset.url}-${index}`}
            asset={asset}
            selected={Boolean(asset.isPrimary)}
          />
        ))}
      </div>
    </div>
  );
}

export function ProductVideoGallery({ videos }: { videos: ProductVideoAsset[] }) {
  if (!videos.length) {
    return <EmptyAssetState title="Chưa có video" description="Thêm video demo, walkthrough hoặc footage vận hành để đội sales share nhanh cho đối tác." />;
  }

  return (
    <div style={{ display: 'grid', gap: '12px' }}>
      {videos.map((asset, index) => (
        <div
          key={asset.id || `${asset.url}-${index}`}
          style={{
            borderRadius: '20px',
            border: `1px solid ${tokens.colors.border}`,
            background: PRODUCT_DETAIL_SURFACE_BG,
            overflow: 'hidden',
            display: 'grid',
            gap: '0',
          }}
        >
          <ManagedVideoPlayer
            src={resolveAssetUrl(asset.url)}
            title={asset.title}
            style={{ width: '100%', maxHeight: '420px', background: tokens.colors.background, display: 'block' }}
          />
          <div style={{ padding: '14px 16px', display: 'grid', gap: '6px' }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{asset.title}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '11px', color: tokens.colors.textSecondary }}>
              <span>{asset.fileName || 'MP4 chuẩn share'}</span>
              <VideoModeBadge video={asset} />
              {asset.durationSeconds ? <span>{formatVideoDuration(asset.durationSeconds)}</span> : null}
              {asset.width && asset.height ? <span>{asset.width}x{asset.height}</span> : null}
              {asset.size ? <span>{formatAssetSize(asset.size)}</span> : null}
            </div>
            {asset.description ? (
              <div style={{ fontSize: '12px', lineHeight: 1.6, color: tokens.colors.textMuted }}>{asset.description}</div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProductDocumentList({ documents }: { documents: ProductDocumentAsset[] }) {
  if (!documents.length) {
    return <EmptyAssetState title="Chưa có tài liệu" description="Thêm brochure, datasheet hoặc file kỹ thuật để người dùng mở trực tiếp từ hồ sơ sản phẩm." />;
  }

  return (
    <div style={{ display: 'grid', gap: '10px' }}>
      {documents.map((asset, index) => (
        <div
          key={asset.id || `${asset.url}-${index}`}
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto minmax(0, 1fr) auto',
            gap: '16px',
            alignItems: 'center',
            padding: '16px 18px',
            borderRadius: '18px',
            border: `1px solid ${tokens.colors.border}`,
            background: PRODUCT_DETAIL_PANEL_BG,
          }}
        >
          <div
            style={{
              minWidth: '50px',
              height: '50px',
              borderRadius: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: tokens.colors.successTint,
              border: `1px solid ${tokens.colors.border}`,
              color: tokens.colors.primary,
              fontSize: '12px',
              fontWeight: 900,
              letterSpacing: '0.08em',
            }}
          >
            {getDocumentBadge(asset)}
          </div>
          <div style={{ minWidth: 0, display: 'grid', gap: '5px' }}>
            <div style={{ fontSize: '14px', fontWeight: 800, color: tokens.colors.textPrimary }}>{asset.title}</div>
            <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, lineHeight: 1.55 }}>
              {asset.description || asset.fileName || 'Tài liệu liên quan đến sản phẩm'}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '11px', color: tokens.colors.textMuted }}>
              {asset.mimeType ? <span>{asset.mimeType}</span> : null}
              {asset.fileName ? <span>{asset.fileName}</span> : null}
              {asset.size ? <span>{formatAssetSize(asset.size)}</span> : null}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <a
              href={resolveAssetUrl(asset.url)}
              target="_blank"
              rel="noreferrer"
              style={{ ...S.btnOutline, textDecoration: 'none', padding: '8px 14px', minWidth: '72px', justifyContent: 'center' }}
            >
              Mở
            </a>
            <a
              href={resolveAssetUrl(asset.url)}
              download={asset.fileName || true}
              style={{ ...S.btnPrimary, textDecoration: 'none', padding: '8px 14px', minWidth: '108px', justifyContent: 'center' }}
            >
              Tải xuống
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProductDocumentWorkspace({ documents }: { documents: ProductDocumentAsset[] }) {
  if (!documents.length) {
    return <EmptyAssetState title="Chưa có tài liệu" description="Thêm brochure, datasheet hoặc file kỹ thuật để người dùng mở trực tiếp từ hồ sơ sản phẩm." />;
  }

  const groups = groupProductDocuments(documents);

  return (
    <div style={{ display: 'grid', gap: '14px' }}>
      {groups.map((group) => (
        <div
          key={group.key}
          style={{
            borderRadius: '20px',
            border: `1px solid ${tokens.colors.border}`,
            background: PRODUCT_DETAIL_PANEL_BG,
            padding: '16px',
            display: 'grid',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'start', flexWrap: 'wrap' }}>
            <div style={{ display: 'grid', gap: '6px' }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{group.title}</div>
              <div style={{ fontSize: '12px', lineHeight: 1.55, color: tokens.colors.textSecondary, maxWidth: '72ch' }}>
                {group.description}
              </div>
            </div>
            <span style={{ ...ui.badge.neutral, background: tokens.colors.surfaceSubtle }}>{group.items.length} file</span>
          </div>
          <ProductDocumentList documents={group.items} />
        </div>
      ))}
    </div>
  );
}

function ProductProfileStatusPanel({ status }: { status: ProductProfileStatus }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', alignItems: 'stretch' }}>
      <div
        style={{
          ...ui.card.base,
          background: PRODUCT_DETAIL_SURFACE_BG,
          boxShadow: 'none',
          padding: '18px 16px',
          display: 'grid',
          gap: '8px',
          alignContent: 'center',
          justifyItems: 'center',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: tokens.colors.textMuted }}>
          Profile Score
        </div>
        <div style={{ fontSize: '42px', fontWeight: 900, lineHeight: 1, color: tokens.colors.primary }}>{status.score}%</div>
        <span style={status.statusStyle}>{status.statusLabel}</span>
      </div>

      <div
        style={{
          ...ui.card.base,
          background: PRODUCT_DETAIL_SURFACE_BG,
          boxShadow: 'none',
          padding: '18px 18px 16px',
          display: 'grid',
          gap: '14px',
        }}
      >
        <div style={{ fontSize: '13px', lineHeight: 1.65, color: tokens.colors.textSecondary }}>{status.summary}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
          {status.pillars.map((pillar) => (
            <div
              key={pillar.label}
              style={{
                borderRadius: '16px',
                border: `1px solid ${tokens.colors.border}`,
                background: pillar.complete ? tokens.colors.successTint : tokens.colors.warningTint,
                padding: '12px 14px',
                display: 'grid',
                gap: '6px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: tokens.colors.textPrimary }}>{pillar.label}</span>
                <span style={pillar.complete ? ui.badge.success : ui.badge.warning}>{pillar.complete ? 'OK' : 'Thiếu'}</span>
              </div>
              <div style={{ fontSize: '12px', lineHeight: 1.55, color: tokens.colors.textSecondary }}>{pillar.detail}</div>
            </div>
          ))}
        </div>
        {status.missing.length ? (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {status.missing.slice(0, 4).map((item) => (
              <span key={item} style={ui.badge.warning}>{item}</span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ProductTimeline({ entries }: { entries: ProductTimelineEntry[] }) {
  if (!entries.length) {
    return <EmptyAssetState title="Chưa có mốc cập nhật" description="Khi hồ sơ có thêm ảnh, tài liệu hoặc snapshot QBU, timeline sẽ tự suy luận và hiển thị ở đây." />;
  }

  return (
    <div style={{ display: 'grid', gap: '12px' }}>
      {entries.map((entry) => (
        <div key={`${entry.key}-${entry.at}`} style={{ display: 'grid', gridTemplateColumns: '16px minmax(0, 1fr)', gap: '14px', alignItems: 'start' }}>
          <div style={{ display: 'grid', justifyItems: 'center', paddingTop: '8px' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '999px',
                background: entry.tone,
                boxShadow: `0 0 0 4px ${entry.tone}22`,
              }}
            />
          </div>
          <div
            style={{
              borderRadius: '16px',
              border: `1px solid ${tokens.colors.border}`,
              background: PRODUCT_DETAIL_SURFACE_BG,
              padding: '14px 16px',
              display: 'grid',
              gap: '6px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{entry.label}</span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: tokens.colors.textMuted }}>{formatDateTimeLabel(entry.at)}</span>
            </div>
            <div style={{ fontSize: '12px', lineHeight: 1.6, color: tokens.colors.textSecondary }}>{entry.detail}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ImageCropModal({
  sourceUrl,
  title,
  onClose,
  onConfirm,
}: {
  sourceUrl: string;
  title: string;
  onClose: () => void;
  onConfirm: (crop: { zoom: number; offsetX: number; offsetY: number }) => Promise<void> | void;
}) {
  const cropSize = 320;
  const [imageMeta, setImageMeta] = useState<{ width: number; height: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [saving, setSaving] = useState(false);
  const dragState = useRef<{ startX: number; startY: number; offsetX: number; offsetY: number } | null>(null);

  useEffect(() => {
    let active = true;
    loadImageElement(sourceUrl)
      .then((image) => {
        if (!active) return;
        setImageMeta({ width: image.naturalWidth, height: image.naturalHeight });
      })
      .catch(() => {
        if (!active) return;
        setImageMeta({ width: cropSize, height: cropSize });
      });
    return () => {
      active = false;
    };
  }, [sourceUrl]);

  const baseScale = imageMeta ? Math.max(cropSize / imageMeta.width, cropSize / imageMeta.height) : 1;
  const displayWidth = imageMeta ? imageMeta.width * baseScale * zoom : cropSize;
  const displayHeight = imageMeta ? imageMeta.height * baseScale * zoom : cropSize;
  const maxOffsetX = Math.max(0, (displayWidth - cropSize) / 2);
  const maxOffsetY = Math.max(0, (displayHeight - cropSize) / 2);
  const safeOffsetX = clamp(offsetX, -maxOffsetX, maxOffsetX);
  const safeOffsetY = clamp(offsetY, -maxOffsetY, maxOffsetY);
  const left = (cropSize - displayWidth) / 2 + safeOffsetX;
  const top = (cropSize - displayHeight) / 2 + safeOffsetY;

  useEffect(() => {
    setOffsetX((current) => clamp(current, -maxOffsetX, maxOffsetX));
    setOffsetY((current) => clamp(current, -maxOffsetY, maxOffsetY));
  }, [maxOffsetX, maxOffsetY]);

  const startDrag = (event: any) => {
    dragState.current = {
      startX: event.clientX,
      startY: event.clientY,
      offsetX: safeOffsetX,
      offsetY: safeOffsetY,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onDrag = (event: any) => {
    if (!dragState.current) return;
    const nextX = dragState.current.offsetX + (event.clientX - dragState.current.startX);
    const nextY = dragState.current.offsetY + (event.clientY - dragState.current.startY);
    setOffsetX(clamp(nextX, -maxOffsetX, maxOffsetX));
    setOffsetY(clamp(nextY, -maxOffsetY, maxOffsetY));
  };

  const stopDrag = (event: any) => {
    dragState.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  return (
    <OverlayModal title="Cắt ảnh đại diện" subtitle="Kéo ảnh và zoom để chốt khung vuông hiển thị như avatar sản phẩm." onClose={onClose} maxWidth="760px">
      <div style={{ display: 'grid', gap: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 220px', gap: '20px', alignItems: 'start' }}>
          <div style={{ display: 'grid', gap: '12px', justifyItems: 'center' }}>
            <div
              onPointerDown={startDrag}
              onPointerMove={onDrag}
              onPointerUp={stopDrag}
              onPointerLeave={stopDrag}
              style={{
                width: `${cropSize}px`,
                height: `${cropSize}px`,
                borderRadius: '28px',
                overflow: 'hidden',
                border: `1px solid ${tokens.colors.border}`,
                // Intentional dark scrim: crop UI sits on top of arbitrary imagery and needs stable contrast.
                background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.94) 0%, rgba(2, 6, 23, 0.94) 100%)',
                position: 'relative',
                cursor: 'grab',
                touchAction: 'none',
                boxShadow: '0 18px 40px rgba(2, 6, 23, 0.28)',
              }}
            >
              <img
                src={sourceUrl}
                alt={title}
                draggable={false}
                style={{
                  position: 'absolute',
                  left: `${left}px`,
                  top: `${top}px`,
                  width: `${displayWidth}px`,
                  height: `${displayHeight}px`,
                  objectFit: 'cover',
                  userSelect: 'none',
                  pointerEvents: 'none',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  boxShadow: 'inset 0 0 0 999px rgba(2, 6, 23, 0.18)',
                  border: '2px solid rgba(255,255,255,0.2)',
                  borderRadius: '28px',
                  pointerEvents: 'none',
                }}
              />
            </div>
            <div style={{ fontSize: '12px', color: tokens.colors.textMuted }}>Ảnh đại diện sẽ hiển thị dạng hình vuông ở hero preview và thumbnail chính.</div>
          </div>
          <div style={{ display: 'grid', gap: '16px' }}>
            <div style={{ display: 'grid', gap: '6px' }}>
              <div style={{ fontSize: '12px', fontWeight: 800, color: tokens.colors.textPrimary }}>Ảnh nguồn</div>
              <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, lineHeight: 1.55 }}>{title}</div>
            </div>
            <div style={{ display: 'grid', gap: '8px' }}>
              <label style={S.label}>Zoom khung crop</label>
              <input type="range" min="1" max="3" step="0.05" value={zoom} onInput={(e: any) => setZoom(Number(e.currentTarget.value))} />
              <div style={{ fontSize: '11px', color: tokens.colors.textMuted }}>Kéo trực tiếp trong khung vuông để chỉnh vị trí hiển thị.</div>
            </div>
            <div style={{ display: 'grid', gap: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  setZoom(1);
                  setOffsetX(0);
                  setOffsetY(0);
                }}
                style={{ ...S.btnOutline, justifyContent: 'center' }}
              >
                Đặt lại khung crop
              </button>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button type="button" onClick={onClose} style={S.btnOutline} disabled={saving}>Hủy</button>
          <button
            type="button"
            onClick={async () => {
              setSaving(true);
              try {
                await onConfirm({ zoom, offsetX: safeOffsetX, offsetY: safeOffsetY });
              } finally {
                setSaving(false);
              }
            }}
            style={S.btnPrimary}
            disabled={saving}
          >
            {saving ? 'Đang lưu...' : 'Dùng làm ảnh đại diện'}
          </button>
        </div>
      </div>
    </OverlayModal>
  );
}

function CompactAssetStrip({
  items,
  kind,
}: {
  items: Array<ProductImageAsset | ProductVideoAsset | ProductDocumentAsset>;
  kind: 'image' | 'video' | 'document';
}) {
  const previewItems = kind === 'image' ? normalizePrimaryImageAssets(items as ProductImageAsset[]) : items;
  if (!previewItems.length) return null;

  return (
    <div
      style={{
        display: 'grid',
        gap: '10px',
        padding: '14px',
        borderRadius: '18px',
        border: `1px solid ${tokens.colors.border}`,
        background: tokens.surface.panelGradient,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '12px', fontWeight: 800, color: tokens.colors.textPrimary }}>
          {kind === 'image' ? 'Preview thư viện ảnh' : kind === 'video' ? 'Preview thư viện video' : 'Preview thư viện tài liệu'}
        </div>
        <div style={{ fontSize: '11px', color: tokens.colors.textMuted }}>
          {previewItems.length} {kind === 'image' ? 'asset hình ảnh' : kind === 'video' ? 'asset video' : 'asset tài liệu'}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
        {previewItems.slice(0, kind === 'image' ? 4 : 3).map((item, index) =>
          kind === 'image' ? (
            <ProductImagePreviewCard
              key={item.id || `${item.url}-${index}`}
              asset={item as ProductImageAsset}
            />
          ) : kind === 'video' ? (
            <ProductVideoPreviewCard
              key={item.id || `${item.url}-${index}`}
              asset={item as ProductVideoAsset}
            />
          ) : (
            <ProductDocumentPreviewCard
              key={item.id || `${item.url}-${index}`}
              asset={item as ProductDocumentAsset}
            />
          ),
        )}
      </div>
    </div>
  );
}

function AssetLinkComposer({
  label,
  titleValue,
  urlValue,
  descriptionValue,
  onTitleChange,
  onUrlChange,
  onDescriptionChange,
  onAdd,
  showDescription = false,
  urlHint,
}: any) {
  return (
    <div
      style={{
        padding: '16px',
        borderRadius: '18px',
        border: `1px solid ${tokens.colors.border}`,
        background: tokens.surface.panelGradient,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: showDescription
            ? 'repeat(auto-fit, minmax(220px, 1fr))'
            : 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '12px',
          alignItems: 'end',
        }}
      >
        <div>
          <label style={S.label}>{label}</label>
          <input type="text" style={S.input} value={titleValue} onInput={onTitleChange} placeholder="Tiêu đề hiển thị" />
        </div>
        <div>
          <label style={S.label}>URL</label>
          <input type="text" style={S.input} value={urlValue} onInput={onUrlChange} placeholder="https://..." />
        </div>
        {showDescription ? (
          <div>
            <label style={S.label}>Mô tả ngắn</label>
            <input type="text" style={S.input} value={descriptionValue} onInput={onDescriptionChange} placeholder="Brochure / Datasheet / HDSD..." />
          </div>
        ) : null}
        <button type="button" onClick={onAdd} style={{ ...S.btnPrimary, minWidth: '124px', justifyContent: 'center' }}>
          <PlusIcon size={14} /> Thêm link
        </button>
      </div>
      {urlHint ? (
        <div
          style={{
            padding: '10px 12px',
            borderRadius: '10px',
            border: `1px solid ${tokens.colors.warningBorder}`,
            background: tokens.colors.warningTint,
            fontSize: '11px',
            lineHeight: 1.55,
            color: tokens.colors.warning,
          }}
        >
          {urlHint}
        </div>
      ) : null}
    </div>
  );
}

export function AssetListEditor({
  title,
  subtitle,
  items,
  kind,
  onItemsChange,
  productId,
  token,
}: {
  title: string;
  subtitle: string;
  items: any[];
  kind: 'image' | 'video' | 'document';
  onItemsChange: (items: any[]) => void;
  productId?: string;
  token: string;
}) {
  const [draftTitle, setDraftTitle] = useState('');
  const [draftUrl, setDraftUrl] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<UploadFeedback | null>(null);
  const [activeFileName, setActiveFileName] = useState('');
  const [busyAssetId, setBusyAssetId] = useState<string | null>(null);
  const [pendingImagePreviews, setPendingImagePreviews] = useState<PendingImageUploadPreview[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const primaryInputRef = useRef<HTMLInputElement>(null);
  const pendingImagePreviewsRef = useRef<PendingImageUploadPreview[]>([]);
  const latestNormalizedItemsRef = useRef<any[]>([]);
  const resolvedToken = token || loadSession()?.token || '';
  const [cropSource, setCropSource] = useState<{
    sourceUrl: string;
    fileName: string;
    title: string;
    replaceAssetId?: string;
  } | null>(null);
  const normalizedItems = kind === 'image'
    ? normalizeImageAssets(items)
    : kind === 'video'
      ? normalizeVideoAssets(items)
      : normalizeDocumentAssets(items);

  useEffect(() => {
    latestNormalizedItemsRef.current = normalizedItems;
  }, [normalizedItems]);

  const clearPendingImagePreviews = () => {
    pendingImagePreviewsRef.current.forEach((preview) => URL.revokeObjectURL(preview.url));
    pendingImagePreviewsRef.current = [];
    setPendingImagePreviews([]);
  };

  const publishPendingImagePreviews = (previews: PendingImageUploadPreview[]) => {
    clearPendingImagePreviews();
    pendingImagePreviewsRef.current = previews;
    setPendingImagePreviews(previews);
  };

  useEffect(() => () => {
    pendingImagePreviewsRef.current.forEach((preview) => URL.revokeObjectURL(preview.url));
    pendingImagePreviewsRef.current = [];
  }, []);

  const addUrlAsset = () => {
    if (!draftUrl.trim()) {
      showNotify('Thiếu URL asset', 'error');
      return;
    }

    const base = {
      id: `${kind}-${Date.now()}`,
      title: ensureAssetTitle(draftTitle, draftUrl, kind === 'image' ? 'Image asset' : kind === 'video' ? 'Video asset' : 'Document asset'),
      url: draftUrl.trim(),
      sourceType: 'url' as const,
    };

    const nextAsset = kind === 'image'
      ? { ...base, alt: ensureAssetTitle(draftTitle, draftUrl, 'Image asset'), isPrimary: false }
      : kind === 'video'
        ? { ...base, description: draftDescription.trim() || undefined, uploadMode: 'external-url' as const }
        : { ...base, description: draftDescription.trim() || undefined };

    if (kind === 'image') {
      onItemsChange(normalizePrimaryImageAssets([...(normalizedItems as ProductImageAsset[]), nextAsset]));
    } else {
      onItemsChange([...items, nextAsset]);
    }
    setDraftTitle('');
    setDraftUrl('');
    setDraftDescription('');
  };

  const updateItem = (index: number, patch: Record<string, any>) => {
    onItemsChange(normalizedItems.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  };

  const removeItem = async (index: number) => {
    const targetItem = normalizedItems[index];
    if (!targetItem) return;

    if (productId && resolvedToken && targetItem.id && targetItem.sourceType === 'upload') {
      setBusyAssetId(String(targetItem.id));
      setUploadFeedback({ tone: 'info', stage: 'deleting', message: `Đang gỡ ${targetItem.title || 'asset'} khỏi sản phẩm...` });
      try {
        const res = await fetchWithAuth(resolvedToken, `${API}/products/${productId}/assets/${kind}/${targetItem.id}`, {
          method: 'DELETE',
        });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload?.error || 'Không thể xóa asset');
      } catch (error: any) {
        const message = error?.message || 'Không thể xóa asset';
        setUploadFeedback({ tone: 'error', message, stage: 'deleting' });
        showNotify(message, 'error');
        setBusyAssetId(null);
        return;
      }
    }

    onItemsChange(normalizedItems.filter((_, itemIndex) => itemIndex !== index));
    setBusyAssetId(null);
    setUploadFeedback({
      tone: 'success',
      message: targetItem.sourceType === 'upload'
        ? `${kind === 'image' ? 'Hình ảnh' : kind === 'video' ? 'Video' : 'Tài liệu'} đã được gỡ khỏi sản phẩm và dọn file lưu trữ.`
        : `${kind === 'image' ? 'Hình ảnh' : kind === 'video' ? 'Video' : 'Tài liệu'} đã được bỏ khỏi biểu mẫu. Nhấn lưu để ghi nhận thay đổi.`,
    });
  };

  const setPrimaryImageLocally = (imageId?: string) => {
    if (kind !== 'image') return;
    onItemsChange(markPrimaryImage(normalizedItems as ProductImageAsset[], imageId));
  };

  const moveImageItem = (index: number, direction: -1 | 1) => {
    if (kind !== 'image') return;
    const imageItems = normalizePrimaryImageAssets(normalizedItems as ProductImageAsset[]);
    const targetIndex = index + direction;
    const firstGalleryIndex = imageItems[0]?.isPrimary ? 1 : 0;
    if (index < 0 || targetIndex < firstGalleryIndex || targetIndex >= imageItems.length) return;
    const nextItems = [...imageItems];
    const [movedItem] = nextItems.splice(index, 1);
    nextItems.splice(targetIndex, 0, movedItem);
    onItemsChange(normalizePrimaryImageAssets(nextItems));
  };

  const uploadFile = async (file: File, options?: { isPrimary?: boolean; replaceAssetId?: string }) => {
    if (!productId) {
      setUploadFeedback({ tone: 'error', message: 'Tạo sản phẩm trước để dùng upload trực tiếp.' });
      showNotify('Lưu sản phẩm trước rồi mới upload file trực tiếp.', 'error');
      return;
    }
    if (!resolvedToken) {
      setUploadFeedback({ tone: 'error', message: 'Phiên đăng nhập đã hết. Vui lòng tải lại trang rồi thử lại.' });
      showNotify('Phiên đăng nhập đã hết. Vui lòng tải lại trang rồi thử lại.', 'error');
      return;
    }
    setActiveFileName(file.name);
    setUploading(true);
    setUploadFeedback({ tone: 'info', stage: 'uploading', message: `Đang chuẩn bị ${file.name}...` });
    try {
      let preparedFile = file;
      let videoMetadata: { durationSeconds?: number; width?: number; height?: number } | null = null;
      let videoUploadMode: PreparedVideoUploadMode | null = null;
      if (kind === 'image') {
        try {
          const result = await compressImageForUpload(file, 'product-image');
          preparedFile = result.file;
        } catch {
          preparedFile = file;
        }
      } else if (kind === 'video') {
        const result = await prepareVideoForUpload(file, {
          onStatusChange: (status) => {
            const message = status.message || 'Đang chuẩn bị video...';
            setUploadFeedback({
              tone: status.stage === 'fallback' ? 'error' : 'info',
              stage: status.stage === 'ready' ? 'completed' : status.stage,
              message,
              progress: 'progress' in status ? (status as any).progress : undefined,
            });
          },
        });
        preparedFile = result.file;
        videoMetadata = {
          durationSeconds: result.durationSeconds,
          width: result.width,
          height: result.height,
        };
        videoUploadMode = result.uploadMode;
        if (!result.shareReady) {
          throw new Error('Video chưa ở trạng thái share-ready. Hãy đổi sang MP4 nhẹ hơn hoặc cắt ngắn clip rồi thử lại.');
        }
      }
      setUploadFeedback({
        tone: 'info',
        stage: 'uploading',
        message: `Đang gửi ${preparedFile.name} lên máy chủ...`,
      });
      const formData = new FormData();
      formData.append('file', preparedFile);
      if (draftTitle.trim()) formData.append('title', draftTitle.trim());
      if (kind === 'image' && options?.isPrimary) formData.append('isPrimary', 'true');
      if (options?.replaceAssetId) formData.append('replaceAssetId', options.replaceAssetId);
      if (kind !== 'image' && draftDescription.trim()) formData.append('description', draftDescription.trim());
      if (kind === 'video' && videoMetadata) {
        if (videoMetadata.durationSeconds) formData.append('durationSeconds', String(videoMetadata.durationSeconds));
        if (videoMetadata.width) formData.append('width', String(videoMetadata.width));
        if (videoMetadata.height) formData.append('height', String(videoMetadata.height));
      }

      const res = await fetchWithAuth(resolvedToken, `${API}/products/${productId}/${kind === 'image' ? 'images' : kind === 'video' ? 'videos' : 'documents'}`, {
        method: 'POST',
        body: formData,
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Upload thất bại');

      if (kind === 'image') {
        const nextImages = integrateUploadedImageAsset(
          latestNormalizedItemsRef.current as ProductImageAsset[],
          payload as ProductImageAsset,
          options,
        );
        onItemsChange(nextImages);
      } else {
        const nextVideoPayload = kind === 'video'
          ? { ...payload, uploadMode: videoUploadMode || 'direct-mp4' }
          : payload;
        onItemsChange(
          integrateUploadedAsset(
            latestNormalizedItemsRef.current as typeof nextVideoPayload[],
            nextVideoPayload,
            options?.replaceAssetId,
          ),
        );
      }
      setDraftTitle('');
      setDraftDescription('');
      if (inputRef.current) inputRef.current.value = '';
      if (primaryInputRef.current) primaryInputRef.current.value = '';
      setUploadFeedback({
        tone: 'success',
        stage: 'completed',
        message: `${kind === 'image' ? 'Hình ảnh' : kind === 'video' ? 'Video' : 'Tài liệu'} ${payload?.title || file.name} đã được tải lên và gắn vào sản phẩm.`,
      });
      showNotify(kind === 'image' ? 'Đã upload hình ảnh' : kind === 'video' ? 'Đã upload video' : 'Đã upload tài liệu', 'success');
    } catch (error: any) {
      const message = error?.message || 'Không thể upload asset. Vui lòng thử lại.';
      setUploadFeedback({ tone: 'error', message, progress: undefined });
      showNotify(message, 'error');
    } finally {
      setUploading(false);
      setActiveFileName('');
    }
  };

  const uploadImageBatch = async (selectedFiles: ArrayLike<File> | readonly File[] | null | undefined) => {
    const queue = buildImageUploadPreviewQueue(selectedFiles);
    if (!queue.files.length) {
      if (inputRef.current) inputRef.current.value = '';
      showNotify('Chỉ hỗ trợ upload các file hình ảnh hợp lệ cho gallery.', 'error');
      return;
    }

    const previews = queue.files.map((file, index) => ({
      key: `${file.name}-${file.size}-${index}`,
      name: file.name,
      url: URL.createObjectURL(file),
    }));

    publishPendingImagePreviews(previews);
    try {
      for (const file of queue.files) {
        // Preserve the selection order so the preview strip matches the upload order.
        await uploadFile(file);
      }
    } finally {
      clearPendingImagePreviews();
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const beginPrimaryImageCrop = async (file: File) => {
    try {
      const sourceUrl = await readFileAsDataUrl(file);
      setCropSource({
        sourceUrl,
        fileName: file.name,
        title: draftTitle.trim() || file.name,
      });
    } catch (error: any) {
      showNotify(error?.message || 'Không thể mở ảnh để crop.', 'error');
    }
  };

  const beginExistingImageCrop = (item: ProductImageAsset) => {
    if (!productId) {
      showNotify('Tạo sản phẩm trước để crop ảnh đại diện.', 'error');
      return;
    }
    if (item.sourceType !== 'upload') {
      showNotify('Crop lại trực tiếp hiện hỗ trợ cho ảnh đã upload vào hệ thống.', 'error');
      return;
    }
    setCropSource({
      sourceUrl: resolveAssetUrl(item.url),
      fileName: item.fileName || `${item.title || 'product-image'}.jpg`,
      title: item.title || 'Ảnh đại diện',
      replaceAssetId: item.id,
    });
  };

  return (
    <div style={{ display: 'grid', gap: '14px' }}>
      <div style={{ display: 'grid', gap: '4px' }}>
        <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{title}</div>
        <div style={{ fontSize: '12px', lineHeight: 1.55, color: tokens.colors.textSecondary }}>{subtitle}</div>
      </div>

      <CompactAssetStrip items={normalizedItems as Array<ProductImageAsset | ProductVideoAsset | ProductDocumentAsset>} kind={kind} />

      <AssetLinkComposer
        label={kind === 'image' ? 'Tên ảnh' : kind === 'video' ? 'Tên video' : 'Tên tài liệu'}
        titleValue={draftTitle}
        urlValue={draftUrl}
        descriptionValue={draftDescription}
        onTitleChange={(e: any) => setDraftTitle(e.target.value)}
        onUrlChange={(e: any) => setDraftUrl(e.target.value)}
        onDescriptionChange={(e: any) => setDraftDescription(e.target.value)}
        onAdd={addUrlAsset}
        showDescription={kind !== 'image'}
        urlHint={kind === 'video' ? 'Video gắn bằng URL ngoài sẽ không được hệ thống chuẩn hoá, nén hay sinh metadata share-ready. Ưu tiên upload file trực tiếp nếu cần clip ổn định để gửi đối tác.' : undefined}
      />

      <div
        style={{
          display: 'grid',
          gap: '10px',
          padding: '16px',
          borderRadius: '18px',
          border: `1px solid ${tokens.colors.border}`,
          background: tokens.colors.surfaceSubtle,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'grid', gap: '4px' }}>
            <div style={{ fontSize: '12px', fontWeight: 800, color: tokens.colors.textPrimary }}>
              {kind === 'image' ? 'Upload ảnh từ máy' : kind === 'video' ? 'Upload video từ máy' : 'Upload tài liệu từ máy'}
            </div>
            <div style={{ fontSize: '11px', lineHeight: 1.55, color: tokens.colors.textMuted }}>
              {kind === 'image'
                ? 'Dùng cho ảnh thực tế, brochure visual hoặc asset render. Tối đa 20MB mỗi file.'
                : kind === 'video'
                  ? 'Trình duyệt sẽ ưu tiên chuẩn hoá video về MP4 H.264/AAC trước khi gửi lên để clip nhẹ và dễ share. Tối đa 200MB mỗi file.'
                  : 'Dùng cho brochure, datasheet, catalogue hoặc hướng dẫn sử dụng. Tối đa 20MB mỗi file.'}
            </div>
          </div>
          {kind === 'image' ? (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={!productId || uploading}
                style={{ ...S.btnOutline, minWidth: '148px', justifyContent: 'center', opacity: !productId || uploading ? 0.6 : 1 }}
              >
                {uploading ? 'Đang upload...' : 'Tải ảnh gallery'}
              </button>
              <button
                type="button"
                onClick={() => primaryInputRef.current?.click()}
                disabled={!productId || uploading}
                style={{ ...S.btnPrimary, minWidth: '172px', justifyContent: 'center', opacity: !productId || uploading ? 0.6 : 1 }}
              >
                Tải ảnh đại diện
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={!productId || uploading}
              style={{ ...S.btnOutline, minWidth: '148px', justifyContent: 'center', opacity: !productId || uploading ? 0.6 : 1 }}
            >
              {uploading ? 'Đang upload...' : kind === 'video' ? 'Chọn video tải lên' : 'Chọn file tải lên'}
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={kind === 'image' ? 'image/png,image/jpeg,image/jpg,image/webp' : kind === 'video' ? 'video/mp4,video/quicktime,video/webm,video/x-msvideo,.mp4,.mov,.webm,.avi,.mkv' : '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx'}
          multiple={kind === 'image'}
          style={{ display: 'none' }}
          onChange={(e: any) => {
            if (kind === 'image') {
              void uploadImageBatch(e.target.files);
              return;
            }
            const file = e.target.files?.[0];
            if (file) void uploadFile(file);
          }}
          disabled={!productId || uploading}
        />
        {kind === 'image' ? (
          <input
            ref={primaryInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            style={{ display: 'none' }}
            onChange={(e: any) => {
              const file = e.target.files?.[0];
              if (file) beginPrimaryImageCrop(file);
            }}
            disabled={!productId || uploading}
          />
        ) : null}
        {!productId ? (
          <span style={{ fontSize: '11px', color: tokens.colors.textMuted }}>
            Tạo sản phẩm trước để dùng upload trực tiếp.
          </span>
        ) : null}
        {kind === 'image' && pendingImagePreviews.length ? (
          <div
            style={{
              display: 'grid',
              gap: '8px',
              padding: '12px',
              borderRadius: '14px',
              border: `1px solid ${tokens.colors.border}`,
              background: tokens.surface.panelGradient,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textPrimary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Preview ảnh chờ upload
              </span>
              <span style={{ fontSize: '11px', color: tokens.colors.textMuted }}>
                {pendingImagePreviews.length} file
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(88px, 1fr))', gap: '8px' }}>
              {pendingImagePreviews.slice(0, 4).map((preview) => (
                <div
                  key={preview.key}
                  style={{
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: `1px solid ${tokens.colors.border}`,
                    background: tokens.colors.surfaceSubtle,
                    display: 'grid',
                  }}
                >
                  <img src={preview.url} alt={preview.name} style={IMAGE_UPLOAD_PREVIEW_FRAME} />
                </div>
              ))}
              {pendingImagePreviews.length > 4 ? (
                <div
                  style={{
                    borderRadius: '12px',
                    border: `1px dashed ${tokens.colors.border}`,
                    background: tokens.colors.surfaceSubtle,
                    color: tokens.colors.textSecondary,
                    display: 'grid',
                    placeItems: 'center',
                    minHeight: '88px',
                    fontSize: '12px',
                    fontWeight: 800,
                  }}
                >
                  +{pendingImagePreviews.length - 4}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
        {uploadFeedback ? (
          <div
            style={{
              display: 'grid',
              gap: '4px',
              padding: '12px 14px',
              borderRadius: '14px',
              border: `1px solid ${
                uploadFeedback.tone === 'error'
                  ? tokens.colors.error
                  : uploadFeedback.tone === 'success'
                    ? tokens.colors.success
                    : tokens.colors.primary
              }33`,
              background:
                uploadFeedback.tone === 'error'
                  ? 'rgba(239, 68, 68, 0.08)'
                  : uploadFeedback.tone === 'success'
                    ? tokens.colors.successTint
                    : 'rgba(59, 130, 246, 0.08)',
            }}
          >
            <span
              style={{
                fontSize: '11px',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color:
                  uploadFeedback.tone === 'error'
                    ? tokens.colors.error
                    : uploadFeedback.tone === 'success'
                      ? tokens.colors.success
                      : tokens.colors.primary,
              }}
            >
              {uploadFeedback.tone === 'error' ? 'Upload lỗi' : uploadFeedback.tone === 'success' ? 'Upload thành công' : 'Đang xử lý'}
            </span>
            <span style={{ fontSize: '12px', lineHeight: 1.5, color: tokens.colors.textSecondary }}>
              {uploadFeedback.message}
            </span>
            {typeof uploadFeedback.progress === 'number' ? (
              <div style={{ display: 'grid', gap: '6px' }}>
                <div
                  style={{
                    width: '100%',
                    height: '8px',
                    borderRadius: '999px',
                    overflow: 'hidden',
                    background: 'rgba(148, 163, 184, 0.18)',
                  }}
                >
                  <div
                    style={{
                      width: `${Math.max(6, Math.min(uploadFeedback.progress * 100, 100))}%`,
                      height: '100%',
                      borderRadius: '999px',
                      background: tokens.colors.primary,
                      transition: 'width 180ms ease',
                    }}
                  />
                </div>
                <span style={{ fontSize: '11px', color: tokens.colors.textMuted }}>
                  Tiến độ xử lý: {(uploadFeedback.progress * 100).toFixed(0)}%
                </span>
              </div>
            ) : null}
            {uploading && activeFileName ? (
              <span style={{ fontSize: '11px', color: tokens.colors.textMuted }}>
                File hiện tại: {activeFileName}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {items.length ? (
        <div style={{ display: 'grid', gap: '10px' }}>
          {normalizedItems.map((item, index) => (
            (() => {
              const isBusy = busyAssetId === item.id;
              const isPrimaryImage = kind === 'image' && (item as ProductImageAsset).isPrimary;
              const firstGalleryIndex = kind === 'image' && (normalizedItems[0] as ProductImageAsset | undefined)?.isPrimary ? 1 : 0;
              const canMoveUp = kind === 'image' && !isPrimaryImage && index > firstGalleryIndex;
              const canMoveDown = kind === 'image' && !isPrimaryImage && index < normalizedItems.length - 1;
              return (
            <div
              key={item.id || `${item.url}-${index}`}
              style={{
                borderRadius: '14px',
                border: `1px solid ${(item as ProductImageAsset).isPrimary ? tokens.colors.badgeBgSuccess : tokens.colors.border}`,
                background: 'rgba(15, 23, 42, 0.55)',
                padding: '10px 12px',
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
              }}
            >
              {/* Thumbnail */}
              <div
                style={{
                  width: '56px', minWidth: '56px', height: '56px',
                  borderRadius: '10px', overflow: 'hidden',
                  border: `1px solid ${tokens.colors.border}`,
                  background: kind === 'image' ? 'rgba(2,6,23,0.4)' : kind === 'video' ? 'rgba(59,130,246,0.14)' : tokens.colors.successTint,
                  display: 'grid', placeItems: 'center',
                  color: tokens.colors.primary, fontSize: '11px', fontWeight: 900,
                }}
              >
                {kind === 'image' ? (
                  <img src={resolveAssetUrl(item.url)} alt={(item as ProductImageAsset).alt || item.title || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                ) : kind === 'video' ? (
                  <VideoPosterPreview src={resolveAssetUrl(item.url)} title={item.title || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', background: 'rgba(2,6,23,0.92)' }} />
                ) : (
                  getDocumentBadge(item)
                )}
              </div>

              {/* Title + meta */}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <input
                  type="text"
                  style={{ ...S.input, padding: '5px 10px', fontSize: '12px' }}
                  value={item.title || ''}
                  onInput={(e: any) => updateItem(index, { title: e.target.value })}
                  placeholder="Tiêu đề"
                />
                {kind !== 'image' ? (
                  <input
                    type="text"
                    style={{ ...S.input, padding: '5px 10px', fontSize: '12px' }}
                    value={((item as ProductVideoAsset).description || (item as ProductDocumentAsset).description || '')}
                    onInput={(e: any) => updateItem(index, { description: e.target.value })}
                    placeholder={kind === 'video' ? 'Mô tả ngắn / use case' : 'Mô tả ngắn'}
                  />
                ) : null}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                  {kind === 'image' && (item as ProductImageAsset).isPrimary && (
                    <span style={{ ...ui.badge.success, background: tokens.colors.successTint, fontSize: '10px', padding: '2px 7px' }}>Đại diện</span>
                  )}
                  {item.size ? <span style={{ fontSize: '10px', color: tokens.colors.textMuted }}>{formatAssetSize(item.size)}</span> : null}
                  {kind === 'video' ? <VideoModeBadge video={item as ProductVideoAsset} /> : null}
                  {kind === 'video' && (item as ProductVideoAsset).durationSeconds ? <span style={{ fontSize: '10px', color: tokens.colors.textMuted }}>{formatVideoDuration((item as ProductVideoAsset).durationSeconds)}</span> : null}
                  {kind === 'video' && (item as ProductVideoAsset).width && (item as ProductVideoAsset).height ? <span style={{ fontSize: '10px', color: tokens.colors.textMuted }}>{(item as ProductVideoAsset).width}×{(item as ProductVideoAsset).height}</span> : null}
                  <span style={{ fontSize: '10px', color: tokens.colors.textMuted }}>{item.sourceType === 'upload' ? 'Upload' : 'URL'}</span>
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
                {kind === 'image' ? (
                  <>
                    <button
                      type="button"
                      title={(item as ProductImageAsset).isPrimary ? 'Đang là ảnh đại diện' : 'Đặt làm ảnh đại diện'}
                      onClick={() => setPrimaryImageLocally(item.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '8px', color: (item as ProductImageAsset).isPrimary ? '#f59e0b' : tokens.colors.textMuted, display: 'flex' }}
                    >
                      <StarIcon size={14} fill={(item as ProductImageAsset).isPrimary ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      type="button"
                      title="Crop ảnh đại diện"
                      onClick={() => beginExistingImageCrop(item as ProductImageAsset)}
                      disabled={!productId || uploading || isBusy || (item as ProductImageAsset).sourceType !== 'upload'}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '8px', color: tokens.colors.textMuted, display: 'flex', opacity: !productId || uploading || isBusy || (item as ProductImageAsset).sourceType !== 'upload' ? 0.4 : 1 }}
                    >
                      <CropIcon size={14} />
                    </button>
                    <button
                      type="button"
                      title="Đưa lên"
                      onClick={() => moveImageItem(index, -1)}
                      disabled={!canMoveUp || uploading || Boolean(isBusy)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '8px', color: tokens.colors.textMuted, display: 'flex', opacity: !canMoveUp || uploading || Boolean(isBusy) ? 0.4 : 1 }}
                    >
                      <ArrowUpIcon size={14} />
                    </button>
                    <button
                      type="button"
                      title="Đưa xuống"
                      onClick={() => moveImageItem(index, 1)}
                      disabled={!canMoveDown || uploading || Boolean(isBusy)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '8px', color: tokens.colors.textMuted, display: 'flex', opacity: !canMoveDown || uploading || Boolean(isBusy) ? 0.4 : 1 }}
                    >
                      <ArrowDownIcon size={14} />
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  title={isBusy ? 'Đang xóa...' : 'Xóa'}
                  onClick={() => removeItem(index)}
                  disabled={uploading || Boolean(isBusy)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '8px', color: tokens.colors.error, display: 'flex', opacity: uploading || Boolean(isBusy) ? 0.5 : 1 }}
                >
                  <TrashIcon size={14} />
                </button>
              </div>
            </div>
              );
            })()
          ))}
        </div>
      ) : (
        <EmptyAssetState
          title={`Chưa có ${kind === 'image' ? 'hình ảnh' : kind === 'video' ? 'video' : 'tài liệu'}`}
          description={kind === 'image'
            ? 'Thêm link ảnh hoặc upload ảnh thật từ máy để build gallery.'
            : kind === 'video'
              ? 'Thêm clip demo để trình duyệt chuẩn hoá MP4 trước khi upload và hiển thị poster thumbnail ngay trong giao diện.'
              : 'Thêm brochure, catalogue hoặc hướng dẫn sử dụng để hiện trong hồ sơ sản phẩm.'}
        />
      )}
      {kind === 'image' && cropSource ? (
        <ImageCropModal
          sourceUrl={cropSource.sourceUrl}
          title={cropSource.title}
          onClose={() => {
            setCropSource(null);
            if (primaryInputRef.current) primaryInputRef.current.value = '';
          }}
          onConfirm={async (crop) => {
            try {
              const blob = await createSquareCroppedImage(cropSource.sourceUrl, crop);
              const extension = cropSource.fileName.toLowerCase().endsWith('.png') ? 'png' : 'jpg';
              const file = new File([blob], `primary-${Date.now()}.${extension}`, { type: blob.type || 'image/jpeg' });
              await uploadFile(file, { isPrimary: true, replaceAssetId: cropSource.replaceAssetId });
              setCropSource(null);
            } catch (error: any) {
              showNotify(error?.message || 'Không thể crop ảnh.', 'error');
            }
          }}
        />
      ) : null}
    </div>
  );
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
                    href={resolveAssetUrl(preferredSalesDocument.url)}
                    target="_blank"
                    rel="noreferrer"
                    style={{ ...S.btnOutline, textDecoration: 'none', padding: '10px 16px' }}
                  >
                    {getDocumentGroupKey(preferredSalesDocument) === 'sales' ? 'Mở brochure / catalogue' : 'Mở tài liệu đầu tiên'}
                  </a>
                ) : null}
                {preferredTechnicalDocument && preferredTechnicalDocument.url !== preferredSalesDocument?.url ? (
                  <a
                    href={resolveAssetUrl(preferredTechnicalDocument.url)}
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
                  src={resolveAssetUrl(heroImage.url)}
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
          <ProductAssetGallery images={productImages} />
        </DetailSection>

        <DetailSection title="Video sản phẩm" subtitle="Video demo đã được chuẩn hóa MP4 để có thể mở trực tiếp hoặc gửi cho đối tác.">
          <ProductVideoGallery videos={productVideos} />
        </DetailSection>

        <DetailSection title="Tài liệu liên quan" subtitle="Catalogue, brochure, tài liệu kỹ thuật và hướng dẫn sử dụng được gom nhóm để đội sales mở nhanh đúng loại file cần dùng.">
          <ProductDocumentWorkspace documents={productDocuments} />
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
                href={resolveAssetUrl(preferredSalesDocument.url)}
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

function ProductImportReportModal({
  report,
  onClose,
}: {
  report: ProductImportReport;
  onClose: () => void;
}) {
  const actionLabel = {
    created: 'Tạo mới',
    updated: 'Cập nhật',
    skipped: 'Bỏ qua',
    error: 'Lỗi',
  } as const;

  const actionStyle = {
    created: ui.badge.success,
    updated: ui.badge.info,
    skipped: ui.badge.neutral,
    error: ui.badge.error,
  } as const;

  return (
    <OverlayModal title="Kết quả import sản phẩm" onClose={onClose} maxWidth="860px" contentPadding="24px">
      <div style={{ display: 'grid', gap: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '13px', color: tokens.colors.textSecondary, lineHeight: 1.6 }}>
            {buildProductImportSummary(report)}
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <span style={report.mode === 'replace' ? ui.badge.warning : ui.badge.info}>
              {report.mode === 'replace' ? 'Replace toàn phần' : 'Merge an toàn'}
            </span>
            {report.clearImages ? <span style={ui.badge.warning}>Reset ảnh</span> : null}
            {report.clearVideos ? <span style={ui.badge.warning}>Reset video</span> : null}
            {report.clearDocuments ? <span style={ui.badge.warning}>Reset tài liệu</span> : null}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
          {[
            { label: 'Tổng dòng', value: report.totalRows, tone: tokens.colors.textPrimary },
            { label: 'Tạo mới', value: report.created, tone: tokens.colors.success },
            { label: 'Cập nhật', value: report.updated, tone: tokens.colors.info },
            { label: 'Bỏ qua', value: report.skipped, tone: tokens.colors.textSecondary },
            { label: 'Lỗi', value: report.errors, tone: tokens.colors.error },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                ...ui.card.base,
                padding: '16px',
                boxShadow: 'none',
                border: `1px solid ${tokens.colors.border}`,
                display: 'grid',
                gap: '6px',
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: tokens.colors.textMuted }}>{item.label}</span>
              <span style={{ fontSize: '22px', fontWeight: 900, color: item.tone }}>{item.value}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gap: '10px', maxHeight: '380px', overflowY: 'auto', paddingRight: '4px' }}>
          {report.rows.map((row) => (
            <div
              key={`${row.rowNumber}-${row.sku || 'empty'}`}
              style={{
                ...ui.card.base,
                boxShadow: 'none',
                border: `1px solid ${tokens.colors.border}`,
                padding: '14px 16px',
                display: 'grid',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: '14px', color: tokens.colors.textPrimary }}>Dòng {row.rowNumber}</strong>
                  <span style={actionStyle[row.action]}>{actionLabel[row.action]}</span>
                  <span style={{ fontSize: '13px', color: tokens.colors.textSecondary }}>SKU: {row.sku || 'Chưa có'}</span>
                </div>
              </div>
              <div style={{ display: 'grid', gap: '6px' }}>
                {row.messages.length > 0 ? row.messages.map((message, index) => (
                  <div key={`${row.rowNumber}-${index}`} style={{ fontSize: '13px', color: tokens.colors.textSecondary }}>
                    {message}
                  </div>
                )) : (
                  <div style={{ fontSize: '13px', color: tokens.colors.textSecondary }}>Không có ghi chú bổ sung.</div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ ...S.btnPrimary, padding: '10px 20px', minWidth: '120px' }}>Đóng báo cáo</button>
        </div>
      </div>
    </OverlayModal>
  );
}

function ProductImportWizardModal({
  selectedFileName,
  preview,
  importing,
  selectedDuplicateSkus,
  onClose,
  onPickFile,
  onAnalyze,
  onImportNewOnly,
  onReplaceDuplicates,
  onToggleDuplicate,
  onSelectAllDuplicates,
  onClearAllDuplicates,
}: {
  selectedFileName: string;
  preview: ProductImportPreviewReport | null;
  importing: boolean;
  selectedDuplicateSkus: string[];
  onClose: () => void;
  onPickFile: () => void;
  onAnalyze: () => void;
  onImportNewOnly: () => void;
  onReplaceDuplicates: () => void;
  onToggleDuplicate: (sku: string) => void;
  onSelectAllDuplicates: () => void;
  onClearAllDuplicates: () => void;
}) {
  const [expandedCompareSkus, setExpandedCompareSkus] = useState<string[]>([]);
  const [previewFilter, setPreviewFilter] = useState<'all' | 'duplicate' | 'error' | 'new'>('all');
  const duplicateCount = preview?.duplicateRows || 0;
  const selectedReplaceCount = selectedDuplicateSkus.length;
  const skippedDuplicateCount = Math.max(duplicateCount - selectedReplaceCount, 0);
  const filteredPreviewRows = (preview?.rows || []).filter((row) => {
    if (previewFilter === 'all') return true;
    return row.action === previewFilter;
  });

  return (
    <OverlayModal
      title="Nhập sản phẩm hàng loạt"
      subtitle="Tải file lên, để hệ thống rà SKU trùng trước, rồi mới quyết định chỉ nhập mới hay replace toàn bộ sản phẩm trùng."
      onClose={onClose}
      maxWidth="820px"
      contentPadding="24px 28px"
      placement="center"
    >
      <div style={{ display: 'grid', gap: '20px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px',
          }}
        >
          {[
            {
              step: '01',
              title: 'Chọn file',
              body: selectedFileName ? selectedFileName : 'CSV hoặc XLSX theo mẫu import sản phẩm',
              tone: tokens.colors.info,
            },
            {
              step: '02',
              title: 'Phân tích duplicate',
              body: preview
                ? `${preview.duplicateRows} SKU trùng · ${preview.newRows} SKU mới`
                : 'Kiểm tra SKU đã tồn tại trước khi ghi dữ liệu',
              tone: preview?.duplicateRows ? tokens.colors.warningDark : tokens.colors.success,
            },
            {
              step: '03',
              title: 'Quyết định nhập',
              body: preview
                ? preview.duplicateRows > 0
                  ? 'Chọn chỉ nhập sản phẩm mới hoặc replace toàn bộ dòng trùng'
                  : 'Không có duplicate, có thể nhập ngay'
                : 'Sau khi phân tích, hệ thống sẽ cho bạn chọn cách xử lý dòng trùng',
              tone: preview?.duplicateRows ? tokens.colors.warningDark : tokens.colors.textSecondary,
            },
          ].map((item) => (
            <div
              key={item.step}
              style={{
                ...ui.card.base,
                boxShadow: 'none',
                border: `1px solid ${tokens.colors.border}`,
                padding: '16px',
                display: 'grid',
                gap: '8px',
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '0.08em', color: item.tone }}>{item.step}</span>
              <span style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{item.title}</span>
              <span style={{ fontSize: '13px', color: tokens.colors.textSecondary, lineHeight: 1.6 }}>{item.body}</span>
            </div>
          ))}
        </div>

        <div style={{ ...ui.card.base, boxShadow: 'none', border: `1px solid ${tokens.colors.border}`, padding: '18px', display: 'grid', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 900, color: tokens.colors.textMuted, textTransform: 'uppercase' }}>Nguồn dữ liệu</div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: tokens.colors.textPrimary, marginTop: '4px' }}>
                {selectedFileName || 'Chưa chọn file import'}
              </div>
            </div>
            <button type="button" style={S.btnOutline} onClick={onPickFile}>
              <ImportIcon size={14} /> {selectedFileName ? 'Đổi file' : 'Chọn file'}
            </button>
          </div>
          <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>
            Hỗ trợ `.csv` và `.xlsx`. Mẫu import vẫn được tải từ nút `Mẫu import` trên toolbar.
          </div>
        </div>

        {!preview ? (
          <div
            style={{
              borderRadius: '18px',
              border: `1px solid ${tokens.colors.border}`,
              background: tokens.colors.surface,
              padding: '16px 18px',
              display: 'grid',
              gap: '8px',
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 900, color: tokens.colors.textMuted, textTransform: 'uppercase' }}>Bước tiếp theo</div>
            <div style={{ fontSize: '14px', color: tokens.colors.textPrimary, lineHeight: 1.7 }}>
              {selectedFileName
                ? `File ${selectedFileName} đã sẵn sàng để phân tích duplicate theo SKU.`
                : 'Chọn file trước, sau đó bấm Phân tích file để xem sản phẩm mới, sản phẩm trùng và dòng lỗi.'}
            </div>
          </div>
        ) : (
          <>
            <div style={{ ...ui.card.base, boxShadow: 'none', border: `1px solid ${tokens.colors.border}`, padding: '18px', display: 'grid', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '13px', color: tokens.colors.textSecondary, lineHeight: 1.6 }}>
                  {buildProductImportPreviewSummary(preview)}
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={ui.badge.success}>{preview.newRows} mới</span>
                  <span style={preview.duplicateRows > 0 ? ui.badge.warning : ui.badge.info}>{preview.duplicateRows} trùng</span>
                  <span style={preview.errorRows > 0 ? ui.badge.error : ui.badge.neutral}>{preview.errorRows} lỗi</span>
                  {preview.duplicateRows > 0 ? (
                    <>
                      <button type="button" onClick={onSelectAllDuplicates} style={{ ...S.btnOutline, padding: '7px 12px' }}>
                        Chọn tất cả dòng trùng
                      </button>
                      <button type="button" onClick={onClearAllDuplicates} style={{ ...S.btnOutline, padding: '7px 12px' }}>
                        Bỏ chọn tất cả
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                {[
                  { key: 'all' as const, label: `Tất cả (${preview.totalRows})`, tone: previewFilter === 'all' ? tokens.colors.primary : tokens.colors.textSecondary },
                  { key: 'duplicate' as const, label: `SKU trùng (${preview.duplicateRows})`, tone: previewFilter === 'duplicate' ? tokens.colors.warningDark : tokens.colors.textSecondary },
                  { key: 'error' as const, label: `Dòng lỗi (${preview.errorRows})`, tone: previewFilter === 'error' ? tokens.colors.error : tokens.colors.textSecondary },
                  { key: 'new' as const, label: `Sản phẩm mới (${preview.newRows})`, tone: previewFilter === 'new' ? tokens.colors.success : tokens.colors.textSecondary },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setPreviewFilter(item.key)}
                    style={{
                      ...S.btnOutline,
                      padding: '7px 12px',
                      borderColor:
                        previewFilter === item.key
                          ? item.key === 'duplicate'
                            ? tokens.colors.warningBorder
                            : item.key === 'error'
                              ? tokens.colors.badgeBgError
                              : item.key === 'new'
                                ? tokens.colors.successTint
                                : 'rgba(59, 130, 246, 0.24)'
                          : tokens.colors.border,
                      background:
                        previewFilter === item.key
                          ? item.key === 'duplicate'
                            ? tokens.colors.warningBg
                            : item.key === 'error'
                              ? tokens.colors.badgeBgError
                              : item.key === 'new'
                                ? tokens.colors.successTint
                                : 'rgba(59, 130, 246, 0.1)'
                          : tokens.colors.surface,
                      color: item.tone,
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div style={{ display: 'grid', gap: '10px', maxHeight: '320px', overflowY: 'auto', paddingRight: '4px' }}>
                {filteredPreviewRows.map((row) => (
                  <div
                    key={`${row.rowNumber}-${row.sku || 'empty'}`}
                    style={{
                      ...ui.card.base,
                      boxShadow: 'none',
                      border: `1px solid ${row.action === 'duplicate' ? tokens.colors.warningBorder : tokens.colors.border}`,
                      padding: '14px 16px',
                      display: 'grid',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '14px', color: tokens.colors.textPrimary }}>Dòng {row.rowNumber}</strong>
                        <span style={row.action === 'new' ? ui.badge.success : row.action === 'duplicate' ? ui.badge.warning : ui.badge.error}>
                          {row.action === 'new' ? 'Mới' : row.action === 'duplicate' ? 'Trùng SKU' : 'Lỗi'}
                        </span>
                        <span style={{ fontSize: '13px', color: tokens.colors.textSecondary }}>SKU: {row.sku || 'Chưa có'}</span>
                      </div>
                      {row.changes.length > 0 ? (
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {row.changes.map((change) => <span key={change} style={ui.badge.warning}>{change}</span>)}
                        </div>
                      ) : null}
                    </div>
                    <div style={{ display: 'grid', gap: '4px' }}>
                      <div style={{ fontSize: '13px', color: tokens.colors.textPrimary }}>
                        File nhập: <strong>{row.incomingName || 'Chưa có tên'}</strong>
                      </div>
                      {row.existingName ? (
                        <div style={{ fontSize: '13px', color: tokens.colors.textSecondary }}>
                          Hiện tại: <strong>{row.existingName}</strong>
                        </div>
                      ) : null}
                    </div>
                    <div style={{ display: 'grid', gap: '4px' }}>
                      {row.messages.map((message, index) => (
                        <div key={`${row.rowNumber}-${index}`} style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>
                          {message}
                        </div>
                      ))}
                    </div>
                    {row.action === 'duplicate' && row.sku ? (
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => setExpandedCompareSkus((current) => current.includes(row.sku!) ? current.filter((item) => item !== row.sku) : [...current, row.sku!])}
                          style={{ ...S.btnOutline, padding: '8px 12px' }}
                        >
                          {expandedCompareSkus.includes(row.sku) ? 'Ẩn so sánh' : 'Xem so sánh'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleDuplicate(row.sku!)}
                          style={{
                            ...S.btnOutline,
                            padding: '8px 12px',
                            borderColor: selectedDuplicateSkus.includes(row.sku) ? tokens.colors.warningBorder : tokens.colors.border,
                            background: selectedDuplicateSkus.includes(row.sku) ? tokens.colors.warningBg : tokens.colors.surface,
                            color: selectedDuplicateSkus.includes(row.sku) ? tokens.colors.warningDark : tokens.colors.textSecondary,
                          }}
                        >
                          {selectedDuplicateSkus.includes(row.sku) ? 'Sẽ replace dòng này' : 'Bỏ qua dòng này'}
                        </button>
                      </div>
                    ) : null}
                    {row.action === 'duplicate' && row.sku && expandedCompareSkus.includes(row.sku) ? (
                      <div
                        style={{
                          display: 'grid',
                          gap: '8px',
                          borderRadius: '14px',
                          border: `1px solid ${tokens.colors.warningBorder}`,
                          background: `linear-gradient(180deg, ${tokens.colors.warningTint} 0%, ${tokens.colors.surface} 100%)`,
                          padding: '12px',
                        }}
                      >
                        {row.compare.filter((item) => item.changed).length > 0 ? row.compare.filter((item) => item.changed).map((item) => (
                          <div
                            key={`${row.sku}-${item.label}`}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '160px minmax(0, 1fr) minmax(0, 1fr)',
                              gap: '10px',
                              alignItems: 'start',
                              borderRadius: '12px',
                              border: `1px solid ${tokens.colors.warningTint}`,
                              background: tokens.colors.surfaceSubtle,
                              padding: '10px',
                            }}
                          >
                            <div style={{ fontSize: '12px', fontWeight: 800, color: tokens.colors.warningDark, textTransform: 'uppercase' }}>{item.label}</div>
                            <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, lineHeight: 1.6, minWidth: 0 }}>
                              <strong style={{ display: 'block', color: tokens.colors.textMuted, marginBottom: '2px' }}>Hiện tại</strong>
                              {item.currentValue || 'Chưa có'}
                            </div>
                            <div style={{ fontSize: '12px', color: tokens.colors.textPrimary, lineHeight: 1.6, minWidth: 0 }}>
                              <strong style={{ display: 'block', color: tokens.colors.warningDark, marginBottom: '2px' }}>Trong file</strong>
                              {item.incomingValue || 'Chưa có'}
                            </div>
                          </div>
                        )) : (
                          <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>
                            Không có khác biệt rõ ràng giữa dữ liệu hiện tại và file import.
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                ))}
                {filteredPreviewRows.length === 0 ? (
                  <div
                    style={{
                      ...ui.card.base,
                      boxShadow: 'none',
                      border: `1px dashed ${tokens.colors.border}`,
                      padding: '18px',
                      textAlign: 'center',
                      color: tokens.colors.textSecondary,
                    }}
                  >
                    Không có dòng nào khớp với bộ lọc hiện tại.
                  </div>
                ) : null}
              </div>
              {preview.duplicateRows > 0 ? (
                <div
                  style={{
                    position: 'sticky',
                    bottom: 0,
                    zIndex: 1,
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '12px',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    borderTop: `1px solid ${tokens.colors.border}`,
                    background: tokens.colors.surface,
                    padding: '12px 0 0',
                    marginTop: '4px',
                  }}
                >
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={ui.badge.warning}>{selectedReplaceCount} sẽ replace</span>
                    <span style={ui.badge.neutral}>{skippedDuplicateCount} sẽ skip</span>
                    {preview.errorRows > 0 ? <span style={ui.badge.error}>{preview.errorRows} dòng lỗi cần sửa</span> : null}
                  </div>
                  <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>
                    Sản phẩm mới vẫn được tạo bình thường. Khu này chỉ áp dụng cho các SKU trùng.
                  </div>
                </div>
              ) : null}
            </div>
            <div
              style={{
                borderRadius: '18px',
                border: `1px solid ${preview.duplicateRows > 0 ? tokens.colors.warningBorder : tokens.colors.border}`,
                background: preview.duplicateRows > 0 ? tokens.colors.warningTint : tokens.colors.surface,
                padding: '16px 18px',
                display: 'grid',
                gap: '8px',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 900, color: tokens.colors.textMuted, textTransform: 'uppercase' }}>Quyết định nhập</div>
              <div style={{ fontSize: '14px', color: tokens.colors.textPrimary, lineHeight: 1.7 }}>
                {preview.duplicateRows > 0
                  ? `File có SKU trùng. Hiện có ${selectedDuplicateSkus.length}/${preview.duplicateRows} dòng trùng được chọn để replace.`
                  : 'Không có SKU trùng. Bạn có thể nhập dữ liệu ngay.'}
              </div>
            </div>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" onClick={onClose} style={S.btnOutline}>
            Đóng
          </button>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {!preview ? (
              <button
                type="button"
                onClick={onAnalyze}
                disabled={!selectedFileName || importing}
                style={{
                  ...S.btnPrimary,
                  opacity: !selectedFileName || importing ? 0.55 : 1,
                  cursor: !selectedFileName || importing ? 'not-allowed' : 'pointer',
                }}
              >
                <ImportIcon size={14} /> {importing ? 'Đang phân tích...' : 'Phân tích file'}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onImportNewOnly}
                  disabled={importing || preview.errorRows > 0}
                  style={{
                    ...S.btnOutline,
                    opacity: importing || preview.errorRows > 0 ? 0.55 : 1,
                    cursor: importing || preview.errorRows > 0 ? 'not-allowed' : 'pointer',
                  }}
                  title={preview.errorRows > 0 ? 'Cần sửa các dòng lỗi trong file trước khi nhập' : 'Chỉ tạo sản phẩm mới, bỏ qua SKU trùng'}
                >
                  Chỉ nhập sản phẩm mới
                </button>
                <button
                  type="button"
                  onClick={onReplaceDuplicates}
                  disabled={importing || preview.errorRows > 0}
                  style={{
                    ...S.btnPrimary,
                    opacity: importing || preview.errorRows > 0 ? 0.55 : 1,
                    cursor: importing || preview.errorRows > 0 ? 'not-allowed' : 'pointer',
                  }}
                  title={preview.errorRows > 0 ? 'Cần sửa các dòng lỗi trong file trước khi nhập' : 'Ghi đè toàn bộ sản phẩm trùng SKU bằng dữ liệu trong file'}
                >
                  <ImportIcon size={14} /> {importing ? 'Đang import...' : (preview.duplicateRows > 0 ? 'Nhập với các dòng đã chọn để replace' : 'Nhập dữ liệu')}
                </button>
              </>
            )}
          </div>
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
        />
      )}
      {importReport && <ProductImportReportModal report={importReport} onClose={() => setImportReport(null)} />}
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
                              src={resolveAssetUrl(img.url)}
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
