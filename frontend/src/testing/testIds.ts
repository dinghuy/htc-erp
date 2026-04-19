import type { ProjectWorkspaceTabKey } from '../shared/domain/contracts';

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function routeTestId(route: string) {
  return `route-${slugify(route)}`;
}

export function navItemTestId(route: string) {
  return `nav-item-${slugify(route)}`;
}

export function previewPresetTestId(presetKey: string) {
  return `role-preview-preset-${slugify(presetKey)}`;
}

export function settingsPreviewPresetTestId(presetKey: string) {
  return `settings-role-preview-preset-${slugify(presetKey)}`;
}

export function projectCardTestId(projectId: number | string) {
  return `project-card-${slugify(String(projectId))}`;
}

export function projectWorkspaceButtonTestId(projectId: number | string) {
  return `project-open-workspace-${slugify(String(projectId))}`;
}

export function projectDetailsButtonTestId(projectId: number | string) {
  return `project-open-details-${slugify(String(projectId))}`;
}

export function approvalLaneButtonTestId(lane: string) {
  return `approval-lane-${slugify(lane)}`;
}

export function approvalCardTestId(approvalId: number | string) {
  return `approval-card-${slugify(String(approvalId))}`;
}

export function approvalActionButtonTestId(approvalId: number | string, action: 'approve' | 'reject' | 'changes_requested') {
  return `approval-${action}-${slugify(String(approvalId))}`;
}

export function workspaceTabTestId(tabKey: ProjectWorkspaceTabKey) {
  return `workspace-tab-${tabKey}`;
}

export const QA_TEST_IDS = {
  appContent: 'app-route-content',
  login: {
    shell: 'login-shell',
    locale: 'login-locale',
    username: 'login-username',
    password: 'login-password',
    submit: 'login-submit',
    error: 'login-error',
  },
  layout: {
    searchInput: 'global-search-input',
    sidebar: 'app-sidebar',
    topTabs: 'app-top-tabs',
  },
  settings: {
    laneNav: 'settings-lane-nav',
  },
  myWork: {
    focusBadge: 'my-work-focus-badge',
    tasksSection: 'my-work-tasks-section',
    approvalsSection: 'my-work-approvals-section',
  },
  inbox: {
    focusBadge: 'inbox-department-focus-badge',
    itemsSection: 'inbox-items-section',
  },
  approvals: {
    focusBadge: 'approvals-lane-focus-badge',
    listSection: 'approvals-list-section',
  },
  projects: {
    list: 'projects-list',
    emptyState: 'projects-empty-state',
  },
  workspace: {
    modal: 'project-workspace-modal',
    previewNotice: 'project-workspace-preview-notice',
    close: 'project-workspace-close',
  },
} as const;
