export function parseJsonObject<T extends Record<string, any> | null>(raw: unknown, fallback: T): T {
  if (typeof raw !== 'string' || !raw.trim()) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function normalizeJsonForComparison(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeJsonForComparison);
  }

  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return Object.keys(obj)
      .filter(key => key !== 'rateSnapshot')
      .sort()
      .reduce((acc, key) => {
        acc[key] = normalizeJsonForComparison(obj[key]);
        return acc;
      }, {} as Record<string, unknown>);
  }

  return value;
}

export function stringifyNormalizedJson(value: unknown): string {
  return JSON.stringify(normalizeJsonForComparison(value));
}

function isImageAssetCandidate(url: string, mimeType: string) {
  const normalizedMime = mimeType.trim().toLowerCase();
  if (normalizedMime.startsWith('image/')) return true;
  return /\.(avif|gif|jpe?g|png|svg|webp)$/i.test(url);
}

function isVideoAssetCandidate(url: string, mimeType: string) {
  const normalizedMime = mimeType.trim().toLowerCase();
  if (normalizedMime.startsWith('video/')) return true;
  return /\.(avi|mkv|mov|mp4|mpe?g|ogv|webm)$/i.test(url);
}

function parseAssetArray(raw: unknown) {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function createProductAssetRecord(
  raw: any,
  kind: 'image' | 'video' | 'document',
  index: number,
) {
  const url = String(raw?.url ?? raw?.href ?? '').trim();
  if (!url) return null;

  const fileName = String(raw?.fileName ?? raw?.filename ?? '').trim() || url.split('/').pop() || '';
  const mimeType = String(raw?.mimeType ?? raw?.type ?? '').trim();
  const titleCandidate = String(raw?.title ?? raw?.name ?? raw?.label ?? '').trim();
  const title = titleCandidate || fileName || `${kind === 'image' ? 'Image' : kind === 'video' ? 'Video' : 'Document'} ${index + 1}`;

  return {
    id: String(raw?.id ?? `${kind}-${index + 1}`),
    title,
    url,
    ...(kind === 'image'
      ? {
          alt: String(raw?.alt ?? '').trim() || title,
          isPrimary: raw?.isPrimary === true,
        }
      : {
          description: String(raw?.description ?? raw?.summary ?? '').trim() || undefined,
          durationSeconds: Number.isFinite(Number(raw?.durationSeconds)) ? Number(raw.durationSeconds) : undefined,
          width: Number.isFinite(Number(raw?.width)) ? Number(raw.width) : undefined,
          height: Number.isFinite(Number(raw?.height)) ? Number(raw.height) : undefined,
        }),
    sourceType: raw?.sourceType === 'upload' ? 'upload' : 'url',
    fileName: fileName || undefined,
    mimeType: mimeType || undefined,
    size: Number.isFinite(Number(raw?.size)) ? Number(raw.size) : undefined,
    createdAt: String(raw?.createdAt ?? raw?.uploadedAt ?? '').trim() || undefined,
  };
}

function splitLegacyMediaAssets(raw: unknown) {
  const entries = parseAssetArray(raw);
  const productImages: Record<string, unknown>[] = [];
  const productVideos: Record<string, unknown>[] = [];
  const productDocuments: Record<string, unknown>[] = [];

  entries.forEach((entry: any, index: number) => {
    const url = String(entry?.url ?? entry?.href ?? '').trim();
    if (!url) return;
    const mimeType = String(entry?.mimeType ?? entry?.type ?? '').trim();
    const kind = isImageAssetCandidate(url, mimeType)
      ? 'image'
      : isVideoAssetCandidate(url, mimeType)
        ? 'video'
        : 'document';
    const bucket = kind === 'image' ? productImages : kind === 'video' ? productVideos : productDocuments;
    const asset = createProductAssetRecord(entry, kind, index);
    if (asset) bucket.push(asset);
  });

  return { productImages, productVideos, productDocuments };
}

export function createCrmSerializationServices() {

  function normalizeSupplierTagList(raw: unknown): string[] {
    const values = Array.isArray(raw) ? raw : String(raw ?? '').split(/[,;\n|]+/g);
    const seen = new Set<string>();
    const tags: string[] = [];
    for (const value of values) {
      const tag = String(value ?? '').trim().replace(/\s+/g, ' ');
      if (!tag) continue;
      const key = tag.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      tags.push(tag);
    }
    return tags;
  }

  function serializeSupplierTags(raw: unknown): string {
    return normalizeSupplierTagList(raw).join(', ');
  }

  function hydrateSupplier(row: any) {
    const productTags = normalizeSupplierTagList(row?.productTags ?? row?.tag);
    return { ...row, tag: productTags.join(', '), productTags };
  }

  function parseJsonArray<T = unknown>(raw: unknown, fallback: T[]): T[] {
    if (typeof raw !== 'string' || !raw.trim()) {
      return fallback;
    }

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as T[]) : fallback;
    } catch {
      return fallback;
    }
  }

  function parseProductSpecifications(raw: unknown): Record<string, unknown> {
    if (typeof raw !== 'string') {
      return {};
    }

    const value = raw.trim();
    if (!value) {
      return {};
    }

    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Legacy products may store plain text instead of JSON.
    }

    return { text: value };
  }

  function serializeProductRow(row: any) {
    const productImages = parseJsonArray(row?.productImages, []);
    const productVideos = parseJsonArray(row?.productVideos, []);
    const productDocuments = parseJsonArray(row?.productDocuments, []);
    const legacyAssets = splitLegacyMediaAssets(row?.media);

    return {
      ...row,
      specifications: parseProductSpecifications(row?.specifications),
      media: parseJsonArray(row?.media, []),
      productImages: productImages.length ? productImages : legacyAssets.productImages,
      productVideos: productVideos.length ? productVideos : legacyAssets.productVideos,
      productDocuments: productDocuments.length ? productDocuments : legacyAssets.productDocuments,
      qbuData: parseJsonObject(row?.qbuData, {}),
    };
  }

  return {
    parseJsonObject,
    stringifyNormalizedJson,
    normalizeSupplierTagList,
    serializeSupplierTags,
    hydrateSupplier,
    parseJsonArray,
    parseProductSpecifications,
    serializeProductRow,
  };
}
