import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { userAreaPlansApi, userApi } from '../services/api';
import { GroupsStackParamList, UserAreaPlan, WorkoutSession } from '../types';
import CalendarHeader from '../components/CalendarHeader';
import CalendarGrid from '../components/CalendarGrid';
import PlanTripModal from '../components/PlanTripModal';
import { getCalendarView } from '../utils/calendarUtils';
import {
  clusterAreaPlans,
  formatTripClusterLabel,
} from '../utils/tripClusterUtils';
import { colors } from '../theme/colors';

type Route = RouteProp<GroupsStackParamList, 'AreaFriendCalendar'>;

function clusterToSpanningSession(
  group: UserAreaPlan[],
  viewerUserId: string,
  title: string
): WorkoutSession {
  const rep = group[0];
  const viewerIn = group.some((p) => p.userId === viewerUserId);
  const idPrefix = viewerIn ? 'cluster-my-' : 'cluster-f-';
  const id = `${idPrefix}${rep.areaId}-${rep.startDate}-${rep.endDate}`;
  const notesParts = group.map((p) => p.notes).filter(Boolean) as string[];
  return {
    id,
    startTime: new Date(rep.startDate + 'T12:00:00'),
    endTime: new Date(rep.endDate + 'T12:00:00'),
    spanningEndDate: rep.endDate,
    workoutType: 'recovery',
    climbingType: 'any',
    title,
    notes: notesParts.length ? notesParts.join('\n') : undefined,
    isRecurring: false,
    status: 'planned',
    createdAt: rep.createdAt,
    updatedAt: rep.updatedAt,
    tripClusterMemberIds: group.map((p) => p.userId),
  };
}

const AreaFriendCalendarScreen: React.FC = () => {
  const route = useRoute<Route>();
  const { areaId, areaName } = route.params;
  const { user } = useAuth();
  const { friends } = useApp();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [friendsPlans, setFriendsPlans] = useState<{ plan: UserAreaPlan; inviterName?: string }[]>([]);
  const [myPlans, setMyPlans] = useState<UserAreaPlan[]>([]);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [nameById, setNameById] = useState<Record<string, string>>({});

  const scheduleFriends = useMemo(
    () => friends.filter((f) => f.privacySettings?.shareSchedule === true),
    [friends]
  );

  const load = useCallback(async () => {
    if (!user?.id) return;
    const from = new Date();
    from.setFullYear(from.getFullYear() - 1);
    const to = new Date();
    to.setFullYear(to.getFullYear() + 1);
    const startStr = from.toISOString().slice(0, 10);
    const endStr = to.toISOString().slice(0, 10);
    try {
      const [fp, allMine] = await Promise.all([
        userAreaPlansApi.getFriendsPlansAtArea(user.id, areaId, startStr, endStr),
        userAreaPlansApi.getByUser(user.id),
      ]);
      setFriendsPlans(fp || []);
      setMyPlans((allMine || []).filter((p) => p.areaId === areaId));
    } catch {
      setFriendsPlans([]);
      setMyPlans([]);
    }
  }, [user?.id, areaId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!user?.id) return;
    const allPlans = [
      ...myPlans,
      ...friendsPlans.map((x) => x.plan),
    ];
    const clusters = clusterAreaPlans(allPlans);
    const ids = [...new Set(clusters.flatMap((c) => c.map((p) => p.userId)))];
    const missing = ids.filter(
      (id) => id !== user.id && !scheduleFriends.some((f) => f.id === id)
    );
    const base: Record<string, string> = {};
    base[user.id] = user.name || 'You';
    scheduleFriends.forEach((f) => {
      base[f.id] = f.name;
    });
    if (missing.length === 0) {
      setNameById(base);
      return;
    }
    let cancelled = false;
    userApi.getNamesForIds(missing).then((fetched) => {
      if (!cancelled) setNameById({ ...base, ...fetched });
    });
    return () => {
      cancelled = true;
    };
  }, [user, myPlans, friendsPlans, scheduleFriends]);

  const workouts = useMemo((): WorkoutSession[] => {
    if (!user?.id) return [];
    const allPlans = [
      ...myPlans,
      ...friendsPlans.map((x) => x.plan),
    ];
    const clusters = clusterAreaPlans(allPlans);
    return clusters.map((group) => {
      const title = formatTripClusterLabel({
        viewerUserId: user.id,
        viewerName: user.name || 'You',
        friends: scheduleFriends,
        memberPlans: group,
        nameById,
      });
      return clusterToSpanningSession(group, user.id, title);
    });
  }, [user, myPlans, friendsPlans, scheduleFriends, nameById]);

  const calendarView = useMemo(
    () => getCalendarView('month', currentDate),
    [currentDate]
  );

  const handleWorkoutPress = (w: WorkoutSession) => {
    const withLine =
      w.tripClusterMemberIds?.length &&
      w.tripClusterMemberIds
        .map((id) => nameById[id] || id)
        .join(', ');
    const body = [
      w.notes,
      withLine ? `With: ${withLine}` : null,
      areaName,
    ]
      .filter(Boolean)
      .join('\n\n');
    if (w.id.startsWith('cluster-my-')) {
      Alert.alert(w.title, body || `Your trip at ${areaName}`);
      return;
    }
    Alert.alert(w.title, body || `Trip at ${areaName}`);
  };

  return (
    <View style={styles.container}>
      <CalendarHeader
        currentView={calendarView}
        onViewChange={() => {}}
        onDateChange={setCurrentDate}
        onAddWorkout={() => setShowPlanModal(true)}
        variant="areaTripsMonth"
        addAccessibilityLabel="Plan my trip to this area"
      />
      <CalendarGrid
        currentDate={currentDate}
        workouts={workouts}
        onTimeSlotPress={() => {}}
        onWorkoutPress={handleWorkoutPress}
        viewType="month"
        monthSpanMaxVisibleLanes={4}
      />
      <PlanTripModal
        visible={showPlanModal}
        onClose={() => setShowPlanModal(false)}
        areaId={areaId}
        areaName={areaName}
        onSuccess={() => {
          load();
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});

export default AreaFriendCalendarScreen;
