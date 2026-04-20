import { OAuth2Client, type TokenPayload } from 'google-auth-library';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import type { Response } from 'express';

const SESSION_COOKIE = 'tech_radar_session';
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

let googleClient: OAuth2Client | null = null;

export type AuthConfig = {
  clientId: string;
  sessionSecret: string;
  cookieDomain?: string;
  cookieSecure: boolean;
  cookieSameSite: 'lax' | 'none' | 'strict';
};

export function getAuthConfig(): AuthConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const sessionSecret = process.env.AUTH_SESSION_SECRET?.trim();

  if (!clientId || !sessionSecret) {
    return null;
  }

  const sameSiteRaw = (process.env.AUTH_COOKIE_SAMESITE ?? 'lax').toLowerCase().trim();
  const cookieSameSite: AuthConfig['cookieSameSite'] = sameSiteRaw === 'none' || sameSiteRaw === 'strict' ? sameSiteRaw : 'lax';

  return {
    clientId,
    sessionSecret,
    cookieDomain: process.env.AUTH_COOKIE_DOMAIN?.trim() || undefined,
    cookieSecure: /^(1|true|yes|on)$/i.test((process.env.AUTH_COOKIE_SECURE ?? '').trim()) || cookieSameSite === 'none',
    cookieSameSite
  };
}

export function isAuthEnabled(): boolean {
  return getAuthConfig() !== null;
}

export async function verifyGoogleIdToken(idToken: string): Promise<TokenPayload> {
  const config = getAuthConfig();
  if (!config) {
    throw new Error('Auth no está habilitado: falta GOOGLE_CLIENT_ID o AUTH_SESSION_SECRET.');
  }

  if (!googleClient) {
    googleClient = new OAuth2Client(config.clientId);
  }

  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: config.clientId
  });

  const payload = ticket.getPayload();
  if (!payload || !payload.sub || !payload.email) {
    throw new Error('Token de Google sin claims mínimos (sub/email).');
  }

  if (payload.email_verified === false) {
    throw new Error('La cuenta de Google no tiene el email verificado.');
  }

  return payload;
}

export async function exchangeGoogleCode(params: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<TokenPayload> {
  const config = getAuthConfig();
  if (!config) {
    throw new Error('Auth no está habilitado.');
  }

  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientSecret) {
    throw new Error('Falta GOOGLE_CLIENT_SECRET en el backend.');
  }

  const body = new URLSearchParams({
    code: params.code,
    client_id: config.clientId,
    client_secret: clientSecret,
    redirect_uri: params.redirectUri,
    grant_type: 'authorization_code',
    code_verifier: params.codeVerifier
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Google rechazó el code exchange (${response.status}): ${errText}`);
  }

  const data = (await response.json()) as { id_token?: string; access_token?: string };
  if (!data.id_token) {
    throw new Error('Google no devolvió id_token en el intercambio.');
  }

  return verifyGoogleIdToken(data.id_token);
}

export type SessionPayload = {
  userId: string;
};

export function signSession(payload: SessionPayload): string {
  const config = getAuthConfig();
  if (!config) throw new Error('Auth no habilitado');
  return jwt.sign(payload, config.sessionSecret, {
    expiresIn: SESSION_TTL_SECONDS,
    issuer: 'tech-radar-latam'
  });
}

export function verifySession(token: string): SessionPayload | null {
  const config = getAuthConfig();
  if (!config) return null;

  try {
    const decoded = jwt.verify(token, config.sessionSecret, { issuer: 'tech-radar-latam' }) as JwtPayload & SessionPayload;
    if (typeof decoded.userId !== 'string') return null;
    return { userId: decoded.userId };
  } catch {
    return null;
  }
}

export function setSessionCookie(response: Response, token: string): void {
  const config = getAuthConfig();
  if (!config) return;

  response.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: config.cookieSameSite,
    domain: config.cookieDomain,
    path: '/',
    maxAge: SESSION_TTL_SECONDS * 1000
  });
}

export function clearSessionCookie(response: Response): void {
  const config = getAuthConfig();

  response.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: config?.cookieSecure ?? false,
    sameSite: config?.cookieSameSite ?? 'lax',
    domain: config?.cookieDomain,
    path: '/'
  });
}

export function readSessionCookie(cookies: Record<string, string | undefined> | undefined): string | null {
  return cookies?.[SESSION_COOKIE] ?? null;
}
