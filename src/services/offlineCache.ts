import AsyncStorage from '@react-native-async-storage/async-storage';
import { ClimbingArea } from '../types';

const CACHE_PREFIX = '@gymfriends:cache:';
const AREAS_KEY = `${CACHE_PREFIX}climbing_areas`;
const AREA_FEED_PREFIX = `${CACHE_PREFIX}area_feed:`;

export interface CachedAreas {
  data: ClimbingArea[];
  updatedAt: number;
}

export interface CachedAreaFeed {
  data: any[];
  updatedAt: number;
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24h for areas; feed can use same or shorter

export const offlineCache = {
  async getCachedAreas(): Promise<CachedAreas | null> {
    try {
      const raw = await AsyncStorage.getItem(AREAS_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CachedAreas;
      return parsed?.data && Array.isArray(parsed.data) ? parsed : null;
    } catch {
      return null;
    }
  },

  async setCachedAreas(areas: ClimbingArea[]): Promise<void> {
    try {
      await AsyncStorage.setItem(
        AREAS_KEY,
        JSON.stringify({ data: areas, updatedAt: Date.now() } as CachedAreas)
      );
    } catch (e) {
      console.warn('offlineCache.setCachedAreas failed', e);
    }
  },

  async getCachedAreaFeed(areaId: string): Promise<CachedAreaFeed | null> {
    try {
      const raw = await AsyncStorage.getItem(`${AREA_FEED_PREFIX}${areaId}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CachedAreaFeed;
      return parsed?.data && Array.isArray(parsed.data) ? parsed : null;
    } catch {
      return null;
    }
  },

  async setCachedAreaFeed(areaId: string, posts: any[]): Promise<void> {
    try {
      await AsyncStorage.setItem(
        `${AREA_FEED_PREFIX}${areaId}`,
        JSON.stringify({ data: posts, updatedAt: Date.now() } as CachedAreaFeed)
      );
    } catch (e) {
      console.warn('offlineCache.setCachedAreaFeed failed', e);
    }
  },

  isStale(updatedAt: number, ttlMs: number = DEFAULT_TTL_MS): boolean {
    return Date.now() - updatedAt > ttlMs;
  },
};
