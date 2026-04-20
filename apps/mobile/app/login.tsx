import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes
} from '@react-native-google-signin/google-signin';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { loginWithGoogle } from '../lib/api';
import { useAuth } from '../lib/auth';
import { theme } from '../lib/theme';

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB;
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS;

export default function Login() {
  const { applySession } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const configured = useRef(false);

  useEffect(() => {
    if (configured.current) return;
    if (!webClientId) {
      setError('Falta EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB en .env.');
      return;
    }
    GoogleSignin.configure({
      webClientId,
      iosClientId,
      scopes: ['openid', 'profile', 'email']
    });
    configured.current = true;
  }, []);

  const handlePress = async () => {
    if (!configured.current) return;
    setError(null);
    setBusy(true);

    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const result = await GoogleSignin.signIn();
      const idToken = result.data?.idToken ?? null;

      if (!idToken) {
        throw new Error('Google no devolvió idToken.');
      }

      const session = await loginWithGoogle(idToken);
      await applySession(session);
      router.replace('/(tabs)');
    } catch (err) {
      if (isErrorWithCode(err)) {
        if (err.code === statusCodes.SIGN_IN_CANCELLED) {
          setBusy(false);
          return;
        }
        if (err.code === statusCodes.IN_PROGRESS) {
          return;
        }
        if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
          setError('Google Play Services no está disponible.');
          setBusy(false);
          return;
        }
      }
      const message = err instanceof Error ? err.message : 'Error al iniciar sesión.';
      setError(message);
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.brandBlock}>
          <Text style={styles.eyebrow}>LATAM events intelligence</Text>
          <Text style={styles.title}>Tech Radar LATAM</Text>
          <Text style={styles.subtitle}>
            Un radar de eventos tech con IA, recomendaciones por perfil y chat conversacional.
          </Text>
        </View>

        <View style={styles.actionBlock}>
          <Pressable style={[styles.button, busy && styles.buttonDisabled]} onPress={handlePress} disabled={busy}>
            {busy ? (
              <ActivityIndicator color={theme.colors.background} />
            ) : (
              <Text style={styles.buttonText}>Ingresar con Google</Text>
            )}
          </Pressable>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Text style={styles.footer}>Tu perfil y favoritos se guardan en la nube.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  container: {
    flex: 1,
    paddingHorizontal: theme.space(6),
    paddingVertical: theme.space(10),
    justifyContent: 'space-between'
  },
  brandBlock: { gap: theme.space(3) },
  eyebrow: { color: theme.colors.accent, fontSize: 13, letterSpacing: 2, textTransform: 'uppercase' },
  title: { color: theme.colors.textPrimary, fontSize: 36, fontWeight: '700' },
  subtitle: { color: theme.colors.textSecondary, fontSize: 16, lineHeight: 22 },
  actionBlock: { gap: theme.space(3) },
  button: {
    backgroundColor: theme.colors.accent,
    paddingVertical: theme.space(4),
    borderRadius: theme.radius.md,
    alignItems: 'center'
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: theme.colors.background, fontSize: 16, fontWeight: '700' },
  error: { color: theme.colors.danger, fontSize: 14, textAlign: 'center' },
  footer: { color: theme.colors.muted, fontSize: 12, textAlign: 'center' }
});
