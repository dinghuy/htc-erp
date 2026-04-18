import { API_BASE } from '../config';
import { tokens } from '../ui/tokens';
import { ui } from '../ui/styles';
import { OverlayModal } from '../ui/OverlayModal';
import { getProductMediaCollections } from './productMedia';
import {
  resolveAssetUrl,
  ProductAssetGallery,
  ProductVideoGallery,
  ProductDocumentWorkspace,
  type ProductImageAsset,
  type ProductDocumentAsset,
  type ProductVideoAsset,
} from './productAssetUi';
import {
  normalizeImageAssets,
  normalizeVideoAssets,
  normalizeDocumentAssets,
  getPrimaryImage,
} from './productAssetData';
import {
  DetailField,
  DetailSection,
  ProductProfileStatusPanel,
  ProductTimeline,
  formatDateTimeLabel,
  type ProductProfileStatus,
  type ProductTimelineEntry,
} from './productDetailSections';

const API = API_BASE;
const API_ORIGIN = API.replace(/\/api\/?$/, '');
const VN_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const PRODUCT_DETAIL_HERO_BG = tokens.surface.heroGradient;
const PRODUCT_DETAIL_SURFACE_BG = tokens.colors.surfaceSubtle;
const PRODUCT_DETAIL_PANEL_BG = tokens.surface.panelGradient;

const S = {
  btnPrimary: { ...ui.btn.primary, justifyContent: 'center', transition: 'all 0.2s ease' } as any,
  btnOutline: { ...ui.btn.outline, transition: 'all 0.2s ease' } as any,
};

// ---- QBU utils ----

type QbuWarning = {
  key: string;
  label: string;
  style: any;
};

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

export function getProductQbuWarnings(product: any, latestRate: number | null): QbuWarning[] {
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

export function QbuBadgeRow({ warnings }: { warnings: QbuWarning[] }) {
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

// ---- Document grouping helpers ----

type ProductDocumentGroup = {
  key: 'sales' | 'technical' | 'other';
  title: string;
  description: string;
  items: ProductDocumentAsset[];
};

function getDocumentSearchText(asset: ProductDocumentAsset) {
  return [asset.title, asset.description, asset.fileName, asset.mimeType, asset.url]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function getDocumentGroupKey(asset: ProductDocumentAsset): ProductDocumentGroup['key'] {
  const haystack = getDocumentSearchText(asset);
  if (/(brochure|catalog|catalogue|profile|leaflet|sale kit|sales kit|company profile)/.test(haystack)) {
    return 'sales';
  }
  if (/(datasheet|data sheet|manual|guide|instruction|hdsd|spec|specification|technical|drawing|cad)/.test(haystack)) {
    return 'technical';
  }
  return 'other';
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

function groupProductDocuments(documents: ProductDocumentAsset[]): ProductDocumentGroup[] {
  const groups: Record<ProductDocumentGroup['key'], ProductDocumentGroup> = {
    sales: { key: 'sales', title: 'Tài liệu bán hàng', description: 'Brochure, catalogue và profile để đội sales mở nhanh khi làm việc với khách.', items: [] },
    technical: { key: 'technical', title: 'Tài liệu kỹ thuật', description: 'Datasheet, manual và file thông số để tra cứu cấu hình hoặc điều kiện vận hành.', items: [] },
    other: { key: 'other', title: 'Tài liệu khác', description: 'Các file thương mại hoặc phụ trợ chưa rơi vào nhóm bán hàng hay kỹ thuật.', items: [] },
  };
  documents.forEach((document) => {
    groups[getDocumentGroupKey(document)].items.push(document);
  });
  return (['sales', 'technical', 'other'] as const)
    .map((key) => groups[key])
    .filter((group) => group.items.length > 0);
}

// ---- Profile status and timeline builders ----

export function buildProductProfileStatus({
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
    { label: 'Nhận diện', detail: `${coreReadyCount}/${coreChecks.length} trường cốt lõi đã có`, complete: coreReady },
    { label: 'Media', detail: hasHeroImage ? `${images.length} ảnh · ${videos.length} video` : 'Thiếu ảnh đại diện', complete: hasHeroImage && hasSupportingMedia },
    { label: 'Tài liệu & Specs', detail: `${documents.length} tài liệu · ${hasTechnicalSpecs ? 'có thông số kỹ thuật' : 'chưa có specs'}`, complete: hasDocuments && hasTechnicalSpecs },
    { label: 'QBU', detail: hasQbu ? `$${totalQbu.toLocaleString()} tổng giá vốn` : 'Chưa có snapshot QBU', complete: healthyQbu },
  ];

  return { score, statusLabel, statusStyle, summary, missing, pillars };
}

export function buildProductTimelineEntries({
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

  const latestImage = [...images].filter((a) => a.createdAt).sort((a, b) => new Date(String(b.createdAt)).getTime() - new Date(String(a.createdAt)).getTime())[0];
  const latestVideo = [...videos].filter((a) => a.createdAt).sort((a, b) => new Date(String(b.createdAt)).getTime() - new Date(String(a.createdAt)).getTime())[0];
  const latestDocument = [...documents].filter((a) => a.createdAt).sort((a, b) => new Date(String(b.createdAt)).getTime() - new Date(String(a.createdAt)).getTime())[0];

  pushEntry(product?.createdAt ? { key: 'created', label: 'Tạo hồ sơ sản phẩm', detail: `SKU ${product?.sku || '-'} được đưa vào master data.`, at: product.createdAt, tone: tokens.colors.info } : null);
  pushEntry(heroImage?.createdAt ? { key: 'hero', label: 'Chốt ảnh đại diện', detail: heroImage.title || 'Ảnh đại diện được gắn vào hồ sơ sản phẩm.', at: heroImage.createdAt, tone: tokens.colors.primary } : null);
  pushEntry(latestImage?.createdAt ? { key: 'image', label: 'Cập nhật thư viện hình ảnh', detail: `${images.length} hình ảnh hiện có trong gallery.`, at: latestImage.createdAt, tone: tokens.colors.primary } : null);
  pushEntry(latestVideo?.createdAt ? { key: 'video', label: 'Bổ sung video demo', detail: latestVideo.title || 'Video demo mới đã được gắn vào hồ sơ sản phẩm.', at: latestVideo.createdAt, tone: tokens.colors.info } : null);
  pushEntry(latestDocument?.createdAt ? { key: 'document', label: 'Bổ sung tài liệu', detail: latestDocument.title || 'Tài liệu mới đã được thêm vào hồ sơ sản phẩm.', at: latestDocument.createdAt, tone: tokens.colors.success } : null);
  pushEntry(product?.qbuUpdatedAt ? { key: 'qbu', label: 'Cập nhật QBU', detail: totalQbu > 0 ? `Tổng giá vốn dự kiến hiện là $${totalQbu.toLocaleString()}.` : 'Snapshot QBU đã được chạm gần đây.', at: product.qbuUpdatedAt, tone: tokens.colors.warning } : null);

  return entries
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .filter((entry, index, all) => all.findIndex((c) => c.key === entry.key && c.at === entry.at) === index)
    .slice(0, 6);
}

// ---- ProductDetailModal ----

export function ProductDetailModal({ product, onClose, latestRate, latestRateWarnings, onEdit }: {
  product: any;
  onClose: () => void;
  latestRate: number | null;
  latestRateWarnings?: string[];
  onEdit?: (product: any) => void;
}) {
  const mediaCollections = getProductMediaCollections(product);
  const productImages = normalizeImageAssets(mediaCollections.images);
  const productVideos = normalizeVideoAssets(mediaCollections.videos);
  const productDocuments = normalizeDocumentAssets(mediaCollections.documents);
  const heroImage = getPrimaryImage(productImages);
  const documentGroups = groupProductDocuments(productDocuments);
  const preferredSalesDocument = getPreferredDocument(documentGroups, ['sales', 'technical', 'other']);
  const preferredTechnicalDocument = getPreferredDocument(documentGroups, ['technical', 'sales', 'other']);
  const qbu = product.qbuData || {};
  const totalQbu = (Number(qbu.exWorks) || 0) + (Number(qbu.shipping) || 0) + (Number(qbu.importTax) || 0) + (Number(qbu.customFees) || 0) + (Number(qbu.other) || 0);
  const qbuWarnings = getProductQbuWarnings(product, latestRate);
  const showRateMissing = latestRateWarnings?.includes('RATE_MISSING');
  const profileStatus = buildProductProfileStatus({ product, heroImage, images: productImages, videos: productVideos, documents: productDocuments, totalQbu, qbuWarnings });
  const timelineEntries = buildProductTimelineEntries({ product, heroImage, images: productImages, videos: productVideos, documents: productDocuments, totalQbu });
  const createdAtLabel = formatDateTimeLabel(product?.createdAt, 'Chưa rõ thời điểm tạo');
  const qbuRateDateLabel = product.qbuRateDate ? new Date(product.qbuRateDate).toLocaleDateString('vi-VN') : 'Chưa chốt';
  const qbuUpdatedAtLabel = product.qbuUpdatedAt ? new Date(product.qbuUpdatedAt).toLocaleString('vi-VN') : 'Chưa cập nhật';
  const qbuRows = [
    { label: 'Giá xuất xưởng (Ex-works)', value: Number(qbu.exWorks || 0) },
    { label: 'Phí vận tải (Shipping)', value: Number(qbu.shipping || 0) },
    { label: 'Thuế nhập khẩu', value: Number(qbu.importTax || 0) },
    { label: 'Phí hải quan / bảo lãnh', value: Number(qbu.customFees || 0) },
    { label: 'Chi phí khác', value: Number(qbu.other || 0) },
  ];

  const resolveUrl = (url: string) => resolveAssetUrl(API_ORIGIN, url);

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
      <div style={{ display: 'grid', gap: '24px', height: '100%', minHeight: 0 }}>
        <div style={{ minHeight: 0, overflowY: 'auto', display: 'grid', gap: '24px' }}>
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
                <span style={{ ...ui.badge.neutral, background: tokens.colors.surfaceSubtle }}>{product.category || 'Chưa phân loại'}</span>
                <span style={{ ...ui.badge.neutral, background: tokens.colors.surfaceSubtle }}>Đơn vị: {product.unit || 'Chiếc'}</span>
                <span style={{ ...ui.badge.neutral, background: tokens.colors.surfaceSubtle }}>{productVideos.length} video</span>
                <span style={{ ...ui.badge.neutral, background: tokens.colors.surfaceSubtle }}>{productDocuments.length} tài liệu</span>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, lineHeight: 1.15, color: tokens.colors.textPrimary }}>{product.name}</div>
              <div style={{ fontSize: '13px', lineHeight: 1.6, color: tokens.colors.textSecondary, maxWidth: '72ch' }}>
                Hồ sơ này tổng hợp dữ liệu bán hàng tham chiếu, mô tả kỹ thuật, hình ảnh, tài liệu và cấu trúc giá vốn dự kiến để đội sales và pricing tra cứu nhanh trong quá trình báo giá.
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                {typeof onEdit === 'function' ? (
                  <button type="button" onClick={() => onEdit(product)} style={{ ...S.btnPrimary, padding: '10px 16px' }}>Chỉnh sửa sản phẩm</button>
                ) : null}
                {preferredSalesDocument ? (
                  <a href={resolveUrl(preferredSalesDocument.url)} target="_blank" rel="noreferrer" style={{ ...S.btnOutline, textDecoration: 'none', padding: '10px 16px' }}>
                    {getDocumentGroupKey(preferredSalesDocument) === 'sales' ? 'Mở brochure / catalogue' : 'Mở tài liệu đầu tiên'}
                  </a>
                ) : null}
                {preferredTechnicalDocument && preferredTechnicalDocument.url !== preferredSalesDocument?.url ? (
                  <a href={resolveUrl(preferredTechnicalDocument.url)} target="_blank" rel="noreferrer" style={{ ...S.btnOutline, textDecoration: 'none', padding: '10px 16px' }}>
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
                background: heroImage ? PRODUCT_DETAIL_SURFACE_BG : PRODUCT_DETAIL_PANEL_BG,
                minHeight: '220px',
                position: 'relative',
                display: 'grid',
              }}
            >
              {heroImage ? (
                <img src={resolveUrl(heroImage.url)} alt={heroImage.alt || heroImage.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              ) : (
                <div style={{ display: 'grid', alignContent: 'space-between', padding: '18px' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: tokens.colors.textMuted }}>
                    Asset preview
                  </div>
                  <div style={{ display: 'grid', gap: '10px' }}>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: tokens.colors.textPrimary }}>Chưa có ảnh đại diện</div>
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
                  background: heroImage ? 'rgba(2, 6, 23, 0.66)' : tokens.colors.surface,
                  border: `1px solid ${tokens.colors.border}`,
                  display: 'grid',
                  gap: '2px',
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 800, color: tokens.colors.textPrimary }}>{heroImage ? heroImage.title : 'Asset library'}</div>
                <div style={{ fontSize: '11px', color: tokens.colors.textMuted }}>
                  {productImages.length} hình ảnh khả dụng · {productVideos.length} video demo · {productDocuments.length} tài liệu liên quan
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            {[
              { label: 'Giá bán tham chiếu', value: `$${Number(product.basePrice || 0).toLocaleString()}`, accent: true },
              { label: 'Danh mục', value: product.category || 'N/A', accent: false },
              { label: 'Đơn vị', value: product.unit || 'Chiếc', accent: false },
              { label: 'Tổng QBU', value: `$${totalQbu.toLocaleString()}`, accent: false },
            ].map((field) => (
              <div key={field.label} style={{ ...ui.card.base, background: PRODUCT_DETAIL_SURFACE_BG, boxShadow: 'none', padding: '14px 16px', minHeight: '108px', display: 'flex', alignItems: 'center', justifyContent: field.accent ? 'center' : undefined }}>
                <DetailField label={field.label} value={field.value} accent={field.accent} />
              </div>
            ))}
          </div>
        </section>

        <DetailSection title="Độ hoàn thiện hồ sơ" subtitle="Chấm điểm nhanh chất lượng hồ sơ sản phẩm dựa trên dữ liệu nhận diện, media, tài liệu và QBU hiện có.">
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
          <div style={{ padding: '18px', borderRadius: '16px', border: `1px solid ${tokens.colors.border}`, background: PRODUCT_DETAIL_SURFACE_BG, fontSize: '14px', lineHeight: 1.75, color: tokens.colors.textSecondary, whiteSpace: 'pre-wrap' }}>
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
            <div style={{ padding: '16px 18px', borderRadius: '16px', border: `1px solid ${tokens.colors.border}`, background: tokens.colors.warningTint, display: 'grid', gap: '10px' }}>
              <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: tokens.colors.warning }}>Cảnh báo dữ liệu</div>
              {qbuWarnings.length > 0 ? <QbuBadgeRow warnings={qbuWarnings} /> : null}
              {showRateMissing ? <div style={{ fontSize: '13px', fontWeight: 700, color: tokens.colors.warning }}>Chưa có tỷ giá VCB để đối chiếu snapshot QBU.</div> : null}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px' }}>
            {[
              { label: 'Tổng QBU dự kiến', value: `$${totalQbu.toLocaleString()}`, accent: true },
              { label: 'Ngày tỷ giá', value: qbuRateDateLabel, accent: false },
              { label: 'Cập nhật lần cuối', value: qbuUpdatedAtLabel, accent: false },
            ].map((field) => (
              <div key={field.label} style={{ ...ui.card.base, background: PRODUCT_DETAIL_SURFACE_BG, boxShadow: 'none', padding: '14px 16px' }}>
                <DetailField label={field.label} value={field.value} accent={field.accent} />
              </div>
            ))}
          </div>

          <div style={{ borderRadius: '18px', border: `1px solid ${tokens.colors.border}`, overflow: 'hidden', background: PRODUCT_DETAIL_SURFACE_BG }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', padding: '14px 18px', fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: tokens.colors.textMuted, borderBottom: `1px solid ${tokens.colors.border}` }}>
              <span>Hạng mục chi phí</span>
              <span>Giá trị</span>
            </div>
            {qbuRows.map((row) => (
              <div key={row.label} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '16px', alignItems: 'center', padding: '16px 18px', borderBottom: `1px solid ${tokens.colors.border}` }}>
                <span style={{ fontSize: '14px', color: tokens.colors.textSecondary }}>{row.label}</span>
                <span style={{ fontSize: '14px', fontWeight: 800, color: tokens.colors.textPrimary }}>${row.value.toLocaleString()}</span>
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '16px', alignItems: 'center', padding: '18px', background: tokens.colors.successTint }}>
              <span style={{ fontSize: '14px', fontWeight: 800, color: tokens.colors.textPrimary }}>Tổng giá vốn dự kiến</span>
              <span style={{ fontSize: '20px', fontWeight: 900, color: tokens.colors.primary }}>${totalQbu.toLocaleString()}</span>
            </div>
          </div>
        </DetailSection>

        <DetailSection title="Timeline cập nhật" subtitle="Các mốc dưới đây được suy luận từ thời gian tạo hồ sơ, asset timestamps và snapshot QBU hiện có.">
          <ProductTimeline entries={timelineEntries} />
        </DetailSection>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', paddingTop: '2px' }}>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {typeof onEdit === 'function' ? (
              <button type="button" onClick={() => onEdit(product)} style={{ ...S.btnOutline, padding: '10px 18px' }}>Chỉnh sửa</button>
            ) : null}
            {preferredSalesDocument ? (
              <a href={resolveUrl(preferredSalesDocument.url)} target="_blank" rel="noreferrer" style={{ ...S.btnOutline, textDecoration: 'none', padding: '10px 18px' }}>Mở tài liệu</a>
            ) : null}
          </div>
          <button onClick={onClose} style={{ ...S.btnPrimary, padding: '10px 22px', minWidth: '110px' }}>Đóng</button>
        </div>
      </div>
    </div>
    </OverlayModal>
  );
}
