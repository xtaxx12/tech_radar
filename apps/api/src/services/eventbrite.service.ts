import { eventbriteFallbackEvents } from '../data/fallback-events.js';
import { normalizeText } from '../lib/text.js';
import type { SourceFetchResult, TechEvent } from '../types.js';

const EVENTBRITE_ENDPOINT = 'https://www.eventbriteapi.com/v3/events/search/';

type EventbriteEvent = {
  id?: string;
  name?: { text?: string };
  description?: { text?: string };
  url?: string;
  start?: { local?: string; utc?: string };
  venue?: {
    address?: {
      city?: string;
      country?: string;
      localized_area_display?: string;
    };
  };
  category?: { short_name?: string };
};

export async function fetchEventbriteEvents(): Promise<SourceFetchResult> {
  const apiKey = process.env.EVENTBRITE_API_KEY?.trim();

  if (!apiKey) {
    return {
      source: 'eventbrite',
      events: eventbriteFallbackEvents,
      usedFallback: true,
      error: 'EVENTBRITE_API_KEY no configurada'
    };
  }

  const url = new URL(EVENTBRITE_ENDPOINT);
  url.searchParams.set('q', 'technology OR software OR AI');
  url.searchParams.set('location.address', 'Latin America');
  url.searchParams.set('expand', 'venue,category');
  url.searchParams.set('sort_by', 'date');

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`Eventbrite status ${response.status}`);
    }

    const data = (await response.json()) as { events?: EventbriteEvent[] };
    const mapped = (data.events ?? []).map((event) => mapEventbriteEvent(event)).filter(Boolean) as TechEvent[];

    if (mapped.length === 0) {
      return {
        source: 'eventbrite',
        events: eventbriteFallbackEvents,
        usedFallback: true,
        error: 'Eventbrite devolvio 0 eventos transformables'
      };
    }

    return {
      source: 'eventbrite',
      events: mapped,
      usedFallback: false
    };
  } catch (error) {
    return {
      source: 'eventbrite',
      events: eventbriteFallbackEvents,
      usedFallback: true,
      error: error instanceof Error ? error.message : 'Error desconocido en Eventbrite'
    };
  }
}

function mapEventbriteEvent(event: EventbriteEvent): TechEvent | null {
  const title = event.name?.text?.trim();
  const url = event.url?.trim();

  if (!title || !url) {
    return null;
  }

  const nowIso = new Date().toISOString();

  return {
    id: `eventbrite-${event.id ?? hashId(url)}`,
    title,
    description: event.description?.text?.trim() || 'Evento publicado en Eventbrite.',
    date: event.start?.local || event.start?.utc || nowIso,
    country: normalizeCountry(event.venue?.address?.country),
    city: event.venue?.address?.city?.trim() || event.venue?.address?.localized_area_display?.trim() || 'Latam',
    source: 'eventbrite',
    url,
    link: url,
    tags: deriveTags(`${title} ${event.description?.text ?? ''} ${event.category?.short_name ?? ''}`),
    level: 'all',
    summary: '',
    createdAt: nowIso,
    updatedAt: nowIso,
    raw: event
  };
}

function normalizeCountry(value?: string): string {
  const normalized = normalizeText(value ?? '');
  if (normalized === 'mx') return 'México';
  if (normalized === 'ec') return 'Ecuador';
  if (normalized === 'pe') return 'Perú';
  if (normalized === 'co') return 'Colombia';
  if (normalized === 'cl') return 'Chile';
  if (normalized === 'ar') return 'Argentina';
  if (normalized === 'br') return 'Brasil';
  return value?.trim() || 'Latam';
}

function deriveTags(input: string): string[] {
  const text = normalizeText(input);
  const tags: string[] = [];

  if (text.includes('ai') || text.includes('ia') || text.includes('machine learning')) tags.push('ia');
  if (text.includes('front')) tags.push('frontend');
  if (text.includes('back')) tags.push('backend');
  if (text.includes('data')) tags.push('data');
  if (text.includes('cloud') || text.includes('devops')) tags.push('cloud');
  if (text.includes('mobile')) tags.push('mobile');
  if (text.includes('web')) tags.push('web');

  return tags.length > 0 ? tags : ['tech'];
}

function hashId(value: string): string {
  return Buffer.from(value).toString('base64url').slice(0, 12);
}
