import type { Express, Request, Response } from 'express';
import { parse as parseCsv } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
import { getDb } from '../../../sqlite-db';
import { normalizeGender } from '../../../gender';

type AsyncRouteFactory = (handler: (req: Request, res: Response) => Promise<unknown>) => any;

type RegisterPlatformSystemRoutesDeps = {
  ah: AsyncRouteFactory;
  requireAuth: any;
  requireRole: (...roles: string[]) => any;
};

function parseJsonArray(raw: unknown) {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseJsonObject(raw: unknown) {
  if (typeof raw !== 'string' || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function escapeCsv(value: unknown) {
  const normalized = String(value ?? '').replace(/"/g, '""');
  return `"${normalized}"`;
}

function joinAssetUrls(raw: unknown, options?: { primaryFirst?: boolean }) {
  const entries = parseJsonArray(raw);
  const orderedEntries = options?.primaryFirst
    ? [...entries].sort((left: any, right: any) => Number(Boolean(right?.isPrimary)) - Number(Boolean(left?.isPrimary)))
    : entries;

  return orderedEntries
    .map((entry: any) => String(entry?.url ?? '').trim())
    .filter(Boolean)
    .join('|');
}

function sendWorkbook(res: Response, filename: string, rows: Record<string, unknown>[]) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
}

const csvTemplates: Record<string, { filename: string; header: string }> = {
  accounts: {
    filename: 'template_khach_hang.csv',
    header: 'companyName,shortName,accountType,industry,region,website,taxCode,address,code,description,tag,country,status\nCảng Hải Phòng,CHP,Customer,Khai thác cảng biển,Miền Bắc,haiphongport.com.vn,0200123456,Số 1 Hoàng Diệu Hải Phòng,,,Cảng biển,Việt Nam,active\n',
  },
  products: {
    filename: 'template_san_pham.csv',
    header: 'sku,name,category,unit,basePrice,currency,technicalSpecs,status,qbu.exWorks,qbu.shipping,qbu.importTax,qbu.customFees,qbu.other,imageUrls,videoUrls,documentUrls\nPC1250-8,Komatsu PC1250-8,Máy xúc,Chiếc,2850000,USD,Động cơ diesel 700HP,available,2500000,120000,80000,15000,5000,https://example.com/pc1250-hero.webp|https://example.com/pc1250-side.png,https://example.com/pc1250-demo.mp4,https://example.com/pc1250-brochure.pdf|https://example.com/pc1250-datasheet.pdf\n',
  },
  leads: {
    filename: 'template_leads.csv',
    header: 'companyName,contactName,email,phone,status,source\nCảng Đà Nẵng,Nguyễn Văn A,nva@danangport.vn,0905123456,New,Website\n',
  },
  suppliers: {
    filename: 'template_nha_cung_cap.csv',
    header: 'code,company,description,tag,country,status\nKOM-JP,Komatsu Japan,Nhà sản xuất máy xúc,"Heavy Equipment, Excavators, Spare Parts",Japan,active\n',
  },
  users: {
    filename: 'template_nhan_vien.csv',
    header: 'fullName,gender,email,phone,role,department,status\nNguyễn Văn A,male,nva@huynhthy.com,0901234567,Sales Executive,KINH DOANH,Active\n',
  },
  contacts: {
    filename: 'template_lien_he.csv',
    header: 'lastName,firstName,department,jobTitle,gender,email,phone\nNguyễn,Văn A,Phòng Mua hàng,Trưởng phòng,male,nguyenvana@company.vn,0901123456\n',
  },
};

export function registerPlatformSystemRoutes(app: Express, deps: RegisterPlatformSystemRoutesDeps) {
  const { ah, requireAuth, requireRole } = deps;

  app.get('/api/settings', ah(async (_req: Request, res: Response) => {
    const db = getDb();
    const rows = await db.all('SELECT * FROM SystemSetting');
    const settings: Record<string, unknown> = {};
    rows.forEach((row: any) => {
      settings[row.key] = row.value;
    });
    res.json(settings);
  }));

  app.post('/api/settings', requireAuth, requireRole('admin'), ah(async (req: Request, res: Response) => {
    const db = getDb();
    const settings = req.body;
    for (const key of Object.keys(settings)) {
      await db.run('INSERT OR REPLACE INTO SystemSetting (key, value) VALUES (?, ?)', [key, String(settings[key])]);
    }
    res.json({ success: true });
  }));

  app.get('/api/template/:type', (req: Request, res: Response) => {
    const tpl = csvTemplates[req.params.type as string];
    const format = String(req.query.format || 'csv').toLowerCase();
    if (!tpl) {
      return res.status(404).json({ error: 'Template not found. Available: accounts, contacts, products, leads, suppliers, users' });
    }
    if (format === 'xlsx') {
      const rows = parseCsv(tpl.header, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, unknown>[];
      return sendWorkbook(res, tpl.filename.replace(/\.csv$/i, '.xlsx'), rows);
    }
    res.setHeader('Content-Disposition', `attachment; filename="${tpl.filename}"`);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.send('\uFEFF' + tpl.header);
  });

  app.get('/api/:type/export', ah(async (req: Request, res: Response) => {
    const { type } = req.params;
    const format = String(req.query.format || 'csv').toLowerCase();
    const db = getDb();
    let records: Record<string, unknown>[] = [];
    let filename = `export_${type}.${format === 'xlsx' ? 'xlsx' : 'csv'}`;
    let columns: string[] = [];

    if (type === 'accounts') {
      columns = ['companyName', 'shortName', 'accountType', 'industry', 'region', 'website', 'taxCode', 'address', 'code', 'description', 'tag', 'country', 'status'];
      records = await db.all('SELECT companyName, shortName, accountType, industry, region, website, taxCode, address, code, description, tag, country, status FROM Account');
    } else if (type === 'products') {
      columns = ['sku', 'name', 'category', 'unit', 'basePrice', 'currency', 'technicalSpecs', 'status', 'qbu.exWorks', 'qbu.shipping', 'qbu.importTax', 'qbu.customFees', 'qbu.other', 'imageUrls', 'videoUrls', 'documentUrls'];
      const rows = await db.all('SELECT sku, name, category, unit, basePrice, currency, technicalSpecs, status, qbuData, productImages, productVideos, productDocuments FROM Product');
      records = rows.map((r) => {
        const qbuData = parseJsonObject(r.qbuData);
        return {
          sku: r.sku,
          name: r.name,
          category: r.category,
          unit: r.unit,
          basePrice: Number(r.basePrice ?? 0),
          currency: r.currency,
          technicalSpecs: r.technicalSpecs,
          status: r.status,
          'qbu.exWorks': Number(qbuData.exWorks ?? 0),
          'qbu.shipping': Number(qbuData.shipping ?? 0),
          'qbu.importTax': Number(qbuData.importTax ?? 0),
          'qbu.customFees': Number(qbuData.customFees ?? 0),
          'qbu.other': Number(qbuData.other ?? 0),
          imageUrls: joinAssetUrls(r.productImages, { primaryFirst: true }),
          videoUrls: joinAssetUrls(r.productVideos),
          documentUrls: joinAssetUrls(r.productDocuments),
        };
      });
    } else if (type === 'leads') {
      columns = ['companyName', 'contactName', 'email', 'phone', 'status', 'source'];
      records = await db.all('SELECT companyName, contactName, email, phone, status, source FROM Lead');
    } else if (type === 'users') {
      columns = ['fullName', 'gender', 'email', 'phone', 'role', 'department', 'status'];
      records = (await db.all('SELECT fullName, gender, email, phone, role, department, status FROM User')).map((row: any) => ({
        ...row,
        gender: normalizeGender(row.gender),
      }));
    } else if (type === 'contacts') {
      columns = ['lastName', 'firstName', 'department', 'jobTitle', 'gender', 'email', 'phone'];
      records = (await db.all('SELECT lastName, firstName, department, jobTitle, gender, email, phone FROM Contact')).map((row: any) => ({
        ...row,
        gender: normalizeGender(row.gender),
      }));
    } else if (type === 'suppliers') {
      columns = ['code', 'company', 'description', 'tag', 'country', 'status'];
      records = (await db.all("SELECT code, companyName, description, tag, country, status FROM Account WHERE accountType = 'Supplier' ORDER BY companyName")).map((row: any) => ({
        code: row.code,
        company: row.companyName,
        description: row.description,
        tag: row.tag,
        country: row.country,
        status: row.status,
      }));
    } else {
      return res.status(404).json({ error: 'Export type not supported' });
    }

    if (format === 'xlsx') {
      return sendWorkbook(res, filename, records);
    }

    const header = `${columns.join(',')}\n`;
    const rows = records.map((record) => columns.map((column) => {
      const value = record[column];
      return typeof value === 'number' ? String(value) : escapeCsv(value);
    }).join(','));

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.send('\uFEFF' + header + rows.join('\n'));
  }));
}
