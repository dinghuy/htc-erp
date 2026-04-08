type SeedDatabaseDeps = {
  createId: () => number;
};

export async function seedDatabase(
  db: { get: (sql: string) => Promise<any>; run: (sql: string, params?: any[]) => Promise<any> },
  deps: SeedDatabaseDeps,
) {
  let idCounter = 1;
  const genId = () => idCounter++;

  console.log('--- Seeding Accounts ---');
  const accountCount = await db.get('SELECT COUNT(*) as c FROM Account');
  const accIds = [genId(), genId(), genId(), genId(), genId()];
  const supIds = [genId(), genId(), genId(), genId(), genId()];

  if (accountCount.c < 5) {
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

  console.log('--- Seeding Contacts ---');
  const contactCount = await db.get('SELECT COUNT(*) as c FROM Contact');
  if (contactCount.c < 5) {
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

  console.log('--- Seeding Leads ---');
  const leadCount = await db.get('SELECT COUNT(*) as c FROM Lead');
  if (leadCount.c < 5) {
    const leads = [
      [genId(), 'Tập đoàn Hòa Phát', 'Phạm Long', 'long.pham@hoaphat.com.vn', '098111222', 'New', 'Cold Call'],
      [genId(), 'Cảng Quy Nhơn', 'Lý Tự Trọng', 'tronglt@quynhonport.vn', '098222333', 'Qualified', 'Website'],
      [genId(), 'Khoáng sản ABC', 'Bạch Cốt', 'cotb@abc.vn', '098333444', 'Lost', 'Referral'],
      [genId(), 'Vinaconex', 'Trần Thắng', 'thangt@vinaconex.com', '098444555', 'Proposal', 'Event'],
      [genId(), 'Giao hàng Tiết Kiệm', 'Đinh Vĩnh', 'vinhd@ghtk.vn', '098555666', 'Won', 'Website'],
    ];
    for (const ld of leads) {
      await db.run('INSERT OR IGNORE INTO Lead (id, companyName, contactName, email, phone, status, source) VALUES (?,?,?,?,?,?,?)', ld);
    }
  }

  console.log('--- Seeding Products ---');
  const productCount = await db.get('SELECT COUNT(*) as c FROM Product');
  if (productCount.c < 5) {
    const prods = [
      [genId(), 'KOM-PC8000', 'Máy xúc siêu trường Komatsu PC8000', 'Máy xúc', 'Chiếc', 5000000, 'USD', 'Gầu 42m3'],
      [genId(), 'KOM-WA900', 'Xe xúc lật WA900-8', 'Xúc lật', 'Chiếc', 1200000, 'USD', 'Gầu 13m3'],
      [genId(), 'SHC-X3000', 'Xe đầu kéo Shacman X3000', 'Xe tải', 'Chiếc', 45000, 'USD', '400HP'],
      [genId(), 'VOL-FH16', 'Volvo FH16 6x4', 'Xe tải', 'Chiếc', 120000, 'USD', '750HP'],
      [genId(), 'CAT-797F', 'Xe tải mỏ Cat 797F', 'Xe siêu trọng', 'Chiếc', 3500000, 'USD', '400 tấn'],
    ];
    for (const pt of prods) {
      await db.run('INSERT OR IGNORE INTO Product (id, sku, name, category, unit, basePrice, currency, technicalSpecs) VALUES (?,?,?,?,?,?,?,?)', pt);
    }
  }

  console.log('--- Seeding SupplierQuotes ---');
  const sqCount = await db.get('SELECT COUNT(*) as c FROM SupplierQuote');
  if (sqCount.c < 5) {
    const sqs = Array(5).fill(0).map((_, i) => [
      genId(),
      supIds[i % 5],
      i % 2 === 0 ? 'Phụ tùng' : 'Máy nguyên chiếc',
      new Date().toISOString(),
      new Date(Date.now() + 30 * 24 * 3600000).toISOString(),
      JSON.stringify([{ productId: 1, baseCost: 1000 + i * 100, shippingCost: 200, importTax: 0.1 }]),
      '[]',
      'active',
    ]);
    for (const sq of sqs) {
      await db.run('INSERT OR IGNORE INTO SupplierQuote (id, supplierId, category, quoteDate, validUntil, items, attachments, status) VALUES (?,?,?,?,?,?,?,?)', sq);
    }
  }

  console.log('--- Seeding Quotations ---');
  const quCount = await db.get('SELECT COUNT(*) as c FROM Quotation');
  if (quCount.c < 5) {
    const qts = Array(5).fill(0).map((_, i) => [
      genId(),
      `QT-2026-00${i + 1}`,
      new Date().toISOString().slice(0, 10),
      `Báo giá thiết bị ${i + 1}`,
      accIds[i % 5],
      null,
      'Nguyễn Văn Sales',
      '0909090909',
      'VND',
      JSON.stringify([{ sku: 'KOM-PC8000', name: 'Komatsu PC8000', unit: 'Chiếc', quantity: 1, unitPrice: 125000000000 }]),
      JSON.stringify({ exchangeRate: 25400 }),
      JSON.stringify({ validity: '30 days' }),
      125000000000,
      10000000000,
      135000000000,
      ['draft', 'sent', 'accepted', 'rejected'][i % 4],
    ]);
    for (const qt of qts) {
      await db.run('INSERT OR IGNORE INTO Quotation (id, quoteNumber, quoteDate, subject, accountId, contactId, salesperson, salespersonPhone, currency, items, financialParams, terms, subtotal, taxTotal, grandTotal, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', qt);
    }
  }

  console.log('--- Seeding Users ---');
  const userStartId = 1000; 
  let userIdCounter = userStartId;
  const genUserId = () => userIdCounter++;
  const userIds = [genUserId(), genUserId(), genUserId(), genUserId(), genUserId() ];

  const uCount = await db.get('SELECT COUNT(*) as c FROM User');
  if (uCount.c < 5) {
    const usersList = [
      [userIds[0], 'Huỳnh Thy Ngọc', 'female', 'ngoc.ht@huynhthy.com', '0911000001', 'CEO', 'Ban Giám Đốc'],
      [userIds[1], 'Trần Anh Sales', 'male', 'anh.tr@huynhthy.com', '0911000002', 'Sales Rep', 'Kinh Doanh'],
      [userIds[2], 'Lê Tuấn Mua', 'male', 'tuan.le@huynhthy.com', '0911000003', 'Purchasing', 'Cung Ứng'],
      [userIds[3], 'Nguyễn Kỹ Thuật', 'male', 'kt.nguyen@huynhthy.com', '0911000004', 'Engineer', 'Kỹ Thuật'],
      [userIds[4], 'Bùi Minh Trí', 'male', 'tri.bui@huynhthy.com', '0911000005', 'Manager', 'Kinh Doanh'],
    ];
    for (const u of usersList) {
      await db.run('INSERT OR IGNORE INTO User (id, fullName, gender, email, phone, role, department) VALUES (?,?,?,?,?,?,?)', u);
    }
  }

  console.log('--- Seeding Activities ---');
  const actCount = await db.get('SELECT COUNT(*) as c FROM Activity');
  if (actCount.c < 5) {
    const acts = [
      [genId(), 'Gửi báo giá mới', 'Báo giá QT-2026-001 đã được gửi qua email cho khách.', 'Quotation', '📄', '#e0f2fe', '#0284c7', null, null],
      [genId(), 'Tạo Lead mới', 'Lead Tập đoàn Hòa Phát được tạo.', 'Lead', '🎯', '#fce7f3', '#db2777', null, null],
      [genId(), 'Cập nhật QBU', 'Cập nhật giá cước vận chuyển tháng 4.', 'Purchasing', '🏗️', '#fef3c7', '#d97706', null, null],
      [genId(), 'Deal Accepted!', 'Khách hàng Cảng Đà Nẵng đã chốt đơn KOM-WA900.', 'Win', '🏆', '#dcfce7', '#16a34a', null, null],
      [genId(), 'Chăm sóc KH', 'Gọi điện giới thiệu chính sách trả góp 70%.', 'Contact', '📞', '#e0e7ff', '#4f46e5', null, null],
    ];
    for (const a of acts) {
      await db.run('INSERT OR IGNORE INTO Activity (id, title, description, category, icon, color, iconColor, entityId, entityType) VALUES (?,?,?,?,?,?,?,?,?)', a);
    }
  }

  console.log('--- Seeding SystemSettings ---');
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
