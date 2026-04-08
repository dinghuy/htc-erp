import { useEffect, useState } from 'preact/hooks';
import { EmptyAssetState } from './productDetailSections';
import { getDocumentAssetMetaLabel, getVideoAssetMetaLabel } from './productMedia';
import { tokens } from '../ui/tokens';
import { ui } from '../ui/styles';

export type ProductImageAsset = {
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

export type ProductDocumentAsset = {
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

export type ProductVideoAsset = {
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
  uploadMode?: 'transcoded' | 'direct-mp4' | 'external-url';
};

type ProductDocumentGroup = {
  key: 'sales' | 'technical' | 'other';
  title: string;
  description: string;
  items: ProductDocumentAsset[];
};

const PRODUCT_DETAIL_PANEL_BG = tokens.surface.panelGradient;
const PRODUCT_DETAIL_SURFACE_BG = tokens.colors.surfaceSubtle;

export function resolveAssetUrl(apiOrigin: string, url: string) {
  if (!url) return '';
  if (/^(https?:)?\/\//i.test(url) || url.startsWith('blob:') || url.startsWith('data:')) return url;
  return `${apiOrigin}${url.startsWith('/') ? '' : '/'}${url}`;
}

export function formatAssetSize(size?: number) {
  if (!size || size <= 0) return '';
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

export function getDocumentBadge(asset: ProductDocumentAsset) {
  const mime = String(asset.mimeType || '').toLowerCase();
  const name = String(asset.fileName || asset.url || '').toLowerCase();
  if (mime.includes('pdf') || name.endsWith('.pdf')) return 'PDF';
  if (mime.includes('word') || /\.docx?$/.test(name)) return 'DOC';
  if (mime.includes('sheet') || /\.xlsx?$/.test(name)) return 'XLS';
  if (mime.includes('presentation') || /\.pptx?$/.test(name)) return 'PPT';
  return 'FILE';
}

export function formatVideoDuration(durationSeconds?: number) {
  if (!durationSeconds || durationSeconds <= 0) return '';
  const rounded = Math.round(durationSeconds);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
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

export function ProductImagePreviewCard({
  asset,
  apiOrigin,
  onClick,
  selected = false,
}: {
  asset: ProductImageAsset;
  apiOrigin: string;
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
    image.src = resolveAssetUrl(apiOrigin, asset.url);
    return () => {
      active = false;
    };
  }, [apiOrigin, asset.url]);

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
        src={resolveAssetUrl(apiOrigin, asset.url)}
        alt={asset.alt || asset.title}
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', background: tokens.colors.background, imageOrientation: 'from-image' as any }}
      />
    </Container>
  );
}

export function ProductVideoPreviewCard({ asset, height = '88px', apiOrigin }: { asset: ProductVideoAsset; height?: string; apiOrigin: string }) {
  return (
    <div style={{ borderRadius: '16px', overflow: 'hidden', border: `1px solid ${tokens.colors.border}`, background: PRODUCT_DETAIL_SURFACE_BG, display: 'grid', minWidth: 0 }}>
      <VideoPosterPreview
        src={resolveAssetUrl(apiOrigin, asset.url)}
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

export function ProductDocumentPreviewCard({ asset }: { asset: ProductDocumentAsset }) {
  return (
    <div style={{ borderRadius: '16px', overflow: 'hidden', border: `1px solid ${tokens.colors.border}`, background: PRODUCT_DETAIL_SURFACE_BG, display: 'grid', minWidth: 0 }}>
      <div style={{ height: '88px', display: 'grid', placeItems: 'center', background: tokens.colors.successTint, color: tokens.colors.primary, fontSize: '13px', fontWeight: 900, letterSpacing: '0.08em' }}>
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

export function ProductAssetGallery({ images, apiOrigin }: { images: ProductImageAsset[]; apiOrigin: string }) {
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
          <ProductImagePreviewCard key={asset.id || `${asset.url}-${index}`} asset={asset} apiOrigin={apiOrigin} selected={Boolean(asset.isPrimary)} />
        ))}
      </div>
    </div>
  );
}

export function ProductVideoGallery({ videos, apiOrigin }: { videos: ProductVideoAsset[]; apiOrigin: string }) {
  if (!videos.length) {
    return <EmptyAssetState title="Chưa có video" description="Thêm video demo, walkthrough hoặc footage vận hành để đội sales share nhanh cho đối tác." />;
  }

  return (
    <div style={{ display: 'grid', gap: '12px' }}>
      {videos.map((asset, index) => (
        <div key={asset.id || `${asset.url}-${index}`} style={{ borderRadius: '20px', border: `1px solid ${tokens.colors.border}`, background: PRODUCT_DETAIL_SURFACE_BG, overflow: 'hidden', display: 'grid', gap: '0' }}>
          <ManagedVideoPlayer src={resolveAssetUrl(apiOrigin, asset.url)} title={asset.title} style={{ width: '100%', maxHeight: '420px', background: tokens.colors.background, display: 'block' }} />
          <div style={{ padding: '14px 16px', display: 'grid', gap: '6px' }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{asset.title}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '11px', color: tokens.colors.textSecondary }}>
              <span>{asset.fileName || 'MP4 chuẩn share'}</span>
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

export function ProductDocumentList({ documents, apiOrigin, outlineButtonStyle, primaryButtonStyle }: { documents: ProductDocumentAsset[]; apiOrigin: string; outlineButtonStyle: any; primaryButtonStyle: any }) {
  if (!documents.length) {
    return <EmptyAssetState title="Chưa có tài liệu" description="Thêm brochure, datasheet hoặc file kỹ thuật để người dùng mở trực tiếp từ hồ sơ sản phẩm." />;
  }

  return (
    <div style={{ display: 'grid', gap: '10px' }}>
      {documents.map((asset, index) => (
        <div key={asset.id || `${asset.url}-${index}`} style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto', gap: '16px', alignItems: 'center', padding: '16px 18px', borderRadius: '18px', border: `1px solid ${tokens.colors.border}`, background: PRODUCT_DETAIL_PANEL_BG }}>
          <div style={{ minWidth: '50px', height: '50px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: tokens.colors.successTint, border: `1px solid ${tokens.colors.border}`, color: tokens.colors.primary, fontSize: '12px', fontWeight: 900, letterSpacing: '0.08em' }}>
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
            <a href={resolveAssetUrl(apiOrigin, asset.url)} target="_blank" rel="noreferrer" style={{ ...outlineButtonStyle, textDecoration: 'none', padding: '8px 14px', minWidth: '72px', justifyContent: 'center' }}>
              Mở
            </a>
            <a href={resolveAssetUrl(apiOrigin, asset.url)} download={asset.fileName || true} style={{ ...primaryButtonStyle, textDecoration: 'none', padding: '8px 14px', minWidth: '108px', justifyContent: 'center' }}>
              Tải xuống
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}

function getDocumentSearchText(asset: ProductDocumentAsset) {
  return [asset.title, asset.description, asset.fileName, asset.mimeType, asset.url].filter(Boolean).join(' ').toLowerCase();
}

function getDocumentGroupKey(asset: ProductDocumentAsset): ProductDocumentGroup['key'] {
  const haystack = getDocumentSearchText(asset);
  if (/(brochure|catalog|catalogue|profile|leaflet|sale kit|sales kit|company profile)/.test(haystack)) return 'sales';
  if (/(datasheet|data sheet|manual|guide|instruction|hdsd|spec|specification|technical|drawing|cad)/.test(haystack)) return 'technical';
  return 'other';
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
  return (['sales', 'technical', 'other'] as const).map((key) => groups[key]).filter((group) => group.items.length > 0);
}

export function ProductDocumentWorkspace({ documents, apiOrigin, outlineButtonStyle, primaryButtonStyle }: { documents: ProductDocumentAsset[]; apiOrigin: string; outlineButtonStyle: any; primaryButtonStyle: any }) {
  if (!documents.length) {
    return <EmptyAssetState title="Chưa có tài liệu" description="Thêm brochure, datasheet hoặc file kỹ thuật để người dùng mở trực tiếp từ hồ sơ sản phẩm." />;
  }
  const groups = groupProductDocuments(documents);
  return (
    <div style={{ display: 'grid', gap: '14px' }}>
      {groups.map((group) => (
        <div key={group.key} style={{ borderRadius: '20px', border: `1px solid ${tokens.colors.border}`, background: PRODUCT_DETAIL_PANEL_BG, padding: '16px', display: 'grid', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'start', flexWrap: 'wrap' }}>
            <div style={{ display: 'grid', gap: '6px' }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{group.title}</div>
              <div style={{ fontSize: '12px', lineHeight: 1.55, color: tokens.colors.textSecondary, maxWidth: '72ch' }}>{group.description}</div>
            </div>
            <span style={{ ...ui.badge.neutral, background: tokens.colors.surfaceSubtle }}>{group.items.length} file</span>
          </div>
          <ProductDocumentList documents={group.items} apiOrigin={apiOrigin} outlineButtonStyle={outlineButtonStyle} primaryButtonStyle={primaryButtonStyle} />
        </div>
      ))}
    </div>
  );
}
