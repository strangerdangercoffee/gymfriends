import { supabase } from './supabase';
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
  PaginatedResponse 
} from '../types';

// Helper functions to transform data between database and TypeScript formats
const transformUserFromDB = (dbUser: any): User => ({
  id: dbUser.id,
  name: dbUser.name,
  email: dbUser.email,
  avatar: dbUser.avatar,
  friends: dbUser.friends || [],
  followedGyms: dbUser.followed_gyms || [],
  privacySettings: {
    shareLocation: dbUser.privacy_settings?.share_location ?? true,
    shareSchedule: dbUser.privacy_settings?.share_schedule ?? true,
    autoCheckIn: dbUser.privacy_settings?.auto_check_in ?? false,
  },
  createdAt: dbUser.created_at,
  updatedAt: dbUser.updated_at,
});

const transformUserToDB = (user: Partial<User>): any => ({
  id: user.id,
  name: user.name,
  email: user.email,
  avatar: user.avatar,
  friends: user.friends,
  followed_gyms: user.followedGyms,
  privacy_settings: user.privacySettings ? {
    share_location: user.privacySettings.shareLocation,
    share_schedule: user.privacySettings.shareSchedule,
    auto_check_in: user.privacySettings.autoCheckIn,
  } : undefined,
});

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
  status: schedule.status,
});

// User API functions
export const userApi = {
  async getCurrentUser(): Promise<User | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) throw error;
    return transformUserFromDB(data);
  },

  async createUser(userData: Partial<User>): Promise<User> {
    const dbData = transformUserToDB(userData);
    const { data, error } = await supabase
      .from('users')
      .insert([dbData])
      .select()
      .single();

    if (error) throw error;
    return transformUserFromDB(data);
  },

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const dbData = transformUserToDB(updates);
    const { data, error } = await supabase
      .from('users')
      .update({ ...dbData, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return transformUserFromDB(data);
  },

  async getUserFriends(userId: string): Promise<User[]> {
    const { data: user } = await supabase
      .from('users')
      .select('friends')
      .eq('id', userId)
      .single();

    if (!user?.friends?.length) return [];

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .in('id', user.friends);

    if (error) throw error;
    return (data || []).map(transformUserFromDB);
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

    // Add friend to user's friends list
    const { data: user } = await supabase
      .from('users')
      .select('friends')
      .eq('id', userId)
      .single();

    const updatedFriends = [...(user?.friends || []), friend.id];

    const { error } = await supabase
      .from('users')
      .update({ 
        friends: updatedFriends,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) throw error;
  },

  async addFriendInstant(userId: string, friendId: string): Promise<void> {
    // Add friend instantly without invitation (for QR code scanning)
    // Both users are added to each other's friends list
    
    console.log('Adding friend instantly:', { userId, friendId });
    
    // Get both users separately for better error handling
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, friends')
      .in('id', [userId, friendId]);

    if (usersError) {
      console.error('Error fetching users:', usersError);
      throw new Error(`Database error: ${usersError.message}`);
    }

    if (!users || users.length === 0) {
      console.error('No users found');
      throw new Error('Users not found in database');
    }

    console.log('Found users:', users.length, users.map(u => u.id));

    const currentUser = users.find(u => u.id === userId);
    const friendUser = users.find(u => u.id === friendId);

    if (!currentUser) {
      console.error('Current user not found:', userId);
      throw new Error('Your user account was not found. Please log out and log back in.');
    }

    if (!friendUser) {
      console.error('Friend user not found:', friendId);
      throw new Error('Friend user not found. They may have deleted their account.');
    }

    // Check if they're already friends
    if (currentUser.friends?.includes(friendId)) {
      throw new Error('Already friends');
    }

    // Add to current user's friends list
    const updatedUserFriends = [...(currentUser.friends || []), friendId];
    console.log('Updating current user friends list');
    const { error: userError } = await supabase
      .from('users')
      .update({ 
        friends: updatedUserFriends,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (userError) {
      console.error('Error updating current user:', userError);
      throw new Error(`Failed to update your friends list: ${userError.message}`);
    }

    // Add to friend's friends list (mutual friendship)
    const updatedFriendFriends = [...(friendUser.friends || []), userId];
    console.log('Updating friend user friends list');
    const { error: friendError } = await supabase
      .from('users')
      .update({ 
        friends: updatedFriendFriends,
        updated_at: new Date().toISOString()
      })
      .eq('id', friendId);

    if (friendError) {
      console.error('Error updating friend:', friendError);
      throw new Error(`Failed to update friend's list: ${friendError.message}`);
    }

    console.log('Successfully added friends!');
  },

  async removeFriend(userId: string, friendId: string): Promise<void> {
    const { data: user } = await supabase
      .from('users')
      .select('friends')
      .eq('id', userId)
      .single();

    const updatedFriends = (user?.friends || []).filter(id => id !== friendId);

    const { error } = await supabase
      .from('users')
      .update({ 
        friends: updatedFriends,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) throw error;
  }
};

// Gym API functions
export const gymApi = {
  async getAllGyms(): Promise<Gym[]> {
    const { data, error } = await supabase
      .from('gyms')
      .select('*')
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
    const { data, error } = await supabase
      .from('gyms')
      .insert([gymData])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async followGym(userId: string, gymId: string): Promise<void> {
    // Get current user's followed gyms
    const { data: user } = await supabase
      .from('users')
      .select('followed_gyms')
      .eq('id', userId)
      .single();

    // Get current gym's followers
    const { data: gym } = await supabase
      .from('gyms')
      .select('followers')
      .eq('id', gymId)
      .single();

    const updatedUserGyms = [...(user?.followed_gyms || []), gymId];
    const updatedGymFollowers = [...(gym?.followers || []), userId];

    // Update both user and gym in parallel
    const [userError, gymError] = await Promise.all([
      supabase
        .from('users')
        .update({ 
          followed_gyms: updatedUserGyms,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId),
      supabase
        .from('gyms')
        .update({ 
          followers: updatedGymFollowers,
          updated_at: new Date().toISOString()
        })
        .eq('id', gymId)
    ]);

    if (userError.error) throw userError.error;
    if (gymError.error) throw gymError.error;
  },

  async unfollowGym(userId: string, gymId: string): Promise<void> {
    // Get current user's followed gyms
    const { data: user } = await supabase
      .from('users')
      .select('followed_gyms')
      .eq('id', userId)
      .single();

    // Get current gym's followers
    const { data: gym } = await supabase
      .from('gyms')
      .select('followers')
      .eq('id', gymId)
      .single();

    const updatedUserGyms = (user?.followed_gyms || []).filter(id => id !== gymId);
    const updatedGymFollowers = (gym?.followers || []).filter(id => id !== userId);

    // Update both user and gym in parallel
    const [userError, gymError] = await Promise.all([
      supabase
        .from('users')
        .update({ 
          followed_gyms: updatedUserGyms,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId),
      supabase
        .from('gyms')
        .update({ 
          followers: updatedGymFollowers,
          updated_at: new Date().toISOString()
        })
        .eq('id', gymId)
    ]);

    if (userError.error) throw userError.error;
    if (gymError.error) throw gymError.error;
  },

  async getFollowedGyms(userId: string): Promise<Gym[]> {
    const { data: user } = await supabase
      .from('users')
      .select('followed_gyms')
      .eq('id', userId)
      .single();

    if (!user?.followed_gyms?.length) return [];

    const { data, error } = await supabase
      .from('gyms')
      .select('*')
      .in('id', user.followed_gyms);

    if (error) throw error;
    return data || [];
  }
};

// Schedule API functions
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
      status: 'planned' as const,
    };

    const { data, error } = await supabase
      .from('schedules')
      .insert([dbData])
      .select()
      .single();

    if (error) throw error;
    return transformScheduleFromDB(data);
  },

  async updateSchedule(id: string, updates: Partial<Schedule>): Promise<Schedule> {
    const dbData = transformScheduleToDB(updates);
    const { data, error } = await supabase
      .from('schedules')
      .update({ 
        ...dbData, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return transformScheduleFromDB(data);
  },

  async deleteSchedule(id: string): Promise<void> {
    const { error } = await supabase
      .from('schedules')
      .delete()
      .eq('id', id);

    if (error) throw error;
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

// Presence API functions
export const presenceApi = {
  async getCurrentPresence(userId: string): Promise<Presence[]> {
    const { data, error } = await supabase
      .from('presence')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) throw error;
    return (data || []).map(transformPresenceFromDB);
  },

  async checkIn(userId: string, gymId: string, location?: { latitude: number; longitude: number }): Promise<Presence> {
    // First, check out of any other gyms
    await supabase
      .from('presence')
      .update({ 
        is_active: false,
        checked_out_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('is_active', true);

    // Check in to new gym
    const { data, error } = await supabase
      .from('presence')
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

    // Update gym's current users
    const { data: gym } = await supabase
      .from('gyms')
      .select('current_users')
      .eq('id', gymId)
      .single();

    const updatedUsers = [...(gym?.current_users || []), userId];

    await supabase
      .from('gyms')
      .update({ 
        current_users: updatedUsers,
        updated_at: new Date().toISOString()
      })
      .eq('id', gymId);

    return transformPresenceFromDB(data);
  },

  async checkOut(userId: string, gymId: string): Promise<void> {
    const { error } = await supabase
      .from('presence')
      .update({ 
        is_active: false,
        checked_out_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('gym_id', gymId)
      .eq('is_active', true);

    if (error) throw error;

    // Update gym's current users
    const { data: gym } = await supabase
      .from('gyms')
      .select('current_users')
      .eq('id', gymId)
      .single();

    const updatedUsers = (gym?.current_users || []).filter(id => id !== userId);

    await supabase
      .from('gyms')
      .update({ 
        current_users: updatedUsers,
        updated_at: new Date().toISOString()
      })
      .eq('id', gymId);
  },

  async getGymPresence(gymId: string): Promise<Presence[]> {
    const { data, error } = await supabase
      .from('presence')
      .select('*')
      .eq('gym_id', gymId)
      .eq('is_active', true);

    if (error) throw error;
    return (data || []).map(transformPresenceFromDB);
  },

  async getAllActivePresence(): Promise<Presence[]> {
    const { data, error} = await supabase
      .from('presence')
      .select('*')
      .eq('is_active', true);

    if (error) throw error;
    return (data || []).map(transformPresenceFromDB);
  }
};

// Workout History API functions
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
    };

    const { data, error } = await supabase
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
    if (updates.endTime !== undefined) dbUpdates.endTime = updates.endTime;
    if (updates.duration !== undefined) dbUpdates.duration = updates.duration;

    const { data, error } = await supabase
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
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

