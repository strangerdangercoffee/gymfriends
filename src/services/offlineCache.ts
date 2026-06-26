import AsyncStorage from '@react-native-async-storage/async-storage';
import { ClimbingArea } from '../types';

// ─── Cache key helpers ────────────────────────────────────────────────────────

/**
 * Root namespace prefix for all offline cache keys.
 * Use CACHE_PREFIX + a domain-specific suffix to build consistent keys.
 *
 * Example (data-layer agent):
 *   import { CACHE_PREFIX } from '../services/offlineCache';
 *   const key = `${CACHE_PREFIX}users:${userId}`;
 */
export const CACHE_PREFIX = '@gymfriends:cache:';

// Well-known keys (kept private — exposed only via the typed helpers below)
const AREAS_KEY = `${CACHE_PREFIX}climbing_areas`;
const AREA_FEED_PREFIX = `${CACHE_PREFIX}area_feed:`;

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── Generic envelope stored in AsyncStorage ─────────────────────────────────

interface CacheEnvelope<T> {
  data: T;
  updatedAt: number;
}

// ─── Generic low-level cache API ─────────────────────────────────────────────

/**
 * Read a cached value by key.
 * Returns `{ data, updatedAt }` or `null` if nothing is stored or the stored
 * value is corrupt.
 */
export async function cacheGet<T>(key: string): Promise<{ data: T; updatedAt: number } | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (parsed == null || parsed.data === undefined || parsed.updatedAt === undefined) return null;
    return { data: parsed.data, updatedAt: parsed.updatedAt };
  } catch {
    return null;
  }
}

/**
 * Write a value to cache under `key`, stamping it with the current time.
 */
export async function cacheSet<T>(key: string, data: T): Promise<void> {
  try {
    const envelope: CacheEnvelope<T> = { data, updatedAt: Date.now() };
    await AsyncStorage.setItem(key, JSON.stringify(envelope));
  } catch (e) {
    console.warn('cacheSet failed', key, e);
  }
}

/**
 * Returns true if `updatedAt` is older than `ttlMs` milliseconds.
 * Re-exported here so callers can import everything from one place.
 */
export function isStale(updatedAt: number, ttlMs: number = DEFAULT_TTL_MS): boolean {
  return Date.now() - updatedAt > ttlMs;
}

// ─── Legacy typed interfaces (kept for backward compatibility) ─────────────────

export interface CachedAreas {
  data: ClimbingArea[];
  updatedAt: number;
}

export interface CachedAreaFeed {
  data: any[];
  updatedAt: number;
}

// ─── offlineCache object — backward-compatible API ────────────────────────────

/**
 * Existing area / area-feed cache helpers, now built on top of the generic
 * `cacheGet` / `cacheSet` primitives.  All existing callers continue to work
 * without modification.
 */
export const offlineCache = {
  async getCachedAreas(): Promise<CachedAreas | null> {
    const result = await cacheGet<ClimbingArea[]>(AREAS_KEY);
    if (!result || !Array.isArray(result.data)) return null;
    return result as CachedAreas;
  },

  async setCachedAreas(areas: ClimbingArea[]): Promise<void> {
    await cacheSet<ClimbingArea[]>(AREAS_KEY, areas);
  },

  async getCachedAreaFeed(areaId: string): Promise<CachedAreaFeed | null> {
    const result = await cacheGet<any[]>(`${AREA_FEED_PREFIX}${areaId}`);
    if (!result || !Array.isArray(result.data)) return null;
    return result as CachedAreaFeed;
  },

  async setCachedAreaFeed(areaId: string, posts: any[]): Promise<void> {
    await cacheSet<any[]>(`${AREA_FEED_PREFIX}${areaId}`, posts);
  },

  isStale(updatedAt: number, ttlMs: number = DEFAULT_TTL_MS): boolean {
    return isStale(updatedAt, ttlMs);
  },
};
