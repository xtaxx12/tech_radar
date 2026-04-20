import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { selectionTick } from '../lib/haptics';
import { theme } from '../lib/theme';

export type HomeFilters = {
  country: string | null;
  source: string | null;
  favoritesOnly: boolean;
};

export const EMPTY_FILTERS: HomeFilters = { country: null, source: null, favoritesOnly: false };

type Props = {
  filters: HomeFilters;
  onChange: (next: HomeFilters) => void;
  availableCountries: string[];
  availableSources: string[];
  favoritesCount: number;
};

export function FilterBar({ filters, onChange, availableCountries, availableSources, favoritesCount }: Props) {
  const [openSheet, setOpenSheet] = useState<null | 'country' | 'source'>(null);

  const active = filters.country || filters.source || filters.favoritesOnly;

  const handleToggleFav = () => {
    selectionTick();
    onChange({ ...filters, favoritesOnly: !filters.favoritesOnly });
  };

  const handleReset = () => {
    selectionTick();
    onChange(EMPTY_FILTERS);
  };

  return (
    <>
      <View style={styles.row}>
        <Chip
          active={filters.favoritesOnly}
          onPress={handleToggleFav}
          label={`★ Favoritos${favoritesCount > 0 ? ` (${favoritesCount})` : ''}`}
        />
        <Chip
          active={Boolean(filters.country)}
          onPress={() => setOpenSheet('country')}
          label={filters.country ?? 'País ▾'}
        />
        <Chip
          active={Boolean(filters.source)}
          onPress={() => setOpenSheet('source')}
          label={filters.source ?? 'Fuente ▾'}
        />
        {active ? <Pressable onPress={handleReset} style={styles.reset}><Text style={styles.resetText}>Limpiar</Text></Pressable> : null}
      </View>

      <SelectSheet
        visible={openSheet === 'country'}
        title="Filtrar por país"
        options={availableCountries}
        selected={filters.country}
        onSelect={(value) => {
          onChange({ ...filters, country: value });
          setOpenSheet(null);
        }}
        onClose={() => setOpenSheet(null)}
      />
      <SelectSheet
        visible={openSheet === 'source'}
        title="Filtrar por fuente"
        options={availableSources}
        selected={filters.source}
        onSelect={(value) => {
          onChange({ ...filters, source: value });
          setOpenSheet(null);
        }}
        onClose={() => setOpenSheet(null)}
      />
    </>
  );
}

function Chip({ active, onPress, label }: { active: boolean; onPress: () => void; label: string }) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function SelectSheet({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose
}: {
  visible: boolean;
  title: string;
  options: string[];
  selected: string | null;
  onSelect: (value: string | null) => void;
  onClose: () => void;
}) {
  const data = useMemo(() => ['__all__', ...options], [options]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <SafeAreaView edges={['bottom']} style={styles.sheetHost} onStartShouldSetResponder={() => true}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{title}</Text>
            <FlatList
              data={data}
              keyExtractor={(item) => item}
              renderItem={({ item }) => {
                const isAll = item === '__all__';
                const value = isAll ? null : item;
                const isSelected = selected === value;
                return (
                  <Pressable
                    style={[styles.option, isSelected && styles.optionActive]}
                    onPress={() => onSelect(value)}
                  >
                    <Text style={[styles.optionText, isSelected && styles.optionTextActive]}>
                      {isAll ? 'Todos' : item}
                    </Text>
                    {isSelected ? <Text style={styles.optionCheck}>✓</Text> : null}
                  </Pressable>
                );
              }}
              ItemSeparatorComponent={() => <View style={styles.divider} />}
              style={styles.optionsList}
            />
          </View>
        </SafeAreaView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space(2),
    alignItems: 'center'
  },
  chip: {
    paddingHorizontal: theme.space(3),
    paddingVertical: theme.space(2),
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderColor: theme.colors.border,
    borderWidth: 1
  },
  chipActive: { backgroundColor: theme.colors.accentSoft, borderColor: theme.colors.accent },
  chipText: { color: theme.colors.textSecondary, fontSize: 13 },
  chipTextActive: { color: theme.colors.textPrimary, fontWeight: '600' },
  reset: { paddingHorizontal: theme.space(2), paddingVertical: theme.space(2) },
  resetText: { color: theme.colors.muted, fontSize: 12, textDecorationLine: 'underline' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end'
  },
  sheetHost: { backgroundColor: 'transparent' },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    paddingTop: theme.space(2),
    paddingBottom: theme.space(4),
    maxHeight: '70%'
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: theme.space(2)
  },
  sheetTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: theme.space(5),
    paddingBottom: theme.space(2)
  },
  optionsList: { paddingHorizontal: theme.space(3) },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.space(3),
    paddingHorizontal: theme.space(3)
  },
  optionActive: { backgroundColor: theme.colors.accentSoft, borderRadius: theme.radius.sm },
  optionText: { color: theme.colors.textSecondary, fontSize: 15 },
  optionTextActive: { color: theme.colors.textPrimary, fontWeight: '600' },
  optionCheck: { color: theme.colors.accent, fontSize: 16 },
  divider: { height: 1, backgroundColor: theme.colors.border, opacity: 0.3 }
});
