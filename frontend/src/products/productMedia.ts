type ProductMediaKind = 'images' | 'videos' | 'documents';

type ProductMediaCollections = {
  images: any[];
  videos: any[];
  documents: any[];
};

function parseAssetCollection(raw: unknown): any[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== 'string') return [];

  const trimmed = raw.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function pickProductMediaEntries(product: any, kind: ProductMediaKind): any[] {
  const directKey =
    kind === 'images' ? 'productImages' :
    kind === 'videos' ? 'productVideos' :
    'productDocuments';

  const directEntries = parseAssetCollection(product?.[directKey]);
  if (directEntries.length > 0) return directEntries;

  const media = product?.media;
  if (!media || Array.isArray(media) || typeof media !== 'object') return directEntries;

  const legacyEntries = parseAssetCollection(media[kind]);
  if (legacyEntries.length > 0) return legacyEntries;

  if (kind === 'documents') {
    return parseAssetCollection(media.files);
  }

  return directEntries;
}

export function getProductMediaCollections(product: any): ProductMediaCollections {
  return {
    images: pickProductMediaEntries(product, 'images'),
    videos: pickProductMediaEntries(product, 'videos'),
    documents: pickProductMediaEntries(product, 'documents'),
  };
}

export function getImageAssetMetaLabel(asset: {
  isPrimary?: boolean;
  sourceType?: 'url' | 'upload';
  fileName?: string;
  mimeType?: string;
  url?: string;
}) {
  if (asset.isPrimary) return 'Ảnh đại diện';
  if (asset.sourceType === 'upload') {
    return asset.fileName || asset.mimeType || 'Upload trực tiếp';
  }

  if (typeof asset.url === 'string') {
    try {
      const hostname = new URL(asset.url).hostname.replace(/^www\./i, '');
      if (hostname) return `Liên kết ${hostname}`;
    } catch {
      // Ignore invalid URLs and fall back to a generic label.
    }
  }

  return 'Liên kết URL';
}

export function getVideoAssetMetaLabel(asset: {
  fileName?: string;
  sourceType?: 'url' | 'upload';
  url?: string;
}) {
  if (asset.fileName) return asset.fileName;
  if (asset.sourceType === 'upload') return 'Upload trực tiếp';

  if (typeof asset.url === 'string') {
    try {
      const hostname = new URL(asset.url).hostname.replace(/^www\./i, '');
      if (hostname) return `Liên kết ${hostname}`;
    } catch {
      // Ignore invalid URLs and fall back to a generic label.
    }
  }

  return 'Video asset';
}

export function getDocumentAssetMetaLabel(asset: {
  fileName?: string;
  description?: string;
  sourceType?: 'url' | 'upload';
  url?: string;
}) {
  if (asset.fileName) return asset.fileName;
  if (asset.description) return asset.description;
  if (asset.sourceType === 'upload') return 'Upload trực tiếp';

  if (typeof asset.url === 'string') {
    try {
      const hostname = new URL(asset.url).hostname.replace(/^www\./i, '');
      if (hostname) return `Liên kết ${hostname}`;
    } catch {
      // Ignore invalid URLs and fall back to a generic label.
    }
  }

  return 'Tài liệu liên quan';
}
