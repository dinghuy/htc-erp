/**
 * WorkManagement (legacy) -> CRM import script
 *
 * Preferred input format (JSON):
 * {
 *   "projects": [{ "code": "...", "name": "...", "description": "...", "managerName": "...", "accountName": "...", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "status": "pending|active|completed|paused|cancelled" }],
 *   "tasks": [{ "name": "...", "description": "...", "projectCode": "...", "assigneeName": "...", "status": "...", "priority": "...", "startDate": "...", "dueDate": "...", "completionPct": 0, "notes": "...", "target": "...", "resultLinks": "...", "output": "...", "reportDate": "...", "accountName": "...", "leadCompanyName": "...", "quotationNumber": "QT-2026-001" }]
 * }
 *
 * Run (PowerShell):
 *  - Dry-run:   .\\node_modules\\.bin\\ts-node.cmd .\\scripts\\import-workmanagement.ts --file C:\\path\\export.json --dry-run
 *  - Import:    .\\node_modules\\.bin\\ts-node.cmd .\\scripts\\import-workmanagement.ts --file C:\\path\\export.json
 *
 * Notes:
 *  - Projects are idempotent by: code (preferred) OR name+startDate (fallback).
 *  - Tasks are idempotent by: name + project + dueDate, tracked via a stable marker appended to notes.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { v4 as uuidv4 } from 'uuid';
import { initDb, getDb } from '../sqlite-db';

type EntityMode = 'auto' | 'project' | 'task';

type NormalizedRow = Record<string, unknown>;

type Summary = {
  dryRun: boolean;
  projectsInserted: number;
  projectsSkipped: number;
  tasksInserted: number;
  tasksSkipped: number;
  unmappedUsers: Set<string>;
  errors: string[];
};

type ImportOptions = {
  dryRun: boolean;
};

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '');
}

function normalizeRecord(record: Record<string, unknown>): NormalizedRow {
  const out: NormalizedRow = {};
  for (const [key, value] of Object.entries(record || {})) {
    out[normalizeKey(key)] = value;
  }
  return out;
}

function getField(row: NormalizedRow, candidates: string[]): string {
  for (const candidate of candidates) {
    const value = row[normalizeKey(candidate)];
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '';
}

function parseIsoDate(raw: unknown): string | null {
  const text = String(raw ?? '').trim();
  if (!text) return null;

  const vnMatch = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})(?:\b|$)/);
  if (vnMatch) {
    const [, dd, mm, yyyy] = vnMatch;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }

  const isoMatch = text.match(/^(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})(?:\b|$)/);
  if (isoMatch) {
    const [, yyyy, mm, dd] = isoMatch;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function parseNumber(raw: unknown, fallback = 0): number {
  if (raw === null || raw === undefined) return fallback;
  const text = String(raw).trim().replace(/%$/, '').replace(/,/g, '');
  if (!text) return fallback;
  const value = Number(text);
  return Number.isFinite(value) ? value : fallback;
}

function mapStatus(raw: unknown, kind: 'project' | 'task'): string {
  const text = normalizeKey(String(raw ?? ''));
  if (!text) return kind === 'project' ? 'pending' : 'pending';

  const map: Record<string, string> = {
    pending: 'pending',
    new: 'pending',
    todo: 'pending',
    chuanbi: 'pending',
    dangchuanbi: 'pending',
    active: 'active',
    inprogress: 'active',
    doing: 'active',
    danglam: 'active',
    working: 'active',
    completed: 'completed',
    done: 'completed',
    hoanthanh: 'completed',
    closed: 'completed',
    paused: 'paused',
    hold: 'paused',
    tamdung: 'paused',
    cancelled: 'cancelled',
    canceled: 'cancelled',
    huy: 'cancelled',
  };

  return map[text] || (kind === 'project' ? 'pending' : 'pending');
}

function mapPriority(raw: unknown): string {
  const text = normalizeKey(String(raw ?? ''));
  if (!text) return 'medium';
  if (['high', 'urgent', 'cao', 'critical'].includes(text)) return 'high';
  if (['low', 'thap', 'normal'].includes(text)) return 'low';
  return 'medium';
}

async function findUserIdByName(db: any, rawName: unknown, summary: Summary): Promise<string | null> {
  const name = String(rawName ?? '').trim();
  if (!name) return null;

  const row = await db.get(
    `SELECT id, fullName, username, email
     FROM User
     WHERE LOWER(TRIM(fullName)) = LOWER(TRIM(?))
        OR LOWER(TRIM(username)) = LOWER(TRIM(?))
        OR LOWER(TRIM(email)) = LOWER(TRIM(?))
     ORDER BY CASE
       WHEN LOWER(TRIM(fullName)) = LOWER(TRIM(?)) THEN 0
       WHEN LOWER(TRIM(username)) = LOWER(TRIM(?)) THEN 1
       WHEN LOWER(TRIM(email)) = LOWER(TRIM(?)) THEN 2
       ELSE 3
     END
     LIMIT 1`,
    [name, name, name, name, name, name]
  );

  if (!row?.id) {
    summary.unmappedUsers.add(name);
    return null;
  }

  return row.id as string;
}

async function findAccountId(db: any, rawName: unknown): Promise<string | null> {
  const value = String(rawName ?? '').trim();
  if (!value) return null;
  const row = await db.get(
    `SELECT id
     FROM Account
     WHERE LOWER(TRIM(id)) = LOWER(TRIM(?))
        OR LOWER(TRIM(companyName)) = LOWER(TRIM(?))
        OR LOWER(TRIM(code)) = LOWER(TRIM(?))
        OR LOWER(TRIM(shortName)) = LOWER(TRIM(?))
     LIMIT 1`,
    [value, value, value, value]
  );
  return row?.id || null;
}

async function findLeadId(db: any, rawName: unknown): Promise<string | null> {
  const value = String(rawName ?? '').trim();
  if (!value) return null;
  const row = await db.get(
    `SELECT id
     FROM Lead
     WHERE LOWER(TRIM(id)) = LOWER(TRIM(?))
        OR LOWER(TRIM(companyName)) = LOWER(TRIM(?))
        OR LOWER(TRIM(contactName)) = LOWER(TRIM(?))
     LIMIT 1`,
    [value, value, value]
  );
  return row?.id || null;
}

async function findProjectId(db: any, rawValue: unknown): Promise<string | null> {
  const value = String(rawValue ?? '').trim();
  if (!value) return null;
  const row = await db.get(
    `SELECT id
     FROM Project
     WHERE LOWER(TRIM(id)) = LOWER(TRIM(?))
        OR LOWER(TRIM(code)) = LOWER(TRIM(?))
        OR LOWER(TRIM(name)) = LOWER(TRIM(?))
     LIMIT 1`,
    [value, value, value]
  );
  return row?.id || null;
}

async function findQuotationId(db: any, rawValue: unknown): Promise<string | null> {
  const value = String(rawValue ?? '').trim();
  if (!value) return null;
  const row = await db.get(
    `SELECT id
     FROM Quotation
     WHERE LOWER(TRIM(id)) = LOWER(TRIM(?))
        OR LOWER(TRIM(quoteNumber)) = LOWER(TRIM(?))
     LIMIT 1`,
    [value, value]
  );
  return row?.id || null;
}

function buildSourceMarker(kind: 'project' | 'task', sourceId: string, sourceCode?: string | null) {
  const codePart = sourceCode ? `code=${sourceCode}` : `id=${sourceId}`;
  return `[WM:${kind}:${codePart}]`;
}

function stableTaskFingerprint(input: {
  name: string;
  projectKey: string;
  dueDate: string | null;
  quotationKey?: string;
  accountKey?: string;
  leadKey?: string;
}): string {
  const raw = [
    normalizeKey(input.name),
    normalizeKey(input.projectKey),
    input.dueDate || '',
    normalizeKey(input.quotationKey || ''),
    normalizeKey(input.accountKey || ''),
    normalizeKey(input.leadKey || ''),
  ].join('|');
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 20);
}

async function importProjectRow(db: any, row: Record<string, unknown>, summary: Summary, opts: ImportOptions) {
  const normalized = normalizeRecord(row);
  const sourceId = getField(normalized, ['id', 'ma', 'maproject', 'projectid', 'ma_du_an', 'maduan']);
  const sourceCode = getField(normalized, ['code', 'projectcode', 'projectCode', 'ma', 'maduan', 'maproject']);
  const name = getField(normalized, ['name', 'ten', 'tenduan', 'projectname', 'duan']);

  if (!name && !sourceId && !sourceCode) {
    summary.projectsSkipped += 1;
    return;
  }

  const startDate = parseIsoDate(getField(normalized, ['startdate', 'startDate', 'ngaybatdau', 'ngaybd']));
  const existing = await db.get(
    `SELECT id FROM Project
     WHERE (? <> '' AND id = ?)
        OR (? <> '' AND LOWER(TRIM(code)) = LOWER(TRIM(?)))
        OR (? = '' AND ? <> '' AND LOWER(TRIM(name)) = LOWER(TRIM(?)) AND IFNULL(startDate,'') = IFNULL(?,''))`,
    [
      sourceId,
      sourceId || '',
      sourceCode,
      sourceCode || '',
      sourceCode || '',
      name,
      name || '',
      startDate,
    ]
  );
  if (existing) {
    summary.projectsSkipped += 1;
    return;
  }

  const managerId = await findUserIdByName(
    db,
    getField(normalized, ['manager', 'managername', 'managerName', 'quanly', 'nguoiquanly']),
    summary
  );
  const accountId = await findAccountId(db, getField(normalized, ['account', 'accountname', 'accountName', 'khachhang', 'customer', 'congty']));
  const status = mapStatus(getField(normalized, ['status', 'trangthai']), 'project');

  if (!opts.dryRun) {
    await db.run(
      `INSERT INTO Project (id, code, name, description, managerId, accountId, startDate, endDate, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sourceId || uuidv4(),
        sourceCode || null,
        name || sourceCode || sourceId || 'Imported Project',
        getField(normalized, ['description', 'mota', 'ghichu']) || null,
        managerId,
        accountId,
        startDate,
        parseIsoDate(getField(normalized, ['enddate', 'endDate', 'ngayketthuc', 'ngaykt'])),
        status,
      ]
    );
  }

  summary.projectsInserted += 1;
}

async function importTaskRow(db: any, row: Record<string, unknown>, summary: Summary, opts: ImportOptions) {
  const normalized = normalizeRecord(row);
  const sourceId = getField(normalized, ['id', 'ma', 'taskid', 'ma_cong_viec', 'macongviec']);
  const sourceCode = getField(normalized, ['code', 'maviec', 'mact', 'taskcode', 'ma_cong_viec']);
  const name = getField(normalized, ['name', 'ten', 'tencongviec', 'taskname', 'congviec']);

  if (!name && !sourceId && !sourceCode) {
    summary.tasksSkipped += 1;
    return;
  }

  const projectLookup = getField(normalized, ['projectid', 'projectcode', 'projectCode', 'project', 'duan', 'tenduan', 'maduan']);
  const projectId = await findProjectId(db, projectLookup);
  const assigneeId = await findUserIdByName(
    db,
    getField(normalized, ['assignee', 'assigneename', 'assigneeName', 'nguoiphutrach', 'nguoi_phu_trach', 'owner', 'responsible']),
    summary
  );
  const accountId = await findAccountId(db, getField(normalized, ['account', 'accountname', 'accountName', 'khachhang', 'customer', 'congty']));
  const leadId = await findLeadId(db, getField(normalized, ['lead', 'leadcompanyname', 'leadCompanyName', 'dautu', 'leadname', 'tenlead']));
  const quotationLookup = getField(normalized, ['quotationid', 'quotationnumber', 'quotationNumber', 'quotation', 'baogia', 'quoteid']);
  const quotationId = await findQuotationId(db, quotationLookup);
  const status = mapStatus(getField(normalized, ['status', 'trangthai']), 'task');
  const priority = mapPriority(getField(normalized, ['priority', 'uutien', 'doquantrong']));
  const dueDate = parseIsoDate(getField(normalized, ['duedate', 'dueDate', 'handeadline', 'ngayhethan', 'han']));
  const fp = stableTaskFingerprint({
    name: name || sourceCode || sourceId || 'Imported Task',
    projectKey: projectId || projectLookup || '',
    dueDate,
    quotationKey: quotationLookup || '',
    accountKey: getField(normalized, ['account', 'accountname', 'accountName', 'khachhang', 'customer', 'congty']),
    leadKey: getField(normalized, ['lead', 'leadcompanyname', 'leadCompanyName', 'dautu', 'leadname', 'tenlead']),
  });
  const marker = `[WM:task:fp=${fp}]`;
  const legacyMarker = buildSourceMarker('task', sourceId || sourceCode || uuidv4(), sourceCode || null);

  const existing = await db.get(
    `SELECT id FROM Task
     WHERE (? <> '' AND id = ?)
        OR notes LIKE ?
        OR notes LIKE ?
        OR (
          LOWER(TRIM(name)) = LOWER(TRIM(?))
          AND IFNULL(projectId,'') = IFNULL(?, '')
          AND IFNULL(dueDate,'') = IFNULL(?, '')
          AND (notes LIKE '%[WM:task:%')
        )`,
    [
      sourceId,
      sourceId || '',
      `%${marker}%`,
      `%${legacyMarker}%`,
      name || sourceCode || sourceId || 'Imported Task',
      projectId,
      dueDate,
    ]
  );
  if (existing) {
    summary.tasksSkipped += 1;
    return;
  }

  const taskId = sourceId || uuidv4();
  const notes = [getField(normalized, ['notes', 'ghichu']), marker].filter(Boolean).join('\n');
  const completionPct = parseNumber(getField(normalized, ['completionpct', 'tiendo', 'progress']), 0);

  if (!opts.dryRun) {
    await db.run(
      `INSERT INTO Task (
        id, projectId, name, description, assigneeId, status, priority, startDate, dueDate, completionPct,
        notes, accountId, leadId, quotationId, target, resultLinks, output, reportDate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        taskId,
        projectId,
        name || sourceCode || sourceId || 'Imported Task',
        getField(normalized, ['description', 'mota', 'ghichu']) || null,
        assigneeId,
        status,
        priority,
        parseIsoDate(getField(normalized, ['startdate', 'startDate', 'ngaybatdau', 'ngaybd'])),
        dueDate,
        completionPct,
        notes || null,
        accountId,
        leadId,
        quotationId || null,
        getField(normalized, ['target', 'muctieu']) || null,
        getField(normalized, ['resultlinks', 'ketqua', 'linkketqua']) || null,
        getField(normalized, ['output', 'ketqua', 'dautra']) || null,
        parseIsoDate(getField(normalized, ['reportdate', 'reportDate', 'ngaybaocao'])) || null,
      ]
    );
  }

  summary.tasksInserted += 1;
}

function detectModeFromHeaders(headers: string[]): EntityMode {
  const normalizedHeaders = headers.map(normalizeKey);
  const taskSignals = ['congviec', 'task', 'assignee', 'nguoiphutrach', 'tiendo', 'muctieu', 'resultlinks', 'output'];
  const projectSignals = ['duan', 'project', 'manager', 'quanly', 'startdate', 'enddate'];
  const taskScore = normalizedHeaders.reduce((score, header) => score + (taskSignals.some(signal => header.includes(signal)) ? 1 : 0), 0);
  const projectScore = normalizedHeaders.reduce((score, header) => score + (projectSignals.some(signal => header.includes(signal)) ? 1 : 0), 0);
  if (taskScore > projectScore) return 'task';
  if (projectScore > taskScore) return 'project';
  return 'auto';
}

async function main() {
  const args = process.argv.slice(2);
  const fileIndex = args.findIndex(arg => arg === '--file' || arg === '-f');
  const entityIndex = args.findIndex(arg => arg === '--entity' || arg === '-e');
  const dryRun = args.includes('--dry-run') || args.includes('--dryrun');
  const filePath = fileIndex >= 0 ? args[fileIndex + 1] : args[0];
  const entityMode = ((entityIndex >= 0 ? args[entityIndex + 1] : undefined) || 'auto').toLowerCase() as EntityMode;

  if (!filePath) {
    console.error('Usage: ts-node scripts/import-workmanagement.ts --file <path> [--dry-run] [--entity project|task|auto]');
    process.exit(1);
  }

  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`File not found: ${resolvedPath}`);
    process.exit(1);
  }

  await initDb();
  const db = getDb();
  const summary: Summary = {
    dryRun,
    projectsInserted: 0,
    projectsSkipped: 0,
    tasksInserted: 0,
    tasksSkipped: 0,
    unmappedUsers: new Set<string>(),
    errors: [],
  };
  const opts: ImportOptions = { dryRun };

  const ext = path.extname(resolvedPath).toLowerCase();
  const rawText = fs.readFileSync(resolvedPath, 'utf8');

  try {
    if (ext === '.json') {
      const parsed = JSON.parse(rawText);
      if (Array.isArray(parsed)) {
        const firstRow = parsed.find((row: any) => row && typeof row === 'object') || {};
        const mode = entityMode === 'auto'
          ? (detectModeFromHeaders(Object.keys(firstRow)) === 'task' ? 'task' : 'project')
          : entityMode;

        for (const row of parsed) {
          if (!row || typeof row !== 'object') continue;
          try {
            if (mode === 'task') {
              await importTaskRow(db, row as Record<string, unknown>, summary, opts);
            } else {
              await importProjectRow(db, row as Record<string, unknown>, summary, opts);
            }
          } catch (err: any) {
            summary.errors.push(err?.message || String(err));
          }
        }
      } else if (parsed && typeof parsed === 'object') {
        const payload = parsed as Record<string, unknown>;
        const projects = Array.isArray(payload.projects) ? payload.projects : [];
        const tasks = Array.isArray(payload.tasks) ? payload.tasks : [];
        const rows = Array.isArray(payload.data) ? payload.data : [];

        for (const row of projects) {
          if (row && typeof row === 'object') {
            try {
              await importProjectRow(db, row as Record<string, unknown>, summary, opts);
            } catch (err: any) {
              summary.errors.push(err?.message || String(err));
            }
          }
        }
        for (const row of rows) {
          if (row && typeof row === 'object') {
            const headers = Object.keys(row as Record<string, unknown>);
            const mode = entityMode === 'auto'
              ? (detectModeFromHeaders(headers) === 'task' ? 'task' : 'project')
              : entityMode;
            try {
              if (mode === 'task') await importTaskRow(db, row as Record<string, unknown>, summary, opts);
              else await importProjectRow(db, row as Record<string, unknown>, summary, opts);
            } catch (err: any) {
              summary.errors.push(err?.message || String(err));
            }
          }
        }
        for (const row of tasks) {
          if (row && typeof row === 'object') {
            try {
              await importTaskRow(db, row as Record<string, unknown>, summary, opts);
            } catch (err: any) {
              summary.errors.push(err?.message || String(err));
            }
          }
        }
      } else {
        throw new Error('Unsupported JSON structure');
      }
    } else if (ext === '.csv') {
      const rows = parse(rawText, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as Record<string, unknown>[];
      const mode = entityMode === 'auto'
        ? detectModeFromHeaders(Object.keys(rows[0] || {}))
        : entityMode;

      for (const row of rows) {
        try {
          if (mode === 'task') {
            await importTaskRow(db, row, summary, opts);
          } else {
            await importProjectRow(db, row, summary, opts);
          }
        } catch (err: any) {
          summary.errors.push(err?.message || String(err));
        }
      }
    } else {
      throw new Error(`Unsupported file extension: ${ext}`);
    }
  } catch (err: any) {
    summary.errors.push(err?.message || String(err));
  }

  console.log('WorkManagement import summary');
  console.log(JSON.stringify({
    file: resolvedPath,
    dryRun: summary.dryRun,
    projectsInserted: summary.projectsInserted,
    projectsSkipped: summary.projectsSkipped,
    tasksInserted: summary.tasksInserted,
    tasksSkipped: summary.tasksSkipped,
    unmappedUsers: Array.from(summary.unmappedUsers).sort(),
    errors: summary.errors,
  }, null, 2));
}

main().catch(err => {
  console.error('[import-workmanagement] Fatal error:', err?.message || err);
  process.exit(1);
});
