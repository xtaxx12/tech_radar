import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getProfileOptions } from './api';
import { loadProfile, saveProfile } from './storage';
import type { ProfileOptions, UserProfile } from './types';

const DEFAULT_PROFILE: UserProfile = {
  country: 'Ecuador',
  role: 'frontend',
  level: 'mid',
  interests: ['ia', 'web']
};

type ProfileContextValue = {
  profile: UserProfile;
  options: ProfileOptions | null;
  setProfile: (next: UserProfile) => Promise<void>;
  ready: boolean;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<UserProfile>(DEFAULT_PROFILE);
  const [options, setOptions] = useState<ProfileOptions | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const saved = await loadProfile();
      if (!active) return;
      if (saved) setProfileState(saved);
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    getProfileOptions()
      .then((opts) => {
        if (active) setOptions(opts);
      })
      .catch(() => {
        // opciones son opcionales
      });
    return () => {
      active = false;
    };
  }, []);

  const setProfile = useCallback(async (next: UserProfile) => {
    setProfileState(next);
    await saveProfile(next);
  }, []);

  const value = useMemo<ProfileContextValue>(
    () => ({ profile, options, setProfile, ready }),
    [profile, options, setProfile, ready]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile debe usarse dentro de <ProfileProvider>');
  return ctx;
}
