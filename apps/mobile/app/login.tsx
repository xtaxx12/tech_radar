import * as Google from 'expo-auth-session/providers/google';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../lib/auth';
import { theme } from '../lib/theme';

WebBrowser.maybeCompleteAuthSession();

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB;
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS || undefined;
const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID || undefined;

export default function Login() {
  const { signInWithGoogleCredential } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: webClientId,
    iosClientId,
    androidClientId
  });

  useEffect(() => {
    if (!response) return;
    if (response.type !== 'success') {
      if (response.type === 'error') {
        setError('No pudimos completar el inicio de sesión con Google.');
      }
      setBusy(false);
      return;
    }

    const idToken = response.params.id_token;
    if (!idToken) {
      setError('Google no devolvió un id_token.');
      setBusy(false);
      return;
    }

    (async () => {
      try {
        await signInWithGoogleCredential(idToken);
        router.replace('/(tabs)');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al iniciar sesión.';
        setError(message);
      } finally {
        setBusy(false);
      }
    })();
  }, [response, signInWithGoogleCredential]);

  const handlePress = async () => {
    if (!webClientId) {
      setError('Falta EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB en .env.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await promptAsync();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al abrir Google.';
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
