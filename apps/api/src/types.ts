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

export type EventSource = 'meetup' | 'eventbrite' | 'gdg' | 'community';

export interface UserProfile {
  country: string;
  role: Role;
  level: Level;
  interests: string[];
}

export interface TechEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  city: string;
  country: string;
  link: string;
  source: EventSource;
  tags: string[];
  level: Level;
  audience: string[];
  trending?: boolean;
}

export interface RankedEvent extends TechEvent {
  score: number;
  rankLabel: string;
  summary: string;
  reasons: string[];
  badges: string[];
}

export interface ChatInterpretation {
  country?: string;
  role?: Role;
  level?: Level;
  interests: string[];
  timeWindowDays: number;
  originalMessage: string;
}
