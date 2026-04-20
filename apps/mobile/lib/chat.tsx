import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { postChat } from './api';
import { clearChatMessages, loadChatMessages, saveChatMessages } from './storage';
import type { ChatMessage, UserProfile } from './types';

type ChatContextValue = {
  messages: ChatMessage[];
  loading: boolean;
  ready: boolean;
  send: (text: string, profile: UserProfile) => Promise<void>;
  clear: () => Promise<void>;
};

const ChatContext = createContext<ChatContextValue | null>(null);

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    loadChatMessages()
      .then((stored) => {
        if (active) setMessages(stored);
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const append = useCallback((msg: ChatMessage) => {
    setMessages((prev) => {
      const next = [...prev, msg];
      void saveChatMessages(next);
      return next;
    });
  }, []);

  const send = useCallback(
    async (text: string, profile: UserProfile) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      append({ id: makeId(), role: 'user', content: trimmed, timestamp: new Date().toISOString() });

      setLoading(true);
      try {
        const response = await postChat(trimmed, profile);
        append({
          id: makeId(),
          role: 'assistant',
          content: response.answer,
          events: response.events,
          timestamp: new Date().toISOString()
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error del chat.';
        append({ id: makeId(), role: 'error', content: message, timestamp: new Date().toISOString() });
      } finally {
        setLoading(false);
      }
    },
    [append]
  );

  const clear = useCallback(async () => {
    await clearChatMessages();
    setMessages([]);
  }, []);

  const value = useMemo<ChatContextValue>(
    () => ({ messages, loading, ready, send, clear }),
    [messages, loading, ready, send, clear]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat debe usarse dentro de <ChatProvider>');
  return ctx;
}
