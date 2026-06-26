# GymFriends Offline-Mode Plan

**Goal:** Every feature works while out of cell service. The app serves last-cached data, clearly tells the user they're offline, and queues any writes to send automatically when connectivity returns.

**Decisions (confirmed with Sterling):**
- Network detection: add `@react-native-community/netinfo` and drive a global offline state.
- Real-time features (chat, presence, feed): show last-cached data with an offline badge; new writes queue and flush on reconnect. Live updates resume when back online.
- Sonnet agents implement the code directly in this repo.

---

## Where we are today

The codebase already has the seed of an offline system, but it only covers a sliver of the app:

- `services/offlineCache.ts` — read cache for **only** climbing areas + area feed.
- `services/offlineQueue.ts` — write queue for a fixed set of actions (area visits, trip plans, trip invitations, gym check-in/out, feed posts).
- `services/storage.ts` — onboarding flags + a "last user" cache.
- Queue flush happens **only** on app foreground (`AppState` → `active`) in `AppContext`.

Gaps that block "every feature works offline":

1. **No network detection.** No `NetInfo`; offline is inferred only from a thrown request error in a few `try/catch` blocks. There's no global "are we offline" state.
2. **No offline indicator UI.** Users get no signal that they're viewing cached data.
3. **Most reads aren't cached.** `api.ts` has ~172 Supabase calls across 22 API modules; only areas + area feed read from cache. Everything else fails hard offline.
4. **Write queue is partial.** Many mutations (messages, comments, profile edits, schedule edits, belayer requests, etc.) have no offline path.
5. **No reconnect-triggered flush.** The queue only drains on foreground, not the moment service returns.

---

## Target architecture

### 1. Connectivity layer (foundation)
- Add `@react-native-community/netinfo`.
- New `src/context/NetworkContext.tsx` exposing `{ isOffline, isConnected, lastOnlineAt }` via a `useNetwork()` hook. Subscribe to `NetInfo` events; debounce flaps.
- Mount `NetworkProvider` near the top of the provider tree in `App.tsx`.

### 2. Offline indicator (foundation)
- New `src/components/OfflineBanner.tsx` — a slim persistent bar ("You're offline — showing saved data") rendered at app root, driven by `useNetwork()`.
- A lightweight `CachedDataNotice` pattern for per-screen "Last updated <time>" labels on stale data.

### 3. Generic read cache (foundation)
- Refactor `offlineCache.ts` into a generic, key-based cache: `cacheGet(key)`, `cacheSet(key, data)`, `isStale(updatedAt, ttl)` — preserving the existing area/feed helpers as thin wrappers so nothing breaks.
- Standard **cache-aside** pattern for every read: try network → on success write-through to cache and return → on failure (or when `isOffline`) return cached data and flag it stale.

### 4. Generic write queue (foundation + data layer)
- Extend `offlineQueue.ts` `QueuedAction` union + `OfflineQueueRunner` to cover **all** mutations (messages, comments, profile/schedule edits, belayer requests, follows, etc.).
- Flush triggers: app foreground (existing) **and** `NetInfo` reconnect event (new). Process in FIFO order; keep failed items for retry.
- Optimistic UI: queued writes update local state immediately and show a "pending sync" affordance.

### 5. Per-screen offline UX (screens)
- Offline banner visible everywhere.
- Read screens render cached data + a "showing saved data / last updated X" note.
- Write controls stay usable but switch to "will send when back online" messaging; disable only the truly impossible (e.g., live location refresh).
- Real-time screens (chat, presence, feed) show cached state with an offline badge and resume live updates on reconnect.

---

## Work breakdown (delegated to Sonnet agents)

**Wave 1 — Foundation (one agent, runs first; everything depends on it)**
- NetInfo + `NetworkContext`/`useNetwork`, wired into `App.tsx`.
- `OfflineBanner` at app root.
- Generic `cache` utility (refactor of `offlineCache.ts`, backward compatible).
- Extend `offlineQueue` action types + runner interface; add reconnect-triggered flush in `AppContext`.

**Wave 2 — Data layer (one agent; sole owner of `api.ts`, starts after Wave 1)**
- Wrap every read in `api.ts` with cache-aside; write-through on success.
- Route every mutation through the extended offline queue when offline.

**Wave 2 — Screen UX (parallel agents, disjoint files, start after Wave 1)**
- Group A: `HomeScreen`, `ScheduleScreen`, `AddScheduleScreen`, `FindTimeScreen`.
- Group B: `AreasMapScreen`, `AreaDetailScreen`, `AreaFeedScreen`, `FeedScreen`, `GymDetailScreen`, `FindScreen`.
- Group C: `MessagesScreen`, `DirectChatScreen`, `GroupChatScreen`, `ProfileScreen`, `FriendProfileScreen`.

**Coordination rules to avoid conflicts:** only the Wave-2 data agent edits `api.ts`; only the foundation agent edits `AppContext.tsx`/`App.tsx`/shared services; screen agents edit their assigned screen files plus new components only.

**Verification:** every agent runs `npx tsc --noEmit` against its changes; a final pass typechecks the whole repo and reviews diffs for a coherent architecture.

---

## Out of scope / follow-ups
- Conflict resolution for edits made offline to records changed server-side (last-write-wins for v1; flag for a later merge strategy).
- Caching large binary assets (avatars, map tiles) beyond what `expo-image` already caches.
- Background sync while the app is fully terminated (queue flushes on next open/reconnect).
