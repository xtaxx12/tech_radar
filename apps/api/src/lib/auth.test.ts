import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isAuthEnabled, signSession, verifySession } from './auth.js';

const ORIGINAL_ENV = { ...process.env };

function resetEnv() {
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.AUTH_SESSION_SECRET;
  delete process.env.DATABASE_URL;
  delete process.env.AUTH_COOKIE_SAMESITE;
  delete process.env.AUTH_COOKIE_SECURE;
  delete process.env.AUTH_COOKIE_DOMAIN;
}

beforeEach(() => {
  resetEnv();
});

afterEach(() => {
  resetEnv();
  Object.assign(process.env, ORIGINAL_ENV);
});

describe('isAuthEnabled', () => {
  it('is false when any of the three required envs is missing', () => {
    process.env.GOOGLE_CLIENT_ID = 'abc.apps.googleusercontent.com';
    process.env.AUTH_SESSION_SECRET = 's'.repeat(32);
    // DATABASE_URL missing on purpose
    expect(isAuthEnabled()).toBe(false);
  });

  it('is true when GOOGLE_CLIENT_ID + AUTH_SESSION_SECRET + DATABASE_URL are all set', () => {
    process.env.GOOGLE_CLIENT_ID = 'abc.apps.googleusercontent.com';
    process.env.AUTH_SESSION_SECRET = 's'.repeat(32);
    process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';
    expect(isAuthEnabled()).toBe(true);
  });
});

describe('signSession / verifySession', () => {
  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = 'abc.apps.googleusercontent.com';
    process.env.AUTH_SESSION_SECRET = 'test-session-secret-at-least-32-chars-long';
    process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';
  });

  it('signs a token that can be round-tripped to the same userId', () => {
    const token = signSession({ userId: 'user-123' });
    expect(typeof token).toBe('string');
    const decoded = verifySession(token);
    expect(decoded).toEqual({ userId: 'user-123' });
  });

  it('returns null for a tampered token', () => {
    const token = signSession({ userId: 'user-123' });
    const tampered = token.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A'));
    expect(verifySession(tampered)).toBeNull();
  });

  it('returns null when verified with a different secret', () => {
    const token = signSession({ userId: 'user-123' });
    // Rotate the secret: the previous token must no longer validate.
    process.env.AUTH_SESSION_SECRET = 'different-secret-rotated-at-least-32-chars';
    expect(verifySession(token)).toBeNull();
  });

  it('returns null when auth is not enabled', () => {
    delete process.env.DATABASE_URL; // disable auth
    expect(verifySession('any.token.value')).toBeNull();
  });
});
