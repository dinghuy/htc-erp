import { computeIsRemind } from '../../../quotation-status';
import { createQuotationRepository } from './repository';

const quotationRepository = createQuotationRepository();

export async function listQuotations() {
  const rows = await quotationRepository.listDetailed();
  const nowMs = Date.now();
  return rows.map((row: any) => ({ ...row, isRemind: computeIsRemind(row.status, row.createdAt, nowMs) }));
}

export async function getQuotationById(id: string) {
  const row = await quotationRepository.findDetailedById(id);
  if (!row) return null;
  return { ...row, isRemind: computeIsRemind(row.status, row.createdAt) };
}
