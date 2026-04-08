import {
  ERP_OUTBOX_STATUS_FILTER_ALIASES,
  buildErpOutboxPolicy,
  buildErpOutboxStats,
  mapErpOutboxRow,
} from './outboxContract';
import type { ErpOutboxListStatus } from './repository';

type CreateErpOutboxServiceDeps = {
  repository: {
    listOutboxItems: (options: { status?: string; limit: number }) => Promise<any[]>;
    getOutboxStats: () => Promise<Record<string, unknown> | null | undefined>;
  };
  getDb: () => any;
  runErpOutboxOnce: (db: any, opts?: { limit?: number }) => Promise<unknown>;
};

export function createErpOutboxService(deps: CreateErpOutboxServiceDeps) {
  const { repository, getDb, runErpOutboxOnce } = deps;

  function normalizeStatusFilter(status?: ErpOutboxListStatus | string) {
    const normalized = String(status || '').trim().toLowerCase();
    if (!normalized) return null;
    if (normalized in ERP_OUTBOX_STATUS_FILTER_ALIASES) {
      return ERP_OUTBOX_STATUS_FILTER_ALIASES[normalized as keyof typeof ERP_OUTBOX_STATUS_FILTER_ALIASES];
    }
    return normalized;
  }

  async function getOutboxPayload(options: { status?: ErpOutboxListStatus | string; limit: number }) {
    const normalizedStatus = normalizeStatusFilter(options.status);
    const [items, stats] = await Promise.all([
      repository.listOutboxItems({ ...options, status: normalizedStatus || undefined }),
      repository.getOutboxStats(),
    ]);

    return {
      items: items.map((row) => mapErpOutboxRow(row)),
      stats: buildErpOutboxStats(stats),
      query: {
        status: normalizedStatus,
        limit: options.limit,
      },
      policy: buildErpOutboxPolicy(),
    };
  }

  async function runSync(limit: number) {
    return runErpOutboxOnce(getDb(), { limit });
  }

  return {
    getOutboxPayload,
    runSync,
  };
}
