import cors from 'cors';
import { Router, type Request, type RequestHandler, type Response, type NextFunction } from 'express';
import { requireApiKey } from '../middleware/api-key.middleware.js';
import { eventRepository } from '../repositories/event.repository.js';
import { normalizeText } from '../lib/text.js';
import type { TechEvent } from '../types.js';

// CORS abierto: el punto de la API pública es que comunidades embeban desde
// cualquier dominio. La auth se hace por API key (header), no por origen.
const publicCors = cors({
  origin: '*',
  methods: ['GET'],
  allowedHeaders: ['Authorization', 'X-API-Key', 'Content-Type'],
  credentials: false
});

function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function toPublicEvent(event: TechEvent) {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    date: event.date,
    country: event.country,
    city: event.city,
    source: event.source,
    url: event.url,
    link: event.link ?? null,
    tags: event.tags,
    level: event.level,
    summary: event.summary,
    trending: event.trending ?? false
  };
}

function parseLimit(raw: unknown, defaultValue = 20): number {
  const parsed = Number(raw ?? defaultValue);
  if (!Number.isFinite(parsed) || parsed <= 0) return defaultValue;
  return Math.min(100, Math.max(1, Math.floor(parsed)));
}

function parseOffset(raw: unknown): number {
  const parsed = Number(raw ?? 0);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.floor(parsed);
}

function filterEvents(events: TechEvent[], query: Record<string, unknown>): TechEvent[] {
  const country = normalizeText(String(query.country ?? ''));
  const city = normalizeText(String(query.city ?? ''));
  const source = normalizeText(String(query.source ?? ''));
  const tag = normalizeText(String(query.tag ?? ''));
  const rawQ = typeof query.q === 'string' ? query.q.trim() : '';
  const tokens = rawQ
    ? rawQ.split(/\s+/).map((token) => normalizeText(token)).filter((token) => token.length >= 2)
    : [];
  const upcomingOnly = String(query.upcoming ?? '').toLowerCase() === 'true';
  const now = new Date();

  return events.filter((event) => {
    if (country && normalizeText(event.country) !== country) return false;
    if (city && normalizeText(event.city) !== city) return false;
    if (source && normalizeText(event.source) !== source) return false;
    if (tag && !event.tags.map(normalizeText).includes(tag)) return false;
    if (upcomingOnly && new Date(event.date) < now) return false;

    if (tokens.length > 0) {
      const haystack = normalizeText(
        [event.title, event.description, event.summary, event.city, event.country, (event.tags ?? []).join(' ')].join(' ')
      );
      if (!tokens.every((token) => haystack.includes(token))) return false;
    }

    return true;
  });
}

export function buildPublicApiRouter(): Router {
  const router = Router();

  router.use(publicCors);
  router.options('*', publicCors);
  router.use(requireApiKey);

  router.get('/events', asyncHandler(async (request, response) => {
    const allEvents = await eventRepository.getAll();
    const filtered = filterEvents(allEvents, request.query);
    const sorted = [...filtered].sort((a, b) => a.date.localeCompare(b.date));

    const limit = parseLimit(request.query.limit);
    const offset = parseOffset(request.query.offset);
    const page = sorted.slice(offset, offset + limit);

    response.json({
      total: sorted.length,
      limit,
      offset,
      events: page.map(toPublicEvent)
    });
  }));

  router.get('/events/:id', asyncHandler(async (request, response) => {
    const event = await eventRepository.getById(request.params.id);
    if (!event) {
      response.status(404).json({ error: 'event_not_found' });
      return;
    }
    response.json({ event: toPublicEvent(event) });
  }));

  router.get('/countries', asyncHandler(async (_request, response) => {
    const all = await eventRepository.getAll();
    const counts = new Map<string, number>();
    for (const event of all) {
      const country = event.country?.trim();
      if (!country) continue;
      counts.set(country, (counts.get(country) ?? 0) + 1);
    }
    const countries = [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    response.json({ countries });
  }));

  router.get('/sources', (_request, response) => {
    response.json({
      sources: [
        { id: 'meetup', label: 'Meetup' },
        { id: 'eventbrite', label: 'Eventbrite' },
        { id: 'gdg', label: 'GDG' },
        { id: 'community', label: 'Community' }
      ]
    });
  });

  return router;
}
