import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useNetwork } from '../context/NetworkContext';
import { directMessagesApi, groupsApi, userApi, tripInvitationsApi } from '../services/api';
import { MessagesStackParamList } from '../types';
import { colors } from '../theme/colors';

type MessagesNavProp = StackNavigationProp<MessagesStackParamList, 'MessagesMain'>;

type SegmentType = 'all' | 'dms' | 'groups' | 'requests';

const SEGMENTS: { key: SegmentType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'dms', label: 'DMs' },
  { key: 'groups', label: 'Groups' },
  { key: 'requests', label: 'Requests' },
];

interface DMItem {
  type: 'dm';
  id: string;
  conversationId: string;
  otherUserId: string;
  name: string;
  avatar?: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
}

interface GroupItem {
  type: 'group';
  id: string;
  name: string;
  memberCount: number;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
}

interface RequestItem {
  type: 'request';
  id: string;
  requestType: 'workout' | 'trip';
  title: string;
  fromName: string;
  createdAt: string;
  data: any;
}

type InboxItem = DMItem | GroupItem | RequestItem;

function relTime(iso?: string): string {
  if (!iso) return '';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

const MessagesScreen: React.FC = () => {
  const navigation = useNavigation<MessagesNavProp>();
  const { user } = useAuth();
  const { friends, workoutInvitations, respondToWorkoutInvitation, refreshWorkoutInvitations } = useApp();
  const insets = useSafeAreaInsets();
  const { isOffline } = useNetwork();

  const [segment, setSegment] = useState<SegmentType>('all');
  const [dmItems, setDmItems] = useState<DMItem[]>([]);
  const [groupItems, setGroupItems] = useState<GroupItem[]>([]);
  const [requestItems, setRequestItems] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [convos, myGroups, tripInvites] = await Promise.all([
        directMessagesApi.listConversations(user.id),
        groupsApi.getUserGroups(user.id),
        tripInvitationsApi.getByInvitee(user.id),
      ]);

      // Resolve DM other-user names
      const otherIds = convos.map((c: any) => c.otherUserId);
      const nameMap: Record<string, string> = {};
      const avatarMap: Record<string, string | undefined> = {};
      if (otherIds.length > 0) {
        const names = await userApi.getNamesForIds(otherIds);
        Object.assign(nameMap, names);
        // Also try friends list for avatars
        for (const f of friends) {
          if (otherIds.includes(f.id)) {
            avatarMap[f.id] = f.avatar;
          }
        }
      }

      const dms: DMItem[] = convos.map((c: any) => ({
        type: 'dm',
        id: c.id,
        conversationId: c.id,
        otherUserId: c.otherUserId,
        name: nameMap[c.otherUserId] ?? 'Unknown',
        avatar: avatarMap[c.otherUserId],
        lastMessage: c.lastMessage,
        lastMessageAt: c.lastMessageAt,
        unreadCount: c.unreadCount,
      }));
      setDmItems(dms);

      // Group items — get last message from each group's chat
      const groups: GroupItem[] = myGroups.map((g: any) => ({
        type: 'group',
        id: g.id,
        name: g.name,
        memberCount: g.memberCount,
        lastMessageAt: undefined,
        unreadCount: 0,
      }));
      setGroupItems(groups);

      // Requests: pending workout invitations + pending trip invitations
      const pendingWorkouts = workoutInvitations.filter((inv) => {
        const myResponse = inv.responses?.find((r) => r.userId === user.id);
        return myResponse?.response === 'pending' || !myResponse;
      });
      const pendingTrips = tripInvites.filter((t) => t.status === 'invited');

      const requests: RequestItem[] = [
        ...pendingWorkouts.map((inv) => ({
          type: 'request' as const,
          id: `workout-${inv.id}`,
          requestType: 'workout' as const,
          title: inv.title,
          fromName: inv.inviter?.name ?? 'Someone',
          createdAt: inv.createdAt,
          data: inv,
        })),
        ...pendingTrips.map((t: any) => ({
          type: 'request' as const,
          id: `trip-${t.id}`,
          requestType: 'trip' as const,
          title: t.trip?.areaId ? `Trip invitation` : 'Trip invitation',
          fromName: friends.find((f) => f.id === t.inviterUserId)?.name ?? 'A friend',
          createdAt: t.createdAt,
          data: t,
        })),
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setRequestItems(requests);
    } catch (e) {
      console.error('MessagesScreen load error:', e);
    } finally {
      setLoading(false);
    }
  }, [user?.id, friends, workoutInvitations]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRefresh = async () => {
    if (isOffline) {
      setRefreshing(false);
      return;
    }
    setRefreshing(true);
    await Promise.all([loadData(), refreshWorkoutInvitations()]);
    setRefreshing(false);
  };

  const allItems = (): InboxItem[] => {
    const all: InboxItem[] = [...dmItems, ...groupItems, ...requestItems];
    // Sort by most recent activity
    return all.sort((a, b) => {
      const aTime = a.type === 'dm' ? a.lastMessageAt
        : a.type === 'group' ? a.lastMessageAt
        : a.createdAt;
      const bTime = b.type === 'dm' ? b.lastMessageAt
        : b.type === 'group' ? b.lastMessageAt
        : b.createdAt;
      return new Date(bTime ?? 0).getTime() - new Date(aTime ?? 0).getTime();
    });
  };

  const getItems = (): InboxItem[] => {
    switch (segment) {
      case 'dms': return dmItems;
      case 'groups': return groupItems;
      case 'requests': return requestItems;
      default: return allItems();
    }
  };

  const totalUnread = dmItems.reduce((s, d) => s + d.unreadCount, 0)
    + requestItems.length;

  const renderDM = (item: DMItem) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() =>
        navigation.navigate('DirectChat', {
          conversationId: item.conversationId,
          otherUserId: item.otherUserId,
          otherUserName: item.name,
        })
      }
    >
      <View style={styles.avatarWrap}>
        {item.avatar ? (
          <Image source={{ uri: item.avatar }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitial}>{item.name.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        {item.unreadCount > 0 && (
          <View style={styles.unreadDot}>
            <Text style={styles.unreadDotText}>{item.unreadCount}</Text>
          </View>
        )}
      </View>
      <View style={styles.rowContent}>
        <View style={styles.rowTop}>
          <Text style={[styles.rowName, item.unreadCount > 0 && styles.rowNameBold]}>{item.name}</Text>
          <Text style={styles.rowTime}>{relTime(item.lastMessageAt)}</Text>
        </View>
        {item.lastMessage && (
          <Text style={styles.rowPreview} numberOfLines={1}>{item.lastMessage}</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderGroup = (item: GroupItem) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() =>
        navigation.navigate('GroupChat', { groupId: item.id, groupName: item.name })
      }
    >
      <View style={styles.groupIcon}>
        <Ionicons name="people" size={22} color={colors.primary} />
      </View>
      <View style={styles.rowContent}>
        <View style={styles.rowTop}>
          <Text style={styles.rowName}>{item.name}</Text>
          {item.lastMessageAt && (
            <Text style={styles.rowTime}>{relTime(item.lastMessageAt)}</Text>
          )}
        </View>
        <Text style={styles.rowPreview}>{item.memberCount} members</Text>
      </View>
    </TouchableOpacity>
  );

  const renderRequest = (item: RequestItem) => (
    <View style={styles.requestRow}>
      <View style={styles.requestIcon}>
        <Ionicons
          name={item.requestType === 'workout' ? 'barbell-outline' : 'trail-sign-outline'}
          size={20}
          color={colors.secondary}
        />
      </View>
      <View style={styles.rowContent}>
        <View style={styles.rowTop}>
          <Text style={styles.rowName} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.rowTime}>{relTime(item.createdAt)}</Text>
        </View>
        <Text style={styles.rowPreview}>From {item.fromName}</Text>
        {item.requestType === 'workout' && (
          <View style={styles.requestActions}>
            <TouchableOpacity
              style={styles.declineBtn}
              onPress={() => respondToWorkoutInvitation(item.data.id, 'declined').then(handleRefresh)}
            >
              <Text style={styles.declineBtnText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.acceptBtn}
              onPress={() => respondToWorkoutInvitation(item.data.id, 'accepted').then(handleRefresh)}
            >
              <Text style={styles.acceptBtnText}>Accept</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );

  const renderItem = ({ item }: { item: InboxItem }) => {
    if (item.type === 'dm') return renderDM(item);
    if (item.type === 'group') return renderGroup(item);
    return renderRequest(item);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={[styles.headerArea, { paddingTop: insets.top }]}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Messages</Text>
          {totalUnread > 0 && (
            <View style={styles.totalBadge}>
              <Text style={styles.totalBadgeText}>{totalUnread}</Text>
            </View>
          )}
        </View>

        {/* Segment */}
        <View style={styles.segmentRow}>
          {SEGMENTS.map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={[styles.segmentItem, segment === key && styles.segmentItemActive]}
              onPress={() => setSegment(key)}
            >
              <Text style={[styles.segmentText, segment === key && styles.segmentTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Offline notice */}
      {isOffline && (
        <View style={styles.offlineNotice}>
          <Ionicons name="cloud-offline-outline" size={14} color={colors.textMuted} />
          <Text style={styles.offlineNoticeText}>Showing saved data — you're offline.</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={getItems()}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={48} color={colors.textFaded} />
              <Text style={styles.emptyText}>
                {segment === 'requests' ? 'No pending requests' : 'No messages yet'}
              </Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerArea: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
  },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  totalBadge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  totalBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  segmentRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  segmentItemActive: { borderBottomColor: colors.primary },
  segmentText: { fontSize: 13, fontWeight: '500', color: colors.textMuted },
  segmentTextActive: { color: colors.primary, fontWeight: '700' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingBottom: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  avatarWrap: { position: 'relative' },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  avatarPlaceholder: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: { color: '#fff', fontSize: 18, fontWeight: '700' },
  unreadDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  unreadDotText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  groupIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  requestIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  rowContent: { flex: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  rowName: { fontSize: 15, color: colors.text, fontWeight: '500', flex: 1, marginRight: 6 },
  rowNameBold: { fontWeight: '700' },
  rowTime: { fontSize: 12, color: colors.textMuted },
  rowPreview: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  requestActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  declineBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  declineBtnText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  acceptBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  acceptBtnText: { fontSize: 13, color: '#fff', fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 15, color: colors.textMuted },
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
});

export default MessagesScreen;
