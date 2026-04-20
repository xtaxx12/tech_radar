import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { exchangeGoogleCode } from '../lib/api';
import { useAuth } from '../lib/auth';
import { theme } from '../lib/theme';

WebBrowser.maybeCompleteAuthSession();

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB;
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS || undefined;
const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID || undefined;

function reversedClientIdScheme(clientId: string | undefined): string | null {
  if (!clientId) return null;
  const base = clientId.replace(/\.apps\.googleusercontent\.com$/, '');
  return `com.googleusercontent.apps.${base}`;
}

function buildIosRedirectUri(): string | undefined {
  const scheme = reversedClientIdScheme(iosClientId);
  return scheme ? `${scheme}:/oauthredirect` : undefined;
}

export default function Login() {
  const { applySession } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const consumedCode = useRef<string | null>(null);

  const explicitRedirectUri = Platform.OS === 'ios' ? buildIosRedirectUri() : undefined;

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: webClientId,
    iosClientId,
    androidClientId,
    scopes: ['openid', 'profile', 'email'],
    redirectUri: explicitRedirectUri
  });

  useEffect(() => {
    if (!request) return;
    console.log('[login] authorize request', {
      url: request.url,
      redirectUri: request.redirectUri,
      clientId: request.clientId,
      codeChallenge: request.codeChallenge,
      codeChallengeMethod: request.codeChallengeMethod,
      codeVerifierPrefix: request.codeVerifier?.slice(0, 10),
      codeVerifierLength: request.codeVerifier?.length,
      responseType: request.responseType
    });
  }, [request]);

  useEffect(() => {
    if (!response) return;

    if (response.type === 'cancel' || response.type === 'dismiss') {
      setBusy(false);
      return;
    }

    if (response.type === 'error') {
      setError(response.error?.message ?? 'No pudimos completar el login con Google.');
      setBusy(false);
      return;
    }

    if (response.type !== 'success') {
      setBusy(false);
      return;
    }

    const code = response.params.code;
    if (!code || consumedCode.current === code) {
      // Guard: los authorization codes son single-use. Evitar que un re-render
      // del effect intente intercambiar el mismo code dos veces.
      return;
    }
    consumedCode.current = code;

    const codeVerifier = request?.codeVerifier;
    const redirectUri = request?.redirectUri ?? AuthSession.makeRedirectUri();
    const clientIdUsed =
      Platform.OS === 'ios'
        ? iosClientId ?? webClientId
        : Platform.OS === 'android'
          ? androidClientId ?? webClientId
          : webClientId;

    if (!codeVerifier) {
      setError('Google no devolvió los datos necesarios para completar el login.');
      setBusy(false);
      return;
    }

    (async () => {
      try {
        const session = await exchangeGoogleCode(code, codeVerifier, redirectUri, clientIdUsed);
        await applySession(session);
        router.replace('/(tabs)');
      } catch (err) {
        consumedCode.current = null;
        const message = err instanceof Error ? err.message : 'Error al iniciar sesión.';
        setError(message);
      } finally {
        setBusy(false);
      }
    })();
  }, [response, applySession]);

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
