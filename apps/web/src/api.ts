import type {
  AuthConfig,
  AuthUser,
  ChatResponse,
  EventDetailResponse,
  ProfileOptions,
  RecommendationsResponse,
  SyncStatus,
  ToggleInteractionResponse,
  UserEventInteractionType,
  UserFavorites,
  UserProfile
} from './types';

const baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: Record<string, unknown>;

  constructor(status: number, message: string, code?: string, details?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    let code: string | undefined;
    let details: Record<string, unknown> | undefined;
    try {
      const text = await response.text();
      try {
        const parsed = JSON.parse(text) as Record<string, unknown>;
        details = parsed;
        const parsedError = typeof parsed.error === 'string' ? parsed.error : undefined;
        const parsedMessage = typeof parsed.message === 'string' ? parsed.message : undefined;
        code = parsedError;
        message = parsedMessage ?? parsedError ?? text ?? message;
      } catch {
        message = text || message;
      }
    } catch {
      // ignore
    }
    throw new ApiError(response.status, message, code, details);
  }

  return response.json() as Promise<T>;
}

export function getProfileOptions(): Promise<ProfileOptions> {
  return requestJson<ProfileOptions>('/profile-options');
}

export type EventQueryFilters = {
  source?: string;
  country?: string;
  city?: string;
  q?: string;
};

export function getRecommendations(profile: UserProfile, filters: EventQueryFilters = {}): Promise<RecommendationsResponse> {
  const query = new URLSearchParams({
    country: profile.country,
    role: profile.role,
    level: profile.level,
    interests: profile.interests.join(',')
  });

  if (filters.source) query.set('source', filters.source);
  if (filters.country) query.set('countryFilter', filters.country);
  if (filters.city) query.set('city', filters.city);
  if (filters.q?.trim()) query.set('q', filters.q.trim());

  return requestJson<RecommendationsResponse>(`/events?${query.toString()}`);
}

export function getChatResponse(message: string, profile: UserProfile): Promise<ChatResponse> {
  return requestJson<ChatResponse>('/chat', {
    method: 'POST',
    body: JSON.stringify({ message, profile })
  });
}

export function getEventDetail(eventId: string): Promise<EventDetailResponse> {
  return requestJson<EventDetailResponse>(`/events/${eventId}`);
}

export function getSyncStatus(): Promise<SyncStatus> {
  return requestJson<SyncStatus>('/sync/status');
}

export function triggerSync(): Promise<{ ok: boolean; result: SyncStatus['lastResult'] }> {
  return requestJson('/sync', { method: 'POST' });
}

export function getAuthConfig(): Promise<AuthConfig> {
  return requestJson<AuthConfig>('/auth/config');
}

export function getMe(): Promise<{ user: AuthUser }> {
  return requestJson<{ user: AuthUser }>('/auth/me');
}

export function loginWithGoogle(credential: string): Promise<{ user: AuthUser }> {
  return requestJson<{ user: AuthUser }>('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ credential })
  });
}

export function logout(): Promise<{ ok: boolean }> {
  return requestJson<{ ok: boolean }>('/auth/logout', { method: 'POST' });
}

export function getMyInteractions(): Promise<UserFavorites> {
  return requestJson<UserFavorites>('/me/favorites');
}

export function toggleInteraction(eventId: string, type: UserEventInteractionType): Promise<ToggleInteractionResponse> {
  return requestJson<ToggleInteractionResponse>(`/me/events/${encodeURIComponent(eventId)}/${type === 'favorite' ? 'favorite' : 'rsvp'}`, {
    method: 'POST'
  });
}
