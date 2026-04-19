import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const backendRoot = path.join(repoRoot, 'backend');
const frontendGeneratedPath = path.join(repoRoot, 'frontend', 'src', 'shared', 'domain', 'generatedContracts.ts');

const require = createRequire(import.meta.url);
process.env.TS_NODE_PROJECT = path.join(backendRoot, 'tsconfig.json');
process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: 'CommonJS',
  moduleResolution: 'Node',
});
require(path.join(backendRoot, 'node_modules', 'ts-node', 'register', 'transpile-only'));

const backendDomain = require(path.join(backendRoot, 'src', 'shared', 'contracts', 'domain.ts'));

const exportedConstNames = [
  'SYSTEM_ROLES',
  'LEGACY_ROLE_ALIASES',
  'ROLE_PRIORITY',
  'ACCOUNT_TYPES',
  'ACTION_PERMISSION_KEYS',
  'ROLE_ACTION_PERMISSIONS',
  'QUOTATION_STATUSES',
  'PROJECT_STAGES',
  'TASK_STATUSES',
  'APPROVAL_STATUSES',
  'ERP_EVENT_STATUSES',
  'SALES_ORDER_STATUSES',
  'PROCUREMENT_LINE_STATUSES',
  'INBOUND_LINE_STATUSES',
  'DELIVERY_LINE_STATUSES',
  'APPROVAL_GATE_TYPES',
  'APPROVAL_DECISIONS',
  'WORKSPACE_TAB_KEYS',
  'APPROVAL_LANES',
  'TASK_DEPENDENCY_KINDS',
  'THREAD_STATUSES',
  'DOCUMENT_REVIEW_STATUSES',
];

function serializeConst(name, value) {
  return `export const ${name} = ${JSON.stringify(value, null, 2)} as const;`;
}

const constBlocks = exportedConstNames
  .map((name) => serializeConst(name, backendDomain[name]))
  .join('\n\n');

const typeBlocks = `
export type SystemRole = (typeof SYSTEM_ROLES)[number];
export type AccountType = (typeof ACCOUNT_TYPES)[number];
export type ActionPermissionKey = (typeof ACTION_PERMISSION_KEYS)[number];
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];
export type ProjectStage = (typeof PROJECT_STAGES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];
export type ErpEventStatus = (typeof ERP_EVENT_STATUSES)[number];
export type SalesOrderStatus = (typeof SALES_ORDER_STATUSES)[number];
export type ProcurementLineStatus = (typeof PROCUREMENT_LINE_STATUSES)[number];
export type InboundLineStatus = (typeof INBOUND_LINE_STATUSES)[number];
export type DeliveryLineStatus = (typeof DELIVERY_LINE_STATUSES)[number];
export type ApprovalGateType = (typeof APPROVAL_GATE_TYPES)[number];
export type ApprovalDecision = (typeof APPROVAL_DECISIONS)[number];
export type ProjectWorkspaceTabKey = (typeof WORKSPACE_TAB_KEYS)[number];
export type ApprovalLane = (typeof APPROVAL_LANES)[number];
export type TaskDependencyKind = (typeof TASK_DEPENDENCY_KINDS)[number];
export type ThreadStatus = (typeof THREAD_STATUSES)[number];
export type DocumentReviewStatus = (typeof DOCUMENT_REVIEW_STATUSES)[number];
export type ApprovalOwnerRole = Extract<SystemRole, 'sales' | 'project_manager' | 'procurement' | 'accounting' | 'legal' | 'director'>;

export type WorkflowGuardFailure = {
  code: string;
  message: string;
};

export type WorkflowTransitionResult =
  | { ok: true }
  | { ok: false; failure: WorkflowGuardFailure };

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

export type TaskContextRef = {
  entityType: 'Lead' | 'Account' | 'Contact' | 'Quotation' | 'Project' | 'Task' | 'ApprovalRequest' | 'SupportTicket' | 'Milestone';
  entityId: string;
  label?: string | null;
  href?: string | null;
};

export type ProjectActivityItem = AuditFields & {
  projectId: string;
  entityType: string;
  entityId: string;
  activityType: string;
  title: string;
  body?: string | null;
  link?: string | null;
  taskId?: string | null;
  approvalRequestId?: string | null;
};

export type TaskDependency = AuditFields & {
  taskId: string;
  relatedTaskId: string;
  kind: TaskDependencyKind;
  note?: string | null;
};

export type WorklogEntry = AuditFields & {
  projectId: string;
  taskId?: string | null;
  authorUserId?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  durationMinutes?: number | null;
  summary: string;
};

export type ApprovalQueueItem = AuditFields & {
  approvalRequestId: string;
  lane: ApprovalLane;
  status: ApprovalStatus;
  requestType?: string | null;
  projectId?: string | null;
  taskId?: string | null;
  dueAt?: string | null;
  assigneeUserId?: string | null;
};

export type EntityThread = AuditFields & {
  entityType: string;
  entityId: string;
  title?: string | null;
  status: ThreadStatus;
  messageCount?: number;
  lastMessageAt?: string | null;
};

export type ThreadMessage = AuditFields & {
  threadId: string;
  authorUserId?: string | null;
  content: string;
  contentType?: 'text/plain' | 'text/markdown';
};

export type ProjectDocument = AuditFields & {
  projectId: string;
  title: string;
  status: DocumentReviewStatus;
  storageKey?: string | null;
  threadId?: string | null;
};

export type DocumentReviewState = {
  status: DocumentReviewStatus;
  reviewerUserId?: string | null;
  reviewedAt?: string | null;
  note?: string | null;
};

export type ProjectWorkspaceSummary = AuditFields & {
  projectId: string;
  quotationId?: string | null;
  accountId?: string | null;
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

export type ErpOutboxEventContract = {
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
`.trim();

const fileContent = `// This file is generated by scripts/sync-shared-contracts.mjs.
// Do not edit it by hand. Update backend/src/shared/contracts/domain.ts instead.

${constBlocks}

${typeBlocks}
`;

mkdirSync(path.dirname(frontendGeneratedPath), { recursive: true });
writeFileSync(frontendGeneratedPath, `${fileContent.trim()}\n`, 'utf8');

console.log(`Synced shared contracts to ${path.relative(repoRoot, frontendGeneratedPath)}`);
