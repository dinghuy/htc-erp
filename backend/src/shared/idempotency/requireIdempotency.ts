import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { createIdempotencyRepository } from './idempotencyRepository';

const IDEMPOTENCY_HEADER = 'x-idempotency-key';
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

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
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(String(value));
}

function sha256(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function getIdempotencyKey(req: Request) {
  const value = req.headers[IDEMPOTENCY_HEADER];
  if (Array.isArray(value)) return value[0]?.trim() || '';
  return typeof value === 'string' ? value.trim() : '';
}

function getActorUserId(req: Request) {
  const user = (req as any).user;
  const id = user?.id ?? user?.userId ?? null;
  return id === null || id === undefined ? null : String(id);
}

function buildRequestHash(req: Request) {
  return sha256(stableStringify(req.body ?? null));
}

export function withRequiredIdempotency(
  routeKey: string,
  handler: (req: Request, res: Response) => Promise<unknown>,
) {
  return async (req: Request, res: Response) => {
    const idempotencyKey = getIdempotencyKey(req);

    // Compatibility mode for legacy callers during the rollout. Frontend action
    // boundaries add keys for protected user mutations in the same plan.
    if (!idempotencyKey) {
      return handler(req, res);
    }

    const repository = createIdempotencyRepository();
    const now = new Date();
    await repository.deleteExpired(now.toISOString());

    const requestHash = buildRequestHash(req);
    const claim = await repository.claimKey({
      idempotencyKey,
      method: req.method.toUpperCase(),
      routeKey,
      actorUserId: getActorUserId(req),
      requestHash,
      expiresAt: new Date(now.getTime() + IDEMPOTENCY_TTL_MS).toISOString(),
    });

    if (!claim.claimed) {
      const { record } = claim;
      if (record.requestHash !== requestHash) {
        return res.status(409).json({
          error: 'Idempotency key was already used with a different request payload',
          code: 'IDEMPOTENCY_KEY_REUSED',
        });
      }
      if (record.status === 'completed') {
        return res
          .status(record.responseStatus || 200)
          .type('application/json')
          .send(record.responseBody || '{}');
      }
      return res.status(409).json({
        error: 'Idempotency key is already being processed',
        code: 'IDEMPOTENCY_IN_PROGRESS',
      });
    }

    const originalStatus = res.status.bind(res);
    const originalJson = res.json.bind(res);
    let responseStatus = res.statusCode || 200;
    let responseBody = '';

    res.status = ((statusCode: number) => {
      responseStatus = statusCode;
      return originalStatus(statusCode);
    }) as Response['status'];

    res.json = ((body: unknown) => {
      responseStatus = res.statusCode || responseStatus || 200;
      responseBody = JSON.stringify(body ?? null);
      return originalJson(body);
    }) as Response['json'];

    try {
      const result = await handler(req, res);
      if (responseBody && responseStatus >= 200 && responseStatus < 300) {
        await repository.markCompleted({
          id: claim.record.id,
          responseStatus,
          responseBody,
        });
      } else {
        await repository.markFailed(claim.record.id);
      }
      return result;
    } catch (error) {
      await repository.markFailed(claim.record.id);
      throw error;
    }
  };
}
