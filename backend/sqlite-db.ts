import path from 'path';
import { type Database } from 'sqlite';
import { v4 as uuidv4 } from 'uuid';
import { ensureDefaultAdmin } from './src/persistence/sqlite/defaultAdmin';
import { bootstrapSqliteSchema } from './src/persistence/sqlite/bootstrap';
import { finalizeSqliteSchema } from './src/persistence/sqlite/finalize';
import { resolveSqliteDbPath, openSqliteDatabase } from './src/persistence/sqlite/runtime';

let db: Database;
let dbInitialized = false;

export async function initDb() {
  if (dbInitialized && db) {
    return;
  }

  const dbPath = resolveSqliteDbPath(process.env.DB_PATH, path.join(__dirname, 'crm.db'));
  db = await openSqliteDatabase(dbPath);

  await bootstrapSqliteSchema(db);
  await finalizeSqliteSchema(db);
  await ensureDefaultAdmin(db, { createId: uuidv4 });

  console.log('✅ SQLite Database Tables Initialized');
  dbInitialized = true;
}

export function getDb(): Database {
  if (!db) {
    throw new Error("Tệp database chưa được khởi tạo! Hãy gọi initDb trước khi sử dụng getDb().");
  }
  return db;
}
