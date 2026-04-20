const DAY_MS = 24 * 60 * 60 * 1000;

function safeDate(iso: string): Date | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function daysUntil(iso: string): number | null {
  const target = safeDate(iso);
  if (!target) return null;
  return Math.round((startOfDay(target) - startOfDay(new Date())) / DAY_MS);
}

export function relativeDateLabel(iso: string): string {
  const days = daysUntil(iso);
  if (days === null) return '';
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Mañana';
  if (days === -1) return 'Ayer';
  if (days > 0 && days < 7) return `En ${days} días`;
  if (days >= 7 && days < 14) return 'En 1 semana';
  if (days >= 14 && days < 30) return `En ${Math.round(days / 7)} semanas`;
  if (days >= 30 && days < 60) return 'En 1 mes';
  if (days >= 60) return `En ${Math.round(days / 30)} meses`;
  if (days < 0 && days > -7) return `Hace ${Math.abs(days)} días`;
  return 'Pasado';
}

export function formatShortDate(iso: string): string {
  const d = safeDate(iso);
  if (!d) return iso;
  return d.toLocaleDateString('es', { month: 'short', day: 'numeric' });
}

export function formatLongDate(iso: string): string {
  const d = safeDate(iso);
  if (!d) return iso;
  return d.toLocaleDateString('es', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}
