import { parseQuotationBodyAsObject } from './common';

export function parseUpdateQuotationBody(body: unknown) {
  return parseQuotationBodyAsObject(body);
}
