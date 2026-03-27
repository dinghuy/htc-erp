import type {
  ApprovalGateType,
  ApprovalOwnerRole,
  DeliveryLineStatus,
  SalesOrderStatus,
  WorkflowTransitionResult,
} from './contracts';

type ApprovalOwnerOptions = {
  requireFinanceReview?: boolean;
  requireLegalReview?: boolean;
  requireProcurementReview?: boolean;
};

type SalesOrderTransitionInput = {
  currentStatus: string | null | undefined;
  nextStatus: string | null | undefined;
  quotationStatus: string | null | undefined;
};

function normalizeValue(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
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
