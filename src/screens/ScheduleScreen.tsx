import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { groupsApi, chatApi, userAreaPlansApi } from '../services/api';
import { Schedule, ScheduleStackParamList, WorkoutSession, WorkoutHistory, CalendarView, CreateScheduleForm, WorkoutInvitationWithResponses, CreateWorkoutInvitationData, UserAreaPlan } from '../types';
import CalendarHeader from '../components/CalendarHeader';
import CalendarGrid from '../components/CalendarGrid';
import WorkoutCreationModal from '../components/WorkoutCreationModal';
import WorkoutHistoryModal from '../components/WorkoutHistoryModal';
import WorkoutInvitationModal from '../components/WorkoutInvitationModal';
import WorkoutBailModal from '../components/WorkoutBailModal';
import { getCalendarView } from '../utils/calendarUtils';

type ScheduleScreenNavigationProp = StackNavigationProp<ScheduleStackParamList, 'ScheduleMain'>;

const ScheduleScreen: React.FC = () => {
  const navigation = useNavigation<ScheduleScreenNavigationProp>();
  const { 
    schedules, 
    workoutHistory, 
    workoutInvitations,
    pendingInvitationsCount,
    isLoading, 
    deleteSchedule, 
    deleteRecurringSchedule,
    addSchedule,
    updateSchedule,
    refreshSchedules,
    followedGyms,
    climbingAreas,
    updateWorkoutHistory,
    deleteWorkoutHistory,
    refreshWorkoutHistory,
    createWorkoutInvitation,
    respondToWorkoutInvitation,
    bailFromWorkout,
    getWorkoutInvitationById
  } = useApp();
  const { user } = useAuth();
  const [userTrips, setUserTrips] = useState<UserAreaPlan[]>([]);
  
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    userAreaPlansApi.getByUser(user.id).then((plans) => {
      if (!cancelled) setUserTrips(plans);
    }).catch(() => { if (!cancelled) setUserTrips([]); });
    return () => { cancelled = true; };
  }, [user?.id]);

  // Calendar state
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [currentView, setCurrentView] = useState<'week' | 'month'>('week');
  const [showWorkoutModal, setShowWorkoutModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showInvitationModal, setShowInvitationModal] = useState(false);
  const [showBailModal, setShowBailModal] = useState(false);
  const [selectedWorkoutHistory, setSelectedWorkoutHistory] = useState<WorkoutHistory | null>(null);
  const [selectedInvitation, setSelectedInvitation] = useState<WorkoutInvitationWithResponses | null>(null);
  const [editingWorkout, setEditingWorkout] = useState<WorkoutSession | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedHour, setSelectedHour] = useState<number>(9);
  const [selectedMinute, setSelectedMinute] = useState<number>(0);

  // Convert workout history to WorkoutSession format for calendar display
  const historyAsWorkouts = useMemo(() => {
    return workoutHistory
      .filter(history => history.status === 'completed') // Only show completed workouts
      .map((history): WorkoutSession => ({
        id: history.id,
        startTime: new Date(history.startTime),
        endTime: new Date(history.endTime),
        workoutType: history.workoutType || 'limit',
        climbingType: 'any', // Default climbing type for history
        title: history.title || 'Completed Workout',
        notes: history.notes,
        isRecurring: false,
        gymId: history.gymId,
        status: 'completed',
        createdAt: history.createdAt,
        updatedAt: history.updatedAt,
      }));
  }, [workoutHistory]);

  // Convert workout history to WorkoutSession format for calendar display (planned workouts)
  const plannedWorkouts = useMemo(() => {
    return workoutHistory
      .filter(history => history.status === 'planned') // Only show planned/scheduled workouts
      .map((history): WorkoutSession => {
        // FIX: Use isRecurring directly from workout history (set at creation time)
        const isRecurring = history.isRecurring ?? false;
        
        // Get recurring pattern from schedule if needed
        let recurringPattern: { type: 'weekly' | 'daily' | 'custom'; interval: number } | undefined;
        if (isRecurring && history.scheduleId) {
          const schedule = schedules.find(s => s.id === history.scheduleId);
          if (schedule?.recurringPattern) {
            recurringPattern = {
              type: schedule.recurringPattern as 'weekly' | 'daily' | 'custom',
              interval: 1,
            };
          }
        }
        
        return {
          id: history.id,
          startTime: new Date(history.startTime),
          endTime: new Date(history.endTime),
          workoutType: history.workoutType || 'limit',
          climbingType: 'any', // Default climbing type for history
          title: history.title || 'Scheduled Workout',
          notes: history.notes,
          isRecurring: isRecurring,
          recurringPattern: recurringPattern,
          gymId: history.gymId,
          status: 'planned' as const,
          createdAt: history.createdAt,
          updatedAt: history.updatedAt,
        };
      });
  }, [workoutHistory, schedules]);

  // Convert workout invitations to WorkoutSession format for calendar display
  const invitationWorkouts = useMemo(() => {
    return workoutInvitations
      .filter(invitation => invitation.status === 'active')
      .map((invitation): WorkoutSession => ({
        id: `invitation-${invitation.id}`,
        startTime: new Date(invitation.startTime),
        endTime: new Date(invitation.endTime),
        workoutType: invitation.workoutType || 'limit',
        climbingType: invitation.climbingType || 'any',
        title: `${invitation.title} (Invited)`,
        notes: invitation.description,
        isRecurring: invitation.isRecurring,
        recurringPattern: invitation.recurringPattern ? {
          type: invitation.recurringPattern,
          interval: 1,
        } : undefined,
        gymId: invitation.gymId,
        status: 'planned' as const,
        createdAt: invitation.createdAt,
        updatedAt: invitation.updatedAt,
      }));
  }, [workoutInvitations]);

  // Convert user trips to calendar blocks (one per day of each trip) for performance-window display
  const tripWorkouts = useMemo((): WorkoutSession[] => {
    const sessions: WorkoutSession[] = [];
    const areaName = (areaId: string) => climbingAreas.find((a) => a.id === areaId)?.name ?? 'Area';
    for (const plan of userTrips) {
      const start = new Date(plan.startDate + 'T12:00:00');
      const end = new Date(plan.endDate + 'T12:00:00');
      const title = `Trip: ${areaName(plan.areaId)}`;
      for (let t = start.getTime(); t <= end.getTime(); t += 24 * 60 * 60 * 1000) {
        const d = new Date(t);
        const dateStr = d.toISOString().slice(0, 10);
        sessions.push({
          id: `trip-${plan.id}-${dateStr}`,
          startTime: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 8, 0),
          endTime: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9, 0),
          workoutType: 'recovery',
          climbingType: 'any',
          title,
          notes: plan.notes,
          isRecurring: false,
          gymId: undefined,
          status: 'planned',
          createdAt: plan.createdAt,
          updatedAt: plan.updatedAt,
        });
      }
    }
    return sessions;
  }, [userTrips, climbingAreas]);
  
  // Combine planned workouts, completed workouts, invitation workouts, and trip blocks
  const allWorkouts = useMemo(() => {
    return [...plannedWorkouts, ...historyAsWorkouts, ...invitationWorkouts, ...tripWorkouts];
  }, [plannedWorkouts, historyAsWorkouts, invitationWorkouts, tripWorkouts]);
  
  // Get current calendar view
  const calendarView = useMemo(() => getCalendarView(currentView, currentDate), [currentView, currentDate]);

  // Handle time slot press - simple click opens workout modal for new workout
  const handleTimeSlotPress = (date: Date, hour: number, minute: number) => {
    setEditingWorkout(null); // Clear any editing workout
    setSelectedDate(date);
    setSelectedHour(hour);
    setSelectedMinute(minute);
    setShowWorkoutModal(true);
  };

  // Handle workout press
  const handleWorkoutPress = (workout: WorkoutSession) => {
    // Trip block (performance window) - show info only, no edit
    if (workout.id.startsWith('trip-')) {
      Alert.alert(workout.title, workout.notes ? `Performance window\n\n${workout.notes}` : 'Performance window — trip planned.');
      return;
    }
    // If it's an invitation workout, show invitation modal
    if (workout.id.startsWith('invitation-')) {
      const invitationId = workout.id.replace('invitation-', '');
      const invitation = workoutInvitations.find(inv => inv.id === invitationId);
      if (invitation) {
        setSelectedInvitation(invitation);
        setShowInvitationModal(true);
      }
      return;
    }

    // If it's a completed workout, show history modal
    if (workout.status === 'completed') {
      const history = workoutHistory.find(h => h.id === workout.id);
      if (history) {
        setSelectedWorkoutHistory(history);
        setShowHistoryModal(true);
      }
    } else {
      // If it's a planned workout, open workout modal in edit mode
      // Find the corresponding workout history entry to get scheduleId info
      const historyEntry = workoutHistory.find(h => h.id === workout.id);
      if (historyEntry) {
        // Create a workout session with scheduleId information
        const workoutWithScheduleInfo: WorkoutSession & { scheduleId?: string } = {
          ...workout,
          scheduleId: historyEntry.scheduleId, // Add scheduleId to determine if it's recurring
        };
        setEditingWorkout(workoutWithScheduleInfo);
        setShowWorkoutModal(true);
      } else {
        // Fallback to original workout
        setEditingWorkout(workout);
        setShowWorkoutModal(true);
      }
    }
  };

  // Handle view change
  const handleViewChange = (view: 'week' | 'month') => {
    setCurrentView(view);
  };

  // Handle day press in month view - navigate to week view for that week
  const handleDayPress = (date: Date) => {
    if (currentView === 'month') {
      setCurrentDate(date);
      setCurrentView('week');
    }
  };

  // Handle date change
  const handleDateChange = (date: Date) => {
    setCurrentDate(date);
  };

  // Handle add workout
  const handleAddWorkout = () => {
    setSelectedDate(currentDate);
    setSelectedHour(9);
    setSelectedMinute(0);
    setShowWorkoutModal(true);
  };

  // Handle save workout
  const handleSaveWorkout = async (
    workout: Omit<WorkoutSession, 'id' | 'createdAt' | 'updatedAt'>, 
    invitedFriends?: string[],
    invitedGroups?: string[]
  ) => {
    if (!user) {
      Alert.alert('Error', 'Please log in to save workouts');
      return;
    }

    try {
      let scheduleId: string | undefined;

      if (editingWorkout) {
        // Update existing workout history entry
        const workoutUpdates = {
          startTime: workout.startTime.toISOString(),
          endTime: workout.endTime.toISOString(),
          workoutType: workout.workoutType,
          title: workout.title,
          notes: workout.notes,
          isException: true, // Mark as exception since it was modified
        };
        await updateWorkoutHistory(editingWorkout.id, workoutUpdates);
        
        // Get the schedule ID from the existing workout
        const historyEntry = workoutHistory.find(h => h.id === editingWorkout.id);
        scheduleId = historyEntry?.scheduleId;
      } else {
        // Create new schedule
        const scheduleData: CreateScheduleForm = {
          gymId: workout.gymId,
          startTime: workout.startTime,
          endTime: workout.endTime,
          isRecurring: workout.isRecurring,
          recurringPattern: workout.recurringPattern?.type,
          workoutType: workout.workoutType,
          title: workout.title,
          notes: workout.notes,
        };
        const newSchedule = await addSchedule(scheduleData);
        scheduleId = newSchedule.id;
      }

      // Collect all invited user IDs from friends and groups
      let allInvitedUserIds: string[] = [];
      
      // Add friends
      if (invitedFriends && invitedFriends.length > 0) {
        allInvitedUserIds = [...invitedFriends];
      }
      
      // Add group members
      if (invitedGroups && invitedGroups.length > 0 && scheduleId) {
        try {
          for (const groupId of invitedGroups) {
            const members = await groupsApi.getGroupMembers(groupId);
            const memberIds = members.map(m => m.userId);
            allInvitedUserIds = [...allInvitedUserIds, ...memberIds];
          }
        } catch (error) {
          console.error('Error fetching group members:', error);
          Alert.alert('Warning', 'Some group members could not be loaded. Inviting available members.');
        }
      }
      
      // Remove duplicates and the current user
      const uniqueInvitedIds = Array.from(new Set(allInvitedUserIds)).filter(id => id !== user?.id);
      
      // Create workout invitation if there are any invited users
      if (uniqueInvitedIds.length > 0 && scheduleId) {
        const invitationData: CreateWorkoutInvitationData = {
          scheduleId: scheduleId,
          title: workout.title,
          description: workout.notes,
          gymId: workout.gymId,
          startTime: workout.startTime.toISOString(),
          endTime: workout.endTime.toISOString(),
          isRecurring: workout.isRecurring,
          recurringPattern: workout.recurringPattern?.type,
          workoutType: workout.workoutType,
          invitedUserIds: uniqueInvitedIds,
          associatedGroupIds: invitedGroups || [],
        };
        
        await createWorkoutInvitation(scheduleId, invitationData);
        
        // Send messages to group chats
        if (invitedGroups && invitedGroups.length > 0 && user) {
          try {
            await chatApi.sendWorkoutInvitationToGroups(
              invitedGroups,
              workout.title,
              workout.startTime.toISOString(),
              user.name
            );
          } catch (error) {
            console.error('Error sending messages to groups:', error);
            // Don't fail the operation if messaging fails
          }
        }
        
        const friendCount = invitedFriends?.length || 0;
        const groupCount = invitedGroups?.length || 0;
        const totalCount = uniqueInvitedIds.length;
        
        let message = `Workout created and ${totalCount} ${totalCount === 1 ? 'person' : 'people'} invited!`;
        if (friendCount > 0 && groupCount > 0) {
          message = `Workout created! ${friendCount} friend${friendCount > 1 ? 's' : ''} and ${groupCount} group${groupCount > 1 ? 's' : ''} (${totalCount} total) invited!`;
        } else if (groupCount > 0) {
          message = `Workout created! ${groupCount} group${groupCount > 1 ? 's' : ''} (${totalCount} total) invited!`;
        }
        
        Alert.alert('Success', message);
      }
      
      // Close modal and refresh data
      setShowWorkoutModal(false);
      setEditingWorkout(null);
      
      // Refresh schedules to show updated data
      await refreshSchedules();
      
    } catch (error) {
      console.error('Error saving workout:', error);
      Alert.alert('Error', 'Failed to save workout. Please try again.');
    }
  };

  // Handle close modal
  const handleCloseModal = () => {
    setShowWorkoutModal(false);
    setEditingWorkout(null);
  };

  // Handle invitation response
  const handleInvitationResponse = async (invitationId: string, response: 'accepted' | 'declined') => {
    try {
      await respondToWorkoutInvitation(invitationId, response);
      setShowInvitationModal(false);
      setSelectedInvitation(null);
    } catch (error) {
      console.error('Error responding to invitation:', error);
      Alert.alert('Error', 'Failed to respond to invitation. Please try again.');
    }
  };

  // Handle bail from workout
  const handleBailFromWorkout = async (invitationId: string, reason?: string) => {
    console.log('[ScheduleScreen] handleBailFromWorkout called for invitation:', invitationId);
    try {
      await bailFromWorkout(invitationId, reason);
      console.log('[ScheduleScreen] Bail successful, closing modals');
      setShowBailModal(false);
      setShowInvitationModal(false);
      setSelectedInvitation(null);
    } catch (error) {
      console.error('[ScheduleScreen] Error bailing from workout:', error);
      Alert.alert('Error', 'Failed to bail from workout. Please try again.');
    }
  };

  // Handle bail button press (opens bail modal)
  const handleBailPress = (invitationId: string) => {
    console.log('[ScheduleScreen] handleBailPress called for invitation:', invitationId);
    // Find the invitation to pass to the bail modal
    const invitation = workoutInvitations.find(inv => inv.id === invitationId);
    if (invitation) {
      console.log('[ScheduleScreen] Found invitation, opening bail modal');
      // Close the invitation modal first
      setShowInvitationModal(false);
      // Set the selected invitation and open the bail modal
      setSelectedInvitation(invitation);
      setShowBailModal(true);
    } else {
      console.error('[ScheduleScreen] Invitation not found:', invitationId);
    }
  };

  // Handle delete workout
  const handleDeleteWorkout = async (workoutId: string, deleteAllRecurring?: boolean) => {
    if (!user) return;

    try {
      // Find the workout history entry to get details
      const workoutEntry = workoutHistory.find(wh => wh.id === workoutId);
      
      if (!workoutEntry) {
        Alert.alert('Error', 'Workout not found');
        return;
      }

      if (deleteAllRecurring && workoutEntry.scheduleId) {
        // Delete the entire recurring schedule and all its instances
        await deleteSchedule(workoutEntry.scheduleId);
        Alert.alert('Success', 'All recurring workouts deleted successfully');
      } else if (workoutEntry.scheduleId && !deleteAllRecurring) {
        // Delete single instance of recurring workout
        await deleteWorkoutHistory(workoutId);
        Alert.alert('Success', 'This workout instance deleted successfully');
      } else {
        // Delete standalone workout (no schedule_id)
        await deleteWorkoutHistory(workoutId);
        Alert.alert('Success', 'Workout deleted successfully');
      }
      
      // Refresh workout history to show updated data
      await refreshWorkoutHistory();
      
    } catch (error) {
      console.error('Error deleting workout:', error);
      Alert.alert('Error', 'Failed to delete workout. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      {/* Calendar Header */}
      <CalendarHeader
        currentView={calendarView}
        onViewChange={handleViewChange}
        onDateChange={handleDateChange}
        onAddWorkout={handleAddWorkout}
      />

      {/* Calendar Grid */}
      <CalendarGrid
        currentDate={currentDate}
        workouts={allWorkouts}
        onTimeSlotPress={handleTimeSlotPress}
        onWorkoutPress={handleWorkoutPress}
        onDayPress={handleDayPress}
        viewType={currentView}
      />

      {/* Workout Creation Modal */}
      <WorkoutCreationModal
        visible={showWorkoutModal}
        onClose={handleCloseModal}
        onSave={handleSaveWorkout}
        onDelete={handleDeleteWorkout}
        selectedDate={selectedDate}
        selectedHour={selectedHour}
        selectedMinute={selectedMinute}
        editingWorkout={editingWorkout}
      />

      {/* Workout History Modal */}
      <WorkoutHistoryModal
        visible={showHistoryModal}
        onClose={() => {
          setShowHistoryModal(false);
          setSelectedWorkoutHistory(null);
        }}
        workout={selectedWorkoutHistory}
      />

      {/* Workout Invitation Modal */}
      <WorkoutInvitationModal
        visible={showInvitationModal && !showBailModal}
        onClose={() => {
          setShowInvitationModal(false);
          setSelectedInvitation(null);
        }}
        invitation={selectedInvitation}
        onRespond={handleInvitationResponse}
        onBail={handleBailPress}
      />

      {/* Workout Bail Modal */}
      <WorkoutBailModal
        visible={showBailModal}
        onClose={() => {
          setShowBailModal(false);
          // Don't clear selectedInvitation here - keep it for potential re-opening
        }}
        invitation={selectedInvitation}
        onBail={handleBailFromWorkout}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
});

export default ScheduleScreen;