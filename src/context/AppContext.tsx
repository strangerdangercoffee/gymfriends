import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../services/supabase';
import { userApi, gymApi, scheduleApi, presenceApi, workoutHistoryApi } from '../services/api';
import { geofencingService } from '../services/geofencing';
import { 
  User, 
  Gym, 
  Schedule, 
  Presence,
  WorkoutHistory,
  CreateScheduleForm, 
  AppContextType 
} from '../types';
import { useAuth } from './AuthContext';
import { useLocation } from './LocationContext';

const AppContext = createContext<AppContextType | undefined>(undefined);

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const { user, updateProfile } = useAuth();
  const { startGeofencing, stopGeofencing, hasBackgroundPermission } = useLocation();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [friends, setFriends] = useState<User[]>([]);
  const [presence, setPresence] = useState<Presence[]>([]);
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      refreshData();
      setupRealtimeSubscriptions();
    }
  }, [user]);

  // Auto-start geofencing if user has auto check-in enabled
  useEffect(() => {
    if (user && user.privacySettings.autoCheckIn && hasBackgroundPermission && gyms.length > 0) {
      startAutoCheckIn();
    }
  }, [user?.privacySettings.autoCheckIn, hasBackgroundPermission, gyms]);

  const startAutoCheckIn = async () => {
    if (!user) return;
    
    try {
      const followedGyms = gyms.filter(gym => user.followedGyms.includes(gym.id));
      if (followedGyms.length > 0) {
        await startGeofencing(user.id, followedGyms);
        console.log('Auto check-in started');
      }
    } catch (error) {
      console.error('Error starting auto check-in:', error);
    }
  };

  const stopAutoCheckIn = async () => {
    try {
      await stopGeofencing();
      console.log('Auto check-in stopped');
    } catch (error) {
      console.error('Error stopping auto check-in:', error);
    }
  };

  const setupRealtimeSubscriptions = () => {
    if (!user) return;

    // Subscribe to schedule changes
    const scheduleSubscription = supabase
      .channel('schedules')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'schedules',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          refreshSchedules();
        }
      )
      .subscribe();

    // Subscribe to presence changes
    const presenceSubscription = supabase
      .channel('presence')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'presence',
        },
        () => {
          refreshPresence();
        }
      )
      .subscribe();

    // Subscribe to gym changes
    const gymSubscription = supabase
      .channel('gyms')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'gyms',
        },
        () => {
          refreshGyms();
        }
      )
      .subscribe();

    return () => {
      scheduleSubscription.unsubscribe();
      presenceSubscription.unsubscribe();
      gymSubscription.unsubscribe();
    };
  };

  const refreshData = async (): Promise<void> => {
    if (!user) return;

    setIsLoading(true);
    try {
      await Promise.all([
        refreshSchedules(),
        refreshGyms(),
        refreshFriends(),
        refreshPresence(),
        refreshWorkoutHistory(),
      ]);
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshSchedules = async (): Promise<void> => {
    if (!user) return;

    try {
      const userSchedules = await scheduleApi.getUserSchedules(user.id);
      setSchedules(userSchedules);
    } catch (error) {
      console.error('Error refreshing schedules:', error);
    }
  };

  const refreshGyms = async (): Promise<void> => {
    try {
      const allGyms = await gymApi.getAllGyms();
      setGyms(allGyms);
    } catch (error) {
      console.error('Error refreshing gyms:', error);
    }
  };

  const refreshFriends = async (): Promise<void> => {
    if (!user) return;

    try {
      const userFriends = await userApi.getUserFriends(user.id);
      setFriends(userFriends);
    } catch (error) {
      console.error('Error refreshing friends:', error);
    }
  };

  const refreshPresence = async (): Promise<void> => {
    try {
      const allPresence = await presenceApi.getAllActivePresence();
      setPresence(allPresence);
    } catch (error) {
      console.error('Error refreshing presence:', error);
    }
  };

  const refreshWorkoutHistory = async (): Promise<void> => {
    if (!user) return;

    try {
      // Get last 30 days of workout history
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      
      const history = await workoutHistoryApi.getWorkoutHistory(user.id, startDate, endDate);
      setWorkoutHistory(history);
    } catch (error) {
      console.error('Error refreshing workout history:', error);
    }
  };

  const addSchedule = async (scheduleData: CreateScheduleForm): Promise<void> => {
    if (!user) throw new Error('No user logged in');

    try {
      const newSchedule = await scheduleApi.createSchedule(scheduleData, user.id);
      setSchedules(prev => [...prev, newSchedule]);
    } catch (error) {
      console.error('Error adding schedule:', error);
      throw error;
    }
  };

  const updateSchedule = async (id: string, updates: Partial<Schedule>): Promise<void> => {
    try {
      const updatedSchedule = await scheduleApi.updateSchedule(id, updates);
      setSchedules(prev => 
        prev.map(schedule => 
          schedule.id === id ? updatedSchedule : schedule
        )
      );
    } catch (error) {
      console.error('Error updating schedule:', error);
      throw error;
    }
  };

  const deleteSchedule = async (id: string): Promise<void> => {
    try {
      await scheduleApi.deleteSchedule(id);
      setSchedules(prev => prev.filter(schedule => schedule.id !== id));
    } catch (error) {
      console.error('Error deleting schedule:', error);
      throw error;
    }
  };

  const deleteRecurringSchedule = async (userId: string, workoutType: string, recurringPattern: any, startTime: string): Promise<void> => {
    try {
      await scheduleApi.deleteRecurringSchedule(userId, workoutType, recurringPattern, startTime);
      // Refresh schedules to get updated list
      await refreshSchedules();
    } catch (error) {
      console.error('Error deleting recurring schedule:', error);
      throw error;
    }
  };

  const addFriend = async (email: string): Promise<void> => {
    if (!user) throw new Error('No user logged in');

    try {
      await userApi.addFriend(user.id, email);
      await refreshFriends();
    } catch (error) {
      console.error('Error adding friend:', error);
      throw error;
    }
  };

  const addFriendInstant = async (friendId: string): Promise<void> => {
    if (!user) throw new Error('No user logged in');

    try {
      await userApi.addFriendInstant(user.id, friendId);
      await refreshFriends();
      // Also update the current user's friends list in auth context
      await updateProfile({ friends: [...(user.friends || []), friendId] });
    } catch (error) {
      console.error('Error adding friend instantly:', error);
      throw error;
    }
  };

  const removeFriend = async (userId: string): Promise<void> => {
    if (!user) throw new Error('No user logged in');

    try {
      await userApi.removeFriend(user.id, userId);
      setFriends(prev => prev.filter(friend => friend.id !== userId));
    } catch (error) {
      console.error('Error removing friend:', error);
      throw error;
    }
  };

  const followGym = async (gymId: string): Promise<void> => {
    if (!user) throw new Error('No user logged in');

    try {
      await gymApi.followGym(user.id, gymId);
      
      // Update user's followed gyms list
      const updatedFollowedGyms = [...(user.followedGyms || []), gymId];
      await updateProfile({ followedGyms: updatedFollowedGyms });
      
      // Update local gym state
      setGyms(prev => 
        prev.map(gym => 
          gym.id === gymId 
            ? { ...gym, followers: [...(gym.followers || []), user.id] }
            : gym
        )
      );

      // Update geofencing with new gym list if auto check-in is enabled
      if (user.privacySettings.autoCheckIn && hasBackgroundPermission) {
        const followedGyms = gyms.filter(g => 
          updatedFollowedGyms.includes(g.id)
        );
        geofencingService.updateFollowedGyms(followedGyms);
      }
    } catch (error) {
      console.error('Error following gym:', error);
      throw error;
    }
  };

  const unfollowGym = async (gymId: string): Promise<void> => {
    if (!user) throw new Error('No user logged in');

    try {
      await gymApi.unfollowGym(user.id, gymId);
      
      // Update user's followed gyms list
      const updatedFollowedGyms = (user.followedGyms || []).filter(id => id !== gymId);
      await updateProfile({ followedGyms: updatedFollowedGyms });
      
      // Update local gym state
      setGyms(prev => 
        prev.map(gym => 
          gym.id === gymId 
            ? { ...gym, followers: (gym.followers || []).filter(id => id !== user.id) }
            : gym
        )
      );

      // Update geofencing with new gym list if auto check-in is enabled
      if (user.privacySettings.autoCheckIn && hasBackgroundPermission) {
        const followedGyms = gyms.filter(g => 
          updatedFollowedGyms.includes(g.id)
        );
        geofencingService.updateFollowedGyms(followedGyms);
      }
    } catch (error) {
      console.error('Error unfollowing gym:', error);
      throw error;
    }
  };

  const checkIn = async (gymId: string): Promise<void> => {
    if (!user) throw new Error('No user logged in');

    try {
      await presenceApi.checkIn(user.id, gymId);
      await refreshPresence(); // Refresh all presence data
      await refreshGyms(); // Update gym's current users
      
      // Update geofencing state to prevent duplicate auto check-in
      geofencingService.setManualCheckInState(gymId, true);
    } catch (error) {
      console.error('Error checking in:', error);
      throw error;
    }
  };

  const checkOut = async (gymId: string): Promise<void> => {
    if (!user) throw new Error('No user logged in');

    try {
      await presenceApi.checkOut(user.id, gymId);
      await refreshPresence(); // Refresh all presence data
      await refreshGyms(); // Update gym's current users
      await refreshWorkoutHistory(); // Refresh workout history (database trigger creates entry automatically)
      
      // Update geofencing state
      geofencingService.setManualCheckInState(null, false);
    } catch (error) {
      console.error('Error checking out:', error);
      throw error;
    }
  };

  const getWorkoutHistory = async (userId: string, startDate?: Date, endDate?: Date): Promise<WorkoutHistory[]> => {
    try {
      return await workoutHistoryApi.getWorkoutHistory(userId, startDate, endDate);
    } catch (error) {
      console.error('Error getting workout history:', error);
      throw error;
    }
  };

  const updateWorkoutHistory = async (id: string, updates: Partial<WorkoutHistory>): Promise<void> => {
    try {
      await workoutHistoryApi.updateWorkoutHistory(id, updates);
      await refreshWorkoutHistory();
    } catch (error) {
      console.error('Error updating workout history:', error);
      throw error;
    }
  };

  const deleteWorkoutHistory = async (id: string): Promise<void> => {
    try {
      await workoutHistoryApi.deleteWorkoutHistory(id);
      setWorkoutHistory(prev => prev.filter(wh => wh.id !== id));
    } catch (error) {
      console.error('Error deleting workout history:', error);
      throw error;
    }
  };

  const value: AppContextType = {
    schedules,
    gyms,
    friends,
    presence,
    workoutHistory,
    isLoading,
    refreshData,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    deleteRecurringSchedule,
    addFriend,
    addFriendInstant,
    removeFriend,
    followGym,
    unfollowGym,
    checkIn,
    checkOut,
    getWorkoutHistory,
    updateWorkoutHistory,
    deleteWorkoutHistory,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
