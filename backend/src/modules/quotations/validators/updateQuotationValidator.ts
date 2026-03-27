import { validateUpdate } from '../../../../quotation-status';

type UpdateQuotationValidationInput = {
  currentStatus?: string;
  body: any;
};

export type UpdateQuotationValidationResult =
  | {
      ok: true;
      hasStatusField: boolean;
      nextStatus: unknown;
    }
  | {
      ok: false;
      httpStatus: 400 | 409;
      payload: {
        code: 'INVALID_STATUS_TRANSITION' | 'READ_ONLY' | 'STATUS_CONFLICT';
        message: string;
        allowed?: string[];
        currentStatus?: string;
      };
    };

export function validateUpdateQuotationRequest(input: UpdateQuotationValidationInput): UpdateQuotationValidationResult {
  const hasStatusField = Object.prototype.hasOwnProperty.call(input.body || {}, 'status');
  const expectedStatus = input.body?.expectedStatus;
  const nextStatus = hasStatusField ? input.body?.status : input.currentStatus;
  const validation = validateUpdate({
    currentStatus: input.currentStatus,
    nextStatus,
    expectedStatus,
    hasStatusField,
  });
  if (!validation.ok) {
    const httpStatus = validation.code === 'STATUS_CONFLICT' ? 409 : 400;
    const message = validation.code === 'STATUS_CONFLICT'
      ? 'Status conflict'
      : (validation.code === 'READ_ONLY' ? 'Quotation is read-only' : 'Invalid status transition');
    return {
      ok: false,
      httpStatus,
      payload: {
        code: validation.code!,
        message,
        allowed: validation.allowed,
        currentStatus: validation.currentStatus,
      },
    };
  }

  return {
    ok: true,
    hasStatusField,
    nextStatus,
  };
}
