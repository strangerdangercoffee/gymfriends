import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useNetwork } from '../context/NetworkContext';
import {
  userApi,
  userAreaVisitsApi,
  areaFeedApi,
  userAreaPlansApi,
  climbingAreasApi,
  gymApi,
  directMessagesApi,
} from '../services/api';
import { User, ClimbingArea, Gym, FindStackParamList } from '../types';
import { colors } from '../theme/colors';

type FriendProfileRouteProp = RouteProp<FindStackParamList, 'FriendProfile'>;
type FriendProfileNavProp = StackNavigationProp<FindStackParamList, 'FriendProfile'>;

const FriendProfileScreen: React.FC = () => {
  const route = useRoute<FriendProfileRouteProp>();
  const navigation = useNavigation<FriendProfileNavProp>();
  const { userId } = route.params;
  const { user: currentUser } = useAuth();
  const { friends, presence, gyms, climbingAreas } = useApp();
  const { isOffline } = useNetwork();

  const [profileUser, setProfileUser] = useState<User | null>(
    friends.find((f) => f.id === userId) ?? null
  );
  const [loading, setLoading] = useState(!profileUser);

  const [recentVisits, setRecentVisits] = useState<
    { areaId?: string; gymId?: string; name: string; date: string }[]
  >([]);
  const [recentPosts, setRecentPosts] = useState<any[]>([]);
  const [upcomingPlans, setUpcomingPlans] = useState<any[]>([]);
  const [startingDM, setStartingDM] = useState(false);

  const isFriend = friends.some((f) => f.id === userId);
  const shareLocation = profileUser?.privacySettings?.shareLocation !== false;
  const shareSchedule = profileUser?.privacySettings?.shareSchedule !== false;

  // Current presence at gym
  const currentPresence = presence.find((p) => p.userId === userId && p.isActive);
  const currentGym = currentPresence ? gyms.find((g) => g.id === currentPresence.gymId) : null;

  useEffect(() => {
    let cancelled = false;
    if (!profileUser) {
      userApi.getById(userId)
        .then((u) => {
          if (!cancelled) { setProfileUser(u); setLoading(false); }
        })
        .catch(() => {
          // Offline or network error — stay on empty state rather than crashing
          if (!cancelled) setLoading(false);
        });
    }
    return () => { cancelled = true; };
  }, [userId]);

  const loadFriendData = useCallback(async () => {
    if (!isFriend) return;
    try {
      // Recent visits
      if (shareLocation) {
        const visits = await userAreaVisitsApi.getByUser(userId);
        const recent = visits.slice(0, 5);
        const resolved = await Promise.all(
          recent.map(async (v) => {
            const area = climbingAreas.find((a) => a.id === v.areaId);
            const name = area?.name ?? v.areaId;
            return { areaId: v.areaId, name, date: v.lastSeenAt };
          })
        );
        setRecentVisits(resolved);
      }

      // Recent posts
      const posts = await areaFeedApi.getPostsByAuthor(userId, 5);
      setRecentPosts(posts);

      // Upcoming plans
      if (shareSchedule) {
        const plans = await userAreaPlansApi.getByUser(userId);
        const today = new Date().toISOString().slice(0, 10);
        setUpcomingPlans(plans.filter((p) => p.endDate >= today).slice(0, 5));
      }
    } catch (e) {
      console.error('FriendProfile data load error:', e);
    }
  }, [userId, isFriend, shareLocation, shareSchedule, climbingAreas]);

  useEffect(() => {
    if (profileUser) loadFriendData();
  }, [profileUser, loadFriendData]);

  const handleMessagePress = async () => {
    if (!currentUser?.id) return;
    if (isOffline) {
      Alert.alert('Offline', 'You need to be online to start a conversation.');
      return;
    }
    setStartingDM(true);
    try {
      const convo = await directMessagesApi.getOrCreateConversation(currentUser.id, userId);
      (navigation.getParent() as any)?.navigate('Messages', {
        screen: 'DirectChat',
        params: {
          conversationId: convo.id,
          otherUserId: userId,
          otherUserName: profileUser?.name ?? 'Friend',
        },
      } as never);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not start conversation');
    } finally {
      setStartingDM(false);
    }
  };

  const getAreaName = (areaId: string) => {
    return climbingAreas.find((a) => a.id === areaId)?.name ?? areaId;
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!profileUser) {
    return (
      <View style={styles.centered}>
        <Ionicons name="person-outline" size={40} color={colors.textFaded} />
        <Text style={styles.errorText}>
          {isOffline ? 'Profile unavailable offline' : 'User not found'}
        </Text>
        {isOffline && (
          <Text style={styles.errorSubtext}>Connect to the internet to view this profile.</Text>
        )}
      </View>
    );
  }

  const cp = profileUser.climbingProfile;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Offline notice */}
      {isOffline && (
        <View style={styles.offlineNotice}>
          <Ionicons name="cloud-offline-outline" size={14} color={colors.textMuted} />
          <Text style={styles.offlineNoticeText}>Showing saved data — you're offline.</Text>
        </View>
      )}

      {/* Header */}
      <View style={styles.headerCard}>
        <View style={styles.avatarWrap}>
          {profileUser.avatar ? (
            <Image source={{ uri: profileUser.avatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitials}>
                {profileUser.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.userName}>{profileUser.name}</Text>
        {profileUser.email && (
          <Text style={styles.userEmail}>{profileUser.email}</Text>
        )}

        {/* Message button */}
        {isFriend && (
          <TouchableOpacity
            style={[styles.messageButton, isOffline && styles.messageButtonOffline]}
            onPress={handleMessagePress}
            disabled={startingDM}
          >
            {startingDM ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons
                  name={isOffline ? 'cloud-offline-outline' : 'chatbubble-outline'}
                  size={18}
                  color="#fff"
                />
                <Text style={styles.messageButtonText}>
                  {isOffline ? 'Offline' : 'Message'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Current location */}
      {shareLocation && currentGym && (
        <TouchableOpacity
          style={styles.section}
          onPress={() => navigation.navigate('GymDetail', { gymId: currentGym.id })}
        >
          <View style={styles.sectionTitleRow}>
            <Ionicons name="location" size={16} color={colors.primary} />
            <Text style={styles.sectionTitle}>At the gym now</Text>
          </View>
          <View style={styles.locationRow}>
            <Text style={styles.locationName}>{currentGym.name}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textFaded} />
          </View>
        </TouchableOpacity>
      )}

      {/* Climbing profile */}
      {cp && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Climbing Profile</Text>
          <View style={styles.gradeGrid}>
            {cp.leadClimbing && (
              <View style={styles.gradeChip}>
                <Text style={styles.gradeLabel}>Lead</Text>
                <Text style={styles.gradeValue}>
                  {cp.leadGradeMin ?? '?'}{cp.leadGradeMax ? `–${cp.leadGradeMax}` : '+'}
                </Text>
              </View>
            )}
            {cp.topRope && (
              <View style={styles.gradeChip}>
                <Text style={styles.gradeLabel}>Top Rope</Text>
                <Text style={styles.gradeValue}>
                  {cp.topRopeGradeMin ?? '?'}{cp.topRopeGradeMax ? `–${cp.topRopeGradeMax}` : '+'}
                </Text>
              </View>
            )}
            {cp.bouldering && (
              <View style={styles.gradeChip}>
                <Text style={styles.gradeLabel}>Boulder</Text>
                <Text style={styles.gradeValue}>
                  {cp.boulderMaxFlash ?? cp.boulderMaxSend ?? '?'}
                </Text>
              </View>
            )}
            {cp.traditionalClimbing && (
              <View style={styles.gradeChip}>
                <Text style={styles.gradeLabel}>Trad</Text>
                <Text style={styles.gradeValue}>
                  {cp.traditionalGradeMin ?? '?'}{cp.traditionalGradeMax ? `–${cp.traditionalGradeMax}` : '+'}
                </Text>
              </View>
            )}
          </View>
          {cp.openToNewPartners && (
            <View style={styles.openBadge}>
              <Ionicons name="checkmark-circle" size={14} color={colors.success ?? '#34C759'} />
              <Text style={styles.openBadgeText}>Open to new partners</Text>
            </View>
          )}
        </View>
      )}

      {/* Where they've been climbing */}
      {shareLocation && recentVisits.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recently Climbing</Text>
          {recentVisits.map((v, i) => (
            <TouchableOpacity
              key={i}
              style={styles.visitRow}
              onPress={() => v.areaId && navigation.navigate('AreaDetail', { areaId: v.areaId })}
            >
              <Ionicons name="trail-sign-outline" size={16} color={colors.textMuted} />
              <Text style={styles.visitName}>{v.name}</Text>
              <Text style={styles.visitDate}>
                {new Date(v.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Recent posts */}
      {recentPosts.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {recentPosts.map((post: any) => (
            <View key={post.post_id ?? post.id} style={styles.postRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons
                  name={
                    post.post_type === 'belayer_request' ? 'link-outline' :
                    post.post_type === 'trip_announcement' ? 'calendar-outline' :
                    post.post_type === 'rally_pads_request' ? 'bag-outline' :
                    'chatbubble-outline'
                  }
                  size={11}
                  color={colors.textMuted}
                />
                <Text style={styles.postType}>
                  {post.post_type === 'belayer_request' ? 'Belayer request'
                    : post.post_type === 'trip_announcement' ? 'Trip announcement'
                    : post.post_type === 'rally_pads_request' ? 'Pads request'
                    : 'Post'}
                </Text>
              </View>
              <Text style={styles.postTitle} numberOfLines={2}>{post.title}</Text>
              <Text style={styles.postDate}>
                {new Date(post.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Upcoming trips */}
      {shareSchedule && upcomingPlans.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Upcoming Trips</Text>
            <TouchableOpacity
              onPress={() =>
                navigation.navigate('FriendSchedule', {
                  mode: 'friend',
                  userId,
                  userName: profileUser.name,
                })
              }
            >
              <Text style={styles.viewAllText}>View schedule</Text>
            </TouchableOpacity>
          </View>
          {upcomingPlans.map((plan) => (
            <TouchableOpacity
              key={plan.id}
              style={styles.planRow}
              onPress={() => navigation.navigate('AreaDetail', { areaId: plan.areaId })}
            >
              <Text style={styles.planArea}>{getAreaName(plan.areaId)}</Text>
              <Text style={styles.planDates}>
                {plan.startDate} – {plan.endDate}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  errorText: { fontSize: 16, color: colors.textMuted, marginTop: 12 },
  errorSubtext: { fontSize: 13, color: colors.textFaded, textAlign: 'center', paddingHorizontal: 32 },
  offlineNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.surfaceElevated,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  offlineNoticeText: { fontSize: 12, color: colors.textMuted },
  headerCard: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatarWrap: { marginBottom: 12 },
  avatar: { width: 80, height: 80, borderRadius: 40 },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: { color: '#fff', fontSize: 30, fontWeight: '700' },
  userName: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 4 },
  userEmail: { fontSize: 14, color: colors.textMuted, marginBottom: 16 },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 22,
  },
  messageButtonOffline: {
    backgroundColor: colors.textMuted,
  },
  messageButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  section: {
    padding: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginTop: 8,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 10 },
  viewAllText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  locationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  locationName: { fontSize: 15, color: colors.text, fontWeight: '500' },
  gradeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gradeChip: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 10,
    padding: 10,
    minWidth: 80,
    alignItems: 'center',
  },
  gradeLabel: { fontSize: 11, color: colors.textMuted, marginBottom: 2 },
  gradeValue: { fontSize: 15, fontWeight: '700', color: colors.primary },
  openBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  openBadgeText: { fontSize: 13, color: colors.textSecondary },
  visitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  visitName: { flex: 1, fontSize: 14, color: colors.text },
  visitDate: { fontSize: 12, color: colors.textMuted },
  postRow: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  postType: { fontSize: 12, color: colors.textMuted, marginBottom: 2 },
  postTitle: { fontSize: 14, color: colors.text },
  postDate: { fontSize: 12, color: colors.textFaded, marginTop: 2 },
  planRow: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  planArea: { fontSize: 14, fontWeight: '600', color: colors.text },
  planDates: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
});

export default FriendProfileScreen;
