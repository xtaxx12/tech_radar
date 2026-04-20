import { describe, expect, it } from 'vitest';
import {
  buildRecommendationContext,
  enrichEvent,
  filterByInterpretation,
  parseChatInterpretation,
  rankEvents
} from './ranking.js';
import type { TechEvent, UserProfile } from '../types.js';

const baseProfile: UserProfile = {
  country: 'Ecuador',
  role: 'frontend',
  level: 'mid',
  interests: ['ia', 'web']
};

function makeEvent(overrides: Partial<TechEvent> = {}): TechEvent {
  const nowIso = new Date().toISOString();
  return {
    id: overrides.id ?? 'evt-1',
    title: 'Build with AI - LAN PARTY en USFQ',
    description: 'Evento de IA para la comunidad',
    date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    country: 'Ecuador',
    city: 'Quito',
    source: 'gdg',
    url: 'https://gdg.community.dev/events/details/lan-party-usfq/',
    link: 'https://gdg.community.dev/events/details/lan-party-usfq/',
    tags: ['ia', 'web', 'frontend'],
    level: 'all',
    summary: '',
    createdAt: nowIso,
    updatedAt: nowIso,
    ...overrides
  };
}

describe('enrichEvent', () => {
  it('rewards country, role, level and interest matches with reasons', () => {
    const event = makeEvent();
    const ranked = enrichEvent(event, baseProfile);

    expect(ranked.score).toBeGreaterThan(70);
    expect(ranked.reasons.join(' ')).toMatch(/Ecuador/);
    expect(ranked.reasons.join(' ')).toMatch(/ia|web/);
    expect(ranked.rankLabel).toMatch(/Muy relevante|Recomendado/);
  });

  it('drops to the minimum score for fully mismatched events', () => {
    const event = makeEvent({
      country: 'Japón',
      tags: ['blockchain'],
      level: 'senior',
      // ~2 years ahead so the time-window bonus never applies
      date: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000).toISOString()
    });
    const ranked = enrichEvent(event, baseProfile);

    // Base score floor without bonuses is 35; we clamp at 10 minimum.
    expect(ranked.score).toBeLessThan(45);
    expect(ranked.reasons.length).toBeGreaterThan(0);
  });

  it('keeps badges for GDG events', () => {
    const event = makeEvent({ trending: true });
    const ranked = enrichEvent(event, baseProfile);
    expect(ranked.badges).toContain('GDG');
  });

  it('penalizes events that already happened more than a week ago', () => {
    const upcoming = makeEvent({
      id: 'fresh',
      date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
    });
    const old = makeEvent({
      id: 'old',
      date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    });

    const rankedFresh = enrichEvent(upcoming, baseProfile);
    const rankedOld = enrichEvent(old, baseProfile);

    expect(rankedOld.score).toBeLessThan(rankedFresh.score);
    expect(rankedOld.reasons.join(' ')).toMatch(/Ya sucedió/);
  });

  it('does not credit the 8-21 days bonus to past events', () => {
    const pastTwoWeeks = makeEvent({
      id: 'past-two-weeks',
      date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
    });
    const ranked = enrichEvent(pastTwoWeeks, baseProfile);
    expect(ranked.reasons.join(' ')).not.toMatch(/Está cerca en el calendario/);
  });

  it('lifts score and adds "Trending" badge when the event id is in the dynamic trending set', () => {
    // Evento deliberadamente flojo en matches (otro país, tags sin overlap)
    // para dejar headroom de score antes del clamp de 100.
    const event = makeEvent({
      id: 'hot-one',
      trending: false,
      source: 'meetup',
      country: 'México',
      tags: ['backend'],
      level: 'senior'
    });
    const trendingIds = new Set<string>(['hot-one']);

    const withoutTrending = enrichEvent(event, baseProfile);
    const withTrending = enrichEvent(event, baseProfile, trendingIds);

    expect(withTrending.score).toBeGreaterThan(withoutTrending.score);
    expect(withTrending.badges).toContain('Trending');
    expect(withTrending.reasons.join(' ')).toMatch(/comunidad/i);
    // El evento que no es trending no recibe la razón ni el badge.
    expect(withoutTrending.badges).not.toContain('Trending');
  });

  it('still honors the hard-coded event.trending flag (backwards compatible)', () => {
    const event = makeEvent({ id: 'legacy-trending', trending: true, source: 'meetup' });
    const ranked = enrichEvent(event, baseProfile);
    expect(ranked.badges).toContain('Trending');
  });
});

describe('rankEvents', () => {
  it('orders by descending score and honors the limit', () => {
    const events = [
      makeEvent({ id: 'a', country: 'México', tags: ['backend'], level: 'senior' }),
      makeEvent({ id: 'b', country: 'Ecuador', tags: ['ia', 'web'] }),
      makeEvent({ id: 'c', country: 'Ecuador', tags: ['web'] })
    ];

    const ranked = rankEvents(events, baseProfile, 2);
    expect(ranked).toHaveLength(2);
    expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[1].score);
    expect(ranked[0].id).toBe('b'); // Ecuador + most interest matches should win
  });
});

describe('parseChatInterpretation', () => {
  it('detects country, level and interests from a Spanish sentence', () => {
    const interp = parseChatInterpretation('Eventos de IA esta semana en Ecuador para junior');

    expect(interp.country).toBe('Ecuador');
    expect(interp.level).toBe('junior');
    expect(interp.interests).toContain('ia');
    expect(interp.timeWindowDays).toBe(7);
  });

  it('matches the longest known city first so "Santo Domingo" wins over "Santo"', () => {
    const interp = parseChatInterpretation('Eventos en Santo Domingo sobre data', ['Santo', 'Santo Domingo']);
    expect(interp.city).toBe('Santo Domingo');
  });

  it('defaults the time window to 30 days when nothing matches', () => {
    const interp = parseChatInterpretation('quiero ir a un meetup de cloud');
    expect(interp.timeWindowDays).toBe(30);
  });
});

describe('filterByInterpretation', () => {
  it('keeps only events that match country + level + interest inside the time window', () => {
    const events = [
      makeEvent({
        id: 'match',
        country: 'Ecuador',
        level: 'junior',
        tags: ['ia'],
        date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
      }),
      makeEvent({
        id: 'far-away',
        country: 'Ecuador',
        level: 'junior',
        tags: ['ia'],
        date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() // outside 7-day window
      }),
      makeEvent({
        id: 'wrong-country',
        country: 'México',
        level: 'junior',
        tags: ['ia'],
        date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
      })
    ];

    const filtered = filterByInterpretation(events, {
      originalMessage: 'Eventos de IA esta semana en Ecuador para junior',
      country: 'Ecuador',
      level: 'junior',
      interests: ['ia'],
      timeWindowDays: 7
    });

    expect(filtered.map((event) => event.id)).toEqual(['match']);
  });
});

describe('buildRecommendationContext', () => {
  it('summarizes the current ranked slice for the UI', () => {
    const event = enrichEvent(makeEvent({ trending: true }), baseProfile);
    const ctx = buildRecommendationContext(baseProfile, [event]);

    expect(ctx.total).toBe(1);
    expect(ctx.topMatch).toBe(event.title);
    expect(ctx.profile).toEqual(baseProfile);
  });
});
