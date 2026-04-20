import { cleanEvents, dedupeEvents, enrichEventsWithAI } from '../lib/event-processing.js';
import { eventRepository } from '../repositories/event.repository.js';
import { fetchEventbriteEvents } from './eventbrite.service.js';
import { fetchGDGEvents } from './gdg.service.js';
import { fetchMeetupEvents } from './meetup.service.js';
import type { SyncResult } from '../types.js';

let runningSync: Promise<SyncResult> | null = null;
let lastSyncResult: SyncResult | null = null;

export async function syncEvents(): Promise<SyncResult> {
  if (runningSync) {
    return runningSync;
  }

  runningSync = executeSync();

  try {
    const result = await runningSync;
    lastSyncResult = result;
    return result;
  } finally {
    runningSync = null;
  }
}

export function getLastSyncResult(): SyncResult | null {
  return lastSyncResult;
}

export function isSyncRunning(): boolean {
  return runningSync !== null;
}

async function executeSync(): Promise<SyncResult> {
  const startedAt = new Date().toISOString();

  const [meetup, eventbrite, gdg] = await Promise.all([
    fetchMeetupEvents(),
    fetchEventbriteEvents(),
    fetchGDGEvents()
  ]);

  const fetchedEvents = [...meetup.events, ...eventbrite.events, ...gdg.events];
  const cleaned = cleanEvents(fetchedEvents);
  const deduped = dedupeEvents(cleaned);
  const enriched = await enrichEventsWithAI(deduped);
  const saved = await eventRepository.saveMany(enriched);

  return {
    fetched: fetchedEvents.length,
    cleaned: cleaned.length,
    deduped: deduped.length,
    saved,
    startedAt,
    finishedAt: new Date().toISOString(),
    sources: [meetup, eventbrite, gdg].map((source) => ({
      source: source.source,
      count: source.events.length,
      usedFallback: source.usedFallback,
      error: source.error
    }))
  };
}
