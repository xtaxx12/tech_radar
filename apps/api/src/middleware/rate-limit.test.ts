import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { createRateLimiter } from './rate-limit.middleware.js';

type MockRes = {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  setHeader: ReturnType<typeof vi.fn>;
  headersSent: boolean;
};

function buildReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
    ...overrides
  } as unknown as Request;
}

function buildRes(): MockRes {
  const res: MockRes = {
    status: vi.fn(),
    json: vi.fn(),
    setHeader: vi.fn(),
    headersSent: false
  };
  res.status.mockImplementation(() => res);
  res.json.mockImplementation(() => res);
  return res;
}

describe('createRateLimiter', () => {
  it('allows a request up to the per-second budget and blocks the next one', () => {
    let now = 1_000_000;
    const limiter = createRateLimiter({ perSecond: 1, perHour: 100, now: () => now });

    const req = buildReq();
    const res1 = buildRes();
    const next1 = vi.fn();
    limiter.middleware(req, res1 as unknown as Response, next1);
    expect(next1).toHaveBeenCalled();
    expect(res1.status).not.toHaveBeenCalled();

    // Segundo hit dentro del mismo segundo → 429.
    now += 200;
    const res2 = buildRes();
    const next2 = vi.fn();
    limiter.middleware(req, res2 as unknown as Response, next2);
    expect(next2).not.toHaveBeenCalled();
    expect(res2.status).toHaveBeenCalledWith(429);
    expect(res2.setHeader).toHaveBeenCalledWith('Retry-After', '1');

    // Un segundo después se abre la ventana.
    now += 1200;
    const res3 = buildRes();
    const next3 = vi.fn();
    limiter.middleware(req, res3 as unknown as Response, next3);
    expect(next3).toHaveBeenCalled();
  });

  it('enforces the per-hour limit independently from the per-second one', () => {
    let now = 2_000_000;
    const limiter = createRateLimiter({ perSecond: 100, perHour: 3, now: () => now });

    const req = buildReq();
    for (let i = 0; i < 3; i += 1) {
      const res = buildRes();
      const next = vi.fn();
      limiter.middleware(req, res as unknown as Response, next);
      expect(next).toHaveBeenCalled();
      now += 60_000; // un minuto entre cada una
    }

    // Cuarta request dentro de la misma hora → bloqueada.
    const blocked = buildRes();
    const nextBlocked = vi.fn();
    limiter.middleware(req, blocked as unknown as Response, nextBlocked);
    expect(nextBlocked).not.toHaveBeenCalled();
    expect(blocked.status).toHaveBeenCalledWith(429);
    expect(blocked.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'rate_limited', scope: 'per_hour' })
    );
  });

  it('tracks authenticated users and anonymous IPs in separate buckets', () => {
    let now = 3_000_000;
    const limiter = createRateLimiter({ perSecond: 1, perHour: 100, now: () => now });

    const authedReq = buildReq({ user: { id: 'user-123' } as Request['user'] });
    const anonReq = buildReq({ socket: { remoteAddress: '203.0.113.5' } as Request['socket'] });

    // User consume su bucket
    limiter.middleware(authedReq, buildRes() as unknown as Response, vi.fn());
    // IP anónima en el mismo instante — NO debe ser bloqueada
    const anonRes = buildRes();
    const anonNext = vi.fn();
    limiter.middleware(anonReq, anonRes as unknown as Response, anonNext);
    expect(anonNext).toHaveBeenCalled();
    expect(anonRes.status).not.toHaveBeenCalled();

    expect(limiter.size()).toBe(2);
    now += 10_000;
    limiter.cleanup(now); // no debe borrar nada todavía
    expect(limiter.size()).toBe(2);
  });

  it('evicts stale buckets once the hour window has fully expired', () => {
    let now = 4_000_000;
    const limiter = createRateLimiter({ perSecond: 1, perHour: 10, now: () => now });

    limiter.middleware(buildReq(), buildRes() as unknown as Response, vi.fn());
    expect(limiter.size()).toBe(1);

    now += 61 * 60 * 1000; // avanzar 61 minutos
    limiter.cleanup(now);
    expect(limiter.size()).toBe(0);
  });
});
