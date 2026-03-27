import type { Express, Request, Response } from 'express';
import { getDb } from '../../../sqlite-db';
import { normalizeGender } from '../../../gender';

type AsyncRouteFactory = (handler: (req: Request, res: Response) => Promise<unknown>) => any;

type RegisterPlatformSystemRoutesDeps = {
  ah: AsyncRouteFactory;
  requireAuth: any;
  requireRole: (...roles: string[]) => any;
};

const csvTemplates: Record<string, { filename: string; header: string }> = {
  accounts: {
    filename: 'template_khach_hang.csv',
    header: 'companyName,shortName,accountType,industry,region,website,taxCode,address,code,description,tag,country,status\nCảng Hải Phòng,CHP,Customer,Khai thác cảng biển,Miền Bắc,haiphongport.com.vn,0200123456,Số 1 Hoàng Diệu Hải Phòng,,,Cảng biển,Việt Nam,active\n',
  },
  products: {
    filename: 'template_san_pham.csv',
    header: 'sku,name,category,unit,basePrice,currency,technicalSpecs,status\nPC1250-8,Komatsu PC1250-8,Máy xúc,Chiếc,2850000,USD,Động cơ diesel 700HP,available\n',
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
    if (!tpl) {
      return res.status(404).json({ error: 'Template not found. Available: accounts, contacts, products, leads, suppliers, users' });
    }
    res.setHeader('Content-Disposition', `attachment; filename="${tpl.filename}"`);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.send('\uFEFF' + tpl.header);
  });

  app.get('/api/:type/export', ah(async (req: Request, res: Response) => {
    const { type } = req.params;
    const db = getDb();
    let rows: any[] = [];
    let filename = `export_${type}.csv`;
    let header = '';

    if (type === 'accounts') {
      rows = await db.all('SELECT companyName, shortName, accountType, industry, region, website, taxCode, address, code, description, tag, country, status FROM Account');
      header = 'companyName,shortName,accountType,industry,region,website,taxCode,address,code,description,tag,country,status\n';
      rows = rows.map(r => `"${r.companyName}","${r.shortName}","${r.accountType}","${r.industry}","${r.region}","${r.website}","${r.taxCode}","${r.address}","${r.code}","${r.description}","${r.tag}","${r.country}","${r.status}"`);
    } else if (type === 'products') {
      rows = await db.all('SELECT sku, name, category, unit, basePrice, currency, technicalSpecs, status FROM Product');
      header = 'sku,name,category,unit,basePrice,currency,technicalSpecs,status\n';
      rows = rows.map(r => `"${r.sku}","${r.name}","${r.category}","${r.unit}",${r.basePrice},"${r.currency}","${r.technicalSpecs}","${r.status}"`);
    } else if (type === 'leads') {
      rows = await db.all('SELECT companyName, contactName, email, phone, status, source FROM Lead');
      header = 'companyName,contactName,email,phone,status,source\n';
      rows = rows.map(r => `"${r.companyName}","${r.contactName}","${r.email}","${r.phone}","${r.status}","${r.source}"`);
    } else if (type === 'users') {
      rows = await db.all('SELECT fullName, gender, email, phone, role, department, status FROM User');
      header = 'fullName,gender,email,phone,role,department,status\n';
      rows = rows.map(r => `"${r.fullName}","${normalizeGender(r.gender)}","${r.email}","${r.phone}","${r.role}","${r.department}","${r.status}"`);
    } else if (type === 'contacts') {
      rows = await db.all('SELECT lastName, firstName, department, jobTitle, gender, email, phone FROM Contact');
      header = 'lastName,firstName,department,jobTitle,gender,email,phone\n';
      rows = rows.map(r => `"${r.lastName}","${r.firstName}","${r.department}","${r.jobTitle}","${normalizeGender(r.gender)}","${r.email}","${r.phone}"`);
    } else {
      return res.status(404).json({ error: 'Export type not supported' });
    }

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.send('\uFEFF' + header + rows.join('\n'));
  }));
}
