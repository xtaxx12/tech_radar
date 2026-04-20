import type { Request, RequestHandler } from 'express';

type Bucket = {
  perSecond: number[];
  perHour: number[];
};

export type RateLimitOptions = {
  perSecond?: number;
  perHour?: number;
  // Inyectable para tests.
  now?: () => number;
};

const DEFAULT_PER_SECOND = 1;
const DEFAULT_PER_HOUR = 30;
const SECOND_MS = 1000;
const HOUR_MS = 60 * 60 * 1000;

function readClientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) {
    return fwd.split(',')[0]!.trim();
  }
  if (Array.isArray(fwd) && fwd[0]) {
    return fwd[0];
  }
  return req.socket.remoteAddress ?? 'unknown';
}

function buildKey(req: Request): string {
  return req.user?.id ? `user:${req.user.id}` : `ip:${readClientIp(req)}`;
}

function prune(bucket: Bucket, now: number): void {
  bucket.perSecond = bucket.perSecond.filter((t) => now - t < SECOND_MS);
  bucket.perHour = bucket.perHour.filter((t) => now - t < HOUR_MS);
}

/**
 * Crea un rate limiter in-memory con dos ventanas (por segundo y por hora).
 * Usa `req.user.id` cuando hay sesión autenticada y cae a la IP del cliente
 * en caso contrario. Aislado en una fábrica para permitir instancias con
 * distintos límites en rutas distintas y para facilitar tests.
 */
export function createRateLimiter(options: RateLimitOptions = {}) {
  const perSecondLimit = options.perSecond ?? DEFAULT_PER_SECOND;
  const perHourLimit = options.perHour ?? DEFAULT_PER_HOUR;
  const nowFn = options.now ?? (() => Date.now());

  const buckets = new Map<string, Bucket>();

  const middleware: RequestHandler = (req, res, next) => {
    const now = nowFn();
    const key = buildKey(req);

    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { perSecond: [], perHour: [] };
      buckets.set(key, bucket);
    }

    prune(bucket, now);

    if (bucket.perSecond.length >= perSecondLimit) {
      res.setHeader('Retry-After', '1');
      res.status(429).json({
        error: 'rate_limited',
        scope: 'per_second',
        message: 'Demasiadas consultas seguidas. Espera un segundo.'
      });
      return;
    }

    if (bucket.perHour.length >= perHourLimit) {
      const oldest = bucket.perHour[0]!;
      const retryAfterSec = Math.max(1, Math.ceil((HOUR_MS - (now - oldest)) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      res.status(429).json({
        error: 'rate_limited',
        scope: 'per_hour',
        message: `Alcanzaste el límite de ${perHourLimit} consultas por hora. Reintenta en ~${Math.ceil(retryAfterSec / 60)} min.`
      });
      return;
    }

    bucket.perSecond.push(now);
    bucket.perHour.push(now);
    next();
  };

  return {
    middleware,
    // Expuesto para tests y para un eventual /admin/rate-limits.
    inspect: (key: string) => buckets.get(key),
    reset: () => buckets.clear(),
    size: () => buckets.size,
    cleanup: (now: number = nowFn()) => {
      for (const [key, bucket] of buckets) {
        prune(bucket, now);
        if (bucket.perHour.length === 0) buckets.delete(key);
      }
    }
  };
}

export type RateLimiter = ReturnType<typeof createRateLimiter>;
