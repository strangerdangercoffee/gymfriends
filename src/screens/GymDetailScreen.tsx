import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import { gymApi } from '../services/api';
import { Gym, FindStackParamList } from '../types';
import AreaFeed from '../components/AreaFeed';
import BelayerRequestModal from '../components/BelayerRequestModal';
import { colors } from '../theme/colors';

type GymDetailRouteProp = RouteProp<FindStackParamList, 'GymDetail'>;
type GymDetailNavProp = StackNavigationProp<FindStackParamList, 'GymDetail'>;

const GymDetailScreen: React.FC = () => {
  const route = useRoute<GymDetailRouteProp>();
  const navigation = useNavigation<GymDetailNavProp>();
  const { gymId } = route.params;
  const { user } = useAuth();
  const { gyms, friends, presence, followedGyms, followGym, unfollowGym, workoutInvitations, checkIn, checkOut } = useApp();
  const { isOffline } = useNetwork();

  const [gym, setGym] = useState<Gym | null>(gyms.find((g) => g.id === gymId) ?? null);
  const [loading, setLoading] = useState(!gym);
  const [showBelayerModal, setShowBelayerModal] = useState(false);

  useEffect(() => {
    if (gym) return;
    let cancelled = false;
    gymApi.getGymById(gymId).then((g) => {
      if (!cancelled) setGym(g);
    }).catch(() => {
      if (!cancelled) Alert.alert('Error', 'Failed to load gym');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [gymId, gym]);

  const isFollowing = followedGyms.some((g) => g.id === gymId);
  const myPresence = presence.find((p) => p.userId === user?.id && p.gymId === gymId && p.isActive);
  const isCheckedIn = !!myPresence;

  const friendIds = new Set(friends.map((f) => f.id));
  const friendsHere = presence.filter((p) => p.gymId === gymId && p.isActive && friendIds.has(p.userId));
  const friendsHereUsers = friendsHere.map((p) => friends.find((f) => f.id === p.userId)).filter(Boolean);

  // Friends' scheduled workouts at this gym
  const gymWorkouts = workoutInvitations.filter((inv) => {
    if (inv.gym?.id !== gymId) return false;
    const now = Date.now();
    const start = new Date(inv.startTime).getTime();
    const end = new Date(inv.endTime).getTime();
    // Upcoming or in progress
    return end > now && start < now + 7 * 24 * 60 * 60 * 1000;
  });

  const handleFollowToggle = async () => {
    try {
      if (isFollowing) await unfollowGym(gymId);
      else await followGym(gymId);
    } catch {
      Alert.alert('Error', 'Failed to update follow');
    }
  };

  const handleCheckInOut = async () => {
    try {
      if (isCheckedIn) await checkOut(gymId);
      else await checkIn(gymId);
    } catch {
      Alert.alert('Error', isCheckedIn ? 'Failed to check out' : 'Failed to check in');
    }
  };

  if (loading || !gym) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isOffline && (
        <View style={styles.offlineNotice}>
          <Ionicons name="cloud-offline-outline" size={14} color={colors.textMuted} />
          <Text style={styles.offlineNoticeText}>Showing saved data — you're offline.</Text>
        </View>
      )}
      <AreaFeed
        gymId={gymId}
        listHeaderComponent={
          <>
            {/* Gym header */}
            <View style={styles.gymHeader}>
              <Text style={styles.gymName}>{gym.name}</Text>
              {gym.address ? (
                <View style={styles.addressRow}>
                  <Ionicons name="location-outline" size={16} color={colors.textMuted} />
                  <Text style={styles.address}>{gym.address}</Text>
                </View>
              ) : null}
            </View>

            {/* Actions */}
            <View style={styles.actionBar}>
              <TouchableOpacity
                style={[styles.actionButton, isFollowing ? styles.actionButtonPrimary : null]}
                onPress={handleFollowToggle}
              >
                <Ionicons
                  name={isFollowing ? 'heart' : 'heart-outline'}
                  size={18}
                  color={isFollowing ? colors.background : colors.textSecondary}
                />
                <Text style={[styles.actionButtonText, isFollowing && styles.actionButtonTextOnPrimary]}>
                  {isOffline
                    ? (isFollowing ? 'Following' : 'Follow')
                    : (isFollowing ? 'Following' : 'Follow')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, isCheckedIn ? styles.actionButtonPrimary : null]}
                onPress={handleCheckInOut}
              >
                <Ionicons
                  name={isCheckedIn ? 'checkmark-circle' : 'checkmark-circle-outline'}
                  size={18}
                  color={isCheckedIn ? colors.background : colors.textSecondary}
                />
                <Text style={[styles.actionButtonText, isCheckedIn && styles.actionButtonTextOnPrimary]}>
                  {isOffline
                    ? (isCheckedIn ? 'Checked In' : 'Check In')
                    : (isCheckedIn ? 'Checked In' : 'Check In')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButtonSecondary}
                onPress={() => setShowBelayerModal(true)}
              >
                <Ionicons name="add-circle-outline" size={18} color={colors.textMuted} />
                <Text style={styles.actionButtonTextSecondary}>New Request</Text>
              </TouchableOpacity>
            </View>

            {/* Friends here now */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Friends here now</Text>
              {friendsHereUsers.length > 0 ? (
                friendsHereUsers.map((friend) => (
                  friend && (
                    <TouchableOpacity
                      key={friend.id}
                      style={styles.friendRow}
                      onPress={() => navigation.navigate('FriendProfile', { userId: friend.id })}
                    >
                      {friend.avatar ? (
                        <Image source={{ uri: friend.avatar }} style={styles.friendAvatar} />
                      ) : (
                        <View style={styles.friendAvatarPlaceholder}>
                          <Text style={styles.friendAvatarText}>{friend.name.charAt(0)}</Text>
                        </View>
                      )}
                      <Text style={styles.friendName}>{friend.name}</Text>
                      <Ionicons name="chevron-forward" size={16} color={colors.textFaded} />
                    </TouchableOpacity>
                  )
                ))
              ) : (
                <Text style={styles.emptyText}>No friends here right now</Text>
              )}
            </View>

            {/* Friends' upcoming workouts */}
            {gymWorkouts.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Upcoming workouts here</Text>
                {gymWorkouts.slice(0, 5).map((inv) => {
                  const start = new Date(inv.startTime);
                  const label = start.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  });
                  return (
                    <View key={inv.id} style={styles.workoutRow}>
                      <View style={styles.workoutDot} />
                      <View style={styles.workoutInfo}>
                        <Text style={styles.workoutTitle}>{inv.title}</Text>
                        <Text style={styles.workoutMeta}>{inv.inviter?.name} · {label}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            <View style={styles.feedSectionTitle}>
              <Text style={styles.feedSectionLabel}>BELAY REQUEST BOARD</Text>
            </View>
          </>
        }
      />

      <BelayerRequestModal
        visible={showBelayerModal}
        onClose={() => setShowBelayerModal(false)}
        onSuccess={() => setShowBelayerModal(false)}
        initialGymId={gymId}
        contextName={gym.name}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
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
  gymHeader: {
    padding: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  gymName: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 6 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  address: { fontSize: 14, color: colors.textMuted, flex: 1 },
  actionBar: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  actionButtonPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  actionButtonSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.background,
  },
  actionButtonText: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },
  actionButtonTextOnPrimary: { color: colors.background },
  actionButtonTextSecondary: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  section: {
    padding: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 10 },
  feedSectionTitle: {
    padding: 16,
    paddingBottom: 8,
    backgroundColor: colors.surfaceElevated,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  feedSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  friendAvatar: { width: 36, height: 36, borderRadius: 18 },
  friendAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendAvatarText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  friendName: { flex: 1, fontSize: 14, color: colors.text },
  emptyText: { fontSize: 14, color: colors.textMuted },
  workoutRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  workoutDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 5,
  },
  workoutInfo: { flex: 1 },
  workoutTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  workoutMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});

export default GymDetailScreen;
