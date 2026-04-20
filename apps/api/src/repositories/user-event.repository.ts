import { and, eq } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { userEvents, type UserEventRow } from '../db/schema.js';

export type UserEventType = 'favorite' | 'rsvp';

export type UserEventRecord = {
  id: string;
  userId: string;
  eventId: string;
  type: UserEventType;
  createdAt: string;
};

class UserEventRepository {
  async list(userId: string, type?: UserEventType): Promise<UserEventRecord[]> {
    const db = requireDb();
    const conditions = type
      ? and(eq(userEvents.userId, userId), eq(userEvents.type, type))
      : eq(userEvents.userId, userId);

    const rows = await db.select().from(userEvents).where(conditions);
    return rows.map(toRecord);
  }

  async toggle(userId: string, eventId: string, type: UserEventType): Promise<{ active: boolean }> {
    const db = requireDb();

    const [existing] = await db
      .select({ id: userEvents.id })
      .from(userEvents)
      .where(and(eq(userEvents.userId, userId), eq(userEvents.eventId, eventId), eq(userEvents.type, type)))
      .limit(1);

    if (existing) {
      await db.delete(userEvents).where(eq(userEvents.id, existing.id));
      return { active: false };
    }

    await db.insert(userEvents).values({ userId, eventId, type });
    return { active: true };
  }

  async remove(userId: string, eventId: string, type: UserEventType): Promise<void> {
    const db = requireDb();
    await db
      .delete(userEvents)
      .where(and(eq(userEvents.userId, userId), eq(userEvents.eventId, eventId), eq(userEvents.type, type)));
  }
}

function requireDb() {
  const db = getDb();
  if (!db) {
    throw new Error('DATABASE_URL no configurado: favoritos/rsvp requiere Postgres.');
  }
  return db;
}

function toRecord(row: UserEventRow): UserEventRecord {
  return {
    id: row.id,
    userId: row.userId,
    eventId: row.eventId,
    type: row.type,
    createdAt: row.createdAt
  };
}

export const userEventRepository = new UserEventRepository();
