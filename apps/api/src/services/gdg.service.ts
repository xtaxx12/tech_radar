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

type ChapterRef = {
  id: number;
  title: string;
  city: string;
  country: string;
  relativeUrl: string;
};

const GDG_BASE = 'https://gdg.community.dev';
const GDG_EVENT_ENDPOINT = `${GDG_BASE}/api/event/`;
const GDG_SEARCH_ENDPOINT = `${GDG_BASE}/api/search/`;
const PAGE_SIZE = 500;
const MAX_PAGES = 2;
const CHAPTER_DISCOVERY_TTL_MS = 24 * 60 * 60 * 1000;
const CHAPTER_FETCH_CONCURRENCY = 8;
// Chapters pequeños (Cuenca, Machala, etc.) pueden no tener nada próximo.
// Traemos los N más recientes para que aparezca la actividad del chapter
// incluso si el último evento fue hace varios meses. El ranking por fecha
// penaliza los viejos automáticamente.
const CHAPTER_EVENT_LIMIT = 6;
// Corte duro: no mostramos eventos más viejos que esto para evitar ruido
// de archivos de 2022/2023 en chapters poco activos.
const CHAPTER_MAX_AGE_DAYS = 365;

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

// Queries usadas para descubrir chapters via /api/search/ porque el endpoint
// ignora filtros por país. Con varias búsquedas paralelas cubrimos LATAM.
const CHAPTER_DISCOVERY_QUERIES = [
  'argentina', 'bolivia', 'brasil', 'chile', 'colombia', 'costa rica',
  'cuba', 'republica dominicana', 'ecuador', 'el salvador', 'guatemala',
  'honduras', 'mexico', 'nicaragua', 'panama', 'paraguay', 'peru',
  'puerto rico', 'uruguay', 'venezuela', 'gdg on campus', 'gdg cloud'
];

let chapterCache: ChapterRef[] | null = null;
let chapterCacheAt = 0;

export async function fetchGDGEvents(): Promise<SourceFetchResult> {
  const sinceIso = new Date().toISOString().slice(0, 10);
  const collected = new Map<string, GdgApiEvent>();
  let lastError: string | undefined;

  try {
    await collectFromPagination(sinceIso, collected);
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
  }

  try {
    await collectFromLatamChapters(sinceIso, collected);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('[gdg] chapter-targeted fetch failed:', message);
    lastError = lastError ?? message;
  }

  const latamEvents = [...collected.values()].filter(isLatamEvent);
  const mapped = latamEvents
    .map((event) => mapGdgEvent(event))
    .filter((event): event is TechEvent => event !== null);

  if (mapped.length === 0) {
    return {
      source: 'gdg',
      events: [],
      usedFallback: false,
      error: lastError ?? 'GDG devolvió 0 eventos LATAM'
    };
  }

  return {
    source: 'gdg',
    events: mapped,
    usedFallback: false,
    error: lastError
  };
}

async function collectFromPagination(sinceIso: string, out: Map<string, GdgApiEvent>): Promise<void> {
  let nextPage: string | null = buildPaginatedUrl(sinceIso, 1);
  let pagesFetched = 0;

  while (nextPage && pagesFetched < MAX_PAGES) {
    const response = await fetchWithTimeout(nextPage, {
      method: 'GET',
      headers: { Accept: 'application/json, text/plain, */*' }
    });

    if (!response.ok) {
      throw new Error(`GDG status ${response.status}`);
    }

    const payload = (await response.json()) as {
      results?: GdgApiEvent[];
      links?: { next?: string | null };
    };

    for (const event of payload.results ?? []) {
      const id = event.id?.toString();
      if (id && !out.has(id)) {
        out.set(id, event);
      }
    }

    pagesFetched += 1;
    if (!payload.links?.next) break;
    if (!hasMoreLatamPotential(payload.results ?? [])) break;
    nextPage = payload.links.next;
  }
}

async function collectFromLatamChapters(_sinceIso: string, out: Map<string, GdgApiEvent>): Promise<void> {
  const chapters = await getLatamChapters();
  if (chapters.length === 0) return;

  const seenChapterIds = new Set<number>();
  for (const event of out.values()) {
    const chapterId = event.chapter?.id;
    if (typeof chapterId === 'number') seenChapterIds.add(chapterId);
  }

  const pending = chapters.filter((chapter) => !seenChapterIds.has(chapter.id));
  const maxAgeMs = Date.now() - CHAPTER_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

  await runInBatches(pending, CHAPTER_FETCH_CONCURRENCY, async (chapter) => {
    try {
      const url = `${GDG_EVENT_ENDPOINT}?chapter=${chapter.id}&status=Published&ordering=-start_date&limit=${CHAPTER_EVENT_LIMIT}`;
      const response = await fetchWithTimeout(url, {
        headers: { Accept: 'application/json, text/plain, */*' }
      });
      if (!response.ok) return;
      const payload = (await response.json()) as { results?: GdgApiEvent[] };
      for (const event of payload.results ?? []) {
        const id = event.id?.toString();
        if (!id) continue;

        // Filtrado duro por edad para evitar arrastrar archivos de 2022/2023.
        const startMs = event.start_date ? new Date(event.start_date).getTime() : NaN;
        if (!Number.isFinite(startMs) || startMs < maxAgeMs) continue;

        // El endpoint filtra por chapter server-side pero elimina chapter.id
        // de la respuesta. Re-hidratamos con la info del cache.
        const hydrated: GdgApiEvent = {
          ...event,
          chapter: {
            id: chapter.id,
            title: chapter.title,
            city: chapter.city,
            country: chapter.country,
            relative_url: chapter.relativeUrl
          }
        };

        if (!out.has(id)) out.set(id, hydrated);
      }
    } catch (error) {
      console.warn(`[gdg] chapter ${chapter.id} (${chapter.title}) fetch failed:`, error instanceof Error ? error.message : error);
    }
  });
}

async function getLatamChapters(): Promise<ChapterRef[]> {
  if (chapterCache && Date.now() - chapterCacheAt < CHAPTER_DISCOVERY_TTL_MS) {
    return chapterCache;
  }

  const unique = new Map<string, { title: string; city: string; country: string; relativeUrl: string }>();

  await runInBatches(CHAPTER_DISCOVERY_QUERIES, 4, async (query) => {
    const url = `${GDG_SEARCH_ENDPOINT}?result_types=chapter&q=${encodeURIComponent(query)}`;
    try {
      const response = await fetchWithTimeout(url, {
        headers: { Accept: 'application/json, text/plain, */*' }
      });
      if (!response.ok) return;
      const payload = (await response.json()) as { results?: Array<{ title?: string; city?: string; country?: string; relative_url?: string }> };
      for (const entry of payload.results ?? []) {
        const country = (entry.country ?? '').toUpperCase();
        if (!(country in LATAM_CODES)) continue;
        const slug = entry.relative_url?.trim();
        if (!slug || unique.has(slug)) continue;
        unique.set(slug, {
          title: entry.title ?? slug,
          city: entry.city ?? '',
          country,
          relativeUrl: slug
        });
      }
    } catch (error) {
      console.warn(`[gdg] chapter search "${query}" failed:`, error instanceof Error ? error.message : error);
    }
  });

  const resolved: ChapterRef[] = [];
  await runInBatches([...unique.values()], 6, async (info) => {
    const id = await resolveChapterId(info.relativeUrl);
    if (id !== null) {
      resolved.push({ id, ...info });
    }
  });

  chapterCache = resolved;
  chapterCacheAt = Date.now();
  console.log(`[gdg] chapter cache ready: ${resolved.length} LATAM chapters`);
  return resolved;
}

async function resolveChapterId(relativeUrl: string): Promise<number | null> {
  try {
    const response = await fetchWithTimeout(`${GDG_BASE}${relativeUrl}`, {
      headers: { Accept: 'text/html,*/*' }
    });
    if (!response.ok) return null;
    const html = await response.text();
    const match = html.match(/"chapterId"\s*:\s*(\d+)/) ?? html.match(/"chapter_id"\s*:\s*(\d+)/);
    if (!match) return null;
    const id = Number(match[1]);
    return Number.isFinite(id) ? id : null;
  } catch {
    return null;
  }
}

async function runInBatches<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    await Promise.all(batch.map((item) => worker(item)));
  }
}

function buildPaginatedUrl(sinceIso: string, page: number): string {
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
    || (event.chapter?.relative_url ? `${GDG_BASE}${event.chapter.relative_url}` : `${GDG_BASE}/`);

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
