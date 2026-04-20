import type { TechEvent } from '../types.js';

const now = new Date();

function isoInDays(days: number, hour = 19): string {
  const date = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

export const meetupFallbackEvents: TechEvent[] = [
  {
    id: 'meetup-fallback-ecu-001',
    title: 'Meetup AI Builders Quito',
    description: 'Encuentro para builders de IA generativa y productos con LLMs.',
    date: isoInDays(5, 18),
    country: 'Ecuador',
    city: 'Quito',
    source: 'meetup',
    url: 'https://www.meetup.com/',
    link: 'https://www.meetup.com/',
    tags: ['ia', 'llm', 'backend'],
    level: 'mid',
    summary: 'Networking y charlas sobre cómo construir productos con IA en equipos técnicos.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'meetup-fallback-mex-001',
    title: 'Frontend Latam Meetup CDMX',
    description: 'Buenas prácticas para frontend moderno, performance y accesibilidad.',
    date: isoInDays(8, 19),
    country: 'México',
    city: 'Ciudad de México',
    source: 'meetup',
    url: 'https://www.meetup.com/',
    link: 'https://www.meetup.com/',
    tags: ['frontend', 'web', 'performance'],
    level: 'junior',
    summary: 'Sesiones para desarrolladores frontend sobre rendimiento y calidad en productos web.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const eventbriteFallbackEvents: TechEvent[] = [
  {
    id: 'eventbrite-fallback-per-001',
    title: 'Eventbrite Data & AI Lima',
    description: 'Taller de data products y análisis para equipos que construyen con datos.',
    date: isoInDays(10, 17),
    country: 'Perú',
    city: 'Lima',
    source: 'eventbrite',
    url: 'https://www.eventbrite.com/',
    link: 'https://www.eventbrite.com/',
    tags: ['data', 'ia', 'analytics'],
    level: 'mid',
    summary: 'Evento orientado a equipos de datos que quieren acelerar impacto con IA aplicada.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'eventbrite-fallback-col-001',
    title: 'Eventbrite Cloud Native Bogotá',
    description: 'Arquitectura cloud, observabilidad y despliegue continuo para plataformas modernas.',
    date: isoInDays(14, 18),
    country: 'Colombia',
    city: 'Bogotá',
    source: 'eventbrite',
    url: 'https://www.eventbrite.com/',
    link: 'https://www.eventbrite.com/',
    tags: ['cloud', 'devops', 'backend'],
    level: 'senior',
    summary: 'Contenido técnico sobre prácticas cloud-native para backend y devops.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const gdgFallbackEvents: TechEvent[] = [
  {
    id: 'gdg-fallback-chi-001',
    title: 'GDG Santiago AI Community Night',
    description: 'Charlas y comunidad sobre IA aplicada, producto y desarrollo de software.',
    date: isoInDays(6, 18),
    country: 'Chile',
    city: 'Santiago',
    source: 'gdg',
    url: 'https://gdg.community.dev/',
    link: 'https://gdg.community.dev/',
    tags: ['ia', 'product', 'web'],
    level: 'all',
    summary: 'Encuentro de comunidad para compartir casos de IA en productos digitales.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'gdg-fallback-arg-001',
    title: 'GDG Buenos Aires Web Performance',
    description: 'Optimización web, experiencia de usuario y arquitectura frontend.',
    date: isoInDays(12, 19),
    country: 'Argentina',
    city: 'Buenos Aires',
    source: 'gdg',
    url: 'https://gdg.community.dev/',
    link: 'https://gdg.community.dev/',
    tags: ['web', 'frontend', 'ux'],
    level: 'all',
    summary: 'Evento para quienes buscan mejorar performance y experiencia en frontend.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];
