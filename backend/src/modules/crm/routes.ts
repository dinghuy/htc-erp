import type { Express, Request, Response } from 'express';
import { normalizeGender } from '../../../gender';
import { createCrmRepository } from './repository';
import { createImportReport, parseTabularRowsFromFile } from '../../shared/imports/tabular';

type AsyncRouteFactory = (handler: (req: Request, res: Response) => Promise<unknown>) => any;

type RegisterCrmRoutesDeps = {
  ah: AsyncRouteFactory;
  requireAuth: any;
  requireRole: (...roles: string[]) => any;
  upload: any;
  mapGenderRecord: <T extends { gender?: unknown } | null | undefined>(row: T) => T;
  mapGenderRecords: <T extends Array<{ gender?: unknown }>>(rows: T) => T;
  logAct: (...args: any[]) => Promise<void>;
};

function routeParam(value: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export function registerCrmRoutes(app: Express, deps: RegisterCrmRoutesDeps) {
  const {
    ah,
    requireAuth,
    requireRole,
    upload,
    mapGenderRecord,
    mapGenderRecords,
    logAct,
  } = deps;
  const crmRepository = createCrmRepository();

  app.get('/api/accounts', ah(async (req: Request, res: Response) => {
    res.json(await crmRepository.listAccounts(req.query.type));
  }));

  app.get('/api/accounts/:id', ah(async (req: Request, res: Response) => {
    const row = await crmRepository.findAccountById(routeParam(req.params.id));
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  }));

  app.post('/api/accounts', ah(async (req: Request, res: Response) => {
    const { companyName, region, industry, website, taxCode, address, assignedTo, status = 'active', accountType = 'Customer', code, shortName, description, tag, country } = req.body;
    const result = await crmRepository.insertAccount({ companyName, region, industry, website, taxCode, address, assignedTo, status, accountType, code, shortName, description, tag, country });
    const id = result.lastID;
    await logAct('Tạo khách hàng mới', `Đã thêm ${companyName} vào danh sách ${accountType}`, 'Account', '🏢', '#e0f2fe', '#0284c7', id, 'Account');
    res.status(201).json(await crmRepository.findAccountById(id));
  }));

  app.put('/api/accounts/:id', ah(async (req: Request, res: Response) => {
    const accountId = routeParam(req.params.id);
    const { companyName, region, industry, website, taxCode, address, assignedTo, status, accountType, code, shortName, description, tag, country } = req.body;
    await crmRepository.updateAccountById(accountId, { companyName, region, industry, website, taxCode, address, assignedTo, status, accountType, code, shortName, description, tag, country });
    res.json(await crmRepository.findAccountById(accountId));
  }));

  app.delete('/api/accounts/:id', ah(async (req: Request, res: Response) => {
    await crmRepository.deleteAccountById(routeParam(req.params.id));
    res.json({ success: true });
  }));

  app.post('/api/accounts/import', requireAuth, requireRole('admin', 'manager'), upload.single('file'), ah(async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const rows = parseTabularRowsFromFile(req.file);
    const report = createImportReport(rows.length);

    for (const row of rows) {
      const companyName = row.values.companyName || row.values['Tên công ty'] || row.values['Công ty'] || '';
      if (!companyName.trim()) {
        report.errors += 1;
        report.rows.push({
          rowNumber: row.rowNumber,
          key: null,
          action: 'error',
          messages: ['Thiếu tên công ty'],
        });
        continue;
      }

      try {
        const accountType = (row.values.accountType || row.values['Phân loại'] || row.values['Loại'] || 'Customer').trim();
        const status = row.values.status || row.values['Trạng thái'] || 'active';
        await crmRepository.insertAccount({
          companyName,
          region: row.values.region || row.values['Khu vực'] || '',
          industry: row.values.industry || row.values['Lĩnh vực'] || '',
          website: row.values.website || row.values['Website'] || '',
          taxCode: row.values.taxCode || row.values['Mã số thuế'] || row.values.MST || '',
          address: row.values.address || row.values['Địa chỉ'] || '',
          status,
          accountType: accountType || 'Customer',
          code: row.values.code || row.values['Mã'] || '',
          shortName: row.values.shortName || row.values['Tên viết tắt'] || '',
          description: row.values.description || row.values['Mô tả'] || '',
          tag: row.values.tag || row.values['Ngành hàng'] || '',
          country: row.values.country || row.values['Quốc gia'] || '',
        });

        report.created += 1;
        report.rows.push({
          rowNumber: row.rowNumber,
          key: companyName.trim(),
          action: 'created',
          messages: ['Đã tạo account mới'],
        });
      } catch (error: any) {
        report.errors += 1;
        report.rows.push({
          rowNumber: row.rowNumber,
          key: companyName.trim(),
          action: 'error',
          messages: [error?.message || 'Không thể import account'],
        });
      }
    }

    res.json(report);
  }));

  app.get('/api/contacts', ah(async (req: Request, res: Response) => {
    res.json(mapGenderRecords(await crmRepository.listContacts(req.query.accountId)));
  }));

  app.post('/api/contacts', ah(async (req: Request, res: Response) => {
    const { accountId, lastName, firstName, department, jobTitle, gender, email, phone, isPrimaryContact = false } = req.body;
    const normalizedGender = normalizeGender(gender);
    const result = await crmRepository.insertContact({ accountId, lastName, firstName, department, jobTitle, gender: normalizedGender, email, phone, isPrimaryContact: isPrimaryContact ? 1 : 0 });
    const id = result.lastID;
    res.status(201).json(mapGenderRecord(await crmRepository.findContactById(id)));
  }));

  app.put('/api/contacts/:id', ah(async (req: Request, res: Response) => {
    const contactId = routeParam(req.params.id);
    const { lastName, firstName, department, jobTitle, gender, email, phone, isPrimaryContact } = req.body;
    const normalizedGender = normalizeGender(gender);
    await crmRepository.updateContactById(contactId, { lastName, firstName, department, jobTitle, gender: normalizedGender, email, phone, isPrimaryContact: isPrimaryContact ? 1 : 0 });
    res.json(mapGenderRecord(await crmRepository.findContactById(contactId)));
  }));

  app.delete('/api/contacts/:id', ah(async (req: Request, res: Response) => {
    await crmRepository.deleteContactById(routeParam(req.params.id));
    res.json({ success: true });
  }));

  app.get('/api/leads', ah(async (_req: Request, res: Response) => {
    res.json(await crmRepository.listLeads());
  }));

  app.get('/api/leads/:id', ah(async (req: Request, res: Response) => {
    const row = await crmRepository.findLeadById(routeParam(req.params.id));
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  }));

  app.post('/api/leads', ah(async (req: Request, res: Response) => {
    const { companyName, contactName, email, phone, status = 'New', source } = req.body;
    const result = await crmRepository.insertLead({ companyName, contactName, email, phone, status, source });
    const id = result.lastID;
    await logAct('Tạo Lead mới', `Khách tiềm năng: ${companyName}`, 'Lead', '🎯', '#fce7f3', '#db2777', id, 'Lead');
    res.status(201).json(await crmRepository.findLeadById(id));
  }));

  app.put('/api/leads/:id', ah(async (req: Request, res: Response) => {
    const leadId = routeParam(req.params.id);
    const { companyName, contactName, email, phone, status, source } = req.body;
    await crmRepository.updateLeadById(leadId, { companyName, contactName, email, phone, status, source });
    res.json(await crmRepository.findLeadById(leadId));
  }));

  app.delete('/api/leads/:id', ah(async (req: Request, res: Response) => {
    await crmRepository.deleteLeadById(routeParam(req.params.id));
    res.json({ success: true });
  }));

  app.post('/api/leads/import', requireAuth, requireRole('admin', 'manager'), upload.single('file'), ah(async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const rows = parseTabularRowsFromFile(req.file);
    const report = createImportReport(rows.length);

    for (const row of rows) {
      const companyName = row.values.companyName || row.values['Công ty'] || '';
      const contactName = row.values.contactName || row.values['Liên hệ'] || '';
      const messages: string[] = [];
      if (!companyName.trim()) messages.push('Thiếu tên công ty');
      if (!contactName.trim()) messages.push('Thiếu người liên hệ');

      if (messages.length > 0) {
        report.errors += 1;
        report.rows.push({
          rowNumber: row.rowNumber,
          key: companyName.trim() || null,
          action: 'error',
          messages,
        });
        continue;
      }

      try {
        await crmRepository.insertLead({
          companyName,
          contactName,
          email: row.values.email || '',
          phone: row.values.phone || '',
          status: row.values.status || row.values['Trạng thái'] || 'New',
          source: row.values.source || row.values['Nguồn'] || 'CSV/XLSX Import',
        });

        report.created += 1;
        report.rows.push({
          rowNumber: row.rowNumber,
          key: companyName.trim(),
          action: 'created',
          messages: ['Đã tạo lead mới'],
        });
      } catch (error: any) {
        report.errors += 1;
        report.rows.push({
          rowNumber: row.rowNumber,
          key: companyName.trim(),
          action: 'error',
          messages: [error?.message || 'Không thể import lead'],
        });
      }
    }

    res.json(report);
  }));
}
