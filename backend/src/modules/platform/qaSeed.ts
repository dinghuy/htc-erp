import bcrypt from 'bcryptjs';
import type { Database } from 'sqlite';
import type { SystemRole } from '../../shared/contracts/domain';

type QaUserSeed = {
  username: string;
  password: string;
  fullName: string;
  systemRole: SystemRole;
  roleCodes: SystemRole[];
  department: string;
};

type QaSeedIds = {
  users: Record<string, string>;
  accounts: Record<string, string>;
  contacts: Record<string, string>;
  projects: Record<string, string>;
  quotations: Record<string, string>;
  approvals: Record<string, string>;
  tasks: Record<string, string>;
  documents: Record<string, string>;
  baselines: Record<string, string>;
  milestones: Record<string, string>;
  procurementLines: Record<string, string>;
  timeline: Record<string, string>;
};

type UxSeedContract = {
  contractVersion: string;
  baseUrl: {
    frontend: string;
    backend: string;
  };
  admin: {
    username: string;
    password: string;
  };
  personas: Record<string, { username: string; password: string; roleCodes: SystemRole[] }>;
  sampleIds: {
    accounts: Record<string, string>;
    projects: Record<string, string>;
    quotations: Record<string, string>;
    approvals: Record<string, string>;
    tasks: Record<string, string>;
    documents: Record<string, string>;
  };
};

const primaryKeyModeCache = new Map<string, boolean>();

async function tableUsesIntegerPrimaryKey(db: Database, table: string) {
  if (primaryKeyModeCache.has(table)) {
    return primaryKeyModeCache.get(table) as boolean;
  }

  const columns: Array<{ name: string; type?: string | null }> = await db.all(`PRAGMA table_info('${table}')`);
  const idColumn = columns.find((column) => column.name === 'id');
  const usesIntegerPrimaryKey = String(idColumn?.type || '').toUpperCase().includes('INT');
  primaryKeyModeCache.set(table, usesIntegerPrimaryKey);
  return usesIntegerPrimaryKey;
}

function createQaSeedIds(): QaSeedIds {
  return {
    users: {},
    accounts: {},
    contacts: {},
    projects: {},
    quotations: {},
    approvals: {},
    tasks: {},
    documents: {},
    baselines: {},
    milestones: {},
    procurementLines: {},
    timeline: {},
  };
}

function toLegacySampleIds(ids: QaSeedIds): UxSeedContract['sampleIds'] {
  return {
    accounts: {
      alpha: ids.accounts.alpha,
      beta: ids.accounts.beta,
      gamma: ids.accounts.gamma,
      supplier: ids.accounts.supplier,
    },
    projects: {
      quoting: ids.projects.quoting,
      won: ids.projects.won,
      delivery: ids.projects.delivery,
    },
    quotations: {
      quoting: ids.quotations.quoting,
      won: ids.quotations.won,
      delivery: ids.quotations.delivery,
    },
    approvals: {
      commercial: ids.approvals.commercial,
      procurement: ids.approvals.procurement,
      finance: ids.approvals.finance,
      legal: ids.approvals.legal,
      executive: ids.approvals.executive,
    },
    tasks: {
      salesFollowUp: ids.tasks.salesFollowUp,
      handoff: ids.tasks.handoff,
      delivery: ids.tasks.delivery,
      procurement: ids.tasks.procurement,
      accounting: ids.tasks.accounting,
      legal: ids.tasks.legal,
      viewer: ids.tasks.viewer,
    },
    documents: {
      legalContract: ids.documents.legalContract,
      financeMilestone: ids.documents.financeMilestone,
    },
  };
}

const QA_PASSWORD = 'QaRole@123';

const QA_USERS: Record<string, QaUserSeed> = {
  admin: {
    username: 'qa_admin',
    password: 'admin123',
    fullName: 'QA Administrator',
    systemRole: 'admin',
    roleCodes: ['admin'],
    department: 'IT',
  },
  sales: {
    username: 'qa_sales',
    password: QA_PASSWORD,
    fullName: 'QA Sales',
    systemRole: 'sales',
    roleCodes: ['sales'],
    department: 'Sales',
  },
  projectManager: {
    username: 'qa_pm',
    password: QA_PASSWORD,
    fullName: 'QA Project Manager',
    systemRole: 'project_manager',
    roleCodes: ['project_manager'],
    department: 'Operations',
  },
  salesProjectManager: {
    username: 'qa_sales_pm',
    password: QA_PASSWORD,
    fullName: 'QA Sales + Project Manager',
    systemRole: 'project_manager',
    roleCodes: ['sales', 'project_manager'],
    department: 'Sales Operations',
  },
  procurement: {
    username: 'qa_procurement',
    password: QA_PASSWORD,
    fullName: 'QA Procurement',
    systemRole: 'procurement',
    roleCodes: ['procurement'],
    department: 'Procurement',
  },
  accounting: {
    username: 'qa_accounting',
    password: QA_PASSWORD,
    fullName: 'QA Accounting',
    systemRole: 'accounting',
    roleCodes: ['accounting'],
    department: 'Finance',
  },
  legal: {
    username: 'qa_legal',
    password: QA_PASSWORD,
    fullName: 'QA Legal',
    systemRole: 'legal',
    roleCodes: ['legal'],
    department: 'Legal',
  },
  director: {
    username: 'qa_director',
    password: QA_PASSWORD,
    fullName: 'QA Director',
    systemRole: 'director',
    roleCodes: ['director'],
    department: 'BOD',
  },
  viewer: {
    username: 'qa_viewer',
    password: QA_PASSWORD,
    fullName: 'QA Viewer',
    systemRole: 'viewer',
    roleCodes: ['viewer'],
    department: 'Audit',
  },
};

const IDS = {
  accounts: {
    alpha: 'qa-account-alpha',
    beta: 'qa-account-beta',
    gamma: 'qa-account-gamma',
    supplier: 'qa-account-supplier',
  },
  contacts: {
    alpha: 'qa-contact-alpha',
    beta: 'qa-contact-beta',
  },
  quotations: {
    quoting: 'qa-quotation-quoting',
    won: 'qa-quotation-won',
    delivery: 'qa-quotation-delivery',
  },
  projects: {
    quoting: 'qa-project-quoting',
    won: 'qa-project-won',
    delivery: 'qa-project-delivery',
  },
  approvals: {
    commercial: 'qa-approval-commercial',
    procurement: 'qa-approval-procurement',
    finance: 'qa-approval-finance',
    legal: 'qa-approval-legal',
    executive: 'qa-approval-executive',
  },
  tasks: {
    salesFollowUp: 'qa-task-sales-follow-up',
    handoff: 'qa-task-handoff',
    delivery: 'qa-task-delivery',
    procurement: 'qa-task-procurement',
    accounting: 'qa-task-accounting',
    legal: 'qa-task-legal',
    viewer: 'qa-task-viewer',
  },
  documents: {
    legalContract: 'qa-document-legal-contract',
    financeMilestone: 'qa-document-finance-milestone',
  },
  milestones: {
    deliveryKickoff: 'qa-milestone-delivery-kickoff',
  },
  baselines: {
    delivery: 'qa-baseline-delivery',
  },
  procurementLines: {
    deliveryCore: 'qa-procurement-line-core',
  },
  supportTickets: {
    admin: 'qa-support-admin',
  },
  notifications: {
    admin: 'qa-notification-admin',
    projectManager: 'qa-notification-project-manager',
  },
  timeline: {
    deliveryKickoff: 'qa-timeline-delivery-kickoff',
  },
} as const;

const QA_KEEP_TABLES = new Set([
  'sqlite_sequence',
  'SystemSetting',
  'Department',
  'PublicHoliday',
  'ProductCategory',
  'ExchangeRate',
]);

export function buildUxSeedContract(sampleIds?: UxSeedContract['sampleIds']): UxSeedContract {
  return {
    contractVersion: 'ux-regression-v1',
    baseUrl: {
      frontend: process.env.QA_FRONTEND_URL?.trim() || 'http://127.0.0.1:4173',
      backend: process.env.QA_BACKEND_URL?.trim() || `http://127.0.0.1:${process.env.PORT || '3001'}`,
    },
    admin: {
      username: QA_USERS.admin.username,
      password: QA_USERS.admin.password,
    },
    personas: Object.fromEntries(
      Object.entries(QA_USERS).map(([key, user]) => [
        key,
        {
          username: user.username,
          password: user.password,
          roleCodes: user.roleCodes,
        },
      ]),
    ),
    sampleIds: sampleIds || {
      accounts: { ...IDS.accounts },
      projects: { ...IDS.projects },
      quotations: { ...IDS.quotations },
      approvals: { ...IDS.approvals },
      tasks: { ...IDS.tasks },
      documents: { ...IDS.documents },
    },
  };
}

async function clearQaTables(db: Database) {
  const existingTables: string[] = (await db.all(`SELECT name FROM sqlite_master WHERE type = 'table'`))
    .map((row: any) => row.name)
    .filter((name: string) => name && !QA_KEEP_TABLES.has(name));
  for (const table of existingTables) {
    await db.run(`DELETE FROM ${table}`);
  }
}

async function insertQaUsers(db: Database, ids: QaSeedIds) {
  const userTableColumns: Array<{ name: string; type?: string | null }> = await db.all(`PRAGMA table_info('User')`);
  const idColumn = userTableColumns.find((column) => column.name === 'id');
  const usesIntegerPrimaryKey = String(idColumn?.type || '').toUpperCase().includes('INT');

  for (const [key, user] of Object.entries(QA_USERS)) {
    const passwordHash = await bcrypt.hash(user.password, 10);
    const seedUserId = usesIntegerPrimaryKey ? null : `qa-user-${key}`;
    if (usesIntegerPrimaryKey) {
      await db.run(
        `INSERT INTO User (
          fullName, gender, email, phone, role, department, status,
          username, passwordHash, systemRole, roleCodes, accountStatus, mustChangePassword, language
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          user.fullName,
          'male',
          `${user.username}@qa.local`,
          '',
          user.systemRole,
          user.department,
          'Active',
          user.username,
          passwordHash,
          user.systemRole,
          JSON.stringify(user.roleCodes),
          'active',
          0,
          'vi',
        ],
      );
    } else {
      await db.run(
        `INSERT INTO User (
          id, fullName, gender, email, phone, role, department, status,
          username, passwordHash, systemRole, roleCodes, accountStatus, mustChangePassword, language
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          seedUserId,
          user.fullName,
          'male',
          `${user.username}@qa.local`,
          '',
          user.systemRole,
          user.department,
          'Active',
          user.username,
          passwordHash,
          user.systemRole,
          JSON.stringify(user.roleCodes),
          'active',
          0,
          'vi',
        ],
      );
    }
    const inserted = await db.get<{ id: string | number | null; rowid?: string | number | null }>(
      `SELECT id, rowid as rowid FROM User WHERE username = ?`,
      [user.username],
    );
    ids.users[key] = String(inserted?.id ?? inserted?.rowid ?? seedUserId ?? '');
  }
}

async function insertQaAccounts(db: Database, ids: QaSeedIds) {
  const accountUsesIntegerPrimaryKey = await tableUsesIntegerPrimaryKey(db, 'Account');
  const contactUsesIntegerPrimaryKey = await tableUsesIntegerPrimaryKey(db, 'Contact');

  if (accountUsesIntegerPrimaryKey) {
    const alphaAccount = await db.run(
      `INSERT INTO Account (companyName, accountType, status, assignedTo, shortName, country)
       VALUES (?, 'Customer', 'active', ?, ?, ?)`,
      ['QA Alpha Port', ids.users.sales, 'QAA', 'Vietnam'],
    );
    ids.accounts.alpha = String(alphaAccount.lastID);

    const betaAccount = await db.run(
      `INSERT INTO Account (companyName, accountType, status, assignedTo, shortName, country)
       VALUES (?, 'Customer', 'active', ?, ?, ?)`,
      ['QA Beta Logistics', ids.users.sales, 'QAB', 'Vietnam'],
    );
    ids.accounts.beta = String(betaAccount.lastID);

    const gammaAccount = await db.run(
      `INSERT INTO Account (companyName, accountType, status, assignedTo, shortName, country)
       VALUES (?, 'Customer', 'active', ?, ?, ?)`,
      ['QA Gamma Manufacturing', ids.users.projectManager, 'QAG', 'Vietnam'],
    );
    ids.accounts.gamma = String(gammaAccount.lastID);

    const supplierAccount = await db.run(
      `INSERT INTO Account (companyName, accountType, status, shortName, country)
       VALUES (?, 'Supplier', 'active', ?, ?)`,
      ['QA Supplier One', 'QAS', 'China'],
    );
    ids.accounts.supplier = String(supplierAccount.lastID);
  } else {
    await db.run(
      `INSERT INTO Account (id, companyName, accountType, status, assignedTo, shortName, country)
       VALUES (?, ?, 'Customer', 'active', ?, ?, ?)`,
      [IDS.accounts.alpha, 'QA Alpha Port', ids.users.sales, 'QAA', 'Vietnam'],
    );
    ids.accounts.alpha = IDS.accounts.alpha;

    await db.run(
      `INSERT INTO Account (id, companyName, accountType, status, assignedTo, shortName, country)
       VALUES (?, ?, 'Customer', 'active', ?, ?, ?)`,
      [IDS.accounts.beta, 'QA Beta Logistics', ids.users.sales, 'QAB', 'Vietnam'],
    );
    ids.accounts.beta = IDS.accounts.beta;

    await db.run(
      `INSERT INTO Account (id, companyName, accountType, status, assignedTo, shortName, country)
       VALUES (?, ?, 'Customer', 'active', ?, ?, ?)`,
      [IDS.accounts.gamma, 'QA Gamma Manufacturing', ids.users.projectManager, 'QAG', 'Vietnam'],
    );
    ids.accounts.gamma = IDS.accounts.gamma;

    await db.run(
      `INSERT INTO Account (id, companyName, accountType, status, shortName, country)
       VALUES (?, ?, 'Supplier', 'active', ?, ?)`,
      [IDS.accounts.supplier, 'QA Supplier One', 'QAS', 'China'],
    );
    ids.accounts.supplier = IDS.accounts.supplier;
  }

  if (contactUsesIntegerPrimaryKey) {
    const alphaContact = await db.run(
      `INSERT INTO Contact (accountId, lastName, firstName, department, jobTitle, gender, email, phone, isPrimaryContact)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [ids.accounts.alpha, 'Nguyen', 'Lan', 'Procurement', 'Manager', 'female', 'lan.alpha@qa.local', '0900000001'],
    );
    ids.contacts.alpha = String(alphaContact.lastID);

    const betaContact = await db.run(
      `INSERT INTO Contact (accountId, lastName, firstName, department, jobTitle, gender, email, phone, isPrimaryContact)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [ids.accounts.beta, 'Tran', 'Minh', 'Operations', 'Coordinator', 'male', 'minh.beta@qa.local', '0900000002'],
    );
    ids.contacts.beta = String(betaContact.lastID);
  } else {
    await db.run(
      `INSERT INTO Contact (id, accountId, lastName, firstName, department, jobTitle, gender, email, phone, isPrimaryContact)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [IDS.contacts.alpha, ids.accounts.alpha, 'Nguyen', 'Lan', 'Procurement', 'Manager', 'female', 'lan.alpha@qa.local', '0900000001'],
    );
    ids.contacts.alpha = IDS.contacts.alpha;

    await db.run(
      `INSERT INTO Contact (id, accountId, lastName, firstName, department, jobTitle, gender, email, phone, isPrimaryContact)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [IDS.contacts.beta, ids.accounts.beta, 'Tran', 'Minh', 'Operations', 'Coordinator', 'male', 'minh.beta@qa.local', '0900000002'],
    );
    ids.contacts.beta = IDS.contacts.beta;
  }
}

async function insertQaQuotation(
  db: Database,
  ids: QaSeedIds,
  input: {
    key: keyof typeof IDS.quotations;
    quoteNumber: string;
    subject: string;
    accountId: string;
    contactId: string;
    projectId: string;
    salesperson: string;
    salespersonPhone: string;
    revisionNo: number;
    revisionLabel: string;
    isWinningVersion: number;
    subtotal: number;
    taxTotal: number;
    grandTotal: number;
    status: string;
    lineItems: Array<{ sku: string; name: string; quantity: number; unitPrice: number; unit?: string; technicalSpecs?: string | null; remarks?: string | null }>;
    financialConfig?: { exchangeRate?: number; interestRate?: number; loanTermMonths?: number; markup?: number; vatRate?: number };
    commercialTerms?: { remarksVi?: string | null; remarksEn?: string | null; termItems?: Array<{ labelViPrint: string; labelEn: string; textVi: string; textEn: string }> };
    quoteDateSql?: string;
    validUntilSql?: string;
  }
) {
  const financialConfig = input.financialConfig || {};
  const commercialTerms = input.commercialTerms || {};
  const quotationId = IDS.quotations[input.key];
  const result = await db.run(
    `INSERT INTO Quotation (
      id,
      quoteNumber, quoteDate, subject, accountId, contactId, projectId, salesperson,
      salespersonPhone, currency, revisionNo, revisionLabel, isWinningVersion, items, financialParams, terms,
      interestRate, exchangeRate, loanTermMonths, markup, vatRate, remarksVi, remarksEn,
      subtotal, taxTotal, grandTotal, status, validUntil
    ) VALUES (?, ?, ${input.quoteDateSql || "date('now')"}, ?, ?, ?, ?, ?, ?, 'VND', ?, ?, ?, NULL, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${input.validUntilSql || "date('now', '+15 day')"})`,
    [
      quotationId,
      input.quoteNumber,
      input.subject,
      input.accountId,
      input.contactId,
      input.projectId,
      input.salesperson,
      input.salespersonPhone,
      input.revisionNo,
      input.revisionLabel,
      input.isWinningVersion,
      financialConfig.interestRate ?? 8.5,
      financialConfig.exchangeRate ?? 25450,
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
      `INSERT INTO QuotationLineItem (
        quotationId, sortOrder, sku, name, unit, technicalSpecs, remarks, quantity, unitPrice
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        quotationId,
        index,
        item.sku,
        item.name,
        item.unit || 'Chiếc',
        item.technicalSpecs || null,
        item.remarks || null,
        item.quantity,
        item.unitPrice,
      ]
    );
  }

  for (const [index, termItem] of (commercialTerms.termItems || []).entries()) {
    await db.run(
      `INSERT INTO QuotationTermItem (
        quotationId, sortOrder, labelViPrint, labelEn, textVi, textEn
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        quotationId,
        index,
        termItem.labelViPrint,
        termItem.labelEn,
        termItem.textVi,
        termItem.textEn,
      ]
    );
  }

  return quotationId;
}

async function insertQaProjectsAndQuotes(db: Database, ids: QaSeedIds) {
  const projectUsesIntegerPrimaryKey = await tableUsesIntegerPrimaryKey(db, 'Project');
  if (projectUsesIntegerPrimaryKey) {
    const quotingProject = await db.run(
      `INSERT INTO Project (code, name, description, managerId, accountId, projectStage, startDate, endDate, status)
       VALUES (?, ?, ?, ?, ?, ?, date('now', '-5 day'), date('now', '+20 day'), ?)`,
      ['QA-QUO-001', 'QA Quoting Project', 'Representative project for quoting-stage commercial checks.', ids.users.projectManager, ids.accounts.alpha, 'quoting', 'active'],
    );
    ids.projects.quoting = String(quotingProject.lastID);

    const wonProject = await db.run(
      `INSERT INTO Project (code, name, description, managerId, accountId, projectStage, startDate, endDate, status)
       VALUES (?, ?, ?, ?, ?, ?, date('now', '-12 day'), date('now', '+45 day'), ?)`,
      ['QA-WON-001', 'QA Won Project', 'Representative project for legal and executive checks.', ids.users.projectManager, ids.accounts.beta, 'won', 'active'],
    );
    ids.projects.won = String(wonProject.lastID);

    const deliveryProject = await db.run(
      `INSERT INTO Project (code, name, description, managerId, accountId, projectStage, startDate, endDate, status)
       VALUES (?, ?, ?, ?, ?, ?, date('now', '-18 day'), date('now', '+60 day'), ?)`,
      ['QA-DEL-001', 'QA Delivery Project', 'Representative project for delivery, finance and procurement checks.', ids.users.projectManager, ids.accounts.gamma, 'delivery', 'active'],
    );
    ids.projects.delivery = String(deliveryProject.lastID);
  } else {
    await db.run(
      `INSERT INTO Project (id, code, name, description, managerId, accountId, projectStage, startDate, endDate, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, date('now', '-5 day'), date('now', '+20 day'), ?)`,
      [IDS.projects.quoting, 'QA-QUO-001', 'QA Quoting Project', 'Representative project for quoting-stage commercial checks.', ids.users.projectManager, ids.accounts.alpha, 'quoting', 'active'],
    );
    ids.projects.quoting = IDS.projects.quoting;

    await db.run(
      `INSERT INTO Project (id, code, name, description, managerId, accountId, projectStage, startDate, endDate, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, date('now', '-12 day'), date('now', '+45 day'), ?)`,
      [IDS.projects.won, 'QA-WON-001', 'QA Won Project', 'Representative project for legal and executive checks.', ids.users.projectManager, ids.accounts.beta, 'won', 'active'],
    );
    ids.projects.won = IDS.projects.won;

    await db.run(
      `INSERT INTO Project (id, code, name, description, managerId, accountId, projectStage, startDate, endDate, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, date('now', '-18 day'), date('now', '+60 day'), ?)`,
      [IDS.projects.delivery, 'QA-DEL-001', 'QA Delivery Project', 'Representative project for delivery, finance and procurement checks.', ids.users.projectManager, ids.accounts.gamma, 'delivery', 'active'],
    );
    ids.projects.delivery = IDS.projects.delivery;
  }

  ids.quotations.quoting = await insertQaQuotation(db, ids, {
    key: 'quoting',
    quoteNumber: 'QA-Q-001',
    subject: 'QA Quoting Package',
    accountId: ids.accounts.alpha,
    contactId: ids.contacts.alpha,
    projectId: ids.projects.quoting,
    salesperson: QA_USERS.sales.fullName,
    salespersonPhone: '0900000101',
    revisionNo: 1,
    revisionLabel: 'R1',
    isWinningVersion: 0,
    subtotal: 150000000,
    taxTotal: 12000000,
    grandTotal: 162000000,
    status: 'sent',
    quoteDateSql: "date('now', '-2 day')",
    validUntilSql: "date('now', '+15 day')",
    lineItems: [{ sku: 'QA-KIT-001', name: 'QA Equipment Bundle', quantity: 1, unitPrice: 150000000, unit: 'Chiếc' }],
    financialConfig: { exchangeRate: 25450 },
    commercialTerms: { termItems: [{ labelViPrint: 'Hiệu lực', labelEn: 'Validity', textVi: '15 days', textEn: '15 days' }] },
  });

  ids.quotations.won = await insertQaQuotation(db, ids, {
    key: 'won',
    quoteNumber: 'QA-Q-002',
    subject: 'QA Winning Package',
    accountId: ids.accounts.beta,
    contactId: ids.contacts.beta,
    projectId: ids.projects.won,
    salesperson: QA_USERS.sales.fullName,
    salespersonPhone: '0900000102',
    revisionNo: 2,
    revisionLabel: 'R2',
    isWinningVersion: 1,
    subtotal: 240000000,
    taxTotal: 19200000,
    grandTotal: 259200000,
    status: 'accepted',
    quoteDateSql: "date('now', '-10 day')",
    validUntilSql: "date('now', '+20 day')",
    lineItems: [{ sku: 'QA-KIT-002', name: 'QA Port Upgrade', quantity: 1, unitPrice: 240000000, unit: 'Chiếc' }],
    financialConfig: { exchangeRate: 25450 },
    commercialTerms: { termItems: [{ labelViPrint: 'Hiệu lực', labelEn: 'Validity', textVi: '30 days', textEn: '30 days' }] },
  });

  ids.quotations.delivery = await insertQaQuotation(db, ids, {
    key: 'delivery',
    quoteNumber: 'QA-Q-003',
    subject: 'QA Delivery Package',
    accountId: ids.accounts.gamma,
    contactId: ids.contacts.alpha,
    projectId: ids.projects.delivery,
    salesperson: QA_USERS.projectManager.fullName,
    salespersonPhone: '0900000103',
    revisionNo: 1,
    revisionLabel: 'R1',
    isWinningVersion: 1,
    subtotal: 320000000,
    taxTotal: 25600000,
    grandTotal: 345600000,
    status: 'accepted',
    quoteDateSql: "date('now', '-20 day')",
    validUntilSql: "date('now', '+10 day')",
    lineItems: [{ sku: 'QA-KIT-003', name: 'QA Delivery Upgrade', quantity: 1, unitPrice: 320000000, unit: 'Chiếc' }],
    financialConfig: { exchangeRate: 25450 },
    commercialTerms: { termItems: [{ labelViPrint: 'Hiệu lực', labelEn: 'Validity', textVi: '30 days', textEn: '30 days' }] },
  });
}

async function insertQaExecutionData(db: Database, ids: QaSeedIds) {
  const baselineUsesIntegerPrimaryKey = await tableUsesIntegerPrimaryKey(db, 'ProjectExecutionBaseline');
  const procurementLineUsesIntegerPrimaryKey = await tableUsesIntegerPrimaryKey(db, 'ProjectProcurementLine');

  if (baselineUsesIntegerPrimaryKey) {
    const baselineResult = await db.run(
      `INSERT INTO ProjectExecutionBaseline (
        projectId, sourceType, sourceId, baselineNo, title, effectiveDate, currency, totalValue, lineItems, isCurrent, createdBy
      ) VALUES (?, 'main_contract', ?, 1, ?, date('now', '-15 day'), 'VND', ?, ?, 1, ?)`,
      [
        ids.projects.delivery,
        ids.quotations.delivery,
        'QA Delivery Baseline',
        345600000,
        JSON.stringify([{ lineKey: 'delivery-core', itemCode: 'QA-DEL-CORE', itemName: 'Delivery Core Package', quantity: 1 }]),
        ids.users.projectManager,
      ],
    );
    ids.baselines.delivery = String(baselineResult.lastID);
  } else {
    await db.run(
      `INSERT INTO ProjectExecutionBaseline (
        id, projectId, sourceType, sourceId, baselineNo, title, effectiveDate, currency, totalValue, lineItems, isCurrent, createdBy
      ) VALUES (?, ?, 'main_contract', ?, 1, ?, date('now', '-15 day'), 'VND', ?, ?, 1, ?)`,
      [
        IDS.baselines.delivery,
        ids.projects.delivery,
        ids.quotations.delivery,
        'QA Delivery Baseline',
        345600000,
        JSON.stringify([{ lineKey: 'delivery-core', itemCode: 'QA-DEL-CORE', itemName: 'Delivery Core Package', quantity: 1 }]),
        ids.users.projectManager,
      ],
    );
    ids.baselines.delivery = IDS.baselines.delivery;
  }

  if (procurementLineUsesIntegerPrimaryKey) {
    const procurementResult = await db.run(
      `INSERT INTO ProjectProcurementLine (
        projectId, baselineId, sourceLineKey, itemCode, itemName, unit, contractQty,
        orderedQty, receivedQty, deliveredQty, shortageQty, shortageStatus, supplierId, poNumber,
        etaDate, committedDeliveryDate, status, note, isActive
      ) VALUES (?, ?, ?, ?, ?, 'Set', 10, 7, 4, 2, 3, 'pending', ?, ?, date('now', '-2 day'), date('now', '-1 day'), 'ordered', ?, 1)`,
      [
        ids.projects.delivery,
        ids.baselines.delivery,
        'delivery-core',
        'QA-DEL-CORE',
        'Delivery Core Package',
        ids.accounts.supplier,
        'PO-QA-001',
        'Seeded shortage + overdue ETA for procurement and finance risk checks.',
      ],
    );
    ids.procurementLines.deliveryCore = String(procurementResult.lastID);
  } else {
    await db.run(
      `INSERT INTO ProjectProcurementLine (
        id, projectId, baselineId, sourceLineKey, itemCode, itemName, unit, contractQty,
        orderedQty, receivedQty, deliveredQty, shortageQty, shortageStatus, supplierId, poNumber,
        etaDate, committedDeliveryDate, status, note, isActive
      ) VALUES (?, ?, ?, ?, ?, ?, 'Set', 10, 7, 4, 2, 3, 'pending', ?, ?, date('now', '-2 day'), date('now', '-1 day'), 'ordered', ?, 1)`,
      [
        IDS.procurementLines.deliveryCore,
        ids.projects.delivery,
        ids.baselines.delivery,
        'delivery-core',
        'QA-DEL-CORE',
        'Delivery Core Package',
        ids.accounts.supplier,
        'PO-QA-001',
        'Seeded shortage + overdue ETA for procurement and finance risk checks.',
      ],
    );
    ids.procurementLines.deliveryCore = IDS.procurementLines.deliveryCore;
  }

  const milestoneUsesIntegerPrimaryKey = await tableUsesIntegerPrimaryKey(db, 'ProjectMilestone');
  const timelineUsesIntegerPrimaryKey = await tableUsesIntegerPrimaryKey(db, 'ProjectTimelineEvent');

  if (milestoneUsesIntegerPrimaryKey) {
    const milestoneResult = await db.run(
      `INSERT INTO ProjectMilestone (
        projectId, milestoneType, title, plannedDate, actualDate, status, note, createdBy
      ) VALUES (?, 'kickoff', ?, date('now', '+2 day'), NULL, 'pending', ?, ?)`,
      [
        ids.projects.delivery,
        'Kickoff delivery execution',
        'Milestone used by PM/timeline audit flow.',
        ids.users.projectManager,
      ],
    );
    ids.milestones.deliveryKickoff = String(milestoneResult.lastID);
  } else {
    await db.run(
      `INSERT INTO ProjectMilestone (
        id, projectId, milestoneType, title, plannedDate, actualDate, status, note, createdBy
      ) VALUES (?, ?, 'kickoff', ?, date('now', '+2 day'), NULL, 'pending', ?, ?)`,
      [
        IDS.milestones.deliveryKickoff,
        ids.projects.delivery,
        'Kickoff delivery execution',
        'Milestone used by PM/timeline audit flow.',
        ids.users.projectManager,
      ],
    );
    ids.milestones.deliveryKickoff = IDS.milestones.deliveryKickoff;
  }

  if (timelineUsesIntegerPrimaryKey) {
    const timelineResult = await db.run(
      `INSERT INTO ProjectTimelineEvent (
        projectId, eventType, title, description, eventDate, entityType, entityId, payload, createdBy
      ) VALUES (?, 'workflow', ?, ?, date('now', '-1 day'), 'ProjectMilestone', ?, ?, ?)`,
      [
        ids.projects.delivery,
        'Delivery readiness review',
        'Timeline event for PM and combined workspace timeline checks.',
        ids.milestones.deliveryKickoff,
        JSON.stringify({ source: 'qa-seed' }),
        ids.users.projectManager,
      ],
    );
    ids.timeline.deliveryKickoff = String(timelineResult.lastID);
  } else {
    await db.run(
      `INSERT INTO ProjectTimelineEvent (
        id, projectId, eventType, title, description, eventDate, entityType, entityId, payload, createdBy
      ) VALUES (?, ?, 'workflow', ?, ?, date('now', '-1 day'), 'ProjectMilestone', ?, ?, ?)`,
      [
        IDS.timeline.deliveryKickoff,
        ids.projects.delivery,
        'Delivery readiness review',
        'Timeline event for PM and combined workspace timeline checks.',
        ids.milestones.deliveryKickoff,
        JSON.stringify({ source: 'qa-seed' }),
        ids.users.projectManager,
      ],
    );
    ids.timeline.deliveryKickoff = IDS.timeline.deliveryKickoff;
  }
}

async function insertQaTasksApprovalsDocuments(db: Database, ids: QaSeedIds) {
  const salesFollowUp = await db.run(
    `INSERT INTO Task (
      projectId, name, description, assigneeId, status, priority, startDate, dueDate, completionPct,
      quotationId, taskType, department, blockedReason
    ) VALUES (?, ?, ?, ?, 'active', 'high', date('now', '-1 day'), date('now', '+1 day'), 40, ?, 'follow_up', 'Sales', NULL)`,
    [ids.projects.quoting, 'Follow up quoting package', 'Commercial follow-up for QA quoting journey.', ids.users.sales, ids.quotations.quoting],
  );
  ids.tasks.salesFollowUp = String(salesFollowUp.lastID);

  const handoffTask = await db.run(
    `INSERT INTO Task (
      projectId, name, description, assigneeId, status, priority, startDate, dueDate, completionPct,
      quotationId, taskType, department, blockedReason
    ) VALUES (?, ?, ?, ?, 'active', 'high', date('now', '-2 day'), date('now', '+2 day'), 20, ?, 'handoff', 'Operations', ?)`,
    [ids.projects.won, 'Validate project handoff', 'PM handoff validation item.', ids.users.projectManager, ids.quotations.won, 'Awaiting legal package'],
  );
  ids.tasks.handoff = String(handoffTask.lastID);

  const deliveryTask = await db.run(
    `INSERT INTO Task (
      projectId, name, description, assigneeId, status, priority, startDate, dueDate, completionPct,
      quotationId, taskType, department, blockedReason
    ) VALUES (?, ?, ?, ?, 'active', 'high', date('now', '-3 day'), date('now', '+3 day'), 35, ?, 'delivery_handoff', 'Operations', ?)`,
    [ids.projects.delivery, 'Coordinate delivery execution', 'Execution-focused item for PM and director audit flows.', ids.users.projectManager, ids.quotations.delivery, 'Waiting inbound completion'],
  );
  ids.tasks.delivery = String(deliveryTask.lastID);

  const procurementTask = await db.run(
    `INSERT INTO Task (
      projectId, name, description, assigneeId, status, priority, startDate, dueDate, completionPct,
      quotationId, taskType, department, blockedReason
    ) VALUES (?, ?, ?, ?, 'active', 'high', date('now', '-3 day'), date('now', '+1 day'), 15, ?, 'procurement_followup', 'Procurement', ?)`,
    [ids.projects.delivery, 'Resolve supplier shortage', 'Procurement queue item tied to overdue ETA.', ids.users.procurement, ids.quotations.delivery, 'ETA overdue from supplier'],
  );
  ids.tasks.procurement = String(procurementTask.lastID);

  const accountingTask = await db.run(
    `INSERT INTO Task (
      projectId, name, description, assigneeId, status, priority, startDate, dueDate, completionPct,
      quotationId, taskType, department, blockedReason
    ) VALUES (?, ?, ?, ?, 'active', 'medium', date('now', '-2 day'), date('now', '+2 day'), 10, ?, 'payment_review', 'Finance', NULL)`,
    [ids.projects.delivery, 'Review payment milestone', 'Accounting queue item for finance cockpit.', ids.users.accounting, ids.quotations.delivery],
  );
  ids.tasks.accounting = String(accountingTask.lastID);

  const legalTask = await db.run(
    `INSERT INTO Task (
      projectId, name, description, assigneeId, status, priority, startDate, dueDate, completionPct,
      quotationId, taskType, department, blockedReason
    ) VALUES (?, ?, ?, ?, 'active', 'medium', date('now', '-2 day'), date('now', '+2 day'), 10, ?, 'contract_review', 'Legal', ?)`,
    [ids.projects.won, 'Review contract deviation', 'Legal queue item tied to pending contract review.', ids.users.legal, ids.quotations.won, 'Awaiting appendix upload'],
  );
  ids.tasks.legal = String(legalTask.lastID);

  const viewerTask = await db.run(
    `INSERT INTO Task (
      projectId, name, description, assigneeId, status, priority, startDate, dueDate, completionPct,
      quotationId, taskType, department, blockedReason
    ) VALUES (?, ?, ?, ?, 'pending', 'low', date('now'), date('now', '+5 day'), 0, ?, 'observe', 'Audit', NULL)`,
    [ids.projects.won, 'Observe project status', 'Read-only visibility item for viewer smoke checks.', ids.users.viewer, ids.quotations.won],
  );
  ids.tasks.viewer = String(viewerTask.lastID);

  const approvalRows = [
    ['commercial', ids.projects.quoting, ids.quotations.quoting, 'commercial-review', 'Commercial approval', 'Sales', ids.users.sales, 'sales', ids.users.sales],
    ['procurement', ids.projects.delivery, ids.quotations.delivery, 'po-approval', 'Procurement approval', 'Procurement', ids.users.projectManager, 'procurement', ids.users.procurement],
    ['finance', ids.projects.delivery, ids.quotations.delivery, 'payment-milestone', 'Finance approval', 'Finance', ids.users.projectManager, 'accounting', ids.users.accounting],
    ['legal', ids.projects.won, ids.quotations.won, 'contract-review', 'Legal approval', 'Legal', ids.users.projectManager, 'legal', ids.users.legal],
    ['executive', ids.projects.won, ids.quotations.won, 'margin-exception', 'Executive approval', 'BOD', ids.users.projectManager, 'director', ids.users.director],
  ] as const;

  for (const [key, projectId, quotationId, requestType, title, department, requestedBy, approverRole, approverUserId] of approvalRows) {
    const result = await db.run(
      `INSERT INTO ApprovalRequest (
        projectId, quotationId, requestType, title, department, requestedBy, approverRole, approverUserId, status, dueDate, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', date('now', '+3 day'), ?)`,
      [projectId, quotationId, requestType, title, department, requestedBy, approverRole, approverUserId, 'Seeded for UX regression lane checks.'],
    );
    ids.approvals[key] = String(result.lastID);
  }

  const legalDocument = await db.run(
    `INSERT INTO ProjectDocument (
      projectId, quotationId, documentCode, documentName, category, department, status, requiredAtStage, note
    ) VALUES (?, ?, 'HDMB', 'Contract package', 'Contract', 'Legal', 'missing', 'legal_review', ?)`,
    [ids.projects.won, ids.quotations.won, 'Missing legal package for audit flow'],
  );
  ids.documents.legalContract = String(legalDocument.lastID);

  const financeDocument = await db.run(
    `INSERT INTO ProjectDocument (
      projectId, quotationId, documentCode, documentName, category, department, status, requiredAtStage, note
    ) VALUES (?, ?, 'PAY-01', 'Payment milestone backup', 'Finance', 'Finance', 'requested', 'delivery', ?)`,
    [ids.projects.delivery, ids.quotations.delivery, 'Requested finance backup document for audit flow'],
  );
  ids.documents.financeMilestone = String(financeDocument.lastID);
}

async function insertQaAdminArtifacts(db: Database, ids: QaSeedIds) {
  const supportTicket = await db.run(
    `INSERT INTO SupportTicket (
      category, subject, description, status, responseNote, createdBy, updatedBy, createdAt, updatedAt
    ) VALUES ('system', ?, ?, 'open', ?, ?, ?, datetime('now', '-1 day'), datetime('now'))`,
    [
      'QA preview issue follow-up',
      'Support ticket used for admin/support smoke coverage.',
      'Awaiting admin verification from UX regression seed.',
      ids.users.admin,
      ids.users.admin,
    ],
  );

  await db.run(
    `INSERT INTO Notification (userId, content, entityType, entityId, link, createdAt)
     VALUES (?, ?, 'SupportTicket', ?, 'Support', datetime('now', '-1 hour'))`,
    [ids.users.admin, 'QA support ticket requires review', String(supportTicket.lastID)],
  );
  await db.run(
    `INSERT INTO Notification (userId, content, entityType, entityId, link, createdAt)
     VALUES (?, ?, 'Project', ?, 'Projects', datetime('now', '-30 minutes'))`,
    [ids.users.projectManager, 'QA project handoff needs attention', ids.projects.won],
  );

  await db.run(
    `INSERT INTO Activity (
      title, description, category, icon, color, iconColor, entityId, entityType, actorUserId, actorRoles, actingCapability, action, timestamp, createdAt
    ) VALUES (
      'Approval decision',
      'Seeded approval activity for Event Log smoke checks.',
      'Approval',
      'shield',
      '#e0f2fe',
      '#0284c7',
      ?,
      'Project',
      ?,
      ?,
      'director',
      'approval_decision',
      datetime('now', '-20 minutes'),
      datetime('now', '-20 minutes')
    )`,
    [ids.projects.won, ids.users.director, JSON.stringify(['director'])],
  );
}

export async function resetUxRegressionSeed(db: Database) {
  const ids = createQaSeedIds();
  let committed = false;
  await db.exec('PRAGMA foreign_keys = OFF');
  await db.exec('BEGIN');
  try {
    await clearQaTables(db);
    await insertQaUsers(db, ids);
    await insertQaAccounts(db, ids);
    await insertQaProjectsAndQuotes(db, ids);
    await insertQaExecutionData(db, ids);
    await insertQaTasksApprovalsDocuments(db, ids);
    await insertQaAdminArtifacts(db, ids);
    await db.exec('COMMIT');
    committed = true;
    await db.exec('PRAGMA foreign_keys = ON');
    const fkProblems: any[] = await db.all('PRAGMA foreign_key_check');
    if (fkProblems.length > 0) {
      throw new Error(`QA seed created invalid foreign keys: ${JSON.stringify(fkProblems[0])}`);
    }
  } catch (error) {
    if (!committed) {
      await db.exec('ROLLBACK');
    }
    await db.exec('PRAGMA foreign_keys = ON');
    throw error;
  }
  return buildUxSeedContract(toLegacySampleIds(ids));
}
