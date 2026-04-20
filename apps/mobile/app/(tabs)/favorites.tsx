import { Ionicons } from '@expo/vector-icons';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { FavoriteButton } from '../../components/FavoriteButton';
import { ScoreBadge } from '../../components/ScoreBadge';
import { EventCardSkeleton } from '../../components/Skeleton';
import { getAllEvents, getFavorites, toggleFavorite } from '../../lib/api';
import { formatShortDate, relativeDateLabel } from '../../lib/date';
import { lightImpact, warning } from '../../lib/haptics';
import { useProfile } from '../../lib/profile';
import { sourceColor, theme } from '../../lib/theme';
import { deshout } from '../../lib/text';
import type { RankedEvent } from '../../lib/types';

export default function Favorites() {
  const { profile } = useProfile();
  const [events, setEvents] = useState<RankedEvent[]>([]);
  const [, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [allResponse, favs] = await Promise.all([getAllEvents(profile), getFavorites()]);
      const favIds = new Set(favs.favorites);
      setFavoriteIds(favIds);
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
    warning();
    const prev = events;
    setEvents((current) => current.filter((event) => event.id !== eventId));
    try {
      await toggleFavorite(eventId);
    } catch {
      setEvents(prev);
      void load();
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.loadingContent}>
          <View style={styles.header}>
            <Text style={styles.eyebrow}>TUS GUARDADOS</Text>
            <Text style={styles.title}>Favoritos</Text>
          </View>
          <EventCardSkeleton />
          <EventCardSkeleton />
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
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.accent}
            colors={[theme.colors.accent]}
          />
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
            <FavoriteCard event={item} onRemove={() => handleRemove(item.id)} />
          </Animated.View>
        )}
        ItemSeparatorComponent={() => <View style={styles.gap} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="star-outline" size={56} color={theme.colors.muted} />
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

function FavoriteCard({ event, onRemove }: { event: RankedEvent; onRemove: () => void }) {
  const relative = relativeDateLabel(event.date);
  const title = deshout(event.title);
  const accent = sourceColor(event.source);

  return (
    <View style={[styles.card, { borderLeftColor: accent }]}>
      <Link href={{ pathname: '/event/[id]', params: { id: event.id } }} asChild>
        <Pressable style={styles.cardMain}>
          <View style={styles.cardTopRow}>
            <Text style={styles.sourceTag}>{event.source.toUpperCase()}</Text>
            <ScoreBadge score={event.score} size={40} />
          </View>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {title}
          </Text>
          <View style={styles.cardMetaRow}>
            {relative ? (
              <View style={[styles.dateChip, { backgroundColor: `${accent}22`, borderColor: `${accent}55` }]}>
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
      <View style={styles.removeButton}>
        <FavoriteButton active={true} onToggle={onRemove} size={22} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  loadingContent: { padding: theme.space(5), gap: theme.space(4) },
  listContent: { padding: theme.space(5), paddingBottom: theme.space(16) },
  header: { gap: theme.space(2), marginBottom: theme.space(4) },
  eyebrow: {
    color: theme.colors.accent,
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
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: theme.fonts.regular
  },
  error: { color: theme.colors.danger, fontSize: 13, marginTop: theme.space(2), fontFamily: theme.fonts.regular },
  gap: { height: theme.space(3) },

  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.space(2),
    padding: theme.space(4),
    paddingLeft: theme.space(4),
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderLeftWidth: 3
  },
  cardMain: { flex: 1, gap: theme.space(2) },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sourceTag: {
    color: theme.colors.muted,
    fontSize: 10,
    letterSpacing: 2,
    fontFamily: theme.fonts.semibold
  },
  cardTitle: {
    color: theme.colors.textPrimary,
    fontSize: 17,
    lineHeight: 22,
    fontFamily: theme.fonts.semibold,
    letterSpacing: -0.3
  },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space(2), flexWrap: 'wrap' },
  dateChip: {
    paddingHorizontal: theme.space(2),
    paddingVertical: 3,
    borderRadius: theme.radius.pill,
    borderWidth: 1
  },
  dateChipText: {
    color: theme.colors.textPrimary,
    fontSize: 11,
    fontFamily: theme.fonts.semibold
  },
  cardMeta: { color: theme.colors.muted, fontSize: 12, flexShrink: 1, fontFamily: theme.fonts.regular },
  cardSummary: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: theme.fonts.regular
  },
  removeButton: { justifyContent: 'flex-start', paddingTop: 2 },

  empty: { alignItems: 'center', paddingVertical: theme.space(10), gap: theme.space(2) },
  emptyTitle: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontFamily: theme.fonts.semibold
  }
});
