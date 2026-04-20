import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { postChat } from '../../lib/api';
import { useProfile } from '../../lib/profile';
import { theme } from '../../lib/theme';
import type { ChatResponse } from '../../lib/types';

export default function ChatScreen() {
  const { profile } = useProfile();
  const [message, setMessage] = useState('Eventos de IA esta semana en Ecuador para junior');
  const [response, setResponse] = useState<ChatResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    if (!message.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await postChat(message, profile);
      setResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error del chat.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.eyebrow}>CHAT IA</Text>
          <Text style={styles.title}>Pregúntame algo</Text>
          <Text style={styles.subtitle}>Recomiendo eventos tech en LATAM y te explico el porqué.</Text>

          {response ? (
            <View style={styles.answerBlock}>
              <Text style={styles.label}>Respuesta</Text>
              <Text style={styles.answer}>{response.answer}</Text>

              {response.events?.length ? (
                <View style={styles.events}>
                  <Text style={styles.label}>Eventos relacionados</Text>
                  {response.events.slice(0, 5).map((event) => (
                    <Link
                      key={event.id}
                      href={{ pathname: '/event/[id]', params: { id: event.id } }}
                      asChild
                    >
                      <Pressable style={styles.eventCard}>
                        <Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text>
                        <Text style={styles.eventMeta}>{event.city}, {event.country}</Text>
                      </Pressable>
                    </Link>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>

        <View style={styles.inputRow}>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Escribe tu pregunta"
            placeholderTextColor={theme.colors.muted}
            style={styles.input}
            multiline
          />
          <Pressable style={[styles.sendButton, loading && styles.sendDisabled]} onPress={handleSend} disabled={loading}>
            {loading ? (
              <ActivityIndicator color={theme.colors.background} />
            ) : (
              <Text style={styles.sendText}>Enviar</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  content: { padding: theme.space(5), gap: theme.space(2) },
  eyebrow: { color: theme.colors.accent, fontSize: 12, letterSpacing: 2 },
  title: { color: theme.colors.textPrimary, fontSize: 24, fontWeight: '700' },
  subtitle: { color: theme.colors.textSecondary, fontSize: 14, marginBottom: theme.space(3) },
  label: { color: theme.colors.muted, fontSize: 12, letterSpacing: 1, marginBottom: theme.space(1) },
  answerBlock: {
    backgroundColor: theme.colors.surface,
    padding: theme.space(4),
    borderRadius: theme.radius.md,
    borderColor: theme.colors.border,
    borderWidth: 1,
    gap: theme.space(2)
  },
  answer: { color: theme.colors.textPrimary, fontSize: 15, lineHeight: 22 },
  events: { gap: theme.space(2), marginTop: theme.space(2) },
  eventCard: {
    backgroundColor: theme.colors.surfaceAlt,
    padding: theme.space(3),
    borderRadius: theme.radius.sm
  },
  eventTitle: { color: theme.colors.textPrimary, fontSize: 14, fontWeight: '600' },
  eventMeta: { color: theme.colors.muted, fontSize: 12 },
  error: { color: theme.colors.danger, fontSize: 13, marginTop: theme.space(2) },
  inputRow: {
    flexDirection: 'row',
    gap: theme.space(2),
    padding: theme.space(3),
    borderTopColor: theme.colors.border,
    borderTopWidth: 1,
    backgroundColor: theme.colors.background
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    color: theme.colors.textPrimary,
    borderRadius: theme.radius.md,
    padding: theme.space(3),
    fontSize: 14,
    maxHeight: 120
  },
  sendButton: {
    backgroundColor: theme.colors.accent,
    paddingHorizontal: theme.space(4),
    justifyContent: 'center',
    borderRadius: theme.radius.md
  },
  sendDisabled: { opacity: 0.6 },
  sendText: { color: theme.colors.background, fontWeight: '700' }
});
