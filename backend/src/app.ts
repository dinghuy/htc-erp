import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { v4 as uuidv4 } from 'uuid';
import { initDb, getDb } from '../sqlite-db';
import { VALID_STATUSES } from '../quotation-status';
import { runErpOutboxOnce } from '../erp-sync';
import { registerPricingRoutes } from '../pricing/routes';
import { handleQbuApprovalDecision } from '../pricing/workflow';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { normalizeGender } from '../gender';
import { startServer } from './bootstrap/startServer';
import { JWT_SECRET, requireAuth, requireRole } from './shared/auth/httpAuth';
import { asyncHandler } from './shared/http/asyncHandler';
import { parseLimitParam } from './shared/http/params';
import { registerPlatformRoutes } from './modules/platform/routes';
import { registerPlatformCalculatorRoutes } from './modules/platform/calculatorRoutes';
import { registerPlatformReportingRoutes } from './modules/platform/reportingRoutes';
import { registerPlatformQaRoutes } from './modules/platform/qaRoutes';
import { registerPlatformSystemRoutes } from './modules/platform/systemRoutes';
import { registerPlatformTranslationRoutes } from './modules/platform/translationRoutes';
import { registerPlatformWorkspaceRoutes } from './modules/platform/workspaceRoutes';
import { registerErpRoutes } from './modules/erp/routes';
import { registerAuthRoutes } from './modules/auth/routes';
import { registerCollaborationRoutes } from './modules/collaboration/routes';
import { registerCrmRoutes } from './modules/crm/routes';
import { registerExchangeRateRoutes } from './modules/exchange-rates/routes';
import { registerProjectContractRoutes } from './modules/projects/contractRoutes';
import { registerProjectGovernanceRoutes } from './modules/projects/governanceRoutes';
import { registerProjectLogisticsRoutes } from './modules/projects/logisticsRoutes';
import { createProjectOrchestrationServices } from './modules/projects/orchestration';
import { registerProjectReadRoutes } from './modules/projects/readRoutes';
import { registerProjectSupplierQuoteRoutes } from './modules/projects/supplierQuoteRoutes';
import { createSupplierQuote } from './modules/projects/supplierQuoteService';
import { registerProjectWorkflowRoutes } from './modules/projects/workflowRoutes';
import { createProjectWorkspaceServices } from './modules/projects/workspace';
import { registerProductRoutes } from './modules/products/routes';
import { createQuotationAutomationServices } from './modules/quotations/automation';
import { registerProjectWriteRoutes } from './modules/projects/writeRoutes';
import {
  buildRevisionLabel,
  getNextQuotationRevisionNo,
  markWinningQuotation,
  updateProjectStageFromQuotation,
} from './modules/quotations/lifecycle';
import { registerQuotationRoutes } from './modules/quotations/registerRoutes';
import { registerSalesOrderRoutes } from './modules/sales-orders/routes';
import { registerSalespersonRoutes } from './modules/salespersons/routes';
import { registerSupplierRoutes } from './modules/suppliers/routes';
import { registerSupplierQuoteRoutes } from './modules/supplier-quotes/routes';
import { createTaskServices } from './modules/tasks/service';
import { createVcbExchangeRateServices } from './shared/exchange-rate/vcb';
import { createActivityServices } from './shared/activity/service';
import { createNotificationServices } from './shared/notifications/service';
import { createCrmSerializationServices } from './shared/serialization/crm';
import { registerTaskRoutes } from './modules/tasks/routes';
import { registerUserRoutes } from './modules/users/routes';
import { createCollaborationServices } from './modules/collaboration/service';

dotenv.config();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const ah = asyncHandler;
export const app = express();
export const PORT = Number(process.env.PORT || 3001);

const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:4173')
  .split(',').map(s => s.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-role-preview'],
}));
app.use(express.json({ limit: '2mb' }));

// Compatibility bridge while the API surface migrates toward versioned routes.
app.use((req, _res, next) => {
  if (req.url === '/api/v1' || req.url.startsWith('/api/v1/')) {
    const suffix = req.url.slice('/api/v1'.length);
    req.url = `/api${suffix || ''}`;
  }
  next();
});

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Multer setup — memory storage for CSV parsing (max 5MB)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

function mapGenderRecord<T extends { gender?: unknown } | null | undefined>(row: T): T {
  if (!row || typeof row !== 'object') return row;
  return { ...row, gender: normalizeGender((row as any).gender) } as T;
}

function mapGenderRecords<T extends Array<{ gender?: unknown }>>(rows: T): T {
  return rows.map((row: any) => mapGenderRecord(row)) as T;
}

const SUPPORT_TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;
const PROJECT_STAGE_VALUES = [
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
const TASK_TEMPLATE_LIBRARY: Record<string, Array<{ name: string; taskType: string; department: string; priority: string; dueInDays: number; description: string }>> = {
  'quotation-sent': [
    {
      name: 'Follow up customer after quotation sent',
      taskType: 'follow_up',
      department: 'Sales',
      priority: 'medium',
      dueInDays: 2,
      description: 'Confirm customer received the quotation and capture first response.',
    },
    {
      name: 'Review supplier input for quotation',
      taskType: 'supplier_quote',
      department: 'Purchase',
      priority: 'medium',
      dueInDays: 3,
      description: 'Check supplier quote coverage, validity, and input assumptions for this project.',
    },
  ],
  'quotation-accepted': [
    {
      name: 'Prepare internal handoff after winning quotation',
      taskType: 'handoff',
      department: 'Operations',
      priority: 'high',
      dueInDays: 1,
      description: 'Create internal handoff checklist and align delivery/implementation scope.',
    },
    {
      name: 'Validate commercial terms before order processing',
      taskType: 'internal_review',
      department: 'Finance',
      priority: 'high',
      dueInDays: 1,
      description: 'Verify payment terms, VAT, and commercial approvals before creating sales order.',
    },
  ],
  'delivery-handoff': [
    {
      name: 'Create delivery and implementation kickoff plan',
      taskType: 'delivery_handoff',
      department: 'Operations',
      priority: 'high',
      dueInDays: 1,
      description: 'Align scope, delivery schedule, implementation owner, and internal handoff notes after project win.',
    },
    {
      name: 'Prepare warehouse issue and delivery documents',
      taskType: 'warehouse_delivery',
      department: 'Warehouse',
      priority: 'high',
      dueInDays: 2,
      description: 'Prepare PXK, delivery checklist, and stock confirmation for the winning project.',
    },
    {
      name: 'Arrange service / installation execution',
      taskType: 'service_execution',
      department: 'Technical',
      priority: 'high',
      dueInDays: 2,
      description: 'Confirm technical resources, service scope, and work report preparation for implementation.',
    },
  ],
};
const APPROVAL_TEMPLATE_LIBRARY: Record<string, Array<{ requestType: string; title: string; department: string; approverRole: string; dueInDays: number }>> = {
  'qbu-review': [
    { requestType: 'qbu-approval', title: 'QBU approval by CFO', department: 'Finance', approverRole: 'cfo', dueInDays: 1 },
    { requestType: 'qbu-approval', title: 'QBU approval by CEO', department: 'BOD', approverRole: 'ceo', dueInDays: 1 },
  ],
  'contract-review': [
    { requestType: 'contract-review', title: 'Contract review by Sales Manager', department: 'Sales', approverRole: 'manager', dueInDays: 1 },
    { requestType: 'contract-review', title: 'Contract review by Accounting', department: 'Finance', approverRole: 'manager', dueInDays: 1 },
    { requestType: 'contract-review', title: 'Contract review by CFO', department: 'Finance', approverRole: 'cfo', dueInDays: 1 },
    { requestType: 'contract-review', title: 'Contract review by QA', department: 'QA', approverRole: 'manager', dueInDays: 1 },
  ],
  'procurement-standard': [
    { requestType: 'supplier-selection', title: 'Supplier selection approval', department: 'Procurement', approverRole: 'ceo', dueInDays: 1 },
    { requestType: 'po-approval', title: 'PO / Purchase contract approval', department: 'Procurement', approverRole: 'manager', dueInDays: 1 },
  ],
};
const DOCUMENT_TEMPLATE_LIBRARY: Record<string, Array<{ documentCode: string; documentName: string; category: string; department: string; requiredAtStage: string }>> = {
  'sales-finance-procurement-warehouse': [
    { documentCode: 'QBU', documentName: 'Quotation Build-up', category: 'Sales', department: 'Sales', requiredAtStage: 'quoting' },
    { documentCode: 'BG', documentName: 'Bảng Báo Giá', category: 'Sales', department: 'Sales', requiredAtStage: 'quoting' },
    { documentCode: 'HDMB', documentName: 'Hợp Đồng Mua Bán', category: 'Contract', department: 'Sales', requiredAtStage: 'contract-review' },
    { documentCode: 'RFQ', documentName: 'Request For Quotation', category: 'Procurement', department: 'Procurement', requiredAtStage: 'procurement' },
    { documentCode: 'PO', documentName: 'Purchase Order', category: 'Procurement', department: 'Procurement', requiredAtStage: 'procurement' },
    { documentCode: 'PNK', documentName: 'Phiếu Nhập Kho', category: 'Warehouse', department: 'Warehouse', requiredAtStage: 'warehouse' },
    { documentCode: 'PXK', documentName: 'Phiếu Xuất Kho', category: 'Warehouse', department: 'Warehouse', requiredAtStage: 'delivery' },
    { documentCode: 'BBGH', documentName: 'Biên Bản Giao Hàng', category: 'Warehouse', department: 'Sales', requiredAtStage: 'delivery' },
    { documentCode: 'VAT', documentName: 'Hóa đơn VAT / quyết toán', category: 'Finance', department: 'Finance', requiredAtStage: 'closed' },
  ],
};
const WORKFLOW_PACK_LIBRARY: Record<string, { taskTemplateKeys: string[]; approvalTemplateKeys: string[]; documentTemplateKey: string; projectStage?: string }> = {
  'sales-finance-procurement-warehouse': {
    taskTemplateKeys: ['quotation-sent', 'quotation-accepted'],
    approvalTemplateKeys: ['qbu-review', 'contract-review', 'procurement-standard'],
    documentTemplateKey: 'sales-finance-procurement-warehouse',
    projectStage: 'internal-review',
  },
};

let vcbExchangeRateServicesCache: ReturnType<typeof createVcbExchangeRateServices> | null = null;

function getVcbExchangeRateServices() {
  if (!vcbExchangeRateServicesCache) {
    vcbExchangeRateServicesCache = createVcbExchangeRateServices({
      getDb,
      createId: uuidv4,
    });
  }
  return vcbExchangeRateServicesCache;
}

function parseExchangeRatePair(pairRaw: unknown) {
  return getVcbExchangeRateServices().parseExchangeRatePair(pairRaw);
}

function getLatestExchangeRatePayload(baseCurrency: string, quoteCurrency: string) {
  return getVcbExchangeRateServices().getLatestExchangeRatePayload(baseCurrency, quoteCurrency);
}

export function refreshVcbRates() {
  return getVcbExchangeRateServices().refreshVcbRates();
}

function scheduleDailyVcbRefresh(): void {
  return getVcbExchangeRateServices().scheduleDailyVcbRefresh();
}

registerPlatformRoutes(app);
registerPlatformTranslationRoutes(app, { ah });

// ─── GLOBAL AUTH GUARD: yêu cầu JWT cho mọi write request (trừ auth endpoints) ──
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/auth/')) return next();   // login/me/change-password tự xử lý
  if (req.path === '/qa/bootstrap-ux-seed') return next();
  if (req.method === 'GET' || req.method === 'OPTIONS') return next(); // reads public
  requireAuth(req, res, next);                         // POST/PUT/PATCH/DELETE cần token
});

let activityServicesCache: ReturnType<typeof createActivityServices> | null = null;

function getActivityServices() {
  if (!activityServicesCache) {
    activityServicesCache = createActivityServices({
      getDb,
      createId: uuidv4,
    });
  }
  return activityServicesCache;
}

const logAct = (...args: Parameters<ReturnType<typeof createActivityServices>['logAct']>) =>
  getActivityServices().logAct(...args);

const crmSerializationServices = createCrmSerializationServices();


registerAuthRoutes(app, { mapGenderRecord });
registerPlatformCalculatorRoutes(app, { ah });
registerPlatformQaRoutes(app, { ah, requireAuth });
registerPlatformReportingRoutes(app, { ah });
registerPlatformWorkspaceRoutes(app, { ah, requireAuth, getProjectWorkspaceById });
registerPlatformSystemRoutes(app, { ah, requireAuth, requireRole });
registerCrmRoutes(app, { ah, requireAuth, requireRole, upload, mapGenderRecord, mapGenderRecords, logAct });
registerProductRoutes(app, {
  ah,
  requireAuth,
  requireRole,
  upload,
  serializeProductRow: crmSerializationServices.serializeProductRow,
  parseJsonObject: crmSerializationServices.parseJsonObject,
  stringifyNormalizedJson: crmSerializationServices.stringifyNormalizedJson,
  getLatestExchangeRatePayload,
});
registerSupplierRoutes(app, {
  ah,
  requireAuth,
  requireRole,
  upload,
  serializeSupplierTags: crmSerializationServices.serializeSupplierTags,
  hydrateSupplier: crmSerializationServices.hydrateSupplier,
});
registerSupplierQuoteRoutes(app, {
  ah,
  createSupplierQuote,
});
registerSalespersonRoutes(app, { ah });
registerUserRoutes(app, {
  ah,
  requireAuth,
  requireRole,
  upload,
  avatarUploadDir: path.join(__dirname, 'uploads', 'avatars'),
  mapGenderRecord,
  mapGenderRecords,
});

registerExchangeRateRoutes(app, {
  ah,
  parseExchangeRatePair,
  getLatestExchangeRatePayload,
  refreshVcbRates,
});

registerQuotationRoutes(app, {
  ah,
  requireAuth,
  requireRole,
  getCurrentUserId: (req) => getCurrentUserId(req),
  autoCreateProjectForQuotation,
  getNextQuotationRevisionNo,
  buildRevisionLabel,
  updateProjectStageFromQuotation,
  markWinningQuotation,
  createProjectTasksFromTemplate,
  triggerQuotationAutomation,
  logAct,
});

registerSalesOrderRoutes(app, {
  ah,
  requireAuth,
  requireRole,
  parseLimitParam,
  createSalesOrderFromQuotation,
});

const appendDateRangeFilter = (
  conditions: string[],
  params: any[],
  column: string,
  from: unknown,
  to: unknown,
) => {
  const start = typeof from === 'string' ? from.trim() : '';
  const end = typeof to === 'string' ? to.trim() : '';

  if (start) {
    conditions.push(`${column} >= ?`);
    params.push(start);
  }
  if (end) {
    conditions.push(`${column} <= ?`);
    params.push(end);
  }
};

const getCurrentUserId = (req: Request) => String((req as any).user?.id || '');

let taskServicesCache: ReturnType<typeof createTaskServices> | null = null;

function getTaskServices() {
  if (!taskServicesCache) {
    taskServicesCache = createTaskServices();
  }
  return taskServicesCache;
}

function resolveAssigneeId(db: any, preferredAssigneeId: unknown, salesperson: unknown, fallbackUserId: string | null) {
  return getTaskServices().resolveAssigneeId(db, preferredAssigneeId, salesperson, fallbackUserId);
}

function getTaskWithLinksById(db: any, id: string) {
  return getTaskServices().getTaskWithLinksById(db, id);
}

let collaborationServicesCache: ReturnType<typeof createCollaborationServices> | null = null;

function getCollaborationServices() {
  if (!collaborationServicesCache) {
    collaborationServicesCache = createCollaborationServices({
      supportTicketStatuses: SUPPORT_TICKET_STATUSES,
    });
  }
  return collaborationServicesCache;
}

function normalizeSupportTicketStatus(value: unknown): string | null {
  return getCollaborationServices().normalizeSupportTicketStatus(value);
}

function getSupportTicketById(db: any, id: string) {
  return getCollaborationServices().getSupportTicketById(db, id);
}

function normalizeProjectStage(value: unknown, fallback = 'new') {
  const stage = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return PROJECT_STAGE_VALUES.includes(stage as any) ? stage : fallback;
}

let projectOrchestrationServicesCache: ReturnType<typeof createProjectOrchestrationServices> | null = null;

function getProjectOrchestrationServices() {
  if (!projectOrchestrationServicesCache) {
    projectOrchestrationServicesCache = createProjectOrchestrationServices({
      TASK_TEMPLATE_LIBRARY,
      APPROVAL_TEMPLATE_LIBRARY,
      DOCUMENT_TEMPLATE_LIBRARY,
      resolveAssigneeId,
      getTaskWithLinksById,
      normalizeProjectStage,
    });
  }
  return projectOrchestrationServicesCache;
}

function autoCreateProjectForQuotation(db: any, payload: any, actorUserId: string | null) {
  return getProjectOrchestrationServices().autoCreateProjectForQuotation(db, payload, actorUserId);
}

function createProjectTasksFromTemplate(
  db: any,
  params: {
    projectId: string;
    templateKey: string;
    quotation: any | null;
    actorUserId: string | null;
    requestedAssigneeId?: unknown;
  }
) {
  return getProjectOrchestrationServices().createProjectTasksFromTemplate(db, params);
}

function createApprovalRequestsFromTemplate(
  db: any,
  params: {
    projectId: string;
    templateKey: string;
    quotation: any | null;
    actorUserId: string | null;
  }
) {
  return getProjectOrchestrationServices().createApprovalRequestsFromTemplate(db, params);
}

function createProjectDocumentsFromTemplate(
  db: any,
  params: {
    projectId: string;
    templateKey: string;
    quotation: any | null;
  }
) {
  return getProjectOrchestrationServices().createProjectDocumentsFromTemplate(db, params);
}

function createSalesOrderFromQuotation(db: any, quotationId: string) {
  return getProjectOrchestrationServices().createSalesOrderFromQuotation(db, quotationId);
}

function resolveProjectHandoffQuotation(db: any, projectId: string, preferredQuotationId?: string | null) {
  return getProjectOrchestrationServices().resolveProjectHandoffQuotation(db, projectId, preferredQuotationId);
}

function projectHubText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function projectHubNumber(value: unknown, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function parseProjectHubJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

let projectWorkspaceServicesCache: ReturnType<typeof createProjectWorkspaceServices> | null = null;

function getProjectWorkspaceServices() {
  if (!projectWorkspaceServicesCache) {
    projectWorkspaceServicesCache = createProjectWorkspaceServices({
      projectHubText,
      projectHubNumber,
      parseProjectHubJson,
    });
  }
  return projectWorkspaceServicesCache;
}

function normalizeContractLineItems(items: any[] = []) {
  return getProjectWorkspaceServices().normalizeContractLineItems(items);
}

function mapProjectContractRow(row: any) {
  return getProjectWorkspaceServices().mapProjectContractRow(row);
}

function mapProjectAppendixRow(row: any) {
  return getProjectWorkspaceServices().mapProjectAppendixRow(row);
}

function mapProjectBaselineRow(row: any) {
  return getProjectWorkspaceServices().mapProjectBaselineRow(row);
}

function mapProjectProcurementLineRow(row: any) {
  return getProjectWorkspaceServices().mapProjectProcurementLineRow(row);
}

function mapProjectInboundLineRow(row: any) {
  return getProjectWorkspaceServices().mapProjectInboundLineRow(row);
}

function mapProjectDeliveryLineRow(row: any) {
  return getProjectWorkspaceServices().mapProjectDeliveryLineRow(row);
}

function createProjectTimelineEvent(
  db: any,
  event: {
    projectId: string;
    eventType: string;
    title: string;
    description?: string | null;
    eventDate?: string | null;
    entityType?: string | null;
    entityId?: string | null;
    payload?: any;
    createdBy?: string | null;
  }
) {
  return getProjectWorkspaceServices().createProjectTimelineEvent(db, event);
}

function recalculateProjectProcurementRollup(db: any, procurementLineId: string) {
  return getProjectWorkspaceServices().recalculateProjectProcurementRollup(db, procurementLineId);
}

function syncProjectProcurementLinesFromBaseline(db: any, projectId: string, baselineId: string) {
  return getProjectWorkspaceServices().syncProjectProcurementLinesFromBaseline(db, projectId, baselineId);
}

function createExecutionBaselineFromSource(
  db: any,
  params: {
    projectId: string;
    sourceType: 'main_contract' | 'appendix';
    sourceId: string;
    title: string;
    effectiveDate?: string | null;
    currency?: string | null;
    totalValue?: number | null;
    lineItems?: any[];
    createdBy?: string | null;
  }
) {
  return getProjectWorkspaceServices().createExecutionBaselineFromSource(db, params);
}

function getProjectWorkspaceById(db: any, projectId: string, currentUser?: any) {
  return getProjectWorkspaceServices().getProjectWorkspaceById(db, projectId, currentUser);
}

let notificationServicesCache: ReturnType<typeof createNotificationServices> | null = null;

function getNotificationServices() {
  if (!notificationServicesCache) {
    notificationServicesCache = createNotificationServices({
      allowedEntityTypes: ['Task', 'Quotation', 'Account', 'Lead', 'SupportTicket'],
      allowedLinks: ['Sales', 'Tasks', 'Accounts', 'Leads', 'Projects', 'Ops Overview', 'Ops Chat', 'Support'],
    });
  }
  return notificationServicesCache;
}

function ensureNotification(
  db: any,
  userId: string | null,
  content: string,
  meta: { entityType?: string | null; entityId?: string | null; link?: string | null } = {}
) {
  return getNotificationServices().ensureNotification(db, userId, content, meta);
}

let quotationAutomationServicesCache: ReturnType<typeof createQuotationAutomationServices> | null = null;

function getQuotationAutomationServices() {
  if (!quotationAutomationServicesCache) {
    quotationAutomationServicesCache = createQuotationAutomationServices({
      ensureNotification,
      resolveAssigneeId,
      getTaskWithLinksById,
      logAct,
    });
  }
  return quotationAutomationServicesCache;
}

function triggerQuotationAutomation(
  db: any,
  quotation: any,
  status: 'submitted_for_approval' | 'won',
  actorUserId: string | null,
  extra: { triggerSource?: string; projectId?: string | null; leadId?: string | null } = {}
) {
  return getQuotationAutomationServices().triggerQuotationAutomation(db, quotation, status, actorUserId, extra);
}

registerCollaborationRoutes(app, {
  ah,
  requireAuth,
  requireRole,
  parseLimitParam,
  getCurrentUserId,
  ensureNotification,
  getSupportTicketById,
  normalizeSupportTicketStatus,
  supportTicketStatuses: SUPPORT_TICKET_STATUSES,
  listActivities: getActivityServices().listActivities,
  createActivity: getActivityServices().createActivity,
  logAct,
});

// ─── ERP SYNC (OUTBOX) ──────────────────────────────────────────────────────
registerErpRoutes(app, {
  requireAuth,
  requireRole,
  ah,
  getDb,
  parseLimitParam,
  runErpOutboxOnce,
});

// ─── PROJECTS ────────────────────────────────────────────────────────────────
registerProjectReadRoutes(app, {
  ah,
  requireAuth,
  getProjectWorkspaceById,
});
registerProjectWriteRoutes(app, {
  ah,
  requireAuth,
  requireRole,
  normalizeProjectStage,
});
registerProjectContractRoutes(app, {
  ah,
  requireAuth,
  requireRole,
  getCurrentUserId,
  projectHubText,
  projectHubNumber,
  parseProjectHubJson,
  normalizeContractLineItems,
  mapProjectContractRow,
  mapProjectAppendixRow,
  createExecutionBaselineFromSource,
  createProjectTimelineEvent,
  logAct,
});

registerProjectLogisticsRoutes(app, {
  ah,
  requireAuth,
  requireRole,
  getCurrentUserId,
  projectHubText,
  projectHubNumber,
  recalculateProjectProcurementRollup,
  mapProjectInboundLineRow,
  mapProjectDeliveryLineRow,
  createProjectTimelineEvent,
});

registerProjectGovernanceRoutes(app, {
  ah,
  requireAuth,
  requireRole,
  getCurrentUserId,
  handleQbuApprovalDecision,
  createProjectTimelineEvent,
  logAct,
  resolveProjectHandoffQuotation,
  markWinningQuotation,
  createSalesOrderFromQuotation,
  createProjectTasksFromTemplate,
});

registerProjectSupplierQuoteRoutes(app, {
  ah,
  requireAuth,
  requireRole,
});

registerProjectWorkflowRoutes(app, {
  ah,
  requireAuth,
  requireRole,
  getCurrentUserId,
  WORKFLOW_PACK_LIBRARY,
  createProjectTasksFromTemplate,
  createApprovalRequestsFromTemplate,
  createProjectDocumentsFromTemplate,
});

registerTaskRoutes(app, {
  ah,
  requireAuth,
  requireRole,
  appendDateRangeFilter,
  getCurrentUserId,
  resolveAssigneeId,
  getTaskWithLinksById,
});

registerPricingRoutes(app);

// ─── GLOBAL ERROR HANDLER ─────────────────────────────────────────────────────
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[ERROR]', err.message);
  res.status(Number(err?.status) || 500).json({ error: err.message || 'Internal Server Error' });
});

export async function bootApplication() {
  return startServer({
    app,
    port: PORT,
    initialize: initDb,
    afterListen: scheduleDailyVcbRefresh,
  });
}
