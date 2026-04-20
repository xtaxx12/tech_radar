import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

const { Pool } = pg;

let poolSingleton: pg.Pool | null = null;
let dbSingleton: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getPool(): pg.Pool | null {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) return null;

  if (poolSingleton) return poolSingleton;

  const max = Number(process.env.PG_POOL_MAX ?? 10);
  const ssl = parseBool(process.env.PG_SSL);

  poolSingleton = new Pool({
    connectionString,
    max: Number.isFinite(max) && max > 0 ? max : 10,
    ssl: ssl ? { rejectUnauthorized: false } : undefined
  });

  poolSingleton.on('error', (error) => {
    console.error('[db] idle client error:', error.message);
  });

  return poolSingleton;
}

export function getDb() {
  if (dbSingleton) return dbSingleton;
  const pool = getPool();
  if (!pool) return null;
  dbSingleton = drizzle(pool, { schema });
  return dbSingleton;
}

export async function closeDb(): Promise<void> {
  if (poolSingleton) {
    await poolSingleton.end();
    poolSingleton = null;
    dbSingleton = null;
  }
}

function parseBool(value: string | undefined): boolean {
  if (!value) return false;
  return /^(1|true|yes|on)$/i.test(value.trim());
}
