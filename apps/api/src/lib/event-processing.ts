import { generateText } from './ai.js';
import { normalizeText } from './text.js';
import type { Level, TechEvent } from '../types.js';

export function cleanEvents(events: TechEvent[]): TechEvent[] {
  return events
    .map((event) => {
      const title = event.title.trim();
      const description = event.description.trim();
      const city = event.city.trim() || 'Latam';
      const country = event.country.trim() || 'Latam';
      const date = toIsoDate(event.date);
      const url = event.url.trim();

      if (!title || !url || Number.isNaN(new Date(date).getTime())) {
        return null;
      }

      return {
        ...event,
        title,
        description,
        city,
        country,
        date,
        url,
        link: event.link?.trim() || url,
        tags: normalizeTags(event.tags),
        level: normalizeLevel(event.level),
        summary: event.summary?.trim() || '',
        updatedAt: new Date().toISOString(),
        createdAt: event.createdAt || new Date().toISOString()
      };
    })
    .filter(Boolean) as TechEvent[];
}

export function dedupeEvents(events: TechEvent[]): TechEvent[] {
  const map = new Map<string, TechEvent>();

  for (const event of events) {
    const key = dedupeKey(event);
    const existing = map.get(key);

    if (!existing) {
      map.set(key, event);
      continue;
    }

    // Prefer the event with richer description and more tags.
    const preferred = scoreEventQuality(event) >= scoreEventQuality(existing) ? event : existing;
    map.set(key, preferred);
  }

  return [...map.values()];
}

export async function enrichEventsWithAI(events: TechEvent[]): Promise<TechEvent[]> {
  const enriched: TechEvent[] = [];

  for (const event of events) {
    const inferred = inferFromHeuristics(event);

    const ai = await classifyWithAI(event).catch(() => null);
    const tags = ai?.tags?.length ? normalizeTags(ai.tags) : inferred.tags;
    const level = ai?.level ?? inferred.level;
    const summary = ai?.summary?.trim() || inferred.summary;

    enriched.push({
      ...event,
      tags,
      level,
      summary,
      updatedAt: new Date().toISOString()
    });
  }

  return enriched;
}

type AiClassification = {
  level: Level;
  tags: string[];
  summary: string;
};

async function classifyWithAI(event: TechEvent): Promise<AiClassification | null> {
  const prompt = [
    'Clasifica este evento tech y responde SOLO JSON valido.',
    'Esquema: {"level":"junior|mid|senior|all","tags":["..."],"summary":"..."}',
    `Titulo: ${event.title}`,
    `Descripcion: ${event.description}`,
    `Fuente: ${event.source}`,
    `Pais: ${event.country}`,
    `Ciudad: ${event.city}`
  ].join('\n');

  const raw = await generateText(prompt);
  const parsed = parseJsonObject(raw);

  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const record = parsed as Record<string, unknown>;
  const level = normalizeLevel(String(record.level ?? 'all'));
  const tags = Array.isArray(record.tags) ? record.tags.map((tag) => String(tag)) : [];
  const summary = String(record.summary ?? '').trim();

  return {
    level,
    tags,
    summary
  };
}

function inferFromHeuristics(event: TechEvent): AiClassification {
  const text = normalizeText(`${event.title} ${event.description} ${event.tags.join(' ')}`);
  const tags = normalizeTags([
    ...(text.includes('ia') || text.includes('ai') ? ['ia'] : []),
    ...(text.includes('frontend') || text.includes('front') ? ['frontend'] : []),
    ...(text.includes('backend') || text.includes('api') ? ['backend'] : []),
    ...(text.includes('data') || text.includes('analytics') ? ['data'] : []),
    ...(text.includes('mobile') ? ['mobile'] : []),
    ...(text.includes('web') ? ['web'] : [])
  ]);

  let level: Level = 'all';
  if (text.includes('senior') || text.includes('advanced')) level = 'senior';
  else if (text.includes('junior') || text.includes('beginner')) level = 'junior';
  else if (text.includes('intermediate') || text.includes('mid')) level = 'mid';

  const summary = `${event.title}: evento sobre ${tags.slice(0, 3).join(', ') || 'tecnología'} en ${event.city}, ${event.country}.`;

  return {
    level,
    tags: tags.length > 0 ? tags : ['tech'],
    summary
  };
}

function parseJsonObject(input: string): unknown {
  const trimmed = input.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;

    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const tag of tags) {
    const clean = normalizeText(tag);
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    normalized.push(clean);
  }

  return normalized.slice(0, 8);
}

function normalizeLevel(level: string): Level {
  const normalized = normalizeText(level);
  if (normalized === 'junior') return 'junior';
  if (normalized === 'mid' || normalized === 'intermediate') return 'mid';
  if (normalized === 'senior') return 'senior';
  return 'all';
}

function toIsoDate(value: string): string {
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) return date.toISOString();
  return new Date().toISOString();
}

function dedupeKey(event: TechEvent): string {
  const dateKey = event.date.slice(0, 10);
  return [
    normalizeText(event.title),
    normalizeText(event.city),
    normalizeText(event.country),
    dateKey
  ].join('|');
}

function scoreEventQuality(event: TechEvent): number {
  return event.description.length + event.tags.length * 20 + (event.summary?.length ?? 0);
}
