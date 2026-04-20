import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getFavorites, getRecommendations, toggleFavorite } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useProfile } from '../../lib/profile';
import { theme } from '../../lib/theme';
import type { RankedEvent, RecommendationsResponse } from '../../lib/types';

export default function Home() {
  const { user } = useAuth();
  const { profile, ready } = useProfile();
  const [data, setData] = useState<RecommendationsResponse | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [recs, favs] = await Promise.all([getRecommendations(profile, 30), getFavorites().catch(() => null)]);
      setData(recs);
      if (favs) setFavorites(new Set(favs.favorites));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos cargar eventos.');
    }
  }, [profile]);

  useEffect(() => {
    if (!ready) return;
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [ready, load]);

  useFocusEffect(
    useCallback(() => {
      if (!ready) return;
      getFavorites()
        .then((favs) => setFavorites(new Set(favs.favorites)))
        .catch(() => {});
    }, [ready])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleToggleFavorite = async (eventId: string) => {
    const previous = favorites;
    const next = new Set(previous);
    if (next.has(eventId)) next.delete(eventId);
    else next.add(eventId);
    setFavorites(next);

    try {
      await toggleFavorite(eventId);
    } catch {
      setFavorites(previous);
    }
  };

  const events = data?.events ?? [];
  const top = data?.recommendations?.[0] ?? null;

  const headerSubtitle = useMemo(() => {
    const name = user?.name?.split(' ')[0] ?? user?.email ?? 'tech';
    return `Hola ${name}, ${data?.context.total ?? 0} eventos en tu radar`;
  }, [user, data]);

  if (!ready || loading) {
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
            <Text style={styles.eyebrow}>RADAR</Text>
            <Text style={styles.title}>Recomendaciones para ti</Text>
            <Text style={styles.subtitle}>{headerSubtitle}</Text>
            {top ? <TopCard event={top} /> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Text style={[styles.eyebrow, styles.listLabel]}>LISTA COMPLETA</Text>
          </View>
        }
        renderItem={({ item }) => (
          <EventRow
            event={item}
            favorite={favorites.has(item.id)}
            onToggleFavorite={() => handleToggleFavorite(item.id)}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.subtitle}>Todavía no hay eventos. Baja para actualizar.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function TopCard({ event }: { event: RankedEvent }) {
  return (
    <Link href={{ pathname: '/event/[id]', params: { id: event.id } }} asChild>
      <Pressable style={styles.topCard}>
        <Text style={styles.topLabel}>MEJOR COINCIDENCIA · score {event.score}</Text>
        <Text style={styles.topTitle} numberOfLines={2}>
          {event.title}
        </Text>
        <Text style={styles.topMeta}>
          {event.city}, {event.country} · {event.source}
        </Text>
        <Text style={styles.topSummary} numberOfLines={3}>
          {event.summary || event.description}
        </Text>
        {event.reasons?.length ? <Text style={styles.topReasons}>· {event.reasons.slice(0, 2).join(' · ')}</Text> : null}
      </Pressable>
    </Link>
  );
}

function EventRow({
  event,
  favorite,
  onToggleFavorite
}: {
  event: RankedEvent;
  favorite: boolean;
  onToggleFavorite: () => void;
}) {
  return (
    <View style={styles.row}>
      <Link href={{ pathname: '/event/[id]', params: { id: event.id } }} asChild>
        <Pressable style={styles.rowMain}>
          <Text style={styles.rowTitle} numberOfLines={2}>
            {event.title}
          </Text>
          <Text style={styles.rowMeta} numberOfLines={1}>
            {event.city}, {event.country} · {event.rankLabel}
          </Text>
        </Pressable>
      </Link>
      <Pressable style={styles.favButton} onPress={onToggleFavorite} hitSlop={10}>
        <Text style={[styles.favGlyph, favorite && styles.favGlyphActive]}>{favorite ? '★' : '☆'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: theme.space(5), paddingBottom: theme.space(16) },
  header: { gap: theme.space(3), marginBottom: theme.space(4) },
  eyebrow: { color: theme.colors.accent, fontSize: 12, letterSpacing: 2 },
  listLabel: { marginTop: theme.space(6) },
  title: { color: theme.colors.textPrimary, fontSize: 26, fontWeight: '700' },
  subtitle: { color: theme.colors.textSecondary, fontSize: 14 },
  topCard: {
    backgroundColor: theme.colors.surface,
    padding: theme.space(5),
    borderRadius: theme.radius.lg,
    borderColor: theme.colors.border,
    borderWidth: 1,
    gap: theme.space(2)
  },
  topLabel: { color: theme.colors.accent, fontSize: 12, letterSpacing: 1 },
  topTitle: { color: theme.colors.textPrimary, fontSize: 20, fontWeight: '700' },
  topMeta: { color: theme.colors.muted, fontSize: 13 },
  topSummary: { color: theme.colors.textSecondary, fontSize: 14, lineHeight: 20 },
  topReasons: { color: theme.colors.accent, fontSize: 12, marginTop: theme.space(1) },
  separator: { height: 1, backgroundColor: theme.colors.border, opacity: 0.4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(3),
    paddingVertical: theme.space(3)
  },
  rowMain: { flex: 1, gap: 2 },
  rowTitle: { color: theme.colors.textPrimary, fontSize: 15, fontWeight: '600' },
  rowMeta: { color: theme.colors.muted, fontSize: 12 },
  favButton: { padding: theme.space(1) },
  favGlyph: { color: theme.colors.muted, fontSize: 24 },
  favGlyphActive: { color: theme.colors.accent },
  error: { color: theme.colors.danger, fontSize: 13 },
  empty: { padding: theme.space(6), alignItems: 'center' }
});
