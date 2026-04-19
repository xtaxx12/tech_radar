export function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es-419', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  }).format(new Date(value));
}

export function formatLongDate(value: string): string {
  return new Intl.DateTimeFormat('es-419', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

export function badgeTone(label: string): 'accent' | 'success' | 'muted' {
  if (label === 'Para ti') return 'success';
  if (label === 'Trending') return 'accent';
  return 'muted';
}

export function clampList(items: string[], limit: number): string[] {
  return items.slice(0, limit);
}
