import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import { closeDb } from './db/client.js';
import { runMigrations } from './db/migrate.js';
import {
	clearSessionCookie,
	exchangeGoogleCode,
	isAuthEnabled,
	setSessionCookie,
	signSession,
	verifyGoogleIdToken
} from './lib/auth.js';
import { eventBus } from './lib/event-bus.js';
import { buildRecommendationContext, enrichEvent, filterByInterpretation, generateChatAnswer, parseChatInterpretation, rankEvents } from './lib/ranking.js';
import { normalizeText } from './lib/text.js';
import { optionalAuth, requireAuth } from './middleware/auth.middleware.js';
import { createRateLimiter } from './middleware/rate-limit.middleware.js';
import { buildPublicApiRouter } from './routes/public-api.js';
import { renderDocsPage, publicApiSpec } from './routes/public-docs.js';
import { buildKeyRequestRouter } from './routes/key-request.js';
import { buildAdminMagicRouter } from './routes/admin-magic.js';
import { requireSyncAuth } from './middleware/sync-auth.middleware.js';
import { eventRepository } from './repositories/event.repository.js';
import { userEventRepository, type UserEventType } from './repositories/user-event.repository.js';
import { userRepository } from './repositories/user.repository.js';
import { getLastSyncResult, isSyncRunning, syncEvents } from './services/sync.service.js';
import type { TechEvent, UserProfile } from './types.js';

dotenv.config();

const app = express();
const port = parsePort(process.env.PORT, 4000);
const corsOrigin = process.env.CORS_ORIGIN?.trim() || 'http://localhost:5173';
const syncIntervalMinutes = parsePositiveNumber(process.env.SYNC_INTERVAL_MINUTES, 60);

app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: '256kb' }));
app.use(cookieParser());
app.use(optionalAuth);

// Rate limit específico para /chat: protege el presupuesto de IA cuando un
// token filtra o cuando alguien abusa del endpoint. Clave por userId cuando
// hay sesión, por IP si no.
// Nota: el limiter es in-memory, así que cada restart del servidor reinicia
// las cuentas. Para un deploy multi-instancia o con autoscaling habría que
// moverlo a Redis / Upstash o similar.
const chatRateLimiter = createRateLimiter({ perSecond: 1, perHour: 30 });

// Umbrales del cálculo dinámico de "trending": el ranking considera un
// evento trending si acumula al menos N interacciones (favoritos + RSVPs)
// en los últimos D días. Se recalcula al principio de cada /events.
const TRENDING_WINDOW_DAYS = 14;
const TRENDING_MIN_INTERACTIONS = 2;

async function getTrendingEventIds(): Promise<Set<string>> {
	try {
		const since = new Date(Date.now() - TRENDING_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
		const counts = await userEventRepository.countInteractionsByEvent(since);
		const trending = new Set<string>();
		for (const [eventId, total] of counts) {
			if (total >= TRENDING_MIN_INTERACTIONS) trending.add(eventId);
		}
		return trending;
	} catch (error) {
		// Si falla la query (p. ej. modo memoria sin DB) degradamos a ranking
		// sin señal de trending en lugar de romper todo el endpoint.
		console.warn('[trending] fallback vacío:', error instanceof Error ? error.message : error);
		return new Set();
	}
}

app.get('/health', (_request, response) => {
	response.json({ ok: true, service: 'tech-radar-api', timestamp: new Date().toISOString() });
});

// API pública para comunidades (REST key-based). CORS abierto, rate limit por key.
app.use('/public/v1', buildPublicApiRouter());

// Solicitudes públicas de API key (formulario del sitio). Rate limit por IP.
app.use('/public/keys', buildKeyRequestRouter());

// Magic-link admin routes (aprobar/rechazar desde Discord).
app.use('/admin', buildAdminMagicRouter());

// Documentación interactiva de la API pública (Scalar UI + OpenAPI JSON).
app.get('/public/docs', (_request, response) => {
	response.type('html').send(renderDocsPage());
});
app.get('/public/openapi.json', (_request, response) => {
	response.json(publicApiSpec);
});

app.get('/auth/config', (_request, response) => {
	response.json({
		enabled: isAuthEnabled(),
		googleClientId: isAuthEnabled() ? process.env.GOOGLE_CLIENT_ID : null
	});
});

app.post('/auth/google', asyncHandler(async (request, response) => {
	if (!isAuthEnabled()) {
		response.status(503).json({ error: 'auth_disabled' });
		return;
	}

	const credential = typeof request.body?.credential === 'string' ? request.body.credential : '';
	if (!credential) {
		response.status(400).json({ error: 'missing_credential' });
		return;
	}

	let payload;
	try {
		payload = await verifyGoogleIdToken(credential);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'token inválido';
		response.status(401).json({ error: 'invalid_token', message });
		return;
	}

	const user = await userRepository.upsertFromGoogle({
		googleSub: payload.sub!,
		email: payload.email!,
		name: payload.name ?? null,
		picture: payload.picture ?? null
	});

	const token = signSession({ userId: user.id });
	setSessionCookie(response, token);

	response.json({ user: toPublicUser(user), token });
}));

app.post('/auth/google/code', asyncHandler(async (request, response) => {
	if (!isAuthEnabled()) {
		response.status(503).json({ error: 'auth_disabled' });
		return;
	}

	const code = typeof request.body?.code === 'string' ? request.body.code : '';
	if (!code) {
		response.status(400).json({ error: 'missing_code' });
		return;
	}

	let payload;
	try {
		// Popup flow del Web Client: Google devuelve el `code` al callback del
		// cliente con redirect_uri=postmessage. El exchange usa client_secret
		// (no hace falta code_verifier).
		payload = await exchangeGoogleCode({ code, redirectUri: 'postmessage' });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'exchange falló';
		console.error('[auth] code exchange failed:', message);
		response.status(401).json({ error: 'exchange_failed', message });
		return;
	}

	const user = await userRepository.upsertFromGoogle({
		googleSub: payload.sub!,
		email: payload.email!,
		name: payload.name ?? null,
		picture: payload.picture ?? null
	});

	const token = signSession({ userId: user.id });
	setSessionCookie(response, token);

	response.json({ user: toPublicUser(user), token });
}));

app.post('/auth/google/exchange', asyncHandler(async (request, response) => {
	if (!isAuthEnabled()) {
		response.status(503).json({ error: 'auth_disabled' });
		return;
	}

	const body = request.body ?? {};
	const code = typeof body.code === 'string' ? body.code : '';
	const codeVerifier = typeof body.codeVerifier === 'string' ? body.codeVerifier : '';
	const redirectUri = typeof body.redirectUri === 'string' ? body.redirectUri : '';
	const clientId = typeof body.clientId === 'string' ? body.clientId : undefined;

	if (!code || !codeVerifier || !redirectUri) {
		response.status(400).json({ error: 'missing_params' });
		return;
	}

	let payload;
	try {
		payload = await exchangeGoogleCode({ code, codeVerifier, redirectUri, clientId });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'exchange falló';
		console.error('[auth] exchange_failed:', message);
		response.status(401).json({ error: 'exchange_failed', message });
		return;
	}

	const user = await userRepository.upsertFromGoogle({
		googleSub: payload.sub!,
		email: payload.email!,
		name: payload.name ?? null,
		picture: payload.picture ?? null
	});

	const token = signSession({ userId: user.id });
	setSessionCookie(response, token);

	response.json({ user: toPublicUser(user), token });
}));

app.post('/auth/logout', (_request, response) => {
	clearSessionCookie(response);
	response.json({ ok: true });
});

app.get('/auth/me', (request, response) => {
	if (!request.user) {
		response.status(401).json({ error: 'unauthenticated' });
		return;
	}
	response.json({ user: toPublicUser(request.user) });
});

app.get('/me/favorites', requireAuth, asyncHandler(async (request, response) => {
	const records = await userEventRepository.list(request.user!.id);
	response.json({
		favorites: records.filter((record) => record.type === 'favorite').map((record) => record.eventId),
		rsvp: records.filter((record) => record.type === 'rsvp').map((record) => record.eventId)
	});
}));

app.post('/me/events/:id/favorite', requireAuth, asyncHandler(async (request, response) => {
	await ensureEventExists(request.params.id, response);
	if (response.headersSent) return;
	const result = await userEventRepository.toggle(request.user!.id, request.params.id, 'favorite');
	response.json({ eventId: request.params.id, type: 'favorite' as UserEventType, active: result.active });
}));

app.post('/me/events/:id/rsvp', requireAuth, asyncHandler(async (request, response) => {
	await ensureEventExists(request.params.id, response);
	if (response.headersSent) return;
	const result = await userEventRepository.toggle(request.user!.id, request.params.id, 'rsvp');
	response.json({ eventId: request.params.id, type: 'rsvp' as UserEventType, active: result.active });
}));

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
	const [allEvents, trendingIds] = await Promise.all([
		ensureEventsLoaded(),
		getTrendingEventIds()
	]);
	const filtered = applyQueryFilters(allEvents, request.query);
	const ranked = rankEvents(filtered, profile, filtered.length, trendingIds);

	response.json({
		profile,
		context: buildRecommendationContext(profile, ranked),
		recommendations: ranked.slice(0, 6),
		events: ranked,
		total: ranked.length
	});
}));

app.get('/events/stream', (request, response) => {
	response.setHeader('Content-Type', 'text/event-stream');
	response.setHeader('Cache-Control', 'no-cache, no-transform');
	response.setHeader('Connection', 'keep-alive');
	response.setHeader('X-Accel-Buffering', 'no');
	response.flushHeaders();

	const writeEvent = (name: string, payload: unknown) => {
		response.write(`event: ${name}\n`);
		response.write(`data: ${JSON.stringify(payload)}\n\n`);
	};

	writeEvent('hello', {
		running: isSyncRunning(),
		lastResult: getLastSyncResult()
	});

	const unsubscribe = eventBus.onSyncCompleted((result) => {
		writeEvent('sync:completed', {
			saved: result.saved,
			finishedAt: result.finishedAt,
			sources: result.sources
		});
	});

	const heartbeat = setInterval(() => {
		response.write(': keepalive\n\n');
	}, 25_000);

	const cleanup = () => {
		clearInterval(heartbeat);
		unsubscribe();
	};

	request.on('close', cleanup);
	response.on('close', cleanup);
});

app.get('/events/recommended', asyncHandler(async (request, response) => {
	const profile = readProfile(request.query);
	const limit = clampLimit(request.query.limit, 10);
	const [allEvents, trendingIds] = await Promise.all([
		ensureEventsLoaded(),
		getTrendingEventIds()
	]);
	const filtered = applyQueryFilters(allEvents, request.query);
	const ranked = rankEvents(filtered, profile, limit, trendingIds);

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
	const [event, trendingIds] = await Promise.all([
		eventRepository.getById(request.params.id),
		getTrendingEventIds()
	]);

	if (!event) {
		response.status(404).json({ error: 'Event not found' });
		return;
	}

	response.json({ event: enrichEvent(event, profile, trendingIds) });
}));

app.post('/sync', requireSyncAuth, asyncHandler(async (_request, response) => {
	const result = await syncEvents();
	response.json({ ok: true, result });
}));

app.get('/sync/status', asyncHandler(async (_request, response) => {
	const running = isSyncRunning();
	const liveResult = getLastSyncResult();

	// Si el proceso acaba de arrancar (cold start de Render u otro host),
	// `lastResult` vive en memoria y se pierde. Pero la DB ya tiene eventos
	// de syncs pasadas. Sin este fallback la UI muestra "Conectando fuentes…"
	// aunque hay 300 eventos listos — mala señal para el usuario.
	if (liveResult) {
		response.json({ running, lastResult: liveResult });
		return;
	}

	const events = await eventRepository.getAll().catch(() => [] as TechEvent[]);
	if (events.length === 0) {
		response.json({ running, lastResult: null });
		return;
	}

	const counts = new Map<string, number>();
	let latestUpdatedAt: string | null = null;
	for (const event of events) {
		counts.set(event.source, (counts.get(event.source) ?? 0) + 1);
		if (!latestUpdatedAt || (event.updatedAt && event.updatedAt > latestUpdatedAt)) {
			latestUpdatedAt = event.updatedAt ?? latestUpdatedAt;
		}
	}

	const syntheticTimestamp = latestUpdatedAt ?? new Date().toISOString();
	response.json({
		running,
		lastResult: {
			fetched: events.length,
			cleaned: events.length,
			deduped: events.length,
			saved: events.length,
			startedAt: syntheticTimestamp,
			finishedAt: syntheticTimestamp,
			sources: [...counts.entries()].map(([source, count]) => ({
				source,
				count,
				usedFallback: false,
				error: undefined
			}))
		}
	});
}));

app.post('/chat', chatAuthGate, chatRateLimiter.middleware, asyncHandler(async (request, response) => {
	const message = String(request.body?.message ?? '').slice(0, 2000);
	const fallbackProfile = parseProfile(request.body?.profile ?? {});
	const allEvents = await ensureEventsLoaded();
	const knownCities = [...new Set(allEvents.map((event) => event.city).filter(Boolean))];
	const interpretation = parseChatInterpretation(message, knownCities);
	const mergedInterpretation = {
		...interpretation,
		country: interpretation.country ?? fallbackProfile.country,
		role: interpretation.role ?? fallbackProfile.role,
		level: interpretation.level ?? fallbackProfile.level,
		interests: interpretation.interests.length > 0 ? interpretation.interests : fallbackProfile.interests
	};

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
	try {
		await runMigrations();
	} catch (error) {
		console.error('[api] migraciones fallaron:', error instanceof Error ? error.message : error);
	}

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

	const server = app.listen(port, () => {
		console.log(`Tech Radar LATAM API running on http://localhost:${port}`);
	});

	const shutdown = async (signal: string) => {
		console.log(`[api] received ${signal}, closing…`);
		server.close();
		await closeDb();
		process.exit(0);
	};

	process.on('SIGTERM', () => void shutdown('SIGTERM'));
	process.on('SIGINT', () => void shutdown('SIGINT'));
}

function asyncHandler(handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
	return (req, res, next) => {
		Promise.resolve(handler(req, res, next)).catch(next);
	};
}

function chatAuthGate(req: Request, res: Response, next: NextFunction): void {
	if (!isAuthEnabled()) {
		next();
		return;
	}
	void requireAuth(req, res, next);
}

async function ensureEventExists(eventId: string, response: Response): Promise<void> {
	const event = await eventRepository.getById(eventId);
	if (!event) {
		response.status(404).json({ error: 'event_not_found' });
	}
}

function toPublicUser(user: { id: string; email: string; name: string | null; picture: string | null }) {
	return {
		id: user.id,
		email: user.email,
		name: user.name,
		picture: user.picture
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
	const events = await eventRepository.getAll();
	if (events.length > 0) {
		return events;
	}

	// If a sync is already running (bootstrap or periodic), don't block the
	// request on it — return empty so the UI can poll /sync/status and refetch.
	if (isSyncRunning()) {
		return events;
	}

	// Kick off sync in the background and return immediately.
	syncEvents().catch((error) => {
		console.error('[api] lazy sync failed:', error instanceof Error ? error.message : error);
	});
	return events;
}

function applyQueryFilters(events: TechEvent[], query: Record<string, unknown>): TechEvent[] {
	const source = normalizeText(String(query.source ?? ''));
	const country = normalizeText(String(query.countryFilter ?? ''));
	const city = normalizeText(String(query.city ?? ''));
	const rawQ = typeof query.q === 'string' ? query.q.trim() : '';
	const qTokens = rawQ
		? rawQ
				.split(/\s+/)
				.map((token) => normalizeText(token))
				.filter((token) => token.length >= 2)
		: [];

	return events.filter((event) => {
		const sourceOk = source ? normalizeText(event.source) === source : true;
		const countryOk = country ? normalizeText(event.country) === country : true;
		const cityOk = city ? normalizeText(event.city) === city : true;

		if (qTokens.length === 0) return sourceOk && countryOk && cityOk;

		const haystack = normalizeText(
			[event.title, event.description, event.summary, event.city, event.country, (event.tags ?? []).join(' ')].join(' ')
		);
		// AND entre tokens: todos deben aparecer para que cuente como match.
		const matchesQuery = qTokens.every((token) => haystack.includes(token));
		return sourceOk && countryOk && cityOk && matchesQuery;
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
