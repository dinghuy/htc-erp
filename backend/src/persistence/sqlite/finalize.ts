import { type Database } from 'sqlite';
import { normalizeGender } from '../../../gender';

function isImageAssetCandidate(url: string, mimeType: string) {
  const normalizedMime = mimeType.trim().toLowerCase();
  if (normalizedMime.startsWith('image/')) return true;
  return /\.(avif|gif|jpe?g|png|svg|webp)$/i.test(url);
}

function isVideoAssetCandidate(url: string, mimeType: string) {
  const normalizedMime = mimeType.trim().toLowerCase();
  if (normalizedMime.startsWith('video/')) return true;
  return /\.(avi|mkv|mov|mp4|mpe?g|ogv|webm)$/i.test(url);
}

function normalizeProductAssetRecord(raw: any, kind: 'image' | 'video' | 'document', index: number) {
  const url = String(raw?.url ?? raw?.href ?? '').trim();
  if (!url) return null;

  const fileName = String(raw?.fileName ?? raw?.filename ?? '').trim() || url.split('/').pop() || '';
  const title = String(raw?.title ?? raw?.name ?? raw?.label ?? '').trim()
    || fileName
    || `${kind === 'image' ? 'Image' : kind === 'video' ? 'Video' : 'Document'} ${index + 1}`;

  return {
    id: String(raw?.id ?? `${kind}-${index + 1}`),
    title,
    url,
    ...(kind === 'image'
      ? { alt: String(raw?.alt ?? '').trim() || title }
      : {
          description: String(raw?.description ?? raw?.summary ?? '').trim() || undefined,
          durationSeconds: Number.isFinite(Number(raw?.durationSeconds)) ? Number(raw.durationSeconds) : undefined,
          width: Number.isFinite(Number(raw?.width)) ? Number(raw.width) : undefined,
          height: Number.isFinite(Number(raw?.height)) ? Number(raw.height) : undefined,
        }),
    sourceType: raw?.sourceType === 'upload' ? 'upload' : 'url',
    fileName: fileName || undefined,
    mimeType: String(raw?.mimeType ?? raw?.type ?? '').trim() || undefined,
    size: Number.isFinite(Number(raw?.size)) ? Number(raw.size) : undefined,
    createdAt: String(raw?.createdAt ?? raw?.uploadedAt ?? '').trim() || undefined,
  };
}

function splitLegacyMediaAssets(raw: unknown) {
  if (typeof raw !== 'string' || !raw.trim()) {
    return { productImages: [], productVideos: [], productDocuments: [] };
  }

  try {
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed) ? parsed : [];
    const productImages: Record<string, unknown>[] = [];
    const productVideos: Record<string, unknown>[] = [];
    const productDocuments: Record<string, unknown>[] = [];

    items.forEach((entry: any, index: number) => {
      const url = String(entry?.url ?? entry?.href ?? '').trim();
      if (!url) return;
      const mimeType = String(entry?.mimeType ?? entry?.type ?? '').trim();
      const kind = isImageAssetCandidate(url, mimeType)
        ? 'image'
        : isVideoAssetCandidate(url, mimeType)
          ? 'video'
          : 'document';
      const normalized = normalizeProductAssetRecord(entry, kind, index);
      if (!normalized) return;
      if (kind === 'image') {
        productImages.push(normalized);
      } else if (kind === 'video') {
        productVideos.push(normalized);
      } else {
        productDocuments.push(normalized);
      }
    });

    return { productImages, productVideos, productDocuments };
  } catch {
    return { productImages: [], productVideos: [], productDocuments: [] };
  }
}

type ForeignKeyDef = {
  from: string;
  toTable: string;
  toColumn: string;
  onDelete?: string;
};

export async function finalizeSqliteSchema(db: Database) {
  const tableExists = async (table: string) => {
    const row: any = await db.get(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
      [table]
    );
    return !!row?.name;
  };

  const columnExists = async (table: string, column: string) => {
    const cols: any[] = await db.all(`PRAGMA table_info('${table}')`);
    return cols.some((c: any) => c.name === column);
  };

  const ensureColumn = async (table: string, column: string, ddl: string) => {
    const cols: any[] = await db.all(`PRAGMA table_info('${table}')`);
    if (!cols.some((c: any) => c.name === column)) {
      await db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
    }
  };

  const canonicalizeGenderColumn = async (table: string, idColumn: string) => {
    if (!(await tableExists(table)) || !(await columnExists(table, 'gender'))) return;

    const rows: any[] = await db.all(`SELECT ${idColumn} as id, gender FROM ${table}`);
    for (const row of rows) {
      const next = normalizeGender(row.gender);
      if (row.gender !== next) {
        await db.run(`UPDATE ${table} SET gender = ? WHERE ${idColumn} = ?`, [next, row.id]);
      }
    }
  };

  const normalizeLegacyProductStructuredFields = async () => {
    if (!(await tableExists('Product'))) return;

    const rows: any[] = await db.all('SELECT id, specifications, media, qbuData, productImages, productVideos, productDocuments FROM Product');
    for (const row of rows) {
      const updates: string[] = [];
      const params: any[] = [];

      const normalizeObjectString = (raw: unknown, fallback: Record<string, unknown>) => {
        if (typeof raw !== 'string' || !raw.trim()) {
          return JSON.stringify(fallback);
        }
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return JSON.stringify(parsed);
          }
        } catch {
          return JSON.stringify({ text: String(raw).trim() });
        }
        return JSON.stringify({ text: String(raw).trim() });
      };

      const normalizeArrayString = (raw: unknown) => {
        if (typeof raw !== 'string' || !raw.trim()) {
          return JSON.stringify([]);
        }
        try {
          const parsed = JSON.parse(raw);
          return JSON.stringify(Array.isArray(parsed) ? parsed : []);
        } catch {
          return JSON.stringify([]);
        }
      };

      const nextSpecifications = normalizeObjectString(row.specifications, {});
      const nextMedia = normalizeArrayString(row.media);
      const nextQbuData = normalizeObjectString(row.qbuData, {});
      const { productImages: legacyImages, productVideos: legacyVideos, productDocuments: legacyDocuments } = splitLegacyMediaAssets(nextMedia);
      const nextProductImages = normalizeArrayString(
        row.productImages ?? (legacyImages.length ? JSON.stringify(legacyImages) : JSON.stringify([]))
      );
      const nextProductVideos = normalizeArrayString(
        row.productVideos ?? (legacyVideos.length ? JSON.stringify(legacyVideos) : JSON.stringify([]))
      );
      const nextProductDocuments = normalizeArrayString(
        row.productDocuments ?? (legacyDocuments.length ? JSON.stringify(legacyDocuments) : JSON.stringify([]))
      );

      if ((row.specifications ?? null) !== nextSpecifications) {
        updates.push('specifications = ?');
        params.push(nextSpecifications);
      }
      if ((row.media ?? null) !== nextMedia) {
        updates.push('media = ?');
        params.push(nextMedia);
      }
      if ((row.qbuData ?? null) !== nextQbuData) {
        updates.push('qbuData = ?');
        params.push(nextQbuData);
      }
      if ((row.productImages ?? null) !== nextProductImages) {
        updates.push('productImages = ?');
        params.push(nextProductImages);
      }
      if ((row.productVideos ?? null) !== nextProductVideos) {
        updates.push('productVideos = ?');
        params.push(nextProductVideos);
      }
      if ((row.productDocuments ?? null) !== nextProductDocuments) {
        updates.push('productDocuments = ?');
        params.push(nextProductDocuments);
      }

      if (updates.length) {
        params.push(row.id);
        await db.run(`UPDATE Product SET ${updates.join(', ')} WHERE id = ?`, params);
      }
    }
  };

  const migrateLegacySupplierTable = async () => {
    if (!(await tableExists('Supplier'))) return;

    const cols: any[] = await db.all(`PRAGMA table_info('Supplier')`);
    const has = (name: string) => cols.some((c: any) => c.name === name);

    const count: any = await db.get('SELECT COUNT(*) as c FROM Supplier');
    if (count?.c > 0) {
      const companyExpr = has('company') ? 'company' : 'NULL';
      const codeExpr = has('code') ? 'code' : 'NULL';
      const descExpr = has('description') ? 'description' : 'NULL';
      const tagExpr = has('tag') ? 'tag' : 'NULL';
      const countryExpr = has('country') ? 'country' : 'NULL';
      const statusExpr = has('status') ? 'status' : 'NULL';

      await db.exec(`
        INSERT INTO Account (id, companyName, code, description, tag, country, status, accountType)
        SELECT id, ${companyExpr}, ${codeExpr}, ${descExpr}, ${tagExpr}, ${countryExpr}, ${statusExpr}, 'Supplier'
        FROM Supplier
        WHERE id IS NOT NULL
        ON CONFLICT(id) DO NOTHING
      `);
    }

    await db.exec('DROP TABLE IF EXISTS Supplier');
    console.log('[DB] Legacy Supplier table migrated into Account and dropped.');
  };

  const ensureUniqueIndexIfNoDuplicates = async (table: string, column: string, indexName: string) => {
    const dupes: any[] = await db.all(
      `SELECT ${column} as value, COUNT(*) as c
       FROM ${table}
       WHERE ${column} IS NOT NULL AND TRIM(${column}) <> ''
       GROUP BY ${column}
       HAVING c > 1`
    );
    if (dupes.length) {
      console.warn(`[DB] Skip unique index ${indexName}: duplicates found in ${table}.${column}.`);
      return;
    }
    await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS ${indexName} ON ${table} (${column})`);
  };

  const nullifyInvalidRefs = async (table: string, column: string, refTable: string, refColumn: string) => {
    if (!(await columnExists(table, column))) return;

    await db.exec(`UPDATE ${table} SET ${column} = NULL WHERE ${column} IS NOT NULL AND TRIM(${column}) = ''`);
    const invalid: any[] = await db.all(
      `SELECT DISTINCT ${column} as value
       FROM ${table}
       WHERE ${column} IS NOT NULL
         AND ${column} NOT IN (SELECT ${refColumn} FROM ${refTable})`
    );
    if (invalid.length) {
      await db.exec(
        `UPDATE ${table}
         SET ${column} = NULL
         WHERE ${column} IS NOT NULL
           AND ${column} NOT IN (SELECT ${refColumn} FROM ${refTable})`
      );
      console.warn(`[DB] Cleared ${invalid.length} invalid references in ${table}.${column}.`);
    }
  };

  const normalizeFkAction = (value: any) => String(value || '').trim().toUpperCase();

  const shouldRebuildForFks = async (table: string, expected: ForeignKeyDef[]) => {
    const rows: any[] = await db.all(`PRAGMA foreign_key_list('${table}')`);
    if (!rows.length && expected.length) return true;
    return expected.some((fk) => {
      const match = rows.find((r: any) => r.from === fk.from && r.table === fk.toTable && r.to === fk.toColumn);
      if (!match) return true;
      return normalizeFkAction(match.on_delete) !== normalizeFkAction(fk.onDelete || '');
    });
  };

  const hasForeignKeyViolations = async (table: string) => {
    const rows: any[] = await db.all(`PRAGMA foreign_key_check('${table}')`);
    return rows.length > 0;
  };

  const rebuildTableWithFks = async (
    table: string,
    foreignKeys: ForeignKeyDef[],
    indexes: string[]
  ) => {
    if (await hasForeignKeyViolations(table)) {
      console.warn(`[DB] Skip FK migration for ${table}: foreign key violations detected.`);
      return;
    }

    const cols: any[] = await db.all(`PRAGMA table_info('${table}')`);
    if (!cols.length) return;

    const tmpTable = `${table}__tmp`;
    await db.exec(`DROP TABLE IF EXISTS ${tmpTable}`);

    const formatDefault = (value: any) => {
      const raw = String(value).trim();
      if (!raw) return '';
      const upper = raw.toUpperCase();
      if (upper === 'CURRENT_TIMESTAMP' || upper === 'CURRENT_DATE' || upper === 'CURRENT_TIME') {
        return `DEFAULT ${raw}`;
      }
      if (raw.startsWith('(') && raw.endsWith(')')) return `DEFAULT ${raw}`;
      if (raw.startsWith("'") || raw.startsWith('"')) return `DEFAULT ${raw}`;
      if (/^-?\d+(\.\d+)?$/.test(raw)) return `DEFAULT ${raw}`;
      if (raw.includes('(')) return `DEFAULT (${raw})`;
      return `DEFAULT ${raw}`;
    };

    const colDefs = cols.map((c: any) => {
      const parts = [`${c.name} ${c.type || 'TEXT'}`];
      if (c.pk) parts.push('PRIMARY KEY');
      if (c.notnull) parts.push('NOT NULL');
      if (c.dflt_value !== null && c.dflt_value !== undefined) {
        const def = formatDefault(c.dflt_value);
        if (def) parts.push(def);
      }
      return parts.join(' ');
    });

    const fkDefs = foreignKeys.map((fk) => {
      const onDelete = fk.onDelete ? ` ON DELETE ${fk.onDelete}` : '';
      return `FOREIGN KEY(${fk.from}) REFERENCES ${fk.toTable}(${fk.toColumn})${onDelete}`;
    });

    const createSql = `CREATE TABLE ${tmpTable} (${[...colDefs, ...fkDefs].join(', ')})`;
    try {
      await db.exec(createSql);
    } catch (err: any) {
      console.error(`[DB] Failed to create temp table for ${table}.`, createSql);
      throw err;
    }

    const newCols: any[] = await db.all(`PRAGMA table_info('${tmpTable}')`);
    const newColNames = newCols.map((c: any) => c.name);
    const oldColSet = new Set(cols.map((c: any) => c.name));
    const commonCols = newColNames.filter((name: string) => oldColSet.has(name));

    if (commonCols.length) {
      const colList = commonCols.map((name: string) => `"${name}"`).join(', ');
      try {
        await db.exec(`INSERT INTO ${tmpTable} (${colList}) SELECT ${colList} FROM ${table}`);
      } catch (err: any) {
        console.error(`[DB] Failed to copy data into ${tmpTable} from ${table}.`, err);
        throw err;
      }
    }

    await db.exec(`DROP TABLE ${table}`);
    await db.exec(`ALTER TABLE ${tmpTable} RENAME TO ${table}`);

    for (const sql of indexes) {
      await db.exec(sql);
    }

    console.log(`[DB] Rebuilt ${table} with updated foreign keys.`);
  };

  // ─── HULY PORT migrations ─────────────────────────────────────────────────
  // Lead: funnel fields
  await ensureColumn('Lead', 'funnelId', 'funnelId TEXT REFERENCES Funnel(id) ON DELETE SET NULL');
  await ensureColumn('Lead', 'title', 'title TEXT');
  await ensureColumn('Lead', 'value', 'value REAL');
  await ensureColumn('Lead', 'assignedTo', 'assignedTo TEXT REFERENCES User(id) ON DELETE SET NULL');
  await ensureColumn('Lead', 'startDate', 'startDate TEXT');
  await ensureColumn('Lead', 'notes', 'notes TEXT');
  await ensureColumn('Lead', 'contactId', 'contactId TEXT REFERENCES Contact(id) ON DELETE SET NULL');
  // Product: category hierarchy
  await ensureColumn('Product', 'categoryId', 'categoryId TEXT REFERENCES ProductCategory(id) ON DELETE SET NULL');
  // Task: milestone
  await ensureColumn('Task', 'milestoneId', 'milestoneId TEXT REFERENCES Milestone(id) ON DELETE SET NULL');
  // User: department
  await ensureColumn('User', 'departmentId', 'departmentId TEXT REFERENCES Department(id) ON DELETE SET NULL');
  // ─── end HULY PORT migrations ─────────────────────────────────────────────

  await ensureColumn('Product', 'qbuRateSource', 'qbuRateSource TEXT');
  await ensureColumn('Product', 'qbuRateDate', 'qbuRateDate TEXT');
  await ensureColumn('Product', 'qbuRateValue', 'qbuRateValue REAL');
  await ensureColumn('User', 'username', 'username TEXT');
  await ensureColumn('User', 'passwordHash', 'passwordHash TEXT');
  await ensureColumn('User', 'systemRole', "systemRole TEXT DEFAULT 'viewer'");
  await ensureColumn('User', 'roleCodes', 'roleCodes TEXT');
  await ensureColumn('User', 'employeeCode', 'employeeCode TEXT');
  await ensureColumn('User', 'dateOfBirth', 'dateOfBirth TEXT');
  await ensureColumn('User', 'avatar', 'avatar TEXT');
  await ensureColumn('User', 'address', 'address TEXT');
  await ensureColumn('User', 'startDate', 'startDate TEXT');
  await ensureColumn('User', 'lastLoginAt', 'lastLoginAt TEXT');
  await ensureColumn('User', 'accountStatus', "accountStatus TEXT DEFAULT 'active'");
  await ensureColumn('User', 'mustChangePassword', 'mustChangePassword INTEGER DEFAULT 1');
  await ensureColumn('User', 'language', "language TEXT DEFAULT 'vi'");
  await ensureColumn('Activity', 'actorUserId', 'actorUserId TEXT');
  await ensureColumn('Activity', 'actorRoles', 'actorRoles TEXT');
  await ensureColumn('Activity', 'actingCapability', 'actingCapability TEXT');
  await ensureColumn('Activity', 'action', 'action TEXT');
  await ensureColumn('Activity', 'timestamp', 'timestamp TEXT');
  await ensureColumn('Task', 'target', 'target TEXT');
  await ensureColumn('Task', 'resultLinks', 'resultLinks TEXT');
  await ensureColumn('Task', 'output', 'output TEXT');
  await ensureColumn('Task', 'reportDate', 'reportDate TEXT');
  await ensureColumn('Task', 'taskType', 'taskType TEXT');
  await ensureColumn('Task', 'department', 'department TEXT');
  await ensureColumn('Task', 'blockedReason', 'blockedReason TEXT');
  await ensureColumn('ApprovalRequest', 'pricingQuotationId', 'pricingQuotationId TEXT');
  await ensureColumn('PricingQuotation', 'projectId', 'projectId TEXT');
  await ensureColumn('PricingQuotation', 'changeReason', 'changeReason TEXT');
  await ensureColumn('PricingQuotation', 'qbuType', "qbuType TEXT DEFAULT 'INITIAL'");
  await ensureColumn('PricingQuotation', 'parentPricingQuotationId', 'parentPricingQuotationId TEXT');
  await ensureColumn('PricingQuotation', 'batchNo', 'batchNo INTEGER DEFAULT 0');
  await ensureColumn('PricingQuotation', 'qbuWorkflowStage', "qbuWorkflowStage TEXT DEFAULT 'draft'");
  await ensureColumn('PricingQuotation', 'qbuSubmittedAt', 'qbuSubmittedAt TEXT');
  await ensureColumn('PricingQuotation', 'qbuSubmittedBy', 'qbuSubmittedBy TEXT');
  await ensureColumn('PricingQuotation', 'qbuCompletedAt', 'qbuCompletedAt TEXT');
  await ensureColumn('PricingLineItem', 'costRoutingType', 'costRoutingType TEXT');
  await ensureColumn('Notification', 'entityType', 'entityType TEXT');
  await ensureColumn('Notification', 'entityId', 'entityId TEXT');
  await ensureColumn('Notification', 'link', 'link TEXT');
  await ensureColumn('SupportTicket', 'category', 'category TEXT');
  await ensureColumn('SupportTicket', 'subject', 'subject TEXT');
  await ensureColumn('SupportTicket', 'description', 'description TEXT');
  await ensureColumn('SupportTicket', 'status', "status TEXT DEFAULT 'open'");
  await ensureColumn('SupportTicket', 'responseNote', 'responseNote TEXT');
  await ensureColumn('SupportTicket', 'createdBy', 'createdBy TEXT');
  await ensureColumn('SupportTicket', 'updatedBy', 'updatedBy TEXT');
  await ensureColumn('SupportTicket', 'createdAt', 'createdAt DATETIME DEFAULT CURRENT_TIMESTAMP');
  await ensureColumn('SupportTicket', 'updatedAt', 'updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP');
  await ensureColumn('Task', 'accountId', 'accountId TEXT');
  await ensureColumn('Task', 'sortOrder', 'sortOrder REAL DEFAULT 0');
  await ensureColumn('Task', 'parentTaskId', 'parentTaskId TEXT');
  await ensureColumn('Task', 'leadId', 'leadId TEXT');
  await ensureColumn('Task', 'quotationId', 'quotationId TEXT');
  await ensureColumn('Project', 'projectStage', "projectStage TEXT DEFAULT 'new'");
  await ensureColumn('Quotation', 'projectId', 'projectId TEXT');
  await ensureColumn('Quotation', 'revisionNo', 'revisionNo INTEGER DEFAULT 1');
  await ensureColumn('Quotation', 'revisionLabel', 'revisionLabel TEXT');
  await ensureColumn('Quotation', 'parentQuotationId', 'parentQuotationId TEXT');
  await ensureColumn('Quotation', 'changeReason', 'changeReason TEXT');
  await ensureColumn('Quotation', 'isWinningVersion', 'isWinningVersion INTEGER DEFAULT 0');
  await ensureColumn('SupplierQuote', 'projectId', 'projectId TEXT');
  await ensureColumn('SupplierQuote', 'linkedQuotationId', 'linkedQuotationId TEXT');
  await ensureColumn('SupplierQuote', 'changeReason', 'changeReason TEXT');
  await ensureColumn('ProjectProcurementLine', 'isActive', 'isActive INTEGER DEFAULT 1');
  await ensureColumn('ProjectProcurementLine', 'supersededAt', 'supersededAt TEXT');
  await ensureColumn('ProjectProcurementLine', 'supersededByBaselineId', 'supersededByBaselineId TEXT');
  await ensureColumn('ApprovalRequest', 'projectId', 'projectId TEXT');
  await ensureColumn('ApprovalRequest', 'quotationId', 'quotationId TEXT');
  await ensureColumn('ApprovalRequest', 'requestType', 'requestType TEXT');
  await ensureColumn('ApprovalRequest', 'title', 'title TEXT');
  await ensureColumn('ApprovalRequest', 'department', 'department TEXT');
  await ensureColumn('ApprovalRequest', 'requestedBy', 'requestedBy TEXT');
  await ensureColumn('ApprovalRequest', 'approverRole', 'approverRole TEXT');
  await ensureColumn('ApprovalRequest', 'approverUserId', 'approverUserId TEXT');
  await ensureColumn('ApprovalRequest', 'status', "status TEXT DEFAULT 'pending'");
  await ensureColumn('ApprovalRequest', 'dueDate', 'dueDate TEXT');
  await ensureColumn('ApprovalRequest', 'note', 'note TEXT');
  await ensureColumn('ApprovalRequest', 'decidedAt', 'decidedAt TEXT');
  await ensureColumn('ApprovalRequest', 'decidedBy', 'decidedBy TEXT');
  await ensureColumn('ProjectDocument', 'projectId', 'projectId TEXT');
  await ensureColumn('ProjectDocument', 'quotationId', 'quotationId TEXT');
  await ensureColumn('ProjectDocument', 'documentCode', 'documentCode TEXT');
  await ensureColumn('ProjectDocument', 'documentName', 'documentName TEXT');
  await ensureColumn('ProjectDocument', 'category', 'category TEXT');
  await ensureColumn('ProjectDocument', 'department', 'department TEXT');
  await ensureColumn('ProjectDocument', 'status', "status TEXT DEFAULT 'missing'");
  await ensureColumn('ProjectDocument', 'requiredAtStage', 'requiredAtStage TEXT');
  await ensureColumn('ProjectDocument', 'note', 'note TEXT');
  await ensureColumn('ProjectDocument', 'receivedAt', 'receivedAt TEXT');
  await ensureColumn('ProjectDocument', 'reviewStatus', "reviewStatus TEXT DEFAULT 'draft'");
  await ensureColumn('ProjectDocument', 'reviewerUserId', 'reviewerUserId TEXT');
  await ensureColumn('ProjectDocument', 'reviewedAt', 'reviewedAt TEXT');
  await ensureColumn('ProjectDocument', 'reviewNote', 'reviewNote TEXT');
  await ensureColumn('ProjectDocument', 'storageKey', 'storageKey TEXT');
  await ensureColumn('ProjectDocument', 'threadId', 'threadId TEXT');

  await db.exec(`
    CREATE TABLE IF NOT EXISTS EntityThread (
      id TEXT PRIMARY KEY,
      entityType TEXT NOT NULL,
      entityId TEXT NOT NULL,
      title TEXT,
      status TEXT DEFAULT 'active',
      createdBy TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS EntityThreadMessage (
      id TEXT PRIMARY KEY,
      threadId TEXT NOT NULL REFERENCES EntityThread(id) ON DELETE CASCADE,
      authorUserId TEXT,
      content TEXT NOT NULL,
      contentType TEXT DEFAULT 'text/plain',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_pricing_quote_project ON PricingQuotation (projectId, batchNo);
    CREATE INDEX IF NOT EXISTS idx_pricing_quote_parent ON PricingQuotation (parentPricingQuotationId, batchNo);
    CREATE INDEX IF NOT EXISTS idx_pricing_quote_stage ON PricingQuotation (qbuWorkflowStage, updatedAt);
  `);

  await migrateLegacySupplierTable();
  await ensureUniqueIndexIfNoDuplicates('User', 'username', 'idx_user_username_unique');
  await nullifyInvalidRefs('Account', 'assignedTo', 'User', 'id');
  await nullifyInvalidRefs('Project', 'managerId', 'User', 'id');
  await nullifyInvalidRefs('Task', 'assigneeId', 'User', 'id');
  await nullifyInvalidRefs('Task', 'parentTaskId', 'Task', 'id');
  await nullifyInvalidRefs('Quotation', 'accountId', 'Account', 'id');
  await nullifyInvalidRefs('Quotation', 'contactId', 'Contact', 'id');
  await nullifyInvalidRefs('Quotation', 'projectId', 'Project', 'id');
  await nullifyInvalidRefs('Quotation', 'parentQuotationId', 'Quotation', 'id');
  await nullifyInvalidRefs('SupplierQuote', 'projectId', 'Project', 'id');
  await nullifyInvalidRefs('SupplierQuote', 'linkedQuotationId', 'Quotation', 'id');
  await nullifyInvalidRefs('ApprovalRequest', 'projectId', 'Project', 'id');
  await nullifyInvalidRefs('ApprovalRequest', 'quotationId', 'Quotation', 'id');
  await nullifyInvalidRefs('ApprovalRequest', 'approverUserId', 'User', 'id');
  await nullifyInvalidRefs('ProjectDocument', 'projectId', 'Project', 'id');
  await nullifyInvalidRefs('ProjectDocument', 'quotationId', 'Quotation', 'id');
  await nullifyInvalidRefs('SalesOrder', 'accountId', 'Account', 'id');
  await nullifyInvalidRefs('SalesOrder', 'quotationId', 'Quotation', 'id');

  const fkTargets: Array<{ table: string; foreignKeys: ForeignKeyDef[]; indexes: string[] }> = [
    {
      table: 'Account',
      foreignKeys: [{ from: 'assignedTo', toTable: 'User', toColumn: 'id', onDelete: 'SET NULL' }],
      indexes: ['CREATE INDEX IF NOT EXISTS idx_account_assigned ON Account (assignedTo)'],
    },
    {
      table: 'Contact',
      foreignKeys: [{ from: 'accountId', toTable: 'Account', toColumn: 'id', onDelete: 'CASCADE' }],
      indexes: ['CREATE INDEX IF NOT EXISTS idx_contact_account ON Contact (accountId)'],
    },
    {
      table: 'Quotation',
      foreignKeys: [
        { from: 'accountId', toTable: 'Account', toColumn: 'id', onDelete: 'SET NULL' },
        { from: 'contactId', toTable: 'Contact', toColumn: 'id', onDelete: 'SET NULL' },
        { from: 'projectId', toTable: 'Project', toColumn: 'id', onDelete: 'SET NULL' },
        { from: 'parentQuotationId', toTable: 'Quotation', toColumn: 'id', onDelete: 'SET NULL' },
      ],
      indexes: [
        'CREATE INDEX IF NOT EXISTS idx_quotation_status ON Quotation (status)',
        'CREATE INDEX IF NOT EXISTS idx_quotation_account ON Quotation (accountId)',
        'CREATE INDEX IF NOT EXISTS idx_quotation_date ON Quotation (quoteDate)',
        'CREATE INDEX IF NOT EXISTS idx_quotation_project ON Quotation (projectId)',
        'CREATE INDEX IF NOT EXISTS idx_quotation_revision ON Quotation (projectId, revisionNo)',
        'CREATE INDEX IF NOT EXISTS idx_quotation_parent ON Quotation (parentQuotationId)',
      ],
    },
    {
      table: 'SupplierQuote',
      foreignKeys: [
        { from: 'supplierId', toTable: 'Account', toColumn: 'id', onDelete: 'CASCADE' },
        { from: 'projectId', toTable: 'Project', toColumn: 'id', onDelete: 'SET NULL' },
        { from: 'linkedQuotationId', toTable: 'Quotation', toColumn: 'id', onDelete: 'SET NULL' },
      ],
      indexes: [
        'CREATE INDEX IF NOT EXISTS idx_supplierquote_supplier ON SupplierQuote (supplierId)',
        'CREATE INDEX IF NOT EXISTS idx_supplierquote_status ON SupplierQuote (status)',
        'CREATE INDEX IF NOT EXISTS idx_supplierquote_project ON SupplierQuote (projectId)',
        'CREATE INDEX IF NOT EXISTS idx_supplierquote_quotation ON SupplierQuote (linkedQuotationId)',
      ],
    },
    {
      table: 'Project',
      foreignKeys: [{ from: 'managerId', toTable: 'User', toColumn: 'id', onDelete: 'SET NULL' }],
      indexes: ['CREATE INDEX IF NOT EXISTS idx_project_manager ON Project (managerId)'],
    },
    {
      table: 'Task',
      foreignKeys: [
        { from: 'projectId', toTable: 'Project', toColumn: 'id', onDelete: 'CASCADE' },
        { from: 'parentTaskId', toTable: 'Task', toColumn: 'id', onDelete: 'SET NULL' },
        { from: 'assigneeId', toTable: 'User', toColumn: 'id', onDelete: 'SET NULL' },
        { from: 'quotationId', toTable: 'Quotation', toColumn: 'id', onDelete: 'SET NULL' },
      ],
      indexes: [
        'CREATE INDEX IF NOT EXISTS idx_task_project ON Task (projectId)',
        'CREATE INDEX IF NOT EXISTS idx_task_parent ON Task (parentTaskId)',
        'CREATE INDEX IF NOT EXISTS idx_task_sort_order ON Task (parentTaskId, sortOrder, createdAt)',
        'CREATE INDEX IF NOT EXISTS idx_task_assignee ON Task (assigneeId)',
        'CREATE INDEX IF NOT EXISTS idx_task_status ON Task (status)',
        'CREATE INDEX IF NOT EXISTS idx_task_account ON Task (accountId)',
        'CREATE INDEX IF NOT EXISTS idx_task_start_date ON Task (startDate)',
        'CREATE INDEX IF NOT EXISTS idx_task_due_date ON Task (dueDate)',
        'CREATE INDEX IF NOT EXISTS idx_task_lead ON Task (leadId)',
        'CREATE INDEX IF NOT EXISTS idx_task_quotation ON Task (quotationId)',
        'CREATE INDEX IF NOT EXISTS idx_task_type ON Task (taskType)',
        'CREATE INDEX IF NOT EXISTS idx_task_department ON Task (department)',
      ],
    },
    {
      table: 'SalesOrder',
      foreignKeys: [
        { from: 'quotationId', toTable: 'Quotation', toColumn: 'id', onDelete: 'SET NULL' },
        { from: 'accountId', toTable: 'Account', toColumn: 'id', onDelete: 'CASCADE' },
      ],
      indexes: [
        'CREATE INDEX IF NOT EXISTS idx_salesorder_created ON SalesOrder (createdAt)',
        'CREATE INDEX IF NOT EXISTS idx_salesorder_status ON SalesOrder (status, updatedAt)',
      ],
    },
    {
      table: 'ApprovalRequest',
      foreignKeys: [
        { from: 'projectId', toTable: 'Project', toColumn: 'id', onDelete: 'CASCADE' },
        { from: 'quotationId', toTable: 'Quotation', toColumn: 'id', onDelete: 'SET NULL' },
        { from: 'approverUserId', toTable: 'User', toColumn: 'id', onDelete: 'SET NULL' },
      ],
      indexes: [
        'CREATE INDEX IF NOT EXISTS idx_approval_project ON ApprovalRequest (projectId)',
        'CREATE INDEX IF NOT EXISTS idx_approval_quote ON ApprovalRequest (quotationId)',
        'CREATE INDEX IF NOT EXISTS idx_approval_status ON ApprovalRequest (status)',
        'CREATE INDEX IF NOT EXISTS idx_approval_department ON ApprovalRequest (department)',
      ],
    },
    {
      table: 'ProjectDocument',
      foreignKeys: [
        { from: 'projectId', toTable: 'Project', toColumn: 'id', onDelete: 'CASCADE' },
        { from: 'quotationId', toTable: 'Quotation', toColumn: 'id', onDelete: 'SET NULL' },
      ],
      indexes: [
        'CREATE INDEX IF NOT EXISTS idx_projectdocument_project ON ProjectDocument (projectId)',
        'CREATE INDEX IF NOT EXISTS idx_projectdocument_quote ON ProjectDocument (quotationId)',
        'CREATE INDEX IF NOT EXISTS idx_projectdocument_status ON ProjectDocument (status)',
        'CREATE INDEX IF NOT EXISTS idx_projectdocument_department ON ProjectDocument (department)',
        'CREATE INDEX IF NOT EXISTS idx_projectdocument_review_status ON ProjectDocument (reviewStatus)',
      ],
    },
    {
      table: 'ChatMessage',
      foreignKeys: [{ from: 'userId', toTable: 'User', toColumn: 'id', onDelete: 'CASCADE' }],
      indexes: [
        'CREATE INDEX IF NOT EXISTS idx_chatmessage_user_created ON ChatMessage (userId, createdAt)',
        'CREATE INDEX IF NOT EXISTS idx_chatmessage_created ON ChatMessage (createdAt)',
      ],
    },
    {
      table: 'Notification',
      foreignKeys: [{ from: 'userId', toTable: 'User', toColumn: 'id', onDelete: 'CASCADE' }],
      indexes: [
        'CREATE INDEX IF NOT EXISTS idx_notification_user_read_created ON Notification (userId, readAt, createdAt)',
        'CREATE INDEX IF NOT EXISTS idx_notification_user_created ON Notification (userId, createdAt)',
      ],
    },
    {
      table: 'EntityThreadMessage',
      foreignKeys: [{ from: 'threadId', toTable: 'EntityThread', toColumn: 'id', onDelete: 'CASCADE' }],
      indexes: [
        'CREATE INDEX IF NOT EXISTS idx_entitythreadmessage_thread ON EntityThreadMessage (threadId, createdAt)',
      ],
    },
  ];

  let fkNeedsMigration = false;
  for (const target of fkTargets) {
    if (await shouldRebuildForFks(target.table, target.foreignKeys)) {
      fkNeedsMigration = true;
      break;
    }
  }

  if (fkNeedsMigration) {
    await db.run('PRAGMA foreign_keys = OFF');
    for (const target of fkTargets) {
      if (await shouldRebuildForFks(target.table, target.foreignKeys)) {
        await rebuildTableWithFks(target.table, target.foreignKeys, target.indexes);
      }
    }
    await db.run('PRAGMA foreign_keys = ON');
    const fkProblems: any[] = await db.all('PRAGMA foreign_key_check');
    if (fkProblems.length) {
      console.warn('[DB] Foreign key check found issues after migration.', fkProblems);
    }
  }

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_task_lead ON Task (leadId);
    CREATE INDEX IF NOT EXISTS idx_task_quotation ON Task (quotationId);
    CREATE INDEX IF NOT EXISTS idx_entitythread_entity ON EntityThread (entityType, entityId, status, createdAt);
  `);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS TaskViewPreset (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL REFERENCES User(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      query TEXT,
      projectId TEXT,
      assigneeId TEXT,
      priority TEXT,
      status TEXT,
      onlyOverdue INTEGER DEFAULT 0,
      groupBy TEXT DEFAULT 'none',
      surface TEXT DEFAULT 'kanban',
      isDefault INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    )
  `);
  await ensureColumn('TaskViewPreset', 'groupBy', "groupBy TEXT DEFAULT 'none'");
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_taskviewpreset_user ON TaskViewPreset (userId, isDefault, createdAt);
  `);
  await db.run(
    'INSERT OR IGNORE INTO SystemSetting (key, value) VALUES (?, ?)',
    ['vcb_rate_url', '']
  );
  await db.run(
    'INSERT OR IGNORE INTO SystemSetting (key, value) VALUES (?, ?)',
    ['qbu_variance_threshold_pct', '10']
  );
  await db.run(
    'INSERT OR IGNORE INTO SystemSetting (key, value) VALUES (?, ?)',
    ['qbu_variance_threshold_vnd', '20000000']
  );

  // ─── HULY PORT: seed default Funnel ──────────────────────────────────────
  await db.run(
    `INSERT OR IGNORE INTO Funnel (id, name, description, isDefault, sortOrder, createdAt, updatedAt)
     VALUES ('funnel-default-sales-pipeline', 'Sales Pipeline', 'Default sales funnel', 1, 0, datetime('now'), datetime('now'))`
  );

  await db.run("UPDATE User SET language = 'vi' WHERE language IS NULL OR TRIM(language) = ''");
  await db.run("UPDATE SupportTicket SET status = 'open' WHERE status IS NULL OR TRIM(status) = ''");
  await db.run("UPDATE SupportTicket SET subject = COALESCE(NULLIF(TRIM(subject), ''), 'Support request') WHERE subject IS NULL OR TRIM(subject) = ''");
  await db.run("UPDATE SupportTicket SET updatedAt = COALESCE(updatedAt, createdAt, datetime('now')) WHERE updatedAt IS NULL OR TRIM(updatedAt) = ''");
  await canonicalizeGenderColumn('User', 'id');
  await canonicalizeGenderColumn('Contact', 'id');
  await normalizeLegacyProductStructuredFields();
}
