export const SYSTEM_ROLES = [
  'admin',
  'sales',
  'project_manager',
  'procurement',
  'accounting',
  'legal',
  'director',
  'manager',
  'viewer',
] as const;
export type SystemRole = (typeof SYSTEM_ROLES)[number];

export const LEGACY_ROLE_ALIASES = {
  manager: 'project_manager',
} as const satisfies Partial<Record<SystemRole, SystemRole>>;

export const ROLE_PRIORITY = [
  'admin',
  'project_manager',
  'sales',
  'procurement',
  'accounting',
  'legal',
  'director',
  'viewer',
] as const satisfies readonly SystemRole[];

export const ACCOUNT_TYPES = ['Customer', 'Supplier', 'Partner'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACTION_PERMISSION_KEYS = [
  'manage_users',
  'manage_settings',
  'view_all_projects',
  'edit_project_shell',
  'edit_commercial',
  'edit_execution',
  'edit_procurement',
  'approve_finance',
  'approve_legal',
  'approve_executive',
  'review_documents',
] as const;
export type ActionPermissionKey = (typeof ACTION_PERMISSION_KEYS)[number];

export const ROLE_ACTION_PERMISSIONS = {
  admin: ['manage_users', 'manage_settings', 'view_all_projects', 'edit_project_shell', 'edit_commercial', 'edit_execution', 'edit_procurement', 'review_documents'],
  sales: ['edit_commercial', 'review_documents'],
  project_manager: ['edit_project_shell', 'edit_commercial', 'edit_execution', 'review_documents'],
  procurement: ['edit_procurement', 'review_documents'],
  accounting: ['approve_finance', 'review_documents'],
  legal: ['approve_legal', 'review_documents'],
  director: ['view_all_projects', 'approve_executive', 'review_documents'],
  manager: ['edit_project_shell', 'edit_execution', 'review_documents'],
  viewer: [],
} as const satisfies Record<SystemRole, readonly ActionPermissionKey[]>;

export const QUOTATION_STATUSES = [
  'draft',
  'submitted_for_approval',
  'revision_required',
  'approved',
  'rejected',
  'won',
  'lost',
] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

export const PROJECT_STAGES = [
  'new',
  'quoting',
  'negotiating',
  'internal-review',
  'commercial_approved',
  'won',
  'lost',
  'order_released',
  'procurement_active',
  'delivery_active',
  'delivery',
  'delivery_completed',
  'closed',
] as const;
export type ProjectStage = (typeof PROJECT_STAGES)[number];

export const TASK_STATUSES = ['pending', 'active', 'completed', 'paused', 'cancelled'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const APPROVAL_STATUSES = ['pending', 'approved', 'rejected', 'changes_requested', 'cancelled'] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const ERP_EVENT_STATUSES = ['pending', 'sending', 'sent', 'retryable_failed', 'dead_letter'] as const;
export type ErpEventStatus = (typeof ERP_EVENT_STATUSES)[number];

export const SALES_ORDER_STATUSES = ['draft', 'released', 'locked_for_execution', 'cancelled'] as const;
export type SalesOrderStatus = (typeof SALES_ORDER_STATUSES)[number];

export const PROCUREMENT_LINE_STATUSES = ['planned', 'ordered', 'partially_received', 'received', 'cancelled'] as const;
export type ProcurementLineStatus = (typeof PROCUREMENT_LINE_STATUSES)[number];

export const INBOUND_LINE_STATUSES = ['pending', 'received', 'closed'] as const;
export type InboundLineStatus = (typeof INBOUND_LINE_STATUSES)[number];

export const DELIVERY_LINE_STATUSES = ['pending', 'scheduled', 'partially_delivered', 'delivered', 'blocked', 'closed'] as const;
export type DeliveryLineStatus = (typeof DELIVERY_LINE_STATUSES)[number];

export const APPROVAL_GATE_TYPES = [
  'quotation_commercial',
  'sales_order_release',
  'procurement_commitment',
  'delivery_release',
  'delivery_completion',
] as const;
export type ApprovalGateType = (typeof APPROVAL_GATE_TYPES)[number];

export const APPROVAL_DECISIONS = ['approved', 'rejected', 'changes_requested'] as const;
export type ApprovalDecision = (typeof APPROVAL_DECISIONS)[number];

export const WORKSPACE_TAB_KEYS = [
  'overview',
  'commercial',
  'procurement',
  'delivery',
  'finance',
  'legal',
  'tasks',
  'timeline',
  'documents',
] as const;
export type ProjectWorkspaceTabKey = (typeof WORKSPACE_TAB_KEYS)[number];

export const APPROVAL_LANES = [
  'commercial',
  'procurement',
  'finance',
  'legal',
  'executive',
] as const;
export type ApprovalLane = (typeof APPROVAL_LANES)[number];

export const TASK_DEPENDENCY_KINDS = ['blocks', 'blocked_by', 'relates_to'] as const;
export type TaskDependencyKind = (typeof TASK_DEPENDENCY_KINDS)[number];

export const THREAD_STATUSES = ['active', 'resolved', 'archived'] as const;
export type ThreadStatus = (typeof THREAD_STATUSES)[number];

export const DOCUMENT_REVIEW_STATUSES = ['draft', 'in_review', 'approved', 'changes_requested', 'archived'] as const;
export type DocumentReviewStatus = (typeof DOCUMENT_REVIEW_STATUSES)[number];

export type ApprovalOwnerRole = Extract<SystemRole, 'sales' | 'project_manager' | 'procurement' | 'accounting' | 'legal' | 'director'>;

export type WorkflowGuardFailure = {
  code: string;
  message: string;
};

export type WorkflowTransitionResult =
  | { ok: true }
  | { ok: false; failure: WorkflowGuardFailure };

export type EntityId = number;

export type AuditEventPayload = {
  entityType: 'Quotation' | 'SalesOrder' | 'Project' | 'ProjectDeliveryLine' | 'ApprovalRequest';
  entityId: EntityId;
  action: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  gateType?: ApprovalGateType | null;
  actorUserId?: EntityId | null;
  note?: string | null;
};

export type AuditFields = {
  id: EntityId;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: EntityId | null;
  updatedBy?: EntityId | null;
  actorUserId?: EntityId | null;
  actorRoles?: string | null;
  actingCapability?: string | null;
  action?: string | null;
  timestamp?: string | null;
};

export type Pagination = {
  page?: number;
  pageSize?: number;
};

export type FilterQuery = Pagination & {
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};

export type ApiError = {
  error: string;
  code?: string;
  details?: unknown;
};

export type TaskContextRef = {
  entityType: 'Lead' | 'Account' | 'Contact' | 'Quotation' | 'Project' | 'Task' | 'ApprovalRequest' | 'SupportTicket' | 'Milestone';
  entityId: EntityId;
  label?: string | null;
  href?: string | null;
};

export type ProjectActivityItem = AuditFields & {
  projectId: EntityId;
  entityType: string;
  entityId: EntityId;
  activityType: string;
  title: string;
  body?: string | null;
  link?: string | null;
  taskId?: EntityId | null;
  approvalRequestId?: EntityId | null;
};

export type TaskDependency = AuditFields & {
  taskId: EntityId;
  relatedTaskId: EntityId;
  kind: TaskDependencyKind;
  note?: string | null;
};

export type WorklogEntry = AuditFields & {
  projectId: EntityId;
  taskId?: EntityId | null;
  authorUserId?: EntityId | null;
  startedAt?: string | null;
  endedAt?: string | null;
  durationMinutes?: number | null;
  summary: string;
};

export type ApprovalQueueItem = AuditFields & {
  approvalRequestId: EntityId;
  lane: ApprovalLane;
  status: ApprovalStatus;
  requestType?: string | null;
  projectId?: EntityId | null;
  taskId?: EntityId | null;
  dueAt?: string | null;
  assigneeUserId?: EntityId | null;
};

export type EntityThread = AuditFields & {
  entityType: string;
  entityId: EntityId;
  title?: string | null;
  status: ThreadStatus;
  messageCount?: number;
  lastMessageAt?: string | null;
};

export type ThreadMessage = AuditFields & {
  threadId: EntityId;
  authorUserId?: EntityId | null;
  content: string;
  contentType?: 'text/plain' | 'text/markdown';
};

export type ProjectDocument = AuditFields & {
  projectId: EntityId;
  title: string;
  status: DocumentReviewStatus;
  storageKey?: string | null;
  threadId?: EntityId | null;
};

export type DocumentReviewState = {
  status: DocumentReviewStatus;
  reviewerUserId?: EntityId | null;
  reviewedAt?: string | null;
  note?: string | null;
};

export type ProjectWorkspaceSummary = AuditFields & {
  projectId: EntityId;
  quotationId?: EntityId | null;
  accountId?: EntityId | null;
  projectStage?: ProjectStage | string | null;
  activeTab?: ProjectWorkspaceTabKey | null;
  taskSummary?: {
    total: number;
    active: number;
    blocked: number;
    overdue: number;
  };
  approvalSummary?: {
    pending: number;
    byLane?: Partial<Record<ApprovalLane, number>>;
  };
  milestoneSummary?: {
    total: number;
    completed: number;
    overdue: number;
  };
  recentActivities?: ProjectActivityItem[];
};

export type AuthenticatedUser = {
  id: EntityId;
  username: string;
  fullName: string;
  systemRole: SystemRole;
  roleCodes?: SystemRole[];
  email?: string;
  mustChangePassword?: boolean;
};

export type ErpOutboxEventContract = AuditFields & {
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payloadVersion: string;
  idempotencyKey: string;
  status: ErpEventStatus;
  retryCount: number;
  sentAt?: string | null;
  lastError?: string | null;
};
