import { ERP_OUTBOX_MAX_ATTEMPTS } from './outboxContract';

export type ErpOutboxListStatus =
  | 'pending'
  | 'sending'
  | 'sent'
  | 'retryable_failed'
  | 'dead_letter'
  | 'dead-letter';

type CreateErpOutboxRepositoryDeps = {
  getDb: () => any;
};

export function createErpOutboxRepository(deps: CreateErpOutboxRepositoryDeps) {
  const { getDb } = deps;

  async function listOutboxItems(options: { status?: string; limit: number }) {
    const db = getDb();
    const conditions: string[] = [];
    const params: any[] = [];

    if (options.status === 'dead_letter' || options.status === 'dead-letter') {
      conditions.push('status = ?');
      conditions.push('attempts >= ?');
      params.push('failed', ERP_OUTBOX_MAX_ATTEMPTS);
    } else if (options.status === 'retryable_failed') {
      conditions.push('status = ?');
      conditions.push('attempts < ?');
      params.push('failed', ERP_OUTBOX_MAX_ATTEMPTS);
    } else if (options.status === 'sending') {
      conditions.push('status = ?');
      params.push('processing');
    } else if (options.status === 'pending' || options.status === 'sent') {
      conditions.push('status = ?');
      params.push(options.status);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return db.all(
      `SELECT id, dedupeKey, eventType, entityType, entityId, status, attempts, lastError, nextRunAt, sentAt, createdAt, updatedAt
       FROM ErpOutbox
       ${where}
       ORDER BY createdAt DESC, id DESC
       LIMIT ?`,
      [...params, options.limit],
    );
  }

  async function getOutboxStats() {
    const db = getDb();
    return db.get(
      `SELECT
         SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
         SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) AS sending,
         SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent,
         SUM(CASE WHEN status = 'failed' AND attempts < ? THEN 1 ELSE 0 END) AS retryableFailed,
         SUM(CASE WHEN status = 'failed' AND attempts >= ? THEN 1 ELSE 0 END) AS deadLetter
       FROM ErpOutbox`,
      [ERP_OUTBOX_MAX_ATTEMPTS, ERP_OUTBOX_MAX_ATTEMPTS],
    );
  }

  return {
    listOutboxItems,
    getOutboxStats,
  };
}
