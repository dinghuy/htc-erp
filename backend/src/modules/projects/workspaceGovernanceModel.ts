import type { AuthenticatedUser, ApprovalGateType } from '../../shared/contracts/domain';
import { canUserApproveRequest, resolveApprovalLane } from '../../shared/auth/permissions';
import { normalizeRoleCodes } from '../../shared/auth/roles';
import { canCompleteDelivery, canCreateSalesOrderFromQuotation, canStartLogisticsExecution, canTransitionSalesOrderStatus } from '../../shared/workflow/revenueFlow';

type CreateProjectWorkspaceGovernanceModelDeps = {
  projectHubText: (value: unknown) => string;
  projectHubNumber: (value: unknown, fallback?: number) => number;
};

const GATE_TITLES: Record<ApprovalGateType, string> = {
  quotation_commercial: 'Quotation Commercial Approval',
  sales_order_release: 'Sales Order Release',
  procurement_commitment: 'Procurement Commitment',
  delivery_release: 'Delivery Release',
  delivery_completion: 'Delivery Completion',
};

export function createProjectWorkspaceGovernanceModel(deps: CreateProjectWorkspaceGovernanceModelDeps) {
  const { projectHubText, projectHubNumber } = deps;

  function isBusinessRole(user: Pick<AuthenticatedUser, 'roleCodes' | 'systemRole'> | null | undefined, roles: string[]) {
    const normalized = normalizeRoleCodes(user?.roleCodes, user?.systemRole);
    return normalized.some((role) => roles.includes(role));
  }

  function decorateApprovalForCurrentUser(approval: any, currentUser?: Pick<AuthenticatedUser, 'id' | 'roleCodes' | 'systemRole'> | null) {
    const canDecide = canUserApproveRequest(currentUser, approval);
    return {
      ...approval,
      actionAvailability: {
        lane: resolveApprovalLane(approval),
        canDecide,
        canEdit: ['pending', 'cancelled'].includes(String(approval?.status || '').toLowerCase()),
        canDelete: ['pending', 'cancelled'].includes(String(approval?.status || '').toLowerCase()),
        isRequester: Boolean(currentUser?.id) && String(approval?.requestedBy || '') === String(currentUser?.id || ''),
        isAssignedApprover: !approval?.approverUserId || String(approval.approverUserId) === String(currentUser?.id || ''),
        availableDecisions: canDecide ? ['approved', 'rejected', 'changes_requested'] : [],
      },
    };
  }

  function buildApprovalGateStates(input: {
    approvals: any[];
    currentUser?: Pick<AuthenticatedUser, 'id' | 'roleCodes' | 'systemRole'> | null;
    latestQuotation?: any;
    latestSalesOrder?: any;
    deliveryLines?: any[];
  }) {
    const approvals = Array.isArray(input.approvals) ? input.approvals : [];
    const currentUser = input.currentUser;
    const gateTypes: ApprovalGateType[] = [
      'quotation_commercial',
      'sales_order_release',
      'procurement_commitment',
      'delivery_release',
      'delivery_completion',
    ];

    return gateTypes.map((gateType) => {
      const gateApprovals = approvals.filter((approval) => approval?.requestType === gateType);
      const pendingApprovals = gateApprovals.filter((approval) => String(approval?.status || '').toLowerCase() === 'pending');
      const latestApproval = gateApprovals[0] || null;
      const pendingApprovers = pendingApprovals.map((approval) => ({
        approvalId: approval.id,
        approverRole: approval.approverRole || null,
        approverUserId: approval.approverUserId || null,
        approverName: approval.approverName || null,
        requestedBy: approval.requestedBy || null,
        requestedByName: approval.requestedByName || null,
        dueDate: approval.dueDate || null,
        actionAvailability: approval.actionAvailability,
      }));
      const currentUserCanDecide = pendingApprovals.some((approval) => canUserApproveRequest(currentUser, approval));
      let canRequest = false;
      let canExecute = false;
      const blockers: string[] = [];

      if (gateType === 'quotation_commercial') {
        const quotationStatus = String(input.latestQuotation?.status || '').toLowerCase();
        canRequest = isBusinessRole(currentUser, ['sales', 'admin', 'director']) && ['draft', 'revision_required'].includes(quotationStatus) && pendingApprovals.length === 0;
        if (!input.latestQuotation?.id) blockers.push('Latest quotation is required.');
      }

      if (gateType === 'sales_order_release') {
        canRequest = isBusinessRole(currentUser, ['project_manager', 'director', 'admin']) && String(input.latestQuotation?.status || '').toLowerCase() === 'won' && String(input.latestSalesOrder?.status || '').toLowerCase() === 'draft' && pendingApprovals.length === 0;
        if (String(input.latestQuotation?.status || '').toLowerCase() !== 'won') blockers.push('Quotation must be won before requesting sales order release.');
        if (!input.latestSalesOrder?.id) blockers.push('Sales order is required.');
      }

      if (gateType === 'procurement_commitment') {
        canRequest = isBusinessRole(currentUser, ['project_manager', 'director', 'admin']) && canStartLogisticsExecution(input.latestSalesOrder?.status) && pendingApprovals.length === 0;
        if (!canStartLogisticsExecution(input.latestSalesOrder?.status)) blockers.push('Released sales order is required before procurement commitment.');
      }

      if (gateType === 'delivery_release') {
        canRequest = isBusinessRole(currentUser, ['project_manager', 'director', 'admin']) && canStartLogisticsExecution(input.latestSalesOrder?.status) && pendingApprovals.length === 0;
        if (!canStartLogisticsExecution(input.latestSalesOrder?.status)) blockers.push('Released sales order is required before delivery release.');
      }

      if (gateType === 'delivery_completion') {
        const completion = canCompleteDelivery((input.deliveryLines || []).map((line: any) => line.status));
        canRequest = isBusinessRole(currentUser, ['project_manager', 'director', 'admin']) && canStartLogisticsExecution(input.latestSalesOrder?.status) && pendingApprovals.length === 0;
        canExecute = isBusinessRole(currentUser, ['sales', 'director', 'admin']) && Boolean(gateApprovals.find((approval) => String(approval?.status || '').toLowerCase() === 'approved')) && completion.ok;
        if (!canStartLogisticsExecution(input.latestSalesOrder?.status)) blockers.push('Released sales order is required before delivery completion.');
        if (completion.ok === false) blockers.push(completion.failure.message);
      }

      return {
        gateType,
        title: GATE_TITLES[gateType],
        status: pendingApprovals.length > 0 ? 'pending' : latestApproval?.status || 'not_requested',
        latestApprovalId: latestApproval?.id || null,
        pendingCount: pendingApprovals.length,
        pendingApprovers,
        currentUserCanDecide,
        actionAvailability: {
          canRequest,
          canExecute,
          blockers,
        },
      };
    });
  }

  function buildWorkspaceActionAvailability(input: {
    currentUser?: Pick<AuthenticatedUser, 'id' | 'roleCodes' | 'systemRole'> | null;
    quotations?: any[];
    salesOrders?: any[];
    gateStates?: any[];
    deliveryLines?: any[];
    documents?: any[];
  }) {
    const latestQuotation = Array.isArray(input.quotations) ? input.quotations[0] : null;
    const latestSalesOrder = Array.isArray(input.salesOrders) ? input.salesOrders[0] : null;
    const gateStates = Array.isArray(input.gateStates) ? input.gateStates : [];
    const documents = Array.isArray(input.documents) ? input.documents : [];
    const releasedSalesOrder = canStartLogisticsExecution(latestSalesOrder?.status);
    const deliveryCompletionGate = gateStates.find((gate) => gate.gateType === 'delivery_completion');
    const quotationCommercialGate = gateStates.find((gate) => gate.gateType === 'quotation_commercial');
    const salesOrderReleaseGate = gateStates.find((gate) => gate.gateType === 'sales_order_release');
    const procurementCommitmentGate = gateStates.find((gate) => gate.gateType === 'procurement_commitment');
    const deliveryReleaseGate = gateStates.find((gate) => gate.gateType === 'delivery_release');
    const releaseTransition = latestSalesOrder
      ? canTransitionSalesOrderStatus({
          currentStatus: latestSalesOrder.status,
          nextStatus: 'released',
          quotationStatus: latestQuotation?.status,
        })
      : { ok: false, failure: { code: 'SALES_ORDER_REQUIRED', message: 'Sales order is required.' } };
    const commercialDocumentBlockers = documents
      .filter((document) => ['missing', 'requested'].includes(String(document?.status || '').toLowerCase()) && ['quoting', 'negotiating', 'commercial_approved', 'won', 'order_released', 'procurement_active'].includes(String(document?.requiredAtStage || '').toLowerCase()))
      .slice(0, 3)
      .map((document) => `${document.documentName || document.documentCode || 'Commercial document'} đang ở trạng thái ${String(document.status || 'missing')}.`);
    const executionDocumentBlockers = documents
      .filter((document) => ['missing', 'requested'].includes(String(document?.status || '').toLowerCase()) && ['order_released', 'procurement_active', 'delivery_active', 'delivery', 'delivery_completed'].includes(String(document?.requiredAtStage || '').toLowerCase()))
      .slice(0, 3)
      .map((document) => `${document.documentName || document.documentCode || 'Execution document'} đang ở trạng thái ${String(document.status || 'missing')}.`);
    const quotationBlockers = [
      ...(!latestQuotation?.id ? ['Latest quotation is required before creating sales order.'] : []),
      ...(canCreateSalesOrderFromQuotation(latestQuotation?.status) ? [] : ['Quotation must be approved or won before creating a sales order.']),
      ...(Array.isArray(quotationCommercialGate?.actionAvailability?.blockers) ? quotationCommercialGate.actionAvailability.blockers : []),
      ...commercialDocumentBlockers,
    ];
    const salesOrderReleaseBlockers = [
      ...(releaseTransition.ok === false ? [releaseTransition.failure.message] : []),
      ...(Array.isArray(salesOrderReleaseGate?.actionAvailability?.blockers) ? salesOrderReleaseGate.actionAvailability.blockers : []),
      ...(salesOrderReleaseGate?.status === 'approved' ? [] : ['Sales order release gate must be approved before releasing the order.']),
      ...executionDocumentBlockers,
    ];
    const logisticsBlockers = [
      ...(releasedSalesOrder ? [] : ['Released sales order is required before logistics execution.']),
      ...(Array.isArray(procurementCommitmentGate?.actionAvailability?.blockers) ? procurementCommitmentGate.actionAvailability.blockers : []),
      ...(Array.isArray(deliveryReleaseGate?.actionAvailability?.blockers) ? deliveryReleaseGate.actionAvailability.blockers : []),
      ...(procurementCommitmentGate?.status === 'approved' ? [] : ['Procurement commitment gate must be approved before recording procurement or inbound activity.']),
      ...(deliveryReleaseGate?.status === 'approved' ? [] : ['Delivery release gate must be approved before recording delivery activity.']),
      ...executionDocumentBlockers,
    ];

    return {
      quotation: {
        latestQuotationId: latestQuotation?.id || null,
        latestQuotationStatus: latestQuotation?.status || null,
        canCreateSalesOrder: isBusinessRole(input.currentUser, ['sales', 'project_manager', 'director', 'admin']) && Boolean(latestQuotation?.id) && canCreateSalesOrderFromQuotation(latestQuotation?.status),
        canRequestCommercialApproval: Boolean(gateStates.find((gate) => gate.gateType === 'quotation_commercial')?.actionAvailability?.canRequest),
        blockers: Array.from(new Set(quotationBlockers)).filter(Boolean),
      },
      salesOrder: {
        latestSalesOrderId: latestSalesOrder?.id || null,
        latestSalesOrderStatus: latestSalesOrder?.status || null,
        canRequestReleaseApproval:
          Boolean(latestSalesOrder?.id) &&
          isBusinessRole(input.currentUser, ['project_manager', 'director', 'admin']) &&
          releaseTransition.ok &&
          Number(salesOrderReleaseGate?.pendingCount || 0) === 0 &&
          salesOrderReleaseGate?.status !== 'approved',
        canReleaseLatest:
          Boolean(latestSalesOrder?.id) &&
          isBusinessRole(input.currentUser, ['director', 'admin']) &&
          releaseTransition.ok &&
          salesOrderReleaseGate?.status === 'approved',
        blockers: Array.from(new Set(salesOrderReleaseBlockers)).filter(Boolean),
      },
      project: {
        canRecordLogistics:
          isBusinessRole(input.currentUser, ['project_manager', 'procurement', 'sales', 'director', 'admin']) &&
          Array.from(new Set(logisticsBlockers)).filter(Boolean).length === 0,
        logisticsBlockers: Array.from(new Set(logisticsBlockers)).filter(Boolean),
        canRequestDeliveryCompletionApproval: Boolean(deliveryCompletionGate?.actionAvailability?.canRequest),
        canFinalizeDeliveryCompletion: Boolean(deliveryCompletionGate?.actionAvailability?.canExecute),
        deliveryCompletionApprovalId: deliveryCompletionGate?.latestApprovalId || null,
        blockers: Array.isArray(deliveryCompletionGate?.actionAvailability?.blockers) ? deliveryCompletionGate.actionAvailability.blockers : [],
      },
    };
  }

  return {
    decorateApprovalForCurrentUser,
    buildApprovalGateStates,
    buildWorkspaceActionAvailability,
  };
}
