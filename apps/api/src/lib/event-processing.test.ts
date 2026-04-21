import { describe, expect, it } from 'vitest';
import { cleanEvents, dedupeEvents, enrichEventsWithAI } from './event-processing.js';
import type { TechEvent } from '../types.js';

function makeEvent(overrides: Partial<TechEvent> = {}): TechEvent {
  const nowIso = new Date().toISOString();
  return {
    id: 'evt-1',
    title: 'Build With AI - LAN PARTY en USFQ',
    description: 'Hands-on workshop on Gemini and Vertex AI.',
    date: '2026-05-20T19:00:00.000Z',
    country: 'Ecuador',
    city: 'Quito',
    source: 'gdg',
    url: 'https://gdg.community.dev/events/details/usfq/',
    link: 'https://gdg.community.dev/events/details/usfq/',
    tags: ['ia'],
    level: 'all',
    summary: '',
    createdAt: nowIso,
    updatedAt: nowIso,
    ...overrides
  };
}

describe('cleanEvents', () => {
  it('drops events without a title or a url', () => {
    const rows = [
      makeEvent(),
      makeEvent({ id: 'no-title', title: '   ' }),
      makeEvent({ id: 'no-url', url: '' })
    ];
    const out = cleanEvents(rows);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('evt-1');
  });

  it('trims strings and fills city/country defaults', () => {
    const out = cleanEvents([
      makeEvent({ title: '  Title  ', city: '', country: '' })
    ]);
    expect(out[0].title).toBe('Title');
    expect(out[0].city).toBe('Latam');
    expect(out[0].country).toBe('Latam');
  });

  it('normalizes tags (lowercase, deduped, limited to 8)', () => {
    const tags = Array.from({ length: 12 }, (_, i) => `tag-${i}`);
    const out = cleanEvents([makeEvent({ tags: ['IA', 'ia', 'Web', ...tags] })]);
    expect(out[0].tags.length).toBeLessThanOrEqual(8);
    expect(out[0].tags).toContain('ia');
    expect(out[0].tags).toContain('web');
    // No duplicates after normalization
    expect(new Set(out[0].tags).size).toBe(out[0].tags.length);
  });

  it('coerces unparseable dates into a valid "now" ISO string instead of dropping the row', () => {
    const out = cleanEvents([makeEvent({ date: 'not-a-date' })]);
    expect(out).toHaveLength(1);
    expect(Number.isNaN(new Date(out[0].date).getTime())).toBe(false);
  });
});

describe('dedupeEvents', () => {
  it('collapses same title + same city + same day into one record', () => {
    const eventA = makeEvent({
      id: 'a',
      title: 'Build with AI',
      city: 'Quito',
      country: 'Ecuador',
      date: '2026-05-20T19:00:00.000Z',
      description: 'Short',
      tags: ['ia']
    });
    const eventB = makeEvent({
      id: 'b',
      title: 'BUILD with AI  ',
      city: 'Quito',
      country: 'Ecuador',
      date: '2026-05-20T22:30:00.000Z',
      description: 'A much longer description with more keywords and context.',
      tags: ['ia', 'gcp', 'flutter']
    });

    const out = dedupeEvents([eventA, eventB]);
    expect(out).toHaveLength(1);
    // Richer payload wins.
    expect(out[0].id).toBe('b');
  });

  it('keeps events from different cities apart', () => {
    const out = dedupeEvents([
      makeEvent({ id: 'a', city: 'Quito' }),
      makeEvent({ id: 'b', city: 'Guayaquil' })
    ]);
    expect(out).toHaveLength(2);
  });

  it('keeps events on different days apart', () => {
    const out = dedupeEvents([
      makeEvent({ id: 'a', date: '2026-05-20T19:00:00.000Z' }),
      makeEvent({ id: 'b', date: '2026-05-27T19:00:00.000Z' })
    ]);
    expect(out).toHaveLength(2);
  });

  it('ignores case and accents when deduping titles', () => {
    const out = dedupeEvents([
      makeEvent({ id: 'a', title: 'Construye con IA' }),
      makeEvent({ id: 'b', title: 'CONSTRUYE CON IA' }),
      makeEvent({ id: 'c', title: 'Construye Con IÁ' })
    ]);
    expect(out).toHaveLength(1);
  });

  it('merges duplicates across sources keeping the richest payload', () => {
    // Mismo evento listado en Meetup (poca info) y en GDG (rico).
    const meetup = makeEvent({
      id: 'meetup-123',
      source: 'meetup',
      title: 'Build with AI',
      description: 'Short',
      tags: ['ia']
    });
    const gdg = makeEvent({
      id: 'gdg-456',
      source: 'gdg',
      title: 'Build with AI',
      description: 'Full agenda with speakers, sponsors and hands-on codelabs',
      tags: ['ia', 'gcp', 'flutter', 'cloud']
    });

    const out = dedupeEvents([meetup, gdg]);
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe('gdg');
    expect(out[0].tags.length).toBeGreaterThanOrEqual(meetup.tags.length);
  });

  it('returns the input unchanged when there is nothing to merge', () => {
    const out = dedupeEvents([]);
    expect(out).toEqual([]);
  });
});

describe('enrichEventsWithAI — heuristic summary (no AI keys configured)', () => {
  it('never echoes the title in the summary', async () => {
    const events = cleanEvents([
      makeEvent({
        id: 'evt-title-echo',
        title: 'Build With AI - LAN PARTY en USFQ',
        description: 'Evento de GDG Quito.', // boilerplate — no útil
        tags: ['ia']
      })
    ]);

    const [enriched] = await enrichEventsWithAI(events);
    expect(enriched.summary).toBeTruthy();
    expect(enriched.summary).not.toContain(enriched.title);
    expect(enriched.summary.toLowerCase()).not.toContain('usfq');
  });

  it('uses the first sentence of a real description when available', async () => {
    const events = cleanEvents([
      makeEvent({
        id: 'evt-with-desc',
        title: 'Cloud Run Day Bogotá',
        description: 'Un día completo para aprender a deployar contenedores sin servidores en Google Cloud Run, con sesiones hands-on y speakers de la región. Incluye networking y sorteos al final.',
        tags: ['cloud']
      })
    ]);

    const [enriched] = await enrichEventsWithAI(events);
    expect(enriched.summary.length).toBeGreaterThan(30);
    expect(enriched.summary.toLowerCase()).toContain('deployar');
    expect(enriched.summary.toLowerCase()).not.toContain('sorteos');
  });

  it('infers the format when the title mentions "Workshop", "Hackathon", etc.', async () => {
    const workshop = cleanEvents([
      makeEvent({ id: 'w', title: 'Workshop Gemini API para principiantes', description: 'Evento de GDG Quito.', tags: ['ia'] })
    ]);
    const hackathon = cleanEvents([
      makeEvent({ id: 'h', title: 'DevFest Hackathon Ecuador', description: '', tags: ['ia', 'cloud'] })
    ]);

    const [workshopOut] = await enrichEventsWithAI(workshop);
    const [hackathonOut] = await enrichEventsWithAI(hackathon);

    expect(workshopOut.summary).toMatch(/^Workshop/);
    expect(hackathonOut.summary).toMatch(/^Hackathon/);
  });

  it('skips source boilerplate like "Evento de GDG X." and builds its own summary', async () => {
    const events = cleanEvents([
      makeEvent({
        id: 'evt-boilerplate',
        title: 'Build With AI - LAN PARTY en USFQ',
        description: 'Evento de GDG Quito.',
        tags: ['ia']
      })
    ]);

    const [enriched] = await enrichEventsWithAI(events);
    expect(enriched.summary.toLowerCase()).not.toBe('evento de gdg quito.');
    expect(enriched.summary).toMatch(/LAN party|inteligencia artificial/i);
  });
});
