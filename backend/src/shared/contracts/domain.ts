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

export const ACCOUNT_TYPES = ['Customer', 'Supplier', 'Partner'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

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

export const ERP_EVENT_STATUSES = ['pending', 'sent', 'failed', 'dead-letter'] as const;
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

export type ApprovalOwnerRole = Extract<SystemRole, 'sales' | 'project_manager' | 'procurement' | 'accounting' | 'legal' | 'director'>;

export type WorkflowGuardFailure = {
  code: string;
  message: string;
};

export type WorkflowTransitionResult =
  | { ok: true }
  | { ok: false; failure: WorkflowGuardFailure };

export type AuditEventPayload = {
  entityType: 'Quotation' | 'SalesOrder' | 'Project' | 'ProjectDeliveryLine' | 'ApprovalRequest';
  entityId: string;
  action: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  gateType?: ApprovalGateType | null;
  actorUserId?: string | null;
  note?: string | null;
};

export type AuditFields = {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string | null;
  updatedBy?: string | null;
  actorUserId?: string | null;
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

export type AuthenticatedUser = {
  id: string;
  username: string;
  fullName: string;
  systemRole: SystemRole;
  roleCodes?: SystemRole[];
  baseSystemRole?: SystemRole;
  baseRoleCodes?: SystemRole[];
  previewRoleCodes?: SystemRole[];
  isRolePreviewActive?: boolean;
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
