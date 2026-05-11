import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  useNavigation,
  useRoute,
  RouteProp,
  NavigationProp,
  ParamListBase,
  useFocusEffect,
} from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { climbingAreasApi, userAreaPlansApi, tripInvitationsApi, userApi } from '../services/api';
import { ClimbingArea, UserAreaPlan, TripInvitation } from '../types';
import AreaFeed from '../components/AreaFeed';
import Button from '../components/Button';
import BelayerRequestModal from '../components/BelayerRequestModal';
import PlanTripModal from '../components/PlanTripModal';
import InviteFriendsToTripModal from '../components/InviteFriendsToTripModal';
import { GroupsStackParamList } from '../types';
import { colors } from '../theme/colors';
import {
  clusterAreaPlans,
  formatTripClusterLabel,
  tripClusterKey,
} from '../utils/tripClusterUtils';

type AreaDetailRouteProp = RouteProp<GroupsStackParamList, 'AreaDetail'>;

const AreaDetailScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const route = useRoute<AreaDetailRouteProp>();
  const { areaId, highlightTripInvitationId } = route.params;
  const { user } = useAuth();
  const { followArea, unfollowArea, followedAreas, friends } = useApp();
  const [area, setArea] = useState<ClimbingArea | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBelayerRequestModal, setShowBelayerRequestModal] = useState(false);
  const [showPlanTripModal, setShowPlanTripModal] = useState(false);
  const [inviteTrip, setInviteTrip] = useState<UserAreaPlan | null>(null);
  const [myPlans, setMyPlans] = useState<UserAreaPlan[]>([]);
  const [friendsPlans, setFriendsPlans] = useState<{ plan: UserAreaPlan; inviterName?: string }[]>([]);
  const [pendingTripInvites, setPendingTripInvites] = useState<
    (TripInvitation & { trip?: UserAreaPlan })[]
  >([]);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [clusterNameById, setClusterNameById] = useState<Record<string, string>>({});

  const scheduleFriends = useMemo(
    () => friends.filter((f) => f.privacySettings?.shareSchedule === true),
    [friends]
  );

  const isFollowing = followedAreas.some((a) => a.id === areaId);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const a = await climbingAreasApi.getById(areaId);
        if (!cancelled) setArea(a);
      } catch (e) {
        if (!cancelled) Alert.alert('Error', 'Failed to load area');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [areaId]);

  const loadPlans = async () => {
    if (!user?.id || !areaId) return;
    try {
      const mine = await userAreaPlansApi
        .getByUser(user.id)
        .then((plans) => plans.filter((p) => p.areaId === areaId));
      setMyPlans(mine);
      const today = new Date().toISOString().slice(0, 10);
      const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const start =
        mine.length > 0
          ? mine.reduce((a, p) => (p.startDate < a ? p.startDate : a), mine[0].startDate)
          : today;
      const end =
        mine.length > 0
          ? mine.reduce((a, p) => (p.endDate > a ? p.endDate : a), mine[0].endDate)
          : future;
      const fp = await userAreaPlansApi.getFriendsPlansAtArea(user.id, areaId, start, end);
      setFriendsPlans(fp || []);
    } catch {
      setMyPlans([]);
      setFriendsPlans([]);
    }
  };

  const loadPendingInvites = useCallback(async () => {
    if (!user?.id) return;
    try {
      const all = await tripInvitationsApi.getByInvitee(user.id);
      const here = all.filter(
        (i) => i.status === 'invited' && i.trip?.areaId === areaId
      );
      if (highlightTripInvitationId) {
        here.sort((a, b) => {
          if (a.id === highlightTripInvitationId) return -1;
          if (b.id === highlightTripInvitationId) return 1;
          return 0;
        });
      }
      setPendingTripInvites(here);
    } catch {
      setPendingTripInvites([]);
    }
  }, [user?.id, areaId, highlightTripInvitationId]);

  useEffect(() => {
    if (areaId && user?.id) loadPlans();
  }, [areaId, user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadPendingInvites();
    }, [loadPendingInvites])
  );

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
      setClusterNameById(base);
      return;
    }
    let cancelled = false;
    userApi.getNamesForIds(missing).then((fetched) => {
      if (!cancelled) setClusterNameById({ ...base, ...fetched });
    });
    return () => {
      cancelled = true;
    };
  }, [user, myPlans, friendsPlans, scheduleFriends]);

  const myTripClusters = useMemo(() => {
    if (!user?.id) return [];
    const allPlans = [
      ...myPlans,
      ...friendsPlans.map((x) => x.plan),
    ];
    return clusterAreaPlans(allPlans).filter((c) =>
      c.some((p) => p.userId === user.id)
    );
  }, [user?.id, myPlans, friendsPlans]);

  const friendsOnlyTripClusters = useMemo(() => {
    if (!user?.id) return [];
    const allPlans = [
      ...myPlans,
      ...friendsPlans.map((x) => x.plan),
    ];
    return clusterAreaPlans(allPlans).filter(
      (c) => !c.some((p) => p.userId === user.id)
    );
  }, [user?.id, myPlans, friendsPlans]);

  const inviterName = (inviterUserId: string) =>
    friends.find((f) => f.id === inviterUserId)?.name ?? 'A friend';

  const handleAcceptInvite = async (inv: TripInvitation & { trip?: UserAreaPlan }) => {
    if (!inv.trip) {
      Alert.alert('Error', 'Trip details unavailable. Try again later.');
      return;
    }
    setRespondingId(inv.id);
    try {
      const { planAdded } = await tripInvitationsApi.acceptAndMirrorTrip(
        inv.id,
        user!.id,
        inv.trip
      );
      await loadPendingInvites();
      await loadPlans();
      if (planAdded) {
        Alert.alert(
          'Accepted',
          'This trip is on your schedule for this area. Open Friend calendar to see My trip.'
        );
      } else {
        Alert.alert(
          'Accepted',
          'You’re on the trip. We couldn’t copy dates to your calendar — use Plan a trip below if needed.'
        );
      }
    } catch {
      Alert.alert('Error', 'Could not accept invitation');
    } finally {
      setRespondingId(null);
    }
  };

  const handleDeclineInvite = (invitationId: string) => {
    Alert.alert('Decline invitation?', 'You can still plan a trip here on your own.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Decline',
        style: 'destructive',
        onPress: async () => {
          setRespondingId(invitationId);
          try {
            await tripInvitationsApi.respond(invitationId, 'declined');
            await loadPendingInvites();
          } catch {
            Alert.alert('Error', 'Could not update invitation');
          } finally {
            setRespondingId(null);
          }
        },
      },
    ]);
  };

  const handleFollowToggle = async () => {
    try {
      if (isFollowing) await unfollowArea(areaId);
      else await followArea(areaId);
    } catch {
      Alert.alert('Error', 'Failed to update follow');
    }
  };

  if (loading || !area) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {area.name}
        </Text>
      </View>

      <AreaFeed
        areaId={areaId}
        listHeaderComponent={
          <>
            {pendingTripInvites.length > 0 && (
              <View style={styles.inviteSection}>
                <Text style={styles.inviteSectionTitle}>Trip invitations</Text>
                {pendingTripInvites.map((inv) => (
                  <View
                    key={inv.id}
                    style={[
                      styles.inviteCard,
                      highlightTripInvitationId === inv.id && styles.inviteCardHighlight,
                    ]}
                  >
                    <Text style={styles.inviteHeadline}>
                      {inviterName(inv.inviterUserId)} invited you on a trip
                    </Text>
                    {inv.trip ? (
                      <Text style={styles.inviteDates}>
                        {inv.trip.startDate} – {inv.trip.endDate}
                      </Text>
                    ) : null}
                    {inv.comment ? (
                      <Text style={styles.inviteComment}>“{inv.comment}”</Text>
                    ) : null}
                    <View style={styles.inviteRow}>
                      <Button
                        title="Decline"
                        variant="outline"
                        onPress={() => handleDeclineInvite(inv.id)}
                        disabled={respondingId === inv.id}
                        style={styles.inviteBtnHalf}
                      />
                      <Button
                        title={respondingId === inv.id ? '…' : 'Accept'}
                        onPress={() => handleAcceptInvite(inv)}
                        disabled={respondingId === inv.id}
                        style={styles.inviteBtnHalf}
                      />
                    </View>
                    <TouchableOpacity
                      onPress={() => setShowPlanTripModal(true)}
                      style={styles.planOwnLink}
                    >
                      <Text style={styles.planOwnLinkText}>
                        Plan my own dates for this area
                      </Text>
                      <Ionicons name="chevron-forward" size={18} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.areaMeta}>
              {area.region || area.country ? (
                <Text style={styles.areaMetaText}>
                  {[area.region, area.country].filter(Boolean).join(', ')}
                </Text>
              ) : null}
              <TouchableOpacity onPress={handleFollowToggle} style={styles.followButton}>
                <Ionicons
                  name={isFollowing ? 'heart' : 'heart-outline'}
                  size={20}
                  color={isFollowing ? colors.primary : colors.textSecondary}
                />
                <Text style={[styles.followText, isFollowing && styles.followTextActive]}>
                  {isFollowing ? ' Following ' : 'Follow area'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.actionBar}>
              <Button
                title="Friend calendar"
                onPress={() =>
                  navigation.navigate('AreaFriendCalendar', {
                    areaId,
                    areaName: area.name,
                  })
                }
                style={styles.secondaryButton}
              />
              <Button
                title="Plan a trip"
                onPress={() => setShowPlanTripModal(true)}
                style={styles.secondaryButton}
              />
              <Button
                title="New belayer request"
                onPress={() => setShowBelayerRequestModal(true)}
                style={styles.primaryButton}
              />
            </View>

            {myTripClusters.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>My trips</Text>
                {myTripClusters.map((group) => {
                  const rep = group[0];
                  const myPlan =
                    group.find((p) => p.userId === user!.id) ?? rep;
                  const whoLabel = formatTripClusterLabel({
                    viewerUserId: user!.id,
                    viewerName: user?.name || 'You',
                    friends: scheduleFriends,
                    memberPlans: group,
                    nameById: clusterNameById,
                  });
                  const mergedNotes = group
                    .map((p) => p.notes)
                    .filter(Boolean)
                    .join('\n');
                  return (
                    <View key={tripClusterKey(rep)} style={styles.planRow}>
                      <Text style={styles.planDates}>
                        {rep.startDate} – {rep.endDate}
                      </Text>
                      <Text style={styles.tripWhoLine}>{whoLabel}</Text>
                      {mergedNotes ? (
                        <Text style={styles.planNotes}>{mergedNotes}</Text>
                      ) : null}
                      <TouchableOpacity
                        onPress={() => setInviteTrip(myPlan)}
                        style={styles.inviteLink}
                      >
                        <Text style={styles.inviteLinkText}>Invite friends</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}

            {friendsOnlyTripClusters.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Friends’ trips here</Text>
                {friendsOnlyTripClusters.map((group) => {
                  const rep = group[0];
                  const whoLabel = formatTripClusterLabel({
                    viewerUserId: user!.id,
                    viewerName: user?.name || 'You',
                    friends: scheduleFriends,
                    memberPlans: group,
                    nameById: clusterNameById,
                  });
                  const mergedNotes = group
                    .map((p) => p.notes)
                    .filter(Boolean)
                    .join('\n');
                  return (
                    <View key={tripClusterKey(rep)} style={styles.planRow}>
                      <Text style={styles.planDates}>
                        {rep.startDate} – {rep.endDate}
                      </Text>
                      <Text style={styles.tripWhoLine}>{whoLabel}</Text>
                      {mergedNotes ? (
                        <Text style={styles.planNotes}>{mergedNotes}</Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}
          </>
        }
      />

      <PlanTripModal
        visible={showPlanTripModal}
        onClose={() => setShowPlanTripModal(false)}
        areaId={areaId}
        areaName={area?.name ?? ''}
        onSuccess={() => {
          loadPlans();
          loadPendingInvites();
        }}
      />

      {inviteTrip && (
        <InviteFriendsToTripModal
          visible={!!inviteTrip}
          onClose={() => setInviteTrip(null)}
          trip={inviteTrip}
          areaName={area.name}
          onSuccess={loadPlans}
        />
      )}

      <BelayerRequestModal
        visible={showBelayerRequestModal}
        onClose={() => setShowBelayerRequestModal(false)}
        onSuccess={() => setShowBelayerRequestModal(false)}
        initialAreaId={areaId}
        contextName={area.name}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textMuted,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary,
    flex: 1,
    textAlign: 'center',
  },
  inviteSection: {
    padding: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  inviteSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  inviteCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inviteCardHighlight: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  inviteHeadline: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  inviteDates: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  inviteComment: {
    fontSize: 14,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  inviteRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  inviteBtnHalf: { flex: 1 },
  planOwnLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  planOwnLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  areaMeta: {
    padding: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  areaMetaText: { fontSize: 14, color: colors.textSecondary },
  followButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  followText: { fontSize: 14, color: colors.textSecondary },
  followTextActive: { color: colors.primary },
  actionBar: {
    padding: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 10,
  },
  primaryButton: { marginBottom: 0 },
  secondaryButton: { marginBottom: 0 },
  section: {
    padding: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: colors.text,
  },
  planRow: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  planDates: { fontSize: 15, fontWeight: '500', color: colors.text },
  planNotes: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  friendName: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  tripWhoLine: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 20,
  },
  inviteLink: { marginTop: 6 },
  inviteLinkText: { fontSize: 14, color: colors.primary },
});

export default AreaDetailScreen;
