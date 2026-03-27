import crypto from 'crypto';
import {
  ERP_OUTBOX_MAX_ATTEMPTS,
  ERP_OUTBOX_PAYLOAD_VERSION,
  isDeadLetterAttemptCount,
} from './src/modules/erp/outboxContract';

type ErpOutboxStatus = 'pending' | 'processing' | 'sent' | 'failed';

export type EnqueueErpEventInput = {
  eventType: string;
  entityType?: string | null;
  entityId?: string | null;
  payload: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (isRecord(value)) {
    const keys = Object.keys(value).sort();
    const parts = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`);
    return `{${parts.join(',')}}`;
  }
  // bigint/symbol/function should not exist in JSON payloads; fall back safely.
  return JSON.stringify(String(value));
}

function sha256Hex(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function computeDedupeKey(input: EnqueueErpEventInput) {
  // For "upsert" events we want exactly one queued item per entity,
  // always carrying the latest snapshot (overwrite pending/failed rows).
  if (String(input.eventType || '').endsWith('.upsert')) {
    return sha256Hex([input.eventType || '', input.entityType || '', input.entityId || ''].join('|'));
  }
  const base = [
    input.eventType || '',
    input.entityType || '',
    input.entityId || '',
    sha256Hex(stableStringify(input.payload)),
  ].join('|');
  return sha256Hex(base);
}

export async function enqueueErpEvent(db: any, input: EnqueueErpEventInput) {
  const eventType = String(input.eventType || '').trim();
  if (!eventType) return { enqueued: false, reason: 'eventType required' as const };

  const entityType = input.entityType ? String(input.entityType) : null;
  const entityId = input.entityId ? String(input.entityId) : null;
  const payload = stableStringify(input.payload);
  const dedupeKey = computeDedupeKey({ ...input, eventType, entityType, entityId });

  const id = crypto.randomUUID();

  // Insert once; unique(dedupeKey) ensures idempotency (even across retries and restarts).
  // For ".upsert" events, overwrite payload to keep latest snapshot in the queue.
  const isUpsert = eventType.endsWith('.upsert');
  if (isUpsert) {
    await db.run(
      `INSERT INTO ErpOutbox (id, dedupeKey, eventType, entityType, entityId, payload, status, attempts, nextRunAt, lastError, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, NULL, NULL, datetime('now'))
       ON CONFLICT(dedupeKey) DO UPDATE SET
         payload = excluded.payload,
         status = 'pending',
         nextRunAt = NULL,
         lastError = NULL,
         updatedAt = datetime('now')`,
      [id, dedupeKey, eventType, entityType, entityId, payload]
    );
  } else {
    await db.run(
      `INSERT OR IGNORE INTO ErpOutbox (id, dedupeKey, eventType, entityType, entityId, payload, status, attempts)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', 0)`,
      [id, dedupeKey, eventType, entityType, entityId, payload]
    );
  }

  const row = await db.get(`SELECT id FROM ErpOutbox WHERE dedupeKey = ?`, [dedupeKey]);
  const enqueued = row?.id === id;
  return {
    enqueued,
    id: row?.id || id,
    dedupeKey,
    idempotencyKey: dedupeKey,
    payloadVersion: ERP_OUTBOX_PAYLOAD_VERSION,
  };
}

type SendResult = { ok: true } | { ok: false; error: string };

async function handleErpEventInternal(db: any, eventType: string, payloadJson: string): Promise<SendResult> {
  const type = String(eventType || '').trim();
  let payload: any = null;
  try {
    payload = JSON.parse(payloadJson);
  } catch {
    payload = null;
  }

  // In "internal ERP" mode, some events are no-ops because the ERP reads the same DB.
  if (type === 'quotation.upsert' || type === 'quotation.status_changed' || type === 'sales_order.released' || type === 'project.delivery_completed') {
    return { ok: true };
  }

  if (type === 'sales_order.request') {
    const quotationId = String(payload?.quotationId || '').trim();
    if (!quotationId) return { ok: false, error: 'sales_order.request missing quotationId' };

    const quotation = await db.get(`SELECT * FROM Quotation WHERE id = ?`, [quotationId]);
    if (!quotation) return { ok: false, error: `Quotation not found (${quotationId})` };

    const existing = await db.get(`SELECT id FROM SalesOrder WHERE quotationId = ?`, [quotationId]);
    if (existing?.id) return { ok: true };

    const id = crypto.randomUUID();
    const orderNumber = `SO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${id.slice(0, 6).toUpperCase()}`;

    await db.run(
      `INSERT INTO SalesOrder (
        id, orderNumber, quotationId, accountId, status, currency, items, subtotal, taxTotal, grandTotal, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        orderNumber,
        quotationId,
        quotation.accountId || null,
        'draft',
        quotation.currency || 'VND',
        quotation.items || '[]',
        quotation.subtotal || 0,
        quotation.taxTotal || 0,
        quotation.grandTotal || 0,
        `Auto-created from quotation ${quotation.quoteNumber || quotationId}`,
      ]
    );

    return { ok: true };
  }

  return { ok: false, error: `Internal ERP handler: unsupported eventType (${type})` };
}

async function sendEventToErpHttp(eventType: string, payloadJson: string): Promise<SendResult> {
  if (typeof (globalThis as any).fetch !== 'function') {
    return { ok: false, error: 'ERP sync requires Node 18+ (global fetch not available)' };
  }
  const baseUrl = String(process.env.ERP_BASE_URL || '').trim();
  const apiKey = String(process.env.ERP_API_KEY || '').trim();
  const directUrl = String(process.env.ERP_EVENTS_URL || '').trim();

  const url =
    directUrl ||
    (baseUrl ? `${baseUrl.replace(/\/+$/, '')}/api/crm/events` : '');

  // If ERP isn't configured as an external service, treat it as internal module by default.
  if (!url) {
    return { ok: false, error: 'ERP is not configured (missing ERP_BASE_URL or ERP_EVENTS_URL)' };
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ eventType, payload: JSON.parse(payloadJson) }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { ok: false, error: `ERP HTTP ${res.status}: ${text || res.statusText}` };
  }

  return { ok: true };
}

function computeNextRunAt(attempts: number) {
  const capped = Math.min(Math.max(attempts, 0), 10);
  const delayMs = Math.min(30_000 * 2 ** capped, 60 * 60_000); // 30s -> 60m cap
  return new Date(Date.now() + delayMs).toISOString();
}

export async function runErpOutboxOnce(
  db: any,
  opts: { limit?: number } = {}
) {
  const limit = Math.max(1, Math.min(Number(opts.limit || 20), 200));

  const rows = await db.all(
    `SELECT *
     FROM ErpOutbox
     WHERE status IN ('pending', 'failed')
       AND (nextRunAt IS NULL OR datetime(nextRunAt) <= datetime('now'))
     ORDER BY createdAt ASC, id ASC
     LIMIT ?`,
    [limit]
  );

  let processed = 0;
  let sent = 0;
  let failed = 0;

  for (const row of rows as any[]) {
    processed += 1;

    // Best-effort "lock"
    await db.run(
      `UPDATE ErpOutbox
       SET status = 'processing', updatedAt = datetime('now')
       WHERE id = ? AND status IN ('pending', 'failed')`,
      [row.id]
    );

    const erpIsExternal = !!String(process.env.ERP_EVENTS_URL || process.env.ERP_BASE_URL || '').trim();
    const result = erpIsExternal
      ? await sendEventToErpHttp(String(row.eventType), String(row.payload))
      : await handleErpEventInternal(db, String(row.eventType), String(row.payload));
    if (result.ok) {
      sent += 1;
      await db.run(
        `UPDATE ErpOutbox
         SET status = 'sent',
             sentAt = COALESCE(sentAt, datetime('now')),
             lastError = NULL,
             nextRunAt = NULL,
             updatedAt = datetime('now')
         WHERE id = ?`,
        [row.id]
      );
      continue;
    }

    failed += 1;
    const attempts = Number(row.attempts || 0) + 1;
    const nextRunAt = isDeadLetterAttemptCount(attempts) ? null : computeNextRunAt(attempts);
    const err = (result as { ok: false; error: string }).error;
    await db.run(
      `UPDATE ErpOutbox
       SET status = 'failed',
           attempts = ?,
           lastError = ?,
           nextRunAt = ?,
           updatedAt = datetime('now')
       WHERE id = ?`,
      [attempts, String(err || 'Unknown ERP error'), nextRunAt, row.id]
    );
  }

  const counts = await db.get(
    `SELECT
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
      SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent,
      SUM(CASE WHEN status = 'failed' AND attempts >= ? THEN 1 ELSE 0 END) AS deadLetter
     FROM ErpOutbox`,
    [ERP_OUTBOX_MAX_ATTEMPTS]
  );

  return {
    processed,
    sent,
    failed,
    queue: {
      pending: Number((counts as any)?.pending ?? 0),
      failed: Number((counts as any)?.failed ?? 0),
      sent: Number((counts as any)?.sent ?? 0),
      deadLetter: Number((counts as any)?.deadLetter ?? 0),
    },
  };
}
