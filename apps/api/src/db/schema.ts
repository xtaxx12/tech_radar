import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid
} from 'drizzle-orm/pg-core';

export const eventSourceEnum = pgEnum('event_source', ['meetup', 'eventbrite', 'gdg', 'community']);
export const eventLevelEnum = pgEnum('event_level', ['junior', 'mid', 'senior', 'all']);
export const summarySourceEnum = pgEnum('summary_source', ['ai', 'heuristic']);
export const userEventTypeEnum = pgEnum('user_event_type', ['favorite', 'rsvp']);

export const events = pgTable(
  'events',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    date: timestamp('date', { withTimezone: true, mode: 'string' }).notNull(),
    country: text('country').notNull(),
    city: text('city').notNull(),
    source: eventSourceEnum('source').notNull(),
    url: text('url').notNull(),
    link: text('link'),
    tags: text('tags').array().notNull().default(sql`ARRAY[]::text[]`),
    level: eventLevelEnum('level').notNull().default('all'),
    summary: text('summary').notNull().default(''),
    summarySource: summarySourceEnum('summary_source').notNull().default('heuristic'),
    // sha1(AI_PROMPT_VERSION|title|description).slice(0, 16). Usado para saber
    // si el contenido del evento cambió desde el último enrichment y poder
    // skippear la llamada a la IA cuando no cambió nada.
    contentHash: text('content_hash'),
    trending: boolean('trending').notNull().default(false),
    raw: jsonb('raw'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow()
  },
  (table) => ({
    sourceUrlUnique: unique('events_source_url_unique').on(table.source, table.url),
    dateIdx: index('events_date_idx').on(table.date),
    countryCityIdx: index('events_country_city_idx').on(table.country, table.city)
  })
);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  googleSub: text('google_sub').notNull().unique(),
  email: text('email').notNull(),
  name: text('name'),
  picture: text('picture'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow()
});

export const userEvents = pgTable(
  'user_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    eventId: text('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    type: userEventTypeEnum('type').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow()
  },
  (table) => ({
    uniq: unique('user_events_user_event_type_unique').on(table.userId, table.eventId, table.type),
    userIdx: index('user_events_user_idx').on(table.userId)
  })
);

export type EventRow = typeof events.$inferSelect;
export type EventInsert = typeof events.$inferInsert;
export type UserRow = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;
export type UserEventRow = typeof userEvents.$inferSelect;
export type UserEventInsert = typeof userEvents.$inferInsert;
