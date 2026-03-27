export const ERP_OUTBOX_MAX_ATTEMPTS = 5;
export const ERP_OUTBOX_PAYLOAD_VERSION = 'v1';

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

export function mapErpOutboxRow(row: ErpOutboxRow) {
  const attempts = Number(row.attempts || 0);
  const isDeadLetter = row.status === 'failed' && isDeadLetterAttemptCount(attempts);

  return {
    id: row.id,
    eventType: row.eventType,
    entityType: row.entityType ?? null,
    entityId: row.entityId ?? null,
    status: row.status,
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
  return {
    pending: Number(stats?.pending ?? 0),
    failed: Number(stats?.failed ?? 0),
    sent: Number(stats?.sent ?? 0),
    deadLetter: Number(stats?.deadLetter ?? 0),
  };
}
