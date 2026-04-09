import type { Request } from 'express';
import { createVcbExchangeRateServices } from '../shared/exchange-rate/vcb';
import { createActivityServices } from '../shared/activity/service';
import { createCollaborationServices } from '../modules/collaboration/service';
import { createTaskServices } from '../modules/tasks/service';
import { createProjectOrchestrationServices } from '../modules/projects/orchestration';
import { createProjectWorkspaceServices } from '../modules/projects/workspace';
import { createNotificationServices } from '../shared/notifications/service';
import { createQuotationAutomationServices } from '../modules/quotations/automation';
import { createPlatformReportingServices } from './platformReportingServices';
import { createPlatformWorkspaceServices } from './platformWorkspaceServices';
export type { PlatformReportingServices } from './platformReportingServices';
export type { PlatformWorkspaceServices } from './platformWorkspaceServices';

type CreateOperationalServicesDeps = {
  getDb: () => any;
  createId: () => string;
  supportTicketStatuses: readonly string[];
  projectStageValues: readonly string[];
  taskTemplateLibrary: Record<string, Array<{ name: string; taskType: string; department: string; priority: string; dueInDays: number; description: string }>>;
  approvalTemplateLibrary: Record<string, Array<{ requestType: string; title: string; department: string; approverRole: string; dueInDays: number }>>;
  documentTemplateLibrary: Record<string, Array<{ documentCode: string; documentName: string; category: string; department: string; requiredAtStage: string }>>;
};

export function createOperationalServices(deps: CreateOperationalServicesDeps) {
  const {
    getDb,
    createId,
    supportTicketStatuses,
    projectStageValues,
    taskTemplateLibrary,
    approvalTemplateLibrary,
    documentTemplateLibrary,
  } = deps;

  let vcbExchangeRateServicesCache: ReturnType<typeof createVcbExchangeRateServices> | null = null;
  let activityServicesCache: ReturnType<typeof createActivityServices> | null = null;
  let taskServicesCache: ReturnType<typeof createTaskServices> | null = null;
  let collaborationServicesCache: ReturnType<typeof createCollaborationServices> | null = null;
  let projectOrchestrationServicesCache: ReturnType<typeof createProjectOrchestrationServices> | null = null;
  let projectWorkspaceServicesCache: ReturnType<typeof createProjectWorkspaceServices> | null = null;
  let notificationServicesCache: ReturnType<typeof createNotificationServices> | null = null;
  let quotationAutomationServicesCache: ReturnType<typeof createQuotationAutomationServices> | null = null;

  function getVcbExchangeRateServices() {
    if (!vcbExchangeRateServicesCache) {
      vcbExchangeRateServicesCache = createVcbExchangeRateServices({ getDb, createId });
    }
    return vcbExchangeRateServicesCache;
  }

  function getActivityServices() {
    if (!activityServicesCache) {
      activityServicesCache = createActivityServices({ getDb, createId });
    }
    return activityServicesCache;
  }

  function getTaskServices() {
    if (!taskServicesCache) {
      taskServicesCache = createTaskServices();
    }
    return taskServicesCache;
  }

  function getCollaborationServices() {
    if (!collaborationServicesCache) {
      collaborationServicesCache = createCollaborationServices({ supportTicketStatuses });
    }
    return collaborationServicesCache;
  }

  function normalizeProjectStage(value: unknown, fallback = 'new') {
    const stage = typeof value === 'string' ? value.trim().toLowerCase() : '';
    return projectStageValues.includes(stage) ? stage : fallback;
  }

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

  function getNotificationServices() {
    if (!notificationServicesCache) {
      notificationServicesCache = createNotificationServices({
        allowedEntityTypes: ['Task', 'Quotation', 'Account', 'Lead', 'SupportTicket'],
        allowedLinks: ['Sales', 'Tasks', 'Accounts', 'Leads', 'Projects', 'Ops Overview', 'Ops Chat', 'Support'],
      });
    }
    return notificationServicesCache;
  }

  const logAct = (...args: Parameters<ReturnType<typeof createActivityServices>['logAct']>) =>
    getActivityServices().logAct(...args);

  function resolveAssigneeId(db: any, preferredAssigneeId: unknown, salesperson: unknown, fallbackUserId: number | string | null) {
    return getTaskServices().resolveAssigneeId(db, preferredAssigneeId, salesperson, fallbackUserId);
  }

  function getTaskWithLinksById(db: any, id: number | string) {
    return getTaskServices().getTaskWithLinksById(db, id);
  }

  function getProjectOrchestrationServices() {
    if (!projectOrchestrationServicesCache) {
      projectOrchestrationServicesCache = createProjectOrchestrationServices({
        TASK_TEMPLATE_LIBRARY: taskTemplateLibrary,
        APPROVAL_TEMPLATE_LIBRARY: approvalTemplateLibrary,
        DOCUMENT_TEMPLATE_LIBRARY: documentTemplateLibrary,
        resolveAssigneeId,
        getTaskWithLinksById,
        normalizeProjectStage,
      });
    }
    return projectOrchestrationServicesCache;
  }

  function ensureNotification(
    db: any,
    userId: number | string | null,
    content: string,
    meta: { entityType?: string | null; entityId?: number | string | null; link?: string | null } = {}
  ) {
    return getNotificationServices().ensureNotification(db, userId, content, meta);
  }

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

  function getCurrentUserId(req: Request) {
    return (req as any).user?.id || null;
  }

  const appendDateRangeFilter = (conditions: string[], params: any[], column: string, from: unknown, to: unknown) => {
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

  const platformWorkspaceServices = createPlatformWorkspaceServices({
    getDb,
    getProjectWorkspaceById: (db: any, projectId: string, currentUser?: any) =>
      getProjectWorkspaceServices().getProjectWorkspaceById(db, projectId, currentUser),
  });

  const platformReportingServices = createPlatformReportingServices({ getDb });

  return {
    parseExchangeRatePair: (pairRaw: unknown) => getVcbExchangeRateServices().parseExchangeRatePair(pairRaw),
    getLatestExchangeRatePayload: (baseCurrency: string, quoteCurrency: string) => getVcbExchangeRateServices().getLatestExchangeRatePayload(baseCurrency, quoteCurrency),
    refreshVcbRates: () => getVcbExchangeRateServices().refreshVcbRates(),
    scheduleDailyVcbRefresh: () => getVcbExchangeRateServices().scheduleDailyVcbRefresh(),
    listActivities: getActivityServices().listActivities,
    createActivity: getActivityServices().createActivity,
    logAct,
    getCurrentUserId,
    appendDateRangeFilter,
    resolveAssigneeId,
    getTaskWithLinksById,
    normalizeSupportTicketStatus: (value: unknown) => getCollaborationServices().normalizeSupportTicketStatus(value),
    getSupportTicketById: (db: any, id: string) => getCollaborationServices().getSupportTicketById(db, id),
    autoCreateProjectForQuotation: (db: any, payload: any, actorUserId: string | null) => getProjectOrchestrationServices().autoCreateProjectForQuotation(db, payload, actorUserId),
    createProjectTasksFromTemplate: (db: any, params: any) => getProjectOrchestrationServices().createProjectTasksFromTemplate(db, params),
    createApprovalRequestsFromTemplate: (db: any, params: any) => getProjectOrchestrationServices().createApprovalRequestsFromTemplate(db, params),
    createProjectDocumentsFromTemplate: (db: any, params: any) => getProjectOrchestrationServices().createProjectDocumentsFromTemplate(db, params),
    createSalesOrderFromQuotation: (db: any, quotationId: string) => getProjectOrchestrationServices().createSalesOrderFromQuotation(db, quotationId),
    resolveProjectHandoffQuotation: (db: any, projectId: string, preferredQuotationId?: string | null) => getProjectOrchestrationServices().resolveProjectHandoffQuotation(db, projectId, preferredQuotationId),
    projectHubText,
    projectHubNumber,
    parseProjectHubJson,
    normalizeContractLineItems: (items: any[] = []) => getProjectWorkspaceServices().normalizeContractLineItems(items),
    mapProjectContractRow: (row: any) => getProjectWorkspaceServices().mapProjectContractRow(row),
    mapProjectAppendixRow: (row: any) => getProjectWorkspaceServices().mapProjectAppendixRow(row),
    mapProjectInboundLineRow: (row: any) => getProjectWorkspaceServices().mapProjectInboundLineRow(row),
    mapProjectDeliveryLineRow: (row: any) => getProjectWorkspaceServices().mapProjectDeliveryLineRow(row),
    createProjectTimelineEvent: (db: any, event: any) => getProjectWorkspaceServices().createProjectTimelineEvent(db, event),
    recalculateProjectProcurementRollup: (db: any, procurementLineId: string) => getProjectWorkspaceServices().recalculateProjectProcurementRollup(db, procurementLineId),
    createExecutionBaselineFromSource: (db: any, params: any) => getProjectWorkspaceServices().createExecutionBaselineFromSource(db, params),
    getProjectWorkspaceById: (db: any, projectId: string, currentUser?: any) => getProjectWorkspaceServices().getProjectWorkspaceById(db, projectId, currentUser),
    ensureNotification,
    platformReportingServices,
    platformWorkspaceServices,
    triggerQuotationAutomation: (db: any, quotation: any, status: 'submitted_for_approval' | 'won', actorUserId: string | null, extra: { triggerSource?: string; projectId?: string | null; leadId?: string | null } = {}) =>
      getQuotationAutomationServices().triggerQuotationAutomation(db, quotation, status, actorUserId, extra),
  };
}
