import { randomUUID } from 'node:crypto';
import { getDb } from '../../../sqlite-db';

export type IdempotencyStatus = 'in_progress' | 'completed' | 'failed';

export type IdempotencyRecord = {
  id: string;
  idempotencyKey: string;
  method: string;
  routeKey: string;
  actorUserId: string | null;
  requestHash: string;
  status: IdempotencyStatus;
  responseStatus: number | null;
  responseBody: string | null;
  expiresAt: string;
};

type ClaimKeyInput = {
  idempotencyKey: string;
  method: string;
  routeKey: string;
  actorUserId?: string | null;
  requestHash: string;
  expiresAt: string;
};

type MarkCompletedInput = {
  id: string;
  responseStatus: number;
  responseBody: string;
};

function mapRow(row: any): IdempotencyRecord {
  return {
    id: String(row.id),
    idempotencyKey: String(row.idempotencyKey),
    method: String(row.method),
    routeKey: String(row.routeKey),
    actorUserId: row.actorUserId ? String(row.actorUserId) : null,
    requestHash: String(row.requestHash),
    status: String(row.status) as IdempotencyStatus,
    responseStatus: row.responseStatus === null || row.responseStatus === undefined ? null : Number(row.responseStatus),
    responseBody: row.responseBody === null || row.responseBody === undefined ? null : String(row.responseBody),
    expiresAt: String(row.expiresAt),
  };
}

export function createIdempotencyRepository() {
  async function findByScope(input: Pick<ClaimKeyInput, 'idempotencyKey' | 'method' | 'routeKey'> & { actorUserId?: string | null }) {
    const row = await getDb().get(
      `SELECT *
       FROM IdempotencyLog
       WHERE method = ? AND routeKey = ? AND actorUserId = ? AND idempotencyKey = ?
       LIMIT 1`,
      [input.method, input.routeKey, input.actorUserId || '', input.idempotencyKey],
    );
    return row ? mapRow(row) : null;
  }

  async function claimKey(input: ClaimKeyInput): Promise<{ claimed: true; record: IdempotencyRecord } | { claimed: false; record: IdempotencyRecord }> {
    const id = randomUUID();
    const result = await getDb().run(
      `INSERT OR IGNORE INTO IdempotencyLog (
        id, idempotencyKey, method, routeKey, actorUserId, requestHash, status, expiresAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, 'in_progress', ?, datetime('now'))`,
      [
        id,
        input.idempotencyKey,
        input.method,
        input.routeKey,
        input.actorUserId || '',
        input.requestHash,
        input.expiresAt,
      ],
    );
    const record = await findByScope(input);
    if (!record) {
      throw new Error('Failed to claim idempotency key');
    }
    return Number(result.changes || 0) > 0
      ? { claimed: true, record }
      : { claimed: false, record };
  }

  async function markCompleted(input: MarkCompletedInput) {
    await getDb().run(
      `UPDATE IdempotencyLog
       SET status = 'completed',
           responseStatus = ?,
           responseBody = ?,
           updatedAt = datetime('now')
       WHERE id = ?`,
      [input.responseStatus, input.responseBody, input.id],
    );
  }

  async function markFailed(id: string) {
    await getDb().run(
      `UPDATE IdempotencyLog
       SET status = 'failed',
           updatedAt = datetime('now')
       WHERE id = ?`,
      [id],
    );
  }

  async function deleteExpired(nowIso: string) {
    await getDb().run(
      `DELETE FROM IdempotencyLog
       WHERE expiresAt <= ?`,
      [nowIso],
    );
  }

  return {
    claimKey,
    markCompleted,
    markFailed,
    deleteExpired,
  };
}
