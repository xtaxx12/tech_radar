import type { ChatResponse, EventDetailResponse, ProfileOptions, RecommendationsResponse, UserProfile } from './types';

const baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function getProfileOptions(): Promise<ProfileOptions> {
  return requestJson<ProfileOptions>('/profile-options');
}

export function getRecommendations(profile: UserProfile): Promise<RecommendationsResponse> {
  const query = new URLSearchParams({
    country: profile.country,
    role: profile.role,
    level: profile.level,
    interests: profile.interests.join(',')
  });

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
