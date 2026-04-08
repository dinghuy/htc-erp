export {
  INPUT_STATUSES,
  LEGACY_STATUS_ALIASES,
  VALID_STATUSES,
  allowedTransitions,
  computeIsRemind,
  isApprovalSubmissionStatus,
  isLegacyStatus,
  isWinningQuotationStatus,
  normalizeQuotationInputStatus,
  validateUpdate,
} from './src/shared-kernel/quotationStatus';

export type { ValidStatus } from './src/shared-kernel/quotationStatus';
