import type {
  ProductDocumentAsset,
  ProductImageAsset,
  ProductVideoAsset,
} from './productAssetUi';

export function ensureAssetTitle(title: string | undefined, fallbackUrl: string, prefix: string) {
  const trimmed = String(title ?? '').trim();
  if (trimmed) return trimmed;
  const fileName = fallbackUrl.split('/').pop();
  return fileName || prefix;
}

export function normalizePrimaryImageAssets(images: ProductImageAsset[]) {
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

export function markPrimaryImage(images: ProductImageAsset[], imageId?: string) {
  return normalizePrimaryImageAssets(
    images.map((image, index) => ({
      ...image,
      isPrimary: imageId ? image.id === imageId : index === 0,
    })),
  );
}

export function getPrimaryImage(images: ProductImageAsset[]) {
  return normalizePrimaryImageAssets(images)[0] || null;
}

export function normalizeImageAssets(raw: unknown): ProductImageAsset[] {
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

export function normalizeDocumentAssets(raw: unknown): ProductDocumentAsset[] {
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

export function normalizeVideoAssets(raw: unknown): ProductVideoAsset[] {
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
          : undefined,
    }];
  });
}
