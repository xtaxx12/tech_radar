import { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { theme } from '../lib/theme';

type SkeletonProps = {
  width?: number | string;
  height?: number;
  radius?: number;
  style?: ViewStyle;
};

export function Skeleton({ width = '100%', height = 16, radius = 6, style }: SkeletonProps) {
  const opacity = useSharedValue(0.35);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.75, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        styles.base,
        { width: width as number, height, borderRadius: radius },
        animatedStyle,
        style
      ]}
    />
  );
}

export function EventCardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Skeleton width={80} height={10} />
        <Skeleton width={44} height={44} radius={22} />
      </View>
      <Skeleton width="90%" height={22} style={{ marginTop: 12 }} />
      <Skeleton width="65%" height={22} style={{ marginTop: 6 }} />
      <Skeleton width="40%" height={12} style={{ marginTop: 14 }} />
      <Skeleton width="100%" height={12} style={{ marginTop: 16 }} />
      <Skeleton width="85%" height={12} style={{ marginTop: 6 }} />
    </View>
  );
}

export function CompactRowSkeleton() {
  return (
    <View style={styles.compact}>
      <View style={{ flex: 1, gap: 6 }}>
        <Skeleton width="75%" height={14} />
        <Skeleton width="50%" height={10} />
      </View>
      <Skeleton width={28} height={28} radius={14} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: theme.colors.surfaceAlt
  },
  card: {
    padding: theme.space(5),
    borderRadius: theme.radius.lg,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(3),
    paddingVertical: theme.space(3)
  }
});
