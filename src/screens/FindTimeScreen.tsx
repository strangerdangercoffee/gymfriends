import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Modal,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { workoutHistoryApi, groupsApi, calendarBusyBlocksApi } from '../services/api';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import { hasCalendarAccess, syncUpcomingEvents } from '../services/googleCalendar';
import {
  WorkoutHistory,
  FindStackParamList,
  WorkoutSession,
  CreateScheduleForm,
  CreateWorkoutInvitationData,
} from '../types';
import WorkoutCreationModal from '../components/WorkoutCreationModal';

// ─── Types ────────────────────────────────────────────────────────────────────

type FindTimeRouteParams =
  | { mode: 'friend'; userId: string; userName: string }
  | { mode: 'group'; groupId: string; groupName: string };

interface UserEntry {
  id: string;
  name: string;
  avatar?: string;
  hasScheduleAccess: boolean;
}

interface GroupEntry {
  id: string;
  name: string;
  memberIds: string[];
}

interface SlotInfo {
  dayOffset: number; // 0=Mon … 6=Sun
  hour: number;      // 6–21
  date: Date;
  freeUsers: string[];
  busyUsers: string[];
  noAccessUsers: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 6am – 9pm
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getMondayOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatHour(hour: number): string {
  if (hour === 12) return '12pm';
  if (hour > 12) return `${hour - 12}pm`;
  return `${hour}am`;
}

function formatWeekRange(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${monday.toLocaleDateString(undefined, opts)} – ${sunday.toLocaleDateString(undefined, opts)}`;
}

function getHeatColor(freeCount: number, totalAccessible: number): string {
  if (totalAccessible === 0) return colors.surfaceElevated;
  const ratio = freeCount / totalAccessible;
  if (ratio === 0) return colors.surfaceElevated;
  if (ratio <= 0.33) return 'rgba(63, 245, 133, 0.18)';
  if (ratio <= 0.66) return 'rgba(63, 245, 133, 0.42)';
  if (ratio < 1.0)  return 'rgba(63, 245, 133, 0.68)';
  return 'rgba(63, 245, 133, 0.92)';
}

// ─── Screen ───────────────────────────────────────────────────────────────────

const FindTimeScreen: React.FC = () => {
  const route = useRoute<RouteProp<{ params: FindTimeRouteParams }, 'params'>>();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { friends, addSchedule, createWorkoutInvitation } = useApp();
  const { user } = useAuth();
  const { isOffline } = useNetwork();

  const params = route.params as FindTimeRouteParams;

  // ── state ──────────────────────────────────────────────────────────────────

  const [isLoading, setIsLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<UserEntry[]>([]);
  const [groups, setGroups] = useState<GroupEntry[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [busyBlocks, setBusyBlocks] = useState<Record<string, WorkoutHistory[]>>({});
  const [myBusyBlocks, setMyBusyBlocks] = useState<{ id: string; startTime: Date; endTime: Date }[]>([]);
  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOfWeek(new Date()));
  const [selectedSlot, setSelectedSlot] = useState<SlotInfo | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteDate, setInviteDate] = useState<Date>(new Date());
  const [inviteHour, setInviteHour] = useState(18);

  // ── derived ────────────────────────────────────────────────────────────────

  const screenTitle = useMemo(() => {
    if (params.mode === 'friend') return `${params.userName}'s Schedule`;
    return `${params.groupName}`;
  }, [params]);

  const isSingleFriend = params.mode === 'friend';

  // ── load users ────────────────────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        if (params.mode === 'friend') {
          const friend = friends.find(f => f.id === params.userId);
          const hasAccess = friend?.privacySettings?.shareSchedule !== false;
          setAllUsers([{
            id: params.userId,
            name: params.userName,
            avatar: friend?.avatar,
            hasScheduleAccess: hasAccess,
          }]);
          setSelectedUserIds(new Set([params.userId]));
        } else {
          // group mode: fetch members
          const members = await groupsApi.getGroupMembers(params.groupId);
          const userEntries: UserEntry[] = members
            .filter(m => m.userId !== user?.id) // exclude self
            .map(m => {
              const friendData = friends.find(f => f.id === m.userId);
              return {
                id: m.userId,
                name: m.user?.name ?? 'Member',
                avatar: m.user?.avatar,
                hasScheduleAccess: friendData?.privacySettings?.shareSchedule !== false,
              };
            });
          setAllUsers(userEntries);
          setSelectedUserIds(new Set(userEntries.map(u => u.id)));

          // Also load user's own groups for the group filter chips
          if (user?.id) {
            const myGroups = await groupsApi.getUserGroups(user.id);
            setGroups(myGroups.map((g: any) => ({
              id: g.id,
              name: g.name,
              memberIds: [], // populated lazily if needed
            })));
          }
        }
      } catch (err) {
        console.error('[FindTimeScreen] Failed to load users:', err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [params, user?.id]);

  // ── trigger calendar sync when the screen opens ───────────────────────────
  // Runs once per screen mount so the heat map always shows fresh GCal data.

  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;
    hasCalendarAccess(userId)
      .then((hasAccess) => {
        if (hasAccess) {
          syncUpcomingEvents(userId).catch((err) =>
            console.warn('[FindTimeScreen] GCal sync error:', err)
          );
        }
      })
      .catch((err) => console.warn('[FindTimeScreen] hasCalendarAccess error:', err));
  }, [user?.id]);

  // ── fetch busy blocks for the current week ────────────────────────────────
  // Combines planned workout sessions AND Google Calendar busy blocks so the
  // heatmap reflects the user's full calendar — not just in-app workouts.

  useEffect(() => {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const fetchAll = async () => {
      const accessibleUsers = allUsers.filter(u => u.hasScheduleAccess);
      if (accessibleUsers.length === 0) return;

      // Fetch planned workouts and GCal blocks in parallel for all users
      const [workoutResults, gcalResults] = await Promise.all([
        Promise.allSettled(
          accessibleUsers.map(u =>
            workoutHistoryApi.getWorkoutHistory(u.id, weekStart, weekEnd)
          )
        ),
        Promise.allSettled(
          accessibleUsers.map(u =>
            calendarBusyBlocksApi.getForUser(u.id, weekStart, weekEnd)
          )
        ),
      ]);

      const blocks: Record<string, WorkoutHistory[]> = {};
      accessibleUsers.forEach((u, idx) => {
        // Planned in-app workouts
        const planned: WorkoutHistory[] =
          workoutResults[idx].status === 'fulfilled'
            ? (workoutResults[idx] as PromiseFulfilledResult<WorkoutHistory[]>).value.filter(
                (wh) => wh.status === 'planned'
              )
            : [];

        // GCal blocks — shaped into minimal WorkoutHistory-compatible objects
        // (the heatmap only reads startTime / endTime)
        const gcal: WorkoutHistory[] =
          gcalResults[idx].status === 'fulfilled'
            ? (gcalResults[idx] as PromiseFulfilledResult<{ id: string; startTime: Date; endTime: Date }[]>).value.map(
                (b) =>
                  ({
                    id: `gcal-${b.id}`,
                    userId: u.id,
                    startTime: b.startTime.toISOString(),
                    endTime: b.endTime.toISOString(),
                    status: 'planned',
                  } as unknown as WorkoutHistory)
              )
            : [];

        blocks[u.id] = [...planned, ...gcal];
      });

      setBusyBlocks(blocks);
    };

    if (allUsers.length > 0) {
      fetchAll();
    }
  }, [weekStart, allUsers]);

  // ── fetch the current user's own GCal busy blocks for the week ───────────
  useEffect(() => {
    if (!user?.id) return;
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    calendarBusyBlocksApi
      .getForUser(user.id, weekStart, weekEnd)
      .then(setMyBusyBlocks)
      .catch(() => setMyBusyBlocks([]));
  }, [weekStart, user?.id]);

  // ── compute heat map ──────────────────────────────────────────────────────

  const heatMap = useMemo(() => {
    const selected = allUsers.filter(u => selectedUserIds.has(u.id));
    const grid: Record<string, SlotInfo> = {};

    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + dayOffset);

      for (const hour of HOURS) {
        const slotStart = new Date(date);
        slotStart.setHours(hour, 0, 0, 0);
        const slotEnd = new Date(date);
        slotEnd.setHours(hour + 1, 0, 0, 0);

        const freeUsers: string[] = [];
        const busyUsers: string[] = [];
        const noAccessUsers: string[] = [];

        for (const u of selected) {
          if (!u.hasScheduleAccess) {
            noAccessUsers.push(u.id);
            continue;
          }
          const blocks = busyBlocks[u.id] ?? [];
          const isBusy = blocks.some(b => {
            const bs = new Date(b.startTime);
            const be = new Date(b.endTime);
            return bs < slotEnd && be > slotStart;
          });
          if (isBusy) busyUsers.push(u.id);
          else freeUsers.push(u.id);
        }

        const slotDate = new Date(date);
        grid[`${dayOffset}-${hour}`] = {
          dayOffset,
          hour,
          date: slotDate,
          freeUsers,
          busyUsers,
          noAccessUsers,
        };
      }
    }
    return grid;
  }, [weekStart, allUsers, selectedUserIds, busyBlocks]);

  // ── interaction handlers ──────────────────────────────────────────────────

  const toggleUser = (userId: string) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        if (next.size === 1) return prev; // keep at least 1
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handleSlotPress = (slot: SlotInfo) => {
    setSelectedSlot(slot);
  };

  const handleInvitePress = () => {
    if (!selectedSlot) return;

    const openInviteModal = () => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + selectedSlot.dayOffset);
      setInviteDate(d);
      setInviteHour(selectedSlot.hour);
      setSelectedSlot(null);
      setShowInviteModal(true);
    };

    // Warn if the current user has a GCal conflict at this slot
    if (mySlotHasConflict(selectedSlot.dayOffset, selectedSlot.hour)) {
      Alert.alert(
        'Calendar Conflict',
        "You have something else scheduled during this time. Do you still want to invite friends to climb?",
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue Anyway', onPress: openInviteModal },
        ]
      );
    } else {
      openInviteModal();
    }
  };

  const handleSaveWorkout = async (
    workout: Omit<WorkoutSession, 'id' | 'createdAt' | 'updatedAt'>,
    invitedFriends?: string[],
  ) => {
    if (!user) {
      Alert.alert('Error', 'Please log in first');
      return;
    }
    try {
      // 'custom' isn't a valid recurring pattern for invitations — treat as undefined
      const safeRecurringPattern = (
        workout.recurringPattern?.type === 'custom'
          ? undefined
          : workout.recurringPattern?.type as 'daily' | 'weekly' | 'monthly' | undefined
      );

      const scheduleData: CreateScheduleForm = {
        gymId: workout.gymId ?? '',
        startTime: workout.startTime,
        endTime: workout.endTime,
        isRecurring: workout.isRecurring,
        recurringPattern: workout.recurringPattern?.type,
        workoutType: workout.workoutType,
        title: workout.title,
        notes: workout.notes,
      };
      const newSchedule = await addSchedule(scheduleData);

      if (invitedFriends && invitedFriends.length > 0) {
        const invData: CreateWorkoutInvitationData = {
          scheduleId: newSchedule.id,
          title: workout.title ?? '',
          description: workout.notes,
          gymId: workout.gymId ?? '',
          startTime: workout.startTime.toISOString(),
          endTime: workout.endTime.toISOString(),
          isRecurring: workout.isRecurring,
          recurringPattern: safeRecurringPattern,
          workoutType: workout.workoutType,
          invitedUserIds: invitedFriends,
          associatedGroupIds: [],
        };
        await createWorkoutInvitation(newSchedule.id, invData);
        const successMsg = isOffline
          ? `Workout queued — invites to ${invitedFriends.length} ${invitedFriends.length === 1 ? 'person' : 'people'} will send when you reconnect.`
          : `Workout created and ${invitedFriends.length} ${invitedFriends.length === 1 ? 'person' : 'people'} invited.`;
        Alert.alert(isOffline ? 'Saved offline' : 'Done!', successMsg);
      }

      setShowInviteModal(false);
    } catch (err) {
      console.error('[FindTimeScreen] Save workout error:', err);
      Alert.alert('Error', 'Could not save workout. Please try again.');
    }
  };

  // ── week navigation ───────────────────────────────────────────────────────

  const goToPrevWeek = () => {
    setWeekStart(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  };

  const goToNextWeek = () => {
    setWeekStart(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  };

  // ── helpers ───────────────────────────────────────────────────────────────

  const getUserName = (userId: string) =>
    allUsers.find(u => u.id === userId)?.name ?? userId;

  /** Returns true if the viewer's own GCal has a conflict at the given hour slot. */
  const mySlotHasConflict = (dayOffset: number, hour: number): boolean => {
    if (myBusyBlocks.length === 0) return false;
    const slotDate = new Date(weekStart);
    slotDate.setDate(weekStart.getDate() + dayOffset);
    const slotStart = new Date(slotDate);
    slotStart.setHours(hour, 0, 0, 0);
    const slotEnd = new Date(slotDate);
    slotEnd.setHours(hour + 1, 0, 0, 0);
    return myBusyBlocks.some((b) => b.startTime < slotEnd && b.endTime > slotStart);
  };

  const getDayDate = (offset: number): number => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + offset);
    return d.getDate();
  };

  const isToday = (offset: number): boolean => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + offset);
    return d.toDateString() === new Date().toDateString();
  };

  // ── render ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading availability…</Text>
      </View>
    );
  }

  const selectedCount = selectedUserIds.size;

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>

      {/* ── Member filter chips (group mode) ───────────────────────── */}
      {!isSingleFriend && allUsers.length > 0 && (
        <View style={styles.filterSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {/* "All" shortcut */}
            <TouchableOpacity
              style={[
                styles.chip,
                selectedCount === allUsers.length && styles.chipActive,
              ]}
              onPress={() => setSelectedUserIds(new Set(allUsers.map(u => u.id)))}
            >
              <Text style={[
                styles.chipText,
                selectedCount === allUsers.length && styles.chipTextActive,
              ]}>All ({allUsers.length})</Text>
            </TouchableOpacity>

            {allUsers.map(u => (
              <TouchableOpacity
                key={u.id}
                style={[
                  styles.chip,
                  selectedUserIds.has(u.id) && styles.chipActive,
                  !u.hasScheduleAccess && styles.chipDisabled,
                ]}
                onPress={() => toggleUser(u.id)}
              >
                <View style={[
                  styles.chipDot,
                  selectedUserIds.has(u.id) ? styles.chipDotActive : styles.chipDotInactive,
                ]} />
                <Text style={[
                  styles.chipText,
                  selectedUserIds.has(u.id) && styles.chipTextActive,
                  !u.hasScheduleAccess && styles.chipTextDisabled,
                ]}>{u.name.split(' ')[0]}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Single-friend banner ───────────────────────────────────── */}
      {isSingleFriend && (
        <View style={styles.singleFriendBanner}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarLetter}>
              {(params as any).userName?.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.bannerName}>{(params as any).userName}</Text>
            <Text style={styles.bannerSub}>
              {allUsers[0]?.hasScheduleAccess
                ? 'Showing their planned sessions'
                : 'Schedule not shared'}
            </Text>
          </View>
        </View>
      )}

      {/* ── Week navigation ────────────────────────────────────────── */}
      <View style={styles.weekNav}>
        <TouchableOpacity onPress={goToPrevWeek} style={styles.weekNavBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.weekLabel}>{formatWeekRange(weekStart)}</Text>
        <TouchableOpacity onPress={goToNextWeek} style={styles.weekNavBtn}>
          <Ionicons name="chevron-forward" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* ── Offline notice ─────────────────────────────────────────── */}
      {isOffline && (
        <View style={styles.offlineNotice}>
          <Ionicons name="cloud-offline-outline" size={12} color={colors.textMuted} />
          <Text style={styles.offlineNoticeText}>Availability may be outdated — you're offline</Text>
        </View>
      )}

      {/* ── Heat map ────────────────────────────────────────────────── */}
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Day header row */}
        <View style={styles.dayHeaderRow}>
          <View style={styles.timeGutter} />
          {DAY_LABELS.map((label, idx) => (
            <View key={label} style={styles.dayHeaderCell}>
              <Text style={styles.dayLabel}>{label}</Text>
              <View style={[
                styles.dayNumber,
                isToday(idx) && styles.dayNumberToday,
              ]}>
                <Text style={[
                  styles.dayNumberText,
                  isToday(idx) && styles.dayNumberTextToday,
                ]}>{getDayDate(idx)}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Hour rows */}
        {HOURS.map(hour => (
          <View key={hour} style={styles.hourRow}>
            <Text style={styles.hourLabel}>{formatHour(hour)}</Text>
            {DAY_LABELS.map((_, dayOffset) => {
              const slot = heatMap[`${dayOffset}-${hour}`];
              if (!slot) return <View key={dayOffset} style={styles.cell} />;

              const accessible = slot.freeUsers.length + slot.busyUsers.length;
              const color = getHeatColor(slot.freeUsers.length, accessible);
              const allFree = accessible > 0 && slot.freeUsers.length === accessible;

              const hasMyConflict = mySlotHasConflict(dayOffset, hour);

              return (
                <TouchableOpacity
                  key={dayOffset}
                  style={[
                    styles.cell,
                    { backgroundColor: color },
                    hasMyConflict && styles.cellMyConflict,
                  ]}
                  onPress={() => handleSlotPress(slot)}
                  activeOpacity={0.7}
                >
                  {accessible > 1 && slot.freeUsers.length > 0 && (
                    <Text style={styles.cellCount}>{slot.freeUsers.length}</Text>
                  )}
                  {allFree && accessible === 1 && (
                    <Ionicons name="checkmark" size={10} color={colors.background} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: colors.surfaceElevated }]} />
            <Text style={styles.legendText}>Busy / unknown</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: 'rgba(63,245,133,0.4)' }]} />
            <Text style={styles.legendText}>Some free</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: 'rgba(63,245,133,0.92)' }]} />
            <Text style={styles.legendText}>All free</Text>
          </View>
          {myBusyBlocks.length > 0 && (
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, styles.legendSwatchConflict]} />
              <Text style={styles.legendText}>Your conflict</Text>
            </View>
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── Slot detail modal ──────────────────────────────────────── */}
      <Modal
        visible={!!selectedSlot}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedSlot(null)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setSelectedSlot(null)}
        >
          <View style={styles.slotModal} onStartShouldSetResponder={() => true}>
            {selectedSlot && (() => {
              const d = new Date(weekStart);
              d.setDate(weekStart.getDate() + selectedSlot.dayOffset);
              const dayStr = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
              const timeStr = `${formatHour(selectedSlot.hour)}–${formatHour(selectedSlot.hour + 1)}`;
              const accessible = selectedSlot.freeUsers.length + selectedSlot.busyUsers.length;

              return (
                <>
                  <View style={styles.slotModalHeader}>
                    <Text style={styles.slotTitle}>{dayStr}</Text>
                    <Text style={styles.slotTime}>{timeStr}</Text>
                    <TouchableOpacity onPress={() => setSelectedSlot(null)}>
                      <Ionicons name="close" size={22} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>

                  {selectedSlot.freeUsers.length > 0 && (
                    <View style={styles.slotSection}>
                      <Text style={styles.slotSectionLabel}>
                        Free ({selectedSlot.freeUsers.length})
                      </Text>
                      {selectedSlot.freeUsers.map(uid => (
                        <View key={uid} style={styles.slotUserRow}>
                          <View style={styles.statusDotFree} />
                          <Text style={styles.slotUserName}>{getUserName(uid)}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {selectedSlot.busyUsers.length > 0 && (
                    <View style={styles.slotSection}>
                      <Text style={styles.slotSectionLabel}>
                        Busy ({selectedSlot.busyUsers.length})
                      </Text>
                      {selectedSlot.busyUsers.map(uid => (
                        <View key={uid} style={styles.slotUserRow}>
                          <View style={styles.statusDotBusy} />
                          <Text style={[styles.slotUserName, { color: colors.textMuted }]}>
                            {getUserName(uid)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {selectedSlot.noAccessUsers.length > 0 && (
                    <View style={styles.slotSection}>
                      <Text style={[styles.slotSectionLabel, { color: colors.textFaded }]}>
                        Schedule hidden
                      </Text>
                    </View>
                  )}

                  {accessible > 0 && selectedSlot.freeUsers.length > 0 && (
                    <TouchableOpacity
                      style={styles.inviteBtn}
                      onPress={handleInvitePress}
                    >
                      <Ionicons name="person-add-outline" size={16} color={colors.background} />
                      <Text style={styles.inviteBtnText}>
                        {isOffline
                          ? 'Queue invite — sends when online'
                          : `Invite ${selectedSlot.freeUsers.length === 1
                              ? getUserName(selectedSlot.freeUsers[0])
                              : `${selectedSlot.freeUsers.length} friends`} to climb`}
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              );
            })()}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Workout creation modal ─────────────────────────────────── */}
      <WorkoutCreationModal
        visible={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onSave={handleSaveWorkout}
        onDelete={() => setShowInviteModal(false)}
        selectedDate={inviteDate}
        selectedHour={inviteHour}
        selectedMinute={0}
        editingWorkout={null}
        preselectedFriendIds={
          selectedSlot
            ? selectedSlot.freeUsers
            : allUsers
                .filter(u => selectedUserIds.has(u.id))
                .map(u => u.id)
        }
      />
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const CELL_HEIGHT = 34;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    gap: 12,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 14,
  },

  // Filter chips
  filterSection: {
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    paddingVertical: 10,
  },
  chipRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 5,
  },
  chipActive: {
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primaryMuted,
  },
  chipDisabled: {
    opacity: 0.45,
  },
  chipDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  chipDotActive: {
    backgroundColor: colors.primary,
  },
  chipDotInactive: {
    backgroundColor: colors.textFaded,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textMuted,
  },
  chipTextActive: {
    color: colors.primary,
  },
  chipTextDisabled: {
    color: colors.textFaded,
  },

  // Single friend banner
  singleFriendBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  bannerName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  bannerSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },

  // Offline notice
  offlineNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 5,
    backgroundColor: colors.surfaceElevated,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  offlineNoticeText: {
    color: colors.textMuted,
    fontSize: 11,
  },

  // Week nav
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  weekNavBtn: {
    padding: 6,
  },
  weekLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },

  // Grid
  dayHeaderRow: {
    flexDirection: 'row',
    paddingTop: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    backgroundColor: colors.background,
  },
  timeGutter: {
    width: 42,
  },
  dayHeaderCell: {
    flex: 1,
    alignItems: 'center',
  },
  dayLabel: {
    fontSize: 9,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  dayNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayNumberToday: {
    backgroundColor: colors.secondary,
  },
  dayNumberText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  dayNumberTextToday: {
    color: colors.background,
  },

  hourRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(250,237,202,0.06)',
  },
  hourLabel: {
    width: 42,
    paddingLeft: 6,
    fontSize: 9,
    color: colors.textFaded,
    textAlign: 'right',
    paddingRight: 6,
  },
  cell: {
    flex: 1,
    height: CELL_HEIGHT,
    margin: 1.5,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cellMyConflict: {
    borderWidth: 2,
    borderColor: '#f5503f',
  },
  cellCount: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.background,
  },

  // Legend
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legendSwatchConflict: {
    backgroundColor: 'rgba(245, 80, 63, 0.35)',
    borderWidth: 2,
    borderColor: '#f5503f',
  },
  legendText: {
    fontSize: 10,
    color: colors.textMuted,
  },

  // Slot modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  slotModal: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
    gap: 4,
  },
  slotModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  slotTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  slotTime: {
    fontSize: 13,
    color: colors.secondary,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  slotSection: {
    marginBottom: 10,
  },
  slotSectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  slotUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  statusDotFree: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  statusDotBusy: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.error,
  },
  slotUserName: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 20,
  },
  inviteBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.background,
  },
});

export default FindTimeScreen;
