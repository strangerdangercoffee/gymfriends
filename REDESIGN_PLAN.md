# GymFriends Navigation Consolidation — Implementation Plan

**Audience:** Sonnet 4.6 (implementing engineer)
**Goal:** Consolidate the app so there is exactly **one pathway to each screen**. Introduce a unified **Find** page, expand the **Gym** and **Crag** detail screens, add a unified **Messages** screen (with real 1:1 DMs), and remove the redundant **Connections** and **Map** tabs.

This document is the source of truth. Read the "Current State" section before touching code — several screens that look relevant are already orphaned and should be deleted, not edited.

---

## 1. Decisions already made (do not re-litigate)

| Decision | Choice |
|---|---|
| Bottom tab bar (final) | **Home · Find · Messages · Feed · Profile** (5 tabs) |
| Schedule tab | Removed as a tab. `ScheduleScreen` stays reachable from Home (header button) and Profile. |
| Connections tab (`ConnectionsScreen`) | **Removed.** Functionality split into Find (friends/groups) + Messages (chat). |
| Map tab (`AreasMapScreen`) | **Removed as a tab.** Re-surfaced as a floating map button inside Find → Crags/Gyms. |
| Direct messages | **Build full 1:1 DM support** (new DB tables + API + UI). Not a group-chat hack. |
| Map button target | **Reuse existing `AreasMapScreen`** as a modal/overlay. Do not build a new map. |
| Friend profile content | Recent climbing locations · Recent posts/feed activity · Climbing profile + grades · Upcoming trips/schedule (all four). |

---

## 2. Current State (what exists today)

Stack: React Native + Expo, Supabase backend, React Navigation (bottom tabs + nested stacks). All app code under `src/`.

### Navigation today (`src/navigation/AppNavigator.tsx`)
Bottom tabs: `Home`, `Schedule`, `Friends` (renders `ConnectionsScreen`), `Map` (renders `AreasMapScreen`), `Feed`, `Profile`.

Nested stacks:
- **GroupsStack** (mounted under the `Friends` tab): `GroupsMain`=ConnectionsScreen, `GroupChat`, `AreaFeed`, `AreasMap`, `AreaDetail`, `AreaFriendCalendar`, `GymDetail`, `FriendSchedule`, `GroupSchedule`.
- **MapStack** (under `Map` tab): `MapMain`=AreasMapScreen, `AreaDetail`, `AreaFriendCalendar`, `GymDetail`.
- **ScheduleStack** (under `Schedule` tab): `ScheduleMain`, `AddSchedule`.

> Note the **duplication that motivates this work**: `AreaDetail` and `GymDetail` are registered in *both* GroupsStack and MapStack — two pathways to the same screen. Collapsing to one stack is a core goal.

### Screens that are ALREADY ORPHANED (not referenced anywhere except possibly the navigator) — delete these
Confirmed via grep, no inbound references:
- `src/screens/GymsScreen.tsx` — superseded by the new Find→Gyms slice (its search/follow logic is a useful reference, then delete).
- `src/screens/FriendsScreen.tsx`
- `src/screens/GroupsScreen.tsx`
- `src/screens/GlobeMapScreen.tsx`
- `src/screens/ScheduleScreenBigCal.tsx`

Delete them as part of the consolidation. (Confirm zero imports right before deleting.)

### Key reusable building blocks (USE THESE, don't rebuild)
- **`src/components/AreaFeed.tsx`** — already renders the belayer-request board for either a gym or a crag. Props: `gymId?`, `areaId?`, `cragName?`, `postType?`, `listHeaderComponent?`. Embedding `<AreaFeed gymId={gymId} />` gives the gym its belay board; `<AreaFeed areaId={areaId} />` gives the crag's. AreaDetailScreen already uses it.
- **Weather** — `HomeScreen.tsx` already fetches from open-meteo (`https://api.open-meteo.com/v1/forecast?...current=temperature_2m,weather_code,...`). See `WeatherData` interface (line ~82) and `wmoToDesc`. Extract this into a small `src/services/weather.ts` helper and reuse on the Crag screen.
- **`userAreaVisitsApi`** (`src/services/api.ts`):
  - `getByUser(userId)` → a user's recent area visits → powers "where they've been climbing lately".
  - `getActiveVisitsByArea(areaId)` → who is at a crag right now → "friends that are there".
- **`presence`** (from `useApp()`) → who is at a gym right now (filter `p.gymId === gymId && p.isActive`).
- **`groupsApi`** (`src/services/api.ts`): `getUserGroups`, `searchPublicGroups(query?)`, `joinGroup(groupId,userId)`, `joinGroupFromQR`, `createGroup`, `getGroupMembers`, group-invitation methods (`createGroupInvitation`/`acceptGroupInvitation`/`declineGroupInvitation`/`getGroupInvitationsForUser`).
- **`chatApi`** (`src/services/api.ts`): `getGroupChat`, `getChatMessages`, `sendMessage` — currently group-only (a chat is "1:1 with a group", i.e. one chat per group). DMs do **not** exist yet.
- **QR components**: `QRCodeDisplayModal`, `QRCodeScannerModal` (scanner supports `mode: 'user' | 'any'`), `CreateGroupModal`, `OnboardingInviteFriends`. All reusable in Find.
- **`ProfileScreen.tsx`** is **self-only** (no `userId` route param). A friend profile is a **new** screen.

### Data types (`src/types/index.ts`)
`User`, `Gym`, `ClimbingArea`, `UserAreaVisit`, `UserAreaPlan`, `Presence`, `WorkoutInvitation`/`WorkoutInvitationWithResponses`, `TripInvitation`, `GroupChat`, `ChatMessage`, `AreaFeedPost`, `ClimbingProfile`, `BelayCertification`. Navigation param lists also live here (`RootTabParamList`, `GroupsStackParamList`, `MapStackParamList`, `ScheduleStackParamList`).

---

## 3. Target Architecture

### 3.1 Final tab bar (`AppNavigator.tsx`)
Replace the 6 tabs with 5:

| Tab | Component | Icon |
|---|---|---|
| Home | `HomeScreen` | home |
| Find | `FindStackNavigator` (new) | search |
| Messages | `MessagesStackNavigator` (new) | chatbubbles |
| Feed | `FeedScreen` | newspaper |
| Profile | `ProfileScreen` | person |

Delete the `Schedule` and `Map` tabs and the `MapStack` navigator entirely. Keep `ScheduleStack` defined but mount it **inside the Find stack OR as a modal reachable from Home/Profile** (see §3.6) — not as a tab.

### 3.2 New single stack: `FindStack`
One stack, one pathway to every detail screen. Param list (add to `src/types/index.ts`):

```ts
export type FindStackParamList = {
  FindMain: undefined;                              // the Find page (slider + search)
  FriendProfile: { userId: string };                // NEW screen
  GymDetail: { gymId: string };
  AreaDetail: { areaId: string; highlightTripInvitationId?: string };
  AreaFriendCalendar: { areaId: string; areaName: string };
  AreasMap: { focus?: 'gyms' | 'crags' } | undefined; // reused AreasMapScreen as pushed screen/modal
  FriendSchedule: { mode: 'friend'; userId: string; userName: string };
  GroupSchedule: { mode: 'group'; groupId: string; groupName: string };
};
```

All `AreaDetail` / `GymDetail` / `AreaFriendCalendar` registrations move here and are **removed from every other stack** so there is exactly one route to each.

### 3.3 New single stack: `MessagesStack`
```ts
export type MessagesStackParamList = {
  MessagesMain: undefined;                 // unified inbox
  DirectChat: { conversationId: string; otherUserId: string; otherUserName: string };
  GroupChat: { groupId: string; groupName: string };  // moved here from GroupsStack
};
```

### 3.4 Cross-tab navigation contract
Because tab stacks are siblings, navigating from Find (e.g. tapping a group the user belongs to) into Messages must jump tabs:
```ts
navigation.getParent()?.navigate('Messages', { screen: 'GroupChat', params: { groupId, groupName } });
```
Document this pattern once and reuse it.

### 3.5 Param-list / type cleanup
- Delete `MapStackParamList`.
- Trim `GroupsStackParamList` → it no longer exists; replaced by `FindStackParamList` + `MessagesStackParamList`.
- Update `RootTabParamList` to `{ Home; Find; Messages; Feed; Profile }`.
- Update the push-notification deep link in `AppNavigator.tsx` (`navigateToTripInvitationFromPush`) which currently targets `Friends → AreaDetail`; retarget to `Find → AreaDetail`.

### 3.6 Schedule access
`ScheduleScreen` + `AddScheduleScreen` lose their tab. Keep `ScheduleStack` and present it from a Home header button (calendar icon) and a Profile row. Simplest: register `ScheduleMain`/`AddSchedule` inside `FindStack` is **not** desired (keeps Find clean) — instead mount a small `ScheduleStackNavigator` as a modal stack opened via `navigation.navigate('ScheduleModal')` from Home/Profile, or push onto the Profile stack. Pick one and keep it single-path.

---

## 4. Feature specs (screen by screen)

### 4.1 Find page — `src/screens/FindScreen.tsx` (NEW, `FindMain`)

**Layout (top → bottom):**
1. **Segmented slider** at top: `Friends | Groups | Crags | Gyms`. (Reuse the segmented-control pattern already in `ConnectionsScreen`'s tab selector styles.)
2. **Search bar** under the slider (filters the active slice).
3. **Slice content** (a `FlatList` whose data/renderItem depend on the active slice).
4. **Floating map button** (bottom-right FAB) — visible **only** on Crags and Gyms slices. Opens `AreasMap`.

State: `activeSlice: 'friends' | 'groups' | 'crags' | 'gyms'`, `query: string`. Persist last-used slice in component state (optionally `localStorage`-equivalent via AsyncStorage; not required).

#### Friends slice
- Header actions: two buttons — **"Show my code"** (`QRCodeDisplayModal`, user mode) and **"Scan"** (`QRCodeScannerModal`, `mode='user'`, on scan → `addFriendInstant`). These already exist in `ConnectionsScreen`; port them.
- Below: list of all friends (`friends` from `useApp()`). Sort: friends currently at a gym/crag first (reuse `friendsAtGym`/`friendsNotAtGym` logic from `ConnectionsScreen`). Show name, avatar, and a location badge if present.
- Search filters by friend name/email.
- **Tap a friend → `FriendProfile { userId }`** (NOT FriendSchedule — that was the old pathway; profile is the new single entry point, and the profile screen links onward to schedule).

#### Groups slice
- Header action: **"Scan"** button (`QRCodeScannerModal`, `mode='any'` → handles group QR via `groupsApi.joinGroupFromQR`). Port `handleQRScanGroup` from `ConnectionsScreen`.
- List: user's groups (`groupsApi.getUserGroups`) **plus** discoverable public groups (`groupsApi.searchPublicGroups(query)`); de-dupe. When the search bar is empty, show the user's groups first, then public groups.
- Per-group card rules:
  - If the user **owns** the group (`role === 'admin'`): show a small **QR code button** on the card → `QRCodeDisplayModal` with that group's id/name.
  - If the user **is a member**: tapping the card → **Messages → GroupChat** (cross-tab navigate per §3.4).
  - If the user is **not a member** and the group is **public**: show a **"Request to join"** button → `groupsApi.joinGroup(groupId, userId)` (public groups join immediately today). If you implement true approval-gated requests, add `groupsApi.requestToJoin` + a `group_join_requests` table; otherwise treat public as instant-join and note it.
- Keep **"Create group"** entry (reuse `CreateGroupModal`) — place it in the slice header.

#### Crags slice
- Search bar filters `climbingAreas` (from `useApp()`) by name/region/country.
- **Before the user types**, list **followed crags first** (`followedAreas` from `useApp()`), then everything else (or nothing else until typing — pick: show followed-only when query empty).
- Tap a crag → `AreaDetail { areaId }`.
- Floating map button visible.

#### Gyms slice
- Search bar filters `gyms` by name/address (reuse `GymsScreen` search logic before deleting that file).
- Before typing: list **followed gyms first** (`user.followedGyms`), then nothing/everything (match Crags behavior).
- Tap a gym → `GymDetail { gymId }`.
- Floating map button visible.

> The map FAB opens `AreasMapScreen` (pushed or modal). Pass `focus: 'gyms' | 'crags'` so the map can default its layer to match the active slice. `AreasMapScreen` already knows how to render areas/gyms and navigate to `AreaDetail`/`GymDetail`; just ensure those pushes resolve within `FindStack`.

### 4.2 Friend profile — `src/screens/FriendProfileScreen.tsx` (NEW, `FriendProfile`)

Route param: `{ userId }`. Load the target user via `userApi` (add `getById` if missing). Sections (all four were requested):

1. **Header** — avatar, name, follow/unfollow-friend or remove-friend action.
2. **Climbing profile + grades** — render their `ClimbingProfile` (lead/top-rope/boulder/trad grade ranges, `openToNewPartners`). Reuse `ClimbingProfileModal` display logic / `utils/climbingGrades.ts`. Show belay certs if available.
3. **Where they've been climbing lately** — `userAreaVisitsApi.getByUser(userId)` (most recent N), resolve area names; also surface current presence (at a gym now) via `presence`. Each location row taps through to `AreaDetail`/`GymDetail`.
4. **Recent posts / feed activity** — their authored `AreaFeedPost`s (belayer requests, trip announcements, discussion). Add `areaFeedApi.getPostsByAuthor(userId, limit)` if not present.
5. **Upcoming trips / shared schedule** — their `UserAreaPlan`s visible to friends (respect `privacySettings.shareSchedule`). Link "View schedule" → `FriendSchedule { mode:'friend', userId, userName }` (this is where the old direct-to-schedule tap now lives).
6. **Message button** → Messages → DirectChat (see §4.4; create/fetch conversation first).

Respect privacy flags throughout (`shareLocation`, `shareSchedule`).

### 4.3 Expanded detail screens

#### Gym screen — `src/screens/GymDetailScreen.tsx` (EXPAND)
Currently only shows "friends here now." Add sections:
1. **Friends that are there** (keep existing presence-based list).
2. **Friends' scheduled workouts** at this gym — query upcoming `WorkoutInvitationWithResponses` / schedules filtered to `gymId` where inviter or responder is a friend. (Use `useApp().workoutInvitations` filtered by `gym.id` and friend involvement.)
3. **Upcoming events** at this gym — any group/workout events tied to the gym.
4. **Belay request board** — `<AreaFeed gymId={gymId} />` + a "New belayer request" button (reuse `BelayerRequestModal` with `initialGymId`).
5. Follow/unfollow + Check in/out actions (port from `GymsScreen` card).

#### Crag screen — `src/screens/AreaDetailScreen.tsx` (EXPAND)
Already has: trip invitations, follow toggle, friend-calendar button, plan-a-trip, belay board (`AreaFeed`), my trips, friends' trips. **Add:**
1. **Weather** — at top, using the extracted `weather.ts` helper (open-meteo) for `area.latitude/longitude`. Mirror the HomeScreen card (temp, description, dry/wet indicator).
2. **Friends that are there now** — `userAreaVisitsApi.getActiveVisitsByArea(areaId)` intersected with `friends`.
3. **Friends with upcoming events** — friends who have plans/trips/events at this area soon (partly covered by existing "Friends' trips here"; add events).
4. Existing **trip calendar** button (`AreaFriendCalendar`) and **belay request board** stay.

### 4.4 Messages screen — `src/screens/MessagesScreen.tsx` (NEW, `MessagesMain`)

A single inbox combining three feeds:
1. **Direct messages (1:1)** — NEW infrastructure (§5).
2. **Group messages** — from `groupsApi.getUserGroups` + each group's chat (`chatApi.getGroupChat` / last message). Tapping → `GroupChat`.
3. **Workout & trip requests** — pull `workoutInvitations` (pending responses) from `useApp()` and `tripInvitationsApi.getByInvitee(userId)` (status `invited`). Render as actionable rows (Accept/Decline inline, reusing existing handlers in `AreaDetailScreen`/workout invitation flows).

Suggested UI: a top segment `All | DMs | Groups | Requests`, default `All` = merged, reverse-chronological by last activity, with unread badges. Each row shows avatar/name, last-message/preview, timestamp, unread dot.

- DM row → `DirectChat { conversationId, otherUserId, otherUserName }`.
- Group row → `GroupChat { groupId, groupName }` (move `GroupChatScreen` registration into `MessagesStack`; it already works, just re-home it).
- Request row → inline accept/decline; optionally deep-link to the related `AreaDetail`/workout.

### 4.5 `DirectChat` screen — `src/screens/DirectChatScreen.tsx` (NEW)
Mirror `GroupChatScreen` UI (message list, composer, image support) but backed by the DM API (§5). Realtime via Supabase channel on the conversation/messages table, same pattern `GroupChatScreen` uses for group messages.

---

## 5. Backend: 1:1 Direct Messages (NEW)

No DM tables exist today. Add a Supabase migration under `supabase/` and an API module.

### 5.1 Schema (migration)
```sql
-- conversations between exactly two users
create table dm_conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references users(id),
  user_b uuid not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_a, user_b)               -- enforce one convo per pair (store with user_a < user_b)
);

create table dm_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references dm_conversations(id) on delete cascade,
  sender_user_id uuid not null references users(id),
  message_text text,
  message_type text not null default 'text',  -- 'text' | 'image' | 'system'
  metadata jsonb,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  read_by uuid[] default '{}'
);
create index on dm_messages (conversation_id, created_at);
```
Add RLS so a user can only read/write conversations they are a participant in. Always insert with the participant pair normalized (`least(uid)`, `greatest(uid)`) so `getOrCreate` is idempotent.

### 5.2 API module — `src/services/api.ts` add `directMessagesApi`
```ts
directMessagesApi = {
  getOrCreateConversation(userId, otherUserId): Promise<{ id }>,
  listConversations(userId): Promise<DMConversationSummary[]>, // for inbox: other user, last msg, unread count
  getMessages(conversationId, limit?, before?): Promise<ChatMessage[]>,
  sendMessage(conversationId, senderUserId, text, type?, metadata?): Promise<ChatMessage>,
  markRead(conversationId, userId): Promise<void>,
  subscribe(conversationId, onMessage): RealtimeChannel,  // mirror group-chat realtime
}
```
Add `DMConversationSummary` and reuse `ChatMessage` (already defined in `types/index.ts`) for message shape.

---

## 6. Removal / cleanup checklist
- [ ] Delete tabs `Schedule` and `Map` from `AppNavigator.tsx`; delete `MapStackNavigator` + `MapStackParamList`.
- [ ] Delete `ConnectionsScreen.tsx` after its friends/groups logic is ported to `FindScreen`.
- [ ] Delete orphaned screens: `GymsScreen.tsx`, `FriendsScreen.tsx`, `GroupsScreen.tsx`, `GlobeMapScreen.tsx`, `ScheduleScreenBigCal.tsx` (confirm zero imports first).
- [ ] Remove duplicate `AreaDetail`/`GymDetail`/`AreaFriendCalendar` registrations so each lives only in `FindStack`.
- [ ] Re-home `GroupChatScreen` into `MessagesStack`.
- [ ] Update push-notification deep link target (`Friends`→`Find`).
- [ ] Grep for stale `navigation.navigate('Map'|'Friends'|'Schedule'|'GroupsMain'|'MapMain')` and fix each.
- [ ] Update `RootTabParamList` and all `useNavigation<...>()` generics.

---

## 7. Suggested build order (phases)

1. **Navigation skeleton** — new `FindStack` + `MessagesStack`, new tab bar, type updates, deep-link retarget. App compiles with placeholder Find/Messages screens. Verify every old pathway still resolves or is intentionally removed.
2. **Find page** — slider + search + 4 slices + map FAB. Port friends/groups logic from `ConnectionsScreen`. Wire taps to existing `AreaDetail`/`GymDetail`.
3. **Friend profile screen** — new screen + any missing `userApi.getById` / `areaFeedApi.getPostsByAuthor`.
4. **Expand Gym & Crag screens** — add sections; extract `weather.ts`.
5. **DM backend** — migration + `directMessagesApi` + RLS.
6. **Messages screen + DirectChat** — unified inbox, re-home GroupChat, wire requests.
7. **Cleanup** — delete orphaned/removed screens and dead routes; grep sweep.
8. **Verification** — see §8.

Each phase should compile and run before the next.

---

## 8. Verification (do this, don't skip)
- `npx tsc --noEmit` clean (the codebase is TypeScript-strict-ish; param-list changes will surface here).
- Grep sweep: no remaining references to deleted screens/routes (`ConnectionsScreen`, `AreasMapScreen` as a tab, `MapStack`, `GymsScreen`, etc.).
- Manual nav audit: confirm **exactly one** pathway to each of FriendProfile, GymDetail, AreaDetail, GroupChat, DirectChat. (No screen reachable from two stacks.)
- DM round-trip test: two users, getOrCreateConversation is idempotent, messages send/receive in realtime, unread counts update, RLS blocks non-participants.
- Privacy: friend profile respects `shareLocation`/`shareSchedule`.
- Smoke test push-notification deep link still opens `AreaDetail`.

---

## 9. Open items to confirm with Sterling (flag, don't block)
- **Group "request to join"**: public groups currently join instantly via `groupsApi.joinGroup`. True approval-gated requests need a new `group_join_requests` table + owner-approval UI. Confirm whether instant-join for public is acceptable for v1.
- **Schedule placement**: exact entry point for `ScheduleScreen` now that it's not a tab (Home header button vs Profile row vs both).
- **Feed tab**: kept as-is. Confirm it shouldn't also fold into Find/Home later.
