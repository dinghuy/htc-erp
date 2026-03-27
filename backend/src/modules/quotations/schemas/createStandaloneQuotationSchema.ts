import { parseQuotationBodyAsObject } from './common';

export function parseCreateStandaloneQuotationBody(body: unknown) {
  return parseQuotationBodyAsObject(body);
}
