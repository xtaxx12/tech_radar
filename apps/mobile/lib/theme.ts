export const theme = {
  colors: {
    background: '#0b1020',
    surface: '#121a33',
    surfaceAlt: '#1a2547',
    border: '#253265',
    textPrimary: '#ffffff',
    textSecondary: '#b7c1e3',
    muted: '#8893bd',
    accent: '#7c9cff',
    accentSoft: '#2d3e7d',
    danger: '#ff6363',
    success: '#4ade80'
  },
  radius: {
    sm: 8,
    md: 14,
    lg: 22,
    pill: 999
  },
  space: (n: number) => n * 4,
  fonts: {
    // Definidos cuando Inter se carga via expo-font en _layout.tsx.
    // Antes de la carga, fallback a system font.
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
    display: 'Inter_800ExtraBold'
  }
};

// Colores de marca por fuente de evento. Se usan para el borde izquierdo
// de las rows y hacen que el usuario distinga origen de un vistazo.
const SOURCE_COLORS: Record<string, string> = {
  gdg: '#4285f4',         // Google blue
  meetup: '#ed1c40',      // Meetup red
  eventbrite: '#f05537',  // Eventbrite orange
  community: '#7c9cff'    // fallback: accent
};

export function sourceColor(source: string | undefined | null): string {
  if (!source) return SOURCE_COLORS.community;
  return SOURCE_COLORS[source.toLowerCase()] ?? SOURCE_COLORS.community;
}

export function scoreColor(score: number): string {
  if (score >= 85) return theme.colors.accent;
  if (score >= 70) return '#a4b8ff';
  if (score >= 55) return '#b7c1e3';
  return theme.colors.muted;
}
