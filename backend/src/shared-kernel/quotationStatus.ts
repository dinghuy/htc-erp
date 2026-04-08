import { normalizeLegacyQuotationStatus } from './revenueFlow';

export const VALID_STATUSES = [
  'draft',
  'submitted_for_approval',
  'revision_required',
  'approved',
  'rejected',
  'won',
  'lost',
] as const;

export type ValidStatus = (typeof VALID_STATUSES)[number];

export const LEGACY_STATUS_ALIASES: Record<string, ValidStatus> = {
  sent: 'submitted_for_approval',
  accepted: 'won',
  expired: 'lost',
};

export const INPUT_STATUSES = [...VALID_STATUSES, ...Object.keys(LEGACY_STATUS_ALIASES)] as const;

export function normalizeQuotationInputStatus(status?: string | null): ValidStatus | '' {
  const normalized = normalizeLegacyQuotationStatus(status);
  if (!normalized) return '';
  if (VALID_STATUSES.includes(normalized as ValidStatus)) return normalized as ValidStatus;
  return LEGACY_STATUS_ALIASES[normalized] || '';
}

export function isLegacyStatus(status?: string) {
  return !normalizeQuotationInputStatus(status);
}

export function isApprovalSubmissionStatus(status?: string | null) {
  return normalizeQuotationInputStatus(status) === 'submitted_for_approval';
}

export function isWinningQuotationStatus(status?: string | null) {
  return normalizeQuotationInputStatus(status) === 'won';
}

export function computeIsRemind(status: string, createdAt?: string, nowMs = Date.now()) {
  if (normalizeQuotationInputStatus(status) !== 'submitted_for_approval') return false;
  if (!createdAt) return false;
  const createdMs = Date.parse(createdAt);
  if (!Number.isFinite(createdMs)) return false;
  if (createdMs > nowMs) return false;
  const diffMs = nowMs - createdMs;
  return diffMs >= 14 * 24 * 60 * 60 * 1000;
}

type ValidateInput = {
  currentStatus?: string;
  nextStatus?: string;
  expectedStatus?: string;
  hasStatusField?: boolean;
};

type ValidateResult = {
  ok: boolean;
  code?: 'INVALID_STATUS_TRANSITION' | 'READ_ONLY' | 'STATUS_CONFLICT';
  allowed?: string[];
  currentStatus?: string;
};

export function allowedTransitions(currentStatus?: string) {
  const normalizedCurrent = normalizeQuotationInputStatus(currentStatus);
  if (normalizedCurrent === 'draft') return ['submitted_for_approval'];
  if (normalizedCurrent === 'submitted_for_approval') return ['approved', 'rejected', 'revision_required'];
  if (normalizedCurrent === 'revision_required') return ['submitted_for_approval'];
  if (normalizedCurrent === 'approved') return ['won', 'lost'];
  return [];
}

export function validateUpdate({ currentStatus, nextStatus, expectedStatus, hasStatusField = true }: ValidateInput): ValidateResult {
  const normalizedCurrent = normalizeQuotationInputStatus(currentStatus);
  const normalizedExpected = normalizeQuotationInputStatus(expectedStatus);
  const normalizedNext = normalizeQuotationInputStatus(nextStatus);

  if (!normalizedCurrent) return { ok: false, code: 'READ_ONLY', allowed: [] };
  if (['won', 'lost', 'rejected'].includes(normalizedCurrent)) return { ok: false, code: 'READ_ONLY', allowed: [] };
  if (normalizedExpected && normalizedExpected !== normalizedCurrent) return { ok: false, code: 'STATUS_CONFLICT', currentStatus: normalizedCurrent };

  if (!hasStatusField) return { ok: true };
  if (!normalizedNext) {
    return { ok: false, code: 'INVALID_STATUS_TRANSITION', allowed: allowedTransitions(normalizedCurrent) };
  }
  if (normalizedNext === normalizedCurrent) return { ok: true };

  const allowed = allowedTransitions(normalizedCurrent);
  if (!allowed.includes(normalizedNext)) return { ok: false, code: 'INVALID_STATUS_TRANSITION', allowed };
  return { ok: true };
}
