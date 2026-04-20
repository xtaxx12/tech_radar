import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../lib/auth';
import { ChatProvider } from '../lib/chat';
import { ProfileProvider } from '../lib/profile';
import { theme } from '../lib/theme';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <ProfileProvider>
            <ChatProvider>
              <StatusBar style="light" />
              <Stack
                screenOptions={{
                  headerStyle: { backgroundColor: theme.colors.background },
                  headerTintColor: theme.colors.textPrimary,
                  contentStyle: { backgroundColor: theme.colors.background },
                  headerTitleStyle: { color: theme.colors.textPrimary },
                  animation: 'slide_from_right'
                }}
              >
                <Stack.Screen name="index" options={{ headerShown: false, animation: 'fade' }} />
                <Stack.Screen name="login" options={{ headerShown: false, animation: 'fade' }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: 'fade' }} />
                <Stack.Screen
                  name="event/[id]"
                  options={{ title: 'Detalle', animation: 'slide_from_right', animationDuration: 220 }}
                />
              </Stack>
            </ChatProvider>
          </ProfileProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
