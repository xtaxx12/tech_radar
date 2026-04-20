import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { selectionTick } from '../lib/haptics';
import { theme } from '../lib/theme';

type Props = {
  active: boolean;
  onToggle: () => void;
  size?: number;
};

/**
 * Botón de estrella con bounce (1 → 1.35 → 1) cuando se activa. El haptic
 * vive acá para que Home/Favorites/Detail no tengan que duplicarlo.
 */
export function FavoriteButton({ active, onToggle, size = 24 }: Props) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = () => {
    selectionTick();
    scale.value = withSequence(
      withTiming(1.35, { duration: 140 }),
      withTiming(1, { duration: 160 })
    );
    onToggle();
  };

  return (
    <Pressable onPress={handlePress} hitSlop={12} style={styles.touch} accessibilityRole="button">
      <Animated.View style={animatedStyle}>
        <Ionicons
          name={active ? 'star' : 'star-outline'}
          size={size}
          color={active ? theme.colors.accent : theme.colors.muted}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  touch: { padding: theme.space(1) }
});
