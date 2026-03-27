export type QuotationSchemaParseResult =
  | { ok: true; normalizedBody: Record<string, unknown> }
  | {
      ok: false;
      httpStatus: 400;
      payload: {
        code: 'INVALID_REQUEST_BODY';
        message: string;
      };
    };

export function parseQuotationBodyAsObject(body: unknown): QuotationSchemaParseResult {
  if (body == null) {
    return { ok: true, normalizedBody: {} };
  }
  if (typeof body !== 'object' || Array.isArray(body)) {
    return {
      ok: false,
      httpStatus: 400,
      payload: {
        code: 'INVALID_REQUEST_BODY',
        message: 'Request body must be an object',
      },
    };
  }
  return { ok: true, normalizedBody: body as Record<string, unknown> };
}
