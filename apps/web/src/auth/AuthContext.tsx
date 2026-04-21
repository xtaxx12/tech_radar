import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, getAuthConfig, getMe, getMyInteractions, loginWithGoogle, loginWithGoogleCode, logout as apiLogout, toggleInteraction } from '../api';
import type { AuthConfig, AuthUser, UserEventInteractionType } from '../types';

type AuthContextValue = {
  config: AuthConfig | null;
  user: AuthUser | null;
  favorites: Set<string>;
  rsvp: Set<string>;
  status: 'loading' | 'ready';
  loginWithCredential: (credential: string) => Promise<void>;
  loginWithCode: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  toggleFavorite: (eventId: string) => Promise<void>;
  toggleRsvp: (eventId: string) => Promise<void>;
  error: string | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [rsvp, setRsvp] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');
  const [error, setError] = useState<string | null>(null);

  const loadInteractions = useCallback(async () => {
    try {
      const data = await getMyInteractions();
      setFavorites(new Set(data.favorites));
      setRsvp(new Set(data.rsvp));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setFavorites(new Set());
        setRsvp(new Set());
        return;
      }
      console.warn('[auth] interactions fetch failed', err);
    }
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const authConfig = await getAuthConfig();
        if (!active) return;
        setConfig(authConfig);

        if (!authConfig.enabled) {
          setStatus('ready');
          return;
        }

        try {
          const me = await getMe();
          if (!active) return;
          setUser(me.user);
          await loadInteractions();
        } catch (err) {
          if (!(err instanceof ApiError) || err.status !== 401) {
            console.warn('[auth] me fetch failed', err);
          }
        }
      } catch (err) {
        console.warn('[auth] config fetch failed', err);
      } finally {
        if (active) setStatus('ready');
      }
    })();

    return () => {
      active = false;
    };
  }, [loadInteractions]);

  const loginWithCredential = useCallback(async (credential: string) => {
    setError(null);
    try {
      const { user: nextUser } = await loginWithGoogle(credential);
      setUser(nextUser);
      await loadInteractions();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No pudimos iniciar sesión con Google.';
      setError(message);
      throw err;
    }
  }, [loadInteractions]);

  const loginWithCode = useCallback(async (code: string) => {
    setError(null);
    try {
      const { user: nextUser } = await loginWithGoogleCode(code);
      setUser(nextUser);
      await loadInteractions();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No pudimos iniciar sesión con Google.';
      setError(message);
      throw err;
    }
  }, [loadInteractions]);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch (err) {
      console.warn('[auth] logout failed', err);
    } finally {
      setUser(null);
      setFavorites(new Set());
      setRsvp(new Set());
    }
  }, []);

  const toggle = useCallback(
    async (eventId: string, type: UserEventInteractionType) => {
      if (!user) return;
      const setter = type === 'favorite' ? setFavorites : setRsvp;
      const currentSet = type === 'favorite' ? favorites : rsvp;
      const optimistic = new Set(currentSet);
      if (optimistic.has(eventId)) optimistic.delete(eventId);
      else optimistic.add(eventId);
      setter(optimistic);

      try {
        const result = await toggleInteraction(eventId, type);
        setter((prev) => {
          const next = new Set(prev);
          if (result.active) next.add(eventId);
          else next.delete(eventId);
          return next;
        });
      } catch (err) {
        setter(currentSet);
        const message = err instanceof Error ? err.message : 'No pudimos guardar tu cambio.';
        setError(message);
      }
    },
    [user, favorites, rsvp]
  );

  const value = useMemo<AuthContextValue>(() => ({
    config,
    user,
    favorites,
    rsvp,
    status,
    loginWithCredential,
    loginWithCode,
    logout,
    toggleFavorite: (eventId: string) => toggle(eventId, 'favorite'),
    toggleRsvp: (eventId: string) => toggle(eventId, 'rsvp'),
    error
  }), [config, user, favorites, rsvp, status, loginWithCredential, loginWithCode, logout, toggle, error]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  }
  return ctx;
}
