import type { Request, RequestHandler } from 'express';
import { apiKeyRepository } from '../repositories/api-key.repository.js';
import type { ApiKeyRow } from '../db/schema.js';

declare module 'express-serve-static-core' {
  interface Request {
    apiKey?: ApiKeyRow;
  }
}

// Rate limit por key, ventana deslizante simple de 1h, en memoria.
// Si quieres multi-instancia usa Redis; para un solo proceso esto alcanza.
const buckets = new Map<string, number[]>();
const WINDOW_MS = 60 * 60 * 1000;

function countRecentHits(keyId: string): number {
  const now = Date.now();
  const hits = (buckets.get(keyId) ?? []).filter((timestamp) => now - timestamp < WINDOW_MS);
  buckets.set(keyId, hits);
  return hits.length;
}

function recordHit(keyId: string): void {
  const hits = buckets.get(keyId) ?? [];
  hits.push(Date.now());
  buckets.set(keyId, hits);
}

function extractKey(req: Request): string | null {
  const header = req.headers.authorization;
  if (typeof header === 'string') {
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (match) return match[1].trim();
  }
  const xApiKey = req.headers['x-api-key'];
  if (typeof xApiKey === 'string' && xApiKey.trim()) return xApiKey.trim();
  return null;
}

export const requireApiKey: RequestHandler = async (req, res, next) => {
  const plaintext = extractKey(req);
  if (!plaintext) {
    res.status(401).json({
      error: 'missing_api_key',
      message: 'Incluye Authorization: Bearer <your-key> o X-API-Key: <your-key>'
    });
    return;
  }

  let row;
  try {
    row = await apiKeyRepository.findActive(plaintext);
  } catch (error) {
    console.error('[public-api] key lookup failed:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'internal_error' });
    return;
  }

  if (!row) {
    res.status(401).json({ error: 'invalid_api_key' });
    return;
  }

  const limit = Number(row.rateLimitPerHour);
  const hits = countRecentHits(row.id);
  if (hits >= limit) {
    res.setHeader('Retry-After', '3600');
    res.status(429).json({
      error: 'rate_limit_exceeded',
      message: `Excediste ${limit} requests/hora. Contacta al owner para aumentar el límite.`
    });
    return;
  }

  recordHit(row.id);
  // No bloqueamos la request si falla el touch: el rate limit ya corrió.
  void apiKeyRepository.touchLastUsed(row.id).catch(() => {});

  req.apiKey = row;
  res.setHeader('X-RateLimit-Limit', String(limit));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, limit - hits - 1)));

  next();
};
