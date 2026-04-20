import { eq, sql } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { users, type UserInsert, type UserRow } from '../db/schema.js';

export type AppUser = {
  id: string;
  googleSub: string;
  email: string;
  name: string | null;
  picture: string | null;
  createdAt: string;
  updatedAt: string;
};

class UserRepository {
  async upsertFromGoogle(profile: {
    googleSub: string;
    email: string;
    name?: string | null;
    picture?: string | null;
  }): Promise<AppUser> {
    const db = requireDb();

    const payload: UserInsert = {
      googleSub: profile.googleSub,
      email: profile.email,
      name: profile.name ?? null,
      picture: profile.picture ?? null
    };

    const [row] = await db
      .insert(users)
      .values(payload)
      .onConflictDoUpdate({
        target: users.googleSub,
        set: {
          email: sql`excluded.email`,
          name: sql`excluded.name`,
          picture: sql`excluded.picture`,
          updatedAt: sql`now()`
        }
      })
      .returning();

    return toAppUser(row);
  }

  async getById(id: string): Promise<AppUser | null> {
    const db = requireDb();
    const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return row ? toAppUser(row) : null;
  }

  async getByGoogleSub(googleSub: string): Promise<AppUser | null> {
    const db = requireDb();
    const [row] = await db.select().from(users).where(eq(users.googleSub, googleSub)).limit(1);
    return row ? toAppUser(row) : null;
  }
}

function requireDb() {
  const db = getDb();
  if (!db) {
    throw new Error('DATABASE_URL no configurado: auth/usuarios requiere Postgres.');
  }
  return db;
}

function toAppUser(row: UserRow): AppUser {
  return {
    id: row.id,
    googleSub: row.googleSub,
    email: row.email,
    name: row.name,
    picture: row.picture,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export const userRepository = new UserRepository();
