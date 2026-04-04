type ThreadPayload = {
  items?: Array<{
    id?: string;
    entityType?: string | null;
    entityId?: string | null;
    status?: string | null;
    messageCount?: number | null;
  }>;
};

type MessagesPayload = {
  items?: Array<{
    id?: string;
    content?: string | null;
    authorName?: string | null;
  }>;
};

export function buildDocumentThreadSummary(input: {
  threadPayload?: ThreadPayload | null;
  messagesPayload?: MessagesPayload | null;
}) {
  const thread = Array.isArray(input.threadPayload?.items) ? input.threadPayload?.items[0] || null : null;
  const messages = Array.isArray(input.messagesPayload?.items) ? input.messagesPayload?.items : [];

  return {
    threadId: thread?.id || null,
    messageCount: Number(thread?.messageCount || messages.length || 0),
    latestMessage: messages[0] || null,
    hasActiveThread: Boolean(thread?.id) && String(thread?.status || 'active').toLowerCase() === 'active',
  };
}
