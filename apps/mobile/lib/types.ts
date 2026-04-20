export type UserProfile = {
  country: string;
  role: string;
  level: string;
  interests: string[];
};

export type ProfileOptions = {
  countries: string[];
  roles: string[];
  levels: string[];
  interests: string[];
};

export type TechEvent = {
  id: string;
  title: string;
  description: string;
  date: string;
  country: string;
  city: string;
  source: string;
  url: string;
  link?: string;
  tags: string[];
  level: string;
  summary: string;
  trending?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type RankedEvent = TechEvent & {
  score: number;
  rankLabel: string;
  reasons: string[];
};

export type RecommendationContext = {
  profile: UserProfile;
  total: number;
  topMatch: string;
  trending: number;
  selected: RankedEvent[];
};

export type RecommendationsResponse = {
  profile: UserProfile;
  context: RecommendationContext;
  recommendations: RankedEvent[];
  events: RankedEvent[];
  total: number;
};

export type ChatInterpretation = {
  country?: string;
  role?: string;
  level?: string;
  interests: string[];
  keyword?: string;
  timeframe?: string;
};

export type ChatResponse = {
  interpretation: ChatInterpretation;
  answer: string;
  events: RankedEvent[];
  context: RecommendationContext;
};

export type PublicUser = {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
};

export type AuthResponse = {
  user: PublicUser;
  token: string;
};

export type FavoritesResponse = {
  favorites: string[];
  rsvp: string[];
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
  events?: RankedEvent[];
  timestamp: string;
};
