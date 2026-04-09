import { getDb } from '../../../sqlite-db';
import { enqueueErpEvent } from '../../../erp-sync';
import { userHasAnyRole } from '../../shared/auth/roles';
import { canTransitionSalesOrderStatus, resolveHandoffActivation } from '../../shared/workflow/revenueFlow';
import { createSalesOrderRepository } from './repository';

type SalesOrderServiceDeps = {
  createSalesOrderFromQuotation: (db: any, quotationId: number | string) => Promise<{ created: boolean; salesOrder: any }>;
  getProjectWorkspaceById: (db: any, projectId: number | string, currentUser?: any) => Promise<any>;
  createProjectTimelineEvent: (db: any, event: any) => Promise<any>;
};

type RouteResult = {
  status: number;
  body: any;
};

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

function buildSalesOrderReleaseGateState(approvalRows: any[] = []) {
  const pendingRows = approvalRows.filter((row) => String(row?.status || '').toLowerCase() === 'pending');
  const latestApproval = approvalRows[0] || null;
  return {
    gateType: 'sales_order_release',
    status: pendingRows.length > 0 ? 'pending' : latestApproval?.status || 'not_requested',
    latestApprovalId: latestApproval?.id || null,
    pendingCount: pendingRows.length,
    pendingApprovers: mapPendingApprovers(pendingRows),
  };
}

function buildSalesOrderActionAvailability(row: any, currentUser: any, gateState: any) {
  const releaseTransition = canTransitionSalesOrderStatus({
    currentStatus: row?.status,
    nextStatus: 'released',
    quotationStatus: row?.quotationStatus,
  });
  const releaseBlockers = [
    ...(releaseTransition.ok === false ? [releaseTransition.failure.message] : []),
    ...(gateState?.status === 'approved' ? [] : ['Sales order release gate must be approved before releasing the order.']),
  ];
  return {
    canRelease: userHasAnyRole(currentUser, ['director']) && releaseTransition.ok && gateState?.status === 'approved',
    canRequestReleaseApproval:
      userHasAnyRole(currentUser, ['project_manager', 'director']) &&
      String(row?.status || '').toLowerCase() === 'draft' &&
      Number(gateState?.pendingCount || 0) === 0,
    canOpenQuotation: Boolean(row?.quotationId),
    canOpenProject: Boolean(row?.projectId),
    blockers: Array.from(new Set(releaseBlockers)).filter(Boolean),
  };
}

function toBlockedResponse(code: string, fallbackError: string, blockers: unknown): RouteResult {
  const resolvedBlockers = Array.isArray(blockers) ? blockers : [];
  return {
    status: 409,
    body: {
      error: resolvedBlockers.length ? resolvedBlockers[0] : fallbackError,
      code,
      blockers: resolvedBlockers,
    },
  };
}

export function createSalesOrderService(deps: SalesOrderServiceDeps) {
  const repository = createSalesOrderRepository();

  async function listSalesOrders(input: { limit: number; currentUser?: any }) {
    const rows = await repository.listDetailed(input.limit);
    const projectIds = Array.from(new Set(rows.map((row: any) => String(row?.projectId || '').trim()).filter(Boolean)));
    const approvalRows = await repository.listReleaseApprovalsByProjectIds(projectIds);

    const approvalsByProjectId = new Map<string, any[]>();
    for (const approval of approvalRows) {
      const projectId = String(approval?.projectId || '').trim();
      if (!projectId) continue;
      const bucket = approvalsByProjectId.get(projectId) || [];
      bucket.push(approval);
      approvalsByProjectId.set(projectId, bucket);
    }

    return rows.map((row: any) => {
      const gateState = buildSalesOrderReleaseGateState(approvalsByProjectId.get(String(row?.projectId || '').trim()) || []);
      const actionAvailability = buildSalesOrderActionAvailability(row, input.currentUser, gateState);
      return {
        ...row,
        approvalGateState: gateState,
        actionAvailability,
        handoffActivation: resolveHandoffActivation({
          quotationId: row?.quotationId || null,
          quotationStatus: row?.quotationStatus || null,
          salesOrderId: row?.id || null,
          salesOrderStatus: row?.status || null,
          releaseGateStatus: gateState?.status || null,
          canRequestReleaseApproval: actionAvailability?.canRequestReleaseApproval,
          canReleaseSalesOrder: actionAvailability?.canRelease,
          salesOrderBlockers: actionAvailability?.blockers,
        }),
      };
    });
  }

  async function getSalesOrderById(id: number | string) {
    return repository.findDetailedById(id);
  }

  async function createFromQuotation(input: { quotationId: number | string; currentUser?: any }): Promise<RouteResult> {
    const quotation = await repository.findQuotationSummaryById(input.quotationId);
    if (!quotation) {
      return { status: 404, body: { error: 'Quotation not found' } };
    }

    if (quotation.projectId) {
      const workspace = await deps.getProjectWorkspaceById(null, quotation.projectId, input.currentUser);
      const actionAvailability = workspace?.actionAvailability?.quotation;
      if (!actionAvailability?.canCreateSalesOrder) {
        return toBlockedResponse(
          'SALES_ORDER_READINESS_BLOCKED',
          'Workspace chưa sẵn sàng để tạo sales order',
          actionAvailability?.blockers,
        );
      }
    }

    const result = await deps.createSalesOrderFromQuotation(null, input.quotationId);
    if (result.created && quotation.projectId && result.salesOrder?.id) {
      await deps.createProjectTimelineEvent(null, {
        projectId: quotation.projectId,
        eventType: 'handoff_activated',
        title: 'Handoff activated',
        description: `Sales order ${result.salesOrder.orderNumber || result.salesOrder.id} was created from a won quotation.`,
        eventDate: new Date().toISOString(),
        entityType: 'SalesOrder',
        entityId: result.salesOrder.id,
        payload: {
          quotationId: input.quotationId,
          salesOrderId: result.salesOrder.id,
          source: 'sales_order_create',
        },
        createdBy: input.currentUser?.id ?? null,
      });
    }
    return {
      status: result.created ? 201 : 200,
      body: result,
    };
  }

  async function requestReleaseApproval(input: { salesOrderId: number | string; note?: unknown; currentUser?: any }): Promise<RouteResult> {
    const salesOrder = await repository.findReleaseApprovalContextBySalesOrderId(input.salesOrderId);
    if (!salesOrder) {
      return { status: 404, body: { error: 'Sales order not found' } };
    }

    const transition = canTransitionSalesOrderStatus({
      currentStatus: salesOrder.status,
      nextStatus: 'released',
      quotationStatus: salesOrder.quotationStatus,
    });
    if (!transition.ok) {
      const failure = 'failure' in transition
        ? transition.failure
        : { code: 'INVALID_TRANSITION', message: 'Sales order transition blocked' };
      return { status: 409, body: { error: failure.message, code: failure.code } };
    }

    const approvalTitle = `Release ${salesOrder.orderNumber || salesOrder.id}`;
    const existingPending = await repository.findPendingReleaseApproval(
      salesOrder.projectId || null,
      salesOrder.quotationId || null,
      approvalTitle,
    );
    if (existingPending) {
      return { status: 200, body: existingPending };
    }

    if (salesOrder.projectId) {
      const workspace = await deps.getProjectWorkspaceById(null, salesOrder.projectId, input.currentUser);
      const salesOrderActions = workspace?.actionAvailability?.salesOrder;
      if (!salesOrderActions?.canRequestReleaseApproval) {
        return toBlockedResponse(
          'SALES_ORDER_RELEASE_APPROVAL_BLOCKED',
          'Workspace chưa sẵn sàng để gửi sales order release approval',
          salesOrderActions?.blockers,
        );
      }
    }

    const directorUser = await repository.findActiveDirectorUser();
    const created = await repository.createReleaseApproval({
      projectId: salesOrder.projectId || null,
      quotationId: salesOrder.quotationId || null,
      requestedBy: input.currentUser?.id ?? null,
      approverUserId: directorUser?.id || null,
      title: approvalTitle,
      note: typeof input.note === 'string' && input.note.trim() ? input.note.trim() : null,
    });

    if (salesOrder.projectId && created?.id) {
      await deps.createProjectTimelineEvent(null, {
        projectId: salesOrder.projectId,
        eventType: 'handoff_activated',
        title: 'Handoff activated',
        description: `Release approval was requested for sales order ${salesOrder.orderNumber || salesOrder.id}.`,
        eventDate: new Date().toISOString(),
        entityType: 'ApprovalRequest',
        entityId: created.id,
        payload: {
          salesOrderId: input.salesOrderId,
          approvalRequestId: created.id,
          source: 'sales_order_release_approval_request',
        },
        createdBy: input.currentUser?.id ?? null,
      });
    }

    return { status: 201, body: created };
  }

  async function updateSalesOrder(input: {
    salesOrderId: string;
    status?: unknown;
    notes?: unknown;
    currentUser?: any;
  }): Promise<RouteResult> {
    const current = await repository.findUpdateContextBySalesOrderId(input.salesOrderId);
    if (!current) {
      return { status: 404, body: { error: 'Not found' } };
    }

    const nextStatus = typeof input.status === 'string' && input.status.trim()
      ? input.status.trim()
      : String(current.status || 'draft');
    const nextNotes = typeof input.notes === 'string' ? input.notes : null;
    const transition = canTransitionSalesOrderStatus({
      currentStatus: current.status,
      nextStatus,
      quotationStatus: current.quotationStatus,
    });
    if (!transition.ok) {
      const failure = 'failure' in transition
        ? transition.failure
        : { code: 'INVALID_TRANSITION', message: 'Sales order transition blocked' };
      return { status: 409, body: { error: failure.message, code: failure.code } };
    }

    const roleCodes = Array.isArray(input.currentUser?.roleCodes) ? input.currentUser.roleCodes.map(String) : [];
    const systemRole = String(input.currentUser?.systemRole || '').trim();
    const userRoles = new Set([...roleCodes, systemRole]);
    if (String(nextStatus).trim() === 'released' && !['admin', 'director'].some((role) => userRoles.has(role))) {
      return { status: 403, body: { error: 'Only director can release a sales order' } };
    }
    if (String(nextStatus).trim() === 'locked_for_execution' && !['admin', 'director', 'project_manager'].some((role) => userRoles.has(role))) {
      return { status: 403, body: { error: 'Only project manager or director can lock execution' } };
    }

    if (String(nextStatus).trim() === 'released' && current.projectId) {
      const workspace = await deps.getProjectWorkspaceById(null, current.projectId, input.currentUser);
      const salesOrderActions = workspace?.actionAvailability?.salesOrder;
      if (!salesOrderActions?.canReleaseLatest) {
        return toBlockedResponse(
          'SALES_ORDER_RELEASE_BLOCKED',
          'Workspace chưa sẵn sàng để release sales order',
          salesOrderActions?.blockers,
        );
      }
    }

    const updated = await repository.updateStatusAndNotes(input.salesOrderId, nextStatus, nextNotes);

    if (String(nextStatus).trim() === 'released') {
      if (current.projectId) {
        await repository.promoteProjectStageAfterRelease(current.projectId);
        await deps.createProjectTimelineEvent(null, {
          projectId: current.projectId,
          eventType: 'handoff_activated',
          title: 'Handoff activated',
          description: `Sales order ${updated?.orderNumber || input.salesOrderId} was released for execution.`,
          eventDate: new Date().toISOString(),
          entityType: 'SalesOrder',
          entityId: input.salesOrderId,
          payload: {
            salesOrderId: input.salesOrderId,
            source: 'sales_order_released',
          },
          createdBy: String(input.currentUser?.id || '').trim() || null,
        });
      }
      await enqueueErpEvent(getDb(), {
        eventType: 'sales_order.released',
        entityType: 'SalesOrder',
        entityId: input.salesOrderId,
        payload: { salesOrderId: input.salesOrderId, status: nextStatus },
      });
    }

    return { status: 200, body: updated };
  }

  return {
    listSalesOrders,
    getSalesOrderById,
    createFromQuotation,
    requestReleaseApproval,
    updateSalesOrder,
  };
}
