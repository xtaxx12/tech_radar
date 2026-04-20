import { MongoClient } from 'mongodb';
import type { TechEvent } from '../types.js';

const DEFAULT_DB_NAME = 'tech_radar_latam';
const DEFAULT_COLLECTION = 'events';

class EventRepository {
  private client: MongoClient | null = null;
  private memoryStore: TechEvent[] = [];
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;

    const mongoUri = process.env.MONGODB_URI?.trim();

    if (!mongoUri) {
      this.initialized = true;
      return;
    }

    this.client = new MongoClient(mongoUri);
    await this.client.connect();

    const db = this.client.db(process.env.MONGODB_DB ?? DEFAULT_DB_NAME);
    const collection = db.collection<TechEvent>(process.env.MONGODB_COLLECTION ?? DEFAULT_COLLECTION);

    await collection.createIndex({ source: 1, url: 1 }, { unique: true });
    await collection.createIndex({ date: 1 });
    await collection.createIndex({ country: 1, city: 1 });

    this.initialized = true;
  }

  async saveMany(events: TechEvent[]): Promise<number> {
    await this.init();

    if (!this.client) {
      const byId = new Map(this.memoryStore.map((event) => [event.id, event]));
      for (const event of events) {
        byId.set(event.id, event);
      }
      this.memoryStore = [...byId.values()];
      return events.length;
    }

    const db = this.client.db(process.env.MONGODB_DB ?? DEFAULT_DB_NAME);
    const collection = db.collection<TechEvent>(process.env.MONGODB_COLLECTION ?? DEFAULT_COLLECTION);

    if (events.length === 0) return 0;

    const operations = events.map((event) => ({
      updateOne: {
        filter: { source: event.source, url: event.url },
        update: {
          $set: {
            ...event,
            updatedAt: new Date().toISOString()
          },
          $setOnInsert: {
            createdAt: event.createdAt
          }
        },
        upsert: true
      }
    }));

    await collection.bulkWrite(operations, { ordered: false });
    return events.length;
  }

  async getAll(): Promise<TechEvent[]> {
    await this.init();

    if (!this.client) {
      return [...this.memoryStore].sort((a, b) => a.date.localeCompare(b.date));
    }

    const db = this.client.db(process.env.MONGODB_DB ?? DEFAULT_DB_NAME);
    const collection = db.collection<TechEvent>(process.env.MONGODB_COLLECTION ?? DEFAULT_COLLECTION);

    return collection.find({}).sort({ date: 1 }).toArray();
  }

  async getById(id: string): Promise<TechEvent | null> {
    await this.init();

    if (!this.client) {
      return this.memoryStore.find((event) => event.id === id) ?? null;
    }

    const db = this.client.db(process.env.MONGODB_DB ?? DEFAULT_DB_NAME);
    const collection = db.collection<TechEvent>(process.env.MONGODB_COLLECTION ?? DEFAULT_COLLECTION);

    return collection.findOne({ id });
  }

  async close(): Promise<void> {
    if (!this.client) return;
    await this.client.close();
    this.client = null;
  }
}

export const eventRepository = new EventRepository();
