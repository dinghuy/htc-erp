export type ProjectActivityStreamItem = {
  id: string;
  source: string;
  title: string;
  body?: string | null;
  activityType?: string | null;
  actor?: string | null;
  createdAt?: string | null;
};

export function collectProjectActivityStream(payload: any): ProjectActivityStreamItem[] {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  return items
    .map((item: any) => ({
      id: String(item?.id || ''),
      source: String(item?.source || 'activity'),
      title: String(item?.title || item?.activityType || 'Activity'),
      body: item?.body || null,
      activityType: item?.activityType || null,
      actor: item?.actor || null,
      createdAt: item?.createdAt || null,
    }))
    .filter((item: ProjectActivityStreamItem) => item.id);
}

export function countProjectActivityStreamBySource(items: ProjectActivityStreamItem[]) {
  return items.reduce((acc: Record<string, number>, item) => {
    const key = String(item.source || 'activity').toLowerCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}
