import type { ExpoConfig } from 'expo/config';

/**
 * Deriva el scheme reverso que Google Sign-In necesita registrar en Info.plist
 * desde el Client ID iOS (formato 123-abc.apps.googleusercontent.com).
 * Así el scheme siempre matchea el client ID que usa el código en tiempo de
 * ejecución (login.tsx lee EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS) en vez de quedar
 * fijo para un deployment en particular.
 */
function iosUrlScheme(): string | undefined {
  const raw = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS?.trim();
  if (!raw) return undefined;
  const base = raw.replace(/\.apps\.googleusercontent\.com$/, '');
  if (!base) return undefined;
  return `com.googleusercontent.apps.${base}`;
}

const googlePlugin: [string, Record<string, unknown>] | null = (() => {
  const scheme = iosUrlScheme();
  return scheme ? ['@react-native-google-signin/google-signin', { iosUrlScheme: scheme }] : null;
})();

const config: ExpoConfig = {
  name: 'Tech Radar LATAM',
  slug: 'tech-radar-latam',
  scheme: 'techradar',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  icon: './assets/icon.png',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0b1020'
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.techradar.mobile'
  },
  android: {
    package: 'com.techradar.mobile',
    adaptiveIcon: {
      foregroundImage: './assets/icon-foreground.png',
      backgroundColor: '#0b1020'
    }
  },
  web: {
    bundler: 'metro'
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    ...(googlePlugin ? [googlePlugin] : [])
  ],
  experiments: {
    typedRoutes: true
  }
};

export default config;
