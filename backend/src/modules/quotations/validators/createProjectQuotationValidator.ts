import { VALID_STATUSES, type ValidStatus } from '../../../../quotation-status';

export type CreateQuotationValidationResult =
  | { ok: true }
  | {
      ok: false;
      code: 'INVALID_STATUS_TRANSITION';
      message: 'Invalid status';
      allowed: string[];
    };

export function validateCreateProjectQuotationRequest(body: any): CreateQuotationValidationResult {
  const statusRaw = body?.status;
  if (typeof statusRaw !== 'string' || !statusRaw.trim()) {
    return { ok: true };
  }
  const normalizedStatus = statusRaw.trim().toLowerCase();
  if (!VALID_STATUSES.includes(normalizedStatus as ValidStatus)) {
    return {
      ok: false,
      code: 'INVALID_STATUS_TRANSITION',
      message: 'Invalid status',
      allowed: [...VALID_STATUSES],
    };
  }
  return { ok: true };
}
