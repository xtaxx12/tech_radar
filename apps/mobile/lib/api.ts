import { Platform } from 'react-native';
import type {
  AuthResponse,
  ChatResponse,
  FavoritesResponse,
  ProfileOptions,
  PublicUser,
  RecommendationsResponse,
  TechEvent,
  UserProfile
} from './types';

type TokenGetter = () => string | null;
let getToken: TokenGetter = () => null;

export function registerTokenGetter(getter: TokenGetter): void {
  getToken = getter;
}

export function resolveApiUrl(): string {
  const raw = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!raw) return defaultApiUrl();

  if (Platform.OS === 'android' && /https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(raw)) {
    return raw.replace(/(https?:\/\/)(localhost|127\.0\.0\.1)/i, '$110.0.2.2');
  }
  return raw;
}

function defaultApiUrl(): string {
  return Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';
}

export class ApiError extends Error {
  constructor(public status: number, public body: unknown, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const base = resolveApiUrl();
  const url = `${base}${path}`;

  const headers = new Headers(init.headers);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(url, { ...init, headers });
  const contentType = response.headers.get('content-type') ?? '';
  const body = contentType.includes('application/json') ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    const message = (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string')
      ? body.error
      : `HTTP ${response.status}`;
    throw new ApiError(response.status, body, message);
  }

  return body as T;
}

function toQuery(params: Record<string, string | number | string[] | undefined>): string {
  const entries: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    const encoded = Array.isArray(value) ? value.join(',') : String(value);
    entries.push(`${encodeURIComponent(key)}=${encodeURIComponent(encoded)}`);
  }
  return entries.length ? `?${entries.join('&')}` : '';
}

// Auth ---------------------------------------------------------------

export function getAuthConfig(): Promise<{ enabled: boolean; googleClientId: string | null }> {
  return request('/auth/config');
}

export function loginWithGoogle(credential: string): Promise<AuthResponse> {
  return request('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ credential })
  });
}

export function exchangeGoogleCode(
  code: string,
  codeVerifier: string,
  redirectUri: string,
  clientId?: string
): Promise<AuthResponse> {
  return request('/auth/google/exchange', {
    method: 'POST',
    body: JSON.stringify({ code, codeVerifier, redirectUri, clientId })
  });
}

export function getMe(): Promise<{ user: PublicUser }> {
  return request('/auth/me');
}

export function logout(): Promise<{ ok: true }> {
  return request('/auth/logout', { method: 'POST' });
}

// Events -------------------------------------------------------------

export function getProfileOptions(): Promise<ProfileOptions> {
  return request('/profile-options');
}

export function getRecommendations(profile: UserProfile, limit = 20): Promise<RecommendationsResponse> {
  const query = toQuery({
    country: profile.country,
    role: profile.role,
    level: profile.level,
    interests: profile.interests,
    limit
  });
  return request(`/events/recommended${query}`);
}

export function getAllEvents(profile: UserProfile): Promise<RecommendationsResponse> {
  const query = toQuery({
    country: profile.country,
    role: profile.role,
    level: profile.level,
    interests: profile.interests
  });
  return request(`/events${query}`);
}

export function getEvent(id: string, profile: UserProfile): Promise<{ event: TechEvent }> {
  const query = toQuery({
    country: profile.country,
    role: profile.role,
    level: profile.level,
    interests: profile.interests
  });
  return request(`/events/${encodeURIComponent(id)}${query}`);
}

// Chat ---------------------------------------------------------------

export function postChat(message: string, profile: UserProfile): Promise<ChatResponse> {
  return request('/chat', {
    method: 'POST',
    body: JSON.stringify({ message, profile })
  });
}

// Me -----------------------------------------------------------------

export function getFavorites(): Promise<FavoritesResponse> {
  return request('/me/favorites');
}

export function toggleFavorite(eventId: string): Promise<{ eventId: string; type: 'favorite'; active: boolean }> {
  return request(`/me/events/${encodeURIComponent(eventId)}/favorite`, { method: 'POST' });
}

export function toggleRsvp(eventId: string): Promise<{ eventId: string; type: 'rsvp'; active: boolean }> {
  return request(`/me/events/${encodeURIComponent(eventId)}/rsvp`, { method: 'POST' });
}
