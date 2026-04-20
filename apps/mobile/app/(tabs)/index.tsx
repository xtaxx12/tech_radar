import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
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
import { EventCardSkeleton } from '../../components/Skeleton';
import { FavoriteButton } from '../../components/FavoriteButton';
import { ScoreBadge } from '../../components/ScoreBadge';
import { EMPTY_FILTERS, FilterBar, type HomeFilters } from '../../components/FilterBar';
import { getFavorites, getRecommendations, toggleFavorite } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatShortDate, relativeDateLabel } from '../../lib/date';
import { lightImpact } from '../../lib/haptics';
import { useProfile } from '../../lib/profile';
import { sourceColor, theme } from '../../lib/theme';
import { deshout } from '../../lib/text';
import type { RankedEvent, RecommendationsResponse } from '../../lib/types';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SEARCH_HINTS = ['Flutter', 'IA', 'React', 'Quito', 'GDG', 'Data'];

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
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.loadingContent}>
          <View style={styles.header}>
            <Text style={styles.eyebrow}>RADAR</Text>
            <Text style={styles.title}>Recomendaciones para ti</Text>
            <Text style={styles.subtitle}>Preparando tu feed…</Text>
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
        data={filteredEvents}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
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
            <Text style={styles.eyebrow}>RADAR</Text>
            <Text style={styles.title}>Recomendaciones para ti</Text>
            <Text style={styles.subtitle}>{headerSubtitle}</Text>

            <View style={styles.searchWrapper}>
              <Ionicons name="search-outline" size={18} color={theme.colors.muted} />
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
                  <Ionicons name="close-circle" size={18} color={theme.colors.muted} />
                </Pressable>
              ) : null}
            </View>

            {query.length === 0 ? (
              <View style={styles.hintsRow}>
                {SEARCH_HINTS.map((hint) => (
                  <Pressable key={hint} style={styles.hintChip} onPress={() => setQuery(hint)}>
                    <Text style={styles.hintText}>{hint}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

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
  const title = deshout(event.title);
  const accent = sourceColor(event.source);

  return (
    <Link href={{ pathname: '/event/[id]', params: { id: event.id } }} asChild>
      <Pressable style={styles.topCardShadow}>
        <LinearGradient
          colors={['#1b2649', '#121a33']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.topCard, { borderLeftColor: accent }]}
        >
          <View style={styles.topHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.topLabel}>MEJOR COINCIDENCIA</Text>
              <Text style={styles.sourceTag}>{event.source.toUpperCase()}</Text>
            </View>
            <ScoreBadge score={event.score} size={58} />
          </View>

          <Text style={styles.topTitle} numberOfLines={3}>
            {title}
          </Text>

          {relative ? (
            <View style={styles.dateRow}>
              <View style={[styles.dateChip, { backgroundColor: `${accent}22`, borderColor: `${accent}55` }]}>
                <Text style={[styles.dateChipText, { color: theme.colors.textPrimary }]}>{relative}</Text>
              </View>
              <Text style={styles.dateFull}>
                {event.city}, {event.country} · {short}
              </Text>
            </View>
          ) : null}

          {event.summary || event.description ? (
            <Text style={styles.topSummary} numberOfLines={3}>
              {event.summary || event.description}
            </Text>
          ) : null}

          {event.reasons?.length ? (
            <View style={styles.reasonsBlock}>
              <View style={styles.reasonsDivider} />
              {event.reasons.slice(0, 2).map((reason) => (
                <View key={reason} style={styles.reasonRow}>
                  <Ionicons name="flash" size={12} color={accent} />
                  <Text style={styles.reasonText} numberOfLines={2}>
                    {reason}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </LinearGradient>
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
  const title = deshout(event.title);
  const accent = sourceColor(event.source);

  return (
    <View style={[styles.row, { borderLeftColor: accent }]}>
      <Link href={{ pathname: '/event/[id]', params: { id: event.id } }} asChild>
        <Pressable style={styles.rowMain}>
          <Text style={styles.rowTitle} numberOfLines={2}>
            {title}
          </Text>
          <Text style={styles.rowMeta} numberOfLines={1}>
            {event.city}, {event.country}
            {relative ? ` · ${relative}` : ''}
          </Text>
        </Pressable>
      </Link>
      <View style={styles.rowRight}>
        <ScoreBadge score={event.score} size={36} />
        <FavoriteButton active={favorite} onToggle={onToggleFavorite} size={22} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  loadingContent: { padding: theme.space(5), gap: theme.space(4) },
  listContent: { padding: theme.space(5), paddingBottom: theme.space(16) },
  header: { gap: theme.space(3), marginBottom: theme.space(4) },
  eyebrow: {
    color: theme.colors.accent,
    fontSize: 12,
    letterSpacing: 2,
    fontFamily: theme.fonts.semibold
  },
  listLabel: { marginTop: theme.space(6) },
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
    fontFamily: theme.fonts.regular
  },

  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(2),
    paddingHorizontal: theme.space(3),
    paddingVertical: theme.space(2),
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.pill,
    borderColor: theme.colors.border,
    borderWidth: 1,
    marginTop: theme.space(1)
  },
  searchInput: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: 14,
    paddingVertical: theme.space(1),
    fontFamily: theme.fonts.regular
  },
  hintsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space(2) },
  hintChip: {
    paddingHorizontal: theme.space(3),
    paddingVertical: 6,
    backgroundColor: 'rgba(124, 156, 255, 0.08)',
    borderRadius: theme.radius.pill,
    borderColor: 'rgba(124, 156, 255, 0.25)',
    borderWidth: 1
  },
  hintText: {
    color: theme.colors.accent,
    fontSize: 12,
    fontFamily: theme.fonts.medium
  },

  topCardShadow: {
    shadowColor: theme.colors.accent,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 10,
    borderRadius: theme.radius.lg,
    marginTop: theme.space(2)
  },
  topCard: {
    padding: theme.space(5),
    borderRadius: theme.radius.lg,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderLeftWidth: 4,
    gap: theme.space(3),
    overflow: 'hidden'
  },
  topHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space(3)
  },
  topLabel: {
    color: theme.colors.accent,
    fontSize: 11,
    letterSpacing: 2,
    fontFamily: theme.fonts.semibold
  },
  sourceTag: {
    color: theme.colors.muted,
    fontSize: 11,
    letterSpacing: 1.5,
    fontFamily: theme.fonts.medium,
    marginTop: 4
  },
  topTitle: {
    color: theme.colors.textPrimary,
    fontSize: 22,
    lineHeight: 28,
    fontFamily: theme.fonts.bold,
    letterSpacing: -0.5
  },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space(2), flexWrap: 'wrap' },
  dateChip: {
    paddingHorizontal: theme.space(2),
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
    borderWidth: 1
  },
  dateChipText: { fontSize: 12, fontFamily: theme.fonts.semibold },
  dateFull: {
    color: theme.colors.muted,
    fontSize: 12,
    fontFamily: theme.fonts.regular,
    flexShrink: 1
  },
  topSummary: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: theme.fonts.regular
  },
  reasonsBlock: { gap: theme.space(1) },
  reasonsDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    opacity: 0.5,
    marginVertical: theme.space(1)
  },
  reasonRow: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.space(2) },
  reasonText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
    fontFamily: theme.fonts.regular
  },

  separator: { height: theme.space(2) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(3),
    paddingVertical: theme.space(3),
    paddingLeft: theme.space(3),
    paddingRight: theme.space(2),
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderLeftWidth: 3
  },
  rowMain: { flex: 1, gap: 3 },
  rowTitle: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    lineHeight: 19,
    fontFamily: theme.fonts.semibold
  },
  rowMeta: {
    color: theme.colors.muted,
    fontSize: 12,
    fontFamily: theme.fonts.regular
  },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: theme.space(2) },

  error: { color: theme.colors.danger, fontSize: 13, fontFamily: theme.fonts.regular },
  empty: { padding: theme.space(6), alignItems: 'center' }
});
