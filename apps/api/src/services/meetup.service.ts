import { meetupFallbackEvents } from '../data/fallback-events.js';
import { normalizeText } from '../lib/text.js';
import type { SourceFetchResult, TechEvent } from '../types.js';

const MEETUP_ENDPOINT = 'https://api.meetup.com/find/upcoming_events';

type MeetupApiEvent = {
  id?: string;
  name?: string;
  description?: string;
  local_date?: string;
  local_time?: string;
  link?: string;
  venue?: {
    city?: string;
    localized_country_name?: string;
  };
  group?: {
    name?: string;
    category?: { name?: string };
    city?: string;
    country?: string;
  };
};

export async function fetchMeetupEvents(): Promise<SourceFetchResult> {
  const apiKey = process.env.MEETUP_API_KEY?.trim();

  if (!apiKey) {
    return {
      source: 'meetup',
      events: meetupFallbackEvents,
      usedFallback: true,
      error: 'MEETUP_API_KEY no configurada'
    };
  }

  const url = new URL(MEETUP_ENDPOINT);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('page', '30');
  url.searchParams.set('text', 'technology OR software OR developers');
  url.searchParams.set('sign', 'true');
  url.searchParams.set('photo-host', 'public');

  try {
    const response = await fetch(url, { method: 'GET' });

    if (!response.ok) {
      throw new Error(`Meetup status ${response.status}`);
    }

    const data = (await response.json()) as { events?: MeetupApiEvent[] };
    const mapped = (data.events ?? []).map((event) => mapMeetupEvent(event)).filter(Boolean) as TechEvent[];

    if (mapped.length === 0) {
      return {
        source: 'meetup',
        events: meetupFallbackEvents,
        usedFallback: true,
        error: 'Meetup devolvio 0 eventos transformables'
      };
    }

    return {
      source: 'meetup',
      events: mapped,
      usedFallback: false
    };
  } catch (error) {
    return {
      source: 'meetup',
      events: meetupFallbackEvents,
      usedFallback: true,
      error: error instanceof Error ? error.message : 'Error desconocido en Meetup'
    };
  }
}

function mapMeetupEvent(event: MeetupApiEvent): TechEvent | null {
  const title = event.name?.trim();
  const url = event.link?.trim();
  const city = event.venue?.city?.trim() || event.group?.city?.trim() || 'Latam';
  const country = event.venue?.localized_country_name?.trim() || normalizeCountry(event.group?.country);

  if (!title || !url) {
    return null;
  }

  const date = buildDate(event.local_date, event.local_time);
  const nowIso = new Date().toISOString();

  return {
    id: `meetup-${event.id ?? hashId(url)}`,
    title,
    description: stripHtml(event.description) || `Evento publicado en Meetup por ${event.group?.name ?? 'comunidad tech'}.`,
    date,
    country,
    city,
    source: 'meetup',
    url,
    link: url,
    tags: deriveTags(`${title} ${event.description ?? ''} ${event.group?.category?.name ?? ''}`),
    level: 'all',
    summary: '',
    createdAt: nowIso,
    updatedAt: nowIso,
    raw: event
  };
}

function buildDate(localDate?: string, localTime?: string): string {
  if (!localDate) {
    return new Date().toISOString();
  }

  const time = localTime && localTime.length >= 5 ? `${localTime}:00` : '19:00:00';
  return `${localDate}T${time}`;
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

  if (text.includes('ai') || text.includes('ia') || text.includes('llm')) tags.push('ia');
  if (text.includes('front')) tags.push('frontend');
  if (text.includes('back')) tags.push('backend');
  if (text.includes('data')) tags.push('data');
  if (text.includes('cloud') || text.includes('devops')) tags.push('cloud');
  if (text.includes('mobile')) tags.push('mobile');
  if (text.includes('web')) tags.push('web');

  return tags.length > 0 ? tags : ['tech'];
}

function stripHtml(input?: string): string {
  return (input ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function hashId(value: string): string {
  return Buffer.from(value).toString('base64url').slice(0, 12);
}
