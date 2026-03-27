export type ExchangeRatePayload = {
  rate: number | null;
  effectiveDate: string | null;
  source: string;
  warnings?: string[];
};

type CreateVcbExchangeRateServicesDeps = {
  getDb: () => any;
  createId: () => string;
};

const VCB_BASE_CURRENCY = 'USD';
const VCB_QUOTE_CURRENCY = 'VND';
const VCB_TRANSFER_RATE_FIELD = 'Transfer';
const VCB_REFRESH_TIMEZONE = 'Asia/Ho_Chi_Minh';
const VCB_REFRESH_HOUR = 8;
const VCB_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;
const VCB_TIMEZONE_OFFSET_MINUTES = 7 * 60;

export function createVcbExchangeRateServices(deps: CreateVcbExchangeRateServicesDeps) {
  const { getDb, createId } = deps;

  let vcbRefreshTimeout: ReturnType<typeof setTimeout> | null = null;
  let vcbRefreshInterval: ReturnType<typeof setInterval> | null = null;
  let vcbRefreshInFlight = false;

  function parseExchangeRatePair(pairRaw: unknown): { baseCurrency: string; quoteCurrency: string } | null {
    const pair = typeof pairRaw === 'string' ? pairRaw.trim().toUpperCase() : '';
    if (!/^[A-Z]{6}$/.test(pair)) return null;
    return {
      baseCurrency: pair.slice(0, 3),
      quoteCurrency: pair.slice(3, 6),
    };
  }

  function parseNumericRate(raw: unknown): number | null {
    if (raw === null || raw === undefined) return null;
    const normalized = String(raw).trim().replace(/,/g, '');
    if (!normalized) return null;
    const value = Number(normalized);
    return Number.isFinite(value) ? value : null;
  }

  function formatIsoDate(input: string): string | null {
    const trimmed = input.trim();
    if (!trimmed) return null;

    const vnDate = trimmed.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})(?:\b|$)/);
    if (vnDate) {
      const [, dd, mm, yyyy] = vnDate;
      return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    }

    const isoDate = trimmed.match(/^(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})(?:\b|$)/);
    if (isoDate) {
      const [, yyyy, mm, dd] = isoDate;
      return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }

    return null;
  }

  function parseXmlAttributes(tag: string): Record<string, string> {
    const attrs: Record<string, string> = {};
    const attrRegex = /([A-Za-z_][\w:-]*)\s*=\s*["']([^"']*)["']/g;
    let match: RegExpExecArray | null;
    while ((match = attrRegex.exec(tag))) {
      attrs[match[1].toLowerCase()] = match[2];
    }
    return attrs;
  }

  function extractVcbEffectiveDate(payload: string): string | null {
    const explicitPatterns = [
      /<[^>]*\b(?:DateTime|Date|UpdatedDate|PublishDate|EffectiveDate)\b[^>]*>([^<]+)<\/[^>]+>/i,
      /<[^>]*\b(?:DateTime|Date|UpdatedDate|PublishDate|EffectiveDate)\b[^>]*=\s*["']([^"']+)["'][^>]*>/i,
    ];

    for (const pattern of explicitPatterns) {
      const match = payload.match(pattern);
      if (match?.[1]) {
        const parsed = formatIsoDate(match[1]);
        if (parsed) return parsed;
      }
    }

    const fallbackDates = [
      /(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4})/g,
      /(\d{4}-\d{2}-\d{2})/g,
    ];

    for (const pattern of fallbackDates) {
      const match = pattern.exec(payload);
      if (match?.[1]) {
        const parsed = formatIsoDate(match[1]);
        if (parsed) return parsed;
      }
    }

    return null;
  }

  function extractVcbUsdTransferRate(payload: string): number | null {
    const usdTagMatch = payload.match(/<[^>]*\b(?:CurrencyCode|Currency|Code)\s*=\s*["']USD["'][^>]*>/i);
    if (!usdTagMatch?.[0]) return null;

    const attributes = parseXmlAttributes(usdTagMatch[0]);
    const transferValue =
      attributes[VCB_TRANSFER_RATE_FIELD.toLowerCase()] ??
      attributes.transfer ??
      attributes.sell ??
      null;

    return parseNumericRate(transferValue);
  }

  async function getLatestExchangeRatePayload(baseCurrency: string, quoteCurrency: string): Promise<ExchangeRatePayload> {
    const db = getDb();
    const row = await db.get(
      `SELECT rateValue, effectiveDate, source
       FROM ExchangeRate
       WHERE baseCurrency = ? AND quoteCurrency = ?
       ORDER BY effectiveDate DESC, createdAt DESC
       LIMIT 1`,
      [baseCurrency, quoteCurrency]
    );

    if (!row) {
      return {
        rate: null,
        effectiveDate: null,
        source: 'VCB',
        warnings: ['RATE_MISSING'],
      };
    }

    return {
      rate: row.rateValue,
      effectiveDate: row.effectiveDate,
      source: row.source || 'VCB',
    };
  }

  async function refreshVcbRates(): Promise<{ payload: ExchangeRatePayload; lastKnownRateDate: string | null }> {
    const db = getDb();
    const lastKnownRow = await db.get(
      `SELECT effectiveDate
       FROM ExchangeRate
       WHERE baseCurrency = ? AND quoteCurrency = ?
       ORDER BY effectiveDate DESC, createdAt DESC
       LIMIT 1`,
      [VCB_BASE_CURRENCY, VCB_QUOTE_CURRENCY]
    );
    const lastKnownRateDate = lastKnownRow?.effectiveDate ?? null;

    const setting = await db.get('SELECT value FROM SystemSetting WHERE key = ?', ['vcb_rate_url']);
    const rateUrl = String(setting?.value || '').trim();
    if (!rateUrl) {
      const err = new Error('VCB rate URL not configured') as Error & { status?: number; lastKnownRateDate?: string | null };
      err.status = 502;
      err.lastKnownRateDate = lastKnownRateDate;
      throw err;
    }

    const controller = new AbortController();
    const timeoutMs = 15000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(rateUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          Accept: 'application/xml,text/xml,text/plain,*/*',
        },
      });

      if (!response.ok) {
        throw new Error(`VCB fetch failed with status ${response.status}`);
      }

      const payload = await response.text();
      const effectiveDate = extractVcbEffectiveDate(payload);
      const transferRate = extractVcbUsdTransferRate(payload);

      if (!effectiveDate) {
        const err = new Error('VCB payload missing effective date') as Error & { status?: number; lastKnownRateDate?: string | null };
        err.status = 502;
        err.lastKnownRateDate = lastKnownRateDate;
        throw err;
      }

      if (transferRate === null) {
        return {
          payload: {
            rate: null,
            effectiveDate: null,
            source: 'VCB',
            warnings: ['RATE_TYPE_MISSING'],
          },
          lastKnownRateDate,
        };
      }

      await db.run(
        `INSERT INTO ExchangeRate (id, baseCurrency, quoteCurrency, effectiveDate, rateValue, source)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [createId(), VCB_BASE_CURRENCY, VCB_QUOTE_CURRENCY, effectiveDate, transferRate, 'VCB']
      );

      const latest = await getLatestExchangeRatePayload(VCB_BASE_CURRENCY, VCB_QUOTE_CURRENCY);
      return {
        payload: latest,
        lastKnownRateDate: latest.effectiveDate ?? lastKnownRateDate,
      };
    } catch (err: any) {
      if (err && typeof err.status === 'number') {
        throw err;
      }

      const message = err?.name === 'AbortError'
        ? `VCB fetch timed out after ${timeoutMs}ms`
        : (err?.message || 'VCB fetch failed');

      const wrapped = new Error(message) as Error & { status?: number; lastKnownRateDate?: string | null };
      wrapped.status = 502;
      wrapped.lastKnownRateDate = lastKnownRateDate;
      throw wrapped;
    } finally {
      clearTimeout(timeout);
    }
  }

  function formatVietnamTime(date: Date): string {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: VCB_REFRESH_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).format(date);
  }

  function getNextVcbRefreshRun(reference = new Date()): Date {
    const vietnamNowMs = reference.getTime() + (VCB_TIMEZONE_OFFSET_MINUTES * 60 * 1000);
    const vietnamNow = new Date(vietnamNowMs);
    const vietnamYear = vietnamNow.getUTCFullYear();
    const vietnamMonth = vietnamNow.getUTCMonth();
    const vietnamDay = vietnamNow.getUTCDate();
    const targetVietnamMs = Date.UTC(vietnamYear, vietnamMonth, vietnamDay, VCB_REFRESH_HOUR, 0, 0, 0);
    const nextRunMs = vietnamNowMs < targetVietnamMs
      ? targetVietnamMs - (VCB_TIMEZONE_OFFSET_MINUTES * 60 * 1000)
      : targetVietnamMs + 24 * 60 * 60 * 1000 - (VCB_TIMEZONE_OFFSET_MINUTES * 60 * 1000);

    return new Date(nextRunMs);
  }

  function scheduleDailyVcbRefresh(): void {
    if (vcbRefreshTimeout) clearTimeout(vcbRefreshTimeout);
    if (vcbRefreshInterval) clearInterval(vcbRefreshInterval);

    const nextRun = getNextVcbRefreshRun();
    const delayMs = Math.max(nextRun.getTime() - Date.now(), 0);

    console.log(`[VCB] Daily refresh scheduled for ${formatVietnamTime(nextRun)} (${VCB_REFRESH_TIMEZONE})`);

    vcbRefreshTimeout = setTimeout(() => {
      const runRefresh = async (trigger: 'startup' | 'interval') => {
        if (vcbRefreshInFlight) {
          console.log(`[VCB] Refresh skipped (${trigger}) because a previous refresh is still running`);
          return;
        }

        vcbRefreshInFlight = true;
        console.log(`[VCB] Refresh started (${trigger})`);

        try {
          const result = await refreshVcbRates();
          const effectiveDate = result.payload.effectiveDate ?? 'unknown';
          console.log(`[VCB] Refresh completed (${trigger}); effective date: ${effectiveDate}`);
        } catch (err: any) {
          console.error(`[VCB] Refresh failed (${trigger}):`, err?.message || err);
        } finally {
          vcbRefreshInFlight = false;
        }
      };

      void runRefresh('startup');
      vcbRefreshInterval = setInterval(() => {
        void runRefresh('interval');
      }, VCB_REFRESH_INTERVAL_MS);
    }, delayMs);
  }

  return {
    parseExchangeRatePair,
    getLatestExchangeRatePayload,
    refreshVcbRates,
    scheduleDailyVcbRefresh,
  };
}
