import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { events } from './data/events.js';
import { buildRecommendationContext, enrichEvent, filterByInterpretation, generateChatAnswer, parseChatInterpretation, rankEvents } from './lib/ranking.js';
import type { UserProfile } from './types.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 4000);
const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:5173';

app.use(cors({ origin: corsOrigin }));
app.use(express.json());

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

app.get('/events', (request, response) => {
  const profile = readProfile(request.query);
  const ranked = rankEvents(events, profile, events.length);

  response.json({
    profile,
    context: buildRecommendationContext(profile, ranked),
    recommendations: ranked.slice(0, 6),
    events: ranked
  });
});

app.get('/events/:id', (request, response) => {
  const event = events.find((item) => item.id === request.params.id);

  if (!event) {
    response.status(404).json({ error: 'Event not found' });
    return;
  }

  const profile = readProfile(request.query);
  response.json({ event: enrichEvent(event, profile) });
});

app.post('/recommendations', (request, response) => {
  const profile = parseProfile(request.body?.profile ?? request.body);
  const ranked = rankEvents(events, profile, events.length);

  response.json({
    profile,
    context: buildRecommendationContext(profile, ranked),
    recommendations: ranked.slice(0, 6),
    events: ranked
  });
});

app.post('/chat', async (request, response) => {
  const message = String(request.body?.message ?? '');
  const fallbackProfile = parseProfile(request.body?.profile ?? {});
  const interpretation = parseChatInterpretation(message);
  const mergedInterpretation = {
    ...interpretation,
    country: interpretation.country ?? fallbackProfile.country,
    role: interpretation.role ?? fallbackProfile.role,
    level: interpretation.level ?? fallbackProfile.level,
    interests: interpretation.interests.length > 0 ? interpretation.interests : fallbackProfile.interests
  };

  const filtered = filterByInterpretation(events, mergedInterpretation);
  const ranked = rankEvents(filtered.length > 0 ? filtered : events, fallbackProfile, 6);
  const answer = await generateChatAnswer(message, ranked, mergedInterpretation);

  response.json({
    interpretation: mergedInterpretation,
    answer,
    events: ranked,
    context: buildRecommendationContext(fallbackProfile, ranked)
  });
});

app.listen(port, () => {
  console.log(`Tech Radar LATAM API running on http://localhost:${port}`);
});

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
