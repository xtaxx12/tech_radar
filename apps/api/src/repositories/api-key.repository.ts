import crypto from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { apiKeys, type ApiKeyRow } from '../db/schema.js';

const KEY_BYTES = 32;
const KEY_PREFIX = 'trk_'; // "tech-radar key", facilita detectar secrets filtrados en logs/grep.

export type NewApiKey = {
  id: string;
  owner: string;
  label: string | null;
  rateLimitPerHour: number;
  /** Sólo disponible al momento de la creación. Nunca vuelve a mostrarse. */
  plaintext: string;
};

export type ApiKeyPublic = {
  id: string;
  owner: string;
  label: string | null;
  keyPrefix: string;
  rateLimitPerHour: number;
  revoked: boolean;
  lastUsedAt: string | null;
  createdAt: string;
};

function hashKey(plaintext: string): string {
  return crypto.createHash('sha256').update(plaintext).digest('hex');
}

function generatePlaintextKey(): string {
  return KEY_PREFIX + crypto.randomBytes(KEY_BYTES).toString('base64url');
}

function toPublic(row: ApiKeyRow): ApiKeyPublic {
  return {
    id: row.id,
    owner: row.owner,
    label: row.label ?? null,
    keyPrefix: row.keyPrefix,
    rateLimitPerHour: Number(row.rateLimitPerHour),
    revoked: row.revoked,
    lastUsedAt: row.lastUsedAt ?? null,
    createdAt: row.createdAt
  };
}

class ApiKeyRepository {
  async issue(options: { owner: string; label?: string; rateLimitPerHour?: number }): Promise<NewApiKey> {
    const db = getDb();
    if (!db) throw new Error('DATABASE_URL no configurado; las API keys requieren Postgres.');

    const plaintext = generatePlaintextKey();
    const keyHash = hashKey(plaintext);
    const keyPrefix = plaintext.slice(0, 12); // trk_XXXXXXXX

    const [row] = await db
      .insert(apiKeys)
      .values({
        owner: options.owner,
        label: options.label ?? null,
        keyHash,
        keyPrefix,
        rateLimitPerHour: String(options.rateLimitPerHour ?? 1000)
      })
      .returning();

    return {
      id: row.id,
      owner: row.owner,
      label: row.label ?? null,
      rateLimitPerHour: Number(row.rateLimitPerHour),
      plaintext
    };
  }

  async findActive(plaintext: string): Promise<ApiKeyRow | null> {
    const db = getDb();
    if (!db) return null;

    const keyHash = hashKey(plaintext);
    const [row] = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.revoked, false)))
      .limit(1);
    return row ?? null;
  }

  async touchLastUsed(id: string): Promise<void> {
    const db = getDb();
    if (!db) return;
    await db
      .update(apiKeys)
      .set({ lastUsedAt: new Date().toISOString() })
      .where(eq(apiKeys.id, id));
  }

  async list(): Promise<ApiKeyPublic[]> {
    const db = getDb();
    if (!db) return [];
    const rows = await db.select().from(apiKeys).orderBy(desc(apiKeys.createdAt));
    return rows.map(toPublic);
  }

  async revoke(id: string): Promise<boolean> {
    const db = getDb();
    if (!db) return false;
    const [row] = await db
      .update(apiKeys)
      .set({ revoked: true })
      .where(eq(apiKeys.id, id))
      .returning();
    return Boolean(row);
  }
}

export const apiKeyRepository = new ApiKeyRepository();
