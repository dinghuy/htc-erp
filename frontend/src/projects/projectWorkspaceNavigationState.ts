import { WORKSPACE_TAB_KEYS, type ProjectWorkspaceTabKey } from '../shared/domain/contracts';

type WorkspaceNavigationFilters = {
  workspaceTab?: string;
  documentId?: string;
  openThread?: boolean;
};

export type ProjectWorkspaceNavigationState = {
  initialTab?: ProjectWorkspaceTabKey;
  focusDocumentId?: string;
  openThread: boolean;
};

function parseWorkspaceTabKey(value?: string): ProjectWorkspaceTabKey | undefined {
  if (!value) return undefined;
  return WORKSPACE_TAB_KEYS.includes(value as ProjectWorkspaceTabKey) ? (value as ProjectWorkspaceTabKey) : undefined;
}

export function buildProjectWorkspaceNavigationState(
  fallbackTab: ProjectWorkspaceTabKey | undefined,
  filters?: WorkspaceNavigationFilters,
): ProjectWorkspaceNavigationState {
  return {
    initialTab: parseWorkspaceTabKey(filters?.workspaceTab) ?? fallbackTab,
    focusDocumentId: filters?.documentId || undefined,
    openThread: Boolean(filters?.openThread),
  };
}
