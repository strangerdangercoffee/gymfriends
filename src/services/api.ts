import { supabase } from './supabase';
import { workoutHistoryGenerator } from './workoutHistoryGenerator';
import { workoutInvitationService } from './workoutInvitations';
import { notificationService } from './notifications';
import { offlineCache } from './offlineCache';
import { offlineQueue } from './offlineQueue';
import type { OfflineQueueRunner } from './offlineQueue';
import { 
  User, 
  Gym, 
  Schedule, 
  Presence,
  WorkoutHistory,
  WorkoutExercise,
  CreateScheduleForm, 
  CreateGymForm,
  ApiResponse,
  PaginatedResponse,
  WorkoutInvitation,
  WorkoutInvitationWithResponses,
  CreateWorkoutInvitationData,
  ClimbingArea,
  UserAreaVisit,
  UserAreaPlan,
  TripInvitation
} from '../types';

const FETCH_TIMEOUT_MS = 12000;

function isNetworkError(e: any): boolean {
  if (!e) return false;
  const msg = (e?.message || '').toLowerCase();
  const code = e?.code;
  if (code === 'PGRST301' || code === 'ECONNABORTED' || code === 'NETWORK_ERROR') return true;
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch')) return true;
  if (msg.includes('timeout') || msg.includes('aborted')) return true;
  return false;
}

function withTimeout<T>(p: Promise<T>, ms: number = FETCH_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Request timeout')), ms)),
  ]);
}

// Helper functions to transform data between database and TypeScript formats
const transformUserFromDB = (dbUser: any): User => ({
  id: dbUser.id,
  name: dbUser.name,
  email: dbUser.email,
  avatar: dbUser.avatar,
  friends: [], // Will be populated from junction table
  followedGyms: [], // Will be populated from junction table
  privacySettings: {
    shareLocation: dbUser.privacy_settings?.share_location ?? true,
    shareSchedule: dbUser.privacy_settings?.share_schedule ?? true,
    autoCheckIn: dbUser.privacy_settings?.auto_check_in ?? false,
  },
  createdAt: dbUser.created_at,
  updatedAt: dbUser.updated_at,
});

const transformUserToDB = (user: Partial<User>): any => {
  // Note: friends and followedGyms are now handled by junction tables
  // (user_friendships and user_gym_follows), so we don't include them here
  const dbData: any = {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar || null,
    privacy_settings: user.privacySettings ? {
      share_location: user.privacySettings.shareLocation ?? true,
      share_schedule: user.privacySettings.shareSchedule ?? true,
      auto_check_in: user.privacySettings.autoCheckIn ?? false,
    } : {
      share_location: true,
      share_schedule: true,
      auto_check_in: false,
    },
  };
  
  // Only include fields that exist in the database schema
  // Remove any undefined values to avoid issues
  Object.keys(dbData).forEach(key => {
    if (dbData[key] === undefined) {
      delete dbData[key];
    }
  });
  
  return dbData;
};

const transformPresenceFromDB = (dbPresence: any): Presence => ({
  id: dbPresence.id,
  userId: dbPresence.user_id,
  gymId: dbPresence.gym_id,
  checkedInAt: dbPresence.checked_in_at,
  checkedOutAt: dbPresence.checked_out_at,
  isActive: dbPresence.is_active,
  location: dbPresence.location,
  createdAt: dbPresence.created_at,
  updatedAt: dbPresence.updated_at,
});

const transformPresenceToDB = (presence: Partial<Presence>): any => ({
  id: presence.id,
  user_id: presence.userId,
  gym_id: presence.gymId,
  checked_in_at: presence.checkedInAt,
  checked_out_at: presence.checkedOutAt,
  is_active: presence.isActive,
  location: presence.location,
});

const transformScheduleFromDB = (dbSchedule: any): Schedule => ({
  id: dbSchedule.id,
  userId: dbSchedule.user_id,
  gymId: dbSchedule.gym_id,
  startTime: dbSchedule.start_time,
  endTime: dbSchedule.end_time,
  isRecurring: dbSchedule.is_recurring,
  status: dbSchedule.status,
  recurringPattern: dbSchedule.recurring_pattern,
  workoutType: dbSchedule.workout_type,
  title: dbSchedule.title,
  notes: dbSchedule.notes,
  createdAt: dbSchedule.created_at,
  updatedAt: dbSchedule.updated_at,
});

const transformScheduleToDB = (schedule: Partial<Schedule>): any => ({
  id: schedule.id,
  user_id: schedule.userId,
  gym_id: schedule.gymId,
  start_time: schedule.startTime,
  end_time: schedule.endTime,
  is_recurring: schedule.isRecurring,
  recurring_pattern: schedule.recurringPattern,
  workout_type: schedule.workoutType,
  title: schedule.title,
  notes: schedule.notes,
  status: schedule.status,
});

// User API functions - Updated for junction tables
export const userApi = {
  /**
   * Fast path: fetch only the users row (no auth call, no friends/gyms).
   * Use for initial load so we can show the app quickly; then call getCurrentUser() to fill friends/gyms.
   */
  async getCurrentUserMinimal(userId: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    if (!data) return null;

    return transformUserFromDB(data);
  },

  async getCurrentUser(): Promise<User | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) throw error;
    
    const transformedUser = transformUserFromDB(data);
    
    // OPTIMIZATION: Fetch friends and followed gyms in parallel instead of sequentially
    try {
      const [friendsResult, gymsResult] = await Promise.all([
        (supabase as any)
          .from('user_friendships')
          .select('friend_id')
          .eq('user_id', user.id),
        (supabase as any)
          .from('user_gym_follows')
          .select('gym_id')
          .eq('user_id', user.id),
      ]);

      // Handle friends result
      if (friendsResult.error) {
        console.error('Error fetching friends:', friendsResult.error);
        transformedUser.friends = [];
      } else {
        transformedUser.friends = (friendsResult.data || []).map((f: any) => f.friend_id);
      }

      // Handle followed gyms result
      if (gymsResult.error) {
        console.error('Error fetching followed gyms:', gymsResult.error);
        transformedUser.followedGyms = [];
      } else {
        transformedUser.followedGyms = (gymsResult.data || []).map((g: any) => g.gym_id);
      }
    } catch (error) {
      console.error('Error in parallel queries:', error);
      transformedUser.friends = [];
      transformedUser.followedGyms = [];
    }
    
    return transformedUser;
  },

  async createUser(userData: Partial<User>): Promise<User> {
    if (!userData.id || !userData.name || !userData.email) {
      throw new Error('User data missing required fields: id, name, email');
    }

    // First, check if user already exists
    const { data: existingUser, error: checkError } = await (supabase as any)
      .from('users')
      .select('*')
      .eq('id', userData.id)
      .maybeSingle();

    if (existingUser && !checkError) {
      // User exists, update it with the provided data
      const dbData = transformUserToDB(userData);
      const { data, error } = await (supabase as any)
        .from('users')
        .update({
          name: dbData.name,
          email: dbData.email,
          privacy_settings: dbData.privacy_settings,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userData.id)
        .select()
        .single();

      if (error) throw error;
      return transformUserFromDB(data);
    }

    // User doesn't exist, create it
    const dbData = transformUserToDB(userData);
    const { data, error } = await (supabase as any)
      .from('users')
      .insert([dbData])
      .select()
      .single();

    if (error) throw error;
    return transformUserFromDB(data);
  },

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const dbData = transformUserToDB(updates);
    const { data, error } = await (supabase as any)
      .from('users')
      .update({ ...dbData, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return transformUserFromDB(data);
  },

  async getUserFriends(userId: string): Promise<User[]> {
    const { data, error } = await (supabase as any)
      .from('user_friendships')
      .select(`
        users!user_friendships_friend_id_fkey (
          id, name, email, avatar, privacy_settings, created_at, updated_at
        )
      `)
      .eq('user_id', userId);

    if (error) throw error;
    return (data || []).map((item: any) => transformUserFromDB(item.users));
  },

  async addFriend(userId: string, friendEmail: string): Promise<void> {
    // First, find the friend by email
    const { data: friend, error: friendError } = await supabase
      .from('users')
      .select('id')
      .eq('email', friendEmail)
      .single();

    if (friendError || !friend) {
      throw new Error('Friend not found');
    }

    // Add mutual friendship in junction table
    const { error } = await (supabase as any)
      .from('user_friendships')
      .insert([
        { user_id: userId, friend_id: (friend as any).id },
        { user_id: (friend as any).id, friend_id: userId }
      ]);

    if (error) throw error;
  },

  async addFriendInstant(userId: string, friendId: string): Promise<void> {
    // Check if they're already friends
    const { data: existingFriendship, error: checkError } = await (supabase as any)
      .from('user_friendships')
      .select('id')
      .eq('user_id', userId)
      .eq('friend_id', friendId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      throw new Error(`Database error: ${checkError.message}`);
    }

    if (existingFriendship) {
      throw new Error('Already friends');
    }

    // Add mutual friendship in junction table
    const payload = [
      { user_id: userId, friend_id: friendId },
      { user_id: friendId, friend_id: userId }
    ];
    const { error } = await (supabase as any)
      .from('user_friendships')
      .insert(payload);

    if (error) {
      throw error;
    }
  },

  async removeFriend(userId: string, friendId: string): Promise<void> {
    // Remove mutual friendship from junction table
    const { error } = await (supabase as any)
      .from('user_friendships')
      .delete()
      .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`);

    if (error) throw error;
  },

  async deleteUser(userId: string): Promise<void> {
    // Delete user data from all related tables
    // Note: This will cascade delete due to foreign key constraints
    
    // Delete workout history
    await supabase
      .from('workout_history')
      .delete()
      .eq('user_id', userId);

    // Delete schedules
    await supabase
      .from('schedules')
      .delete()
      .eq('user_id', userId);

    // Delete presence records
    await (supabase as any)
      .from('user_gym_presence')
      .delete()
      .eq('user_id', userId);

    // Delete friendships
    await (supabase as any)
      .from('user_friendships')
      .delete()
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

    // Delete gym follows
    await (supabase as any)
      .from('user_gym_follows')
      .delete()
      .eq('user_id', userId);

    // Delete user record
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);

    if (error) throw error;
  }
};

// Gym API functions - Updated for junction tables (climbing gyms only)
export const gymApi = {
  async getAllGyms(): Promise<Gym[]> {
    const { data, error } = await supabase
      .from('gyms')
      .select('*')
      .eq('category', 'climbing')
      .order('name');

    if (error) throw error;
    return data || [];
  },

  async getGymById(id: string): Promise<Gym> {
    const { data, error } = await supabase
      .from('gyms')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  async createGym(gymData: CreateGymForm): Promise<Gym> {
    const { data, error } = await (supabase as any)
      .from('gyms')
      .insert([gymData])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async followGym(userId: string, gymId: string): Promise<void> {
    // Add to junction table (ignore if already exists)
    const { error } = await (supabase as any)
      .from('user_gym_follows')
      .insert([{ user_id: userId, gym_id: gymId }])
      .select()
      .single();

    // If it's a duplicate key error, that's okay - user is already following
    if (error && error.code !== '23505') {
      throw error;
    }
  },

  async unfollowGym(userId: string, gymId: string): Promise<void> {
    // Remove from junction table
    const { error } = await (supabase as any)
      .from('user_gym_follows')
      .delete()
      .eq('user_id', userId)
      .eq('gym_id', gymId);

    if (error) throw error;
  },

  async getFollowedGyms(userId: string): Promise<Gym[]> {
    const { data, error } = await (supabase as any)
      .from('user_gym_follows')
      .select(`
        gyms (
          id, name, address, latitude, longitude, category, created_at, updated_at
        )
      `)
      .eq('user_id', userId);

    if (error) throw error;
    return (data || []).map((item: any) => item.gyms);
  },

  async getGymFollowers(gymId: string): Promise<string[]> {
    const { data, error } = await (supabase as any)
      .from('user_gym_follows')
      .select('user_id')
      .eq('gym_id', gymId);

    if (error) throw error;
    return (data || []).map((item: any) => item.user_id);
  },

  async getGymCurrentUsers(gymId: string): Promise<string[]> {
    const { data, error } = await (supabase as any)
      .from('user_gym_presence')
      .select('user_id')
      .eq('gym_id', gymId)
      .eq('is_active', true);

    if (error) throw error;
    return (data || []).map((item: any) => item.user_id);
  }
};

// Climbing areas (outdoor crags) - curated list
const transformClimbingAreaFromDB = (row: any): ClimbingArea => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  latitude: row.latitude,
  longitude: row.longitude,
  geofenceRadiusM: row.geofence_radius_m ?? 400,
  region: row.region,
  country: row.country,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const climbingAreasApi = {
  async getAll(): Promise<ClimbingArea[]> {
    try {
      const { data, error } = await withTimeout(
        (supabase as any).from('climbing_areas').select('*').order('name')
      );
      if (error) throw error;
      const areas = (data || []).map(transformClimbingAreaFromDB);
      await offlineCache.setCachedAreas(areas);
      return areas;
    } catch (e) {
      if (isNetworkError(e)) {
        const cached = await offlineCache.getCachedAreas();
        if (cached?.data?.length) return cached.data;
      }
      throw e;
    }
  },

  async getById(areaId: string): Promise<ClimbingArea | null> {
    const { data, error } = await (supabase as any)
      .from('climbing_areas')
      .select('*')
      .eq('id', areaId)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data ? transformClimbingAreaFromDB(data) : null;
  },
};

// User area follows (follow an area to see its feed)
export const userAreaFollowsApi = {
  async follow(userId: string, areaId: string): Promise<void> {
    const { error } = await (supabase as any)
      .from('user_area_follows')
      .insert([{ user_id: userId, area_id: areaId }]);
    if (error && error.code !== '23505') throw error;
  },

  async unfollow(userId: string, areaId: string): Promise<void> {
    const { error } = await (supabase as any)
      .from('user_area_follows')
      .delete()
      .eq('user_id', userId)
      .eq('area_id', areaId);
    if (error) throw error;
  },

  async getFollowedAreaIds(userId: string): Promise<string[]> {
    const { data, error } = await (supabase as any)
      .from('user_area_follows')
      .select('area_id')
      .eq('user_id', userId);
    if (error) throw error;
    return (data || []).map((r: any) => r.area_id);
  },

  async getFollowedAreas(userId: string): Promise<ClimbingArea[]> {
    const { data, error } = await (supabase as any)
      .from('user_area_follows')
      .select('climbing_areas(*)')
      .eq('user_id', userId);
    if (error) throw error;
    return (data || [])
      .map((r: any) => r.climbing_areas)
      .filter(Boolean)
      .map(transformClimbingAreaFromDB);
  },
};

// User area visits (presence at crag for "who's at the crag" and geofence)
const transformUserAreaVisitFromDB = (row: any): UserAreaVisit => ({
  id: row.id,
  userId: row.user_id,
  areaId: row.area_id,
  firstEnteredAt: row.first_entered_at,
  lastSeenAt: row.last_seen_at,
  leftAt: row.left_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const userAreaVisitsApi = {
  /** Returns the visit and whether to send "just rolled up" notification (first entry in 72h). */
  async recordVisit(userId: string, areaId: string): Promise<{ visit: UserAreaVisit; shouldNotify: boolean }> {
    try {
      const now = new Date().toISOString();
      const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
      const { data: existing } = await (supabase as any)
        .from('user_area_visits')
        .select('*')
        .eq('user_id', userId)
        .eq('area_id', areaId)
        .is('left_at', null)
        .order('last_seen_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        const { data, error } = await (supabase as any)
          .from('user_area_visits')
          .update({ last_seen_at: now, updated_at: now })
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw error;
        return { visit: transformUserAreaVisitFromDB(data), shouldNotify: false };
      }

      const { data: recentClosed } = await (supabase as any)
        .from('user_area_visits')
        .select('id')
        .eq('user_id', userId)
        .eq('area_id', areaId)
        .not('left_at', 'is', null)
        .gte('left_at', seventyTwoHoursAgo)
        .limit(1);
      const shouldNotify = !recentClosed?.length;

      const { data, error } = await (supabase as any)
        .from('user_area_visits')
        .insert([{
          user_id: userId,
          area_id: areaId,
          first_entered_at: now,
          last_seen_at: now,
          updated_at: now,
        }])
        .select()
        .single();
      if (error) throw error;
      return { visit: transformUserAreaVisitFromDB(data), shouldNotify };
    } catch (e) {
      if (isNetworkError(e)) {
        await offlineQueue.add({ type: 'area_visit', payload: { userId, areaId } });
        return { visit: null as unknown as UserAreaVisit, shouldNotify: false };
      }
      throw e;
    }
  },

  async leaveArea(userId: string, areaId: string): Promise<void> {
    try {
      const now = new Date().toISOString();
      const { error } = await (supabase as any)
        .from('user_area_visits')
        .update({ left_at: now, updated_at: now })
        .eq('user_id', userId)
        .eq('area_id', areaId)
        .is('left_at', null);
      if (error) throw error;
    } catch (e) {
      if (isNetworkError(e)) {
        await offlineQueue.add({ type: 'leave_area', payload: { userId, areaId } });
        return;
      }
      throw e;
    }
  },

  async getActiveVisitsByArea(areaId: string): Promise<UserAreaVisit[]> {
    const { data, error } = await (supabase as any)
      .from('user_area_visits')
      .select('*')
      .eq('area_id', areaId)
      .is('left_at', null)
      .gte('last_seen_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    if (error) throw error;
    return (data || []).map(transformUserAreaVisitFromDB);
  },

  async getFriendsAtArea(userId: string, areaId: string): Promise<string[]> {
    const visits = await this.getActiveVisitsByArea(areaId);
    const friends = await userApi.getUserFriends(userId);
    const friendIds = new Set(friends.map(f => f.id));
    return visits.map(v => v.userId).filter(id => friendIds.has(id) && id !== userId);
  },

  /** Returns all areas where the user's friends are currently present (one bulk request for map view). */
  async getFriendsPresenceForUser(userId: string): Promise<{ areaId: string; userId: string }[]> {
    const friends = await userApi.getUserFriends(userId);
    const friendIds = friends.map(f => f.id);
    if (friendIds.length === 0) return [];
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await (supabase as any)
      .from('user_area_visits')
      .select('area_id, user_id')
      .in('user_id', friendIds)
      .is('left_at', null)
      .gte('last_seen_at', since);
    if (error) throw error;
    return (data || []).map((r: any) => ({ areaId: r.area_id, userId: r.user_id }));
  },

  /**
   * Like getFriendsPresenceForUser but for testing: also treats friends as "at area" if their trip
   * (user_area_plans) covers today. Use in dev/test only (e.g. when __DEV__ is true).
   */
  async getFriendsPresenceForUserWithTripTest(userId: string): Promise<{ areaId: string; userId: string }[]> {
    const fromVisits = await this.getFriendsPresenceForUser(userId);
    const today = new Date().toISOString().slice(0, 10);
    const { data: plans } = await (supabase as any)
      .from('user_area_plans')
      .select('area_id, user_id')
      .in('user_id', (await userApi.getUserFriends(userId)).map(f => f.id))
      .lte('start_date', today)
      .gte('end_date', today);
    const set = new Set(fromVisits.map((p) => `${p.areaId}:${p.userId}`));
    for (const r of plans || []) {
      const key = `${r.area_id}:${r.user_id}`;
      if (!set.has(key)) {
        set.add(key);
        fromVisits.push({ areaId: r.area_id, userId: r.user_id });
      }
    }
    return fromVisits;
  },
};

// User area plans (trip planning)
const transformUserAreaPlanFromDB = (row: any): UserAreaPlan => ({
  id: row.id,
  userId: row.user_id,
  areaId: row.area_id,
  startDate: row.start_date,
  endDate: row.end_date,
  notes: row.notes,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const transformTripInvitationFromDB = (row: any): TripInvitation => ({
  id: row.id,
  tripId: row.trip_id,
  inviteeUserId: row.invitee_user_id,
  inviterUserId: row.inviter_user_id,
  status: row.status,
  comment: row.comment,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const userAreaPlansApi = {
  async create(userId: string, areaId: string, startDate: string, endDate: string, notes?: string): Promise<UserAreaPlan> {
    try {
      const { data, error } = await (supabase as any)
        .from('user_area_plans')
        .insert([{
          user_id: userId,
          area_id: areaId,
          start_date: startDate,
          end_date: endDate,
          notes: notes || null,
        }])
        .select()
        .single();
      if (error) throw error;
      return transformUserAreaPlanFromDB(data);
    } catch (e) {
      if (isNetworkError(e)) {
        await offlineQueue.add({ type: 'trip_plan_create', payload: { userId, areaId, startDate, endDate, notes } });
        return {
          id: 'pending',
          userId,
          areaId,
          startDate,
          endDate,
          notes: notes ?? undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as UserAreaPlan;
      }
      throw e;
    }
  },

  async update(planId: string, updates: { startDate?: string; endDate?: string; notes?: string }): Promise<UserAreaPlan> {
    try {
      const db: any = {};
      if (updates.startDate != null) db.start_date = updates.startDate;
      if (updates.endDate != null) db.end_date = updates.endDate;
      if (updates.notes != null) db.notes = updates.notes;
      if (Object.keys(db).length === 0) {
        const { data } = await (supabase as any).from('user_area_plans').select('*').eq('id', planId).single();
        return transformUserAreaPlanFromDB(data);
      }
      const { data, error } = await (supabase as any)
        .from('user_area_plans')
        .update(db)
        .eq('id', planId)
        .select()
        .single();
      if (error) throw error;
      return transformUserAreaPlanFromDB(data);
    } catch (e) {
      if (isNetworkError(e)) {
        await offlineQueue.add({ type: 'trip_plan_update', payload: { planId, updates } });
        return { id: planId, userId: '', areaId: '', startDate: updates.startDate ?? '', endDate: updates.endDate ?? '', notes: updates.notes, createdAt: '', updatedAt: '' } as UserAreaPlan;
      }
      throw e;
    }
  },

  async delete(planId: string): Promise<void> {
    try {
      const { error } = await (supabase as any).from('user_area_plans').delete().eq('id', planId);
      if (error) throw error;
    } catch (e) {
      if (isNetworkError(e)) {
        await offlineQueue.add({ type: 'trip_plan_delete', payload: { planId } });
        return;
      }
      throw e;
    }
  },

  async getByUser(userId: string): Promise<UserAreaPlan[]> {
    const { data, error } = await (supabase as any)
      .from('user_area_plans')
      .select('*')
      .eq('user_id', userId)
      .order('start_date');
    if (error) throw error;
    return (data || []).map(transformUserAreaPlanFromDB);
  },

  async getByArea(areaId: string): Promise<UserAreaPlan[]> {
    const { data, error } = await (supabase as any)
      .from('user_area_plans')
      .select('*')
      .eq('area_id', areaId)
      .order('start_date');
    if (error) throw error;
    return (data || []).map(transformUserAreaPlanFromDB);
  },

  async getFriendsPlansAtArea(userId: string, areaId: string, startDate: string, endDate: string): Promise<{ plan: UserAreaPlan; inviterName?: string }[]> {
    const friends = await userApi.getUserFriends(userId);
    const friendIds = friends.map(f => f.id);
    if (friendIds.length === 0) return [];
    const { data, error } = await (supabase as any)
      .from('user_area_plans')
      .select('*')
      .eq('area_id', areaId)
      .in('user_id', friendIds)
      .lte('start_date', endDate)
      .gte('end_date', startDate)
      .order('start_date');
    if (error) throw error;
    const plans = (data || []).map(transformUserAreaPlanFromDB);
    return plans.map(plan => ({ plan, inviterName: friends.find(f => f.id === plan.userId)?.name }));
  },
};

export const tripInvitationsApi = {
  async create(tripId: string, inviterUserId: string, inviteeUserId: string, comment?: string): Promise<TripInvitation> {
    try {
      const { data, error } = await (supabase as any)
        .from('trip_invitations')
        .insert([{
          trip_id: tripId,
          inviter_user_id: inviterUserId,
          invitee_user_id: inviteeUserId,
          status: 'invited',
          comment: comment || null,
        }])
        .select()
        .single();
      if (error) throw error;
      return transformTripInvitationFromDB(data);
    } catch (e) {
      if (isNetworkError(e)) {
        await offlineQueue.add({ type: 'trip_invitation_create', payload: { tripId, inviterUserId, inviteeUserId, comment } });
        return { id: 'pending', tripId, inviteeUserId, inviterUserId, status: 'invited', comment: comment ?? undefined, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as TripInvitation;
      }
      throw e;
    }
  },

  async getByTrip(tripId: string): Promise<TripInvitation[]> {
    const { data, error } = await (supabase as any)
      .from('trip_invitations')
      .select('*')
      .eq('trip_id', tripId);
    if (error) throw error;
    return (data || []).map(transformTripInvitationFromDB);
  },

  async getByInvitee(inviteeUserId: string): Promise<(TripInvitation & { trip?: UserAreaPlan })[]> {
    const { data, error } = await (supabase as any)
      .from('trip_invitations')
      .select('*, user_area_plans(*)')
      .eq('invitee_user_id', inviteeUserId);
    if (error) throw error;
    return (data || []).map((row: any) => ({
      ...transformTripInvitationFromDB(row),
      trip: row.user_area_plans ? transformUserAreaPlanFromDB(row.user_area_plans) : undefined,
    }));
  },

  async respond(invitationId: string, status: 'accepted' | 'declined'): Promise<void> {
    try {
      const { error } = await (supabase as any)
        .from('trip_invitations')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', invitationId);
      if (error) throw error;
    } catch (e) {
      if (isNetworkError(e)) {
        await offlineQueue.add({ type: 'trip_invitation_respond', payload: { invitationId, status } });
        return;
      }
      throw e;
    }
  },
};

// Presence API functions - Updated for junction table
export const presenceApi = {
  async getCurrentPresence(userId: string): Promise<Presence[]> {
    const { data, error } = await (supabase as any)
      .from('user_gym_presence')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) throw error;
    return (data || []).map(transformPresenceFromDB);
  },

  async checkIn(userId: string, gymId: string, location?: { latitude: number; longitude: number }): Promise<Presence> {
    try {
      await (supabase as any)
        .from('user_gym_presence')
        .update({ 
          is_active: false,
          checked_out_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('is_active', true);

      const { data, error } = await (supabase as any)
        .from('user_gym_presence')
        .insert([{
          user_id: userId,
          gym_id: gymId,
          checked_in_at: new Date().toISOString(),
          is_active: true,
          location,
        }])
        .select()
        .single();

      if (error) throw error;
      return transformPresenceFromDB(data);
    } catch (e) {
      if (isNetworkError(e)) {
        await offlineQueue.add({ type: 'gym_check_in', payload: { userId, gymId, location } });
        return {
          id: 'pending',
          userId,
          gymId,
          checkedInAt: new Date().toISOString(),
          checkedOutAt: undefined,
          isActive: true,
          location,
          createdAt: new Date().toISOString(),
        } as Presence;
      }
      throw e;
    }
  },

  async checkOut(userId: string, gymId: string): Promise<void> {
    try {
      const { error } = await (supabase as any)
        .from('user_gym_presence')
        .update({ 
          is_active: false,
          checked_out_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('gym_id', gymId)
        .eq('is_active', true);

      if (error) throw error;
    } catch (e) {
      if (isNetworkError(e)) {
        await offlineQueue.add({ type: 'gym_check_out', payload: { userId, gymId } });
        return;
      }
      throw e;
    }
  },

  async getGymPresence(gymId: string): Promise<Presence[]> {
    const { data, error } = await (supabase as any)
      .from('user_gym_presence')
      .select('*')
      .eq('gym_id', gymId)
      .eq('is_active', true);

    if (error) throw error;
    return (data || []).map(transformPresenceFromDB);
  },

  async getAllActivePresence(gymIds?: string[], userIds?: string[]): Promise<Presence[]> {
    let query = (supabase as any)
      .from('user_gym_presence')
      .select('*')
      .eq('is_active', true);

    // OPTIMIZATION: Filter by gym IDs if provided
    if (gymIds && gymIds.length > 0) {
      query = query.in('gym_id', gymIds);
    }

    // OPTIMIZATION: Filter by user IDs if provided
    if (userIds && userIds.length > 0) {
      query = query.in('user_id', userIds);
    }

    const { data, error} = await query;

    if (error) throw error;
    return (data || []).map(transformPresenceFromDB);
  }
};

// Schedule API functions (unchanged)
export const scheduleApi = {
  async getUserSchedules(userId: string): Promise<Schedule[]> {
    const { data, error } = await supabase
      .from('schedules')
      .select('*')
      .eq('user_id', userId)
      .order('start_time');

    if (error) throw error;
    return (data || []).map(transformScheduleFromDB);
  },

  async createSchedule(scheduleData: CreateScheduleForm, userId: string): Promise<Schedule> {
    const dbData = {
      user_id: userId,
      gym_id: scheduleData.gymId,
      start_time: scheduleData.startTime.toISOString(),
      end_time: scheduleData.endTime.toISOString(),
      is_recurring: scheduleData.isRecurring,
      recurring_pattern: scheduleData.recurringPattern,
      workout_type: scheduleData.workoutType,
      title: scheduleData.title || scheduleData.workoutType || 'Workout',
      notes: scheduleData.notes,
      status: 'planned' as const,
    };

    const { data, error } = await (supabase as any)
      .from('schedules')
      .insert([dbData])
      .select()
      .single();

    if (error) throw error;
    
    const schedule = transformScheduleFromDB(data);
    
    // Generate workout history for ALL schedules (both recurring and non-recurring)
    if (schedule.isRecurring) {
      try {
        console.log(`Creating recurring schedule ${schedule.id}, generating workout history...`);
        
        // Generate from the schedule's start time (or today, whichever is earlier)
        // This ensures we capture all relevant dates, including if the schedule starts in the past
        const scheduleStartTime = new Date(schedule.startTime);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Use the earlier of schedule start time or today
        const startDate = scheduleStartTime < today ? scheduleStartTime : today;
        startDate.setHours(0, 0, 0, 0);
        
        // Generate 90 days ahead from today (not from schedule start)
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 90);
        
        console.log(`Generating history from ${startDate.toISOString()} to ${endDate.toISOString()}`);
        console.log(`Schedule start time: ${scheduleStartTime.toISOString()}, Today: ${today.toISOString()}`);
        
        const generatedWorkouts = await workoutHistoryGenerator.generateWorkoutHistoryFromSchedule(
          schedule.id, 
          startDate, 
          endDate
        );
        console.log(`Successfully generated ${generatedWorkouts.length} workout history entries for schedule ${schedule.id}`);
      } catch (historyError) {
        console.error('Failed to generate workout history for new schedule:', historyError);
        console.error('Error details:', JSON.stringify(historyError, null, 2));
        // Don't fail the schedule creation if history generation fails
      }
    } else {
      // For non-recurring schedules, create a single workout history entry
      try {
        console.log(`Creating non-recurring schedule ${schedule.id}, generating workout history...`);
        
        const startDate = new Date(schedule.startTime);
        const endDate = new Date(schedule.endTime);
        const duration = Math.round((endDate.getTime() - startDate.getTime()) / 60000); // Duration in minutes
        
        const workoutHistoryData = {
          user_id: schedule.userId,
          gym_id: schedule.gymId,
          start_time: schedule.startTime,
          end_time: schedule.endTime,
          duration: duration,
          workout_type: schedule.workoutType,
          title: schedule.title || schedule.workoutType || 'Workout',
          notes: schedule.notes,
          status: 'planned' as const,
          schedule_id: schedule.id,
          is_exception: false,
          is_recurring: schedule.isRecurring, // FIX: Set is_recurring based on schedule
        };

        const { data: workoutHistoryEntry, error: historyError } = await (supabase as any)
          .from('workout_history')
          .insert([workoutHistoryData])
          .select()
          .single();

        if (historyError) {
          console.error('Failed to create workout history entry for non-recurring schedule:', historyError);
          // Don't fail the schedule creation if history generation fails
        } else {
          console.log(`Successfully created workout history entry for non-recurring schedule ${schedule.id}`);
        }
      } catch (historyError) {
        console.error('Failed to generate workout history for non-recurring schedule:', historyError);
        // Don't fail the schedule creation if history generation fails
      }
    }
    
    return schedule;
  },

  async updateSchedule(id: string, updates: Partial<Schedule>): Promise<Schedule> {
    const dbData = transformScheduleToDB(updates);
    const { data, error } = await (supabase as any)
      .from('schedules')
      .update({ 
        ...dbData, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    
    const schedule = transformScheduleFromDB(data);
    
    // Regenerate workout history for recurring schedules
    if (schedule.isRecurring) {
      try {
        const fromDate = new Date();
        await workoutHistoryGenerator.regenerateScheduleHistory(id, fromDate);
        console.log(`Regenerated workout history for updated schedule ${id}`);
      } catch (historyError) {
        console.error('Failed to regenerate workout history for updated schedule:', historyError);
        // Don't fail the schedule update if history regeneration fails
      }
    }
    
    return schedule;
  },

  async deleteSchedule(id: string): Promise<void> {
    // Delete future workout history entries for this schedule
    try {
      const fromDate = new Date();
      await workoutHistoryGenerator.deleteFutureWorkoutHistory(id, fromDate);
      console.log(`Deleted future workout history for schedule ${id}`);
    } catch (historyError) {
      console.error('Failed to delete future workout history:', historyError);
      // Continue with schedule deletion even if history deletion fails
    }
    
    const { error } = await supabase
      .from('schedules')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async regenerateWorkoutHistory(scheduleId: string): Promise<void> {
    // Get the schedule to determine the start date
    const { data: schedule, error: scheduleError } = await (supabase as any)
      .from('schedules')
      .select('*')
      .eq('id', scheduleId)
      .single();

    if (scheduleError || !schedule) {
      throw new Error('Schedule not found');
    }

    const scheduleStartTime = new Date(schedule.start_time);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Use the schedule's start time (or today, whichever is earlier)
    const startDate = scheduleStartTime < today ? scheduleStartTime : today;
    startDate.setHours(0, 0, 0, 0);

    // Generate 90 days ahead
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 90);

    await workoutHistoryGenerator.generateWorkoutHistoryFromSchedule(
      scheduleId,
      startDate,
      endDate
    );
  },

  async deleteRecurringSchedule(userId: string, workoutType: string, recurringPattern: any, startTime: string): Promise<void> {
    // Delete all instances of a recurring workout
    // Match by user, workout type, recurring pattern, and approximate start time
    const { error } = await supabase
      .from('schedules')
      .delete()
      .eq('user_id', userId)
      .eq('workout_type', workoutType)
      .eq('is_recurring', true)
      .eq('recurring_pattern', recurringPattern);

    if (error) throw error;
  },

  async getGymSchedules(gymId: string, startDate?: Date, endDate?: Date): Promise<Schedule[]> {
    let query = supabase
      .from('schedules')
      .select('*')
      .eq('gym_id', gymId)
      .order('start_time');

    if (startDate) {
      query = query.gte('start_time', startDate.toISOString());
    }
    if (endDate) {
      query = query.lte('start_time', endDate.toISOString());
    }

    const { data, error } = await query;

    if (error) throw error;
    return (data || []).map(transformScheduleFromDB);
  }
};

// Workout History API functions (unchanged)
export const workoutHistoryApi = {
  async getWorkoutHistory(userId: string, startDate?: Date, endDate?: Date): Promise<WorkoutHistory[]> {
    let query = supabase
      .from('workout_history')
      .select('*')
      .eq('user_id', userId)
      .order('start_time', { ascending: false });

    if (startDate) {
      query = query.gte('start_time', startDate.toISOString());
    }

    if (endDate) {
      query = query.lte('end_time', endDate.toISOString());
    }

    const { data, error } = await query;

    if (error) throw error;
    return (data || []).map(transformWorkoutHistoryFromDB);
  },

  async getWorkoutHistoryById(id: string): Promise<WorkoutHistory> {
    const { data, error } = await supabase
      .from('workout_history')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return transformWorkoutHistoryFromDB(data);
  },

  async createWorkoutHistory(workoutData: Omit<WorkoutHistory, 'id' | 'createdAt' | 'updatedAt'>): Promise<WorkoutHistory> {
    const dbData = {
      user_id: workoutData.userId,
      gym_id: workoutData.gymId,
      start_time: workoutData.startTime,
      end_time: workoutData.endTime,
      duration: workoutData.duration,
      workout_type: workoutData.workoutType,
      title: workoutData.title,
      notes: workoutData.notes,
      exercises: workoutData.exercises || [],
      presence_id: workoutData.presenceId,
      schedule_id: workoutData.scheduleId,
      is_exception: workoutData.isException,
      is_recurring: workoutData.isRecurring ?? false, // FIX: Include is_recurring (default to false)
      status: workoutData.status,
    };

    const { data, error } = await (supabase as any)
      .from('workout_history')
      .insert([dbData])
      .select()
      .single();

    if (error) throw error;
    return transformWorkoutHistoryFromDB(data);
  },

  async updateWorkoutHistory(id: string, updates: Partial<WorkoutHistory>): Promise<WorkoutHistory> {
    const dbUpdates: any = {};

    if (updates.workoutType !== undefined) dbUpdates.workout_type = updates.workoutType;
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    if (updates.exercises !== undefined) dbUpdates.exercises = updates.exercises;
    if (updates.startTime !== undefined) dbUpdates.start_time = updates.startTime;
    if (updates.endTime !== undefined) dbUpdates.end_time = updates.endTime;
    if (updates.duration !== undefined) dbUpdates.duration = updates.duration;
    if (updates.scheduleId !== undefined) dbUpdates.schedule_id = updates.scheduleId;
    if (updates.isException !== undefined) dbUpdates.is_exception = updates.isException;
    if (updates.status !== undefined) dbUpdates.status = updates.status;

    const { data, error } = await (supabase as any)
      .from('workout_history')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return transformWorkoutHistoryFromDB(data);
  },

  async deleteWorkoutHistory(id: string): Promise<void> {
    const { error } = await supabase
      .from('workout_history')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async getWorkoutHistoryByPresenceId(presenceId: string): Promise<WorkoutHistory | null> {
    const { data, error } = await supabase
      .from('workout_history')
      .select('*')
      .eq('presence_id', presenceId)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "not found" error
    return data ? transformWorkoutHistoryFromDB(data) : null;
  }
};

// Workout Invitation API functions (unchanged)
export const workoutInvitationApi = {
  async createWorkoutInvitation(
    inviterId: string, 
    invitationData: CreateWorkoutInvitationData
  ): Promise<WorkoutInvitation> {
    return workoutInvitationService.createWorkoutInvitation(inviterId, invitationData);
  },

  async getWorkoutInvitationsForUser(userId: string): Promise<WorkoutInvitationWithResponses[]> {
    return workoutInvitationService.getWorkoutInvitationsForUser(userId);
  },

  async getWorkoutInvitationsCreatedByUser(userId: string): Promise<WorkoutInvitationWithResponses[]> {
    return workoutInvitationService.getWorkoutInvitationsCreatedByUser(userId);
  },

  async respondToInvitation(
    invitationId: string, 
    userId: string, 
    response: 'accepted' | 'declined'
  ): Promise<void> {
    return workoutInvitationService.respondToInvitation(invitationId, userId, response);
  },

  async bailFromWorkout(
    invitationId: string, 
    userId: string, 
    reason?: string
  ): Promise<void> {
    return workoutInvitationService.bailFromWorkout(invitationId, userId, reason);
  },

  async cancelInvitation(invitationId: string, inviterId: string): Promise<void> {
    return workoutInvitationService.cancelInvitation(invitationId, inviterId);
  },

  async getInvitationById(invitationId: string): Promise<WorkoutInvitationWithResponses | null> {
    return workoutInvitationService.getInvitationById(invitationId);
  },

  async getPendingInvitationsCount(userId: string): Promise<number> {
    return workoutInvitationService.getPendingInvitationsCount(userId);
  },

  async getAcceptedInvitationsForUser(
    userId: string, 
    startDate?: Date, 
    endDate?: Date
  ): Promise<WorkoutInvitationWithResponses[]> {
    return workoutInvitationService.getAcceptedInvitationsForUser(userId, startDate, endDate);
  }
};

// Transform functions for workout history
function transformWorkoutHistoryFromDB(data: any): WorkoutHistory {
  return {
    id: data.id,
    userId: data.user_id,
    gymId: data.gym_id,
    startTime: data.start_time,
    endTime: data.end_time,
    duration: data.duration,
    workoutType: data.workout_type,
    title: data.title,
    notes: data.notes,
    exercises: data.exercises || [],
    presenceId: data.presence_id,
    scheduleId: data.schedule_id,
    isException: data.is_exception,
    isRecurring: data.is_recurring ?? false, // FIX: Read is_recurring from database (default to false for backwards compatibility)
    status: data.status || 'completed',
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

// Groups API functions
export const groupsApi = {
  async createGroup(
    creatorUserId: string,
    groupData: {
      name: string;
      description?: string;
      privacy: 'public' | 'private' | 'invite-only';
      locationType?: 'gym' | 'city' | 'crag';
      associatedGymId?: string;
      associatedCity?: string;
      associatedCrag?: string;
      invitedUserIds: string[];
    }
  ): Promise<any> {
    // Create the group
    const groupDbData: any = {
      creator_user_id: creatorUserId,
      name: groupData.name,
      description: groupData.description || null,
      privacy: groupData.privacy,
      location_type: groupData.locationType || null,
      associated_gym_id: groupData.associatedGymId || null,
      associated_city: groupData.associatedCity || null,
      associated_crag: groupData.associatedCrag || null,
    };

    const { data: group, error: groupError } = await (supabase as any)
      .from('groups')
      .insert([groupDbData])
      .select()
      .single();

    if (groupError) throw groupError;

    const groupId = group.group_id;

    // Add creator as admin member
    const { error: creatorMemberError } = await (supabase as any)
      .from('group_members')
      .insert([{
        group_id: groupId,
        user_id: creatorUserId,
        role: 'admin',
      }]);

    if (creatorMemberError) {
      // Rollback group creation if member creation fails
      await (supabase as any).from('groups').delete().eq('group_id', groupId);
      throw creatorMemberError;
    }

    // Create the group chat (1:1 with group)
    const { error: chatError } = await (supabase as any)
      .from('group_chats')
      .insert([{
        group_id: groupId,
      }]);

    if (chatError) {
      console.error('Error creating group chat:', chatError);
      // Don't fail group creation if chat creation fails
    }

    // Create invitations for invited users (if any)
    if (groupData.invitedUserIds && groupData.invitedUserIds.length > 0) {
      // Create invitations (they'll need to be accepted, or we can auto-accept them)
      const invitationInserts = groupData.invitedUserIds.map(userId => ({
        group_id: groupId,
        inviter_id: creatorUserId,
        invited_user_id: userId,
        status: 'pending',
      }));

      const { data: invitations, error: invitationsError } = await (supabase as any)
        .from('group_invitations')
        .insert(invitationInserts)
        .select();

      if (invitationsError) {
        console.error('Error creating invitations:', invitationsError);
        // Don't fail group creation if invitations fail
      } else {
        // Auto-accept invitations to immediately add members
        // (since they were explicitly invited during group creation)
        // This will trigger the database trigger to add them to group_members
        if (invitations && invitations.length > 0) {
          for (const invitation of invitations) {
            try {
              await (supabase as any)
                .from('group_invitations')
                .update({
                  status: 'accepted',
                  responded_at: new Date().toISOString(),
                })
                .eq('invitation_id', invitation.invitation_id)
                .eq('invited_user_id', invitation.invited_user_id);
            } catch (acceptError) {
              console.error('Error auto-accepting invitation:', acceptError);
              // Continue with other invitations even if one fails
            }
          }
        }
      }
    }

    return group;
  },

  async getUserGroups(userId: string): Promise<any[]> {
    const { data, error } = await (supabase as any)
      .from('group_members')
      .select(`
        group_id,
        role,
        joined_at,
        groups (
          group_id,
          name,
          description,
          privacy,
          location_type,
          associated_gym_id,
          associated_city,
          associated_crag,
          created_at
        )
      `)
      .eq('user_id', userId);

    if (error) throw error;

    // Filter out any entries where the group is null (orphaned group_members entries)
    const validData = (data || []).filter((item: any) => item.groups !== null && item.groups !== undefined);

    if (validData.length === 0) {
      return [];
    }

    // OPTIMIZATION: Batch fetch all member counts in one query using aggregation
    const groupIds = validData.map((item: any) => item.groups?.group_id).filter(Boolean);
    const uniqueGroupIds = Array.from(new Set(groupIds));

    // Get all member counts in a single query using aggregation
    const { data: memberCountsData, error: countsError } = await (supabase as any)
      .from('group_members')
      .select('group_id')
      .in('group_id', uniqueGroupIds);

    if (countsError) {
      console.error('Error fetching member counts:', countsError);
    }

    // Count members per group
    const memberCountsMap = new Map<string, number>();
    (memberCountsData || []).forEach((item: any) => {
      const count = memberCountsMap.get(item.group_id) || 0;
      memberCountsMap.set(item.group_id, count + 1);
    });

    // OPTIMIZATION: Batch fetch all gym names in one query
    const gymIds = validData
      .map((item: any) => item.groups?.associated_gym_id)
      .filter(Boolean);
    const uniqueGymIds = Array.from(new Set(gymIds));

    let gymNamesMap = new Map<string, string>();
    if (uniqueGymIds.length > 0) {
      const { data: gymsData, error: gymsError } = await (supabase as any)
        .from('gyms')
        .select('id, name')
        .in('id', uniqueGymIds);

      if (!gymsError && gymsData) {
        gymsData.forEach((gym: any) => {
          gymNamesMap.set(gym.id, gym.name);
        });
      }
    }

    // Build result using cached data
    const groupsWithCounts = validData
      .map((item: any) => {
        // Double-check that groups exists before accessing properties
        if (!item.groups || !item.groups.group_id) {
          console.warn('Skipping group member entry with missing group data:', item);
          return null;
        }

        return {
          id: item.groups.group_id,
          name: item.groups.name,
          description: item.groups.description,
          privacy: item.groups.privacy,
          locationType: item.groups.location_type,
          locationName: item.groups.associated_gym_id
            ? gymNamesMap.get(item.groups.associated_gym_id)
            : item.groups.associated_city || item.groups.associated_crag || undefined,
          memberCount: memberCountsMap.get(item.group_id) || 0,
          role: item.role,
        };
      })
      .filter((group: any) => group !== null);

    return groupsWithCounts;
  },

  async getGroupMembers(groupId: string): Promise<any[]> {
    const { data, error } = await (supabase as any)
      .from('group_members')
      .select(`
        user_id,
        role,
        users (
          id,
          name,
          email,
          avatar
        )
      `)
      .eq('group_id', groupId);

    if (error) throw error;

    return (data || [])
      .filter((item: any) => item.users !== null && item.users !== undefined)
      .map((item: any) => ({
        userId: item.user_id,
        role: item.role,
        user: item.users,
      }));
  },

  async searchPublicGroups(searchQuery?: string): Promise<any[]> {
    let query = (supabase as any)
      .from('groups')
      .select(`
        group_id,
        name,
        description,
        privacy,
        location_type,
        associated_gym_id,
        associated_city,
        associated_crag
      `)
      .eq('privacy', 'public');

    if (searchQuery && searchQuery.trim()) {
      query = query.or(`name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    // Get member counts for each group
    const groupsWithCounts = await Promise.all(
      (data || []).map(async (group: any) => {
        const { count } = await (supabase as any)
          .from('group_members')
          .select('*', { count: 'exact', head: true })
          .eq('group_id', group.group_id);

        let locationName = null;
        if (group.location_type === 'gym' && group.associated_gym_id) {
          const { data: gymData } = await (supabase as any)
            .from('gyms')
            .select('name')
            .eq('id', group.associated_gym_id)
            .single();
          locationName = gymData?.name;
        } else if (group.location_type === 'city') {
          locationName = group.associated_city;
        } else if (group.location_type === 'crag') {
          locationName = group.associated_crag;
        }

        return {
          id: group.group_id,
          name: group.name,
          description: group.description,
          privacy: group.privacy,
          locationType: group.location_type,
          locationName,
          memberCount: count || 0,
          role: 'member' as const, // Default for search results
        };
      })
    );

    return groupsWithCounts;
  },

  async joinGroup(groupId: string, userId: string): Promise<void> {
    // Check if user is already a member
    const { data: existingMember, error: checkError } = await (supabase as any)
      .from('group_members')
      .select('group_member_id')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      throw new Error(`Database error: ${checkError.message}`);
    }

    if (existingMember) {
      throw new Error('Already a member of this group');
    }

    // Add user as a member
    const { error: insertError } = await (supabase as any)
      .from('group_members')
      .insert([{
        group_id: groupId,
        user_id: userId,
        role: 'member',
      }]);

    if (insertError) {
      // If it's a duplicate key error, that's okay
      if (insertError.code === '23505') {
        throw new Error('Already a member of this group');
      }
      throw insertError;
    }
  },

  async createGroupInvitation(
    groupId: string,
    inviterId: string,
    invitedUserId: string
  ): Promise<any> {
    // Check if user is already a member
    const { data: existingMember } = await (supabase as any)
      .from('group_members')
      .select('group_member_id')
      .eq('group_id', groupId)
      .eq('user_id', invitedUserId)
      .single();

    if (existingMember) {
      throw new Error('User is already a member of this group');
    }

    // Check if there's already a pending invitation
    const { data: existingInvitation } = await (supabase as any)
      .from('group_invitations')
      .select('invitation_id')
      .eq('group_id', groupId)
      .eq('invited_user_id', invitedUserId)
      .eq('status', 'pending')
      .single();

    if (existingInvitation) {
      throw new Error('Invitation already sent to this user');
    }

    // Create invitation
    const { data: invitation, error } = await (supabase as any)
      .from('group_invitations')
      .insert([{
        group_id: groupId,
        inviter_id: inviterId,
        invited_user_id: invitedUserId,
        status: 'pending',
      }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error('Invitation already sent to this user');
      }
      throw error;
    }

    return invitation;
  },

  async acceptGroupInvitation(invitationId: string, userId: string): Promise<void> {
    // Update invitation status to accepted
    // The trigger will automatically add the user to group_members
    const { error } = await (supabase as any)
      .from('group_invitations')
      .update({
        status: 'accepted',
        responded_at: new Date().toISOString(),
      })
      .eq('invitation_id', invitationId)
      .eq('invited_user_id', userId)
      .eq('status', 'pending');

    if (error) throw error;
  },

  async declineGroupInvitation(invitationId: string, userId: string): Promise<void> {
    const { error } = await (supabase as any)
      .from('group_invitations')
      .update({
        status: 'declined',
        responded_at: new Date().toISOString(),
      })
      .eq('invitation_id', invitationId)
      .eq('invited_user_id', userId)
      .eq('status', 'pending');

    if (error) throw error;
  },

  async getGroupInvitationsForUser(userId: string): Promise<any[]> {
    const { data, error } = await (supabase as any)
      .from('group_invitations')
      .select(`
        invitation_id,
        group_id,
        inviter_id,
        status,
        created_at,
        responded_at,
        groups (
          group_id,
          name,
          description,
          privacy,
          location_type,
          associated_gym_id,
          associated_city,
          associated_crag
        ),
        users!group_invitations_inviter_id_fkey (
          id,
          name,
          email,
          avatar
        )
      `)
      .eq('invited_user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((item: any) => ({
      invitationId: item.invitation_id,
      groupId: item.group_id,
      inviterId: item.inviter_id,
      inviter: item.users,
      group: item.groups,
      status: item.status,
      createdAt: item.created_at,
      respondedAt: item.responded_at,
    }));
  },

  async joinGroupFromQR(groupId: string, userId: string): Promise<void> {
    // Create a pending invitation that will be auto-accepted
    try {
      // First, get the group creator as the inviter
      console.log('groupId', groupId);
      console.log('userId', userId);
      const { data: group, error: groupError } = await (supabase as any)
        .from('groups')
        .select('creator_user_id')
        .eq('group_id', groupId)
        .single();

      if (groupError || !group) {
        throw new Error('Group not found');
      }

      // Check if user is already a member
      const { data: existingMember } = await (supabase as any)
        .from('group_members')
        .select('group_member_id')
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .single();

      if (existingMember) {
        throw new Error('Already a member of this group');
      }

      // Check for existing invitation first (to avoid unique constraint violation)
      const { data: existingInvitation } = await (supabase as any)
        .from('group_invitations')
        .select('invitation_id, created_at, status')
        .eq('group_id', groupId)
        .eq('invited_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // If there's an existing pending invitation, accept it
      if (existingInvitation) {
        if (existingInvitation.status === 'accepted') {
          // Already accepted, user should already be a member
          // Verify membership and return
          const { data: memberCheck } = await (supabase as any)
            .from('group_members')
            .select('group_member_id')
            .eq('group_id', groupId)
            .eq('user_id', userId)
            .single();

          if (!memberCheck) {
            // Member not added, add manually as fallback
            await (supabase as any)
              .from('group_members')
              .insert([{
                group_id: groupId,
                user_id: userId,
                role: 'member',
              }]);
          }
          return; // Already accepted, nothing to do
        }

        if (existingInvitation.status === 'pending') {
          // Accept the existing pending invitation
          const { error: updateError } = await (supabase as any)
            .from('group_invitations')
            .update({
              status: 'accepted',
              responded_at: existingInvitation.created_at, // Use created_at since scanning = immediate acceptance
            })
            .eq('invitation_id', existingInvitation.invitation_id)
            .eq('invited_user_id', userId)
            .eq('status', 'pending');

          if (updateError) {
            console.error('Error accepting existing invitation:', updateError);
            throw updateError;
          }

          // Verify that the user was added to group_members (trigger should have done this)
          const { data: memberCheck } = await (supabase as any)
            .from('group_members')
            .select('group_member_id')
            .eq('group_id', groupId)
            .eq('user_id', userId)
            .single();

          if (!memberCheck) {
            console.warn('User was not automatically added to group_members by trigger. Adding manually...');
            // Fallback: manually add to group_members if trigger didn't work
            await (supabase as any)
              .from('group_members')
              .insert([{
                group_id: groupId,
                user_id: userId,
                role: 'member',
              }]);
          }
          return;
        }
      }

      // No existing invitation, create a new one and immediately accept it
      const { data: invitation, error: createError } = await (supabase as any)
        .from('group_invitations')
        .insert([{
          group_id: groupId,
          inviter_id: group.creator_user_id,
          invited_user_id: userId,
          status: 'pending',
        }])
        .select('invitation_id, created_at')
        .single();

      if (createError) {
        // If we still get a duplicate error, it means another process created it
        // Try to find and accept it
        if (createError.code === '23505') {
          const { data: newExistingInvitation } = await (supabase as any)
            .from('group_invitations')
            .select('invitation_id, created_at')
            .eq('group_id', groupId)
            .eq('invited_user_id', userId)
            .eq('status', 'pending')
            .single();

          if (newExistingInvitation) {
            await (supabase as any)
              .from('group_invitations')
              .update({
                status: 'accepted',
                responded_at: newExistingInvitation.created_at,
              })
              .eq('invitation_id', newExistingInvitation.invitation_id)
              .eq('status', 'pending');
            return;
          }
        }
        throw createError;
      }

      // Immediately accept the invitation (trigger will add to group_members)
      // Set responded_at = created_at since scanning the QR code is immediate acceptance
      const { error: updateError } = await (supabase as any)
        .from('group_invitations')
        .update({
          status: 'accepted',
          responded_at: invitation.created_at, // Use created_at since scanning = immediate acceptance
        })
        .eq('invitation_id', invitation.invitation_id)
        .eq('invited_user_id', userId)
        .eq('status', 'pending'); // Only update if still pending

      if (updateError) {
        console.error('Error accepting invitation:', updateError);
        throw new Error(`Failed to accept invitation: ${updateError.message}`);
      }

      // Verify that the user was added to group_members (trigger should have done this)
      const { data: memberCheck, error: memberCheckError } = await (supabase as any)
        .from('group_members')
        .select('group_member_id')
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .single();

      if (memberCheckError || !memberCheck) {
        console.warn('User was not automatically added to group_members by trigger. Adding manually...');
        // Fallback: manually add to group_members if trigger didn't work
        const { error: insertMemberError } = await (supabase as any)
          .from('group_members')
          .insert([{
            group_id: groupId,
            user_id: userId,
            role: 'member',
          }]);

        if (insertMemberError) {
          console.error('Error manually adding member:', insertMemberError);
          // Don't throw - invitation is already accepted
        }
      }
    } catch (error: any) {
      // If user is already a member or invitation already accepted, that's okay
      if (error.message && error.message.includes('already')) {
        return; // Already handled, no error
      }
      throw error;
    }
  },
};

// Chat API functions
export const chatApi = {
  async getGroupChat(groupId: string): Promise<any> {
    const { data, error } = await (supabase as any)
      .from('group_chats')
      .select('*')
      .eq('group_id', groupId)
      .single();

    if (error) throw error;
    return {
      chatId: data.chat_id,
      groupId: data.group_id,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },

  async getChatMessages(chatId: string, limit: number = 50, before?: Date): Promise<any[]> {
    let query = (supabase as any)
      .from('chat_messages')
      .select(`
        *,
        users!chat_messages_sender_user_id_fkey (
          id,
          name,
          avatar
        )
      `)
      .eq('chat_id', chatId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (before) {
      query = query.lt('created_at', before.toISOString());
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data || []).map((msg: any) => ({
      messageId: msg.message_id,
      chatId: msg.chat_id,
      senderUserId: msg.sender_user_id,
      senderName: msg.users?.name,
      senderAvatar: msg.users?.avatar,
      messageText: msg.message_text,
      messageType: msg.message_type,
      metadata: msg.metadata || {},
      createdAt: msg.created_at,
      editedAt: msg.edited_at,
      deletedAt: msg.deleted_at,
    }));
  },

  async sendMessage(
    chatId: string,
    senderUserId: string,
    messageText: string,
    messageType: 'text' | 'image' | 'video' | 'workout-share' | 'system' = 'text',
    metadata?: any
  ): Promise<any> {
    const { data, error } = await (supabase as any)
      .from('chat_messages')
      .insert([{
        chat_id: chatId,
        sender_user_id: senderUserId,
        message_text: messageText,
        message_type: messageType,
        metadata: metadata || {},
      }])
      .select(`
        *,
        users!chat_messages_sender_user_id_fkey (
          id,
          name,
          avatar
        )
      `)
      .single();

    if (error) throw error;

    return {
      messageId: data.message_id,
      chatId: data.chat_id,
      senderUserId: data.sender_user_id,
      senderName: data.users?.name,
      senderAvatar: data.users?.avatar,
      messageText: data.message_text,
      messageType: data.message_type,
      metadata: data.metadata || {},
      createdAt: data.created_at,
      editedAt: data.edited_at,
      deletedAt: data.deleted_at,
    };
  },

  async markMessageAsRead(messageId: string, userId: string): Promise<void> {
    // Use upsert to handle case where read record already exists
    const { error } = await (supabase as any)
      .from('chat_message_reads')
      .upsert([{
        message_id: messageId,
        user_id: userId,
        read_at: new Date().toISOString(),
      }], {
        onConflict: 'message_id,user_id',
      });

    if (error) throw error;
  },

  async markMessagesAsRead(messageIds: string[], userId: string): Promise<void> {
    const reads = messageIds.map(messageId => ({
      message_id: messageId,
      user_id: userId,
      read_at: new Date().toISOString(),
    }));

    const { error } = await (supabase as any)
      .from('chat_message_reads')
      .upsert(reads, {
        onConflict: 'message_id,user_id',
      });

    if (error) throw error;
  },

  async getUnreadMessageCount(chatId: string, userId: string): Promise<number> {
    // Get all read message IDs for this user
    const { data: readMessages, error: readError } = await (supabase as any)
      .from('chat_message_reads')
      .select('message_id')
      .eq('user_id', userId);

    if (readError) {
      console.error('Error getting read messages:', readError);
      return 0;
    }

    const readMessageIds = (readMessages || []).map((r: any) => r.message_id);

    // Get all messages in chat that user hasn't read and didn't send
    const { data, error } = await (supabase as any)
      .from('chat_messages')
      .select('message_id')
      .eq('chat_id', chatId)
      .is('deleted_at', null)
      .neq('sender_user_id', userId); // Don't count own messages

    if (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }

    // Filter out messages that have been read
    const unreadMessages = (data || []).filter((msg: any) => 
      !readMessageIds.includes(msg.message_id)
    );

    return unreadMessages.length;
  },

  async deleteMessage(messageId: string, userId: string): Promise<void> {
    // Soft delete - set deleted_at timestamp
    const { error } = await (supabase as any)
      .from('chat_messages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('message_id', messageId)
      .eq('sender_user_id', userId); // Only allow deleting own messages

    if (error) throw error;
  },

  // Helper function to send system message to group chat
  async sendSystemMessageToGroup(
    groupId: string,
    messageText: string,
    metadata?: any
  ): Promise<void> {
    try {
      const chat = await this.getGroupChat(groupId);
      // Use a system user ID or the first admin - for now, we'll use a placeholder
      // In production, you might want to use a system user or the group creator
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await this.sendMessage(chat.chatId, user.id, messageText, 'system', metadata);
    } catch (error) {
      console.error('Error sending system message to group:', error);
      // Don't throw - we don't want to fail the main operation if messaging fails
    }
  },

  // Send workout invitation message to groups
  async sendWorkoutInvitationToGroups(
    groupIds: string[],
    workoutTitle: string,
    startTime: string,
    inviterName: string
  ): Promise<void> {
    for (const groupId of groupIds) {
      try {
        const startDate = new Date(startTime);
        const formattedTime = startDate.toLocaleString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        });

        const messageText = `${inviterName} created a new workout: "${workoutTitle}" on ${formattedTime}`;
        await this.sendSystemMessageToGroup(groupId, messageText, {
          action: 'workout_invitation_created',
          workoutTitle,
          startTime,
        });
      } catch (error) {
        console.error(`Error sending message to group ${groupId}:`, error);
      }
    }
  },

  // Send workout response message to groups
  async sendWorkoutResponseToGroups(
    groupIds: string[],
    userName: string,
    response: 'accepted' | 'declined' | 'bailed',
    workoutTitle: string,
    reason?: string
  ): Promise<void> {
    for (const groupId of groupIds) {
      try {
        let messageText = '';
        if (response === 'accepted') {
          messageText = `${userName} accepted the invitation to "${workoutTitle}"`;
        } else if (response === 'declined') {
          messageText = `${userName} declined the invitation to "${workoutTitle}"`;
        } else if (response === 'bailed') {
          messageText = `${userName} bailed from "${workoutTitle}"${reason ? `: ${reason}` : ''}`;
        }

        await this.sendSystemMessageToGroup(groupId, messageText, {
          action: 'workout_response',
          response,
          workoutTitle,
          reason,
        });
      } catch (error) {
        console.error(`Error sending response message to group ${groupId}:`, error);
      }
    }
  },

  // Upload image to Supabase Storage
  async uploadImage(fileUri: string, chatId: string, userId: string): Promise<string> {
    try {
      // Read file as blob
      const response = await fetch(fileUri);
      const blob = await response.blob();
      
      // Generate unique filename
      const fileExt = fileUri.split('.').pop();
      const fileName = `${chatId}/${userId}/${Date.now()}.${fileExt}`;
      
      // Upload to Supabase Storage (assuming a 'chat-media' bucket exists)
      const { data, error } = await supabase.storage
        .from('chat-media')
        .upload(fileName, blob, {
          contentType: blob.type || 'image/jpeg',
          upsert: false,
        });

      if (error) throw error;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('chat-media')
        .getPublicUrl(data.path);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  },

  // Upload video to Supabase Storage
  async uploadVideo(fileUri: string, chatId: string, userId: string): Promise<string> {
    try {
      // Read file as blob
      const response = await fetch(fileUri);
      const blob = await response.blob();
      
      // Generate unique filename
      const fileExt = fileUri.split('.').pop();
      const fileName = `${chatId}/${userId}/${Date.now()}.${fileExt}`;
      
      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('chat-media')
        .upload(fileName, blob, {
          contentType: blob.type || 'video/mp4',
          upsert: false,
        });

      if (error) throw error;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('chat-media')
        .getPublicUrl(data.path);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading video:', error);
      throw error;
    }
  },
};

// Climbing Profile API functions
export const climbingProfileApi = {
  async getClimbingProfile(userId: string): Promise<any | null> {
    const { data, error } = await (supabase as any)
      .from('climbing_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No profile found
        return null;
      }
      throw error;
    }

    if (!data) return null;

    return {
      profileId: data.profile_id,
      userId: data.user_id,
      leadClimbing: data.lead_climbing,
      leadGradeSystem: data.lead_grade_system,
      leadGradeMin: data.lead_grade_min,
      leadGradeMax: data.lead_grade_max,
      topRope: data.top_rope,
      topRopeGradeSystem: data.top_rope_grade_system,
      topRopeGradeMin: data.top_rope_grade_min,
      topRopeGradeMax: data.top_rope_grade_max,
      bouldering: data.bouldering,
      boulderGradeSystem: data.boulder_grade_system,
      boulderMaxFlash: data.boulder_max_flash,
      boulderMaxSend: data.boulder_max_send,
      traditionalClimbing: data.traditional_climbing,
      traditionalGradeSystem: data.traditional_grade_system,
      traditionalGradeMin: data.traditional_grade_min,
      traditionalGradeMax: data.traditional_grade_max,
      openToNewPartners: data.open_to_new_partners,
      preferredGradeRangeMin: data.preferred_grade_range_min,
      preferredGradeRangeMax: data.preferred_grade_range_max,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },

  async createOrUpdateClimbingProfile(userId: string, profile: Partial<any>): Promise<any> {
    const dbData: any = {
      user_id: userId,
      lead_climbing: profile.leadClimbing,
      lead_grade_system: profile.leadGradeSystem || null,
      lead_grade_min: profile.leadGradeMin || null,
      lead_grade_max: profile.leadGradeMax || null,
      top_rope: profile.topRope,
      top_rope_grade_system: profile.topRopeGradeSystem || null,
      top_rope_grade_min: profile.topRopeGradeMin || null,
      top_rope_grade_max: profile.topRopeGradeMax || null,
      bouldering: profile.bouldering,
      boulder_grade_system: profile.boulderGradeSystem || null,
      boulder_max_flash: profile.boulderMaxFlash || null,
      boulder_max_send: profile.boulderMaxSend || null,
      traditional_climbing: profile.traditionalClimbing,
      traditional_grade_system: profile.traditionalGradeSystem || null,
      traditional_grade_min: profile.traditionalGradeMin || null,
      traditional_grade_max: profile.traditionalGradeMax || null,
      open_to_new_partners: profile.openToNewPartners ?? false,
      preferred_grade_range_min: profile.preferredGradeRangeMin || null,
      preferred_grade_range_max: profile.preferredGradeRangeMax || null,
    };

    const { data, error } = await (supabase as any)
      .from('climbing_profiles')
      .upsert(dbData, {
        onConflict: 'user_id',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      profileId: data.profile_id,
      userId: data.user_id,
      leadClimbing: data.lead_climbing,
      leadGradeSystem: data.lead_grade_system,
      leadGradeMin: data.lead_grade_min,
      leadGradeMax: data.lead_grade_max,
      topRope: data.top_rope,
      topRopeGradeSystem: data.top_rope_grade_system,
      topRopeGradeMin: data.top_rope_grade_min,
      topRopeGradeMax: data.top_rope_grade_max,
      bouldering: data.bouldering,
      boulderGradeSystem: data.boulder_grade_system,
      boulderMaxFlash: data.boulder_max_flash,
      boulderMaxSend: data.boulder_max_send,
      traditionalClimbing: data.traditional_climbing,
      traditionalGradeSystem: data.traditional_grade_system,
      traditionalGradeMin: data.traditional_grade_min,
      traditionalGradeMax: data.traditional_grade_max,
      openToNewPartners: data.open_to_new_partners,
      preferredGradeRangeMin: data.preferred_grade_range_min,
      preferredGradeRangeMax: data.preferred_grade_range_max,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },

  async getBelayCertifications(userId: string): Promise<any[]> {
    const { data, error } = await (supabase as any)
      .from('belay_certifications')
      .select(`
        *,
        gyms!belay_certifications_gym_id_fkey (
          id,
          name
        )
      `)
      .eq('user_id', userId)
      .order('certified_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((cert: any) => ({
      certificationId: cert.certification_id,
      userId: cert.user_id,
      gymId: cert.gym_id,
      gymName: cert.gyms?.name,
      certificationType: cert.certification_type,
      certifiedAt: cert.certified_at,
      expiresAt: cert.expires_at,
      verifiedByGym: cert.verified_by_gym,
    }));
  },

  async addBelayCertification(
    userId: string,
    gymId: string,
    type: 'top_rope' | 'lead' | 'both'
  ): Promise<any> {
    const { data, error } = await (supabase as any)
      .from('belay_certifications')
      .insert([{
        user_id: userId,
        gym_id: gymId,
        certification_type: type,
      }])
      .select(`
        *,
        gyms!belay_certifications_gym_id_fkey (
          id,
          name
        )
      `)
      .single();

    if (error) throw error;

    return {
      certificationId: data.certification_id,
      userId: data.user_id,
      gymId: data.gym_id,
      gymName: data.gyms?.name,
      certificationType: data.certification_type,
      certifiedAt: data.certified_at,
      expiresAt: data.expires_at,
      verifiedByGym: data.verified_by_gym,
    };
  },

  async removeBelayCertification(certificationId: string): Promise<void> {
    const { error } = await (supabase as any)
      .from('belay_certifications')
      .delete()
      .eq('certification_id', certificationId);

    if (error) throw error;
  },
};

// Area Feed API functions
export const areaFeedApi = {
  async getAreaFeed(
    gymId?: string,
    cragName?: string,
    limit: number = 50,
    postType?: string,
    areaId?: string
  ): Promise<any[]> {
    let query = (supabase as any)
      .from('area_feed_posts')
      .select(`
        *,
        users!area_feed_posts_author_user_id_fkey (
          id,
          name,
          avatar
        ),
        gyms!area_feed_posts_gym_id_fkey (
          id,
          name
        ),
        climbing_areas!area_feed_posts_area_id_fkey (
          id,
          name
        )
      `)
      .is('deleted_at', null)
      .eq('quarantined', false)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (gymId) {
      query = query.eq('gym_id', gymId);
    } else if (areaId) {
      query = query.eq('area_id', areaId);
    } else if (cragName) {
      query = query.eq('crag_name', cragName);
    }

    if (postType) {
      query = query.eq('post_type', postType);
    }

    let data: any;
    let error: any;
    try {
      const result = areaId
        ? await withTimeout(query.then((r: { data: any; error: any }) => r))
        : await query;
      data = result.data;
      error = result.error;
    } catch (e) {
      if (areaId && isNetworkError(e)) {
        const cached = await offlineCache.getCachedAreaFeed(areaId);
        if (cached?.data?.length !== undefined) return cached.data;
      }
      throw e;
    }

    if (error) {
      console.error('Error fetching area feed:', error);
      if (areaId && isNetworkError(error)) {
        const cached = await offlineCache.getCachedAreaFeed(areaId);
        if (cached?.data?.length !== undefined) return cached.data;
      }
      throw error;
    }

    // Log for debugging
    console.log('Area feed query result:', { gymId, cragName, postType, count: data?.length || 0 });

    // Helper function to check if belayer request is expired (1 hour after start time)
    const isBelayerRequestExpired = (post: any): boolean => {
      if (post.post_type !== 'belayer_request' && post.post_type !== 'rally_pads_request') {
        return false; // Not a belayer request, so not expired
      }

      const now = new Date();
      let startTime: Date;

      if (post.urgency === 'now') {
        // For "now" requests, use creation time + 1 hour
        startTime = new Date(post.created_at);
      } else if (post.scheduled_time) {
        // For scheduled requests, use scheduled time
        startTime = new Date(post.scheduled_time);
      } else {
        // Fallback to creation time if no scheduled time
        startTime = new Date(post.created_at);
      }

      // Add 1 hour to start time
      const expiryTime = new Date(startTime.getTime() + 60 * 60 * 1000);
      
      // Check if current time is past expiry
      return now > expiryTime;
    };

    // Get response counts for belayer requests and filter expired ones
    const postsWithCounts = await Promise.all(
      (data || []).map(async (post: any) => {
        // Skip expired belayer requests
        if (isBelayerRequestExpired(post)) {
          return null;
        }

        let responseCount = 0;
        if (post.post_type === 'belayer_request' || post.post_type === 'rally_pads_request') {
          const { count } = await (supabase as any)
            .from('belayer_request_responses')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', post.post_id)
            .eq('status', 'available');
          responseCount = count || 0;
        }

        return {
          postId: post.post_id,
          authorUserId: post.author_user_id,
          authorName: post.users?.name,
          authorAvatar: post.users?.avatar,
          gymId: post.gym_id,
          gymName: post.gyms?.name,
          areaId: post.area_id,
          areaName: post.climbing_areas?.name,
          cragName: post.crag_name,
          postType: post.post_type,
          title: post.title,
          content: post.content,
          climbingType: post.climbing_type,
          targetRoute: post.target_route,
          targetGrade: post.target_grade,
          scheduledTime: post.scheduled_time,
          urgency: post.urgency,
          reportCount: post.report_count,
          quarantined: post.quarantined,
          metadata: post.metadata || {},
          responseCount,
          createdAt: post.created_at,
          updatedAt: post.updated_at,
          deletedAt: post.deleted_at,
        };
      })
    );

    // Filter out null values (expired posts)
    const list = postsWithCounts.filter((post) => post !== null);
    if (areaId) await offlineCache.setCachedAreaFeed(areaId, list);
    return list;
  },

  async getFeedPost(postId: string): Promise<any> {
    const { data, error } = await (supabase as any)
      .from('area_feed_posts')
      .select(`
        *,
        users!area_feed_posts_author_user_id_fkey (
          id,
          name,
          avatar
        ),
        gyms!area_feed_posts_gym_id_fkey (
          id,
          name
        ),
        climbing_areas!area_feed_posts_area_id_fkey (
          id,
          name
        )
      `)
      .eq('post_id', postId)
      .single();

    if (error) throw error;

    // Get responses if it's a belayer request
    let availableResponders: any[] = [];
    if (data.post_type === 'belayer_request' || data.post_type === 'rally_pads_request') {
      const responses = await this.getBelayerRequestResponses(postId);
      availableResponders = responses.filter((r: any) => r.status === 'available');
    }

    return {
      postId: data.post_id,
      authorUserId: data.author_user_id,
      authorName: data.users?.name,
      authorAvatar: data.users?.avatar,
      gymId: data.gym_id,
      gymName: data.gyms?.name,
      areaId: data.area_id,
      areaName: data.climbing_areas?.name,
      cragName: data.crag_name,
      postType: data.post_type,
      title: data.title,
      content: data.content,
      climbingType: data.climbing_type,
      targetRoute: data.target_route,
      targetGrade: data.target_grade,
      scheduledTime: data.scheduled_time,
      urgency: data.urgency,
      reportCount: data.report_count,
      quarantined: data.quarantined,
      metadata: data.metadata || {},
      availableResponders,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      deletedAt: data.deleted_at,
    };
  },

  async createFeedPost(
    post: Omit<any, 'postId' | 'createdAt' | 'updatedAt' | 'reportCount' | 'quarantined'>
  ): Promise<any> {
    const dbData: any = {
      author_user_id: post.authorUserId,
      gym_id: post.gymId || null,
      area_id: post.areaId || null,
      crag_name: post.cragName || null,
      post_type: post.postType,
      title: post.title,
      content: post.content,
      climbing_type: post.climbingType || null,
      target_route: post.targetRoute || null,
      target_grade: post.targetGrade || null,
      scheduled_time: post.scheduledTime || null,
      urgency: post.urgency,
      metadata: post.metadata || {},
    };

    try {
      const { data, error } = await (supabase as any)
        .from('area_feed_posts')
        .insert([dbData])
        .select(`
          *,
          users!area_feed_posts_author_user_id_fkey (
            id,
            name,
            avatar
          ),
          gyms!area_feed_posts_gym_id_fkey (
            id,
            name
          )
        `)
        .single();

      if (error) throw error;

      return {
        postId: data.post_id,
        authorUserId: data.author_user_id,
        authorName: data.users?.name,
      authorAvatar: data.users?.avatar,
      gymId: data.gym_id,
      gymName: data.gyms?.name,
      areaId: data.area_id,
      areaName: data.climbing_areas?.name,
      cragName: data.crag_name,
      postType: data.post_type,
      title: data.title,
      content: data.content,
      climbingType: data.climbing_type,
      targetRoute: data.target_route,
      targetGrade: data.target_grade,
      scheduledTime: data.scheduled_time,
      urgency: data.urgency,
      reportCount: 0,
      quarantined: false,
      metadata: data.metadata || {},
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
    } catch (e) {
      if (isNetworkError(e)) {
        await offlineQueue.add({ type: 'area_feed_post', payload: post });
        return {
          postId: 'pending',
          authorUserId: post.authorUserId,
          authorName: '',
          authorAvatar: undefined,
          gymId: post.gymId,
          gymName: undefined,
          areaId: post.areaId,
          areaName: undefined,
          cragName: post.cragName,
          postType: post.postType,
          title: post.title,
          content: post.content,
          climbingType: post.climbingType,
          targetRoute: post.targetRoute,
          targetGrade: post.targetGrade,
          scheduledTime: post.scheduledTime,
          urgency: post.urgency,
          reportCount: 0,
          quarantined: false,
          metadata: post.metadata || {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
      throw e;
    }
  },

  async respondToBelayerRequest(
    postId: string,
    userId: string,
    message?: string
  ): Promise<any> {
    // Check if user already responded
    const { data: existing } = await (supabase as any)
      .from('belayer_request_responses')
      .select('*')
      .eq('post_id', postId)
      .eq('responder_user_id', userId)
      .single();

    if (existing) {
      // Update existing response
      const { data, error } = await (supabase as any)
        .from('belayer_request_responses')
        .update({
          status: 'available',
          message: message || null,
        })
        .eq('response_id', existing.response_id)
        .select()
        .single();

      if (error) throw error;
      return this.transformBelayerResponse(data);
    }

    // Create new response
    const { data, error } = await (supabase as any)
      .from('belayer_request_responses')
      .insert([{
        post_id: postId,
        responder_user_id: userId,
        status: 'available',
        message: message || null,
      }])
      .select()
      .single();

    if (error) throw error;
    return this.transformBelayerResponse(data);
  },

  async getBelayerRequestResponses(postId: string): Promise<any[]> {
    const { data, error } = await (supabase as any)
      .from('belayer_request_responses')
      .select(`
        *,
        users!belayer_request_responses_responder_user_id_fkey (
          id,
          name,
          avatar
        )
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Fetch climbing profiles for responders
    const responsesWithProfiles = await Promise.all(
      (data || []).map(async (response: any) => {
        const profile = await climbingProfileApi.getClimbingProfile(response.responder_user_id);
        return {
          ...this.transformBelayerResponse(response),
          responderProfile: profile,
        };
      })
    );

    return responsesWithProfiles;
  },

  async selectBelayerResponse(responseId: string, inviterUserId: string): Promise<void> {
    // Verify inviter owns the post
    const { data: response } = await (supabase as any)
      .from('belayer_request_responses')
      .select('post_id')
      .eq('response_id', responseId)
      .single();

    if (!response) throw new Error('Response not found');

    const { data: post } = await (supabase as any)
      .from('area_feed_posts')
      .select('author_user_id')
      .eq('post_id', response.post_id)
      .single();

    if (!post || post.author_user_id !== inviterUserId) {
      throw new Error('Unauthorized: You can only select responses to your own requests');
    }

    // Update response status to 'selected'
    const { error } = await (supabase as any)
      .from('belayer_request_responses')
      .update({ status: 'selected' })
      .eq('response_id', responseId);

    if (error) throw error;
  },

  async reportPost(postId: string, userId: string, reason: string): Promise<void> {
    const { error } = await (supabase as any)
      .from('post_reports')
      .insert([{
        post_id: postId,
        reporter_user_id: userId,
        reason,
      }]);

    if (error) {
      // If already reported, that's okay
      if (error.code === '23505') {
        return;
      }
      throw error;
    }
  },

  transformBelayerResponse(data: any): any {
    return {
      responseId: data.response_id,
      postId: data.post_id,
      responderUserId: data.responder_user_id,
      responderName: data.users?.name,
      responderAvatar: data.users?.avatar,
      status: data.status,
      message: data.message,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },
};

// Belayer Request API (with audience routing)
export const belayerRequestApi = {
  async createBelayerRequest(
    userId: string,
    requestData: any
  ): Promise<any> {
    // Create the feed post
    const post = await areaFeedApi.createFeedPost({
      authorUserId: userId,
      gymId: requestData.gymId || undefined,
      areaId: requestData.areaId || undefined,
      cragName: requestData.cragName || undefined,
      postType: requestData.postType,
      title: requestData.title,
      content: requestData.content,
      climbingType: requestData.climbingType,
      targetRoute: requestData.targetRoute,
      targetGrade: requestData.targetGrade,
      scheduledTime: requestData.scheduledTime,
      urgency: requestData.urgency,
      metadata: {},
    });

    // Handle audience routing
    if (requestData.audienceGroups && requestData.audienceGroups.length > 0) {
      // Send to group chats and notify opted-in users
      await this.sendBelayerRequestToGroups(
        requestData.audienceGroups,
        post,
        userId
      );
    }

    if (requestData.audienceArea) {
      // Post is already in area feed, now notify opted-in users
      await this.notifyAreaUsers(post, userId);
    }

    return post;
  },

  async sendBelayerRequestToGroups(
    groupIds: string[],
    post: any,
    inviterUserId: string
  ): Promise<void> {
    // Get inviter name
    const { data: user } = await (supabase as any)
      .from('users')
      .select('name')
      .eq('id', inviterUserId)
      .single();

    const inviterName = user?.name || 'Someone';

    // Format message
    const urgencyText = post.urgency === 'now' ? 'right now' : 
      post.scheduledTime ? `on ${new Date(post.scheduledTime).toLocaleString()}` : 'soon';
    
    const climbingTypeText = post.climbingType === 'any' ? 'climbing' : post.climbingType;
    const requestTypeText = post.postType === 'belayer_request' ? 'belayer' : 'rally pads';

    let messageText = `${inviterName} is looking for a ${requestTypeText} for ${climbingTypeText} ${urgencyText}`;
    if (post.targetRoute) {
      messageText += ` on ${post.targetRoute}`;
    }
    if (post.targetGrade) {
      messageText += ` (${post.targetGrade})`;
    }
    messageText += `. ${post.content}`;

    // Send to each group chat
    for (const groupId of groupIds) {
      try {
        const chat = await chatApi.getGroupChat(groupId);
        await chatApi.sendMessage(
          chat.chatId,
          inviterUserId,
          messageText,
          'system',
          {
            action: 'belayer_request',
            postId: post.postId,
            postType: post.postType,
            climbingType: post.climbingType,
            scheduledTime: post.scheduledTime,
            gymName: post.gymName,
            cragName: post.cragName,
            targetRoute: post.targetRoute,
            targetGrade: post.targetGrade,
            senderUserId: inviterUserId, // Include sender user ID for author detection
          }
        );

        // Notify opted-in users in the group
        await this.notifyGroupUsers(groupId, post, inviterUserId);
      } catch (error) {
        console.error(`Error sending belayer request to group ${groupId}:`, error);
      }
    }
  },

  async notifyGroupUsers(groupId: string, post: any, inviterUserId: string): Promise<void> {
    // Get group members
    const members = await groupsApi.getGroupMembers(groupId);
    
    // Get notification preferences for each member
    for (const member of members) {
      if (member.userId === inviterUserId) continue; // Skip inviter

      try {
        const preferences = await notificationPreferencesApi.getNotificationPreferences(member.userId);
        
        if (preferences?.groupBelayerAlerts) {
          // Send push notification
          await notificationService.sendNotification(
            member.userId,
            {
              title: 'New Belayer Request',
              body: `${post.authorName || 'Someone'} is looking for a ${post.postType === 'belayer_request' ? 'belayer' : 'rally pads'}`,
              data: {
                type: 'belayer_request',
                postId: post.postId,
                groupId,
              },
            }
          );
        }
      } catch (error) {
        console.error(`Error notifying user ${member.userId}:`, error);
      }
    }
  },

  async notifyAreaUsers(post: any, inviterUserId: string): Promise<void> {
    // Get users who follow this gym or are currently at it
    let userIds: string[] = [];

    if (post.gymId) {
      // Get followers and current users
      const { data: followers } = await (supabase as any)
        .from('user_gym_follows')
        .select('user_id')
        .eq('gym_id', post.gymId);

      const { data: currentUsers } = await (supabase as any)
        .from('user_gym_presence')
        .select('user_id')
        .eq('gym_id', post.gymId)
        .eq('is_active', true);

      userIds = [
        ...(followers || []).map((f: any) => f.user_id),
        ...(currentUsers || []).map((u: any) => u.user_id),
      ];
    }

    // Remove duplicates and inviter
    userIds = Array.from(new Set(userIds)).filter(id => id !== inviterUserId);

    // Notify users with matching preferences
    for (const userId of userIds) {
      try {
        const preferences = await notificationPreferencesApi.getNotificationPreferences(userId);
        const profile = await climbingProfileApi.getClimbingProfile(userId);

        // Only notify if:
        // 1. User has belayer request notifications enabled
        // 2. User is open to new partners (if profile exists)
        if (
          preferences?.belayerRequests &&
          (!profile || profile.openToNewPartners)
        ) {
          await notificationService.sendNotification(
            userId,
            {
              title: 'New Belayer Request',
              body: `${post.authorName || 'Someone'} is looking for a ${post.postType === 'belayer_request' ? 'belayer' : 'rally pads'}`,
              data: {
                type: 'belayer_request',
                postId: post.postId,
                gymId: post.gymId,
                cragName: post.cragName,
              },
            }
          );
        }
      } catch (error) {
        console.error(`Error notifying user ${userId}:`, error);
      }
    }
  },
};

// Notification Preferences API
export const notificationPreferencesApi = {
  async getNotificationPreferences(userId: string): Promise<any> {
    const { data, error } = await (supabase as any)
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No preferences found, return defaults
        return {
          preferenceId: '',
          userId,
          // Workout notifications
          workoutInvitations: true,
          workoutResponses: true,
          workoutBails: true,
          workoutReminders: true,
          // Social notifications
          friendAtGym: true,
          friendAtCrag: true,
          groupMessages: true,
          // Belayer/climbing partner notifications
          belayerRequests: true,
          belayerResponses: true,
          matchingPartners: true,
          groupBelayerAlerts: true,
          // Feed notifications
          feedResponses: true,
          feedMentions: true,
          // Trip planning
          friendTripAnnouncements: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
      throw error;
    }

    return {
      preferenceId: data.preference_id,
      userId: data.user_id,
      // Workout notifications
      workoutInvitations: data.workout_invitations ?? true,
      workoutResponses: data.workout_responses ?? true,
      workoutBails: data.workout_bails ?? true,
      workoutReminders: data.workout_reminders ?? true,
      // Social notifications
      friendAtGym: data.friend_at_gym ?? true,
      friendAtCrag: data.friend_at_crag ?? true,
      groupMessages: data.group_messages ?? true,
      // Belayer/climbing partner notifications
      belayerRequests: data.belayer_requests ?? true,
      belayerResponses: data.belayer_responses ?? true,
      matchingPartners: data.matching_partners ?? true,
      groupBelayerAlerts: data.group_belayer_alerts ?? true,
      // Feed notifications
      feedResponses: data.feed_responses ?? true,
      feedMentions: data.feed_mentions ?? true,
      // Trip planning
      friendTripAnnouncements: data.friend_trip_announcements ?? true,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },

  async updateNotificationPreferences(
    userId: string,
    preferences: Partial<any>
  ): Promise<any> {
    const dbData: any = {
      user_id: userId,
      // Workout notifications
      workout_invitations: preferences.workoutInvitations,
      workout_responses: preferences.workoutResponses,
      workout_bails: preferences.workoutBails,
      workout_reminders: preferences.workoutReminders,
      // Social notifications
      friend_at_gym: preferences.friendAtGym,
      friend_at_crag: preferences.friendAtCrag,
      group_messages: preferences.groupMessages,
      // Belayer/climbing partner notifications
      belayer_requests: preferences.belayerRequests,
      belayer_responses: preferences.belayerResponses,
      matching_partners: preferences.matchingPartners,
      group_belayer_alerts: preferences.groupBelayerAlerts,
      // Feed notifications
      feed_responses: preferences.feedResponses,
      feed_mentions: preferences.feedMentions,
      // Trip planning
      friend_trip_announcements: preferences.friendTripAnnouncements,
    };

    const { data, error } = await (supabase as any)
      .from('notification_preferences')
      .upsert(dbData, {
        onConflict: 'user_id',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      preferenceId: data.preference_id,
      userId: data.user_id,
      // Workout notifications
      workoutInvitations: data.workout_invitations,
      workoutResponses: data.workout_responses,
      workoutBails: data.workout_bails,
      workoutReminders: data.workout_reminders,
      // Social notifications
      friendAtGym: data.friend_at_gym,
      friendAtCrag: data.friend_at_crag,
      groupMessages: data.group_messages,
      // Belayer/climbing partner notifications
      belayerRequests: data.belayer_requests,
      belayerResponses: data.belayer_responses,
      matchingPartners: data.matching_partners,
      groupBelayerAlerts: data.group_belayer_alerts,
      // Feed notifications
      feedResponses: data.feed_responses,
      feedMentions: data.feed_mentions,
      // Trip planning
      friendTripAnnouncements: data.friend_trip_announcements,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },
};

/** Runner for offline queue processing. Pass to offlineQueue.processQueue(runner). */
export const offlineQueueRunner: OfflineQueueRunner = {
  areaVisit: (userId, areaId) => userAreaVisitsApi.recordVisit(userId, areaId).then(() => {}),
  leaveArea: (userId, areaId) => userAreaVisitsApi.leaveArea(userId, areaId),
  areaFeedPost: (post) => areaFeedApi.createFeedPost(post),
  tripPlanCreate: (userId, areaId, startDate, endDate, notes) =>
    userAreaPlansApi.create(userId, areaId, startDate, endDate, notes).then(() => {}),
  tripPlanUpdate: (planId, updates) => userAreaPlansApi.update(planId, updates).then(() => {}),
  tripPlanDelete: (planId) => userAreaPlansApi.delete(planId),
  tripInvitationCreate: (tripId, inviterUserId, inviteeUserId, comment) =>
    tripInvitationsApi.create(tripId, inviterUserId, inviteeUserId, comment).then(() => {}),
  tripInvitationRespond: (invitationId, status) => tripInvitationsApi.respond(invitationId, status),
  gymCheckIn: (userId, gymId, location) => presenceApi.checkIn(userId, gymId, location).then(() => {}),
  gymCheckOut: (userId, gymId) => presenceApi.checkOut(userId, gymId),
};
