import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useNetwork } from '../context/NetworkContext';
import { colors } from '../theme/colors';
import {
  userAreaPlansApi,
  tripInvitationsApi,
  areaFeedApi,
} from '../services/api';
import {
  User,
  Presence,
  Gym,
  ClimbingArea,
  UserAreaPlan,
  UserAreaVisit,
  TripInvitation,
  AreaFeedPost,
} from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function wmoToDesc(code: number): string {
  if (code === 0) return 'Clear sky';
  if (code <= 3) return 'Partly cloudy';
  if (code <= 9) return 'Foggy';
  if (code <= 29) return 'Drizzle';
  if (code <= 39) return 'Rain';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Rain showers';
  if (code <= 86) return 'Snow showers';
  if (code <= 99) return 'Thunderstorm';
  return 'Unknown';
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function relativeTime(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function dateRange(start: string, end: string): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const s = new Date(start).toLocaleDateString('en-US', opts);
  const e = new Date(end).toLocaleDateString('en-US', opts);
  return start === end ? s : `${s}–${e}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface WeatherData {
  temp: number;
  description: string;
  windSpeed: number;
  humidity: number;
  isDry: boolean;
}

interface FriendPresenceItem {
  friend: User;
  locationType: 'gym' | 'crag';
  locationName: string;
  locationId: string;
  openToJoin: boolean;
}

type TripInviteWithPlan = TripInvitation & { trip?: UserAreaPlan };
type FriendPlan = { plan: UserAreaPlan; friendName?: string; areaName?: string };

// ─── Component ────────────────────────────────────────────────────────────────

const HomeScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { isOffline } = useNetwork();
  const {
    friends,
    presence,
    followedGyms,
    followedAreas,
    gyms,
    climbingAreas,
    schedules,
    checkIn,
    activeAreaVisits,
    checkInArea,
    checkOutArea,
    refreshData,
    isLoading,
  } = useApp();

  // ── Local state ──
  const [refreshing, setRefreshing] = useState(false);
  const [showGoingModal, setShowGoingModal] = useState(false);
  const [goingLocation, setGoingLocation] = useState<{
    type: 'gym' | 'area';
    id: string;
    name: string;
  } | null>(null);
  const [goingOpenToJoin, setGoingOpenToJoin] = useState(true);
  const [goingSubmitting, setGoingSubmitting] = useState(false);

  const [weatherByAreaId, setWeatherByAreaId] = useState<Record<string, WeatherData>>({});
  const [tripInvitations, setTripInvitations] = useState<TripInviteWithPlan[]>([]);
  const [friendsPlans, setFriendsPlans] = useState<FriendPlan[]>([]);
  const [recentPosts, setRecentPosts] = useState<AreaFeedPost[]>([]);

  // ── Weather fetch ──
  const areaIds = followedAreas.map((a) => a.id).join(',');
  useEffect(() => {
    for (const area of followedAreas) {
      if (!area.latitude || !area.longitude) continue;
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${area.latitude}&longitude=${area.longitude}&current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph`
      )
        .then((r) => r.json())
        .then((data) => {
          const c = data?.current;
          if (!c) return;
          const humidity = Math.round(c.relative_humidity_2m ?? 0);
          const windSpeed = Math.round(c.wind_speed_10m ?? 0);
          setWeatherByAreaId((prev) => ({
            ...prev,
            [area.id]: {
              temp: Math.round(c.temperature_2m ?? 0),
              description: wmoToDesc(c.weather_code ?? 0),
              windSpeed,
              humidity,
              isDry: humidity < 60 && (c.weather_code ?? 0) < 51,
            },
          }));
        })
        .catch(() => {});
    }
  }, [areaIds]);

  // ── Trips + friends' plans ──
  const loadTrips = useCallback(async () => {
    if (!user?.id) return;
    try {
      const invites = await tripInvitationsApi.getByInvitee(user.id);
      setTripInvitations(invites.filter((i) => i.status === 'invited'));

      const today = new Date().toISOString().split('T')[0];
      const twoWeeksOut = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
      const plansByArea = await Promise.all(
        followedAreas.map((area) =>
          userAreaPlansApi
            .getFriendsPlansAtArea(user.id, area.id, today, twoWeeksOut)
            .then((results) =>
              results.map((r) => ({
                plan: r.plan,
                friendName: r.inviterName,
                areaName: area.name,
              }))
            )
            .catch(() => [] as FriendPlan[])
        )
      );
      setFriendsPlans(plansByArea.flat());
    } catch (e) {
      console.error('[HomeScreen] loadTrips error', e);
    }
  }, [user?.id, areaIds]);

  // ── Friend activity feed ──
  const gymIds = followedGyms.map((g) => g.id).join(',');
  const loadPosts = useCallback(async () => {
    if (!user?.id || (followedGyms.length === 0 && followedAreas.length === 0)) return;
    try {
      const fetches = [
        ...followedGyms.map((gym) => areaFeedApi.getAreaFeed(gym.id, undefined, 10)),
        ...followedAreas.map((area) =>
          areaFeedApi.getAreaFeed(undefined, undefined, 10, undefined, area.id)
        ),
      ];
      const results = await Promise.all(fetches.map((p) => p.catch(() => [])));
      const friendIds = new Set(friends.map((f) => f.id));
      const posts = (results.flat() as AreaFeedPost[])
        .filter((p) => friendIds.has(p.authorUserId))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10);
      setRecentPosts(posts);
    } catch (e) {
      console.error('[HomeScreen] loadPosts error', e);
    }
  }, [user?.id, gymIds, areaIds, friends.length]);

  useEffect(() => {
    loadTrips();
    loadPosts();
  }, [loadTrips, loadPosts]);

  const onRefresh = useCallback(async () => {
    if (isOffline) {
      // Can't fetch fresh data while offline — keep cached content, skip spinner
      return;
    }
    setRefreshing(true);
    await Promise.all([refreshData(), loadTrips(), loadPosts()]);
    setRefreshing(false);
  }, [isOffline, refreshData, loadTrips, loadPosts]);

  // ── Derived: friends out today ──
  const gymMap = useMemo(() => new Map(gyms.map((g) => [g.id, g])), [gyms]);

  const friendsOut = useMemo((): FriendPresenceItem[] => {
    const friendSet = new Map(friends.map((f) => [f.id, f]));
    const areaMap = new Map(climbingAreas.map((a) => [a.id, a]));

    const fromGyms = presence
      .filter((p) => p.isActive && friendSet.has(p.userId))
      .map((p) => ({
        friend: friendSet.get(p.userId)!,
        locationType: 'gym' as const,
        locationName: gymMap.get(p.gymId)?.name ?? 'Gym',
        locationId: p.gymId,
        openToJoin: p.openToJoin !== false,
      }));

    const alreadyShown = new Set(fromGyms.map((f) => f.friend.id));
    const fromCrags = activeAreaVisits
      .filter((v) => friendSet.has(v.userId) && !alreadyShown.has(v.userId))
      .map((v) => ({
        friend: friendSet.get(v.userId)!,
        locationType: 'crag' as const,
        locationName: areaMap.get(v.areaId)?.name ?? 'Crag',
        locationId: v.areaId,
        openToJoin: true,
      }));

    return [...fromGyms, ...fromCrags];
  }, [presence, activeAreaVisits, friends, gymMap, climbingAreas]);

  const myActivePresence = useMemo(
    () =>
      presence.find((p) => p.userId === user?.id && p.isActive) ||
      activeAreaVisits.find((v) => v.userId === user?.id),
    [presence, activeAreaVisits, user?.id]
  );

  // ── "I'm going" submit ──
  const handleGoingSubmit = useCallback(async () => {
    if (!goingLocation || !user?.id) return;
    setGoingSubmitting(true);
    try {
      if (goingLocation.type === 'gym') {
        await checkIn(goingLocation.id, goingOpenToJoin);
      } else {
        await checkInArea(goingLocation.id);
      }
      setShowGoingModal(false);
      setGoingLocation(null);
    } catch (e) {
      console.error('[HomeScreen] going submit error', e);
    } finally {
      setGoingSubmitting(false);
    }
  }, [goingLocation, user?.id, checkIn, checkInArea]);

  // ── Today's scheduled workouts ──
  const todaySchedules = useMemo(() => {
    const now = new Date();
    const todayDate = now.toISOString().slice(0, 10);
    const todayDay = now.getDay(); // 0=Sun

    return schedules.filter((s) => {
      const startDate = new Date(s.startTime).toISOString().slice(0, 10);
      if (!s.isRecurring) {
        return startDate === todayDate;
      }
      if (s.recurringPattern === 'daily') return true;
      if (s.recurringPattern === 'weekly') {
        return new Date(s.startTime).getDay() === todayDay;
      }
      return startDate === todayDate;
    });
  }, [schedules]);

  const displayedFriends = friendsOut.slice(0, 4);
  const extraCount = Math.max(0, friendsOut.length - 4);

  const postTypeLabel = (post: AreaFeedPost): string => {
    if (post.postType === 'belayer_request') return 'Looking for a belay partner';
    if (post.postType === 'rally_pads_request') return 'Looking for pad partners';
    if (post.postType === 'trip_announcement')
      return `Planning a trip to ${post.areaName ?? post.cragName ?? 'a crag'}`;
    return post.title;
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* ── Fixed header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View>
          <Text style={styles.headerDate}>
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
          <Text style={styles.headerGreeting}>
            {greeting()}, {user?.name?.split(' ')[0] ?? 'there'}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerIconBtn} accessibilityLabel="Notifications">
            <Ionicons name="notifications-outline" size={21} color={colors.primary} />
          </TouchableOpacity>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitials}>{initials(user?.name ?? 'Me')}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* ── Offline notice ── */}
        {isOffline && (
          <View style={styles.offlineNotice}>
            <Ionicons name="cloud-offline-outline" size={13} color={colors.textMuted} />
            <Text style={styles.offlineNoticeText}>Showing saved data — you're offline</Text>
          </View>
        )}

        {/* ── "I'm going" CTA ── */}
        {!myActivePresence && (
          <TouchableOpacity
            style={styles.goingBanner}
            onPress={() => setShowGoingModal(true)}
            activeOpacity={0.8}
          >
            <View>
              <Text style={styles.goingBannerTitle}>Where are you heading?</Text>
              <Text style={styles.goingBannerSub}>Let friends know you're going out</Text>
            </View>
            <View style={styles.goingBannerBtn}>
              <Text style={styles.goingBannerBtnText}>I'm going out</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* ── Who's out today ── */}
        <View style={styles.sectionSpaced}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Who's out today</Text>
            {friendsOut.length > 0 && (
              <Text style={styles.sectionMeta}>
                {friendsOut.length} friend{friendsOut.length !== 1 ? 's' : ''}
              </Text>
            )}
          </View>

          {friendsOut.length === 0 ? (
            <View style={styles.emptyRow}>
              <Text style={styles.emptyText}>No friends are out climbing right now</Text>
            </View>
          ) : (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.presenceRow}
              >
                {displayedFriends.map((item) => (
                  <TouchableOpacity
                    key={item.friend.id}
                    style={styles.presenceItem}
                    activeOpacity={0.7}
                    onPress={() => (navigation as any).navigate('Find', { screen: 'FriendProfile', params: { userId: item.friend.id } })}
                  >
                    <View style={styles.presenceAvatarWrap}>
                      <View
                        style={[
                          styles.presenceAvatar,
                          item.openToJoin
                            ? styles.presenceAvatarOpen
                            : styles.presenceAvatarSolo,
                        ]}
                      >
                        <Text style={styles.presenceAvatarText}>
                          {initials(item.friend.name)}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.presenceDot,
                          item.openToJoin
                            ? styles.presenceDotOpen
                            : styles.presenceDotSolo,
                        ]}
                      />
                    </View>
                    <Text style={styles.presenceName} numberOfLines={1}>
                      {item.friend.name.split(' ')[0]}
                    </Text>
                    <View
                      style={[
                        styles.presenceChip,
                        item.openToJoin
                          ? styles.presenceChipOpen
                          : styles.presenceChipSolo,
                      ]}
                    >
                      <Text
                        style={[
                          styles.presenceChipText,
                          item.openToJoin
                            ? styles.presenceChipTextOpen
                            : styles.presenceChipTextSolo,
                        ]}
                      >
                        {item.openToJoin ? '+1 ok' : 'solo'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
                {extraCount > 0 && (
                  <View style={styles.presenceItem}>
                    <View style={styles.presenceMoreCircle}>
                      <Text style={styles.presenceMoreText}>+{extraCount}</Text>
                    </View>
                    <Text style={styles.presenceName}>more</Text>
                  </View>
                )}
              </ScrollView>
              <View style={styles.presenceLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
                  <Text style={styles.legendLabel}>open to join</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.secondary }]} />
                  <Text style={styles.legendLabel}>solo</Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* ── Your places ── */}
        {(followedGyms.length > 0 || followedAreas.length > 0) && (
          <View style={styles.sectionSpaced}>
            <Text style={[styles.sectionTitle, { paddingHorizontal: 20 }]}>Your places</Text>

            {followedGyms.map((gym) => {
              const friendsHere = friends.filter((f) =>
                gym.currentUsers?.includes(f.id)
              );
              return (
                <TouchableOpacity
                  key={gym.id}
                  style={[styles.placeCard, styles.placeCardGym]}
                  onPress={() => (navigation as any).navigate('Find', { screen: 'GymDetail', params: { gymId: gym.id } })}
                  activeOpacity={0.75}
                >
                  <View style={styles.placeCardTop}>
                    <View>
                      <View style={styles.placeTypeRow}>
                        <View style={[styles.placeTypeDot, { backgroundColor: colors.primary }]} />
                        <Text style={styles.placeTypeLabel}>Home gym</Text>
                      </View>
                      <Text style={styles.placeName}>{gym.name}</Text>
                    </View>
                    <View style={styles.placeCountBadgeGym}>
                      <Text style={styles.placeCountTextGym}>
                        {gym.currentUsers?.length ?? 0} here now
                      </Text>
                    </View>
                  </View>
                  {friendsHere.length > 0 && (
                    <View style={styles.placeCardBottom}>
                      <View style={styles.miniAvatarRow}>
                        {friendsHere.slice(0, 3).map((f, i) => (
                          <View
                            key={f.id}
                            style={[styles.miniAvatar, i > 0 && styles.miniAvatarOverlap]}
                          >
                            <Text style={styles.miniAvatarText}>{initials(f.name)}</Text>
                          </View>
                        ))}
                      </View>
                      <Text style={styles.placeCardBottomText}>
                        {friendsHere
                          .slice(0, 2)
                          .map((f) => f.name.split(' ')[0])
                          .join(', ')}
                        {friendsHere.length > 2 ? ` + ${friendsHere.length - 2} more` : ''} here
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}

            {followedAreas.map((area) => {
              const wx = weatherByAreaId[area.id];
              const plansHere = friendsPlans.filter((p) => p.plan.areaId === area.id).length;
              return (
                <TouchableOpacity
                  key={area.id}
                  style={[styles.placeCard, styles.placeCardCrag]}
                  onPress={() => (navigation as any).navigate('Find', { screen: 'AreaDetail', params: { areaId: area.id } })}
                  activeOpacity={0.75}
                >
                  <View style={styles.placeCardTop}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <View style={styles.placeTypeRow}>
                        <View
                          style={[styles.placeTypeDot, { backgroundColor: colors.secondary }]}
                        />
                        <Text style={styles.placeTypeLabel}>Home crag</Text>
                      </View>
                      <Text style={styles.placeName}>{area.name}</Text>
                    </View>
                    {wx ? (
                      <View style={styles.weatherBlock}>
                        <Text style={styles.weatherTemp}>{wx.temp}°</Text>
                        <Text style={styles.weatherDesc}>{wx.description}</Text>
                      </View>
                    ) : (
                      <ActivityIndicator size="small" color={colors.textMuted} />
                    )}
                  </View>
                  {wx && (
                    <View style={styles.weatherChips}>
                      <View style={styles.weatherChip}>
                        <MaterialCommunityIcons name="weather-windy" size={11} color={colors.primary} />
                        <Text style={styles.weatherChipText}>{wx.windSpeed} mph</Text>
                      </View>
                      <View style={styles.weatherChip}>
                        <Ionicons
                          name={wx.isDry ? 'sunny-outline' : 'rainy-outline'}
                          size={11}
                          color={colors.primary}
                        />
                        <Text style={styles.weatherChipText}>
                          {wx.isDry ? 'Dry rock' : 'Wet rock'}
                        </Text>
                      </View>
                      <View style={styles.weatherChip}>
                        <Text style={styles.weatherChipText}>{wx.humidity}% humidity</Text>
                      </View>
                    </View>
                  )}
                  <View style={styles.placeCardBottom}>
                    <Text style={styles.placeCardBottomText}>
                      {plansHere > 0
                        ? `${plansHere} friend${plansHere !== 1 ? 's' : ''} planning trips this week`
                        : 'No friends planning trips this week'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── Today's workouts ── */}
        {todaySchedules.length > 0 && (
          <View style={styles.sectionSpaced}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Today's workouts</Text>
              <TouchableOpacity onPress={() => (navigation as any).navigate('MySchedule')}>
                <Text style={styles.sectionLink}>Full schedule</Text>
              </TouchableOpacity>
            </View>
            {todaySchedules.map((s) => {
              const gym = gyms.find((g) => g.id === s.gymId);
              const start = new Date(s.startTime);
              const end = new Date(s.endTime);
              const timeLabel = `${start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} – ${end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
              const typeLabel = s.workoutType
                ? s.workoutType.charAt(0).toUpperCase() + s.workoutType.slice(1)
                : 'Workout';
              return (
                <TouchableOpacity
                  key={s.id}
                  style={styles.workoutCard}
                  activeOpacity={0.75}
                  onPress={() => (navigation as any).navigate('MySchedule')}
                >
                  <View style={styles.workoutCardLeft}>
                    <View style={styles.workoutIconWrap}>
                      <Ionicons name="barbell-outline" size={18} color={colors.primary} />
                    </View>
                    <View style={styles.workoutCardInfo}>
                      <Text style={styles.workoutCardTitle}>
                        {s.title ?? typeLabel}
                        {gym ? ` · ${gym.name}` : ''}
                      </Text>
                      <Text style={styles.workoutCardTime}>{timeLabel}</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textFaded} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── Events & trips ── */}
        {(tripInvitations.length > 0 || friendsPlans.length > 0) && (
          <View style={styles.sectionSpaced}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Events & trips</Text>
              <Text style={styles.sectionMeta}>See all</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.eventsRow}
            >
              {tripInvitations.map((inv) => {
                const areaName = inv.trip
                  ? followedAreas.find((a) => a.id === inv.trip!.areaId)?.name ??
                    climbingAreas.find((a) => a.id === inv.trip!.areaId)?.name ??
                    'Climbing trip'
                  : 'Climbing trip';
                return (
                  <TouchableOpacity
                    key={inv.id}
                    style={[styles.eventCard, styles.eventCardInvite]}
                    activeOpacity={0.75}
                    onPress={() => inv.trip?.areaId && (navigation as any).navigate('Find', { screen: 'AreaDetail', params: { areaId: inv.trip.areaId } })}
                  >
                    <View style={styles.eventBadgeInvite}>
                      <Text style={styles.eventBadgeInviteText}>Trip invite</Text>
                    </View>
                    <Text style={styles.eventTitle} numberOfLines={2}>
                      {areaName}
                    </Text>
                    {inv.trip && (
                      <Text style={styles.eventDate}>
                        {dateRange(inv.trip.startDate, inv.trip.endDate)}
                      </Text>
                    )}
                    <Text style={styles.eventMeta}>
                      {inv.trip?.notes ?? 'Tap to respond'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              {friendsPlans.slice(0, 5).map((item, i) => (
                <TouchableOpacity
                  key={`plan-${i}`}
                  style={[styles.eventCard, styles.eventCardPlan]}
                  activeOpacity={0.75}
                  onPress={() => (navigation as any).navigate('Find', { screen: 'AreaDetail', params: { areaId: item.plan.areaId } })}
                >
                  <View style={styles.eventBadgePlan}>
                    <Text style={styles.eventBadgePlanText}>Friend trip</Text>
                  </View>
                  <Text style={styles.eventTitle} numberOfLines={2}>
                    {item.areaName ?? 'Climbing area'}
                  </Text>
                  <Text style={styles.eventDate}>
                    {dateRange(item.plan.startDate, item.plan.endDate)}
                  </Text>
                  <Text style={styles.eventMeta}>{item.friendName ?? 'A friend'}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Friend activity ── */}
        {recentPosts.length > 0 && (
          <View style={styles.sectionSpaced}>
            <Text style={[styles.sectionTitle, { paddingHorizontal: 20 }]}>Friend activity</Text>
            {recentPosts.slice(0, 6).map((post) => (
              <TouchableOpacity
                key={post.postId}
                style={styles.feedCard}
                activeOpacity={0.75}
                onPress={() => (navigation as any).navigate('Find', { screen: 'FriendProfile', params: { userId: post.authorUserId } })}
              >
                <View style={styles.feedAvatar}>
                  <Text style={styles.feedAvatarText}>{initials(post.authorName ?? '?')}</Text>
                </View>
                <View style={styles.feedBody}>
                  <View style={styles.feedMeta}>
                    <Text style={styles.feedAuthor}>{post.authorName}</Text>
                    <Text style={styles.feedTime}>{relativeTime(post.createdAt)}</Text>
                  </View>
                  <Text style={styles.feedContent} numberOfLines={2}>
                    {postTypeLabel(post)}
                    {(post.gymName || post.areaName) ? (
                      <Text style={styles.feedLocation}>
                        {' '}at {post.gymName ?? post.areaName}
                      </Text>
                    ) : null}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Empty state ── */}
        {!isLoading &&
          friendsOut.length === 0 &&
          followedGyms.length === 0 &&
          followedAreas.length === 0 &&
          recentPosts.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color={colors.textFaded} />
              <Text style={styles.emptyStateTitle}>It's quiet right now</Text>
              <Text style={styles.emptyStateSub}>
                Add friends and follow your home gym or crag to see what's happening
              </Text>
            </View>
          )}

        <View style={{ height: insets.bottom + 16 }} />
      </ScrollView>

      {/* ── "I'm Going" modal ── */}
      <Modal
        visible={showGoingModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGoingModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowGoingModal(false)}
        >
          <View
            style={[styles.modalSheet, { paddingBottom: insets.bottom + 24 }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Where are you heading?</Text>

            {followedGyms.map((gym) => (
              <TouchableOpacity
                key={gym.id}
                style={[
                  styles.locationOption,
                  goingLocation?.id === gym.id && styles.locationOptionActiveGym,
                ]}
                onPress={() =>
                  setGoingLocation({ type: 'gym', id: gym.id, name: gym.name })
                }
              >
                <Ionicons
                  name="barbell-outline"
                  size={18}
                  color={
                    goingLocation?.id === gym.id ? colors.background : colors.primary
                  }
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.locationOptionText,
                      goingLocation?.id === gym.id && styles.locationOptionTextActive,
                    ]}
                  >
                    {gym.name}
                  </Text>
                  <Text
                    style={[
                      styles.locationOptionSub,
                      goingLocation?.id === gym.id && styles.locationOptionSubActive,
                    ]}
                  >
                    Gym
                  </Text>
                </View>
                {goingLocation?.id === gym.id && (
                  <Ionicons name="checkmark-circle" size={20} color={colors.background} />
                )}
              </TouchableOpacity>
            ))}

            {followedAreas.map((area) => (
              <TouchableOpacity
                key={area.id}
                style={[
                  styles.locationOption,
                  goingLocation?.id === area.id && styles.locationOptionActiveCrag,
                ]}
                onPress={() =>
                  setGoingLocation({ type: 'area', id: area.id, name: area.name })
                }
              >
                <Ionicons
                  name="location-outline"
                  size={18}
                  color={
                    goingLocation?.id === area.id ? colors.background : colors.secondary
                  }
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.locationOptionText,
                      goingLocation?.id === area.id && styles.locationOptionTextActive,
                    ]}
                  >
                    {area.name}
                  </Text>
                  <Text
                    style={[
                      styles.locationOptionSub,
                      goingLocation?.id === area.id && styles.locationOptionSubActive,
                    ]}
                  >
                    Crag
                  </Text>
                </View>
                {goingLocation?.id === area.id && (
                  <Ionicons name="checkmark-circle" size={20} color={colors.background} />
                )}
              </TouchableOpacity>
            ))}

            {goingLocation && (
              <View style={styles.availabilitySection}>
                <Text style={styles.availabilityLabel}>Availability</Text>
                <View style={styles.availabilityRow}>
                  <TouchableOpacity
                    style={[
                      styles.availabilityOption,
                      goingOpenToJoin && styles.availabilityOptionActiveOpen,
                    ]}
                    onPress={() => setGoingOpenToJoin(true)}
                  >
                    <Ionicons
                      name="people-outline"
                      size={15}
                      color={goingOpenToJoin ? colors.background : colors.primary}
                    />
                    <Text
                      style={[
                        styles.availabilityOptionText,
                        goingOpenToJoin && styles.availabilityOptionTextActive,
                      ]}
                    >
                      Open to join
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.availabilityOption,
                      !goingOpenToJoin && styles.availabilityOptionActiveSolo,
                    ]}
                    onPress={() => setGoingOpenToJoin(false)}
                  >
                    <Ionicons
                      name="person-outline"
                      size={15}
                      color={!goingOpenToJoin ? colors.background : colors.secondary}
                    />
                    <Text
                      style={[
                        styles.availabilityOptionText,
                        !goingOpenToJoin && styles.availabilityOptionTextActive,
                      ]}
                    >
                      Solo session
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[styles.goBtn, !goingLocation && styles.goBtnDisabled]}
              disabled={!goingLocation || goingSubmitting}
              onPress={handleGoingSubmit}
            >
              {goingSubmitting ? (
                <ActivityIndicator size="small" color={colors.background} />
              ) : (
                <Text style={styles.goBtnText}>
                  {isOffline ? 'Queue — will sync when online' : 'Let friends know'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: colors.background,
  },
  headerDate: {
    color: colors.textMuted,
    fontSize: 12,
  },
  headerGreeting: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '500',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '500',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {},
  // Offline notice
  offlineNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
  offlineNoticeText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  // "I'm going" banner
  goingBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 24,
    backgroundColor: colors.secondaryMuted,
    borderWidth: 1,
    borderColor: colors.secondaryBorder,
    borderRadius: 12,
    padding: 14,
  },
  goingBannerTitle: {
    color: colors.secondary,
    fontSize: 14,
    fontWeight: '500',
  },
  goingBannerSub: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 3,
  },
  goingBannerBtn: {
    backgroundColor: colors.secondary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  goingBannerBtnText: {
    color: colors.background,
    fontSize: 13,
    fontWeight: '500',
  },
  // Sections (horizontal pad on header/cards, full-bleed scroll)
  sectionSpaced: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
  },
  sectionMeta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  sectionLink: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '500',
  },
  workoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 12,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  workoutCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  workoutIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workoutCardInfo: { flex: 1 },
  workoutCardTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  workoutCardTime: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  // Presence row
  presenceRow: {
    paddingHorizontal: 20,
    gap: 14,
    paddingRight: 24,
  },
  presenceItem: {
    alignItems: 'center',
    width: 56,
    gap: 5,
  },
  presenceAvatarWrap: {
    width: 52,
    height: 52,
  },
  presenceAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surface,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presenceAvatarOpen: {
    borderColor: colors.primary,
  },
  presenceAvatarSolo: {
    borderColor: colors.secondary,
  },
  presenceAvatarText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '500',
  },
  presenceDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    borderWidth: 2,
    borderColor: colors.background,
  },
  presenceDotOpen: {
    backgroundColor: colors.primary,
  },
  presenceDotSolo: {
    backgroundColor: colors.secondary,
  },
  presenceName: {
    color: colors.textSecondary,
    fontSize: 10,
    textAlign: 'center',
  },
  presenceChip: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  presenceChipOpen: {
    backgroundColor: colors.primaryMuted,
  },
  presenceChipSolo: {
    backgroundColor: colors.secondaryMuted,
  },
  presenceChipText: {
    fontSize: 9,
  },
  presenceChipTextOpen: {
    color: colors.primary,
  },
  presenceChipTextSolo: {
    color: colors.secondary,
  },
  presenceMoreCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(250,237,202,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(250,237,202,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  presenceMoreText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  presenceLegend: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
    paddingHorizontal: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  legendLabel: {
    color: colors.textFaded,
    fontSize: 10,
  },
  emptyRow: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  // Place cards
  placeCard: {
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
  },
  placeCardGym: {
    backgroundColor: '#0D1E11',
    borderColor: 'rgba(63,245,133,0.22)',
  },
  placeCardCrag: {
    backgroundColor: '#0D1E11',
    borderColor: 'rgba(245,133,63,0.22)',
  },
  placeCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  placeTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  placeTypeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  placeTypeLabel: {
    color: colors.textFaded,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  placeName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '500',
  },
  placeCountBadgeGym: {
    backgroundColor: colors.primaryMuted,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  placeCountTextGym: {
    color: colors.primary,
    fontSize: 11,
  },
  placeCardBottom: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  placeCardBottomText: {
    color: colors.textMuted,
    fontSize: 11,
    flex: 1,
  },
  miniAvatarRow: {
    flexDirection: 'row',
  },
  miniAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: 'rgba(63,245,133,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniAvatarOverlap: {
    marginLeft: -8,
  },
  miniAvatarText: {
    color: colors.text,
    fontSize: 8,
    fontWeight: '500',
  },
  // Weather
  weatherBlock: {
    alignItems: 'flex-end',
  },
  weatherTemp: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '500',
    lineHeight: 26,
  },
  weatherDesc: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  weatherChips: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  weatherChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryMuted,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  weatherChipText: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  // Events row
  eventsRow: {
    paddingHorizontal: 20,
    gap: 10,
    paddingRight: 24,
  },
  eventCard: {
    width: 164,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  eventCardInvite: {
    backgroundColor: '#0D1E11',
    borderColor: 'rgba(245,133,63,0.38)',
  },
  eventCardPlan: {
    backgroundColor: '#0D1E11',
    borderColor: 'rgba(63,245,133,0.22)',
  },
  eventBadgeInvite: {
    alignSelf: 'flex-start',
    backgroundColor: colors.secondaryMuted,
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginBottom: 8,
  },
  eventBadgeInviteText: {
    color: colors.secondary,
    fontSize: 9,
    fontWeight: '500',
  },
  eventBadgePlan: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryMuted,
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginBottom: 8,
  },
  eventBadgePlanText: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: '500',
  },
  eventTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 3,
    lineHeight: 18,
  },
  eventDate: {
    color: colors.textMuted,
    fontSize: 11,
    marginBottom: 8,
  },
  eventMeta: {
    color: colors.textFaded,
    fontSize: 10,
  },
  // Feed cards
  feedCard: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: '#0D1E11',
    borderWidth: 1,
    borderColor: 'rgba(250,237,202,0.07)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    marginHorizontal: 20,
  },
  feedAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  feedAvatarText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '500',
  },
  feedBody: {
    flex: 1,
    minWidth: 0,
  },
  feedMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 3,
  },
  feedAuthor: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '500',
  },
  feedTime: {
    color: colors.textFaded,
    fontSize: 10,
    marginLeft: 8,
    flexShrink: 0,
  },
  feedContent: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  feedLocation: {
    color: colors.primary,
  },
  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  emptyStateTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '500',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSub: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  // "I'm Going" modal
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 12,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.handle,
    alignSelf: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 4,
  },
  locationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    padding: 14,
  },
  locationOptionActiveGym: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  locationOptionActiveCrag: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  locationOptionText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
  locationOptionTextActive: {
    color: colors.background,
  },
  locationOptionSub: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  locationOptionSubActive: {
    color: 'rgba(2,12,24,0.7)',
  },
  availabilitySection: {
    marginTop: 4,
  },
  availabilityLabel: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: 8,
  },
  availabilityRow: {
    flexDirection: 'row',
    gap: 10,
  },
  availabilityOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  availabilityOptionActiveOpen: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  availabilityOptionActiveSolo: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  availabilityOptionText: {
    color: colors.text,
    fontSize: 13,
  },
  availabilityOptionTextActive: {
    color: colors.background,
  },
  goBtn: {
    backgroundColor: colors.secondary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  goBtnDisabled: {
    opacity: 0.4,
  },
  goBtnText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '500',
  },
});

export default HomeScreen;
