import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  LayoutAnimation,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { EMPTY_FILTERS, FilterBar, type HomeFilters } from '../../components/FilterBar';
import { getFavorites, getRecommendations, toggleFavorite } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { relativeDateLabel, formatShortDate } from '../../lib/date';
import { selectionTick, lightImpact } from '../../lib/haptics';
import { useProfile } from '../../lib/profile';
import { theme } from '../../lib/theme';
import type { RankedEvent, RecommendationsResponse } from '../../lib/types';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function Home() {
  const { user } = useAuth();
  const { profile, ready } = useProfile();
  const [data, setData] = useState<RecommendationsResponse | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<HomeFilters>(EMPTY_FILTERS);

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
    lightImpact();
    await load();
    setRefreshing(false);
  };

  const handleToggleFavorite = async (eventId: string) => {
    selectionTick();
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

  const availableCountries = useMemo(
    () => [...new Set(events.map((e) => e.country).filter(Boolean))].sort(),
    [events]
  );
  const availableSources = useMemo(
    () => [...new Set(events.map((e) => e.source).filter(Boolean))].sort(),
    [events]
  );

  const normalizedQuery = query.trim().toLowerCase();
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (filters.country && event.country !== filters.country) return false;
      if (filters.source && event.source !== filters.source) return false;
      if (filters.favoritesOnly && !favorites.has(event.id)) return false;
      if (normalizedQuery) {
        const hay = [
          event.title,
          event.description,
          event.summary,
          event.city,
          event.country,
          event.source,
          (event.tags ?? []).join(' ')
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(normalizedQuery)) return false;
      }
      return true;
    });
  }, [events, normalizedQuery, filters, favorites]);

  const handleFiltersChange = useCallback((next: HomeFilters) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFilters(next);
  }, []);

  const hasActiveFilter = Boolean(filters.country || filters.source || filters.favoritesOnly);

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
        data={filteredEvents}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.colors.accent} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.eyebrow}>RADAR</Text>
            <Text style={styles.title}>Recomendaciones para ti</Text>
            <Text style={styles.subtitle}>{headerSubtitle}</Text>

            <View style={styles.searchWrapper}>
              <Text style={styles.searchGlyph}>⌕</Text>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Buscar por título, ciudad, tag…"
                placeholderTextColor={theme.colors.muted}
                style={styles.searchInput}
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {query.length > 0 ? (
                <Pressable onPress={() => setQuery('')} hitSlop={8}>
                  <Text style={styles.searchClear}>✕</Text>
                </Pressable>
              ) : null}
            </View>

            <FilterBar
              filters={filters}
              onChange={handleFiltersChange}
              availableCountries={availableCountries}
              availableSources={availableSources}
              favoritesCount={favorites.size}
            />

            {!normalizedQuery && !hasActiveFilter && top ? <TopCard event={top} /> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Text style={[styles.eyebrow, styles.listLabel]}>
              {normalizedQuery || hasActiveFilter
                ? `RESULTADOS (${filteredEvents.length})`
                : 'LISTA COMPLETA'}
            </Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 25).duration(180)}>
            <EventRow
              event={item}
              favorite={favorites.has(item.id)}
              onToggleFavorite={() => handleToggleFavorite(item.id)}
            />
          </Animated.View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.subtitle}>
              {normalizedQuery
                ? 'Sin resultados para tu búsqueda. Prueba con otra palabra.'
                : 'Todavía no hay eventos. Baja para actualizar.'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function TopCard({ event }: { event: RankedEvent }) {
  const relative = relativeDateLabel(event.date);
  const short = formatShortDate(event.date);

  return (
    <Link href={{ pathname: '/event/[id]', params: { id: event.id } }} asChild>
      <Pressable style={styles.topCard}>
        <Text style={styles.topLabel}>MEJOR COINCIDENCIA · score {event.score}</Text>
        <Text style={styles.topTitle} numberOfLines={2}>
          {event.title}
        </Text>
        {relative ? (
          <View style={styles.dateRow}>
            <View style={styles.dateChip}>
              <Text style={styles.dateChipText}>{relative}</Text>
            </View>
            <Text style={styles.dateFull}>{short}</Text>
          </View>
        ) : null}
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
  const relative = relativeDateLabel(event.date);

  return (
    <View style={styles.row}>
      <Link href={{ pathname: '/event/[id]', params: { id: event.id } }} asChild>
        <Pressable style={styles.rowMain}>
          <Text style={styles.rowTitle} numberOfLines={2}>
            {event.title}
          </Text>
          <Text style={styles.rowMeta} numberOfLines={1}>
            {event.city}, {event.country}
            {relative ? ` · ${relative}` : ''}
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
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(2),
    paddingHorizontal: theme.space(3),
    paddingVertical: theme.space(2),
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderColor: theme.colors.border,
    borderWidth: 1,
    marginTop: theme.space(1)
  },
  searchGlyph: { color: theme.colors.muted, fontSize: 18 },
  searchInput: { flex: 1, color: theme.colors.textPrimary, fontSize: 14, paddingVertical: theme.space(1) },
  searchClear: { color: theme.colors.muted, fontSize: 14, paddingHorizontal: theme.space(1) },
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
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space(2) },
  dateChip: {
    paddingHorizontal: theme.space(2),
    paddingVertical: theme.space(1),
    backgroundColor: theme.colors.accentSoft,
    borderRadius: theme.radius.sm
  },
  dateChipText: { color: theme.colors.textPrimary, fontSize: 12, fontWeight: '600' },
  dateFull: { color: theme.colors.muted, fontSize: 12 },
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
