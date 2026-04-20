import { Link } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useChat } from '../../lib/chat';
import { selectionTick } from '../../lib/haptics';
import { useProfile } from '../../lib/profile';
import { theme } from '../../lib/theme';
import type { ChatMessage, RankedEvent } from '../../lib/types';

const SUGGESTED = [
  'Eventos de IA esta semana en Ecuador para junior',
  'Recomiéndame workshops de backend en Quito',
  'Qué hay de data science en Colombia este mes'
];

export default function ChatScreen() {
  const { profile } = useProfile();
  const { messages, send, loading, ready, clear } = useChat();
  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, []);

  useEffect(() => {
    if (messages.length > 0) scrollToEnd();
  }, [messages.length, scrollToEnd]);

  const handleSend = async (text?: string) => {
    const payload = (text ?? draft).trim();
    if (!payload || loading) return;
    setDraft('');
    selectionTick();
    await send(payload, profile);
  };

  const handleClear = () => {
    if (messages.length === 0) return;
    Alert.alert('Borrar conversación', '¿Seguro que quieres borrar todos los mensajes?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: () => void clear() }
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        {ready && messages.length === 0 ? (
          <EmptyChat onSuggest={handleSend} />
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={styles.gap} />}
            renderItem={({ item }) => <Bubble message={item} />}
            ListFooterComponent={loading ? <TypingIndicator /> : null}
            onContentSizeChange={scrollToEnd}
            keyboardShouldPersistTaps="handled"
          />
        )}

        <View style={styles.inputRow}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Escribe tu pregunta"
            placeholderTextColor={theme.colors.muted}
            style={styles.input}
            multiline
          />
          {messages.length > 0 ? (
            <Pressable onPress={handleClear} style={styles.clearButton} hitSlop={8}>
              <Text style={styles.clearText}>Borrar</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={[styles.sendButton, loading && styles.sendDisabled]}
            onPress={() => void handleSend()}
            disabled={loading || !draft.trim()}
          >
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

function EmptyChat({ onSuggest }: { onSuggest: (text: string) => void }) {
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.eyebrow}>CHAT IA</Text>
      <Text style={styles.title}>Pregúntame algo</Text>
      <Text style={styles.subtitle}>
        Recomiendo eventos tech en LATAM y te explico el porqué. Prueba con:
      </Text>
      <View style={styles.suggestions}>
        {SUGGESTED.map((text) => (
          <Pressable key={text} style={styles.suggestionChip} onPress={() => onSuggest(text)}>
            <Text style={styles.suggestionText}>{text}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const isError = message.role === 'error';

  return (
    <Animated.View
      entering={FadeInDown.duration(220)}
      style={[styles.bubbleRow, isUser ? styles.bubbleRight : styles.bubbleLeft]}
    >
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAssistant,
          isError && styles.bubbleError
        ]}
      >
        <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{message.content}</Text>
        {message.events?.length ? (
          <View style={styles.events}>
            {message.events.slice(0, 4).map((event) => (
              <EventLink key={event.id} event={event} />
            ))}
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

function EventLink({ event }: { event: RankedEvent }) {
  return (
    <Link href={{ pathname: '/event/[id]', params: { id: event.id } }} asChild>
      <Pressable style={styles.eventCard}>
        <Text style={styles.eventTitle} numberOfLines={2}>
          {event.title}
        </Text>
        <Text style={styles.eventMeta}>
          {event.city}, {event.country}
        </Text>
      </Pressable>
    </Link>
  );
}

function TypingIndicator() {
  return (
    <Animated.View entering={FadeInDown.duration(180)} style={styles.typingWrapper}>
      <View style={[styles.bubble, styles.bubbleAssistant]}>
        <Text style={styles.typingText}>Escribiendo…</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  listContent: { padding: theme.space(4), paddingBottom: theme.space(3) },
  gap: { height: theme.space(2) },
  emptyContainer: {
    flex: 1,
    padding: theme.space(5),
    gap: theme.space(2),
    justifyContent: 'flex-start'
  },
  eyebrow: { color: theme.colors.accent, fontSize: 12, letterSpacing: 2 },
  title: { color: theme.colors.textPrimary, fontSize: 24, fontWeight: '700' },
  subtitle: { color: theme.colors.textSecondary, fontSize: 14, marginBottom: theme.space(3) },
  suggestions: { gap: theme.space(2) },
  suggestionChip: {
    padding: theme.space(3),
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderColor: theme.colors.border,
    borderWidth: 1
  },
  suggestionText: { color: theme.colors.textSecondary, fontSize: 14 },
  bubbleRow: { flexDirection: 'row', maxWidth: '100%' },
  bubbleLeft: { justifyContent: 'flex-start' },
  bubbleRight: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '85%',
    padding: theme.space(3),
    borderRadius: theme.radius.md,
    borderColor: theme.colors.border,
    borderWidth: 1
  },
  bubbleUser: { backgroundColor: theme.colors.accentSoft, borderColor: theme.colors.accent },
  bubbleAssistant: { backgroundColor: theme.colors.surface },
  bubbleError: { borderColor: theme.colors.danger, backgroundColor: 'rgba(255, 99, 99, 0.08)' },
  bubbleText: { color: theme.colors.textSecondary, fontSize: 14, lineHeight: 20 },
  bubbleTextUser: { color: theme.colors.textPrimary },
  events: { gap: theme.space(2), marginTop: theme.space(2) },
  eventCard: {
    backgroundColor: theme.colors.surfaceAlt,
    padding: theme.space(2),
    borderRadius: theme.radius.sm
  },
  eventTitle: { color: theme.colors.textPrimary, fontSize: 13, fontWeight: '600' },
  eventMeta: { color: theme.colors.muted, fontSize: 11 },
  typingWrapper: { flexDirection: 'row', justifyContent: 'flex-start', marginTop: theme.space(2) },
  typingText: { color: theme.colors.muted, fontSize: 13, fontStyle: 'italic' },
  inputRow: {
    flexDirection: 'row',
    gap: theme.space(2),
    alignItems: 'flex-end',
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
  clearButton: { paddingHorizontal: theme.space(2), justifyContent: 'center' },
  clearText: { color: theme.colors.muted, fontSize: 12 },
  sendButton: {
    backgroundColor: theme.colors.accent,
    paddingHorizontal: theme.space(4),
    justifyContent: 'center',
    borderRadius: theme.radius.md,
    minHeight: 44
  },
  sendDisabled: { opacity: 0.4 },
  sendText: { color: theme.colors.background, fontWeight: '700' }
});
