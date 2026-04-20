import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { ChatMessage, UserProfile } from './types';

const TOKEN_KEY = 'tech_radar_token';
const PROFILE_KEY = 'tech_radar_profile';
const CHAT_KEY = 'tech_radar_chat';
const CHAT_HISTORY_CAP = 50;

const secureAvailable = Platform.OS === 'ios' || Platform.OS === 'android';

export async function saveToken(token: string): Promise<void> {
  if (secureAvailable) {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } else {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  }
}

export async function loadToken(): Promise<string | null> {
  if (secureAvailable) {
    return SecureStore.getItemAsync(TOKEN_KEY);
  }
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function clearToken(): Promise<void> {
  if (secureAvailable) {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } else {
    await AsyncStorage.removeItem(TOKEN_KEY);
  }
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export async function loadProfile(): Promise<UserProfile | null> {
  const raw = await AsyncStorage.getItem(PROFILE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

export async function saveChatMessages(messages: ChatMessage[]): Promise<void> {
  const trimmed = messages.slice(-CHAT_HISTORY_CAP);
  await AsyncStorage.setItem(CHAT_KEY, JSON.stringify(trimmed));
}

export async function loadChatMessages(): Promise<ChatMessage[]> {
  const raw = await AsyncStorage.getItem(CHAT_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as ChatMessage[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function clearChatMessages(): Promise<void> {
  await AsyncStorage.removeItem(CHAT_KEY);
}
