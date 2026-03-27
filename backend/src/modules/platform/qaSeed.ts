import bcrypt from 'bcryptjs';
import type { Database } from 'sqlite';
import type { SystemRole } from '../../shared/contracts/domain';

type QaUserSeed = {
  id: string;
  username: string;
  password: string;
  fullName: string;
  systemRole: SystemRole;
  roleCodes: SystemRole[];
  department: string;
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

const QA_PASSWORD = 'QaRole@123';

const QA_USERS: Record<string, QaUserSeed> = {
  admin: {
    id: 'qa-user-admin',
    username: 'qa_admin',
    password: 'admin123',
    fullName: 'QA Administrator',
    systemRole: 'admin',
    roleCodes: ['admin'],
    department: 'IT',
  },
  sales: {
    id: 'qa-user-sales',
    username: 'qa_sales',
    password: QA_PASSWORD,
    fullName: 'QA Sales',
    systemRole: 'sales',
    roleCodes: ['sales'],
    department: 'Sales',
  },
  projectManager: {
    id: 'qa-user-project-manager',
    username: 'qa_pm',
    password: QA_PASSWORD,
    fullName: 'QA Project Manager',
    systemRole: 'project_manager',
    roleCodes: ['project_manager'],
    department: 'Operations',
  },
  procurement: {
    id: 'qa-user-procurement',
    username: 'qa_procurement',
    password: QA_PASSWORD,
    fullName: 'QA Procurement',
    systemRole: 'procurement',
    roleCodes: ['procurement'],
    department: 'Procurement',
  },
  accounting: {
    id: 'qa-user-accounting',
    username: 'qa_accounting',
    password: QA_PASSWORD,
    fullName: 'QA Accounting',
    systemRole: 'accounting',
    roleCodes: ['accounting'],
    department: 'Finance',
  },
  legal: {
    id: 'qa-user-legal',
    username: 'qa_legal',
    password: QA_PASSWORD,
    fullName: 'QA Legal',
    systemRole: 'legal',
    roleCodes: ['legal'],
    department: 'Legal',
  },
  director: {
    id: 'qa-user-director',
    username: 'qa_director',
    password: QA_PASSWORD,
    fullName: 'QA Director',
    systemRole: 'director',
    roleCodes: ['director'],
    department: 'BOD',
  },
  viewer: {
    id: 'qa-user-viewer',
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

const RESET_TABLES = [
  'Notification',
  'ChatMessage',
  'SupportTicket',
  'Activity',
  'ApprovalRequest',
  'ProjectDocument',
  'ProjectTimelineEvent',
  'ProjectMilestone',
  'ProjectDeliveryLine',
  'ProjectInboundLine',
  'ProjectProcurementLine',
  'ProjectExecutionBaseline',
  'ProjectContractAppendix',
  'ProjectContract',
  'SalesOrder',
  'ErpOutbox',
  'Task',
  'PricingLineItem',
  'PricingQuotation',
  'Quotation',
  'SupplierQuote',
  'Contact',
  'Lead',
  'Project',
  'Account',
  'User',
];

export function buildUxSeedContract(): UxSeedContract {
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
    sampleIds: {
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
  for (const table of RESET_TABLES) {
    await db.run(`DELETE FROM ${table}`);
  }
}

async function insertQaUsers(db: Database) {
  for (const user of Object.values(QA_USERS)) {
    const passwordHash = await bcrypt.hash(user.password, 10);
    await db.run(
      `INSERT INTO User (
        id, fullName, gender, email, phone, role, department, status,
        username, passwordHash, systemRole, roleCodes, accountStatus, mustChangePassword, language
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id,
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
}

async function insertQaAccounts(db: Database) {
  await db.run(
    `INSERT INTO Account (id, companyName, accountType, status, assignedTo, shortName, country)
     VALUES (?, ?, 'Customer', 'active', ?, ?, ?)`,
    [IDS.accounts.alpha, 'QA Alpha Port', QA_USERS.sales.id, 'QAA', 'Vietnam'],
  );
  await db.run(
    `INSERT INTO Account (id, companyName, accountType, status, assignedTo, shortName, country)
     VALUES (?, ?, 'Customer', 'active', ?, ?, ?)`,
    [IDS.accounts.beta, 'QA Beta Logistics', QA_USERS.sales.id, 'QAB', 'Vietnam'],
  );
  await db.run(
    `INSERT INTO Account (id, companyName, accountType, status, assignedTo, shortName, country)
     VALUES (?, ?, 'Customer', 'active', ?, ?, ?)`,
    [IDS.accounts.gamma, 'QA Gamma Manufacturing', QA_USERS.projectManager.id, 'QAG', 'Vietnam'],
  );
  await db.run(
    `INSERT INTO Account (id, companyName, accountType, status, shortName, country)
     VALUES (?, ?, 'Supplier', 'active', ?, ?)`,
    [IDS.accounts.supplier, 'QA Supplier One', 'QAS', 'China'],
  );

  await db.run(
    `INSERT INTO Contact (id, accountId, lastName, firstName, department, jobTitle, gender, email, phone, isPrimaryContact)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [IDS.contacts.alpha, IDS.accounts.alpha, 'Nguyen', 'Lan', 'Procurement', 'Manager', 'female', 'lan.alpha@qa.local', '0900000001'],
  );
  await db.run(
    `INSERT INTO Contact (id, accountId, lastName, firstName, department, jobTitle, gender, email, phone, isPrimaryContact)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [IDS.contacts.beta, IDS.accounts.beta, 'Tran', 'Minh', 'Operations', 'Coordinator', 'male', 'minh.beta@qa.local', '0900000002'],
  );
}

async function insertQaProjectsAndQuotes(db: Database) {
  await db.run(
    `INSERT INTO Project (id, code, name, description, managerId, accountId, projectStage, startDate, endDate, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, date('now', '-5 day'), date('now', '+20 day'), ?)`,
    [IDS.projects.quoting, 'QA-QUO-001', 'QA Quoting Project', 'Representative project for quoting-stage commercial checks.', QA_USERS.projectManager.id, IDS.accounts.alpha, 'quoting', 'active'],
  );
  await db.run(
    `INSERT INTO Project (id, code, name, description, managerId, accountId, projectStage, startDate, endDate, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, date('now', '-12 day'), date('now', '+45 day'), ?)`,
    [IDS.projects.won, 'QA-WON-001', 'QA Won Project', 'Representative project for legal and executive checks.', QA_USERS.projectManager.id, IDS.accounts.beta, 'won', 'active'],
  );
  await db.run(
    `INSERT INTO Project (id, code, name, description, managerId, accountId, projectStage, startDate, endDate, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, date('now', '-18 day'), date('now', '+60 day'), ?)`,
    [IDS.projects.delivery, 'QA-DEL-001', 'QA Delivery Project', 'Representative project for delivery, finance and procurement checks.', QA_USERS.projectManager.id, IDS.accounts.gamma, 'delivery', 'active'],
  );

  await db.run(
    `INSERT INTO Quotation (
      id, quoteNumber, quoteDate, subject, accountId, contactId, projectId, salesperson,
      salespersonPhone, currency, revisionNo, revisionLabel, isWinningVersion, items, financialParams, terms,
      subtotal, taxTotal, grandTotal, status, validUntil
    ) VALUES (?, ?, date('now', '-2 day'), ?, ?, ?, ?, ?, ?, 'VND', 1, 'R1', 0, ?, ?, ?, ?, ?, ?, ?, date('now', '+15 day'))`,
    [
      IDS.quotations.quoting,
      'QA-Q-001',
      'QA Quoting Package',
      IDS.accounts.alpha,
      IDS.contacts.alpha,
      IDS.projects.quoting,
      QA_USERS.sales.fullName,
      '0900000101',
      JSON.stringify([{ sku: 'QA-KIT-001', name: 'QA Equipment Bundle', quantity: 1, unitPrice: 150000000 }]),
      JSON.stringify({ exchangeRate: 25450 }),
      JSON.stringify({ validity: '15 days' }),
      150000000,
      12000000,
      162000000,
      'sent',
    ],
  );

  await db.run(
    `INSERT INTO Quotation (
      id, quoteNumber, quoteDate, subject, accountId, contactId, projectId, salesperson,
      salespersonPhone, currency, revisionNo, revisionLabel, isWinningVersion, items, financialParams, terms,
      subtotal, taxTotal, grandTotal, status, validUntil
    ) VALUES (?, ?, date('now', '-10 day'), ?, ?, ?, ?, ?, ?, 'VND', 2, 'R2', 1, ?, ?, ?, ?, ?, ?, ?, date('now', '+20 day'))`,
    [
      IDS.quotations.won,
      'QA-Q-002',
      'QA Winning Package',
      IDS.accounts.beta,
      IDS.contacts.beta,
      IDS.projects.won,
      QA_USERS.sales.fullName,
      '0900000102',
      JSON.stringify([{ sku: 'QA-KIT-002', name: 'QA Port Upgrade', quantity: 1, unitPrice: 240000000 }]),
      JSON.stringify({ exchangeRate: 25450 }),
      JSON.stringify({ validity: '30 days' }),
      240000000,
      19200000,
      259200000,
      'accepted',
    ],
  );

  await db.run(
    `INSERT INTO Quotation (
      id, quoteNumber, quoteDate, subject, accountId, contactId, projectId, salesperson,
      salespersonPhone, currency, revisionNo, revisionLabel, isWinningVersion, items, financialParams, terms,
      subtotal, taxTotal, grandTotal, status, validUntil
    ) VALUES (?, ?, date('now', '-20 day'), ?, ?, ?, ?, ?, ?, 'VND', 1, 'R1', 1, ?, ?, ?, ?, ?, ?, ?, date('now', '+10 day'))`,
    [
      IDS.quotations.delivery,
      'QA-Q-003',
      'QA Delivery Package',
      IDS.accounts.gamma,
      IDS.contacts.alpha,
      IDS.projects.delivery,
      QA_USERS.projectManager.fullName,
      '0900000103',
      JSON.stringify([{ sku: 'QA-KIT-003', name: 'QA Delivery Upgrade', quantity: 1, unitPrice: 320000000 }]),
      JSON.stringify({ exchangeRate: 25450 }),
      JSON.stringify({ validity: '30 days' }),
      320000000,
      25600000,
      345600000,
      'accepted',
    ],
  );
}

async function insertQaExecutionData(db: Database) {
  await db.run(
    `INSERT INTO ProjectExecutionBaseline (
      id, projectId, sourceType, sourceId, baselineNo, title, effectiveDate, currency, totalValue, lineItems, isCurrent, createdBy
    ) VALUES (?, ?, 'main_contract', ?, 1, ?, date('now', '-15 day'), 'VND', ?, ?, 1, ?)`,
    [
      IDS.baselines.delivery,
      IDS.projects.delivery,
      IDS.quotations.delivery,
      'QA Delivery Baseline',
      345600000,
      JSON.stringify([{ lineKey: 'delivery-core', itemCode: 'QA-DEL-CORE', itemName: 'Delivery Core Package', quantity: 1 }]),
      QA_USERS.projectManager.id,
    ],
  );

  await db.run(
    `INSERT INTO ProjectProcurementLine (
      id, projectId, baselineId, sourceLineKey, itemCode, itemName, unit, contractQty,
      orderedQty, receivedQty, deliveredQty, shortageQty, shortageStatus, supplierId, poNumber,
      etaDate, committedDeliveryDate, status, note, isActive
    ) VALUES (?, ?, ?, ?, ?, ?, 'Set', 10, 7, 4, 2, 3, 'pending', ?, ?, date('now', '-2 day'), date('now', '-1 day'), 'ordered', ?, 1)`,
    [
      IDS.procurementLines.deliveryCore,
      IDS.projects.delivery,
      IDS.baselines.delivery,
      'delivery-core',
      'QA-DEL-CORE',
      'Delivery Core Package',
      IDS.accounts.supplier,
      'PO-QA-001',
      'Seeded shortage + overdue ETA for procurement and finance risk checks.',
    ],
  );

  await db.run(
    `INSERT INTO ProjectMilestone (
      id, projectId, milestoneType, title, plannedDate, actualDate, status, note, createdBy
    ) VALUES (?, ?, 'kickoff', ?, date('now', '+2 day'), NULL, 'pending', ?, ?)`,
    [
      IDS.milestones.deliveryKickoff,
      IDS.projects.delivery,
      'Kickoff delivery execution',
      'Milestone used by PM/timeline audit flow.',
      QA_USERS.projectManager.id,
    ],
  );

  await db.run(
    `INSERT INTO ProjectTimelineEvent (
      id, projectId, eventType, title, description, eventDate, entityType, entityId, payload, createdBy
    ) VALUES (?, ?, 'workflow', ?, ?, date('now', '-1 day'), 'ProjectMilestone', ?, ?, ?)`,
    [
      IDS.timeline.deliveryKickoff,
      IDS.projects.delivery,
      'Delivery readiness review',
      'Timeline event for PM and combined workspace timeline checks.',
      IDS.milestones.deliveryKickoff,
      JSON.stringify({ source: 'qa-seed' }),
      QA_USERS.projectManager.id,
    ],
  );
}

async function insertQaTasksApprovalsDocuments(db: Database) {
  await db.run(
    `INSERT INTO Task (
      id, projectId, name, description, assigneeId, status, priority, startDate, dueDate, completionPct,
      quotationId, taskType, department, blockedReason
    ) VALUES (?, ?, ?, ?, ?, 'active', 'high', date('now', '-1 day'), date('now', '+1 day'), 40, ?, 'follow_up', 'Sales', NULL)`,
    [IDS.tasks.salesFollowUp, IDS.projects.quoting, 'Follow up quoting package', 'Commercial follow-up for QA quoting journey.', QA_USERS.sales.id, IDS.quotations.quoting],
  );
  await db.run(
    `INSERT INTO Task (
      id, projectId, name, description, assigneeId, status, priority, startDate, dueDate, completionPct,
      quotationId, taskType, department, blockedReason
    ) VALUES (?, ?, ?, ?, ?, 'active', 'high', date('now', '-2 day'), date('now', '+2 day'), 20, ?, 'handoff', 'Operations', ?)`,
    [IDS.tasks.handoff, IDS.projects.won, 'Validate project handoff', 'PM handoff validation item.', QA_USERS.projectManager.id, IDS.quotations.won, 'Awaiting legal package'],
  );
  await db.run(
    `INSERT INTO Task (
      id, projectId, name, description, assigneeId, status, priority, startDate, dueDate, completionPct,
      quotationId, taskType, department, blockedReason
    ) VALUES (?, ?, ?, ?, ?, 'active', 'high', date('now', '-3 day'), date('now', '+3 day'), 35, ?, 'delivery_handoff', 'Operations', ?)`,
    [IDS.tasks.delivery, IDS.projects.delivery, 'Coordinate delivery execution', 'Execution-focused item for PM and director audit flows.', QA_USERS.projectManager.id, IDS.quotations.delivery, 'Waiting inbound completion'],
  );
  await db.run(
    `INSERT INTO Task (
      id, projectId, name, description, assigneeId, status, priority, startDate, dueDate, completionPct,
      quotationId, taskType, department, blockedReason
    ) VALUES (?, ?, ?, ?, ?, 'active', 'high', date('now', '-3 day'), date('now', '+1 day'), 15, ?, 'procurement_followup', 'Procurement', ?)`,
    [IDS.tasks.procurement, IDS.projects.delivery, 'Resolve supplier shortage', 'Procurement queue item tied to overdue ETA.', QA_USERS.procurement.id, IDS.quotations.delivery, 'ETA overdue from supplier'],
  );
  await db.run(
    `INSERT INTO Task (
      id, projectId, name, description, assigneeId, status, priority, startDate, dueDate, completionPct,
      quotationId, taskType, department, blockedReason
    ) VALUES (?, ?, ?, ?, ?, 'active', 'medium', date('now', '-2 day'), date('now', '+2 day'), 10, ?, 'payment_review', 'Finance', NULL)`,
    [IDS.tasks.accounting, IDS.projects.delivery, 'Review payment milestone', 'Accounting queue item for finance cockpit.', QA_USERS.accounting.id, IDS.quotations.delivery],
  );
  await db.run(
    `INSERT INTO Task (
      id, projectId, name, description, assigneeId, status, priority, startDate, dueDate, completionPct,
      quotationId, taskType, department, blockedReason
    ) VALUES (?, ?, ?, ?, ?, 'active', 'medium', date('now', '-2 day'), date('now', '+2 day'), 10, ?, 'contract_review', 'Legal', ?)`,
    [IDS.tasks.legal, IDS.projects.won, 'Review contract deviation', 'Legal queue item tied to pending contract review.', QA_USERS.legal.id, IDS.quotations.won, 'Awaiting appendix upload'],
  );
  await db.run(
    `INSERT INTO Task (
      id, projectId, name, description, assigneeId, status, priority, startDate, dueDate, completionPct,
      quotationId, taskType, department, blockedReason
    ) VALUES (?, ?, ?, ?, ?, 'pending', 'low', date('now'), date('now', '+5 day'), 0, ?, 'observe', 'Audit', NULL)`,
    [IDS.tasks.viewer, IDS.projects.won, 'Observe project status', 'Read-only visibility item for viewer smoke checks.', QA_USERS.viewer.id, IDS.quotations.won],
  );

  const approvalRows = [
    [IDS.approvals.commercial, IDS.projects.quoting, IDS.quotations.quoting, 'commercial-review', 'Commercial approval', 'Sales', QA_USERS.sales.id, 'sales', QA_USERS.sales.id],
    [IDS.approvals.procurement, IDS.projects.delivery, IDS.quotations.delivery, 'po-approval', 'Procurement approval', 'Procurement', QA_USERS.projectManager.id, 'procurement', QA_USERS.procurement.id],
    [IDS.approvals.finance, IDS.projects.delivery, IDS.quotations.delivery, 'payment-milestone', 'Finance approval', 'Finance', QA_USERS.projectManager.id, 'accounting', QA_USERS.accounting.id],
    [IDS.approvals.legal, IDS.projects.won, IDS.quotations.won, 'contract-review', 'Legal approval', 'Legal', QA_USERS.projectManager.id, 'legal', QA_USERS.legal.id],
    [IDS.approvals.executive, IDS.projects.won, IDS.quotations.won, 'margin-exception', 'Executive approval', 'BOD', QA_USERS.projectManager.id, 'director', QA_USERS.director.id],
  ];

  for (const row of approvalRows) {
    await db.run(
      `INSERT INTO ApprovalRequest (
        id, projectId, quotationId, requestType, title, department, requestedBy, approverRole, approverUserId, status, dueDate, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', date('now', '+3 day'), ?)`,
      [...row, 'Seeded for UX regression lane checks.'],
    );
  }

  await db.run(
    `INSERT INTO ProjectDocument (
      id, projectId, quotationId, documentCode, documentName, category, department, status, requiredAtStage, note
    ) VALUES (?, ?, ?, 'HDMB', 'Contract package', 'Contract', 'Legal', 'missing', 'legal_review', ?)`,
    [IDS.documents.legalContract, IDS.projects.won, IDS.quotations.won, 'Missing legal package for audit flow'],
  );
  await db.run(
    `INSERT INTO ProjectDocument (
      id, projectId, quotationId, documentCode, documentName, category, department, status, requiredAtStage, note
    ) VALUES (?, ?, ?, 'PAY-01', 'Payment milestone backup', 'Finance', 'Finance', 'requested', 'delivery', ?)`,
    [IDS.documents.financeMilestone, IDS.projects.delivery, IDS.quotations.delivery, 'Requested finance backup document for audit flow'],
  );
}

async function insertQaAdminArtifacts(db: Database) {
  await db.run(
    `INSERT INTO SupportTicket (
      id, category, subject, description, status, responseNote, createdBy, updatedBy, createdAt, updatedAt
    ) VALUES (?, 'system', ?, ?, 'open', ?, ?, ?, datetime('now', '-1 day'), datetime('now'))`,
    [
      IDS.supportTickets.admin,
      'QA preview issue follow-up',
      'Support ticket used for admin/support smoke coverage.',
      'Awaiting admin verification from UX regression seed.',
      QA_USERS.admin.id,
      QA_USERS.admin.id,
    ],
  );

  await db.run(
    `INSERT INTO Notification (id, userId, content, entityType, entityId, link, createdAt)
     VALUES (?, ?, ?, 'SupportTicket', ?, 'Support', datetime('now', '-1 hour'))`,
    [IDS.notifications.admin, QA_USERS.admin.id, 'QA support ticket requires review', IDS.supportTickets.admin],
  );
  await db.run(
    `INSERT INTO Notification (id, userId, content, entityType, entityId, link, createdAt)
     VALUES (?, ?, ?, 'Project', ?, 'Projects', datetime('now', '-30 minutes'))`,
    [IDS.notifications.projectManager, QA_USERS.projectManager.id, 'QA project handoff needs attention', IDS.projects.won],
  );

  await db.run(
    `INSERT INTO Activity (
      id, title, description, category, icon, color, iconColor, entityId, entityType, actorUserId, actorRoles, actingCapability, action, timestamp, createdAt
    ) VALUES (
      'qa-activity-approval',
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
    [IDS.projects.won, QA_USERS.director.id, JSON.stringify(['director'])],
  );
}

export async function resetUxRegressionSeed(db: Database) {
  await db.exec('BEGIN');
  try {
    await clearQaTables(db);
    await insertQaUsers(db);
    await insertQaAccounts(db);
    await insertQaProjectsAndQuotes(db);
    await insertQaExecutionData(db);
    await insertQaTasksApprovalsDocuments(db);
    await insertQaAdminArtifacts(db);
    await db.exec('COMMIT');
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }
  return buildUxSeedContract();
}
