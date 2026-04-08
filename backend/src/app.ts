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
import { createOperationalServices } from './bootstrap/createOperationalServices';
import { startServer } from './bootstrap/startServer';
import { getJwtSecret, requireAuth, requireRole } from './shared/auth/httpAuth';
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
import { registerProjectReadRoutes } from './modules/projects/readRoutes';
import { registerProjectSupplierQuoteRoutes } from './modules/projects/supplierQuoteRoutes';
import { createSupplierQuote } from './modules/projects/supplierQuoteService';
import { registerProjectWorkflowRoutes } from './modules/projects/workflowRoutes';
import { registerProductRoutes } from './modules/products/routes';
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
import { createCrmSerializationServices } from './shared/serialization/crm';
import { registerTaskRoutes } from './modules/tasks/routes';
import { registerTaskDependencyRoutes } from './modules/tasks/dependencyRoutes';
import { registerTimeSpendRoutes } from './modules/tasks/timeSpendRoutes';
import { registerUserRoutes } from './modules/users/routes';

dotenv.config();
getJwtSecret();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const ah = asyncHandler;
export const app = express();
export const PORT = Number(process.env.PORT || 3001);

function expandLoopbackCorsOrigins(origin: string) {
  try {
    const url = new URL(origin);
    if (url.hostname === 'localhost') {
      return [origin, origin.replace('://localhost', '://127.0.0.1')];
    }
    if (url.hostname === '127.0.0.1') {
      return [origin, origin.replace('://127.0.0.1', '://localhost')];
    }
  } catch {
    // Keep invalid origins untouched so explicit env mistakes are still visible.
  }
  return [origin];
}

const configuredOrigins = process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:4173';
const externalIpOrigins = process.env.IP_NETWORK ? `http://${process.env.IP_NETWORK}:5173,http://${process.env.IP_NETWORK}:4173` : '';
const combinedOrigins = [configuredOrigins, externalIpOrigins].filter(Boolean).join(',');

const allowedOrigins = Array.from(
  new Set(
    combinedOrigins
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .flatMap(expandLoopbackCorsOrigins),
  ),
);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-role-preview'],
}));
app.use(express.json({ limit: '2mb' }));

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Multer setup:
// - importUpload: lightweight tabular files
// - productAssetUpload: larger images/documents attached to products
const importUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const productAssetUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

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
function normalizeProjectStage(value: unknown, fallback = 'new') {
  const stage = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return PROJECT_STAGE_VALUES.includes(stage as any) ? stage : fallback;
}

const operationalServices = createOperationalServices({
  getDb,
  createId: uuidv4,
  supportTicketStatuses: SUPPORT_TICKET_STATUSES,
  projectStageValues: PROJECT_STAGE_VALUES,
  taskTemplateLibrary: TASK_TEMPLATE_LIBRARY,
  approvalTemplateLibrary: APPROVAL_TEMPLATE_LIBRARY,
  documentTemplateLibrary: DOCUMENT_TEMPLATE_LIBRARY,
});

const {
  parseExchangeRatePair,
  getLatestExchangeRatePayload,
  refreshVcbRates,
  scheduleDailyVcbRefresh,
  listActivities,
  createActivity,
  logAct,
  getCurrentUserId,
  appendDateRangeFilter,
  resolveAssigneeId,
  getTaskWithLinksById,
  normalizeSupportTicketStatus,
  getSupportTicketById,
  autoCreateProjectForQuotation,
  createProjectTasksFromTemplate,
  createApprovalRequestsFromTemplate,
  createProjectDocumentsFromTemplate,
  createSalesOrderFromQuotation,
  resolveProjectHandoffQuotation,
  projectHubText,
  projectHubNumber,
  parseProjectHubJson,
  normalizeContractLineItems,
  mapProjectContractRow,
  mapProjectAppendixRow,
  mapProjectInboundLineRow,
  mapProjectDeliveryLineRow,
  createProjectTimelineEvent,
  recalculateProjectProcurementRollup,
  createExecutionBaselineFromSource,
  getProjectWorkspaceById,
  ensureNotification,
  platformReportingServices,
  platformWorkspaceServices,
  triggerQuotationAutomation,
} = operationalServices;

registerPlatformRoutes(app);
registerPlatformTranslationRoutes(app, { ah });

// ─── GLOBAL AUTH GUARD: yêu cầu JWT cho mọi write request (trừ auth endpoints) ──
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/auth/')) return next();   // login/me/change-password tự xử lý
  if (req.path === '/qa/bootstrap-ux-seed') return next();
  if (req.method === 'GET' || req.method === 'OPTIONS') return next(); // reads public
  requireAuth(req, res, next);                         // POST/PUT/PATCH/DELETE cần token
});

const crmSerializationServices = createCrmSerializationServices();


registerAuthRoutes(app, { mapGenderRecord });
registerPlatformCalculatorRoutes(app, { ah });
registerPlatformQaRoutes(app, { ah, requireAuth });
registerPlatformReportingRoutes(app, { ah, requireAuth, reportingServices: platformReportingServices });
registerPlatformWorkspaceRoutes(app, { ah, requireAuth, workspaceServices: platformWorkspaceServices });
registerPlatformSystemRoutes(app, { ah, requireAuth, requireRole });
registerCrmRoutes(app, { ah, requireAuth, requireRole, upload: importUpload, mapGenderRecord, mapGenderRecords, logAct });
registerProductRoutes(app, {
  ah,
  requireAuth,
  requireRole,
  upload: importUpload,
  assetUpload: productAssetUpload,
  serializeProductRow: crmSerializationServices.serializeProductRow,
  parseJsonObject: crmSerializationServices.parseJsonObject,
  stringifyNormalizedJson: crmSerializationServices.stringifyNormalizedJson,
  getLatestExchangeRatePayload,
});
registerSupplierRoutes(app, {
  ah,
  requireAuth,
  requireRole,
  upload: importUpload,
  serializeSupplierTags: crmSerializationServices.serializeSupplierTags,
  hydrateSupplier: crmSerializationServices.hydrateSupplier,
});
registerSupplierQuoteRoutes(app, {
  ah,
  createSupplierQuote,
});
registerSalespersonRoutes(app, { ah, requireAuth, requireRole });
registerUserRoutes(app, {
  ah,
  requireAuth,
  requireRole,
  upload: importUpload,
  avatarUploadDir: path.join(__dirname, '..', 'uploads', 'avatars'),
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
  createProjectTimelineEvent,
  logAct,
});

registerSalesOrderRoutes(app, {
  ah,
  requireAuth,
  requireRole,
  parseLimitParam,
  createSalesOrderFromQuotation,
  getProjectWorkspaceById,
  createProjectTimelineEvent,
});

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
  listActivities,
  createActivity,
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
  getProjectWorkspaceById,
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
registerTaskDependencyRoutes(app, {
  ah,
  requireAuth,
  getCurrentUserId,
});
registerTimeSpendRoutes(app, {
  ah,
  requireAuth,
  getCurrentUserId,
});

registerPricingRoutes(app);

// ─── GLOBAL ERROR HANDLER ─────────────────────────────────────────────────────
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[ERROR]', err.message);
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File vượt quá giới hạn cho phép. Ảnh/tài liệu sản phẩm tối đa 20MB, file import tối đa 5MB.' });
  }
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
