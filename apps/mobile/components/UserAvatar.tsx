import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../lib/auth';
import { theme } from '../lib/theme';

export function UserAvatar() {
  const { user } = useAuth();

  if (!user) return null;

  const initial = (user.name ?? user.email ?? '?').trim().charAt(0).toUpperCase();
  const goToProfile = () => router.push('/(tabs)/profile');

  return (
    <Pressable onPress={goToProfile} hitSlop={12} style={styles.wrapper}>
      {user.picture ? (
        <Image source={{ uri: user.picture }} style={styles.avatar} accessibilityLabel="Tu avatar" />
      ) : (
        <View style={[styles.avatar, styles.fallback]}>
          <Text style={styles.initial}>{initial}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginRight: 12 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accentSoft
  },
  initial: { color: theme.colors.textPrimary, fontWeight: '700', fontSize: 14 }
});
