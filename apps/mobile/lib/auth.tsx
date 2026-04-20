import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getMe, loginWithGoogle, logout as apiLogout, registerTokenGetter } from './api';
import { clearToken, loadToken, saveToken } from './storage';
import type { PublicUser } from './types';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

type AuthContextValue = {
  status: AuthStatus;
  user: PublicUser | null;
  signInWithGoogleCredential: (credential: string) => Promise<PublicUser>;
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

  const signInWithGoogleCredential = useCallback(async (credential: string) => {
    const { user: me, token } = await loginWithGoogle(credential);
    tokenRef.current = token;
    await saveToken(token);
    setUser(me);
    setStatus('authenticated');
    return me;
  }, []);

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
    () => ({ status, user, signInWithGoogleCredential, signOut }),
    [status, user, signInWithGoogleCredential, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
