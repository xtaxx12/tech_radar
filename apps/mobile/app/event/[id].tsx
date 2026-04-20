import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FavoriteButton } from '../../components/FavoriteButton';
import { ScoreBadge } from '../../components/ScoreBadge';
import { getEvent, getFavorites, toggleFavorite, toggleRsvp } from '../../lib/api';
import { formatLongDate, relativeDateLabel } from '../../lib/date';
import { lightImpact, selectionTick, success } from '../../lib/haptics';
import { useProfile } from '../../lib/profile';
import { sourceColor, theme } from '../../lib/theme';
import { deshout } from '../../lib/text';
import type { TechEvent } from '../../lib/types';

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useProfile();
  const [event, setEvent] = useState<TechEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favorite, setFavorite] = useState(false);
  const [rsvp, setRsvp] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [{ event: eventData }, favs] = await Promise.all([
        getEvent(id, profile),
        getFavorites().catch(() => null)
      ]);
      setEvent(eventData);
      if (favs) {
        setFavorite(favs.favorites.includes(id));
        setRsvp(favs.rsvp.includes(id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos cargar el evento.');
    } finally {
      setLoading(false);
    }
  }, [id, profile]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleFav = async () => {
    if (!id) return;
    const prev = favorite;
    setFavorite(!prev);
    try {
      const result = await toggleFavorite(id);
      setFavorite(result.active);
      if (result.active) success();
    } catch {
      setFavorite(prev);
    }
  };

  const handleRsvp = async () => {
    if (!id) return;
    selectionTick();
    const prev = rsvp;
    setRsvp(!prev);
    try {
      const result = await toggleRsvp(id);
      setRsvp(result.active);
      if (result.active) success();
    } catch {
      setRsvp(prev);
    }
  };

  const openExternal = () => {
    lightImpact();
    if (event?.url) Linking.openURL(event.url).catch(() => {});
  };

  const handleShare = async () => {
    if (!event) return;
    lightImpact();
    try {
      await Share.share({
        title: event.title,
        message: `${event.title}\n${event.city}, ${event.country}\n${event.url}`,
        url: event.url
      });
    } catch {
      // usuario canceló
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !event) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.error}>{error ?? 'Evento no encontrado.'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const relative = relativeDateLabel(event.date);
  const longDate = formatLongDate(event.date);
  const title = deshout(event.title);
  const accent = sourceColor(event.source);

  // ranked score no viaja en TechEvent, solo en RankedEvent. El endpoint de
  // detalle sí lo devuelve enriquecido, así que lo tomamos de ahí si existe.
  const score = (event as unknown as { score?: number }).score;

  return (
    <ScrollView style={styles.safe} contentContainerStyle={styles.content}>
      <LinearGradient
        colors={['#1b2649', 'transparent']}
        style={[styles.gradientHeader, { borderLeftColor: accent }]}
      >
        <View style={styles.headerRow}>
          <Text style={[styles.eyebrow, { color: accent }]}>{event.source.toUpperCase()}</Text>
          {typeof score === 'number' ? <ScoreBadge score={score} size={56} /> : null}
        </View>
        <Text style={styles.title}>{title}</Text>

        {relative ? (
          <View style={styles.dateBlock}>
            <View style={[styles.dateChip, { backgroundColor: `${accent}22`, borderColor: `${accent}55` }]}>
              <Text style={styles.dateChipText}>{relative}</Text>
            </View>
            <Text style={styles.dateLong}>{longDate}</Text>
          </View>
        ) : (
          <Text style={styles.meta}>{longDate}</Text>
        )}

        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={14} color={theme.colors.muted} />
          <Text style={styles.meta}>
            {event.city}, {event.country}
          </Text>
        </View>
      </LinearGradient>

      {event.tags?.length ? (
        <View style={styles.tagsRow}>
          {event.tags.slice(0, 6).map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {event.summary ? (
        <Section label="Resumen IA">
          <Text style={styles.body}>{event.summary}</Text>
        </Section>
      ) : null}

      <Section label="Descripción">
        <Text style={styles.body}>{event.description}</Text>
      </Section>

      <View style={styles.actions}>
        <Pressable style={[styles.action, favorite && styles.actionActive]} onPress={handleFav}>
          <FavoriteButton active={favorite} onToggle={handleFav} size={20} />
          <Text style={[styles.actionText, favorite && styles.actionTextActive]}>
            {favorite ? 'Guardado' : 'Guardar'}
          </Text>
        </Pressable>
        <Pressable style={[styles.action, rsvp && styles.actionActive]} onPress={handleRsvp}>
          <Ionicons
            name={rsvp ? 'checkmark-circle' : 'calendar-outline'}
            size={20}
            color={rsvp ? theme.colors.textPrimary : theme.colors.textSecondary}
          />
          <Text style={[styles.actionText, rsvp && styles.actionTextActive]}>
            {rsvp ? 'Iré' : 'Marcar RSVP'}
          </Text>
        </Pressable>
      </View>

      <Pressable style={styles.secondary} onPress={handleShare}>
        <Ionicons name="share-outline" size={18} color={theme.colors.textPrimary} />
        <Text style={styles.secondaryText}>Compartir evento</Text>
      </Pressable>

      <Pressable style={styles.primary} onPress={openExternal}>
        <Text style={styles.primaryText}>Abrir en {event.source}</Text>
        <Ionicons name="arrow-forward" size={18} color={theme.colors.background} />
      </Pressable>
    </ScrollView>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingBottom: theme.space(12) },
  gradientHeader: {
    padding: theme.space(5),
    gap: theme.space(3),
    borderLeftWidth: 4
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space(3)
  },
  eyebrow: {
    fontSize: 12,
    letterSpacing: 2,
    fontFamily: theme.fonts.semibold
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 28,
    lineHeight: 34,
    fontFamily: theme.fonts.bold,
    letterSpacing: -0.5
  },
  dateBlock: { flexDirection: 'row', alignItems: 'center', gap: theme.space(2), flexWrap: 'wrap' },
  dateChip: {
    paddingHorizontal: theme.space(2),
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
    borderWidth: 1
  },
  dateChipText: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontFamily: theme.fonts.semibold
  },
  dateLong: {
    color: theme.colors.muted,
    fontSize: 13,
    textTransform: 'capitalize',
    fontFamily: theme.fonts.regular
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space(1) },
  meta: { color: theme.colors.muted, fontSize: 13, fontFamily: theme.fonts.regular },

  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space(2),
    paddingHorizontal: theme.space(5),
    marginTop: theme.space(3)
  },
  tag: {
    paddingHorizontal: theme.space(3),
    paddingVertical: 6,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.pill,
    borderColor: theme.colors.border,
    borderWidth: 1
  },
  tagText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontFamily: theme.fonts.medium
  },

  section: {
    gap: theme.space(2),
    marginTop: theme.space(4),
    paddingHorizontal: theme.space(5)
  },
  sectionLabel: {
    color: theme.colors.muted,
    fontSize: 11,
    letterSpacing: 2,
    fontFamily: theme.fonts.semibold
  },
  body: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: theme.fonts.regular
  },

  actions: {
    flexDirection: 'row',
    gap: theme.space(3),
    marginTop: theme.space(5),
    paddingHorizontal: theme.space(5)
  },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space(2),
    paddingVertical: theme.space(3),
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface
  },
  actionActive: { borderColor: theme.colors.accent, backgroundColor: theme.colors.accentSoft },
  actionText: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.semibold,
    fontSize: 14
  },
  actionTextActive: { color: theme.colors.textPrimary },

  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space(2),
    marginTop: theme.space(3),
    marginHorizontal: theme.space(5),
    backgroundColor: theme.colors.surface,
    paddingVertical: theme.space(3),
    borderRadius: theme.radius.md,
    borderColor: theme.colors.border,
    borderWidth: 1
  },
  secondaryText: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontFamily: theme.fonts.semibold
  },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space(2),
    marginTop: theme.space(3),
    marginHorizontal: theme.space(5),
    backgroundColor: theme.colors.accent,
    paddingVertical: theme.space(4),
    borderRadius: theme.radius.md,
    shadowColor: theme.colors.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 6
  },
  primaryText: {
    color: theme.colors.background,
    fontSize: 15,
    fontFamily: theme.fonts.bold
  },

  error: { color: theme.colors.danger, fontFamily: theme.fonts.regular }
});
