import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { open, type Database } from 'sqlite';

export function resolveSqliteDbPath(envPath: string | undefined, fallbackPath: string) {
  return envPath?.trim() ? path.resolve(envPath.trim()) : fallbackPath;
}

export async function openSqliteDatabase(dbPath: string): Promise<Database> {
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  await db.run('PRAGMA foreign_keys = ON');
  await db.run('PRAGMA journal_mode = WAL');

  return db;
}
