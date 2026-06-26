import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  StatusBar,
  Modal,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import { groupsApi } from '../services/api';
import { User, Gym, ClimbingArea, FindStackParamList } from '../types';
import Card from '../components/Card';
import Button from '../components/Button';
import QRCodeDisplayModal from '../components/QRCodeDisplayModal';
import QRCodeScannerModal from '../components/QRCodeScannerModal';
import CreateGroupModal from '../components/CreateGroupModal';
import { colors } from '../theme/colors';

type FindScreenNavigationProp = StackNavigationProp<FindStackParamList, 'FindMain'>;

type SliceType = 'friends' | 'groups' | 'crags' | 'gyms';

interface Group {
  id: string;
  name: string;
  description?: string;
  privacy: 'public' | 'private';
  locationType?: 'gym' | 'city' | 'crag';
  locationName?: string;
  memberCount: number;
  role: 'admin' | 'moderator' | 'member';
}

const SLICES: { key: SliceType; label: string }[] = [
  { key: 'friends', label: 'Friends' },
  { key: 'groups', label: 'Groups' },
  { key: 'crags', label: 'Crags' },
  { key: 'gyms', label: 'Gyms' },
];

const FindScreen: React.FC = () => {
  const navigation = useNavigation<FindScreenNavigationProp>();
  const { friends, gyms, climbingAreas, followedAreas, presence, refreshData, addFriendInstant } = useApp();
  const { user } = useAuth();
  const { isOffline } = useNetwork();
  const insets = useSafeAreaInsets();

  const [activeSlice, setActiveSlice] = useState<SliceType>('friends');
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Friends slice state
  const [showQRDisplay, setShowQRDisplay] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);

  // Groups slice state
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [publicGroups, setPublicGroups] = useState<Group[]>([]);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [qrGroupData, setQrGroupData] = useState<{ id: string; name: string } | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);

  useEffect(() => {
    if (user?.id && activeSlice === 'groups') {
      loadGroups();
    }
  }, [user?.id, activeSlice]);

  const loadGroups = async () => {
    if (!user?.id) return;
    try {
      const [mine, pub] = await Promise.all([
        groupsApi.getUserGroups(user.id),
        groupsApi.searchPublicGroups(),
      ]);
      setMyGroups(mine);
      setPublicGroups(pub);
    } catch (e) {
      console.error('Error loading groups:', e);
    }
  };

  const handleRefresh = async () => {
    if (isOffline) {
      // Can't refresh while offline — keep cached content, don't throw
      setRefreshing(false);
      return;
    }
    setRefreshing(true);
    try {
      await refreshData();
      if (activeSlice === 'groups') await loadGroups();
    } catch (e) {
      console.error('Refresh error:', e);
    } finally {
      setRefreshing(false);
    }
  };

  // Friends logic
  const friendsAtGym = friends.filter((f) => presence.some((p) => p.userId === f.id && p.isActive));
  const friendsNotAtGym = friends.filter((f) => !presence.some((p) => p.userId === f.id && p.isActive));
  const sortedFriends = [...friendsAtGym, ...friendsNotAtGym];

  const getFriendCurrentGym = (friendId: string): Gym | undefined => {
    const fp = presence.find((p) => p.userId === friendId && p.isActive);
    return fp ? gyms.find((g) => g.id === fp.gymId) : undefined;
  };

  const filteredFriends = useMemo(() => {
    if (!query.trim()) return sortedFriends;
    const q = query.toLowerCase();
    return sortedFriends.filter(
      (f) => f.name.toLowerCase().includes(q) || f.email.toLowerCase().includes(q)
    );
  }, [sortedFriends, query]);

  const handleQRScanFriend = async (userId: string, userName: string) => {
    try {
      await addFriendInstant(userId);
      Alert.alert('Success', `${userName} has been added as a friend!`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to add friend');
    } finally {
      setShowQRScanner(false);
    }
  };

  const handleQRScanGroup = async (data: string) => {
    try {
      let qrData;
      try { qrData = JSON.parse(data); } catch {
        Alert.alert('Error', 'Invalid QR code format');
        setShowQRScanner(false);
        return;
      }
      if (!user?.id) { Alert.alert('Error', 'Not logged in'); setShowQRScanner(false); return; }
      if (qrData.type === 'gymfriends_group_invitation' && qrData.groupId) {
        await groupsApi.joinGroupFromQR(qrData.groupId, user.id);
        Alert.alert('Success', 'Joined the group!');
        await loadGroups();
      } else if (qrData.type === 'gymfriends_user' && qrData.userId) {
        await addFriendInstant(qrData.userId);
        Alert.alert('Success', 'Friend added!');
      } else {
        Alert.alert('Error', 'Invalid QR code type');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to process QR code');
    } finally {
      setShowQRScanner(false);
    }
  };

  // Groups logic
  const allGroups = useMemo(() => {
    const myIds = new Set(myGroups.map((g) => g.id));
    const others = publicGroups.filter((g) => !myIds.has(g.id));
    return [...myGroups, ...others];
  }, [myGroups, publicGroups]);

  const filteredGroups = useMemo(() => {
    if (!query.trim()) return allGroups;
    const q = query.toLowerCase();
    return allGroups.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.description?.toLowerCase().includes(q) ||
        g.locationName?.toLowerCase().includes(q)
    );
  }, [allGroups, query]);

  const handleGroupTap = (group: Group) => {
    const isMember = myGroups.some((g) => g.id === group.id);
    if (isMember) {
      // Navigate cross-tab to Messages → GroupChat
      (navigation.getParent() as any)?.navigate('Messages', {
        screen: 'GroupChat',
        params: { groupId: group.id, groupName: group.name },
      });
    } else {
      setSelectedGroup(group);
    }
  };

  const handleJoinGroup = async (group: Group) => {
    if (!user?.id) return;
    try {
      await groupsApi.joinGroup(group.id, user.id);
      Alert.alert('Joined!', `You are now a member of "${group.name}".`);
      setSelectedGroup(null);
      await loadGroups();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to join group');
    }
  };

  const handleCreateGroup = async (groupData: any) => {
    if (!user?.id) throw new Error('Not logged in');
    await groupsApi.createGroup(user.id, groupData);
    await loadGroups();
  };

  // Crags logic
  const followedAreaIds = new Set(followedAreas.map((a) => a.id));
  const sortedCrags = useMemo(() => {
    const followed = climbingAreas.filter((a) => followedAreaIds.has(a.id));
    const rest = climbingAreas.filter((a) => !followedAreaIds.has(a.id));
    return [...followed, ...rest];
  }, [climbingAreas, followedAreaIds]);

  const filteredCrags = useMemo(() => {
    if (!query.trim()) return sortedCrags.filter((a) => followedAreaIds.has(a.id));
    const q = query.toLowerCase();
    return sortedCrags.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.region?.toLowerCase().includes(q) ||
        a.country?.toLowerCase().includes(q)
    );
  }, [sortedCrags, query, followedAreaIds]);

  // Gyms logic
  const followedGymIds = new Set((user?.followedGyms ?? []));
  const sortedGyms = useMemo(() => {
    const followed = gyms.filter((g) => followedGymIds.has(g.id));
    const rest = gyms.filter((g) => !followedGymIds.has(g.id));
    return [...followed, ...rest];
  }, [gyms, followedGymIds]);

  const filteredGyms = useMemo(() => {
    if (!query.trim()) return sortedGyms.filter((g) => followedGymIds.has(g.id));
    const q = query.toLowerCase();
    return sortedGyms.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.address?.toLowerCase().includes(q)
    );
  }, [sortedGyms, query, followedGymIds]);

  // Render helpers
  const renderFriendItem = ({ item }: { item: User }) => {
    const currentGym = getFriendCurrentGym(item.id);
    return (
      <Card style={styles.listCard}>
        <TouchableOpacity
          style={styles.listCardContent}
          onPress={() => navigation.navigate('FriendProfile', { userId: item.id })}
          activeOpacity={0.75}
        >
          <View style={styles.avatarWrap}>
            {item.avatar ? (
              <Image source={{ uri: item.avatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
              </View>
            )}
          </View>
          <View style={styles.itemDetails}>
            <Text style={styles.itemName}>{item.name}</Text>
            {currentGym ? (
              <View style={styles.locationBadge}>
                <Ionicons name="location" size={12} color={colors.primary} />
                <Text style={styles.locationText}>{currentGym.name}</Text>
              </View>
            ) : (
              <Text style={styles.itemSubtitle}>{item.email}</Text>
            )}
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textFaded} />
        </TouchableOpacity>
      </Card>
    );
  };

  const renderGroupItem = ({ item }: { item: Group }) => {
    const isMember = myGroups.some((g) => g.id === item.id);
    const isAdmin = item.role === 'admin';
    return (
      <Card style={styles.listCard}>
        <TouchableOpacity
          style={styles.listCardContent}
          onPress={() => handleGroupTap(item)}
          activeOpacity={0.75}
        >
          <View style={styles.groupIcon}>
            <Ionicons name="people" size={22} color={colors.primary} />
          </View>
          <View style={styles.itemDetails}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemSubtitle}>
              {item.memberCount} members{item.locationName ? ` · ${item.locationName}` : ''}
            </Text>
          </View>
          {isAdmin && (
            <TouchableOpacity
              onPress={() => {
                setQrGroupData({ id: item.id, name: item.name });
                setShowQRDisplay(true);
              }}
              hitSlop={8}
            >
              <Ionicons name="qr-code-outline" size={20} color={colors.primary} />
            </TouchableOpacity>
          )}
          {!isMember && (
            <TouchableOpacity
              style={styles.joinButton}
              onPress={() => handleJoinGroup(item)}
            >
              <Text style={styles.joinButtonText}>Join</Text>
            </TouchableOpacity>
          )}
          {isMember && !isAdmin && (
            <Ionicons name="chevron-forward" size={18} color={colors.textFaded} />
          )}
        </TouchableOpacity>
      </Card>
    );
  };

  const renderCragItem = ({ item }: { item: ClimbingArea }) => {
    const isFollowed = followedAreaIds.has(item.id);
    return (
      <Card style={styles.listCard}>
        <TouchableOpacity
          style={styles.listCardContent}
          onPress={() => navigation.navigate('AreaDetail', { areaId: item.id })}
          activeOpacity={0.75}
        >
          <View style={styles.placeIcon}>
            <Ionicons name="trail-sign" size={22} color={colors.secondary} />
          </View>
          <View style={styles.itemDetails}>
            <Text style={styles.itemName}>{item.name}</Text>
            {(item.region || item.country) && (
              <Text style={styles.itemSubtitle}>
                {[item.region, item.country].filter(Boolean).join(', ')}
              </Text>
            )}
          </View>
          {isFollowed && (
            <Ionicons name="heart" size={16} color={colors.primary} />
          )}
          <Ionicons name="chevron-forward" size={18} color={colors.textFaded} style={{ marginLeft: 4 }} />
        </TouchableOpacity>
      </Card>
    );
  };

  const renderGymItem = ({ item }: { item: Gym }) => {
    const isFollowed = followedGymIds.has(item.id);
    return (
      <Card style={styles.listCard}>
        <TouchableOpacity
          style={styles.listCardContent}
          onPress={() => navigation.navigate('GymDetail', { gymId: item.id })}
          activeOpacity={0.75}
        >
          <View style={styles.placeIcon}>
            <Ionicons name="barbell" size={22} color={colors.secondary} />
          </View>
          <View style={styles.itemDetails}>
            <Text style={styles.itemName}>{item.name}</Text>
            {item.address && (
              <Text style={styles.itemSubtitle} numberOfLines={1}>{item.address}</Text>
            )}
          </View>
          {isFollowed && (
            <Ionicons name="heart" size={16} color={colors.primary} />
          )}
          <Ionicons name="chevron-forward" size={18} color={colors.textFaded} style={{ marginLeft: 4 }} />
        </TouchableOpacity>
      </Card>
    );
  };

  const renderListHeader = () => {
    if (activeSlice === 'friends') {
      return (
        <View style={styles.sliceHeader}>
          <TouchableOpacity style={styles.actionChip} onPress={() => setShowQRDisplay(true)}>
            <Ionicons name="qr-code-outline" size={18} color={colors.primary} />
            <Text style={styles.actionChipText}>Show My Code</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionChip} onPress={() => setShowQRScanner(true)}>
            <Ionicons name="scan-outline" size={18} color={colors.primary} />
            <Text style={styles.actionChipText}>Scan</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (activeSlice === 'groups') {
      return (
        <View style={styles.sliceHeader}>
          <TouchableOpacity style={styles.actionChip} onPress={() => setShowCreateGroupModal(true)}>
            <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
            <Text style={styles.actionChipText}>Create Group</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionChip} onPress={() => setShowQRScanner(true)}>
            <Ionicons name="scan-outline" size={18} color={colors.primary} />
            <Text style={styles.actionChipText}>Scan QR</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (activeSlice === 'crags' && !query.trim()) {
      return (
        <Text style={styles.sliceHint}>Your followed crags — search to discover more</Text>
      );
    }
    if (activeSlice === 'gyms' && !query.trim()) {
      return (
        <Text style={styles.sliceHint}>Your followed gyms — search to discover more</Text>
      );
    }
    return null;
  };

  const getListData = () => {
    switch (activeSlice) {
      case 'friends': return filteredFriends;
      case 'groups': return filteredGroups;
      case 'crags': return filteredCrags;
      case 'gyms': return filteredGyms;
    }
  };

  const getRenderItem = () => {
    switch (activeSlice) {
      case 'friends': return renderFriendItem as any;
      case 'groups': return renderGroupItem as any;
      case 'crags': return renderCragItem as any;
      case 'gyms': return renderGymItem as any;
    }
  };

  const showMapFAB = activeSlice === 'crags' || activeSlice === 'gyms';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={[styles.headerArea, { paddingTop: insets.top }]}>
        {/* Segment slider */}
        <View style={styles.segmentRow}>
          {SLICES.map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={[styles.segmentItem, activeSlice === key && styles.segmentItemActive]}
              onPress={() => { setActiveSlice(key); setQuery(''); }}
            >
              <Text style={[styles.segmentText, activeSlice === key && styles.segmentTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Search bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder={
              isOffline
                ? 'Search cached results (offline)...'
                : activeSlice === 'friends' ? 'Search friends...'
                : activeSlice === 'groups' ? 'Search groups...'
                : activeSlice === 'crags' ? 'Search crags...'
                : 'Search gyms...'
            }
            placeholderTextColor={colors.textFaded}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {isOffline && (
          <View style={styles.offlineNotice}>
            <Ionicons name="cloud-offline-outline" size={14} color={colors.textMuted} />
            <Text style={styles.offlineNoticeText}>Showing saved data — you're offline.</Text>
          </View>
        )}
      </View>

      {/* List */}
      <FlatList
        data={getListData()}
        renderItem={getRenderItem()}
        keyExtractor={(item: any) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={renderListHeader()}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons
              name={
                activeSlice === 'friends' ? 'people-outline'
                : activeSlice === 'groups' ? 'people-circle-outline'
                : activeSlice === 'crags' ? 'trail-sign-outline'
                : 'barbell-outline'
              }
              size={48}
              color={colors.textFaded}
            />
            <Text style={styles.emptyText}>
              {activeSlice === 'friends' ? 'No friends yet'
               : activeSlice === 'groups' ? 'No groups found'
               : activeSlice === 'crags' ? (query ? 'No crags match' : 'Follow crags to see them here')
               : (query ? 'No gyms match' : 'Follow gyms to see them here')}
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      />

      {/* Floating map button */}
      {showMapFAB && (
        <TouchableOpacity
          style={[styles.mapFAB, { bottom: insets.bottom + 16 }]}
          onPress={() =>
            navigation.navigate('AreasMap', { focus: activeSlice === 'gyms' ? 'gyms' : 'crags' })
          }
        >
          <Ionicons name="map" size={22} color="#fff" />
          <Text style={styles.mapFABText}>Map</Text>
        </TouchableOpacity>
      )}

      {/* Group detail modal (for non-member public groups) */}
      <Modal
        visible={!!selectedGroup}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedGroup(null)}
      >
        {selectedGroup && (
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedGroup.name}</Text>
              <TouchableOpacity onPress={() => setSelectedGroup(null)}>
                <Ionicons name="close" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {selectedGroup.description && (
                <Text style={styles.modalDescription}>{selectedGroup.description}</Text>
              )}
              <Text style={styles.modalMeta}>
                {selectedGroup.memberCount} members · {selectedGroup.privacy}
              </Text>
              <Button title="Request to Join" onPress={() => handleJoinGroup(selectedGroup)} />
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* Modals */}
      <QRCodeDisplayModal
        visible={showQRDisplay}
        onClose={() => { setShowQRDisplay(false); setQrGroupData(null); }}
        groupId={qrGroupData?.id}
        groupName={qrGroupData?.name}
      />
      <QRCodeScannerModal
        visible={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onScan={activeSlice === 'friends' ? handleQRScanFriend : handleQRScanGroup}
        mode={activeSlice === 'friends' ? 'user' : 'any'}
      />
      <CreateGroupModal
        visible={showCreateGroupModal}
        onClose={() => setShowCreateGroupModal(false)}
        onCreate={handleCreateGroup}
      />
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
  offlineNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    marginHorizontal: 12,
    marginBottom: 8,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  offlineNoticeText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  segmentRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  segmentItemActive: {
    borderBottomColor: colors.primary,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textMuted,
  },
  segmentTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    padding: 0,
  },
  listContent: { padding: 16, paddingBottom: 80 },
  sliceHeader: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionChipText: { fontSize: 13, color: colors.primary, fontWeight: '500' },
  sliceHint: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  listCard: { marginBottom: 10 },
  listCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarWrap: {},
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  groupIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemDetails: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '600', color: colors.text },
  itemSubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  locationBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  locationText: { fontSize: 12, color: colors.primary, fontWeight: '500' },
  joinButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: colors.primaryMuted,
    borderRadius: 14,
  },
  joinButtonText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyText: { fontSize: 15, color: colors.textMuted },
  mapFAB: {
    position: 'absolute',
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: colors.primary,
    borderRadius: 28,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  mapFABText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  modalContainer: { flex: 1, backgroundColor: colors.surface },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingTop: 52,
  },
  modalTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
  modalBody: { flex: 1, padding: 16 },
  modalDescription: { fontSize: 16, color: colors.text, marginBottom: 12 },
  modalMeta: { fontSize: 14, color: colors.textMuted, marginBottom: 20 },
});

export default FindScreen;
