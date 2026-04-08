export type ApprovalOwnerRole = 'sales' | 'project_manager' | 'procurement' | 'accounting' | 'legal' | 'director';
export type ApprovalGateType =
  | 'quotation_commercial'
  | 'sales_order_release'
  | 'procurement_commitment'
  | 'delivery_release'
  | 'delivery_completion';
export type DeliveryLineStatus = 'delivered' | 'closed';
export type SalesOrderStatus = 'draft' | 'released' | 'locked_for_execution' | 'cancelled';

export type WorkflowGuardFailure = {
  code: string;
  message: string;
};

export type WorkflowTransitionResult =
  | { ok: true }
  | { ok: false; failure: WorkflowGuardFailure };

export type ApprovalOwnerOptions = {
  requireFinanceReview?: boolean;
  requireLegalReview?: boolean;
  requireProcurementReview?: boolean;
};

export type SalesOrderTransitionInput = {
  currentStatus: string | null | undefined;
  nextStatus: string | null | undefined;
  quotationStatus: string | null | undefined;
};

export type HandoffActivationInput = {
  quotationId?: string | null;
  quotationStatus?: string | null | undefined;
  salesOrderId?: string | null;
  salesOrderStatus?: string | null | undefined;
  releaseGateStatus?: string | null | undefined;
  canCreateSalesOrder?: boolean;
  canRequestReleaseApproval?: boolean;
  canReleaseSalesOrder?: boolean;
  quotationBlockers?: unknown;
  salesOrderBlockers?: unknown;
};

export type HandoffActivationStatus =
  | 'blocked'
  | 'ready_to_create_sales_order'
  | 'awaiting_release_approval'
  | 'ready_to_release'
  | 'activated';

export type HandoffActivation = {
  status: HandoffActivationStatus;
  isActivated: boolean;
  nextActionKey: 'create_sales_order' | 'request_sales_order_release_approval' | 'release_sales_order' | null;
  nextActionLabel: string | null;
  blockers: string[];
};

export function normalizeValue(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeId(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function normalizeBlockers(value: unknown) {
  return Array.from(
    new Set(
      (Array.isArray(value) ? value : [])
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean),
    ),
  );
}

export function normalizeLegacyQuotationStatus(value: unknown) {
  const normalized = normalizeValue(value);
  if (normalized === 'sent') return 'submitted_for_approval';
  if (normalized === 'accepted') return 'won';
  if (normalized === 'expired') return 'lost';
  return normalized;
}

export function canCreateSalesOrderFromQuotation(quotationStatus: unknown) {
  const normalized = normalizeLegacyQuotationStatus(quotationStatus);
  return normalized === 'approved' || normalized === 'won';
}

export function canTransitionSalesOrderStatus(input: SalesOrderTransitionInput): WorkflowTransitionResult {
  const currentStatus = normalizeValue(input.currentStatus) || 'draft';
  const nextStatus = normalizeValue(input.nextStatus);
  const quotationStatus = normalizeLegacyQuotationStatus(input.quotationStatus);

  if (!nextStatus) {
    return { ok: false, failure: { code: 'INVALID_STATUS', message: 'Missing sales order status' } };
  }
  if (nextStatus === currentStatus) {
    return { ok: true };
  }
  if (nextStatus === 'released') {
    if (currentStatus !== 'draft') {
      return { ok: false, failure: { code: 'INVALID_TRANSITION', message: 'Only draft sales orders can be released' } };
    }
    if (quotationStatus !== 'won') {
      return { ok: false, failure: { code: 'QUOTATION_NOT_WON', message: 'Quotation must be won before releasing a sales order' } };
    }
    return { ok: true };
  }
  if (nextStatus === 'locked_for_execution') {
    if (currentStatus !== 'released') {
      return { ok: false, failure: { code: 'INVALID_TRANSITION', message: 'Only released sales orders can be locked for execution' } };
    }
    return { ok: true };
  }
  if (nextStatus === 'cancelled') {
    return { ok: true };
  }

  return { ok: false, failure: { code: 'INVALID_STATUS', message: 'Unsupported sales order status transition' } };
}

export function canStartLogisticsExecution(status: unknown) {
  const normalized = normalizeValue(status);
  return normalized === 'released' || normalized === 'locked_for_execution';
}

export function resolveHandoffActivation(input: HandoffActivationInput): HandoffActivation {
  const quotationId = normalizeId(input.quotationId);
  const salesOrderId = normalizeId(input.salesOrderId);
  const salesOrderStatus = normalizeValue(input.salesOrderStatus);
  const releaseGateStatus = normalizeValue(input.releaseGateStatus) || 'not_requested';
  const quotationBlockers = normalizeBlockers(input.quotationBlockers);
  const salesOrderBlockers = normalizeBlockers(input.salesOrderBlockers);
  const activated = canStartLogisticsExecution(salesOrderStatus);

  if (activated) {
    return {
      status: 'activated',
      isActivated: true,
      nextActionKey: null,
      nextActionLabel: null,
      blockers: [],
    };
  }

  if (Boolean(input.canCreateSalesOrder) && quotationId && !salesOrderId) {
    return {
      status: 'ready_to_create_sales_order',
      isActivated: false,
      nextActionKey: 'create_sales_order',
      nextActionLabel: 'Tạo sales order',
      blockers: quotationBlockers,
    };
  }

  if (salesOrderId && (Boolean(input.canReleaseSalesOrder) || releaseGateStatus === 'approved')) {
    return {
      status: 'ready_to_release',
      isActivated: false,
      nextActionKey: Boolean(input.canReleaseSalesOrder) ? 'release_sales_order' : null,
      nextActionLabel: Boolean(input.canReleaseSalesOrder) ? 'Phát hành sales order' : null,
      blockers: salesOrderBlockers,
    };
  }

  if (salesOrderId) {
    return {
      status: 'awaiting_release_approval',
      isActivated: false,
      nextActionKey: Boolean(input.canRequestReleaseApproval) ? 'request_sales_order_release_approval' : null,
      nextActionLabel: Boolean(input.canRequestReleaseApproval) ? 'Tạo phê duyệt release sales order' : null,
      blockers: salesOrderBlockers,
    };
  }

  return {
    status: 'blocked',
    isActivated: false,
    nextActionKey: null,
    nextActionLabel: null,
    blockers: quotationBlockers.length ? quotationBlockers : salesOrderBlockers,
  };
}

export function canCompleteDelivery(statuses: unknown[]): WorkflowTransitionResult {
  const normalized = Array.isArray(statuses) ? statuses.map(normalizeValue).filter(Boolean) : [];
  if (normalized.length === 0) {
    return { ok: false, failure: { code: 'DELIVERY_LINES_REQUIRED', message: 'Delivery completion requires at least one delivery line' } };
  }
  const allowed: DeliveryLineStatus[] = ['delivered', 'closed'];
  const hasBlockingStatus = normalized.some((status) => !allowed.includes(status as DeliveryLineStatus));
  if (hasBlockingStatus) {
    return { ok: false, failure: { code: 'DELIVERY_NOT_COMPLETE', message: 'All delivery lines must be delivered or closed' } };
  }
  return { ok: true };
}

export function resolveApprovalOwners(gateType: ApprovalGateType, options: ApprovalOwnerOptions): {
  ownerRole: ApprovalOwnerRole;
  requiredApprovers: ApprovalOwnerRole[];
  optionalApprovers: ApprovalOwnerRole[];
} {
  switch (gateType) {
    case 'quotation_commercial':
      return {
        ownerRole: 'sales',
        requiredApprovers: ['director'],
        optionalApprovers: [
          ...(options.requireFinanceReview ? (['accounting'] as ApprovalOwnerRole[]) : []),
          ...(options.requireLegalReview ? (['legal'] as ApprovalOwnerRole[]) : []),
        ],
      };
    case 'sales_order_release':
      return {
        ownerRole: 'project_manager',
        requiredApprovers: ['director'],
        optionalApprovers: [
          ...(options.requireFinanceReview ? (['accounting'] as ApprovalOwnerRole[]) : []),
          ...(options.requireLegalReview ? (['legal'] as ApprovalOwnerRole[]) : []),
        ],
      };
    case 'procurement_commitment':
      return {
        ownerRole: 'project_manager',
        requiredApprovers: ['procurement'],
        optionalApprovers: options.requireFinanceReview ? ['accounting'] : [],
      };
    case 'delivery_release':
      return {
        ownerRole: 'project_manager',
        requiredApprovers: ['director'],
        optionalApprovers: options.requireProcurementReview ? ['procurement'] : [],
      };
    case 'delivery_completion':
      return {
        ownerRole: 'project_manager',
        requiredApprovers: ['sales', 'director'],
        optionalApprovers: [],
      };
    default:
      return {
        ownerRole: 'project_manager',
        requiredApprovers: ['director'],
        optionalApprovers: [],
      };
  }
}

export function resolveReleasedSalesOrderStatus(current: unknown): SalesOrderStatus | null {
  const normalized = normalizeValue(current);
  if (normalized === 'released' || normalized === 'locked_for_execution') {
    return normalized as SalesOrderStatus;
  }
  return null;
}
