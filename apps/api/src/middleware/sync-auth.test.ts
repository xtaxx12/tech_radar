import type { Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signSession } from '../lib/auth.js';
import { requireSyncAuth } from './sync-auth.middleware.js';

const ORIGINAL_ENV = { ...process.env };

function resetEnv() {
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.AUTH_SESSION_SECRET;
  delete process.env.DATABASE_URL;
  delete process.env.SYNC_API_KEY;
}

function enableAuth() {
  process.env.GOOGLE_CLIENT_ID = 'abc.apps.googleusercontent.com';
  process.env.AUTH_SESSION_SECRET = 'test-session-secret-at-least-32-chars-long';
  process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';
}

beforeEach(() => {
  resetEnv();
});

afterEach(() => {
  resetEnv();
  Object.assign(process.env, ORIGINAL_ENV);
});

type MockRes = {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
};

function buildReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    cookies: {},
    ...overrides
  } as unknown as Request;
}

function buildRes(): MockRes {
  const res: MockRes = {
    status: vi.fn(),
    json: vi.fn()
  };
  res.status.mockImplementation(() => res);
  res.json.mockImplementation(() => res);
  return res;
}

describe('requireSyncAuth', () => {
  it('lets everything through when neither auth nor SYNC_API_KEY are configured (dev-friendly)', () => {
    const next = vi.fn();
    requireSyncAuth(buildReq(), buildRes() as unknown as Response, next);
    expect(next).toHaveBeenCalled();
  });

  it('allows requests with a matching X-API-Key header', () => {
    process.env.SYNC_API_KEY = 'super-secret';
    const next = vi.fn();
    requireSyncAuth(
      buildReq({ headers: { 'x-api-key': 'super-secret' } }),
      buildRes() as unknown as Response,
      next
    );
    expect(next).toHaveBeenCalled();
  });

  it('rejects a wrong X-API-Key even when a key is configured', () => {
    process.env.SYNC_API_KEY = 'super-secret';
    const next = vi.fn();
    const res = buildRes();
    requireSyncAuth(
      buildReq({ headers: { 'x-api-key': 'wrong' } }),
      res as unknown as Response,
      next
    );
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'sync_forbidden' })
    );
  });

  it('accepts an authenticated session cookie when auth is enabled', () => {
    enableAuth();
    const token = signSession({ userId: 'user-abc' });
    const next = vi.fn();
    requireSyncAuth(
      buildReq({ cookies: { tech_radar_session: token } }),
      buildRes() as unknown as Response,
      next
    );
    expect(next).toHaveBeenCalled();
  });

  it('accepts a Bearer token when auth is enabled', () => {
    enableAuth();
    const token = signSession({ userId: 'user-abc' });
    const next = vi.fn();
    requireSyncAuth(
      buildReq({ headers: { authorization: `Bearer ${token}` } }),
      buildRes() as unknown as Response,
      next
    );
    expect(next).toHaveBeenCalled();
  });

  it('rejects unauthenticated requests once SYNC_API_KEY is set (no more dev bypass)', () => {
    process.env.SYNC_API_KEY = 'super-secret';
    const next = vi.fn();
    const res = buildRes();
    requireSyncAuth(buildReq(), res as unknown as Response, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rejects unauthenticated requests once auth is enabled, even without SYNC_API_KEY', () => {
    enableAuth();
    const next = vi.fn();
    const res = buildRes();
    requireSyncAuth(buildReq(), res as unknown as Response, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
