type ThreadIndexPayload = {
  items?: Array<{
    id?: string;
    entityId?: string | null;
    messageCount?: number | null;
  }>;
};

export function buildThreadCountIndex(payload?: ThreadIndexPayload | null) {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  return items.reduce<Record<string, { threadId: string | null; messageCount: number }>>((acc, item) => {
    const entityId = String(item.entityId || '').trim();
    if (!entityId) return acc;
    acc[entityId] = {
      threadId: item.id ? String(item.id) : null,
      messageCount: Number(item.messageCount || 0),
    };
    return acc;
  }, {});
}
