type SeedDatabaseDeps = {
  createId: () => string;
};

export async function seedDatabase(
  db: { get: (sql: string) => Promise<any>; run: (sql: string, params?: any[]) => Promise<any> },
  deps: SeedDatabaseDeps,
) {
  const genId = deps.createId;

  async function insertSeedQuotation(input: {
    id: string;
    quoteNumber: string;
    quoteDate: string;
    subject: string;
    accountId: string | null;
    contactId: string | null;
    salesperson: string;
    salespersonPhone: string;
    currency: string;
    subtotal: number;
    taxTotal: number;
    grandTotal: number;
    status: string;
    lineItems: Array<{ sku: string; name: string; unit: string; quantity: number; unitPrice: number; technicalSpecs?: string | null; remarks?: string | null }>;
    financialConfig?: { interestRate?: number; exchangeRate?: number; loanTermMonths?: number; markup?: number; vatRate?: number };
    commercialTerms?: { remarksVi?: string | null; remarksEn?: string | null; termItems?: Array<{ labelViPrint: string; labelEn: string; textVi: string; textEn: string }> };
  }) {
    const financialConfig = input.financialConfig || {};
    const commercialTerms = input.commercialTerms || {};
    await db.run(
      `INSERT OR IGNORE INTO Quotation (
        id, quoteNumber, quoteDate, subject, accountId, contactId, salesperson, salespersonPhone, currency,
        items, financialParams, terms, interestRate, exchangeRate, loanTermMonths, markup, vatRate, remarksVi, remarksEn,
        subtotal, taxTotal, grandTotal, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.quoteNumber,
        input.quoteDate,
        input.subject,
        input.accountId,
        input.contactId,
        input.salesperson,
        input.salespersonPhone,
        input.currency,
        financialConfig.interestRate ?? 8.5,
        financialConfig.exchangeRate ?? 25400,
        financialConfig.loanTermMonths ?? 36,
        financialConfig.markup ?? 15,
        financialConfig.vatRate ?? 8,
        commercialTerms.remarksVi ?? null,
        commercialTerms.remarksEn ?? null,
        input.subtotal,
        input.taxTotal,
        input.grandTotal,
        input.status,
      ]
    );

    for (const [index, item] of input.lineItems.entries()) {
      await db.run(
        `INSERT OR IGNORE INTO QuotationLineItem (
          id, quotationId, sortOrder, sku, name, unit, technicalSpecs, remarks, quantity, unitPrice
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `${input.id}-line-${index + 1}`,
          input.id,
          index,
          item.sku,
          item.name,
          item.unit,
          item.technicalSpecs || null,
          item.remarks || null,
          item.quantity,
          item.unitPrice,
        ]
      );
    }

    for (const [index, termItem] of (commercialTerms.termItems || []).entries()) {
      await db.run(
        `INSERT OR IGNORE INTO QuotationTermItem (
          id, quotationId, sortOrder, labelViPrint, labelEn, textVi, textEn
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          `${input.id}-term-${index + 1}`,
          input.id,
          index,
          termItem.labelViPrint,
          termItem.labelEn,
          termItem.textVi,
          termItem.textEn,
        ]
      );
    }
  }

  const accountCount = await db.get('SELECT COUNT(*) as c FROM Account');
  const accIds = [genId(), genId(), genId(), genId(), genId()];
  const supIds = [genId(), genId(), genId(), genId(), genId()];

  if (accountCount.c < 10) {
    const accs = [
      [accIds[0], 'Cảng Nam Hải Đình Vũ', 'Miền Bắc', 'Khai thác cảng', 'namhaidinhvu.com', '020xxxxx', 'Hải Phòng', 'Customer', 'NHDV'],
      [accIds[1], 'Cảng Đà Nẵng', 'Miền Trung', 'Khai thác cảng', 'danangport.com', '040xxxxx', 'Đà Nẵng', 'Customer', 'DNGP'],
      [accIds[2], 'Tân Cảng Sài Gòn', 'Miền Nam', 'Logistics', 'saigonnewport.com.vn', '030xxxxx', 'Hồ Chí Minh', 'Customer', 'TCSG'],
      [accIds[3], 'Vận tải Minh Quốc', 'Miền Nam', 'Vận tải', 'minhquoc.com', '030xxxxx', 'Bình Dương', 'Customer', 'MQLogistics'],
      [accIds[4], 'Xi Măng Long Sơn', 'Miền Trung', 'Sản xuất', 'longson.vn', '010xxxxx', 'Thanh Hóa', 'Customer', 'LS Cement'],
    ];
    for (const a of accs) {
      await db.run('INSERT OR IGNORE INTO Account (id, companyName, region, industry, website, taxCode, address, accountType, shortName) VALUES (?,?,?,?,?,?,?,?,?)', a);
    }

    const sups = [
      [supIds[0], 'Komatsu Japan', 'Nhà sản xuất thiết bị hạng nặng', 'Japan', 'Supplier', 'KOM-JP'],
      [supIds[1], 'Volvo Trucks', 'Xe tải nặng', 'Sweden', 'Supplier', 'VOL-SE'],
      [supIds[2], 'Shacman Heavy Duty', 'Xe công trình đường dài', 'China', 'Supplier', 'SHC-CN'],
      [supIds[3], 'Sany Group', 'Máy xúc & cẩu', 'China', 'Supplier', 'SNY-CN'],
      [supIds[4], 'Caterpillar Inc.', 'Thiết bị xây dựng Mỹ', 'USA', 'Supplier', 'CAT-US'],
    ];
    for (const s of sups) {
      await db.run('INSERT OR IGNORE INTO Account (id, companyName, description, country, accountType, code) VALUES (?,?,?,?,?,?)', s);
    }
  }

  const contactCount = await db.get('SELECT COUNT(*) as c FROM Contact');
  if (contactCount.c < 10) {
    const contacts = [
      [genId(), accIds[0], 'Nguyễn', 'Văn Nam', 'Kỹ thuật', 'Trưởng phòng', 'male', 'namnv@namhai.vn', '0901234567'],
      [genId(), accIds[0], 'Lê', 'Hoàng Thái', 'Kỹ thuật', 'Chuyên viên', 'male', 'thailh@namhai.vn', '0912345678'],
      [genId(), accIds[1], 'Trần', 'Thị Bé', 'Mua hàng', 'Purchasing', 'female', 'bet@danangport.vn', '0923456789'],
      [genId(), accIds[1], 'Phạm', 'Thanh', 'Ban GĐ', 'Giám đốc', 'male', 'thanhp@danangport.vn', '0934567890'],
      [genId(), accIds[2], 'Ngô', 'Quang', 'Mua hàng', 'Trưởng trạm', 'male', 'quangnq@saigonnewport.vn', '0945678901'],
      [genId(), supIds[0], 'Tanaka', 'Kenji', 'Sales', 'Manager', 'male', 'kenji@komatsu.jp', '+81999999'],
      [genId(), supIds[1], 'Anna', 'Andersson', 'B2B', 'Director', 'female', 'anna@volvo.se', '+46888888'],
      [genId(), supIds[2], 'Wang', 'Wei', 'Export', 'Sales Rep', 'male', 'weiw@shacman.cn', '+86777777'],
      [genId(), supIds[3], 'Li', 'Jian', 'Export', 'Manager', 'male', 'lijian@sany.cn', '+86666666'],
      [genId(), accIds[4], 'Hoàng', 'Quân', 'Cơ giới', 'Đội trưởng', 'male', 'quan.hoang@longson.vn', '0956789012'],
    ];
    for (const c of contacts) {
      await db.run('INSERT OR IGNORE INTO Contact (id, accountId, lastName, firstName, department, jobTitle, gender, email, phone) VALUES (?,?,?,?,?,?,?,?,?)', c);
    }
  }

  const leadCount = await db.get('SELECT COUNT(*) as c FROM Lead');
  if (leadCount.c < 10) {
    const leads = [
      [genId(), 'Tập đoàn Hòa Phát', 'Phạm Long', 'long.pham@hoaphat.com.vn', '098111222', 'New', 'Cold Call'],
      [genId(), 'Cảng Quy Nhơn', 'Lý Tự Trọng', 'tronglt@quynhonport.vn', '098222333', 'Qualified', 'Website'],
      [genId(), 'Khoáng sản ABC', 'Bạch Cốt', 'cotb@abc.vn', '098333444', 'Lost', 'Referral'],
      [genId(), 'Vinaconex', 'Trần Thắng', 'thangt@vinaconex.com', '098444555', 'Proposal', 'Event'],
      [genId(), 'Giao hàng Tiết Kiệm', 'Đinh Vĩnh', 'vinhd@ghtk.vn', '098555666', 'Won', 'Website'],
      [genId(), 'Viettel Logistics', 'Trương Tuấn', 'tuan_vt@viettel.vn', '098666777', 'New', 'Partner'],
      [genId(), 'Viconship', 'Đào Hà', 'had@viconship.vn', '098777888', 'Qualification', 'Cold Call'],
      [genId(), 'Cảng Vũng Áng', 'Hồ Tấn', 'tanh@vungang.vn', '098888999', 'Proposal', 'Website'],
      [genId(), 'Tôn Hoa Sen', 'Ca Thương', 'thuongc@hoasen.vn', '098999000', 'New', 'Event'],
      [genId(), 'Hưng Thịnh', 'Thịnh Nguyễn', 'thinhng@hungthinh.vn', '098000111', 'Lost', 'Referral'],
    ];
    for (const ld of leads) {
      await db.run('INSERT OR IGNORE INTO Lead (id, companyName, contactName, email, phone, status, source) VALUES (?,?,?,?,?,?,?)', ld);
    }
  }

  const productCount = await db.get('SELECT COUNT(*) as c FROM Product');
  if (productCount.c < 10) {
    const prods = [
      [genId(), 'KOM-PC8000', 'Máy xúc siêu trường Komatsu PC8000', 'Máy xúc', 'Chiếc', 5000000, 'USD', 'Gầu 42m3'],
      [genId(), 'KOM-WA900', 'Xe xúc lật WA900-8', 'Xúc lật', 'Chiếc', 1200000, 'USD', 'Gầu 13m3'],
      [genId(), 'SHC-X3000', 'Xe đầu kéo Shacman X3000', 'Xe tải', 'Chiếc', 45000, 'USD', '400HP'],
      [genId(), 'VOL-FH16', 'Volvo FH16 6x4', 'Xe tải', 'Chiếc', 120000, 'USD', '750HP'],
      [genId(), 'CAT-797F', 'Xe tải mỏ Cat 797F', 'Xe siêu trọng', 'Chiếc', 3500000, 'USD', '400 tấn'],
      [genId(), 'SNY-SY750', 'Máy xúc Sany SY750H', 'Máy xúc', 'Chiếc', 250000, 'USD', 'Gầu 5.4m3'],
      [genId(), 'KAL-DRG', 'Xe nâng Kalmar Reachstacker', 'Xe nâng', 'Chiếc', 600000, 'USD', 'Nâng container 45t'],
      [genId(), 'TFN-FD30', 'Phụ tùng lọc dầu Shacman', 'Phụ tùng', 'Cái', 50, 'USD', 'Bảo dưỡng'],
      [genId(), 'HYD-MOT', 'Motor thủy lực Parker', 'Phụ tùng', 'Cái', 850, 'USD', 'Sửa chữa'],
      [genId(), 'SER-MAINT', 'Gói bảo dưỡng định kỳ 500h', 'Dịch vụ', 'Gói', 1500, 'USD', 'SLA 48h'],
    ];
    for (const pt of prods) {
      await db.run('INSERT OR IGNORE INTO Product (id, sku, name, category, unit, basePrice, currency, technicalSpecs) VALUES (?,?,?,?,?,?,?,?)', pt);
    }
  }

  const sqCount = await db.get('SELECT COUNT(*) as c FROM SupplierQuote');
  if (sqCount.c < 10) {
    const sqs = Array(10).fill(0).map((_, i) => [
      genId(),
      supIds[i % 5],
      i % 2 === 0 ? 'Phụ tùng' : 'Máy nguyên chiếc',
      new Date().toISOString(),
      new Date(Date.now() + 30 * 24 * 3600000).toISOString(),
      JSON.stringify([{ productId: '123', baseCost: 1000 + i * 100, shippingCost: 200, importTax: 0.1 }]),
      '[]',
      'active',
    ]);
    for (const sq of sqs) {
      await db.run('INSERT OR IGNORE INTO SupplierQuote (id, supplierId, category, quoteDate, validUntil, items, attachments, status) VALUES (?,?,?,?,?,?,?,?)', sq);
    }
  }

  const quCount = await db.get('SELECT COUNT(*) as c FROM Quotation');
  if (quCount.c < 10) {
    const qts = Array(10).fill(0).map((_, i) => ({
      id: genId(),
      quoteNumber: `QT-2026-00${i + 1}`,
      quoteDate: new Date().toISOString().slice(0, 10),
      subject: `Báo giá thiết bị ${i + 1}`,
      accountId: accIds[i % 5],
      contactId: null,
      salesperson: 'Nguyễn Văn Sales',
      salespersonPhone: '0909090909',
      currency: 'VND',
      lineItems: [{ sku: 'KOM-PC8000', name: 'Komatsu PC8000', unit: 'Chiếc', quantity: 1, unitPrice: 125000000000 }],
      financialConfig: { exchangeRate: 25400 },
      commercialTerms: { termItems: [{ labelViPrint: 'Hiệu lực', labelEn: 'Validity', textVi: '30 days', textEn: '30 days' }] },
      subtotal: 125000000000,
      taxTotal: 10000000000,
      grandTotal: 135000000000,
      status: ['draft', 'sent', 'accepted', 'rejected'][i % 4],
    }));
    for (const qt of qts) {
      await insertSeedQuotation(qt);
    }
  }

  const uCount = await db.get('SELECT COUNT(*) as c FROM User');
  if (uCount.c < 10) {
    const usersList = [
      [genId(), 'Huỳnh Thy Ngọc', 'female', 'ngoc.ht@huynhthy.com', '0911000001', 'CEO', 'Ban Giám Đốc'],
      [genId(), 'Trần Anh Sales', 'male', 'anh.tr@huynhthy.com', '0911000002', 'Sales Rep', 'Kinh Doanh'],
      [genId(), 'Lê Tuấn Mua', 'male', 'tuan.le@huynhthy.com', '0911000003', 'Purchasing', 'Cung Ứng'],
      [genId(), 'Nguyễn Kỹ Thuật', 'male', 'kt.nguyen@huynhthy.com', '0911000004', 'Engineer', 'Kỹ Thuật'],
      [genId(), 'Bùi Minh Trí', 'male', 'tri.bui@huynhthy.com', '0911000005', 'Manager', 'Kinh Doanh'],
      [genId(), 'Hoàng Nhâm', 'female', 'nham.hoang@huynhthy.com', '0911000006', 'HR', 'Nhân Sự'],
      [genId(), 'Võ Quang', 'male', 'quang.vo@huynhthy.com', '0911000007', 'Sales Rep', 'Kinh Doanh'],
      [genId(), 'Phan Thanh', 'female', 'thanh.phan@huynhthy.com', '0911000008', 'Accountant', 'Kế Toán'],
      [genId(), 'Đinh Bảo', 'male', 'bao.dinh@huynhthy.com', '0911000009', 'Marketing', 'Marketing'],
      [genId(), 'Đỗ Ngọc', 'female', 'ngoc.do@huynhthy.com', '0911000010', 'Sales Rep', 'Kinh Doanh'],
    ];
    for (const u of usersList) {
      await db.run('INSERT OR IGNORE INTO User (id, fullName, gender, email, phone, role, department) VALUES (?,?,?,?,?,?,?)', u);
    }
  }

  const actCount = await db.get('SELECT COUNT(*) as c FROM Activity');
  if (actCount.c < 10) {
    const acts = [
      [genId(), 'Gửi báo giá mới', 'Báo giá QT-2026-001 đã được gửi qua email cho khách.', 'Quotation', '📄', '#e0f2fe', '#0284c7', null, null],
      [genId(), 'Tạo Lead mới', 'Lead Tập đoàn Hòa Phát được tạo.', 'Lead', '🎯', '#fce7f3', '#db2777', null, null],
      [genId(), 'Cập nhật QBU', 'Cập nhật giá cước vận chuyển tháng 4.', 'Purchasing', '🏗️', '#fef3c7', '#d97706', null, null],
      [genId(), 'Deal Accepted!', 'Khách hàng Cảng Đà Nẵng đã chốt đơn KOM-WA900.', 'Win', '🏆', '#dcfce7', '#16a34a', null, null],
      [genId(), 'Chăm sóc KH', 'Gọi điện giới thiệu chính sách trả góp 70%.', 'Contact', '📞', '#e0e7ff', '#4f46e5', null, null],
      [genId(), 'Họp với Partner', 'Trao đổi chiến lược với Shacman.', 'Meeting', '🤝', '#ffedd5', '#ea580c', null, null],
      [genId(), 'Import Data', 'Import thành công 100 mã sản phẩm từ kho Excel.', 'System', '⚙️', '#f1f5f9', '#475569', null, null],
      [genId(), 'Update Status', 'Lead Vinaconex nâng từ New -> Proposal.', 'Phase', '🔄', '#e0f2fe', '#0284c7', null, null],
      [genId(), 'Hợp đồng kí kết', 'Hoàn thành Hợp đồng số 102/2026', 'Contract', '📝', '#dcfce7', '#16a34a', null, null],
      [genId(), 'Gửi báo giá mẫu', 'Phục vụ review nội bộ', 'Internal', '📩', '#f3e8ff', '#9333ea', null, null],
    ];
    for (const a of acts) {
      await db.run('INSERT OR IGNORE INTO Activity (id, title, description, category, icon, color, iconColor, entityId, entityType) VALUES (?,?,?,?,?,?,?,?,?)', a);
    }
  }

  const defaults = [
    ['quote_vat', '10'],
    ['quote_exchange_rate', '25450'],
    ['quote_interest_rate', '0.8'],
    ['quote_terms', '1. Hiệu lực báo giá: 30 ngày.\n2. Thời gian giao hàng: 60-90 ngày kể từ khi nhận tạm ứng.\n3. Bảo hành: 12 tháng hoặc 2000 giờ tùy điều kiện nào đến trước.'],
    ['company_name', 'CÔNG TY CỔ PHẦN TẬP ĐOÀN HUỲNH THY'],
    ['company_address', '71/11 Lê Quang Định, Phường 14, Quận Bình Thạnh, TP. HCM'],
    ['company_phone', '028 3551 2516'],
    ['company_email', 'info@huynhthy.com'],
    ['company_website', 'www.huynhthy.com'],
  ];
  for (const [k, v] of defaults) {
    await db.run('INSERT OR IGNORE INTO SystemSetting (key, value) VALUES (?, ?)', [k, v]);
  }

  console.log('✅ SQLite Database Seed Successful');
}
