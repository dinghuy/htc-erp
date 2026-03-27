function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function routeSelector(route) {
  return `[data-testid="route-${slugify(route)}"]`;
}

export function navItemSelector(route) {
  return `[data-testid="nav-item-${slugify(route)}"]`;
}

export function previewPresetSelector(key) {
  return `[data-testid="role-preview-preset-${slugify(key)}"]`;
}

export function projectCardSelector(projectId) {
  return `[data-testid="project-card-${slugify(projectId)}"]`;
}

export function projectWorkspaceButtonSelector(projectId) {
  return `[data-testid="project-open-workspace-${slugify(projectId)}"]`;
}

export function approvalLaneButtonSelector(lane) {
  return `[data-testid="approval-lane-${slugify(lane)}"]`;
}

export function approvalCardSelector(approvalId) {
  return `[data-testid="approval-card-${slugify(approvalId)}"]`;
}

export function approvalActionButtonSelector(approvalId, action) {
  return `[data-testid="approval-${action}-${slugify(approvalId)}"]`;
}

export function workspaceTabSelector(tabKey) {
  return `[data-testid="workspace-tab-${slugify(tabKey)}"]`;
}

export const selectors = {
  login: {
    shell: '[data-testid="login-shell"]',
    username: '[data-testid="login-username"]',
    password: '[data-testid="login-password"]',
    submit: '[data-testid="login-submit"]',
    error: '[data-testid="login-error"]',
  },
  layout: {
    sidebar: '[data-testid="app-sidebar"]',
    searchInput: '[data-testid="global-search-input"]',
    previewBanner: '[data-testid="role-preview-banner"]',
    previewOpenSettings: '[data-testid="role-preview-open-settings"]',
    previewBackToAdmin: '[data-testid="role-preview-back-to-admin"]',
  },
  settings: {
    previewPanel: '[data-testid="settings-role-preview-panel"]',
    previewApply: '[data-testid="settings-role-preview-apply"]',
    previewReset: '[data-testid="settings-role-preview-reset"]',
    previewOpenWorkspace: '[data-testid="settings-role-preview-open-workspace"]',
    checklist: '[data-testid="settings-role-preview-checklist"]',
    qaSessionLog: '[data-testid="settings-role-preview-session-log"]',
  },
  myWork: {
    focusBadge: '[data-testid="my-work-focus-badge"]',
    tasksSection: '[data-testid="my-work-tasks-section"]',
    approvalsSection: '[data-testid="my-work-approvals-section"]',
  },
  inbox: {
    focusBadge: '[data-testid="inbox-department-focus-badge"]',
    itemsSection: '[data-testid="inbox-items-section"]',
  },
  approvals: {
    focusBadge: '[data-testid="approvals-lane-focus-badge"]',
    listSection: '[data-testid="approvals-list-section"]',
  },
  projects: {
    list: '[data-testid="projects-list"]',
  },
  workspace: {
    modal: '[data-testid="project-workspace-modal"]',
    previewNotice: '[data-testid="project-workspace-preview-notice"]',
    close: '[data-testid="project-workspace-close"]',
  },
};
