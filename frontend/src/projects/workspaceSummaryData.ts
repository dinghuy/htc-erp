type WorkspaceSummary = {
  projectId: string;
  activeTab?: string | null;
  taskSummary?: {
    total?: number;
    active?: number;
    blocked?: number;
    overdue?: number;
  };
  approvalSummary?: {
    pending?: number;
  };
  milestoneSummary?: {
    total?: number;
    completed?: number;
    overdue?: number;
  };
  recentActivities?: unknown[];
};

export function mergeWorkspaceSummary<T extends Record<string, any>>(
  workspace: T,
  summary: WorkspaceSummary | null | undefined,
): T & { workHubSummary?: WorkspaceSummary } {
  if (!summary?.projectId) return workspace;
  return {
    ...workspace,
    workHubSummary: summary,
  };
}

export function buildWorkspaceSummaryKpis(summary?: WorkspaceSummary | null) {
  if (!summary) return [];
  return [
    { label: 'Task active', value: Number(summary.taskSummary?.active || 0), accentToken: 'info' as const },
    { label: 'Task blocked', value: Number(summary.taskSummary?.blocked || 0), accentToken: 'danger' as const },
    { label: 'Approvals pending', value: Number(summary.approvalSummary?.pending || 0), accentToken: 'warning' as const },
    { label: 'Milestones overdue', value: Number(summary.milestoneSummary?.overdue || 0), accentToken: 'danger' as const },
    { label: 'Recent activity', value: Array.isArray(summary.recentActivities) ? summary.recentActivities.length : 0, accentToken: 'success' as const },
  ];
}
