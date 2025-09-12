import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../services/supabase';
import { userApi, gymApi, scheduleApi, presenceApi } from '../services/api';
import { 
  User, 
  Gym, 
  Schedule, 
  Presence, 
  CreateScheduleForm, 
  AppContextType 
} from '../types';
import { useAuth } from './AuthContext';

const AppContext = createContext<AppContextType | undefined>(undefined);

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const { user, updateProfile } = useAuth();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [friends, setFriends] = useState<User[]>([]);
  const [presence, setPresence] = useState<Presence[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      refreshData();
      setupRealtimeSubscriptions();
    }
  }, [user]);

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
    } catch (error) {
      console.error('Error checking out:', error);
      throw error;
    }
  };

  const value: AppContextType = {
    schedules,
    gyms,
    friends,
    presence,
    isLoading,
    refreshData,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    addFriend,
    removeFriend,
    followGym,
    unfollowGym,
    checkIn,
    checkOut,
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
