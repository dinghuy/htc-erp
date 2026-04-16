import { type Database } from 'sqlite';
import { randomUUID } from 'node:crypto';
import { normalizeGender } from '../../../gender';
import {
  DEFAULT_QUOTATION_FINANCIAL_CONFIG,
  parseLegacyQuotationCommercialTerms,
  parseLegacyQuotationFinancialConfig,
  parseLegacyQuotationLineItems,
} from '../../modules/quotations/typedState';
import {
  DEFAULT_OPERATION_CONFIG,
  DEFAULT_RENTAL_CONFIG,
  normalizeOperationConfig,
  normalizeRentalConfig,
} from '../../../pricing/compute';

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

export async function repairMissingUserIds(db: Database) {
  const userTable: any = await db.get(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'User'"
  );
  if (!userTable?.name) return 0;

  const cols: any[] = await db.all(`PRAGMA table_info('User')`);
  const idColumn = cols.find((column: any) => column.name === 'id');
  const usesIntegerPrimaryKey = String(idColumn?.type || '').toUpperCase().includes('INT');
  const rows: Array<{ rowid: number; id: unknown; username: unknown }> = await db.all(
    `SELECT rowid as rowid, id, username
     FROM User
     WHERE id IS NULL OR TRIM(CAST(id AS TEXT)) = ''`
  );

  for (const row of rows) {
    const usernameSlug = String(row.username || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    let nextId = usesIntegerPrimaryKey
      ? String(row.rowid)
      : (usernameSlug ? `user-${usernameSlug}` : `user-${randomUUID()}`);

    const existing = await db.get(
      'SELECT rowid FROM User WHERE id = ? AND rowid != ?',
      [nextId, row.rowid]
    );
    if (existing) {
      nextId = usesIntegerPrimaryKey
        ? String(row.rowid)
        : `user-${randomUUID()}`;
    }

    await db.run('UPDATE User SET id = ? WHERE rowid = ?', [nextId, row.rowid]);
  }

  return rows.length;
}

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

  const createTypedQuotationChildTables = async () => {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS QuotationLineItem (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quotationId INTEGER NOT NULL,
        sortOrder INTEGER DEFAULT 0,
        sku TEXT,
        name TEXT,
        unit TEXT,
        technicalSpecs TEXT,
        remarks TEXT,
        quantity REAL DEFAULT 1,
        unitPrice REAL DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(quotationId) REFERENCES Quotation(id) ON DELETE CASCADE
      )
    `);

    await db.exec(`
      CREATE TABLE IF NOT EXISTS QuotationTermItem (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quotationId INTEGER NOT NULL,
        sortOrder INTEGER DEFAULT 0,
        labelViPrint TEXT,
        labelEn TEXT,
        textVi TEXT,
        textEn TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(quotationId) REFERENCES Quotation(id) ON DELETE CASCADE
      )
    `);

    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_quotationlineitem_quote ON QuotationLineItem (quotationId, sortOrder);
      CREATE INDEX IF NOT EXISTS idx_quotationtermitem_quote ON QuotationTermItem (quotationId, sortOrder);
    `);
  };

  const backfillTypedQuotationState = async () => {
    if (!(await tableExists('Quotation'))) return;
    await createTypedQuotationChildTables();

    const quotationRows: any[] = await db.all(
      `SELECT id, items, financialParams, terms, createdAt
       FROM Quotation`
    );

    for (const row of quotationRows) {
      const quotationId = Number(row?.id);
      if (!Number.isFinite(quotationId)) continue;

      const existingLineItemCount = await db.get(
        `SELECT COUNT(*) as c FROM QuotationLineItem WHERE quotationId = ?`,
        [quotationId]
      );
      if (Number(existingLineItemCount?.c || 0) === 0) {
        const lineItems = parseLegacyQuotationLineItems(row.items);
        for (const item of lineItems) {
          await db.run(
            `INSERT INTO QuotationLineItem (
              quotationId, sortOrder, sku, name, unit, technicalSpecs, remarks, quantity, unitPrice, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), datetime('now'))`,
            [
              quotationId,
              item.sortOrder,
              item.sku,
              item.name,
              item.unit,
              item.technicalSpecs,
              item.remarks,
              item.quantity,
              item.unitPrice,
              row.createdAt || null,
            ]
          );
        }
      }

      const financialConfig = parseLegacyQuotationFinancialConfig(row.financialParams);
      const commercialTerms = parseLegacyQuotationCommercialTerms(row.terms);
      await db.run(
        `UPDATE Quotation
         SET interestRate = COALESCE(interestRate, ?),
             exchangeRate = COALESCE(exchangeRate, ?),
             loanTermMonths = COALESCE(loanTermMonths, ?),
             markup = COALESCE(markup, ?),
             vatRate = COALESCE(vatRate, ?),
             remarksVi = COALESCE(remarksVi, ?),
             remarksEn = COALESCE(remarksEn, ?)
         WHERE id = ?`,
        [
          financialConfig.interestRate ?? DEFAULT_QUOTATION_FINANCIAL_CONFIG.interestRate,
          financialConfig.exchangeRate ?? DEFAULT_QUOTATION_FINANCIAL_CONFIG.exchangeRate,
          financialConfig.loanTermMonths ?? DEFAULT_QUOTATION_FINANCIAL_CONFIG.loanTermMonths,
          financialConfig.markup ?? DEFAULT_QUOTATION_FINANCIAL_CONFIG.markup,
          financialConfig.vatRate ?? DEFAULT_QUOTATION_FINANCIAL_CONFIG.vatRate,
          commercialTerms.remarksVi ?? null,
          commercialTerms.remarksEn ?? null,
          quotationId,
        ]
      );

      const existingTermItemCount = await db.get(
        `SELECT COUNT(*) as c FROM QuotationTermItem WHERE quotationId = ?`,
        [quotationId]
      );
      if (Number(existingTermItemCount?.c || 0) === 0) {
        for (const termItem of commercialTerms.termItems) {
          await db.run(
            `INSERT INTO QuotationTermItem (
              quotationId, sortOrder, labelViPrint, labelEn, textVi, textEn, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), datetime('now'))`,
            [
              quotationId,
              termItem.sortOrder,
              termItem.labelViPrint,
              termItem.labelEn,
              termItem.textVi,
              termItem.textEn,
              row.createdAt || null,
            ]
          );
        }
      }
    }
  };

  const backfillPricingConfigState = async () => {
    if (!(await tableExists('PricingQuotation'))) return;

    const hasRentalTable = await tableExists('PricingRentalConfig');
    const hasOperationTable = await tableExists('PricingOperationConfig');
    if (!hasRentalTable && !hasOperationTable) return;

    const quotationRows: any[] = await db.all(`SELECT id FROM PricingQuotation`);
    for (const row of quotationRows) {
      const quotationId = String(row?.id || '').trim();
      if (!quotationId) continue;

      const rentalSource = hasRentalTable
        ? await db.get(`SELECT * FROM PricingRentalConfig WHERE quotationId = ?`, [quotationId])
        : null;
      const operationSource = hasOperationTable
        ? await db.get(`SELECT * FROM PricingOperationConfig WHERE quotationId = ?`, [quotationId])
        : null;

      if (!rentalSource && !operationSource) continue;

      const rentalConfig = normalizeRentalConfig(rentalSource || DEFAULT_RENTAL_CONFIG);
      const operationConfig = normalizeOperationConfig({
        ...(operationSource || DEFAULT_OPERATION_CONFIG),
        pmIntervalsHours: operationSource?.pmIntervalsHours
          ? JSON.parse(operationSource.pmIntervalsHours)
          : DEFAULT_OPERATION_CONFIG.pmIntervalsHours,
      });

      await db.run(
        `UPDATE PricingQuotation
         SET investmentQty = COALESCE(investmentQty, ?),
             depreciationMonths = COALESCE(depreciationMonths, ?),
             stlPct = COALESCE(stlPct, ?),
             stlPeriodMonths = COALESCE(stlPeriodMonths, ?),
             stlRate = COALESCE(stlRate, ?),
             stlRateChange = COALESCE(stlRateChange, ?),
             ltlPeriodMonths = COALESCE(ltlPeriodMonths, ?),
             ltlRate = COALESCE(ltlRate, ?),
             ltlRateChange = COALESCE(ltlRateChange, ?),
             rentPeriodMonths = COALESCE(rentPeriodMonths, ?),
             downpaymentMonths = COALESCE(downpaymentMonths, ?),
             paymentDelayDays = COALESCE(paymentDelayDays, ?),
             expectedProfitPct = COALESCE(expectedProfitPct, ?),
             contingencyPct = COALESCE(contingencyPct, ?),
             workingDaysMonth = COALESCE(workingDaysMonth, ?),
             dailyHours = COALESCE(dailyHours, ?),
             movesPerDay = COALESCE(movesPerDay, ?),
             kmPerMove = COALESCE(kmPerMove, ?),
             electricityPriceVnd = COALESCE(electricityPriceVnd, ?),
             kwhPerKm = COALESCE(kwhPerKm, ?),
             driversPerUnit = COALESCE(driversPerUnit, ?),
             driverSalaryVnd = COALESCE(driverSalaryVnd, ?),
             insuranceRate = COALESCE(insuranceRate, ?),
             pmIntervalsHours = COALESCE(pmIntervalsHours, ?)
         WHERE id = ?`,
        [
          rentalConfig.investmentQty,
          rentalConfig.depreciationMonths,
          rentalConfig.stlPct,
          rentalConfig.stlPeriodMonths,
          rentalConfig.stlRate,
          rentalConfig.stlRateChange,
          rentalConfig.ltlPeriodMonths,
          rentalConfig.ltlRate,
          rentalConfig.ltlRateChange,
          rentalConfig.rentPeriodMonths,
          rentalConfig.downpaymentMonths,
          rentalConfig.paymentDelayDays,
          rentalConfig.expectedProfitPct,
          rentalConfig.contingencyPct,
          operationConfig.workingDaysMonth,
          operationConfig.dailyHours,
          operationConfig.movesPerDay,
          operationConfig.kmPerMove,
          operationConfig.electricityPriceVnd,
          operationConfig.kwhPerKm,
          operationConfig.driversPerUnit,
          operationConfig.driverSalaryVnd,
          operationConfig.insuranceRate,
          JSON.stringify(operationConfig.pmIntervalsHours),
          quotationId,
        ]
      );
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

  const migrateLegacySalesPersonTable = async () => {
    if (!(await tableExists('SalesPerson'))) return;

    const cols: any[] = await db.all(`PRAGMA table_info('SalesPerson')`);
    const has = (name: string) => cols.some((c: any) => c.name === name);

    const count: any = await db.get('SELECT COUNT(*) as c FROM SalesPerson');
    if (count?.c > 0) {
      const nameExpr = has('name') ? 'name' : "''";
      const emailExpr = has('email') ? 'email' : 'NULL';
      const phoneExpr = has('phone') ? 'phone' : 'NULL';
      await db.exec(`
        INSERT INTO User (
          id, fullName, gender, email, phone, role, department, status,
          username, passwordHash, systemRole, roleCodes, accountStatus, mustChangePassword, language, createdAt
        )
        SELECT
          id,
          ${nameExpr},
          'unknown',
          ${emailExpr},
          ${phoneExpr},
          'Salesperson',
          'Sales',
          'Active',
          NULL,
          NULL,
          'sales',
          '["sales"]',
          'active',
          0,
          'vi',
          COALESCE(createdAt, datetime('now'))
        FROM SalesPerson
        WHERE id IS NOT NULL
          AND id NOT IN (SELECT id FROM User)
      `);
    }

    await db.exec('DROP TABLE IF EXISTS SalesPerson');
    console.log('[DB] Legacy SalesPerson table migrated into User and dropped.');
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
  // User: department
  await ensureColumn('User', 'departmentId', 'departmentId TEXT REFERENCES Department(id) ON DELETE SET NULL');
  // ─── Seed Department from User.department text and backfill departmentId ────
  const deptCount = await db.get<{ c: number }>('SELECT COUNT(*) as c FROM Department');
  if (deptCount && deptCount.c === 0) {
    const deptNames = await db.all<Array<{ department: string }>>(
      "SELECT DISTINCT department FROM User WHERE department IS NOT NULL AND TRIM(department) != '' ORDER BY department"
    );
    for (const { department } of deptNames) {
      const deptId = `dept-${department.toLowerCase().replace(/\s+/g, '-')}`;
      await db.run(
        `INSERT OR IGNORE INTO Department (id, name, sortOrder, createdAt, updatedAt) VALUES (?, ?, 0, datetime('now'), datetime('now'))`,
        [deptId, department]
      );
    }
    await db.run(
      `UPDATE User SET departmentId = (SELECT id FROM Department WHERE Department.name = User.department) WHERE departmentId IS NULL AND department IS NOT NULL AND TRIM(department) != ''`
    );
    console.log('[DB] Seeded Department from User.department and backfilled User.departmentId.');
  }

  // ─── Seed ProductCategory from Product.category text and backfill categoryId
  const catCount = await db.get<{ c: number }>('SELECT COUNT(*) as c FROM ProductCategory');
  if (catCount && catCount.c === 0) {
    const catNames = await db.all<Array<{ category: string }>>(
      "SELECT DISTINCT category FROM Product WHERE category IS NOT NULL AND TRIM(category) != '' ORDER BY category"
    );
    let sortOrder = 0;
    for (const { category } of catNames) {
      const catId = `cat-${category.toLowerCase().replace(/[\s\/]+/g, '-').replace(/[^\w-]/g, '')}`;
      await db.run(
        `INSERT OR IGNORE INTO ProductCategory (id, name, sortOrder, createdAt) VALUES (?, ?, ?, datetime('now'))`,
        [catId, category, sortOrder++]
      );
    }
    await db.run(
      `UPDATE Product SET categoryId = (SELECT id FROM ProductCategory WHERE ProductCategory.name = Product.category) WHERE categoryId IS NULL AND category IS NOT NULL AND TRIM(category) != ''`
    );
    console.log('[DB] Seeded ProductCategory from Product.category and backfilled Product.categoryId.');
  }
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
  await ensureColumn('PricingQuotation', 'investmentQty', 'investmentQty INTEGER DEFAULT 2');
  await ensureColumn('PricingQuotation', 'depreciationMonths', 'depreciationMonths INTEGER DEFAULT 60');
  await ensureColumn('PricingQuotation', 'stlPct', 'stlPct REAL DEFAULT 0.3');
  await ensureColumn('PricingQuotation', 'stlPeriodMonths', 'stlPeriodMonths INTEGER DEFAULT 24');
  await ensureColumn('PricingQuotation', 'stlRate', 'stlRate REAL DEFAULT 0.09');
  await ensureColumn('PricingQuotation', 'stlRateChange', 'stlRateChange REAL DEFAULT 0.05');
  await ensureColumn('PricingQuotation', 'ltlPeriodMonths', 'ltlPeriodMonths INTEGER DEFAULT 60');
  await ensureColumn('PricingQuotation', 'ltlRate', 'ltlRate REAL DEFAULT 0.12');
  await ensureColumn('PricingQuotation', 'ltlRateChange', 'ltlRateChange REAL DEFAULT 0.03');
  await ensureColumn('PricingQuotation', 'rentPeriodMonths', 'rentPeriodMonths INTEGER DEFAULT 60');
  await ensureColumn('PricingQuotation', 'downpaymentMonths', 'downpaymentMonths INTEGER DEFAULT 3');
  await ensureColumn('PricingQuotation', 'paymentDelayDays', 'paymentDelayDays INTEGER DEFAULT 30');
  await ensureColumn('PricingQuotation', 'expectedProfitPct', 'expectedProfitPct REAL DEFAULT 0.185');
  await ensureColumn('PricingQuotation', 'contingencyPct', 'contingencyPct REAL DEFAULT 0.03');
  await ensureColumn('PricingQuotation', 'workingDaysMonth', 'workingDaysMonth INTEGER DEFAULT 30');
  await ensureColumn('PricingQuotation', 'dailyHours', 'dailyHours REAL DEFAULT 20');
  await ensureColumn('PricingQuotation', 'movesPerDay', 'movesPerDay REAL DEFAULT 70');
  await ensureColumn('PricingQuotation', 'kmPerMove', 'kmPerMove REAL DEFAULT 1');
  await ensureColumn('PricingQuotation', 'electricityPriceVnd', 'electricityPriceVnd REAL DEFAULT 3000');
  await ensureColumn('PricingQuotation', 'kwhPerKm', 'kwhPerKm REAL DEFAULT 2.3');
  await ensureColumn('PricingQuotation', 'driversPerUnit', 'driversPerUnit REAL DEFAULT 2');
  await ensureColumn('PricingQuotation', 'driverSalaryVnd', 'driverSalaryVnd REAL DEFAULT 20000000');
  await ensureColumn('PricingQuotation', 'insuranceRate', 'insuranceRate REAL DEFAULT 0.225');
  await ensureColumn('PricingQuotation', 'pmIntervalsHours', 'pmIntervalsHours TEXT');
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
  await ensureColumn('Quotation', 'interestRate', 'interestRate REAL DEFAULT 8.5');
  await ensureColumn('Quotation', 'exchangeRate', 'exchangeRate REAL DEFAULT 25400');
  await ensureColumn('Quotation', 'loanTermMonths', 'loanTermMonths INTEGER DEFAULT 36');
  await ensureColumn('Quotation', 'markup', 'markup REAL DEFAULT 15');
  await ensureColumn('Quotation', 'vatRate', 'vatRate REAL DEFAULT 8');
  await ensureColumn('Quotation', 'remarksVi', 'remarksVi TEXT');
  await ensureColumn('Quotation', 'remarksEn', 'remarksEn TEXT');
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
  await migrateLegacySalesPersonTable();
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
        'CREATE INDEX IF NOT EXISTS idx_quotation_project_latest ON Quotation (projectId, quoteDate, revisionNo, createdAt)',
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
      indexes: [
        'CREATE INDEX IF NOT EXISTS idx_project_manager ON Project (managerId)',
        'CREATE INDEX IF NOT EXISTS idx_project_stage ON Project (projectStage)',
      ],
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
        'CREATE INDEX IF NOT EXISTS idx_task_project_status_due ON Task (projectId, status, dueDate)',
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
        'CREATE INDEX IF NOT EXISTS idx_salesorder_quotation ON SalesOrder (quotationId)',
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
        'CREATE INDEX IF NOT EXISTS idx_approval_requested_by ON ApprovalRequest (requestedBy)',
        'CREATE INDEX IF NOT EXISTS idx_approval_approver_user ON ApprovalRequest (approverUserId)',
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
        'CREATE INDEX IF NOT EXISTS idx_projectdocument_thread ON ProjectDocument (threadId)',
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
    CREATE INDEX IF NOT EXISTS idx_task_project_status_due ON Task (projectId, status, dueDate);
    CREATE INDEX IF NOT EXISTS idx_quotation_project_latest ON Quotation (projectId, quoteDate, revisionNo, createdAt);
    CREATE INDEX IF NOT EXISTS idx_account_type_created ON Account (accountType, createdAt);
    CREATE INDEX IF NOT EXISTS idx_lead_status_created ON Lead (status, createdAt);
    CREATE INDEX IF NOT EXISTS idx_entitythread_entity ON EntityThread (entityType, entityId, status, createdAt);
    CREATE INDEX IF NOT EXISTS idx_project_stage ON Project (projectStage);
    CREATE INDEX IF NOT EXISTS idx_salesorder_quotation ON SalesOrder (quotationId);
    CREATE INDEX IF NOT EXISTS idx_approval_requested_by ON ApprovalRequest (requestedBy);
    CREATE INDEX IF NOT EXISTS idx_approval_approver_user ON ApprovalRequest (approverUserId);
    CREATE INDEX IF NOT EXISTS idx_projectdocument_thread ON ProjectDocument (threadId);
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
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_todo_entity_done ON ToDo (entityType, entityId, doneAt);
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

  const funnelCount: any = await db.get('SELECT COUNT(*) as c FROM Funnel');
  if (Number(funnelCount?.c || 0) === 0) {
    await db.run(
      `INSERT INTO Funnel (name, description, isDefault, sortOrder)
       VALUES ('Sales Pipeline', 'Default sales funnel', 1, 0)`
    );
  }

  await db.run("UPDATE User SET language = 'vi' WHERE language IS NULL OR TRIM(language) = ''");
  const repairedUserIds = await repairMissingUserIds(db);
  if (repairedUserIds > 0) {
    console.log(`[DB] Backfilled ${repairedUserIds} user id(s) that were null or empty.`);
  }
  await db.run("UPDATE SupportTicket SET status = 'open' WHERE status IS NULL OR TRIM(status) = ''");
  await db.run("UPDATE SupportTicket SET subject = COALESCE(NULLIF(TRIM(subject), ''), 'Support request') WHERE subject IS NULL OR TRIM(subject) = ''");
  await db.run("UPDATE SupportTicket SET updatedAt = COALESCE(updatedAt, createdAt, datetime('now')) WHERE updatedAt IS NULL OR TRIM(updatedAt) = ''");
  await canonicalizeGenderColumn('User', 'id');
  await canonicalizeGenderColumn('Contact', 'id');
  await normalizeLegacyProductStructuredFields();
  await backfillPricingConfigState();
  await backfillTypedQuotationState();
  await db.exec('DROP TABLE IF EXISTS PricingRentalConfig');
  await db.exec('DROP TABLE IF EXISTS PricingOperationConfig');
  await db.exec('DROP TABLE IF EXISTS QuotationFinancialConfig');
  await db.exec('DROP TABLE IF EXISTS QuotationTermProfile');
  // Ghost/orphaned tables — no source code references
  await db.exec('DROP TABLE IF EXISTS Milestone');
  await db.exec('DROP TABLE IF EXISTS HulyBridgeJob');
  await db.exec('DROP TABLE IF EXISTS TaskIntegrationLink');
}
