import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../lib/auth';
import { ChatProvider } from '../lib/chat';
import { ProfileProvider } from '../lib/profile';
import { theme } from '../lib/theme';

// Mantén el splash mientras cargan fuentes para evitar el "flash" de
// tipografía del sistema antes de Inter.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

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
                  headerTitleStyle: {
                    color: theme.colors.textPrimary,
                    fontFamily: theme.fonts.semibold
                  },
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
