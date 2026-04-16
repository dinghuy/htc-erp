import { v4 as uuidv4 } from 'uuid';
import { createImportReport, parseTabularRowsFromFile } from '../../shared/imports/tabular';
import { supplierRepository, type SupplierRow } from './repository';

type SupplierMapper = (row: SupplierRow | null | undefined) => any;
type SupplierTagSerializer = (raw: unknown) => string;

type CreateSupplierServiceDeps = {
  hydrateSupplier: SupplierMapper;
  serializeSupplierTags: SupplierTagSerializer;
};

export function createSupplierService(deps: CreateSupplierServiceDeps) {
  const { hydrateSupplier, serializeSupplierTags } = deps;

  return {
    async listSuppliers() {
      const rows = await supplierRepository.findAll() as SupplierRow[];
      return rows.map((row) => hydrateSupplier(row));
    },

    async createSupplier(input: Record<string, unknown>) {
      const normalizedTagString = serializeSupplierTags(input.productTags ?? input.tag);
      const created = await supplierRepository.create({
        id: uuidv4(),
        companyName: String(input.companyName ?? input.company ?? ''),
        code: String(input.code ?? ''),
        description: String(input.description ?? ''),
        tag: normalizedTagString,
        country: String(input.country ?? ''),
        status: String(input.status ?? 'active'),
      });
      return hydrateSupplier(created);
    },

    async updateSupplier(id: string, input: Record<string, unknown>) {
      const normalizedTagString = serializeSupplierTags(input.productTags ?? input.tag);
      const updated = await supplierRepository.update(id, {
        companyName: String(input.companyName ?? input.company ?? ''),
        code: String(input.code ?? ''),
        description: String(input.description ?? ''),
        tag: normalizedTagString,
        country: String(input.country ?? ''),
        status: String(input.status ?? ''),
      });
      return hydrateSupplier(updated);
    },

    deleteSupplier(id: string) {
      return supplierRepository.deleteById(id);
    },

    async importSuppliers(file: Express.Multer.File) {
      const rows = parseTabularRowsFromFile(file);
      const report = createImportReport(rows.length);

      for (const row of rows) {
        const company = row.values.company || row.values['Tên NCC'] || '';
        if (!company.trim()) {
          report.errors += 1;
          report.rows.push({
            rowNumber: row.rowNumber,
            key: null,
            action: 'error',
            messages: ['Thiếu tên nhà cung cấp'],
          });
          continue;
        }

        try {
          await supplierRepository.insertImportedSupplier({
            id: uuidv4(),
            code: row.values.code || row.values['Mã'] || '',
            companyName: company,
            description: row.values.description || row.values['Mô tả'] || '',
            tag: serializeSupplierTags(row.values.productTags || row.values.tag || row.values['Ngành hàng'] || ''),
            country: row.values.country || row.values['Quốc gia'] || '',
            status: row.values.status || row.values['Trạng thái'] || 'active',
          });

          report.created += 1;
          report.rows.push({
            rowNumber: row.rowNumber,
            key: company.trim(),
            action: 'created',
            messages: ['Đã tạo nhà cung cấp mới'],
          });
        } catch (error: any) {
          report.errors += 1;
          report.rows.push({
            rowNumber: row.rowNumber,
            key: company.trim(),
            action: 'error',
            messages: [error?.message || 'Không thể import nhà cung cấp'],
          });
        }
      }

      return report;
    },
  };
}
