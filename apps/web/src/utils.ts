export function formatLongDate(value: string): string {
  return new Intl.DateTimeFormat('es-419', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

export function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat('es-419', {
    day: 'numeric',
    month: 'short'
  }).format(new Date(value));
}

/** Normalizes ALL CAPS titles to sentence case, preserving acronyms (AI, GDG, etc.) */
export function normalizeTitle(title: string): string {
  if (!title) return title;
  // Only transform if >50% uppercase (i.e., scraped ALL CAPS)
  const letters = title.replace(/[^a-zA-ZáéíóúñÁÉÍÓÚÑ]/g, '');
  const upper = letters.replace(/[^A-ZÁÉÍÓÚÑ]/g, '');
  if (letters.length === 0 || upper.length / letters.length < 0.5) return title;

  const ACRONYMS = /^(AI|IA|GDG|API|AWS|GCP|ML|LAN|SDK|UI|UX|USFQ|ESPE|LATAM|QA|CI|CD|HTTP|REST|SQL|CSS|HTML|JS|TS)$/i;

  return title
    .split(/(\s+|[-:])/)
    .map((segment, i) => {
      if (/^[\s\-:]+$/.test(segment)) return segment;
      if (ACRONYMS.test(segment)) return segment.toUpperCase();
      if (i === 0) return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
      return segment.toLowerCase();
    })
    .join('');
}
