export const ERP_OUTBOX_MAX_ATTEMPTS = 5;
export const ERP_OUTBOX_PAYLOAD_VERSION = 'v1';
export const ERP_OUTBOX_API_STATUSES = ['pending', 'sending', 'sent', 'retryable_failed', 'dead_letter'] as const;
export const ERP_OUTBOX_STATUS_FILTER_ALIASES = {
  'dead-letter': 'dead_letter',
} as const;
export type ErpOutboxApiStatus = (typeof ERP_OUTBOX_API_STATUSES)[number];

export type ErpOutboxRow = {
  id: string;
  dedupeKey: string;
  eventType: string;
  entityType?: string | null;
  entityId?: string | null;
  status: string;
  attempts?: number | null;
  lastError?: string | null;
  nextRunAt?: string | null;
  sentAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export function isDeadLetterAttemptCount(attempts: unknown) {
  return Number(attempts || 0) >= ERP_OUTBOX_MAX_ATTEMPTS;
}

export function mapErpOutboxStatus(status: unknown, attempts: unknown): ErpOutboxApiStatus {
  const normalizedStatus = String(status || '').trim().toLowerCase();
  if (normalizedStatus === 'processing') return 'sending';
  if (normalizedStatus === 'failed' && isDeadLetterAttemptCount(attempts)) return 'dead_letter';
  if (normalizedStatus === 'failed') return 'retryable_failed';
  if (ERP_OUTBOX_API_STATUSES.includes(normalizedStatus as ErpOutboxApiStatus)) {
    return normalizedStatus as ErpOutboxApiStatus;
  }
  return 'pending';
}

export function mapErpOutboxRow(row: ErpOutboxRow) {
  const attempts = Number(row.attempts || 0);
  const status = mapErpOutboxStatus(row.status, attempts);
  const isDeadLetter = status === 'dead_letter';

  return {
    id: row.id,
    eventType: row.eventType,
    aggregateType: row.entityType ?? null,
    aggregateId: row.entityId ?? null,
    entityType: row.entityType ?? null,
    entityId: row.entityId ?? null,
    status,
    retryCount: attempts,
    attempts,
    lastError: row.lastError ?? null,
    nextRunAt: row.nextRunAt ?? null,
    sentAt: row.sentAt ?? null,
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
    idempotencyKey: row.dedupeKey,
    payloadVersion: ERP_OUTBOX_PAYLOAD_VERSION,
    isDeadLetter,
  };
}

export function buildErpOutboxStats(stats: Record<string, unknown> | null | undefined) {
  const retryableFailed = Number(stats?.retryableFailed ?? 0);
  const deadLetter = Number(stats?.deadLetter ?? 0);
  return {
    pending: Number(stats?.pending ?? 0),
    sending: Number(stats?.sending ?? 0),
    sent: Number(stats?.sent ?? 0),
    retryableFailed,
    failed: retryableFailed + deadLetter,
    deadLetter,
  };
}

export function buildErpOutboxPolicy() {
  return {
    maxAttempts: ERP_OUTBOX_MAX_ATTEMPTS,
    payloadVersion: ERP_OUTBOX_PAYLOAD_VERSION,
    statuses: [...ERP_OUTBOX_API_STATUSES],
    statusFilterAliases: { ...ERP_OUTBOX_STATUS_FILTER_ALIASES },
    retrySchedule: {
      strategy: 'exponential_backoff',
      initialDelaySeconds: 30,
      maxDelaySeconds: 3600,
    },
  };
}
