export function formatLongDate(value: string): string {
  return new Intl.DateTimeFormat('es-419', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}
