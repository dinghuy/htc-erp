type DependencyItem = {
  id?: string;
  kind?: string | null;
  note?: string | null;
  context?: {
    taskName?: string | null;
  } | null;
};

type WorklogItem = {
  id?: string;
  durationMinutes?: number | null;
  summary?: string | null;
  authorUserId?: string | null;
};

type ThreadItem = {
  id?: string;
  status?: string | null;
  messageCount?: number | null;
};

type ChecklistItem = {
  id?: string;
  doneAt?: string | null;
};

export type TaskWorkHubSummary = {
  dependencyCount: number;
  blockedByCount: number;
  worklogCount: number;
  totalLoggedMinutes: number;
  latestWorklog: WorklogItem | null;
  threadId: string | null;
  threadMessageCount: number;
  hasActiveThread: boolean;
  checklistCount: number;
  checklistCompletedCount: number;
};

export function buildTaskWorkHubSummary(input: {
  dependenciesPayload?: { items?: DependencyItem[] } | null;
  worklogsPayload?: { items?: WorklogItem[] } | null;
  threadPayload?: { items?: ThreadItem[] } | null;
  checklistPayload?: { items?: ChecklistItem[] } | null;
}): TaskWorkHubSummary {
  const dependencies = Array.isArray(input.dependenciesPayload?.items) ? input.dependenciesPayload.items : [];
  const worklogs = Array.isArray(input.worklogsPayload?.items) ? input.worklogsPayload.items : [];
  const thread = Array.isArray(input.threadPayload?.items) ? input.threadPayload.items[0] || null : null;
  const checklist = Array.isArray(input.checklistPayload?.items) ? input.checklistPayload.items : [];

  return {
    dependencyCount: dependencies.length,
    blockedByCount: dependencies.filter((item) => String(item.kind || '').toLowerCase() === 'blocked_by').length,
    worklogCount: worklogs.length,
    totalLoggedMinutes: worklogs.reduce((sum, item) => sum + Number(item.durationMinutes || 0), 0),
    latestWorklog: worklogs[0] || null,
    threadId: thread?.id || null,
    threadMessageCount: Number(thread?.messageCount || 0),
    hasActiveThread: Boolean(thread?.id) && String(thread?.status || 'active').toLowerCase() === 'active',
    checklistCount: checklist.length,
    checklistCompletedCount: checklist.filter((item) => Boolean(item.doneAt)).length,
  };
}
