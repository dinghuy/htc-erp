type ProductAssetKind = 'image' | 'video' | 'document';

type ExchangeRatePayload = {
  rate: number | null;
  effectiveDate: string | null;
  source: string;
  warnings?: string[];
};

export type QbuSnapshotState = {
  qbuDataStr: string;
  qbuUpdatedAt: string;
  qbuRateSource: string | null;
  qbuRateDate: string | null;
  qbuRateValue: number | null;
};

export function normalizeProductAssetArray(raw: unknown, kind: ProductAssetKind) {
  if (!Array.isArray(raw)) return [];
  let primaryAssigned = false;

  return raw.flatMap((entry: any, index: number) => {
    const url = String(entry?.url ?? entry?.href ?? '').trim();
    if (!url) return [];
    const fileName = String(entry?.fileName ?? entry?.filename ?? '').trim() || url.split('/').pop() || '';
    const title = String(entry?.title ?? entry?.name ?? entry?.label ?? '').trim()
      || fileName
      || `${kind === 'image' ? 'Image' : kind === 'video' ? 'Video' : 'Document'} ${index + 1}`;

    return [{
      id: String(entry?.id ?? `${kind}-${index + 1}`),
      title,
      url,
      ...(kind === 'image'
        ? {
            alt: String(entry?.alt ?? '').trim() || title,
            isPrimary: Boolean(entry?.isPrimary) && !primaryAssigned ? ((primaryAssigned = true), true) : false,
          }
        : {
            description: String(entry?.description ?? '').trim() || undefined,
            durationSeconds: Number.isFinite(Number(entry?.durationSeconds)) ? Number(entry.durationSeconds) : undefined,
            width: Number.isFinite(Number(entry?.width)) ? Number(entry.width) : undefined,
            height: Number.isFinite(Number(entry?.height)) ? Number(entry.height) : undefined,
          }),
      sourceType: entry?.sourceType === 'upload' ? 'upload' : 'url',
      fileName: fileName || undefined,
      mimeType: String(entry?.mimeType ?? entry?.type ?? '').trim() || undefined,
      size: Number.isFinite(Number(entry?.size)) ? Number(entry.size) : undefined,
      createdAt: String(entry?.createdAt ?? entry?.uploadedAt ?? '').trim() || undefined,
    }];
  });
}

export async function buildQbuSnapshotState(
  qbuData: Record<string, unknown>,
  getLatestExchangeRatePayload: (baseCurrency: string, quoteCurrency: string) => Promise<ExchangeRatePayload>
): Promise<QbuSnapshotState> {
  const latestRate = await getLatestExchangeRatePayload('USD', 'VND');
  const latestHasSnapshot = latestRate.warnings?.includes('RATE_MISSING') !== true
    && latestRate.rate !== null
    && latestRate.effectiveDate !== null;
  const qbuUpdatedAt = new Date().toISOString();

  if (latestHasSnapshot) {
    return {
      qbuDataStr: JSON.stringify({
        ...qbuData,
        rateSnapshot: {
          source: latestRate.source,
          date: latestRate.effectiveDate,
          rate: latestRate.rate,
        },
      }),
      qbuUpdatedAt,
      qbuRateSource: latestRate.source,
      qbuRateDate: latestRate.effectiveDate,
      qbuRateValue: latestRate.rate,
    };
  }

  return {
    qbuDataStr: JSON.stringify({
      ...qbuData,
      rateSnapshot: null,
    }),
    qbuUpdatedAt,
    qbuRateSource: null,
    qbuRateDate: null,
    qbuRateValue: null,
  };
}
