import { buildErpOutboxStats, mapErpOutboxRow } from './outboxContract';
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

  async function getOutboxPayload(options: { status?: ErpOutboxListStatus | string; limit: number }) {
    const [items, stats] = await Promise.all([
      repository.listOutboxItems(options),
      repository.getOutboxStats(),
    ]);

    return {
      items: items.map((row) => mapErpOutboxRow(row)),
      stats: buildErpOutboxStats(stats),
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
