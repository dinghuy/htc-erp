import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { open, type Database } from 'sqlite';

export function resolveDefaultSqliteDbPath(runtimeDir: string) {
  const normalizedRuntimeDir = path.resolve(runtimeDir);
  const runtimeBaseName = path.basename(normalizedRuntimeDir).toLowerCase();
  const backendRoot = runtimeBaseName === 'dist'
    ? path.dirname(normalizedRuntimeDir)
    : normalizedRuntimeDir;

  return path.join(backendRoot, 'crm.db');
}

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
