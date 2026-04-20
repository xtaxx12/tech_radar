import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../lib/auth';
import { ProfileProvider } from '../lib/profile';
import { theme } from '../lib/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ProfileProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: theme.colors.background },
              headerTintColor: theme.colors.textPrimary,
              contentStyle: { backgroundColor: theme.colors.background },
              headerTitleStyle: { color: theme.colors.textPrimary }
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="event/[id]" options={{ title: 'Detalle' }} />
          </Stack>
        </ProfileProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
