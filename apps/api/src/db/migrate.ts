import { migrate } from 'drizzle-orm/node-postgres/migrator';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { closeDb, getDb } from './client.js';

dotenv.config();

const MIGRATIONS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'drizzle');

export async function runMigrations(): Promise<void> {
  const db = getDb();
  if (!db) {
    console.warn('[db] DATABASE_URL no configurado; migraciones omitidas (modo memoria).');
    return;
  }

  await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  console.log('[db] migraciones aplicadas desde', MIGRATIONS_DIR);
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (invokedDirectly) {
  runMigrations()
    .catch((error) => {
      console.error('[db] migración falló:', error);
      process.exitCode = 1;
    })
    .finally(() => {
      void closeDb();
    });
}
