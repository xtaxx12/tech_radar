import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getMe, loginWithGoogle, logout as apiLogout, registerTokenGetter } from './api';
import { clearToken, loadToken, saveToken } from './storage';
import type { AuthResponse, PublicUser } from './types';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

type AuthContextValue = {
  status: AuthStatus;
  user: PublicUser | null;
  signInWithGoogleCredential: (credential: string) => Promise<PublicUser>;
  applySession: (session: AuthResponse) => Promise<PublicUser>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const tokenRef = useRef<string | null>(null);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    registerTokenGetter(() => tokenRef.current);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const token = await loadToken();
      if (!active) return;
      tokenRef.current = token;
      if (!token) {
        setStatus('unauthenticated');
        return;
      }

      try {
        const { user: me } = await getMe();
        if (!active) return;
        setUser(me);
        setStatus('authenticated');
      } catch {
        if (!active) return;
        tokenRef.current = null;
        await clearToken();
        setStatus('unauthenticated');
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const applySession = useCallback(async (session: AuthResponse) => {
    tokenRef.current = session.token;
    await saveToken(session.token);
    setUser(session.user);
    setStatus('authenticated');
    return session.user;
  }, []);

  const signInWithGoogleCredential = useCallback(
    async (credential: string) => {
      const session = await loginWithGoogle(credential);
      return applySession(session);
    },
    [applySession]
  );

  const signOut = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // ignore
    }
    tokenRef.current = null;
    await clearToken();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, signInWithGoogleCredential, applySession, signOut }),
    [status, user, signInWithGoogleCredential, applySession, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
