import React, { createContext, useContext, useEffect, useState, ReactNode, useMemo } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from '../services/supabase';
import { userApi, gymApi, scheduleApi, presenceApi, workoutHistoryApi, workoutInvitationApi, chatApi, groupsApi, climbingAreasApi, userAreaFollowsApi, offlineQueueRunner } from '../services/api';
import { offlineQueue } from '../services/offlineQueue';
import { workoutHistoryGenerator } from '../services/workoutHistoryGenerator';
import { geofencingService } from '../services/geofencing';
import { 
  User, 
  Gym, 
  Schedule, 
  Presence,
  WorkoutHistory,
  CreateScheduleForm, 
  AppContextType,
  WorkoutInvitationWithResponses,
  CreateWorkoutInvitationData,
  ClimbingArea
} from '../types';
import { useAuth } from './AuthContext';
import { useLocation } from './LocationContext';
import { useOnboarding } from './OnboardingContext';

const AppContext = createContext<AppContextType | undefined>(undefined);

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const { user, updateProfile, refreshUser } = useAuth();
  const { hasCompletedOnboarding } = useOnboarding();
  const { startGeofencing, stopGeofencing, hasBackgroundPermission } = useLocation();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [friends, setFriends] = useState<User[]>([]);
  const [presence, setPresence] = useState<Presence[]>([]);
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutHistory[]>([]);
  const [workoutInvitations, setWorkoutInvitations] = useState<WorkoutInvitationWithResponses[]>([]);
  const [pendingInvitationsCount, setPendingInvitationsCount] = useState(0);
  const [climbingAreas, setClimbingAreas] = useState<ClimbingArea[]>([]);
  const [followedAreas, setFollowedAreas] = useState<ClimbingArea[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [geofencingActive, setGeofencingActive] = useState(false);
  
  // OPTIMIZATION: Cache gym data and last refresh time (gyms rarely change)
  const [gymsLastRefreshed, setGymsLastRefreshed] = useState<number>(0);
  const GYMS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  
  // OPTIMIZATION: Cache workout history generation time to prevent excessive calls
  const [historyLastGenerated, setHistoryLastGenerated] = useState<number>(0);
  const HISTORY_GENERATION_TTL = 60 * 60 * 1000; // 1 hour - history doesn't need to be regenerated frequently
  
  // OPTIMIZATION: Debounce refreshData calls to prevent excessive API usage
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(0);
  const REFRESH_DEBOUNCE_MS = 5 * 1000; // 5 seconds - minimum time between refreshes

  useEffect(() => {
    if (user) {
      refreshData();
      refreshClimbingAreas();
      setupRealtimeSubscriptions();
      // Load full user (friends, followedGyms) in background after minimal initial load
      refreshUser();
    } else {
      setGeofencingActive(false);
    }
  }, [user?.id, hasCompletedOnboarding]);

  // Auto-start geofencing if user has auto check-in enabled (gyms and/or areas)
  useEffect(() => {
    if (user && user.privacySettings.autoCheckIn && hasBackgroundPermission && (gyms.length > 0 || followedAreas.length > 0 || climbingAreas.length > 0)) {
      startAutoCheckIn();
    }
  }, [user?.privacySettings.autoCheckIn, hasBackgroundPermission, gyms, followedAreas.length, climbingAreas.length]);

  // Flush offline write queue when app comes to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        offlineQueue.processQueue(offlineQueueRunner).then(({ processed }) => {
          if (processed > 0) console.log('Offline queue flushed:', processed, 'items');
        });
      }
    });
    return () => sub.remove();
  }, []);

  const startAutoCheckIn = async () => {
    if (!user) return;
    try {
      const followedGyms = gyms.filter(gym => user.followedGyms.includes(gym.id));
      const areas = followedAreas.length > 0 ? followedAreas : [];
      if (followedGyms.length > 0 || areas.length > 0 || climbingAreas.length > 0) {
        await startGeofencing(user.id, followedGyms, {
          userName: user.name,
          followedAreas: areas,
          allClimbingAreas: climbingAreas,
        });
        setGeofencingActive(true);
        console.log('Auto check-in started');
      }
    } catch (error) {
      console.error('Error starting auto check-in:', error);
    }
  };

  const stopAutoCheckIn = async () => {
    try {
      await stopGeofencing();
      setGeofencingActive(false);
      console.log('Auto check-in stopped');
    } catch (error) {
      console.error('Error stopping auto check-in:', error);
    }
  };

  // Foreground area-visit check so iOS records visits when app is open (background task can be throttled)
  const FOREGROUND_AREA_CHECK_INTERVAL_MS = 90 * 1000;
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const runCheck = () => {
      geofencingService.checkLocationForAreaVisit();
    };
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active' && geofencingActive) {
        runCheck();
        intervalId = setInterval(runCheck, FOREGROUND_AREA_CHECK_INTERVAL_MS);
      } else {
        if (intervalId != null) {
          clearInterval(intervalId);
          intervalId = null;
        }
      }
    });
    if (AppState.currentState === 'active' && geofencingActive) {
      runCheck();
      intervalId = setInterval(runCheck, FOREGROUND_AREA_CHECK_INTERVAL_MS);
    }
    return () => {
      sub.remove();
      if (intervalId != null) clearInterval(intervalId);
    };
  }, [geofencingActive]);

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

    // Subscribe to workout invitation changes
    const workoutInvitationSubscription = supabase
      .channel('workout_invitations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workout_invitations',
        },
        () => {
          refreshWorkoutInvitations();
        }
      )
      .subscribe();

    // Subscribe to workout invitation response changes
    const workoutInvitationResponseSubscription = supabase
      .channel('workout_invitation_responses')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workout_invitation_responses',
        },
        () => {
          refreshWorkoutInvitations();
        }
      )
      .subscribe();

    return () => {
      scheduleSubscription.unsubscribe();
      presenceSubscription.unsubscribe();
      gymSubscription.unsubscribe();
      workoutInvitationSubscription.unsubscribe();
      workoutInvitationResponseSubscription.unsubscribe();
    };
  };

  const refreshData = async (forceRefresh: boolean = false): Promise<void> => {
    if (!user) return;

    // OPTIMIZATION: Debounce refresh calls to prevent excessive API usage
    const now = Date.now();
    const timeSinceLastRefresh = now - lastRefreshTime;
    
    if (!forceRefresh && timeSinceLastRefresh < REFRESH_DEBOUNCE_MS) {
      return; // Skip if called too recently (debounce)
    }

    setLastRefreshTime(now);
    setIsLoading(true);
    try {
      const promises: Promise<void>[] = [
        refreshSchedules(),
        refreshGyms(),
        refreshFriends(),
        refreshPresence(),
        refreshWorkoutInvitations(),
      ];
      if (hasCompletedOnboarding) {
        promises.push(refreshWorkoutHistory());
      }
      await Promise.all(promises);
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

  const refreshGyms = async (forceRefresh: boolean = false): Promise<void> => {
    try {
      // OPTIMIZATION: Only refresh gyms if cache is stale or forced
      const now = Date.now();
      const cacheValid = (now - gymsLastRefreshed) < GYMS_CACHE_TTL;
      
      if (!forceRefresh && cacheValid && gyms.length > 0) {
        console.log('Using cached gym data');
        return; // Use cached data
      }
      
      const allGyms = await gymApi.getAllGyms();
      setGyms(allGyms);
      setGymsLastRefreshed(now);
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
    if (!user) return;
    
    try {
      // OPTIMIZATION: Only fetch presence for followed gyms and friends, not all users
      const followedGymIds = user.followedGyms || [];
      const friendIds = user.friends || [];
      
      // If no followed gyms or friends, don't fetch presence
      if (followedGymIds.length === 0 && friendIds.length === 0) {
        setPresence([]);
        return;
      }
      
      // OPTIMIZATION: Fetch presence only for relevant gyms and friends
      // Pass filters directly to API to reduce data transfer
      const relevantPresence = await presenceApi.getAllActivePresence(followedGymIds, friendIds);
      setPresence(relevantPresence);
    } catch (error) {
      console.error('Error refreshing presence:', error);
    }
  };

  const refreshWorkoutHistory = async (forceGenerate: boolean = false): Promise<void> => {
    if (!user) return;

    try {
      // OPTIMIZATION: Only generate history if cache is stale or forced
      // History generation is expensive and doesn't need to happen on every refresh
      const now = Date.now();
      const shouldGenerate = forceGenerate || (now - historyLastGenerated) >= HISTORY_GENERATION_TTL;
      
      if (shouldGenerate) {
        // Ensure workout history is generated for the next 90 days
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + 90);
        await workoutHistoryGenerator.ensureHistoryGenerated(targetDate, user.id);
        setHistoryLastGenerated(now);
      }

      // Always fetch workout history (this is fast, just a query)
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 90); // Next 90 days
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30); // Last 30 days

      const history = await workoutHistoryApi.getWorkoutHistory(user.id, startDate, endDate);
      setWorkoutHistory(history);
    } catch (error) {
      console.error('Error refreshing workout history:', error);
    }
  };

  const addSchedule = async (scheduleData: CreateScheduleForm): Promise<Schedule> => {
    if (!user) throw new Error('No user logged in');

    try {
      const newSchedule = await scheduleApi.createSchedule(scheduleData, user.id);
      setSchedules(prev => [...prev, newSchedule]);
      // Refresh workout history to show the new scheduled workout in the calendar
      // Force generation if it's a recurring schedule
      await refreshWorkoutHistory(scheduleData.isRecurring);
      return newSchedule;
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
      // Refresh all data to get updated friends list
      await refreshData();
    } catch (error) {
      console.error('Error adding friend instantly:', error);
      throw error;
    }
  };

  const removeFriend = async (userId: string): Promise<void> => {
    if (!user) throw new Error('No user logged in');

    try {
      await userApi.removeFriend(user.id, userId);
      // Refresh all data to get updated friends list
      await refreshData();
    } catch (error) {
      console.error('Error removing friend:', error);
      throw error;
    }
  };

  const followGym = async (gymId: string): Promise<void> => {
    if (!user) throw new Error('No user logged in');

    try {
      await gymApi.followGym(user.id, gymId);

      // Refresh user so followedGyms updates (user comes from AuthContext)
      await refreshUser();

      await refreshData();

      // Update geofencing optimistically (state may not have updated yet)
      if (user.privacySettings.autoCheckIn && hasBackgroundPermission) {
        const followedGyms = gyms.filter(g =>
          user.followedGyms?.includes(g.id) || g.id === gymId
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

      // Refresh user so followedGyms updates (user comes from AuthContext)
      await refreshUser();

      await refreshData();

      // Update geofencing optimistically (state may not have updated yet)
      if (user.privacySettings.autoCheckIn && hasBackgroundPermission) {
        const followedGyms = gyms.filter(g =>
          g.id !== gymId && user.followedGyms?.includes(g.id)
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

  const refreshWorkoutInvitations = async (): Promise<void> => {
    if (!user) return;

    try {
      const invitations = await workoutInvitationApi.getWorkoutInvitationsForUser(user.id);
      setWorkoutInvitations(invitations);
      
      const pendingCount = await workoutInvitationApi.getPendingInvitationsCount(user.id);
      setPendingInvitationsCount(pendingCount);
    } catch (error) {
      console.error('Error refreshing workout invitations:', error);
    }
  };

  const createWorkoutInvitation = async (
    scheduleId: string,
    invitationData: CreateWorkoutInvitationData
  ): Promise<void> => {
    if (!user) throw new Error('No user logged in');

    try {
      await workoutInvitationApi.createWorkoutInvitation(user.id, invitationData);
      await refreshWorkoutInvitations();
    } catch (error) {
      console.error('Error creating workout invitation:', error);
      throw error;
    }
  };

  const respondToWorkoutInvitation = async (
    invitationId: string,
    response: 'accepted' | 'declined'
  ): Promise<void> => {
    if (!user) throw new Error('No user logged in');

    try {
      await workoutInvitationApi.respondToInvitation(invitationId, user.id, response);
      
      // Send message to group chats - only to groups that were originally notified about this invitation
      try {
        const invitation = await workoutInvitationApi.getInvitationById(invitationId);
        if (invitation && invitation.associatedGroupIds && invitation.associatedGroupIds.length > 0) {
          // Invitation was sent to groups - notify only those groups
          console.log(`[respondToWorkoutInvitation] Notifying ${invitation.associatedGroupIds.length} groups about ${response}`);
          await chatApi.sendWorkoutResponseToGroups(
            invitation.associatedGroupIds,
            user.name,
            response,
            invitation.title
          );
        } else {
          // Invitation was only sent to individual users (not groups)
          // No group chat notification needed
          console.log('[respondToWorkoutInvitation] No groups found - invitation was to individual users only');
        }
      } catch (error) {
        console.error('Error sending response messages to groups:', error);
        // Don't fail the operation if messaging fails
      }
      
      await refreshWorkoutInvitations();
    } catch (error) {
      console.error('Error responding to workout invitation:', error);
      throw error;
    }
  };

  const bailFromWorkout = async (
    invitationId: string,
    reason?: string
  ): Promise<void> => {
    if (!user) throw new Error('No user logged in');

    try {
      await workoutInvitationApi.bailFromWorkout(invitationId, user.id, reason);
      
      // Send message to group chats - only to groups that were originally notified about this invitation
      try {
        const invitation = await workoutInvitationApi.getInvitationById(invitationId);
        if (invitation && invitation.associatedGroupIds && invitation.associatedGroupIds.length > 0) {
          // Invitation was sent to groups - notify only those groups
          console.log(`[bailFromWorkout] Notifying ${invitation.associatedGroupIds.length} groups about bail`);
          await chatApi.sendWorkoutResponseToGroups(
            invitation.associatedGroupIds,
            user.name,
            'bailed',
            invitation.title,
            reason
          );
        } else {
          // Invitation was only sent to individual users (not groups)
          // Only notify the inviter via push notification (already handled by sendBailNotification)
          console.log('[bailFromWorkout] No groups found - invitation was to individual users only');
        }
      } catch (error) {
        console.error('Error sending bail messages to groups:', error);
        // Don't fail the operation if messaging fails
      }
      
      // Refresh both invitations and workout history to update the calendar
      await Promise.all([
        refreshWorkoutInvitations(),
        refreshWorkoutHistory()
      ]);
    } catch (error) {
      console.error('Error bailing from workout:', error);
      throw error;
    }
  };

  const cancelWorkoutInvitation = async (invitationId: string): Promise<void> => {
    if (!user) throw new Error('No user logged in');

    try {
      await workoutInvitationApi.cancelInvitation(invitationId, user.id);
      await refreshWorkoutInvitations();
    } catch (error) {
      console.error('Error cancelling workout invitation:', error);
      throw error;
    }
  };

  const getWorkoutInvitationById = async (invitationId: string): Promise<WorkoutInvitationWithResponses | null> => {
    try {
      return await workoutInvitationApi.getInvitationById(invitationId);
    } catch (error) {
      console.error('Error getting workout invitation:', error);
      throw error;
    }
  };

  // Get followed gyms
  const followedGyms = useMemo(() => {
    if (!user) return [];
    return gyms.filter(gym => user.followedGyms.includes(gym.id));
  }, [gyms, user]);

  const refreshClimbingAreas = async (): Promise<ClimbingArea[]> => {
    try {
      const [areas, followed] = await Promise.all([
        climbingAreasApi.getAll(),
        user ? userAreaFollowsApi.getFollowedAreas(user.id) : Promise.resolve([]),
      ]);
      setClimbingAreas(areas);
      setFollowedAreas(followed);
      geofencingService.updateAllClimbingAreas(areas);
      return followed;
    } catch (error) {
      console.error('Error refreshing climbing areas:', error);
      return [];
    }
  };

  const followArea = async (areaId: string): Promise<void> => {
    if (!user) throw new Error('No user logged in');
    try {
      await userAreaFollowsApi.follow(user.id, areaId);
      const updated = await refreshClimbingAreas();
      geofencingService.updateFollowedAreas(updated);
    } catch (error) {
      console.error('Error following area:', error);
      throw error;
    }
  };

  const unfollowArea = async (areaId: string): Promise<void> => {
    if (!user) throw new Error('No user logged in');
    try {
      await userAreaFollowsApi.unfollow(user.id, areaId);
      const updated = await refreshClimbingAreas();
      geofencingService.updateFollowedAreas(updated);
    } catch (error) {
      console.error('Error unfollowing area:', error);
      throw error;
    }
  };

  const value: AppContextType = {
    schedules,
    gyms,
    friends,
    presence,
    workoutHistory,
    workoutInvitations,
    pendingInvitationsCount,
    followedGyms,
    isLoading,
    refreshData,
    refreshSchedules,
    refreshWorkoutHistory,
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
    refreshWorkoutInvitations,
    createWorkoutInvitation,
    respondToWorkoutInvitation,
    bailFromWorkout,
    cancelWorkoutInvitation,
    getWorkoutInvitationById,
    climbingAreas,
    followedAreas,
    followArea,
    unfollowArea,
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
