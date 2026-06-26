import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
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
import { useNetwork } from '../context/NetworkContext';
import { climbingAreasApi, userAreaPlansApi, tripInvitationsApi, userApi, userAreaVisitsApi } from '../services/api';
import { ClimbingArea, UserAreaPlan, TripInvitation, FindStackParamList } from '../types';
import AreaFeed from '../components/AreaFeed';
import Button from '../components/Button';
import BelayerRequestModal from '../components/BelayerRequestModal';
import PlanTripModal from '../components/PlanTripModal';
import InviteFriendsToTripModal from '../components/InviteFriendsToTripModal';
import { colors } from '../theme/colors';
import { fetchWeather, WeatherData } from '../services/weather';
import {
  clusterAreaPlans,
  formatTripClusterLabel,
  tripClusterKey,
} from '../utils/tripClusterUtils';

type AreaDetailRouteProp = RouteProp<FindStackParamList, 'AreaDetail'>;

const AreaDetailScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const route = useRoute<AreaDetailRouteProp>();
  const { areaId, highlightTripInvitationId } = route.params;
  const { user } = useAuth();
  const { followArea, unfollowArea, followedAreas, friends } = useApp();
  const { isOffline } = useNetwork();
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
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [friendsHereIds, setFriendsHereIds] = useState<string[]>([]);

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

  // Load weather once we have the area's coordinates
  useEffect(() => {
    if (!area?.latitude || !area?.longitude) return;
    fetchWeather(area.latitude, area.longitude).then((w) => { if (w) setWeather(w); });
  }, [area?.id]);

  // Load friends currently at this area
  useEffect(() => {
    if (!user?.id || !areaId) return;
    userAreaVisitsApi.getFriendsAtArea(user.id, areaId).then(setFriendsHereIds).catch(() => {});
  }, [user?.id, areaId]);

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
      {isOffline && (
        <View style={styles.offlineNotice}>
          <Ionicons name="cloud-offline-outline" size={14} color={colors.textMuted} />
          <Text style={styles.offlineNoticeText}>Showing saved data — you're offline.</Text>
        </View>
      )}

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

            {/* Weather */}
            {weather && (
              <View style={styles.weatherCard}>
                <View style={styles.weatherMain}>
                  <Ionicons
                    name={weather.isDry ? 'sunny-outline' : 'rainy-outline'}
                    size={22}
                    color={weather.isDry ? '#f5a623' : colors.primary}
                  />
                  <Text style={styles.weatherTemp}>{weather.temp}°F</Text>
                  <Text style={styles.weatherDesc}>{weather.description}</Text>
                  <View style={[styles.weatherBadge, weather.isDry ? styles.weatherBadgeDry : styles.weatherBadgeWet]}>
                    <Text style={styles.weatherBadgeText}>{weather.isDry ? '✓ Dry' : '⚠ Wet'}</Text>
                  </View>
                </View>
                <Text style={styles.weatherDetails}>
                  {weather.humidity}% humidity · {weather.windSpeed} mph wind
                </Text>
              </View>
            )}

            {/* Friends at this crag now */}
            {friendsHereIds.length > 0 && (
              <View style={styles.friendsHereSection}>
                <Text style={styles.sectionTitle}>
                  Friends here now ({friendsHereIds.length})
                </Text>
                {friendsHereIds.map((fId) => {
                  const friend = friends.find((f) => f.id === fId);
                  if (!friend) return null;
                  return (
                    <TouchableOpacity
                      key={fId}
                      style={styles.friendHereRow}
                      onPress={() => (navigation as any).navigate('FriendProfile', { userId: fId })}
                    >
                      {friend.avatar ? (
                        <Image source={{ uri: friend.avatar }} style={styles.friendHereAvatar} />
                      ) : (
                        <View style={styles.friendHereAvatarPlaceholder}>
                          <Text style={styles.friendHereAvatarText}>{friend.name.charAt(0)}</Text>
                        </View>
                      )}
                      <Text style={styles.friendHereName}>{friend.name}</Text>
                      <Ionicons name="chevron-forward" size={16} color={colors.textFaded} />
                    </TouchableOpacity>
                  );
                })}
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
                  {isOffline
                    ? (isFollowing ? 'Following (syncing)' : 'Follow (will sync)')
                    : (isFollowing ? ' Following ' : 'Follow area')}
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
  offlineNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 14,
    backgroundColor: colors.surfaceElevated,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  offlineNoticeText: {
    fontSize: 12,
    color: colors.textMuted,
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
  weatherCard: {
    padding: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  weatherMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  weatherTemp: { fontSize: 20, fontWeight: '700', color: colors.text },
  weatherDesc: { fontSize: 14, color: colors.textSecondary, flex: 1 },
  weatherBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  weatherBadgeDry: { backgroundColor: '#colors.primary' },
  weatherBadgeWet: { backgroundColor: '#colors.primary' },
  weatherBadgeText: { fontSize: 12, fontWeight: '600', color: colors.text },
  weatherDetails: { fontSize: 12, color: colors.textMuted },
  friendsHereSection: {
    padding: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  friendHereRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  friendHereAvatar: { width: 32, height: 32, borderRadius: 16 },
  friendHereAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendHereAvatarText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  friendHereName: { flex: 1, fontSize: 14, color: colors.text },
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
