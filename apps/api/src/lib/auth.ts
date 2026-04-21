import { OAuth2Client, type TokenPayload } from 'google-auth-library';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import type { Response } from 'express';

const SESSION_COOKIE = 'tech_radar_session';
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

let googleClient: OAuth2Client | null = null;

export type AuthConfig = {
  clientId: string;
  iosClientId?: string;
  androidClientId?: string;
  sessionSecret: string;
  cookieDomain?: string;
  cookieSecure: boolean;
  cookieSameSite: 'lax' | 'none' | 'strict';
};

export function getAuthConfig(): AuthConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const sessionSecret = process.env.AUTH_SESSION_SECRET?.trim();
  const databaseUrl = process.env.DATABASE_URL?.trim();

  // Auth requires all three: Google OAuth client, session secret, and a
  // real Postgres to persist users + favorites. Without DATABASE_URL the
  // user/user-event repositories throw at runtime, so we treat the whole
  // auth subsystem as disabled to keep /auth/config honest.
  if (!clientId || !sessionSecret || !databaseUrl) {
    return null;
  }

  const sameSiteRaw = (process.env.AUTH_COOKIE_SAMESITE ?? 'lax').toLowerCase().trim();
  const cookieSameSite: AuthConfig['cookieSameSite'] = sameSiteRaw === 'none' || sameSiteRaw === 'strict' ? sameSiteRaw : 'lax';

  return {
    clientId,
    iosClientId: process.env.GOOGLE_IOS_CLIENT_ID?.trim() || undefined,
    androidClientId: process.env.GOOGLE_ANDROID_CLIENT_ID?.trim() || undefined,
    sessionSecret,
    cookieDomain: process.env.AUTH_COOKIE_DOMAIN?.trim() || undefined,
    cookieSecure: /^(1|true|yes|on)$/i.test((process.env.AUTH_COOKIE_SECURE ?? '').trim()) || cookieSameSite === 'none',
    cookieSameSite
  };
}

function getAcceptedAudiences(): string[] {
  const config = getAuthConfig();
  if (!config) return [];
  return [config.clientId, config.iosClientId, config.androidClientId].filter((value): value is string => Boolean(value));
}

export function isAuthEnabled(): boolean {
  return getAuthConfig() !== null;
}

export async function verifyGoogleIdToken(idToken: string): Promise<TokenPayload> {
  const audiences = getAcceptedAudiences();
  if (audiences.length === 0) {
    throw new Error('Auth no está habilitado: falta GOOGLE_CLIENT_ID o AUTH_SESSION_SECRET.');
  }

  if (!googleClient) {
    googleClient = new OAuth2Client();
  }

  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: audiences
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
  /** Opcional: cuando el cliente usa PKCE (mobile). El Web Client del popup no lo manda. */
  codeVerifier?: string;
  redirectUri: string;
  clientId?: string;
}): Promise<TokenPayload> {
  const config = getAuthConfig();
  if (!config) {
    throw new Error('Auth no está habilitado.');
  }

  const accepted = getAcceptedAudiences();
  const clientId = params.clientId?.trim() || config.clientId;

  if (!accepted.includes(clientId)) {
    throw new Error(`client_id desconocido: ${clientId}`);
  }

  const isWebClient = clientId === config.clientId;

  const form: Record<string, string> = {
    code: params.code,
    client_id: clientId,
    redirect_uri: params.redirectUri,
    grant_type: 'authorization_code'
  };

  if (params.codeVerifier) {
    form.code_verifier = params.codeVerifier;
  }

  if (isWebClient) {
    const rawSecret = process.env.GOOGLE_CLIENT_SECRET;
    const clientSecret = rawSecret?.trim();
    if (!clientSecret) {
      throw new Error('Falta GOOGLE_CLIENT_SECRET para el Web Client.');
    }
    // Diagnóstico defensivo: secrets mal copiados (con espacios, newlines,
    // o rotados en Google Cloud sin actualizar en el host) son la causa más
    // común de `invalid_client`. Logueamos la huella para ver si el secret
    // real tiene algo raro sin exponerlo.
    if (clientSecret !== rawSecret) {
      console.warn('[auth] GOOGLE_CLIENT_SECRET tenía whitespace que fue trimeado. Revisá la env var.');
    }
    if (!clientSecret.startsWith('GOCSPX-')) {
      console.warn(`[auth] GOOGLE_CLIENT_SECRET no empieza con "GOCSPX-" (valor visto: "${clientSecret.slice(0, 4)}..."). Probablemente está mal copiado.`);
    }
    form.client_secret = clientSecret;
  } else if (!params.codeVerifier) {
    // Native clients (iOS / Android) usan PKCE: sin verifier no pueden hacer exchange.
    throw new Error('codeVerifier es obligatorio para clients nativos (PKCE).');
  }

  console.log('[auth] exchange →', {
    clientId: clientId.slice(0, 25) + '...',
    isWebClient,
    redirect_uri: params.redirectUri,
    has_secret: Boolean(form.client_secret),
    secret_prefix: form.client_secret ? form.client_secret.slice(0, 10) : null,
    secret_length: form.client_secret?.length ?? 0,
    code_prefix: params.code.slice(0, 20) + '...'
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form)
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    console.error('[auth] Google token exchange rechazado', response.status, errText);

    // Mapea los errores más comunes de Google a un mensaje accionable.
    let hint = '';
    try {
      const errJson = JSON.parse(errText) as { error?: string };
      if (errJson.error === 'invalid_client') {
        hint = ' → El CLIENT_SECRET en el server no matchea el CLIENT_ID. Verificá que ambos provengan del MISMO OAuth Client en Google Cloud Console y que el secret no haya sido rotado.';
      } else if (errJson.error === 'invalid_grant') {
        hint = ' → El código expiró o ya fue usado. Intentá el login otra vez.';
      } else if (errJson.error === 'redirect_uri_mismatch') {
        hint = ' → El redirect_uri del exchange no está autorizado en Google Cloud Console.';
      }
    } catch { /* ignore */ }

    throw new Error(`Google rechazó el intercambio (${response.status}): ${errText}${hint}`);
  }

  const data = (await response.json()) as { id_token?: string; access_token?: string };
  if (!data.id_token) {
    throw new Error('Google no devolvió id_token.');
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
