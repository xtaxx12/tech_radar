import { fetchWithTimeout } from '../lib/fetch-with-timeout.js';
import { normalizeText } from '../lib/text.js';
import type { SourceFetchResult, TechEvent } from '../types.js';

type GdgApiEvent = {
  id?: number | string;
  title?: string;
  description_short?: string;
  description?: string;
  start_date?: string;
  date?: string;
  city?: string;
  country?: string;
  url?: string;
  relative_url?: string;
  tags?: string[];
  chapter?: {
    city?: string;
    country?: string;
    country_name?: string;
    title?: string;
  };
};

const GDG_SEARCH_ENDPOINT = 'https://gdg.community.dev/api/search/?result_types=upcoming_event&country_code=Earth';

export async function fetchGDGEvents(): Promise<SourceFetchResult> {
  try {
    const response = await fetchWithTimeout(GDG_SEARCH_ENDPOINT, {
      method: 'GET',
      headers: {
        Accept: 'application/json, text/plain, */*'
      }
    });

    if (!response.ok) {
      return {
        source: 'gdg',
        events: [],
        usedFallback: false,
        error: `GDG status ${response.status}`
      };
    }

    const payload = (await response.json()) as unknown;
    const candidateEvents = extractEvents(payload);
    const mapped = candidateEvents.map((event) => mapGdgEvent(event)).filter(Boolean) as TechEvent[];

    return {
      source: 'gdg',
      events: mapped,
      usedFallback: false,
      error: mapped.length === 0 ? 'GDG devolvio 0 eventos transformables' : undefined
    };
  } catch (error) {
    return {
      source: 'gdg',
      events: [],
      usedFallback: false,
      error: error instanceof Error ? error.message : 'Error desconocido en GDG'
    };
  }
}

function extractEvents(payload: unknown): GdgApiEvent[] {
  if (Array.isArray(payload)) {
    return payload as GdgApiEvent[];
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;

    if (Array.isArray(record.events)) {
      return record.events as GdgApiEvent[];
    }

    if (Array.isArray(record.results)) {
      return record.results as GdgApiEvent[];
    }
  }

  return [];
}

function mapGdgEvent(event: GdgApiEvent): TechEvent | null {
  const title = event.title?.trim();
  const url = event.url?.trim() || (event.relative_url?.trim() ? `https://gdg.community.dev${event.relative_url}` : 'https://gdg.community.dev/');

  if (!title) {
    return null;
  }

  const country = event.country?.trim() || event.chapter?.country?.trim() || event.chapter?.country_name?.trim() || 'Latam';
  const city = event.city?.trim() || event.chapter?.city?.trim() || event.chapter?.title?.trim() || 'Comunidad GDG';
  const nowIso = new Date().toISOString();
  const description = event.description_short?.trim() || event.description?.trim() || 'Evento de comunidad GDG.';

  return {
    id: `gdg-${event.id ?? hashId(`${title}-${url}`)}`,
    title,
    description,
    date: event.start_date || event.date || nowIso,
    country,
    city,
    source: 'gdg',
    url,
    link: url,
    tags: normalizeTags(event.tags, `${title} ${description}`),
    level: 'all',
    summary: '',
    createdAt: nowIso,
    updatedAt: nowIso,
    raw: event
  };
}

function normalizeTags(inputTags: string[] | undefined, fallbackText: string): string[] {
  if (inputTags && inputTags.length > 0) {
    return inputTags.map((tag) => normalizeText(tag)).filter(Boolean).slice(0, 6);
  }

  const text = normalizeText(fallbackText);
  const tags: string[] = [];

  if (text.includes('ai') || text.includes('ia')) tags.push('ia');
  if (text.includes('web')) tags.push('web');
  if (text.includes('front')) tags.push('frontend');
  if (text.includes('back')) tags.push('backend');
  if (text.includes('data')) tags.push('data');

  return tags.length > 0 ? tags : ['tech'];
}

function hashId(value: string): string {
  return Buffer.from(value).toString('base64url').slice(0, 12);
}
