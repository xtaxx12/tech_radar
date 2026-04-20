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
import { getEvent, getFavorites, toggleFavorite, toggleRsvp } from '../../lib/api';
import { formatLongDate, relativeDateLabel } from '../../lib/date';
import { lightImpact, selectionTick, success } from '../../lib/haptics';
import { useProfile } from '../../lib/profile';
import { theme } from '../../lib/theme';
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
    selectionTick();
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

  return (
    <ScrollView style={styles.safe} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>{event.source.toUpperCase()}</Text>
      <Text style={styles.title}>{event.title}</Text>

      {relative ? (
        <View style={styles.dateBlock}>
          <View style={styles.dateChip}>
            <Text style={styles.dateChipText}>{relative}</Text>
          </View>
          <Text style={styles.dateLong}>{longDate}</Text>
        </View>
      ) : (
        <Text style={styles.meta}>{longDate}</Text>
      )}

      <Text style={styles.meta}>
        {event.city}, {event.country}
      </Text>

      {event.tags?.length ? (
        <View style={styles.tagsRow}>
          {event.tags.slice(0, 5).map((tag) => (
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
          <Text style={[styles.actionText, favorite && styles.actionTextActive]}>
            {favorite ? '★ Guardado' : '☆ Guardar'}
          </Text>
        </Pressable>
        <Pressable style={[styles.action, rsvp && styles.actionActive]} onPress={handleRsvp}>
          <Text style={[styles.actionText, rsvp && styles.actionTextActive]}>
            {rsvp ? '✓ Iré' : 'Marcar RSVP'}
          </Text>
        </Pressable>
      </View>

      <Pressable style={styles.secondary} onPress={handleShare}>
        <Text style={styles.secondaryText}>Compartir evento</Text>
      </Pressable>

      <Pressable style={styles.primary} onPress={openExternal}>
        <Text style={styles.primaryText}>Abrir en {event.source}</Text>
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
  content: { padding: theme.space(5), paddingBottom: theme.space(12), gap: theme.space(3) },
  eyebrow: { color: theme.colors.accent, fontSize: 12, letterSpacing: 2 },
  title: { color: theme.colors.textPrimary, fontSize: 26, fontWeight: '700' },
  dateBlock: { flexDirection: 'row', alignItems: 'center', gap: theme.space(2), flexWrap: 'wrap' },
  dateChip: {
    paddingHorizontal: theme.space(2),
    paddingVertical: theme.space(1),
    backgroundColor: theme.colors.accentSoft,
    borderRadius: theme.radius.sm
  },
  dateChipText: { color: theme.colors.textPrimary, fontSize: 12, fontWeight: '600' },
  dateLong: { color: theme.colors.muted, fontSize: 13, textTransform: 'capitalize' },
  meta: { color: theme.colors.muted, fontSize: 13 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space(2), marginTop: theme.space(1) },
  tag: {
    paddingHorizontal: theme.space(2),
    paddingVertical: theme.space(1),
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm
  },
  tagText: { color: theme.colors.textSecondary, fontSize: 12 },
  section: { gap: theme.space(1), marginTop: theme.space(3) },
  sectionLabel: { color: theme.colors.muted, fontSize: 12, letterSpacing: 1 },
  body: { color: theme.colors.textSecondary, fontSize: 15, lineHeight: 22 },
  actions: { flexDirection: 'row', gap: theme.space(3), marginTop: theme.space(4) },
  action: {
    flex: 1,
    paddingVertical: theme.space(3),
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    backgroundColor: theme.colors.surface
  },
  actionActive: { borderColor: theme.colors.accent, backgroundColor: theme.colors.accentSoft },
  actionText: { color: theme.colors.textSecondary, fontWeight: '600' },
  actionTextActive: { color: theme.colors.textPrimary },
  secondary: {
    marginTop: theme.space(2),
    backgroundColor: theme.colors.surface,
    paddingVertical: theme.space(3),
    borderRadius: theme.radius.md,
    borderColor: theme.colors.border,
    borderWidth: 1,
    alignItems: 'center'
  },
  secondaryText: { color: theme.colors.textPrimary, fontSize: 15, fontWeight: '600' },
  primary: {
    marginTop: theme.space(2),
    backgroundColor: theme.colors.accent,
    paddingVertical: theme.space(4),
    borderRadius: theme.radius.md,
    alignItems: 'center'
  },
  primaryText: { color: theme.colors.background, fontSize: 15, fontWeight: '700' },
  error: { color: theme.colors.danger }
});
