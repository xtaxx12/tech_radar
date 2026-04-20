export type Role =
  | 'frontend'
  | 'backend'
  | 'fullstack'
  | 'data'
  | 'design'
  | 'founder'
  | 'mobile'
  | 'devops'
  | 'product';

export type Level = 'junior' | 'mid' | 'senior';

export interface UserProfile {
  country: string;
  role: Role;
  level: Level;
  interests: string[];
}

export interface ProfileOptions {
  countries: string[];
  roles: Role[];
  levels: Level[];
  interests: string[];
}

export interface RankedEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  city: string;
  country: string;
  link: string;
  source: 'meetup' | 'eventbrite' | 'gdg' | 'community';
  tags: string[];
  level: Level;
  audience: string[];
  score: number;
  rankLabel: string;
  summary: string;
  reasons: string[];
  badges: string[];
}

export interface RecommendationsResponse {
  profile: UserProfile;
  context: {
    profile: UserProfile;
    total: number;
    topMatch: string | null;
    trending: number;
    selected: RankedEvent[];
  };
  recommendations: RankedEvent[];
  events: RankedEvent[];
}

export interface EventDetailResponse {
  event: RankedEvent;
}

export interface SyncSourceStatus {
  source: 'meetup' | 'eventbrite' | 'gdg' | 'community';
  count: number;
  usedFallback: boolean;
  error?: string;
}

export interface SyncResultPayload {
  fetched: number;
  cleaned: number;
  deduped: number;
  saved: number;
  startedAt: string;
  finishedAt: string;
  sources: SyncSourceStatus[];
}

export interface SyncStatus {
  running: boolean;
  lastResult: SyncResultPayload | null;
}

export interface ChatResponse {
  interpretation: {
    country?: string;
    role?: Role;
    level?: Level;
    interests: string[];
    timeWindowDays: number;
    originalMessage: string;
  };
  answer: string;
  events: RankedEvent[];
  context: RecommendationsResponse['context'];
}
