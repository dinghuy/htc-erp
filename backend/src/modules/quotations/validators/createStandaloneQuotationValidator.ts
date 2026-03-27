import { INPUT_STATUSES, normalizeQuotationInputStatus } from '../../../../quotation-status';
import type { CreateQuotationValidationResult } from './createProjectQuotationValidator';

export function validateCreateStandaloneQuotationRequest(body: any): CreateQuotationValidationResult {
  const statusRaw = body?.status;
  if (typeof statusRaw !== 'string' || !statusRaw.trim()) {
    return { ok: true };
  }
  if (!normalizeQuotationInputStatus(statusRaw)) {
    return {
      ok: false,
      code: 'INVALID_STATUS_TRANSITION',
      message: 'Invalid status',
      allowed: [...INPUT_STATUSES],
    };
  }
  return { ok: true };
}
