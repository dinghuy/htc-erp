export type NavEntityType = 'Task' | 'Quotation' | 'Account' | 'Lead' | 'Project';

export type NavContext = {
  route: string;
  entityType?: NavEntityType;
  entityId?: string;
  filters?: {
    projectId?: string;
    accountId?: string;
    leadId?: string;
    quotationId?: string;
    projectStage?: string;
    status?: string;
    statusGroup?: string;
    priority?: string;
    priorityGroup?: string;
    approvalLane?: string;
    department?: string;
    workFocus?: string;
    workspaceTab?: string;
    documentId?: string;
    approvalId?: string;
    openThread?: boolean;
    openRepresentative?: boolean;
    overdue?: boolean;
  };
  autoOpenEdit?: boolean;
};

const KEY = 'crm_nav_context';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeEntityType(value: unknown): NavEntityType | undefined {
  return value === 'Task' || value === 'Quotation' || value === 'Account' || value === 'Lead' || value === 'Project'
    ? value
    : undefined;
}

function normalizeString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function normalizeFilters(value: unknown): NavContext['filters'] | undefined {
  if (!isRecord(value)) return undefined;
  const projectId = normalizeString(value.projectId);
  const accountId = normalizeString(value.accountId);
  const leadId = normalizeString(value.leadId);
  const quotationId = normalizeString(value.quotationId);
  const projectStage = normalizeString(value.projectStage);
  const status = normalizeString(value.status);
  const statusGroup = normalizeString(value.statusGroup);
  const priority = normalizeString(value.priority);
  const priorityGroup = normalizeString(value.priorityGroup);
  const approvalLane = normalizeString(value.approvalLane);
  const department = normalizeString(value.department);
  const workFocus = normalizeString(value.workFocus);
  const workspaceTab = normalizeString(value.workspaceTab);
  const documentId = normalizeString(value.documentId);
  const approvalId = normalizeString(value.approvalId);
  const openThread = typeof value.openThread === 'boolean' ? value.openThread : undefined;
  const openRepresentative = typeof value.openRepresentative === 'boolean' ? value.openRepresentative : undefined;
  const overdue = typeof value.overdue === 'boolean' ? value.overdue : undefined;
  if (!projectId && !accountId && !leadId && !quotationId && !projectStage && !status && !statusGroup && !priority && !priorityGroup && !approvalLane && !department && !workFocus && !workspaceTab && !documentId && !approvalId && openThread === undefined && openRepresentative === undefined && overdue === undefined) return undefined;
  return { projectId, accountId, leadId, quotationId, projectStage, status, statusGroup, priority, priorityGroup, approvalLane, department, workFocus, workspaceTab, documentId, approvalId, openThread, openRepresentative, overdue };
}

function normalizeNavContext(raw: unknown): NavContext | null {
  if (!isRecord(raw)) return null;
  const route = normalizeString(raw.route);
  if (!route) return null;
  const entityType = normalizeEntityType(raw.entityType);
  const entityId = normalizeString(raw.entityId);
  const filters = normalizeFilters(raw.filters);
  const autoOpenEdit = typeof raw.autoOpenEdit === 'boolean' ? raw.autoOpenEdit : undefined;
  return { route, entityType, entityId, filters, autoOpenEdit };
}

export function setNavContext(ctx: NavContext) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ctx));
  } catch {
    // ignore
  }
}

export function clearNavContext() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

// Read once, then clear. Intended for page-level useEffect on mount.
export function consumeNavContext(expectedRoute?: string): NavContext | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const normalized = normalizeNavContext(JSON.parse(raw));
    if (!normalized) {
      clearNavContext();
      return null;
    }
    if (expectedRoute && normalized.route !== expectedRoute) {
      return null;
    }
    clearNavContext();
    return normalized;
  } catch {
    clearNavContext();
    return null;
  }
}
