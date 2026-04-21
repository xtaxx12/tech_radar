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

export type Level = 'junior' | 'mid' | 'senior' | 'all';

export type EventSource = 'meetup' | 'eventbrite' | 'gdg' | 'community';

export type SummarySource = 'ai' | 'heuristic';

export interface UnifiedEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  country: string;
  city: string;
  source: EventSource;
  url: string;
  link?: string;
  tags: string[];
  level: Level;
  summary: string;
  summarySource?: SummarySource;
  contentHash?: string | null;
  trending?: boolean;
  createdAt: string;
  updatedAt: string;
  raw?: unknown;
}

export interface UserProfile {
  country: string;
  role: Role;
  level: Exclude<Level, 'all'>;
  interests: string[];
}

export type TechEvent = UnifiedEvent;

export interface RankedEvent extends TechEvent {
  score: number;
  rankLabel: string;
  summary: string;
  reasons: string[];
  badges: string[];
}

export interface SourceFetchResult {
  source: EventSource;
  events: TechEvent[];
  usedFallback: boolean;
  error?: string;
}

export interface SyncResult {
  fetched: number;
  cleaned: number;
  deduped: number;
  saved: number;
  startedAt: string;
  finishedAt: string;
  sources: Array<{
    source: EventSource;
    count: number;
    usedFallback: boolean;
    error?: string;
  }>;
}

export interface ChatInterpretation {
  country?: string;
  city?: string;
  role?: Role;
  level?: Exclude<Level, 'all'>;
  interests: string[];
  timeWindowDays: number;
  originalMessage: string;
}
