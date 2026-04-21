import { asc, eq, sql } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { events, type EventInsert, type EventRow } from '../db/schema.js';
import type { SummarySource, TechEvent } from '../types.js';

const MEMORY_STORE_CAP = 5000;

class EventRepository {
  private memoryStore: TechEvent[] = [];
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    // The pool is lazily created on first getDb() call; nothing else to do here.
    // Migrations run from bootstrap via runMigrations().
    this.initialized = true;
  }

  async saveMany(events_: TechEvent[]): Promise<number> {
    await this.init();
    if (events_.length === 0) return 0;

    const db = getDb();

    if (!db) {
      const byId = new Map(this.memoryStore.map((event) => [event.id, event]));
      for (const event of events_) {
        byId.set(event.id, event);
      }
      let next = [...byId.values()];
      if (next.length > MEMORY_STORE_CAP) {
        next = next
          .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
          .slice(0, MEMORY_STORE_CAP);
      }
      this.memoryStore = next;
      return events_.length;
    }

    const rows: EventInsert[] = events_.map((event) => toInsert(event));

    await db
      .insert(events)
      .values(rows)
      .onConflictDoUpdate({
        target: [events.source, events.url],
        set: {
          title: sql`excluded.title`,
          description: sql`excluded.description`,
          date: sql`excluded.date`,
          country: sql`excluded.country`,
          city: sql`excluded.city`,
          link: sql`excluded.link`,
          tags: sql`excluded.tags`,
          level: sql`excluded.level`,
          summary: sql`excluded.summary`,
          summarySource: sql`excluded.summary_source`,
          contentHash: sql`excluded.content_hash`,
          trending: sql`excluded.trending`,
          raw: sql`excluded.raw`,
          updatedAt: sql`now()`
        }
      });

    return rows.length;
  }

  async getAll(): Promise<TechEvent[]> {
    await this.init();
    const db = getDb();

    if (!db) {
      return [...this.memoryStore].sort((a, b) => a.date.localeCompare(b.date));
    }

    const rows = await db.select().from(events).orderBy(asc(events.date));
    return rows.map(fromRow);
  }

  async getById(id: string): Promise<TechEvent | null> {
    await this.init();
    const db = getDb();

    if (!db) {
      return this.memoryStore.find((event) => event.id === id) ?? null;
    }

    const [row] = await db.select().from(events).where(eq(events.id, id)).limit(1);
    return row ? fromRow(row) : null;
  }

  /**
   * Devuelve un Map con los eventos ya persistidos indexados por la tupla
   * (source, url) — que es nuestra clave de dedupe. Usado por el enrichment
   * para saber cuáles eventos ya pasaron por la IA y skippear llamadas.
   *
   * Para ~400 eventos totales es más barato cargar todo que armar un `IN`
   * con cientos de tuplas. Si el dataset crece a 10k+ eventos esto se
   * vuelve ineficiente y vale la pena filtrar por source/url específicos.
   */
  async getExistingByFetchKey(): Promise<Map<string, TechEvent>> {
    await this.init();
    const all = await this.getAll();
    const map = new Map<string, TechEvent>();
    for (const event of all) {
      map.set(buildFetchKey(event.source, event.url), event);
    }
    return map;
  }
}

export function buildFetchKey(source: string, url: string): string {
  return `${source}|${url}`;
}

function toInsert(event: TechEvent): EventInsert {
  const summarySource: SummarySource = event.summarySource ?? 'heuristic';
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    date: new Date(event.date).toISOString(),
    country: event.country,
    city: event.city,
    source: event.source,
    url: event.url,
    link: event.link ?? null,
    tags: event.tags,
    level: event.level,
    summary: event.summary ?? '',
    summarySource,
    contentHash: event.contentHash ?? null,
    trending: event.trending ?? false,
    raw: (event.raw ?? null) as EventInsert['raw'],
    createdAt: event.createdAt,
    updatedAt: new Date().toISOString()
  };
}

function fromRow(row: EventRow): TechEvent {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    date: row.date,
    country: row.country,
    city: row.city,
    source: row.source,
    url: row.url,
    link: row.link ?? undefined,
    tags: row.tags,
    level: row.level,
    summary: row.summary,
    summarySource: row.summarySource,
    contentHash: row.contentHash ?? null,
    trending: row.trending,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    raw: row.raw ?? undefined
  };
}

export const eventRepository = new EventRepository();
