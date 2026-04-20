import cors from 'cors';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import { buildRecommendationContext, enrichEvent, filterByInterpretation, generateChatAnswer, parseChatInterpretation, rankEvents } from './lib/ranking.js';
import { normalizeText } from './lib/text.js';
import { eventRepository } from './repositories/event.repository.js';
import { getLastSyncResult, isSyncRunning, syncEvents } from './services/sync.service.js';
import type { TechEvent, UserProfile } from './types.js';

dotenv.config();

const app = express();
const port = parsePort(process.env.PORT, 4000);
const corsOrigin = process.env.CORS_ORIGIN?.trim() || 'http://localhost:5173';
const syncIntervalMinutes = parsePositiveNumber(process.env.SYNC_INTERVAL_MINUTES, 60);

app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '256kb' }));

app.get('/health', (_request, response) => {
	response.json({ ok: true, service: 'tech-radar-api', timestamp: new Date().toISOString() });
});

app.get('/profile-options', (_request, response) => {
	response.json({
		countries: ['Ecuador', 'México', 'Perú', 'Colombia', 'Chile', 'Argentina', 'Brasil', 'Costa Rica'],
		roles: ['frontend', 'backend', 'fullstack', 'data', 'design', 'founder', 'mobile', 'devops', 'product'],
		levels: ['junior', 'mid', 'senior'],
		interests: ['ia', 'web', 'mobile', 'blockchain', 'cloud', 'data', 'ux', 'product', 'performance']
	});
});

app.get('/events', asyncHandler(async (request, response) => {
	const profile = readProfile(request.query);
	const allEvents = await ensureEventsLoaded();
	const filtered = applyQueryFilters(allEvents, request.query);
	const ranked = rankEvents(filtered, profile, filtered.length);

	response.json({
		profile,
		context: buildRecommendationContext(profile, ranked),
		recommendations: ranked.slice(0, 6),
		events: ranked,
		total: ranked.length
	});
}));

app.get('/events/recommended', asyncHandler(async (request, response) => {
	const profile = readProfile(request.query);
	const limit = clampLimit(request.query.limit, 10);
	const allEvents = await ensureEventsLoaded();
	const filtered = applyQueryFilters(allEvents, request.query);
	const ranked = rankEvents(filtered, profile, limit);

	response.json({
		profile,
		context: buildRecommendationContext(profile, ranked),
		recommendations: ranked,
		events: ranked,
		total: ranked.length
	});
}));

app.get('/events/:id', asyncHandler(async (request, response) => {
	const profile = readProfile(request.query);
	const event = await eventRepository.getById(request.params.id);

	if (!event) {
		response.status(404).json({ error: 'Event not found' });
		return;
	}

	response.json({ event: enrichEvent(event, profile) });
}));

app.post('/sync', asyncHandler(async (_request, response) => {
	const result = await syncEvents();
	response.json({ ok: true, result });
}));

app.get('/sync/status', (_request, response) => {
	response.json({
		running: isSyncRunning(),
		lastResult: getLastSyncResult()
	});
});

app.post('/chat', asyncHandler(async (request, response) => {
	const message = String(request.body?.message ?? '').slice(0, 2000);
	const fallbackProfile = parseProfile(request.body?.profile ?? {});
	const interpretation = parseChatInterpretation(message);
	const mergedInterpretation = {
		...interpretation,
		country: interpretation.country ?? fallbackProfile.country,
		role: interpretation.role ?? fallbackProfile.role,
		level: interpretation.level ?? fallbackProfile.level,
		interests: interpretation.interests.length > 0 ? interpretation.interests : fallbackProfile.interests
	};

	const allEvents = await ensureEventsLoaded();
	const filtered = filterByInterpretation(allEvents, mergedInterpretation);
	const ranked = rankEvents(filtered.length > 0 ? filtered : allEvents, fallbackProfile, 8);
	const answer = await generateChatAnswer(message, ranked, mergedInterpretation);

	response.json({
		interpretation: mergedInterpretation,
		answer,
		events: ranked,
		context: buildRecommendationContext(fallbackProfile, ranked)
	});
}));

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
	const message = err instanceof Error ? err.message : 'Unknown error';
	console.error('[api] unhandled error:', message);
	if (res.headersSent) return;
	res.status(500).json({ error: 'internal_server_error' });
});

void bootstrap();

async function bootstrap() {
	await eventRepository.init();

	syncEvents().catch((error) => {
		console.error('[api] initial sync failed:', error instanceof Error ? error.message : error);
	});

	if (syncIntervalMinutes > 0) {
		setInterval(() => {
			syncEvents().catch((error) => {
				console.error('[api] scheduled sync failed:', error instanceof Error ? error.message : error);
			});
		}, syncIntervalMinutes * 60 * 1000);
	}

	app.listen(port, () => {
		console.log(`Tech Radar LATAM API running on http://localhost:${port}`);
	});
}

function asyncHandler(handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
	return (req, res, next) => {
		Promise.resolve(handler(req, res, next)).catch(next);
	};
}

function parseProfile(value: unknown): UserProfile {
	const input = typeof value === 'object' && value !== null ? value as Partial<UserProfile> : {};

	return {
		country: normalizeCountry(input.country),
		role: normalizeRole(input.role),
		level: normalizeLevel(input.level),
		interests: normalizeInterests(input.interests)
	};
}

function readProfile(query: Record<string, unknown>): UserProfile {
	return parseProfile({
		country: query.country,
		role: query.role,
		level: query.level,
		interests: typeof query.interests === 'string' ? query.interests.split(',') : []
	});
}

function normalizeCountry(value: unknown): string {
	const text = String(value ?? '').trim();
	return text || 'Ecuador';
}

function normalizeRole(value: unknown): UserProfile['role'] {
	const role = String(value ?? '').toLowerCase().trim();
	return (['frontend', 'backend', 'fullstack', 'data', 'design', 'founder', 'mobile', 'devops', 'product'] as const).includes(role as UserProfile['role'])
		? role as UserProfile['role']
		: 'frontend';
}

function normalizeLevel(value: unknown): UserProfile['level'] {
	const level = String(value ?? '').toLowerCase().trim();
	return (['junior', 'mid', 'senior'] as const).includes(level as UserProfile['level'])
		? level as UserProfile['level']
		: 'mid';
}

function normalizeInterests(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value.map((item) => String(item).toLowerCase().trim()).filter(Boolean);
	}

	if (typeof value === 'string') {
		return value.split(',').map((item) => item.toLowerCase().trim()).filter(Boolean);
	}

	return ['ia', 'web'];
}

async function ensureEventsLoaded(): Promise<TechEvent[]> {
	let events = await eventRepository.getAll();
	if (events.length > 0) {
		return events;
	}

	await syncEvents();
	events = await eventRepository.getAll();
	return events;
}

function applyQueryFilters(events: TechEvent[], query: Record<string, unknown>): TechEvent[] {
	const source = normalizeText(String(query.source ?? ''));
	const country = normalizeText(String(query.countryFilter ?? ''));
	const city = normalizeText(String(query.city ?? ''));

	return events.filter((event) => {
		const sourceOk = source ? normalizeText(event.source) === source : true;
		const countryOk = country ? normalizeText(event.country) === country : true;
		const cityOk = city ? normalizeText(event.city) === city : true;
		return sourceOk && countryOk && cityOk;
	});
}

function clampLimit(value: unknown, fallback: number): number {
	const parsed = Number(value ?? fallback);
	if (!Number.isFinite(parsed)) return fallback;
	return Math.max(1, Math.min(50, parsed));
}

function parsePort(value: string | undefined, fallback: number): number {
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 65535) {
		if (value && value.trim()) {
			console.warn(`[api] PORT="${value}" inválido, usando ${fallback}`);
		}
		return fallback;
	}
	return Math.floor(parsed);
}

function parsePositiveNumber(value: string | undefined, fallback: number): number {
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed < 0) return fallback;
	return parsed;
}
