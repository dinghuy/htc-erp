import { parseQuotationBodyAsObject } from './common';

export function parseCreateProjectQuotationBody(body: unknown) {
  return parseQuotationBodyAsObject(body);
}
