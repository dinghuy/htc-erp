import { type Database } from 'sqlite';
import { normalizeGender } from '../../../gender';

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

function normalizeProductAssetRecord(raw: any, kind: 'image' | 'video' | 'document', index: number) {
  const url = String(raw?.url ?? raw?.href ?? '').trim();
  if (!url) return null;

  const fileName = String(raw?.fileName ?? raw?.filename ?? '').trim() || url.split('/').pop() || '';
  const title = String(raw?.title ?? raw?.name ?? raw?.label ?? '').trim()
    || fileName
    || `${kind === 'image' ? 'Image' : kind === 'video' ? 'Video' : 'Document'} ${index + 1}`;

  return {
    id: String(raw?.id ?? `${kind}-${index + 1}`),
    title,
    url,
    ...(kind === 'image'
      ? { alt: String(raw?.alt ?? '').trim() || title }
      : {
          description: String(raw?.description ?? raw?.summary ?? '').trim() || undefined,
          durationSeconds: Number.isFinite(Number(raw?.durationSeconds)) ? Number(raw.durationSeconds) : undefined,
          width: Number.isFinite(Number(raw?.width)) ? Number(raw.width) : undefined,
          height: Number.isFinite(Number(raw?.height)) ? Number(raw.height) : undefined,
        }),
    sourceType: raw?.sourceType === 'upload' ? 'upload' : 'url',
    fileName: fileName || undefined,
    mimeType: String(raw?.mimeType ?? raw?.type ?? '').trim() || undefined,
    size: Number.isFinite(Number(raw?.size)) ? Number(raw.size) : undefined,
    createdAt: String(raw?.createdAt ?? raw?.uploadedAt ?? '').trim() || undefined,
  };
}

function splitLegacyMediaAssets(raw: unknown) {
  if (typeof raw !== 'string' || !raw.trim()) {
    return { productImages: [], productVideos: [], productDocuments: [] };
  }

  try {
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed) ? parsed : [];
    const productImages: Record<string, unknown>[] = [];
    const productVideos: Record<string, unknown>[] = [];
    const productDocuments: Record<string, unknown>[] = [];

    items.forEach((entry: any, index: number) => {
      const url = String(entry?.url ?? entry?.href ?? '').trim();
      if (!url) return;
      const mimeType = String(entry?.mimeType ?? entry?.type ?? '').trim();
      const kind = isImageAssetCandidate(url, mimeType)
        ? 'image'
        : isVideoAssetCandidate(url, mimeType)
          ? 'video'
          : 'document';
      const normalized = normalizeProductAssetRecord(entry, kind, index);
      if (!normalized) return;
      if (kind === 'image') {
        productImages.push(normalized);
      } else if (kind === 'video') {
        productVideos.push(normalized);
      } else {
        productDocuments.push(normalized);
      }
    });

    return { productImages, productVideos, productDocuments };
  } catch {
    return { productImages: [], productVideos: [], productDocuments: [] };
  }
}

export async function finalizeSqliteSchema(db: Database) {
  const tableExists = async (table: string) => {
    const row: any = await db.get(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
      [table]
    );
    return !!row?.name;
  };

  const columnExists = async (table: string, column: string) => {
    const cols: any[] = await db.all(`PRAGMA table_info('${table}')`);
    return cols.some((c: any) => c.name === column);
  };

  const canonicalizeGenderColumn = async (table: string, idColumn: string) => {
    if (!(await tableExists(table)) || !(await columnExists(table, 'gender'))) return;

    const rows: any[] = await db.all(`SELECT ${idColumn} as id, gender FROM ${table}`);
    for (const row of rows) {
      const next = normalizeGender(row.gender);
      if (row.gender !== next) {
        await db.run(`UPDATE ${table} SET gender = ? WHERE ${idColumn} = ?`, [next, row.id]);
      }
    }
  };

  const normalizeLegacyProductStructuredFields = async () => {
    if (!(await tableExists('Product'))) return;

    const rows: any[] = await db.all('SELECT id, specifications, media, qbuData, productImages, productVideos, productDocuments FROM Product');
    for (const row of rows) {
      const updates: string[] = [];
      const params: any[] = [];

      const normalizeObjectString = (raw: unknown, fallback: Record<string, unknown>) => {
        if (typeof raw !== 'string' || !raw.trim()) {
          return JSON.stringify(fallback);
        }
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return JSON.stringify(parsed);
          }
        } catch {
          return JSON.stringify({ text: String(raw).trim() });
        }
        return JSON.stringify({ text: String(raw).trim() });
      };

      const normalizeArrayString = (raw: unknown) => {
        if (typeof raw !== 'string' || !raw.trim()) {
          return JSON.stringify([]);
        }
        try {
          const parsed = JSON.parse(raw);
          return JSON.stringify(Array.isArray(parsed) ? parsed : []);
        } catch {
          return JSON.stringify([]);
        }
      };

      const nextSpecifications = normalizeObjectString(row.specifications, {});
      const nextMedia = normalizeArrayString(row.media);
      const nextQbuData = normalizeObjectString(row.qbuData, {});
      const { productImages: legacyImages, productVideos: legacyVideos, productDocuments: legacyDocuments } = splitLegacyMediaAssets(nextMedia);
      const nextProductImages = normalizeArrayString(
        row.productImages ?? (legacyImages.length ? JSON.stringify(legacyImages) : JSON.stringify([]))
      );
      const nextProductVideos = normalizeArrayString(
        row.productVideos ?? (legacyVideos.length ? JSON.stringify(legacyVideos) : JSON.stringify([]))
      );
      const nextProductDocuments = normalizeArrayString(
        row.productDocuments ?? (legacyDocuments.length ? JSON.stringify(legacyDocuments) : JSON.stringify([]))
      );

      if ((row.specifications ?? null) !== nextSpecifications) {
        updates.push('specifications = ?');
        params.push(nextSpecifications);
      }
      if ((row.media ?? null) !== nextMedia) {
        updates.push('media = ?');
        params.push(nextMedia);
      }
      if ((row.qbuData ?? null) !== nextQbuData) {
        updates.push('qbuData = ?');
        params.push(nextQbuData);
      }
      if ((row.productImages ?? null) !== nextProductImages) {
        updates.push('productImages = ?');
        params.push(nextProductImages);
      }
      if ((row.productVideos ?? null) !== nextProductVideos) {
        updates.push('productVideos = ?');
        params.push(nextProductVideos);
      }
      if ((row.productDocuments ?? null) !== nextProductDocuments) {
        updates.push('productDocuments = ?');
        params.push(nextProductDocuments);
      }

      if (updates.length) {
        params.push(row.id);
        await db.run(`UPDATE Product SET ${updates.join(', ')} WHERE id = ?`, params);
      }
    }
  };

  // ─── INITIAL APP STATE ───
  await db.run(
    'INSERT OR IGNORE INTO SystemSetting (key, value) VALUES (?, ?)',
    ['vcb_rate_url', '']
  );
  await db.run(
    'INSERT OR IGNORE INTO SystemSetting (key, value) VALUES (?, ?)',
    ['qbu_variance_threshold_pct', '10']
  );
  await db.run(
    'INSERT OR IGNORE INTO SystemSetting (key, value) VALUES (?, ?)',
    ['qbu_variance_threshold_vnd', '20000000']
  );

  // Default Funnel seeding (Fixed: Removing hardcoded string ID for Integer ID)
  const funnelCount: any = await db.get('SELECT COUNT(*) as c FROM Funnel');
  if (funnelCount.c === 0) {
    await db.run(
      `INSERT INTO Funnel (name, description, isDefault, sortOrder)
       VALUES ('Sales Pipeline', 'Default sales funnel', 1, 0)`
    );
  }

  await db.run("UPDATE User SET language = 'vi' WHERE language IS NULL OR TRIM(language) = ''");
  await db.run("UPDATE SupportTicket SET status = 'open' WHERE status IS NULL OR TRIM(status) = ''");
  await db.run("UPDATE SupportTicket SET subject = COALESCE(NULLIF(TRIM(subject), ''), 'Support request') WHERE subject IS NULL OR TRIM(subject) = ''");
  await db.run("UPDATE SupportTicket SET updatedAt = COALESCE(updatedAt, createdAt, datetime('now')) WHERE updatedAt IS NULL OR TRIM(updatedAt) = ''");

  await canonicalizeGenderColumn('User', 'id');
  await canonicalizeGenderColumn('Contact', 'id');
  await normalizeLegacyProductStructuredFields();
}
