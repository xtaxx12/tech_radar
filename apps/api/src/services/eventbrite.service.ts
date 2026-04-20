import { eventbriteFallbackEvents } from '../data/fallback-events.js';
import { fetchWithTimeout } from '../lib/fetch-with-timeout.js';
import { normalizeText } from '../lib/text.js';
import type { SourceFetchResult, TechEvent } from '../types.js';

const EVENTBRITE_SEARCH_PAGE = 'https://www.eventbrite.com/d/online/technology--events/';

type EventbriteEvent = {
  id?: string;
  name?: string;
  description?: string;
  url?: string;
  start?: { local?: string; utc?: string };
  location?: { name?: string };
  image?: string;
  image_url?: string;
  eventAttendanceMode?: string;
};

export async function fetchEventbriteEvents(): Promise<SourceFetchResult> {
  try {
    const response = await fetchWithTimeout(EVENTBRITE_SEARCH_PAGE, {
      method: 'GET',
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    if (!response.ok) {
      throw new Error(`Eventbrite status ${response.status}`);
    }

    const html = await response.text();
    const mapped = extractEventbriteEvents(html).map((event) => mapEventbriteEvent(event)).filter(Boolean) as TechEvent[];

    if (mapped.length === 0) {
      return {
        source: 'eventbrite',
        events: eventbriteFallbackEvents,
        usedFallback: true,
        error: 'Eventbrite devolvio 0 eventos transformables desde la pagina publica'
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

function extractEventbriteEvents(html: string): EventbriteEvent[] {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((match) => match[1]);
  const events: EventbriteEvent[] = [];

  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block) as unknown;
      const itemList = Array.isArray(parsed) ? parsed : [parsed];

      for (const entry of itemList) {
        const record = entry as { itemListElement?: Array<{ item?: { name?: string; description?: string; url?: string; startDate?: string; location?: { name?: string } } }> };
        const elements = record?.itemListElement ?? [];
        for (const element of elements) {
          const item = element?.item;
          if (!item?.name || !item?.url) {
            continue;
          }

          events.push({
            id: item.url.split('-tickets-').pop(),
            name: item.name,
            description: item.description,
            url: item.url,
            start: { local: item.startDate },
            location: item.location
          });
        }
      }
    } catch {
      continue;
    }
  }

  return events;
}

function mapEventbriteEvent(event: EventbriteEvent): TechEvent | null {
  const title = event.name?.trim();
  const url = event.url?.trim();

  if (!title || !url) {
    return null;
  }

  const nowIso = new Date().toISOString();
  const description = event.description?.trim() || 'Evento publicado en Eventbrite.';

  return {
    id: `eventbrite-${event.id ?? hashId(url)}`,
    title,
    description,
    date: event.start?.local || event.start?.utc || nowIso,
    country: 'Latam',
    city: event.location?.name?.trim() || 'Latam',
    source: 'eventbrite',
    url,
    link: url,
    tags: deriveTags(`${title} ${description}`),
    level: 'all',
    summary: '',
    createdAt: nowIso,
    updatedAt: nowIso,
    raw: event
  };
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
