import { meetupFallbackEvents } from '../data/fallback-events.js';
import { normalizeText } from '../lib/text.js';
import type { SourceFetchResult, TechEvent } from '../types.js';

const MEETUP_SEARCH_PAGE = 'https://www.meetup.com/find/?keywords=technology';

type MeetupApiEvent = {
  id?: string;
  name?: string;
  title?: string;
  description?: string;
  local_date?: string;
  local_time?: string;
  link?: string;
  eventUrl?: string;
  venue?: {
    city?: string;
    localized_country_name?: string;
  };
  group?: {
    name?: string;
    category?: { name?: string };
    city?: string;
    country?: string;
    urlname?: string;
    __ref?: string;
  };
};

type MeetupApolloState = Record<string, unknown>;

export async function fetchMeetupEvents(): Promise<SourceFetchResult> {
  try {
    const buildId = await resolveBuildId();
    if (!buildId) {
      throw new Error('Meetup build id not found');
    }

    const dataUrl = new URL(`https://www.meetup.com/_next/data/${buildId}/find.json`);
    dataUrl.searchParams.set('keywords', 'technology');

    const response = await fetch(dataUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json, text/plain, */*'
      }
    });

    if (!response.ok) {
      throw new Error(`Meetup status ${response.status}`);
    }

    const data = (await response.json()) as { pageProps?: { __APOLLO_STATE__?: MeetupApolloState } };
    const apolloState = data.pageProps?.__APOLLO_STATE__;
    const mapped = extractMeetupEvents(apolloState).map((event) => mapMeetupEvent(event, apolloState)).filter(Boolean) as TechEvent[];

    if (mapped.length === 0) {
      return {
        source: 'meetup',
        events: meetupFallbackEvents,
        usedFallback: true,
        error: 'Meetup devolvio 0 eventos transformables desde la fuente publica'
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

function extractMeetupEvents(state?: MeetupApolloState): MeetupApiEvent[] {
  if (!state) {
    return [];
  }

  return Object.entries(state)
    .filter(([key, value]) => key.startsWith('Event:') && value && typeof value === 'object')
    .map(([, value]) => value as MeetupApiEvent)
    .filter((event) => Boolean(event.id || event.name || event.title || event.eventUrl));
}

function mapMeetupEvent(event: MeetupApiEvent, state?: MeetupApolloState): TechEvent | null {
  const title = (event.name ?? event.title)?.trim();
  const url = event.link?.trim() || event.eventUrl?.trim();
  const group = resolveGroup(event, state);
  const city = event.venue?.city?.trim() || group?.city?.trim() || inferCityFromUrl(url) || 'Latam';
  const country = event.venue?.localized_country_name?.trim() || normalizeCountry(event.group?.country || group?.country);

  if (!title || !url) {
    return null;
  }

  const date = buildDate(event.local_date, event.local_time);
  const nowIso = new Date().toISOString();
  const description = stripHtml(event.description) || `Evento publicado en Meetup por ${group?.name ?? event.group?.name ?? 'comunidad tech'}.`;

  return {
    id: `meetup-${event.id ?? hashId(url)}`,
    title,
    description,
    date,
    country,
    city,
    source: 'meetup',
    url,
    link: url,
    tags: deriveTags(`${title} ${description} ${group?.name ?? event.group?.name ?? ''}`),
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

async function resolveBuildId(): Promise<string | null> {
  try {
    const response = await fetch(MEETUP_SEARCH_PAGE, { method: 'GET' });
    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    const match = html.match(/\/_next\/static\/([a-f0-9]{40})\//i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function resolveGroup(event: MeetupApiEvent, state?: MeetupApolloState): { name?: string; city?: string; country?: string } | null {
  const ref = event.group?.__ref;
  if (!ref || !state) {
    return null;
  }

  const group = state[ref] as { name?: string; city?: string; country?: string } | undefined;
  if (!group) {
    return null;
  }

  return {
    name: group.name,
    city: group.city,
    country: group.country
  };
}

function inferCityFromUrl(url?: string): string | undefined {
  if (!url) {
    return undefined;
  }

  const path = new URL(url).pathname;
  const groupSlug = path.split('/events/')[0].split('/').filter(Boolean).pop();
  if (!groupSlug) {
    return undefined;
  }

  const words = groupSlug.split('-').filter(Boolean);
  if (words.length === 0) {
    return undefined;
  }

  const lastWord = words[words.length - 1].replace(/[^a-záéíóúñü]/gi, '');
  return lastWord ? capitalize(lastWord) : undefined;
}

function capitalize(value: string): string {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value;
}

function hashId(value: string): string {
  return Buffer.from(value).toString('base64url').slice(0, 12);
}
