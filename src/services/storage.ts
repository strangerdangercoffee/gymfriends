import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types';

const ONBOARDING_KEY_PREFIX = '@gymfriends:onboarding:';
const LEGACY_ONBOARDING_KEY = '@gymfriends:hasCompletedOnboarding';
const LAST_USER_CACHE_KEY = '@gymfriends:lastUserCache';

export interface LastUserCache {
  userId: string;
  hasCompletedOnboarding: boolean;
  user: User;
}

function getOnboardingKey(userId: string | null): string {
  return userId ? `${ONBOARDING_KEY_PREFIX}${userId}` : `${ONBOARDING_KEY_PREFIX}anonymous`;
}

export const storageService = {
  async hasCompletedOnboarding(userId: string | null): Promise<boolean> {
    try {
      const key = getOnboardingKey(userId);
      let value = await AsyncStorage.getItem(key);
      if (value === null && userId === null) {
        const legacy = await AsyncStorage.getItem(LEGACY_ONBOARDING_KEY);
        if (legacy === 'true') {
          value = 'true';
        }
      }
      return value === 'true';
    } catch (error) {
      console.error('Error reading onboarding status:', error);
      return false;
    }
  },

  async setOnboardingCompleted(userId: string | null, completed: boolean): Promise<void> {
    try {
      const key = getOnboardingKey(userId);
      await AsyncStorage.setItem(key, completed ? 'true' : 'false');
    } catch (error) {
      console.error('Error saving onboarding status:', error);
      throw error;
    }
  },

  async clearOnboardingStatus(userId: string | null): Promise<void> {
    try {
      const key = getOnboardingKey(userId);
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Error clearing onboarding status:', error);
      throw error;
    }
  },

  async getLastUserCache(): Promise<LastUserCache | null> {
    try {
      const raw = await AsyncStorage.getItem(LAST_USER_CACHE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw) as LastUserCache;
      return data?.userId && data?.user ? data : null;
    } catch {
      return null;
    }
  },

  async setLastUserCache(cache: LastUserCache): Promise<void> {
    try {
      await AsyncStorage.setItem(LAST_USER_CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
      console.error('Error saving last user cache:', error);
    }
  },

  async clearLastUserCache(): Promise<void> {
    try {
      await AsyncStorage.removeItem(LAST_USER_CACHE_KEY);
    } catch (error) {
      console.error('Error clearing last user cache:', error);
    }
  },
};
