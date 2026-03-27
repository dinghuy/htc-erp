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
    return {
      ...row,
      specifications: parseProductSpecifications(row?.specifications),
      media: parseJsonArray(row?.media, []),
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
