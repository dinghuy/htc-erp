// =============================================================================
// seed-test-projects.ts
// Test data seed script for the CRM Projects & Tasks modules.
//
// HOW TO RUN (from the backend/ directory):
//   npx ts-node scripts/seed-test-projects.ts
//
// HOW TO START THE SERVER POINTING AT THE TEST DB (from backend/):
//   DB_PATH=./tmp/test-crm.db npx ts-node server.ts
//
// SAFETY GUARANTEE:
//   This script only opens  ../tmp/test-crm.db  (relative to the scripts/
//   folder).  It never touches crm.db.  All inserts use INSERT OR IGNORE so
//   the script is fully idempotent – you can run it multiple times without
//   creating duplicate rows.
//
// RESET / WIPE THE TEST DB:
//   Delete the file at  backend/tmp/test-crm.db  and re-run this script.
//   The script will create a fresh database from scratch.
// =============================================================================

import path from 'path';
import fs from 'fs';
import sqlite3Driver from 'sqlite3';
import { open, Database } from 'sqlite';

// ---------------------------------------------------------------------------
// Resolve the test DB path.  The scripts/ folder sits one level below backend/
// so "../tmp/test-crm.db" always resolves to backend/tmp/test-crm.db.
// ---------------------------------------------------------------------------
const DB_PATH = path.resolve(__dirname, '..', 'tmp', 'test-crm.db');

async function openDb(): Promise<Database> {
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log(`Created directory: ${dbDir}`);
  }

  const db = await open({
    filename: DB_PATH,
    driver: sqlite3Driver.Database,
  });

  await db.run('PRAGMA foreign_keys = ON');
  await db.run('PRAGMA journal_mode = WAL');
  return db;
}

// ---------------------------------------------------------------------------
// Schema: create tables that are required for Projects & Tasks seed data.
// Copied verbatim from sqlite-db.ts so this script is self-contained.
// ---------------------------------------------------------------------------
async function ensureTables(db: Database): Promise<void> {
  // User table (required for managerId / assigneeId foreign keys)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS User (
      id            TEXT PRIMARY KEY,
      fullName      TEXT,
      gender        TEXT,
      email         TEXT,
      phone         TEXT,
      role          TEXT,
      department    TEXT,
      status        TEXT DEFAULT 'Active',
      createdAt     DATETIME DEFAULT CURRENT_TIMESTAMP,
      username      TEXT,
      passwordHash  TEXT,
      systemRole    TEXT DEFAULT 'viewer',
      employeeCode  TEXT,
      dateOfBirth   TEXT,
      avatar        TEXT,
      address       TEXT,
      startDate     TEXT,
      lastLoginAt   TEXT,
      accountStatus TEXT DEFAULT 'active',
      mustChangePassword INTEGER DEFAULT 1
    )
  `);

  // Project table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS Project (
      id          TEXT PRIMARY KEY,
      code        TEXT,
      name        TEXT NOT NULL,
      description TEXT,
      managerId   TEXT,
      accountId   TEXT,
      startDate   TEXT,
      endDate     TEXT,
      status      TEXT DEFAULT 'pending',
      createdAt   TEXT DEFAULT (datetime('now')),
      updatedAt   TEXT DEFAULT (datetime('now'))
    )
  `);

  // Task table (includes the extended columns added via ensureColumn in sqlite-db.ts)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS Task (
      id            TEXT PRIMARY KEY,
      projectId     TEXT,
      name          TEXT NOT NULL,
      description   TEXT,
      assigneeId    TEXT,
      status        TEXT DEFAULT 'pending',
      priority      TEXT DEFAULT 'medium',
      startDate     TEXT,
      dueDate       TEXT,
      completionPct INTEGER DEFAULT 0,
      notes         TEXT,
      accountId     TEXT,
      leadId        TEXT,
      target        TEXT,
      resultLinks   TEXT,
      output        TEXT,
      reportDate    TEXT,
      createdAt     TEXT DEFAULT (datetime('now')),
      updatedAt     TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (projectId) REFERENCES Project(id)
    )
  `);

  // Indexes (CREATE INDEX IF NOT EXISTS is always safe to repeat)
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_project_status  ON Project (status);
    CREATE INDEX IF NOT EXISTS idx_task_project    ON Task    (projectId);
    CREATE INDEX IF NOT EXISTS idx_task_assignee   ON Task    (assigneeId);
    CREATE INDEX IF NOT EXISTS idx_task_status     ON Task    (status);
  `);

  console.log('Tables verified / created.');
}

// ---------------------------------------------------------------------------
// Seed: Test Users
// Five realistic HTG employees that are referenced by project managers and
// task assignees below.  Passwords are intentionally left NULL – these
// accounts are for UI testing only and are not meant to log in via auth flow.
// ---------------------------------------------------------------------------
async function seedUsers(db: Database): Promise<void> {
  const users = [
    {
      id:            'user-001',
      fullName:      'Nguyễn Văn Hùng',
      role:          'Sales Manager',
      department:    'Sales & Marketing',
      systemRole:    'manager',
      username:      'hung.nv',
      status:        'Active',
      accountStatus: 'active',
    },
    {
      id:            'user-002',
      fullName:      'Trần Thị Mai',
      role:          'Sales Executive',
      department:    'Sales & Marketing',
      systemRole:    'sales',
      username:      'mai.tt',
      status:        'Active',
      accountStatus: 'active',
    },
    {
      id:            'user-003',
      fullName:      'Lê Minh Tuấn',
      role:          'Kỹ sư Kỹ thuật',
      department:    'Kỹ thuật',
      systemRole:    'sales',
      username:      'tuan.lm',
      status:        'Active',
      accountStatus: 'active',
    },
    {
      id:            'user-004',
      fullName:      'Phạm Thị Hoa',
      role:          'Kế toán',
      department:    'Kế toán & Tài chính',
      systemRole:    'viewer',
      username:      'hoa.pt',
      status:        'Active',
      accountStatus: 'active',
    },
    {
      id:            'user-005',
      fullName:      'Hoàng Đức Nam',
      role:          'Trưởng phòng Mua hàng',
      department:    'Mua hàng',
      systemRole:    'manager',
      username:      'nam.hd',
      status:        'Active',
      accountStatus: 'active',
    },
  ];

  const stmt = await db.prepare(`
    INSERT OR IGNORE INTO User
      (id, fullName, role, department, systemRole, username, status, accountStatus)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const u of users) {
    await stmt.run(
      u.id, u.fullName, u.role, u.department,
      u.systemRole, u.username, u.status, u.accountStatus
    );
  }
  await stmt.finalize();
}

// ---------------------------------------------------------------------------
// Seed: Projects
// Five real-world HTG enterprise projects covering truck supply, port
// maintenance, spare parts import, internal IT rollout, and a pending tender.
// ---------------------------------------------------------------------------
async function seedProjects(db: Database): Promise<number> {
  const projects = [
    {
      id:          'P-001',
      code:        'PRJ-2026-001',
      name:        'Cung cấp xe đầu kéo Shacman cho Cảng Đà Nẵng',
      description: 'Dự án cung cấp 5 xe đầu kéo Shacman X3000 cho Cảng Đà Nẵng theo hợp đồng số HTG-2026-001',
      managerId:   'user-001',
      status:      'active',
      startDate:   '2026-01-15',
      endDate:     '2026-06-30',
    },
    {
      id:          'P-002',
      code:        'PRJ-2025-012',
      name:        'Bảo trì thiết bị cảng Tân Cảng Sài Gòn Q4/2025',
      description: null,
      managerId:   'user-003',
      status:      'completed',
      startDate:   '2025-10-01',
      endDate:     '2025-12-31',
    },
    {
      id:          'P-003',
      code:        'PRJ-2026-002',
      name:        'Nhập khẩu phụ tùng Komatsu lô Q1/2026',
      description: null,
      managerId:   'user-005',
      status:      'active',
      startDate:   '2026-02-01',
      endDate:     '2026-04-30',
    },
    {
      id:          'P-004',
      code:        'PRJ-2026-003',
      name:        'Triển khai hệ thống CRM nội bộ HTG',
      description: 'Xây dựng và triển khai hệ thống CRM cho toàn bộ nhân viên HTG Group',
      managerId:   'user-001',
      status:      'active',
      startDate:   '2026-01-01',
      endDate:     '2026-12-31',
    },
    {
      id:          'P-005',
      code:        'PRJ-2026-004',
      name:        'Báo giá xe Volvo FH cho Cảng Nam Hải',
      description: null,
      managerId:   'user-002',
      status:      'pending',
      startDate:   '2026-04-01',
      endDate:     '2026-09-30',
    },
  ];

  const stmt = await db.prepare(`
    INSERT OR IGNORE INTO Project
      (id, code, name, description, managerId, status, startDate, endDate)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let inserted = 0;
  for (const p of projects) {
    const result = await stmt.run(
      p.id, p.code, p.name, p.description,
      p.managerId, p.status, p.startDate, p.endDate
    );
    if (result.changes && result.changes > 0) inserted++;
  }
  await stmt.finalize();
  return inserted;
}

// ---------------------------------------------------------------------------
// Seed: Tasks
// 15 tasks, 3 per project, covering a realistic mix of statuses, priorities,
// and completion percentages to exercise the full UI state space.
// ---------------------------------------------------------------------------
async function seedTasks(db: Database): Promise<number> {
  type TaskRow = {
    id:            string;
    projectId:     string;
    name:          string;
    assigneeId:    string;
    status:        string;
    priority:      string;
    completionPct: number;
    dueDate:       string | null;
    target:        string | null;
    output:        string | null;
    resultLinks:   string | null;
    reportDate:    string | null;
  };

  const tasks: TaskRow[] = [
    // --- PRJ-2026-001: Cung cấp xe đầu kéo Shacman ---
    {
      id:            'T-001',
      projectId:     'P-001',
      name:          'Soạn thảo hợp đồng cung cấp xe Shacman',
      assigneeId:    'user-001',
      status:        'completed',
      priority:      'high',
      completionPct: 100,
      dueDate:       '2026-02-15',
      target:        'Hợp đồng được ký kết đúng hạn',
      output:        'Hợp đồng số HTG-2026-001 đã ký ngày 10/02/2026',
      resultLinks:   null,
      reportDate:    '2026-02-10',
    },
    {
      id:            'T-002',
      projectId:     'P-001',
      name:          'Đặt hàng và theo dõi lô xe tại nhà máy',
      assigneeId:    'user-005',
      status:        'active',
      priority:      'high',
      completionPct: 60,
      dueDate:       '2026-04-30',
      target:        'Xác nhận đơn hàng từ nhà máy Shacman trong 30 ngày',
      output:        null,
      resultLinks:   null,
      reportDate:    null,
    },
    {
      id:            'T-003',
      projectId:     'P-001',
      name:          'Chuẩn bị thủ tục nhập khẩu và thông quan',
      assigneeId:    'user-004',
      status:        'pending',
      priority:      'medium',
      completionPct: 0,
      dueDate:       '2026-05-30',
      target:        null,
      output:        null,
      resultLinks:   null,
      reportDate:    null,
    },

    // --- PRJ-2025-012: Bảo trì thiết bị cảng Tân Cảng Sài Gòn Q4/2025 ---
    {
      id:            'T-004',
      projectId:     'P-002',
      name:          'Kiểm tra tình trạng thiết bị cẩu Q4',
      assigneeId:    'user-003',
      status:        'completed',
      priority:      'high',
      completionPct: 100,
      dueDate:       null,
      target:        null,
      output:        null,
      resultLinks:   null,
      reportDate:    '2025-10-20',
    },
    {
      id:            'T-005',
      projectId:     'P-002',
      name:          'Thực hiện bảo trì định kỳ 10 cần cẩu',
      assigneeId:    'user-003',
      status:        'completed',
      priority:      'high',
      completionPct: 100,
      dueDate:       null,
      target:        null,
      output:        null,
      resultLinks:   'https://drive.google.com/maintenance-report-q4',
      reportDate:    '2025-11-30',
    },
    {
      id:            'T-006',
      projectId:     'P-002',
      name:          'Lập báo cáo nghiệm thu bảo trì',
      assigneeId:    'user-001',
      status:        'completed',
      priority:      'medium',
      completionPct: 100,
      dueDate:       null,
      target:        null,
      output:        null,
      resultLinks:   null,
      reportDate:    '2025-12-20',
    },

    // --- PRJ-2026-002: Nhập khẩu phụ tùng Komatsu lô Q1/2026 ---
    {
      id:            'T-007',
      projectId:     'P-003',
      name:          'Liên hệ nhà cung cấp phụ tùng Komatsu Nhật',
      assigneeId:    'user-005',
      status:        'completed',
      priority:      'urgent',
      completionPct: 100,
      dueDate:       '2026-02-10',
      target:        null,
      output:        null,
      resultLinks:   null,
      reportDate:    null,
    },
    {
      id:            'T-008',
      projectId:     'P-003',
      name:          'Đàm phán giá và điều khoản thanh toán',
      assigneeId:    'user-005',
      status:        'active',
      priority:      'high',
      completionPct: 70,
      dueDate:       '2026-03-15',
      target:        null,
      output:        null,
      resultLinks:   null,
      reportDate:    null,
    },
    {
      id:            'T-009',
      projectId:     'P-003',
      name:          'Hoàn tất bộ chứng từ L/C',
      assigneeId:    'user-004',
      status:        'pending',
      priority:      'high',
      completionPct: 0,
      dueDate:       '2026-04-01',
      target:        null,
      output:        null,
      resultLinks:   null,
      reportDate:    null,
    },

    // --- PRJ-2026-003: Triển khai hệ thống CRM nội bộ HTG ---
    {
      id:            'T-010',
      projectId:     'P-004',
      name:          'Thiết kế giao diện Dashboard CRM',
      assigneeId:    'user-002',
      status:        'completed',
      priority:      'high',
      completionPct: 100,
      dueDate:       null,
      target:        null,
      output:        null,
      resultLinks:   null,
      reportDate:    '2026-01-31',
    },
    {
      id:            'T-011',
      projectId:     'P-004',
      name:          'Phát triển module quản lý Leads & Accounts',
      assigneeId:    'user-003',
      status:        'completed',
      priority:      'high',
      completionPct: 100,
      dueDate:       null,
      target:        null,
      output:        null,
      resultLinks:   null,
      reportDate:    '2026-02-28',
    },
    {
      id:            'T-012',
      projectId:     'P-004',
      name:          'Triển khai phân quyền và đăng nhập',
      assigneeId:    'user-001',
      status:        'active',
      priority:      'urgent',
      completionPct: 85,
      dueDate:       '2026-03-31',
      target:        'Hệ thống phân quyền 4 roles hoạt động ổn định',
      output:        null,
      resultLinks:   null,
      reportDate:    null,
    },

    // --- PRJ-2026-004: Báo giá xe Volvo FH cho Cảng Nam Hải ---
    {
      id:            'T-013',
      projectId:     'P-005',
      name:          'Khảo sát nhu cầu và thông số kỹ thuật',
      assigneeId:    'user-002',
      status:        'active',
      priority:      'medium',
      completionPct: 40,
      dueDate:       '2026-04-15',
      target:        null,
      output:        null,
      resultLinks:   null,
      reportDate:    null,
    },
    {
      id:            'T-014',
      projectId:     'P-005',
      name:          'Liên hệ Volvo Sweden xin báo giá chính thức',
      assigneeId:    'user-005',
      status:        'pending',
      priority:      'medium',
      completionPct: 0,
      dueDate:       '2026-05-01',
      target:        null,
      output:        null,
      resultLinks:   null,
      reportDate:    null,
    },
    {
      id:            'T-015',
      projectId:     'P-005',
      name:          'Soạn báo giá cho Cảng Nam Hải',
      assigneeId:    'user-002',
      status:        'pending',
      priority:      'low',
      completionPct: 0,
      dueDate:       '2026-06-01',
      target:        null,
      output:        null,
      resultLinks:   null,
      reportDate:    null,
    },
  ];

  const stmt = await db.prepare(`
    INSERT OR IGNORE INTO Task
      (id, projectId, name, assigneeId, status, priority, completionPct,
       dueDate, target, output, resultLinks, reportDate)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let inserted = 0;
  for (const t of tasks) {
    const result = await stmt.run(
      t.id, t.projectId, t.name, t.assigneeId,
      t.status, t.priority, t.completionPct,
      t.dueDate, t.target, t.output, t.resultLinks, t.reportDate
    );
    if (result.changes && result.changes > 0) inserted++;
  }
  await stmt.finalize();
  return inserted;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('HTG CRM – Test DB seed: Projects & Tasks');
  console.log('='.repeat(60));
  console.log(`Target DB : ${DB_PATH}`);
  console.log();

  const db = await openDb();

  try {
    await ensureTables(db);
    await seedUsers(db);

    const projectsInserted = await seedProjects(db);
    const tasksInserted    = await seedTasks(db);

    // Query final counts from the DB so the summary reflects pre-existing rows
    const projectTotal = await db.get<{ c: number }>('SELECT COUNT(*) as c FROM Project');
    const taskTotal    = await db.get<{ c: number }>('SELECT COUNT(*) as c FROM Task');
    const userTotal    = await db.get<{ c: number }>('SELECT COUNT(*) as c FROM User');

    console.log();
    console.log('-'.repeat(60));
    console.log('Seed summary');
    console.log('-'.repeat(60));
    console.log(`Users    in DB : ${userTotal?.c  ?? 0}`);
    console.log(`Projects in DB : ${projectTotal?.c ?? 0}  (${projectsInserted} inserted this run)`);
    console.log(`Tasks    in DB : ${taskTotal?.c   ?? 0}  (${tasksInserted} inserted this run)`);
    console.log('-'.repeat(60));
    console.log('Done. Run the server with:');
    console.log('  DB_PATH=./tmp/test-crm.db npx ts-node server.ts');
    console.log('='.repeat(60));
  } finally {
    await db.close();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
