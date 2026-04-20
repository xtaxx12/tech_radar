import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { getAllEvents, getFavorites, toggleFavorite } from '../../lib/api';
import { formatShortDate, relativeDateLabel } from '../../lib/date';
import { lightImpact, selectionTick, warning } from '../../lib/haptics';
import { useProfile } from '../../lib/profile';
import { theme } from '../../lib/theme';
import type { RankedEvent } from '../../lib/types';

export default function Favorites() {
  const { profile } = useProfile();
  const [events, setEvents] = useState<RankedEvent[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [allResponse, favs] = await Promise.all([getAllEvents(profile), getFavorites()]);
      const favIds = new Set(favs.favorites);
      setFavorites(favIds);
      setEvents(allResponse.events.filter((event) => favIds.has(event.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos cargar tus favoritos.');
    }
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      load().finally(() => {
        if (active) setLoading(false);
      });
      return () => {
        active = false;
      };
    }, [load])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    lightImpact();
    await load();
    setRefreshing(false);
  };

  const handleRemove = async (eventId: string) => {
    selectionTick();
    warning();
    const prev = favorites;
    const nextFavs = new Set(prev);
    nextFavs.delete(eventId);
    setFavorites(nextFavs);
    setEvents((current) => current.filter((event) => event.id !== eventId));

    try {
      await toggleFavorite(eventId);
    } catch {
      setFavorites(prev);
      void load();
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

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.colors.accent} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.eyebrow}>TUS GUARDADOS</Text>
            <Text style={styles.title}>Favoritos</Text>
            <Text style={styles.subtitle}>
              {events.length === 0
                ? 'Guarda eventos desde el radar para verlos aquí.'
                : `${events.length} evento${events.length === 1 ? '' : 's'} en tu lista.`}
            </Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeIn.delay(index * 30).duration(220)}>
            <EventCard event={item} onRemove={() => handleRemove(item.id)} />
          </Animated.View>
        )}
        ItemSeparatorComponent={() => <View style={styles.gap} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>☆</Text>
            <Text style={styles.emptyTitle}>Sin favoritos todavía</Text>
            <Text style={styles.subtitle}>
              Tap en la estrella de cualquier evento para guardarlo aquí.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function EventCard({ event, onRemove }: { event: RankedEvent; onRemove: () => void }) {
  const relative = relativeDateLabel(event.date);

  return (
    <View style={styles.card}>
      <Link href={{ pathname: '/event/[id]', params: { id: event.id } }} asChild>
        <Pressable style={styles.cardMain}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {event.title}
          </Text>
          <View style={styles.cardMetaRow}>
            {relative ? (
              <View style={styles.dateChip}>
                <Text style={styles.dateChipText}>{relative}</Text>
              </View>
            ) : null}
            <Text style={styles.cardMeta} numberOfLines={1}>
              {event.city}, {event.country} · {formatShortDate(event.date)}
            </Text>
          </View>
          {event.summary ? (
            <Text style={styles.cardSummary} numberOfLines={2}>
              {event.summary}
            </Text>
          ) : null}
        </Pressable>
      </Link>
      <Pressable style={styles.removeButton} onPress={onRemove} hitSlop={8}>
        <Text style={styles.removeText}>★</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: theme.space(5), paddingBottom: theme.space(16) },
  header: { gap: theme.space(2), marginBottom: theme.space(4) },
  eyebrow: { color: theme.colors.accent, fontSize: 12, letterSpacing: 2 },
  title: { color: theme.colors.textPrimary, fontSize: 26, fontWeight: '700' },
  subtitle: { color: theme.colors.textSecondary, fontSize: 14, lineHeight: 20 },
  error: { color: theme.colors.danger, fontSize: 13, marginTop: theme.space(2) },
  gap: { height: theme.space(3) },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.space(3),
    padding: theme.space(4),
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderColor: theme.colors.border,
    borderWidth: 1
  },
  cardMain: { flex: 1, gap: theme.space(2) },
  cardTitle: { color: theme.colors.textPrimary, fontSize: 16, fontWeight: '600' },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space(2), flexWrap: 'wrap' },
  dateChip: {
    paddingHorizontal: theme.space(2),
    paddingVertical: 2,
    backgroundColor: theme.colors.accentSoft,
    borderRadius: theme.radius.sm
  },
  dateChipText: { color: theme.colors.textPrimary, fontSize: 11, fontWeight: '600' },
  cardMeta: { color: theme.colors.muted, fontSize: 12, flexShrink: 1 },
  cardSummary: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 18 },
  removeButton: { padding: theme.space(1) },
  removeText: { color: theme.colors.accent, fontSize: 20 },
  empty: { alignItems: 'center', paddingVertical: theme.space(10), gap: theme.space(2) },
  emptyEmoji: { fontSize: 48, color: theme.colors.muted },
  emptyTitle: { color: theme.colors.textPrimary, fontSize: 18, fontWeight: '600' }
});
