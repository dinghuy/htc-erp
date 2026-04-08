import { computeIsRemind } from '../../../quotation-status';
import { getDb } from '../../../sqlite-db';
import type { AuthenticatedUser } from '../../shared/contracts/domain';
import { userHasAnyRole } from '../../shared/auth/roles';
import { canCreateSalesOrderFromQuotation, normalizeLegacyQuotationStatus, resolveHandoffActivation } from '../../shared/workflow/revenueFlow';
import { createQuotationRepository } from './repository';

const quotationRepository = createQuotationRepository();

function stripLegacyBlobFields(row: any) {
  if (!row || typeof row !== 'object') return row;
  const { items, financialParams, terms, ...rest } = row;
  return rest;
}

function normalizeStatus(value: unknown) {
  return normalizeLegacyQuotationStatus(value) || 'draft';
}

function mapPendingApprovers(rows: any[] = []) {
  return rows.map((row) => ({
    approvalId: row.id,
    approverRole: row.approverRole || null,
    approverUserId: row.approverUserId || null,
    approverName: row.approverName || null,
    requestedBy: row.requestedBy || null,
    requestedByName: row.requestedByName || null,
    dueDate: row.dueDate || null,
    status: row.status || null,
  }));
}

function buildCommercialApprovalState(approvalRows: any[] = []) {
  const pendingRows = approvalRows.filter((row) => String(row?.status || '').toLowerCase() === 'pending');
  const latestApproval = approvalRows[0] || null;
  return {
    gateType: 'quotation_commercial',
    status: pendingRows.length > 0 ? 'pending' : latestApproval?.status || 'not_requested',
    latestApprovalId: latestApproval?.id || null,
    pendingCount: pendingRows.length,
    pendingApprovers: mapPendingApprovers(pendingRows),
  };
}

function buildQuotationActionAvailability(row: any, currentUser: AuthenticatedUser | null | undefined, commercialApprovalState: any, linkedSalesOrder: any) {
  const normalizedStatus = normalizeStatus(row?.status);
  const isReadOnly = ['won', 'lost', 'rejected'].includes(normalizedStatus);
  const canManageQuotation = userHasAnyRole(currentUser, ['sales', 'manager']);
  const canRequestCommercialApproval = Boolean(row?.projectId)
    && userHasAnyRole(currentUser, ['sales', 'director'])
    && ['draft', 'revision_required'].includes(normalizedStatus)
    && Number(commercialApprovalState?.pendingCount || 0) === 0;
  const canCreateSalesOrder = userHasAnyRole(currentUser, ['sales', 'project_manager', 'director'])
    && canCreateSalesOrderFromQuotation(row?.status);

  const blockers: string[] = [];
  if (!row?.projectId) blockers.push('Project is required before requesting commercial approval.');
  if (!canCreateSalesOrderFromQuotation(row?.status)) blockers.push('Quotation must be approved or won before creating a sales order.');

  return {
    canEdit: canManageQuotation && !isReadOnly,
    canDelete: canManageQuotation && !isReadOnly,
    canRevise: canManageQuotation,
    canRequestCommercialApproval,
    canCreateSalesOrder,
    blockers,
    linkedSalesOrderId: linkedSalesOrder?.id || null,
    linkedSalesOrderStatus: linkedSalesOrder?.status || null,
  };
}

async function listCommercialApprovalsByQuotationIds(quotationIds: string[]) {
  if (!quotationIds.length) return [];
  const placeholders = quotationIds.map(() => '?').join(', ');
  return getDb().all(
    `SELECT ar.*,
            approver.fullName AS approverName,
            requester.fullName AS requestedByName
     FROM ApprovalRequest ar
     LEFT JOIN User approver ON ar.approverUserId = approver.id
     LEFT JOIN User requester ON ar.requestedBy = requester.id
     WHERE ar.requestType = 'quotation_commercial'
       AND ar.quotationId IN (${placeholders})
     ORDER BY ar.createdAt DESC, ar.id DESC`,
    quotationIds,
  );
}

async function listSalesOrdersByQuotationIds(quotationIds: string[]) {
  if (!quotationIds.length) return [];
  const placeholders = quotationIds.map(() => '?').join(', ');
  return getDb().all(
    `SELECT id, quotationId, status, orderNumber, createdAt
     FROM SalesOrder
     WHERE quotationId IN (${placeholders})
     ORDER BY createdAt DESC, id DESC`,
    quotationIds,
  );
}

async function listReleaseApprovalsByProjectIds(projectIds: string[]) {
  if (!projectIds.length) return [];
  const placeholders = projectIds.map(() => '?').join(', ');
  return getDb().all(
    `SELECT ar.*,
            approver.fullName AS approverName,
            requester.fullName AS requestedByName
     FROM ApprovalRequest ar
     LEFT JOIN User approver ON ar.approverUserId = approver.id
     LEFT JOIN User requester ON ar.requestedBy = requester.id
     WHERE ar.requestType = 'sales_order_release'
       AND ar.projectId IN (${placeholders})
     ORDER BY ar.createdAt DESC, ar.id DESC`,
    projectIds,
  );
}

export async function listQuotations(currentUser?: AuthenticatedUser | null) {
  const rows = await quotationRepository.listDetailed();
  const nowMs = Date.now();
  const quotationIds = rows.map((row: any) => String(row.id || '')).filter(Boolean);
  const projectIds = Array.from(new Set(rows.map((row: any) => String(row.projectId || '')).filter(Boolean)));
  const [approvalRows, salesOrderRows, releaseApprovalRows] = await Promise.all([
    listCommercialApprovalsByQuotationIds(quotationIds),
    listSalesOrdersByQuotationIds(quotationIds),
    listReleaseApprovalsByProjectIds(projectIds),
  ]);

  const approvalsByQuotationId = new Map<string, any[]>();
  for (const approval of approvalRows) {
    const quotationId = String(approval?.quotationId || '').trim();
    if (!quotationId) continue;
    const bucket = approvalsByQuotationId.get(quotationId) || [];
    bucket.push(approval);
    approvalsByQuotationId.set(quotationId, bucket);
  }

  const salesOrdersByQuotationId = new Map<string, any>();
  for (const salesOrder of salesOrderRows) {
    const quotationId = String(salesOrder?.quotationId || '').trim();
    if (!quotationId || salesOrdersByQuotationId.has(quotationId)) continue;
    salesOrdersByQuotationId.set(quotationId, salesOrder);
  }

  const releaseApprovalsByProjectId = new Map<string, any[]>();
  for (const approval of releaseApprovalRows) {
    const projectId = String(approval?.projectId || '').trim();
    if (!projectId) continue;
    const bucket = releaseApprovalsByProjectId.get(projectId) || [];
    bucket.push(approval);
    releaseApprovalsByProjectId.set(projectId, bucket);
  }

  return rows.map((row: any) => {
    const commercialApprovalState = buildCommercialApprovalState(approvalsByQuotationId.get(String(row.id || '')) || []);
    const linkedSalesOrder = salesOrdersByQuotationId.get(String(row.id || ''));
    const releaseApprovalState = buildCommercialApprovalState(releaseApprovalsByProjectId.get(String(row.projectId || '')) || []);
    const actionAvailability = buildQuotationActionAvailability(row, currentUser, commercialApprovalState, linkedSalesOrder);
    return {
      ...stripLegacyBlobFields(row),
      isRemind: computeIsRemind(row.status, row.createdAt, nowMs),
      approvalGateState: commercialApprovalState,
      actionAvailability,
      handoffActivation: resolveHandoffActivation({
        quotationId: row.id,
        quotationStatus: row.status,
        salesOrderId: linkedSalesOrder?.id || null,
        salesOrderStatus: linkedSalesOrder?.status || null,
        releaseGateStatus: releaseApprovalState?.status || null,
        canCreateSalesOrder: actionAvailability?.canCreateSalesOrder,
        quotationBlockers: actionAvailability?.blockers,
      }),
    };
  });
}

export async function getQuotationById(id: string, currentUser?: AuthenticatedUser | null) {
  const row = await quotationRepository.findDetailedById(id);
  if (!row) return null;
  const [approvalRows, salesOrderRows, releaseApprovalRows] = await Promise.all([
    listCommercialApprovalsByQuotationIds([id]),
    listSalesOrdersByQuotationIds([id]),
    listReleaseApprovalsByProjectIds(row?.projectId ? [String(row.projectId)] : []),
  ]);
  const commercialApprovalState = buildCommercialApprovalState(approvalRows);
  const linkedSalesOrder = salesOrderRows[0] || null;
  const releaseApprovalState = buildCommercialApprovalState(releaseApprovalRows);
  const actionAvailability = buildQuotationActionAvailability(row, currentUser, commercialApprovalState, linkedSalesOrder);
  return {
    ...stripLegacyBlobFields(row),
    isRemind: computeIsRemind(row.status, row.createdAt),
    approvalGateState: commercialApprovalState,
    actionAvailability,
    handoffActivation: resolveHandoffActivation({
      quotationId: row.id,
      quotationStatus: row.status,
      salesOrderId: linkedSalesOrder?.id || null,
      salesOrderStatus: linkedSalesOrder?.status || null,
      releaseGateStatus: releaseApprovalState?.status || null,
      canCreateSalesOrder: actionAvailability?.canCreateSalesOrder,
      quotationBlockers: actionAvailability?.blockers,
    }),
  };
}
