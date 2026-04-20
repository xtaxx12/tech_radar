import { fetchWithTimeout } from '../lib/fetch-with-timeout.js';
import { normalizeText } from '../lib/text.js';
import type { SourceFetchResult, TechEvent } from '../types.js';

type GdgChapter = {
  id?: number | string;
  title?: string;
  city?: string;
  state?: string;
  country?: string;
  country_name?: string;
  chapter_location?: string;
  relative_url?: string;
};

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
  status?: string;
  is_hidden?: boolean;
  tags?: string[];
  chapter?: GdgChapter;
};

const GDG_EVENT_ENDPOINT = 'https://gdg.community.dev/api/event/';
const PAGE_SIZE = 500;
const MAX_PAGES = 2;

const LATAM_CODES: Record<string, string> = {
  AR: 'Argentina',
  BO: 'Bolivia',
  BR: 'Brasil',
  CL: 'Chile',
  CO: 'Colombia',
  CR: 'Costa Rica',
  CU: 'Cuba',
  DO: 'República Dominicana',
  EC: 'Ecuador',
  SV: 'El Salvador',
  GT: 'Guatemala',
  HN: 'Honduras',
  MX: 'México',
  NI: 'Nicaragua',
  PA: 'Panamá',
  PY: 'Paraguay',
  PE: 'Perú',
  PR: 'Puerto Rico',
  UY: 'Uruguay',
  VE: 'Venezuela'
};

export async function fetchGDGEvents(): Promise<SourceFetchResult> {
  const sinceIso = new Date().toISOString().slice(0, 10);
  const collected: GdgApiEvent[] = [];
  let nextPage: string | null = buildUrl(sinceIso, 1);
  let pagesFetched = 0;
  let lastError: string | undefined;

  try {
    while (nextPage && pagesFetched < MAX_PAGES) {
      const response = await fetchWithTimeout(nextPage, {
        method: 'GET',
        headers: { Accept: 'application/json, text/plain, */*' }
      });

      if (!response.ok) {
        lastError = `GDG status ${response.status}`;
        break;
      }

      const payload = (await response.json()) as {
        results?: GdgApiEvent[];
        links?: { next?: string | null };
      };

      const results = payload.results ?? [];
      collected.push(...results);
      pagesFetched += 1;

      if (!payload.links?.next) break;
      if (!hasMoreLatamPotential(results)) break;
      nextPage = payload.links.next;
    }
  } catch (error) {
    lastError = error instanceof Error ? error.message : 'Error desconocido en GDG';
  }

  const latamEvents = collected.filter(isLatamEvent);
  const mapped = latamEvents
    .map((event) => mapGdgEvent(event))
    .filter((event): event is TechEvent => event !== null);

  if (mapped.length === 0) {
    return {
      source: 'gdg',
      events: [],
      usedFallback: false,
      error: lastError ?? `GDG devolvio 0 eventos LATAM en ${pagesFetched} paginas`
    };
  }

  return {
    source: 'gdg',
    events: mapped,
    usedFallback: false,
    error: lastError
  };
}

function buildUrl(sinceIso: string, page: number): string {
  const params = new URLSearchParams({
    status: 'Published',
    ordering: 'start_date',
    start_date__gte: sinceIso,
    limit: String(PAGE_SIZE),
    page: String(page)
  });
  return `${GDG_EVENT_ENDPOINT}?${params.toString()}`;
}

function hasMoreLatamPotential(results: GdgApiEvent[]): boolean {
  if (results.length === 0) return false;
  const latest = results[results.length - 1];
  const date = latest.start_date?.slice(0, 10);
  if (!date) return true;
  const yearsAhead = (new Date(date).getTime() - Date.now()) / (365 * 24 * 60 * 60 * 1000);
  return yearsAhead < 2;
}

function isLatamEvent(event: GdgApiEvent): boolean {
  if (event.is_hidden) return false;
  if (event.status && event.status !== 'Published') return false;
  const code = (event.chapter?.country ?? '').toUpperCase();
  return Boolean(code && code in LATAM_CODES);
}

function mapGdgEvent(event: GdgApiEvent): TechEvent | null {
  const title = event.title?.trim();
  const url = event.url?.trim()
    || (event.chapter?.relative_url ? `https://gdg.community.dev${event.chapter.relative_url}` : 'https://gdg.community.dev/');

  if (!title || !event.start_date) return null;

  const code = (event.chapter?.country ?? '').toUpperCase();
  const country = LATAM_CODES[code] ?? event.chapter?.country_name?.trim() ?? 'Latam';
  const city = event.chapter?.city?.trim() || event.chapter?.title?.trim() || 'Comunidad GDG';
  const nowIso = new Date().toISOString();
  const description = event.description_short?.trim() || event.description?.trim() || `Evento de ${event.chapter?.title ?? 'comunidad GDG'}.`;

  return {
    id: `gdg-${event.id ?? hashId(`${title}-${url}`)}`,
    title,
    description,
    date: event.start_date,
    country,
    city,
    source: 'gdg',
    url,
    link: url,
    tags: normalizeTags(event.tags, `${title} ${description} ${event.chapter?.title ?? ''}`),
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

  if (text.includes('ai') || text.includes('ia') || text.includes('llm') || text.includes('gemini')) tags.push('ia');
  if (text.includes('web')) tags.push('web');
  if (text.includes('front')) tags.push('frontend');
  if (text.includes('back') || text.includes('api') || text.includes('cloud run')) tags.push('backend');
  if (text.includes('data') || text.includes('bigquery') || text.includes('analytics')) tags.push('data');
  if (text.includes('android') || text.includes('flutter') || text.includes('mobile')) tags.push('mobile');
  if (text.includes('cloud') || text.includes('gcp') || text.includes('devops')) tags.push('cloud');

  return tags.length > 0 ? tags : ['tech'];
}

function hashId(value: string): string {
  return Buffer.from(value).toString('base64url').slice(0, 12);
}
