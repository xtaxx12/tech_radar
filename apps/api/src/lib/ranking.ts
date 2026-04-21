import { generateText } from './ai.js';
import { normalizeText, uniqueStrings } from './text.js';
import type { ChatInterpretation, Level, RankedEvent, TechEvent, UserProfile } from '../types.js';

const ROLE_KEYWORDS: Record<string, UserProfile['role']> = {
  frontend: 'frontend',
  front: 'frontend',
  backend: 'backend',
  back: 'backend',
  fullstack: 'fullstack',
  data: 'data',
  design: 'design',
  diseno: 'design',
  founder: 'founder',
  startup: 'founder',
  mobile: 'mobile',
  app: 'mobile',
  devops: 'devops',
  cloud: 'devops',
  product: 'product',
  pm: 'product'
};

const LEVEL_KEYWORDS: Record<string, UserProfile['level']> = {
  junior: 'junior',
  trainee: 'junior',
  mid: 'mid',
  semi: 'mid',
  senior: 'senior',
  sr: 'senior',
  advanced: 'senior'
};

const INTEREST_KEYWORDS = ['ia', 'ai', 'llm', 'web', 'mobile', 'blockchain', 'cloud', 'data', 'ux', 'design', 'product', 'performance'];
const COUNTRY_KEYWORDS: Array<[string, string]> = [
  ['argentina', 'Argentina'],
  ['brasil', 'Brasil'],
  ['chile', 'Chile'],
  ['colombia', 'Colombia'],
  ['ecuador', 'Ecuador'],
  ['mexico', 'México'],
  ['peru', 'Perú'],
  ['costa rica', 'Costa Rica'],
  ['uruguay', 'Uruguay'],
  ['bolivia', 'Bolivia'],
  ['paraguay', 'Paraguay'],
  ['panama', 'Panamá']
];

export function rankEvents(
  events: TechEvent[],
  profile: UserProfile,
  limit = 6,
  trendingIds: ReadonlySet<string> = new Set()
): RankedEvent[] {
  return [...events]
    .map((event) => enrichEvent(event, profile, trendingIds))
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

export function enrichEvent(
  event: TechEvent,
  profile: UserProfile,
  trendingIds: ReadonlySet<string> = new Set()
): RankedEvent {
  const reasons: string[] = [];
  let score = 35;

  const normalizedCountry = normalizeText(profile.country);
  const eventCountry = normalizeText(event.country);
  const profileRole = normalizeText(profile.role);
  const eventTags = event.tags.map(normalizeText);
  const profileInterests = uniqueStrings(profile.interests);

  if (normalizedCountry === eventCountry) {
    score += 28;
    reasons.push(`Ocurre en ${event.country}, el país seleccionado.`);
  }

  if (eventTags.includes(profileRole)) {
    score += 18;
    reasons.push(`El contenido encaja con tu rol de ${profile.role}.`);
  }

  if (levelMatch(profile.level, event.level)) {
    score += 16;
    reasons.push(`El nivel sugerido (${event.level}) coincide con tu experiencia.`);
  }

  const matchedInterests = profileInterests.filter((interest) => eventTags.includes(interest));
  if (matchedInterests.length > 0) {
    score += Math.min(20, matchedInterests.length * 8);
    reasons.push(`Coincide con tus intereses en ${matchedInterests.join(', ')}.`);
  }

  const dateDistance = daysUntil(event.date);
  if (dateDistance >= 0 && dateDistance <= 7) {
    score += 10;
    reasons.push('Ocurre esta semana, así que es relevante para actuar pronto.');
  } else if (dateDistance >= 0 && dateDistance <= 21) {
    score += 6;
    reasons.push('Está cerca en el calendario y vale la pena tenerlo en radar.');
  } else if (dateDistance < -7) {
    // Eventos que ya sucedieron hace más de una semana caen al fondo del
    // radar: queremos cubrir la actividad del chapter, pero no inflar el
    // top con cosas que no se pueden asistir.
    const penalty = Math.min(35, 20 + Math.floor(Math.abs(dateDistance) / 30) * 5);
    score -= penalty;
    reasons.push(`Ya sucedió hace ${Math.abs(dateDistance)} días; queda como referencia al final del radar.`);
  }

  // "Trending" es la señal combinada de: (a) marca explícita del fetcher o
  // (b) actividad reciente de la comunidad (favoritos + RSVPs) medida en
  // la API antes de llamar a rankEvents. Así el ranking reacciona a lo
  // que la gente está guardando en serio, no a una bandera estática.
  const isTrending = event.trending === true || trendingIds.has(event.id);
  if (isTrending) {
    score += 10;
    reasons.push('La comunidad lo está marcando como favorito o confirmando asistencia.');
  } else if (event.source === 'gdg') {
    score += 6;
  }

  score = Math.max(10, Math.min(100, score));

  const badges = buildBadges(score, event, isTrending);
  const summary = buildSummary(event);

  return {
    ...event,
    score,
    summary,
    reasons: reasons.length ? reasons : ['Aporta variedad a tu radar de eventos tecnológicos.'],
    badges,
    rankLabel: labelForScore(score)
  };
}

function buildBadges(score: number, event: TechEvent, isTrending: boolean): string[] {
  const badges = [];

  if (score >= 85) {
    badges.push('Para ti');
  }

  if (isTrending) {
    badges.push('Trending');
  }

  if (event.source === 'gdg') {
    badges.push('GDG');
  }

  if (event.source === 'meetup') {
    badges.push('Meetup');
  }

  if (event.source === 'eventbrite') {
    badges.push('Eventbrite');
  }

  return badges;
}

function labelForScore(score: number): string {
  if (score >= 85) return 'Muy relevante';
  if (score >= 70) return 'Recomendado';
  if (score >= 55) return 'Explorar';
  return 'Descubrir';
}

function levelMatch(profileLevel: UserProfile['level'], eventLevel: Level): boolean {
  if (eventLevel === 'all') return true;
  if (profileLevel === eventLevel) return true;

  if (profileLevel === 'senior' && eventLevel !== 'junior') return true;
  if (profileLevel === 'mid' && eventLevel !== 'senior') return true;

  return profileLevel === 'junior' && eventLevel === 'junior';
}

function buildSummary(event: TechEvent): string {
  const provided = event.summary?.trim();
  if (provided) return provided;

  // Fallback defensivo: event-processing debería haber llenado `summary`
  // siempre vía inferFromHeuristics, pero si llega un evento "crudo" (p. ej.
  // memoria volátil o tests), al menos no echamos el título encima.
  const tags = event.tags.filter((tag) => tag !== 'tech').slice(0, 2);
  if (tags.length > 0) {
    return `Encuentro tech sobre ${tags.join(' y ')} con la comunidad local.`;
  }
  return 'Encuentro de la comunidad tech de la región.';
}

function daysUntil(dateIso: string): number {
  const now = new Date();
  const eventDate = new Date(dateIso);
  const diff = eventDate.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function parseChatInterpretation(message: string, knownCities: string[] = []): ChatInterpretation {
  const normalized = normalizeText(message);
  const interests = INTEREST_KEYWORDS.filter((keyword) => normalized.includes(keyword));
  const role = Object.entries(ROLE_KEYWORDS).find(([keyword]) => normalized.includes(keyword))?.[1];
  const level = Object.entries(LEVEL_KEYWORDS).find(([keyword]) => normalized.includes(keyword))?.[1];
  const country = COUNTRY_KEYWORDS.find(([keyword]) => normalized.includes(keyword))?.[1];

  // Match the longest city name first so "santo domingo" wins over "santo".
  const city = [...knownCities]
    .filter((name) => name && name.trim())
    .sort((a, b) => b.length - a.length)
    .find((name) => normalized.includes(normalizeText(name)));

  let timeWindowDays = 30;
  if (normalized.includes('esta semana') || normalized.includes('semana')) {
    timeWindowDays = 7;
  } else if (normalized.includes('mes')) {
    timeWindowDays = 30;
  } else if (normalized.includes('hoy') || normalized.includes('ahora')) {
    timeWindowDays = 3;
  }

  return {
    originalMessage: message,
    country,
    city,
    role,
    level,
    interests: [...new Set(interests)],
    timeWindowDays
  };
}

export function filterByInterpretation(events: TechEvent[], interpretation: ChatInterpretation): TechEvent[] {
  const today = new Date();

  return events.filter((event) => {
    const eventDate = new Date(event.date);
    const days = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const countryOk = interpretation.country ? normalizeText(event.country) === normalizeText(interpretation.country) : true;
    const cityOk = interpretation.city ? normalizeText(event.city) === normalizeText(interpretation.city) : true;
    const levelOk = interpretation.level ? levelMatch(interpretation.level, event.level) : true;
    const interestOk = interpretation.interests.length > 0 ? interpretation.interests.some((interest) => event.tags.map(normalizeText).includes(interest)) : true;
    const timeOk = days >= 0 && days <= interpretation.timeWindowDays;

    return countryOk && cityOk && levelOk && interestOk && timeOk;
  });
}

export async function generateChatAnswer(message: string, events: RankedEvent[], interpretation: ChatInterpretation): Promise<string> {
  const prompt = [
    'Resume en español una búsqueda de eventos tech en Latinoamérica.',
    `Mensaje del usuario: ${message}`,
    `Filtros detectados: ${JSON.stringify(interpretation)}`,
    `Eventos encontrados: ${events.map((event) => `${event.title} (${event.city}, ${event.country})`).join('; ')}`,
    'Incluye una explicación breve y accionable.'
  ].join('\n');

  return generateText(prompt);
}

export function buildRecommendationContext(profile: UserProfile, events: RankedEvent[]) {
  return {
    profile,
    total: events.length,
    topMatch: events[0]?.title ?? null,
    trending: events.filter((event) => event.badges.includes('Trending')).length,
    selected: events.slice(0, 6)
  };
}
