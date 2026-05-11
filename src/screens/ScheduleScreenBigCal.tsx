import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { groupsApi, chatApi, userAreaPlansApi } from '../services/api';
import {
  Schedule,
  ScheduleStackParamList,
  WorkoutSession,
  WorkoutHistory,
  CalendarView,
  CreateScheduleForm,
  WorkoutInvitationWithResponses,
  CreateWorkoutInvitationData,
  UserAreaPlan,
} from '../types';
import WorkoutCreationModal from '../components/WorkoutCreationModal';
import WorkoutHistoryModal from '../components/WorkoutHistoryModal';
import WorkoutInvitationModal from '../components/WorkoutInvitationModal';
import WorkoutBailModal from '../components/WorkoutBailModal';
import { colors } from '../theme/colors';

// react-native-big-calendar
import { Calendar } from 'react-native-big-calendar';
import type { ICalendarEventBase } from 'react-native-big-calendar';

type ScheduleScreenNavigationProp = StackNavigationProp<ScheduleStackParamList, 'ScheduleMain'>;

// Map your WorkoutSession status/type to a display color
const EVENT_COLORS: Record<string, string> = {
  completed: colors.success,
  invitation: colors.secondary,
  trip: colors.secondary,
  planned: colors.primary,
};

/**
 * Convert a WorkoutSession array into the EventItem shape expected by
 * @howljs/calendar-kit (id, title, start, end, color).
 */
function toCalendarEvents(workouts: WorkoutSession[]): (ICalendarEventBase & { _raw: WorkoutSession })[] {
  return workouts.map((w) => {
    let color = EVENT_COLORS.planned;
    if (w.status === 'completed') color = EVENT_COLORS.completed;
    else if (w.id.startsWith('invitation-')) color = EVENT_COLORS.invitation;
    else if (w.id.startsWith('trip-span-')) color = EVENT_COLORS.trip;

    return {
      id: w.id,
      title: w.title,
      start: w.startTime,
      end: w.endTime,
      color,
      // Carry through whatever extra fields you need in press handlers
      _raw: w,
    } as ICalendarEventBase & { _raw: WorkoutSession };
  });
}

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
    getWorkoutInvitationById,
  } = useApp();
  const { user } = useAuth();
  const [userTrips, setUserTrips] = useState<UserAreaPlan[]>([]);

  const loadUserTrips = useCallback(() => {
    if (!user?.id) return;
    userAreaPlansApi.getByUser(user.id).then(setUserTrips).catch(() => setUserTrips([]));
  }, [user?.id]);

  useEffect(() => { loadUserTrips(); }, [loadUserTrips]);
  useFocusEffect(useCallback(() => { loadUserTrips(); }, [loadUserTrips]));

  // ─── Calendar state ────────────────────────────────────────────────────────
  const [currentView, setCurrentView] = useState<'week' | 'month'>('week');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
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

  // ─── Data assembly (unchanged from original) ──────────────────────────────
  const historyAsWorkouts = useMemo<WorkoutSession[]>(() =>
    workoutHistory
      .filter((h) => h.status === 'completed')
      .map((h): WorkoutSession => ({
        id: h.id,
        startTime: new Date(h.startTime),
        endTime: new Date(h.endTime),
        workoutType: h.workoutType || 'limit',
        climbingType: 'any',
        title: h.title || 'Completed Workout',
        notes: h.notes,
        isRecurring: false,
        gymId: h.gymId,
        status: 'completed',
        createdAt: h.createdAt,
        updatedAt: h.updatedAt,
      })),
    [workoutHistory]
  );

  const plannedWorkouts = useMemo<WorkoutSession[]>(() =>
    workoutHistory
      .filter((h) => h.status === 'planned')
      .map((h): WorkoutSession => {
        const isRecurring = h.isRecurring ?? false;
        let recurringPattern: { type: 'weekly' | 'daily' | 'custom'; interval: number } | undefined;
        if (isRecurring && h.scheduleId) {
          const schedule = schedules.find((s) => s.id === h.scheduleId);
          if (schedule?.recurringPattern) {
            recurringPattern = { type: schedule.recurringPattern as 'weekly' | 'daily' | 'custom', interval: 1 };
          }
        }
        return {
          id: h.id,
          startTime: new Date(h.startTime),
          endTime: new Date(h.endTime),
          workoutType: h.workoutType || 'limit',
          climbingType: 'any',
          title: h.title || 'Scheduled Workout',
          notes: h.notes,
          isRecurring,
          recurringPattern,
          gymId: h.gymId,
          status: 'planned' as const,
          createdAt: h.createdAt,
          updatedAt: h.updatedAt,
        };
      }),
    [workoutHistory, schedules]
  );

  const invitationWorkouts = useMemo<WorkoutSession[]>(() =>
    workoutInvitations
      .filter((inv) => inv.status === 'active')
      .map((inv): WorkoutSession => ({
        id: `invitation-${inv.id}`,
        startTime: new Date(inv.startTime),
        endTime: new Date(inv.endTime),
        workoutType: inv.workoutType || 'limit',
        climbingType: inv.climbingType || 'any',
        title: `${inv.title} (Invited)`,
        notes: inv.description,
        isRecurring: inv.isRecurring,
        recurringPattern: inv.recurringPattern ? { type: inv.recurringPattern, interval: 1 } : undefined,
        gymId: inv.gymId,
        status: 'planned' as const,
        createdAt: inv.createdAt,
        updatedAt: inv.updatedAt,
      })),
    [workoutInvitations]
  );

  const tripWorkouts = useMemo<WorkoutSession[]>(() => {
    const resolveArea = (areaId: string) =>
      climbingAreas.find((a) => a.id === areaId)?.name ?? 'Area';
    return userTrips.map((plan) => ({
      id: `trip-span-${plan.id}`,
      startTime: new Date(plan.startDate + 'T12:00:00'),
      endTime: new Date(plan.endDate + 'T12:00:00'),
      spanningEndDate: plan.endDate,
      workoutType: 'recovery' as const,
      climbingType: 'any' as const,
      title: resolveArea(plan.areaId),
      notes: plan.notes,
      isRecurring: false,
      gymId: undefined,
      status: 'planned' as const,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    }));
  }, [userTrips, climbingAreas]);

  const timedWorkouts = useMemo(
    () => [...plannedWorkouts, ...historyAsWorkouts, ...invitationWorkouts],
    [plannedWorkouts, historyAsWorkouts, invitationWorkouts]
  );

  // Convert to the format BigCalendar expects
  const calendarEvents = useMemo(() => toCalendarEvents(timedWorkouts), [timedWorkouts]);

  // ─── Event handlers ────────────────────────────────────────────────────────

  /** Tapping an empty time slot opens the creation modal */
  const handlePressCell = useCallback((date: Date) => {
    setEditingWorkout(null);
    setSelectedDate(date);
    setSelectedHour(date.getHours());
    setSelectedMinute(date.getMinutes());
    setShowWorkoutModal(true);
  }, []);

  /** Tapping an existing event opens the appropriate modal */
  const handlePressEvent = useCallback(
    (event: ICalendarEventBase & { _raw?: WorkoutSession }) => {
      const workout: WorkoutSession = (event as any)._raw;
      if (!workout) return;

      // Trip / area plan — info alert only
      if (workout.spanningEndDate || workout.id.startsWith('trip-span-')) {
        const fmt = (d: Date) =>
          d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        const start = fmt(workout.startTime);
        const end = workout.spanningEndDate
          ? fmt(new Date(workout.spanningEndDate + 'T12:00:00'))
          : start;
        Alert.alert(
          workout.title,
          [workout.notes, `Trip: ${start === end ? start : `${start} – ${end}`}`].filter(Boolean).join('\n\n')
        );
        return;
      }

      // Invitation
      if (workout.id.startsWith('invitation-')) {
        const invitationId = workout.id.replace('invitation-', '');
        const invitation = workoutInvitations.find((inv) => inv.id === invitationId);
        if (invitation) {
          setSelectedInvitation(invitation);
          setShowInvitationModal(true);
        }
        return;
      }

      // Completed workout → history modal
      if (workout.status === 'completed') {
        const history = workoutHistory.find((h) => h.id === workout.id);
        if (history) {
          setSelectedWorkoutHistory(history);
          setShowHistoryModal(true);
        }
        return;
      }

      // Planned workout → edit modal
      const historyEntry = workoutHistory.find((h) => h.id === workout.id);
      const workoutWithScheduleInfo = {
        ...workout,
        scheduleId: historyEntry?.scheduleId,
      };
      setEditingWorkout(workoutWithScheduleInfo);
      setShowWorkoutModal(true);
    },
    [workoutInvitations, workoutHistory]
  );

  const handleAddWorkout = useCallback(() => {
    const now = new Date();
    setEditingWorkout(null);
    setSelectedDate(now);
    setSelectedHour(9);
    setSelectedMinute(0);
    setShowWorkoutModal(true);
  }, []);

  const handleTripPress = useCallback((trip: WorkoutSession) => {
    const fmt = (d: Date) =>
      d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const start = fmt(trip.startTime);
    const end = trip.spanningEndDate ? fmt(new Date(trip.spanningEndDate + 'T12:00:00')) : start;
    Alert.alert(
      trip.title,
      [trip.notes, `Trip: ${start === end ? start : `${start} – ${end}`}`].filter(Boolean).join('\n\n')
    );
  }, []);

  const syncCurrentDate = useCallback((nextDate: Date) => {
    setCurrentDate((prev) => (prev.getTime() === nextDate.getTime() ? prev : nextDate));
  }, []);

  const weekTripSpans = useMemo(() => {
    const start = new Date(currentDate);
    const day = start.getDay();
    start.setDate(start.getDate() - day);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    const dayMs = 24 * 60 * 60 * 1000;
    return tripWorkouts
      .map((trip) => {
        const tripStart = new Date(trip.startTime);
        tripStart.setHours(0, 0, 0, 0);
        const tripEnd = trip.spanningEndDate
          ? new Date(`${trip.spanningEndDate}T23:59:59`)
          : new Date(trip.endTime);
        tripEnd.setHours(23, 59, 59, 999);

        const overlapStart = tripStart > start ? tripStart : start;
        const overlapEnd = tripEnd < end ? tripEnd : end;
        if (overlapStart > overlapEnd) return null;

        const startDayIndex = Math.floor((overlapStart.getTime() - start.getTime()) / dayMs);
        const spanDays = Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / dayMs) + 1;
        return {
          trip,
          leftPct: (startDayIndex / 7) * 100,
          widthPct: (spanDays / 7) * 100,
        };
      })
      .filter(Boolean) as { trip: WorkoutSession; leftPct: number; widthPct: number }[];
  }, [tripWorkouts, currentDate]);

  // ─── Save / delete (unchanged logic) ──────────────────────────────────────

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
        await updateWorkoutHistory(editingWorkout.id, {
          startTime: workout.startTime.toISOString(),
          endTime: workout.endTime.toISOString(),
          workoutType: workout.workoutType,
          title: workout.title,
          notes: workout.notes,
          isException: true,
        });
        const historyEntry = workoutHistory.find((h) => h.id === editingWorkout.id);
        scheduleId = historyEntry?.scheduleId;
      } else {
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

      let allInvitedUserIds: string[] = [...(invitedFriends ?? [])];
      if (invitedGroups?.length && scheduleId) {
        try {
          for (const groupId of invitedGroups) {
            const members = await groupsApi.getGroupMembers(groupId);
            allInvitedUserIds = [...allInvitedUserIds, ...members.map((m) => m.userId)];
          }
        } catch {
          Alert.alert('Warning', 'Some group members could not be loaded. Inviting available members.');
        }
      }

      const uniqueInvitedIds = Array.from(new Set(allInvitedUserIds)).filter((id) => id !== user?.id);

      if (uniqueInvitedIds.length > 0 && scheduleId) {
        const invitationData: CreateWorkoutInvitationData = {
          scheduleId,
          title: workout.title,
          description: workout.notes,
          gymId: workout.gymId,
          startTime: workout.startTime.toISOString(),
          endTime: workout.endTime.toISOString(),
          isRecurring: workout.isRecurring,
          recurringPattern: workout.recurringPattern?.type,
          workoutType: workout.workoutType,
          invitedUserIds: uniqueInvitedIds,
          associatedGroupIds: invitedGroups ?? [],
        };
        await createWorkoutInvitation(scheduleId, invitationData);

        if (invitedGroups?.length && user) {
          try {
            await chatApi.sendWorkoutInvitationToGroups(
              invitedGroups,
              workout.title,
              workout.startTime.toISOString(),
              user.name
            );
          } catch {
            console.error('Error sending messages to groups');
          }
        }

        const f = invitedFriends?.length ?? 0;
        const g = invitedGroups?.length ?? 0;
        const t = uniqueInvitedIds.length;
        let msg = `Workout created and ${t} ${t === 1 ? 'person' : 'people'} invited!`;
        if (f > 0 && g > 0) msg = `Workout created! ${f} friend${f > 1 ? 's' : ''} and ${g} group${g > 1 ? 's' : ''} (${t} total) invited!`;
        else if (g > 0) msg = `Workout created! ${g} group${g > 1 ? 's' : ''} (${t} total) invited!`;
        Alert.alert('Success', msg);
      }

      setShowWorkoutModal(false);
      setEditingWorkout(null);
      await refreshSchedules();
    } catch {
      Alert.alert('Error', 'Failed to save workout. Please try again.');
    }
  };

  const handleDeleteWorkout = async (workoutId: string, deleteAllRecurring?: boolean) => {
    if (!user) return;
    try {
      const workoutEntry = workoutHistory.find((wh) => wh.id === workoutId);
      if (!workoutEntry) { Alert.alert('Error', 'Workout not found'); return; }

      if (deleteAllRecurring && workoutEntry.scheduleId) {
        await deleteSchedule(workoutEntry.scheduleId);
        Alert.alert('Success', 'All recurring workouts deleted successfully');
      } else if (workoutEntry.scheduleId && !deleteAllRecurring) {
        await deleteWorkoutHistory(workoutId);
        Alert.alert('Success', 'This workout instance deleted successfully');
      } else {
        await deleteWorkoutHistory(workoutId);
        Alert.alert('Success', 'Workout deleted successfully');
      }
      await refreshWorkoutHistory();
    } catch {
      Alert.alert('Error', 'Failed to delete workout. Please try again.');
    }
  };

  const handleInvitationResponse = async (invitationId: string, response: 'accepted' | 'declined') => {
    try {
      await respondToWorkoutInvitation(invitationId, response);
      setShowInvitationModal(false);
      setSelectedInvitation(null);
    } catch {
      Alert.alert('Error', 'Failed to respond to invitation. Please try again.');
    }
  };

  const handleBailPress = (invitationId: string) => {
    const invitation = workoutInvitations.find((inv) => inv.id === invitationId);
    if (invitation) {
      setShowInvitationModal(false);
      setSelectedInvitation(invitation);
      setShowBailModal(true);
    }
  };

  const handleBailFromWorkout = async (invitationId: string, reason?: string) => {
    try {
      await bailFromWorkout(invitationId, reason);
      setShowBailModal(false);
      setShowInvitationModal(false);
      setSelectedInvitation(null);
    } catch {
      Alert.alert('Error', 'Failed to bail from workout. Please try again.');
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      {/* ── Top bar with view toggle + add button ── */}
      <View style={styles.toolbar}>
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, currentView === 'week' && styles.toggleBtnActive]}
            onPress={() => setCurrentView('week')}
          >
            <Text style={[styles.toggleText, currentView === 'week' && styles.toggleTextActive]}>
              Week
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, currentView === 'month' && styles.toggleBtnActive]}
            onPress={() => setCurrentView('month')}
          >
            <Text style={[styles.toggleText, currentView === 'month' && styles.toggleTextActive]}>
              Month
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.addButton} onPress={handleAddWorkout}>
          <Text style={styles.addButtonText}>＋</Text>
        </TouchableOpacity>
      </View>

      {tripWorkouts.length > 0 && (
        <View style={styles.tripStrip}>
          <Text style={styles.tripStripTitle}>Trips</Text>
          {currentView === 'week' ? (
            <View style={styles.tripWeekTrack}>
              {weekTripSpans.map(({ trip, leftPct, widthPct }, idx) => (
                <TouchableOpacity
                  key={`${trip.id}-${idx}`}
                  style={[
                    styles.tripWeekBar,
                    {
                      left: `${leftPct}%`,
                      width: `${Math.max(widthPct, 14)}%`,
                      top: idx * 28,
                    },
                  ]}
                  onPress={() => handleTripPress(trip)}
                >
                  <Text style={styles.tripWeekBarText} numberOfLines={1}>
                    {trip.title}
                  </Text>
                </TouchableOpacity>
              ))}
              <View style={{ height: Math.max(weekTripSpans.length, 1) * 28 }} />
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tripRow}>
              {tripWorkouts.map((trip) => {
                const start = trip.startTime.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                const end = trip.spanningEndDate
                  ? new Date(trip.spanningEndDate + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                  : start;
                return (
                  <TouchableOpacity
                    key={trip.id}
                    style={styles.tripChip}
                    onPress={() => handleTripPress(trip)}
                  >
                    <Text style={styles.tripChipTitle} numberOfLines={1}>{trip.title}</Text>
                    <Text style={styles.tripChipDates}>{start === end ? start : `${start} - ${end}`}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}

      {/* ── BigCalendar ── */}
      <Calendar
        mode={currentView}
        date={currentDate}
        events={calendarEvents}
        onPressCell={handlePressCell}
        onPressEvent={handlePressEvent}
        /**
         * When a day cell is tapped in month view, switch to week view
         * centred on that day.
         */
        onPressDateHeader={(date) => {
          if (currentView === 'month') {
            syncCurrentDate(date);
            setSelectedDate(date);
            setCurrentView('week');
          }
        }}
        onChangeDate={(range) => {
          if (range?.[0]) syncCurrentDate(range[0]);
        }}
        minHour={6}
        maxHour={22}
        height={600}
        swipeEnabled
        eventCellStyle={() => ({
          backgroundColor: colors.primary,
          borderRadius: 6,
        })}
        headerContainerStyle={{ backgroundColor: colors.surfaceElevated }}
        bodyContainerStyle={{ backgroundColor: colors.background }}
        hourStyle={{ color: colors.textMuted }}
        calendarContainerStyle={{ backgroundColor: colors.background }}
        ampm
      />

      {/* ── Modals (untouched) ── */}
      <WorkoutCreationModal
        visible={showWorkoutModal}
        onClose={() => { setShowWorkoutModal(false); setEditingWorkout(null); }}
        onSave={handleSaveWorkout}
        onDelete={handleDeleteWorkout}
        selectedDate={selectedDate}
        selectedHour={selectedHour}
        selectedMinute={selectedMinute}
        editingWorkout={editingWorkout}
      />

      <WorkoutHistoryModal
        visible={showHistoryModal}
        onClose={() => { setShowHistoryModal(false); setSelectedWorkoutHistory(null); }}
        workout={selectedWorkoutHistory}
      />

      <WorkoutInvitationModal
        visible={showInvitationModal && !showBailModal}
        onClose={() => { setShowInvitationModal(false); setSelectedInvitation(null); }}
        invitation={selectedInvitation}
        onRespond={handleInvitationResponse}
        onBail={handleBailPress}
      />

      <WorkoutBailModal
        visible={showBailModal}
        onClose={() => setShowBailModal(false)}
        invitation={selectedInvitation}
        onBail={handleBailFromWorkout}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border ?? '#E5E7EB',
    backgroundColor: colors.background,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 2,
  },
  toggleBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
  },
  toggleBtnActive: {
    backgroundColor: colors.primary,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textMuted ?? '#6B7280',
  },
  toggleTextActive: {
    color: '#ffffff',
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 20,
    lineHeight: 22,
  },
  tripStrip: {
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    backgroundColor: colors.background,
  },
  tripStripTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.textMuted,
    paddingHorizontal: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  tripRow: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tripChip: {
    minWidth: 160,
    maxWidth: 220,
    backgroundColor: colors.secondaryMuted,
    borderColor: colors.secondaryBorder,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  tripChipTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  tripChipDates: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  tripWeekTrack: {
    marginHorizontal: 16,
    position: 'relative',
  },
  tripWeekBar: {
    position: 'absolute',
    height: 22,
    borderRadius: 7,
    backgroundColor: colors.secondaryMuted,
    borderColor: colors.secondaryBorder,
    borderWidth: 1,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  tripWeekBarText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
});

export default ScheduleScreen;