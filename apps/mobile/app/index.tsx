import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuth } from '../lib/auth';
import { theme } from '../lib/theme';

export default function Gate() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  if (status === 'authenticated') {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/login" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center'
  }
});
