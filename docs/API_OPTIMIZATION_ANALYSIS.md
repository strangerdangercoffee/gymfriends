# API Call Optimization Analysis

## Problem
18,344 REST requests in one day between two test users indicates severe inefficiency in API usage.

## Top 5 Least Efficient API Calls

### 1. **getUserGroups - N+1 Query Problem** ⚠️ CRITICAL
**Location:** `src/services/api.ts:996-1053`

**Problem:**
- Makes **N+1 queries** where N = number of groups
- For each group, makes a separate `count` query (line 1031-1034)
- For each group with a gym, makes a separate gym name query (line 1042-1043)
- **Example:** If user has 10 groups, that's 10 count queries + up to 10 gym queries = **20+ API calls**

**Current Code:**
```typescript
const groupsWithCounts = await Promise.all(
  validData.map(async (item: any) => {
    const { count } = await (supabase as any)
      .from('group_members')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', item.group_id);
    
    const locationName = item.groups.associated_gym_id 
      ? (await (supabase as any).from('gyms').select('name').eq('id', item.groups.associated_gym_id).single()).data?.name
      : ...;
  })
);
```

**Solution:**
- Use a single aggregated query with JOINs to get all data at once
- Use PostgreSQL's `COUNT()` in a subquery or aggregate function
- Batch fetch gym names in one query

**Impact:** Reduces from **20+ calls to 1-2 calls** per `getUserGroups` invocation

---

### 2. **getCurrentUser - 3 Separate Sequential Queries** ⚠️ HIGH
**Location:** `src/services/api.ts:103-154`

**Problem:**
- Makes **3 separate sequential queries**:
  1. Get user data (line 107-111)
  2. Get friends from junction table (line 119-122)
  3. Get followed gyms from junction table (line 137-140)
- Each query waits for the previous one to complete

**Current Code:**
```typescript
// Query 1: User
const { data, error } = await supabase.from('users').select('*')...

// Query 2: Friends (sequential)
const { data: friendsData } = await (supabase as any)
  .from('user_friendships').select('friend_id')...

// Query 3: Followed gyms (sequential)
const { data: gymsData } = await (supabase as any)
  .from('user_gym_follows').select('gym_id')...
```

**Solution:**
- Use `Promise.all()` to fetch friends and followed gyms in parallel
- Or use a single query with JOINs (if Supabase supports it)
- Cache user data and only refresh when needed

**Impact:** Reduces from **3 sequential calls to 2 parallel calls** (or 1 with JOINs)

---

### 3. **refreshData Called on Every Screen Focus** ⚠️ CRITICAL
**Location:** `src/screens/GroupsScreen.tsx:73-77`, `src/screens/FriendsScreen.tsx:68-73`

**Problem:**
- `refreshData()` is called **every time** a screen comes into focus
- `refreshData()` makes **6 parallel API calls**:
  - refreshSchedules()
  - refreshGyms()
  - refreshFriends()
  - refreshPresence()
  - refreshWorkoutHistory()
  - refreshWorkoutInvitations()
- If user navigates between screens 10 times, that's **60 API calls**

**Current Code:**
```typescript
// GroupsScreen.tsx
useFocusEffect(
  useCallback(() => {
    handleRefresh(); // Calls refreshData()
  }, [])
);

// FriendsScreen.tsx
useFocusEffect(
  useCallback(() => {
    refreshData(); // 6 API calls every time!
  }, [refreshData])
);
```

**Solution:**
- Add debouncing/throttling to `refreshData()` calls
- Only refresh if data is stale (check last refresh timestamp)
- Use real-time subscriptions more effectively (they already exist but might not be working)
- Cache data and only refresh specific parts that changed
- Remove `useFocusEffect` refresh calls - rely on real-time subscriptions instead

**Impact:** Reduces from **6 calls per screen focus to 0-1 calls** (only when data is stale)

---

### 4. **getAllGyms and getAllActivePresence - Fetching All Data Every Time** ⚠️ HIGH
**Location:** `src/services/api.ts:302-310`, `src/services/api.ts:463-471`

**Problem:**
- `getAllGyms()` fetches **ALL gyms** in the database every time
- `getAllActivePresence()` fetches **ALL active presence** records every time
- Called on every `refreshData()` (which happens frequently)
- No caching or filtering - fetches everything even if nothing changed

**Current Code:**
```typescript
async getAllGyms(): Promise<Gym[]> {
  const { data, error } = await supabase
    .from('gyms')
    .select('*')  // Gets ALL gyms
    .order('name');
  return data || [];
}

async getAllActivePresence(): Promise<Presence[]> {
  const { data, error} = await (supabase as any)
    .from('user_gym_presence')
    .select('*')  // Gets ALL presence
    .eq('is_active', true);
  return (data || []).map(transformPresenceFromDB);
}
```

**Solution:**
- Cache gym data (gyms rarely change)
- Only fetch presence for followed gyms or friends
- Use real-time subscriptions to update presence instead of polling
- Add timestamp-based filtering to only fetch recent changes
- Implement client-side caching with TTL

**Impact:** Reduces from **fetching all data to fetching only relevant data** (potentially 90%+ reduction)

---

### 5. **ensureHistoryGenerated Called Too Frequently** ⚠️ MEDIUM
**Location:** `src/context/AppContext.tsx:228-248`, `src/services/workoutHistoryGenerator.ts:298-329`

**Problem:**
- `ensureHistoryGenerated()` is called **every time** `refreshWorkoutHistory()` runs
- `refreshWorkoutHistory()` is called:
  - On every `refreshData()` (6 times)
  - After creating schedules
  - After updating schedules
  - On screen focus (via refreshData)
- For each recurring schedule, it queries the schedule and generates history
- If user has 5 recurring schedules, that's **5+ queries every refresh**

**Current Code:**
```typescript
const refreshWorkoutHistory = async (): Promise<void> => {
  // Called on EVERY refresh
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 90);
  await workoutHistoryGenerator.ensureHistoryGenerated(targetDate, user.id); // Expensive!
  
  const history = await workoutHistoryApi.getWorkoutHistory(user.id, startDate, endDate);
  setWorkoutHistory(history);
};
```

**Solution:**
- Only call `ensureHistoryGenerated()` if:
  - Last generation was more than X hours ago
  - A new recurring schedule was created
  - A schedule was updated
- Cache the last generation timestamp
- Use a background job/function to generate history periodically
- Check if history already exists before generating

**Impact:** Reduces from **5+ queries per refresh to 0-1 queries** (only when needed)

---

## Additional Inefficiencies Found

### 6. **Real-time Subscriptions Not Preventing Refreshes**
- Real-time subscriptions exist but `refreshData()` is still called on focus
- Should rely on subscriptions for updates instead of manual refreshes

### 7. **No Request Deduplication**
- Multiple components might call the same API simultaneously
- No mechanism to deduplicate concurrent requests

### 8. **Workout History Queries Without Proper Indexing**
- Date range queries might be slow without proper indexes
- Consider adding composite indexes on `(user_id, start_time)`

---

## Recommended Implementation Priority

1. **Fix getUserGroups N+1 problem** (Highest impact, easy fix)
2. **Remove/optimize useFocusEffect refreshData calls** (High impact, medium effort)
3. **Optimize getCurrentUser to use parallel queries** (Medium impact, easy fix)
4. **Cache getAllGyms and filter getAllActivePresence** (Medium impact, medium effort)
5. **Throttle ensureHistoryGenerated** (Lower impact, easy fix)

---

## Estimated Impact

If these optimizations are implemented:
- **Before:** ~18,344 requests/day (2 users)
- **After:** ~500-1,000 requests/day (2 users)
- **Reduction:** ~95% fewer API calls
