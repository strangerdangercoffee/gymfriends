import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ScrollView,
  TextInput,
  Modal,
  Image,
  StatusBar,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
// import { GroupsStackParamList } from '../types'; // Commented out if not exported
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { groupsApi, chatApi } from '../services/api';
import { User, Gym } from '../types';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import FriendInvitationModal from '../components/FriendInvitationModal';
import QRCodeDisplayModal from '../components/QRCodeDisplayModal';
import QRCodeScannerModal from '../components/QRCodeScannerModal';
import CreateGroupModal from '../components/CreateGroupModal';

// type ConnectionsScreenNavigationProp = StackNavigationProp<GroupsStackParamList, 'GroupsMain'>;
type ConnectionsScreenNavigationProp = any; // Temporary fix

interface Group {
  id: string;
  name: string;
  description?: string;
  privacy: 'public' | 'private' | 'invite-only';
  locationType?: 'gym' | 'city' | 'crag';
  locationName?: string;
  memberCount: number;
  role: 'admin' | 'moderator' | 'member';
}

type TabType = 'friends' | 'groups';

const ConnectionsScreen: React.FC = () => {
  const navigation = useNavigation<ConnectionsScreenNavigationProp>();
  const { friends, gyms, presence, isLoading, addFriend, addFriendInstant, refreshData } = useApp();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  
  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('friends');
  
  // Friends state
  const [refreshing, setRefreshing] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showQRDisplay, setShowQRDisplay] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [friendEmail, setFriendEmail] = useState('');
  const [addingFriend, setAddingFriend] = useState(false);
  
  // Groups state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const closeSearchModal = () => {
    setSearchModalVisible(false);
  };
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [qrGroupData, setQrGroupData] = useState<{ id: string; name: string } | null>(null);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [publicGroups, setPublicGroups] = useState<Group[]>([]);

  // Get friends who are currently at gyms
  const friendsAtGym = friends.filter(friend => {
    return presence.some(p => p.userId === friend.id && p.isActive);
  });

  // Get friends who are not at gyms
  const friendsNotAtGym = friends.filter(friend => {
    return !presence.some(p => p.userId === friend.id && p.isActive);
  });

  const getGymById = (gymId: string): Gym | undefined => {
    return gyms.find(gym => gym.id === gymId);
  };

  const getFriendCurrentGym = (friendId: string): Gym | undefined => {
    const friendPresence = presence.find(p => p.userId === friendId && p.isActive);
    if (friendPresence) {
      return getGymById(friendPresence.gymId);
    }
    return undefined;
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshData();
      if (user?.id && activeTab === 'groups') {
        const groups = await groupsApi.getUserGroups(user.id);
        setMyGroups(groups);
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      refreshData().catch((error) => {
        console.error('Error refreshing data:', error);
      });
      if (activeTab === 'groups') {
        groupsApi.getUserGroups(user.id).then(setMyGroups).catch(console.error);
      }
    }
  }, [user?.id, activeTab]);

  // Friends handlers
  const handleAddFriend = async () => {
    if (!friendEmail.trim()) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setAddingFriend(true);
    try {
      await addFriend(friendEmail.trim());
      setFriendEmail('');
      setShowAddFriend(false);
      Alert.alert('Success', 'Friend added successfully!');
    } catch (error: any) {
      if (error.message.includes('not found')) {
        Alert.alert(
          'User Not Found',
          'No user found with this email address. Would you like to invite them to join Gym Friends?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Send Invitation',
              onPress: () => {
                setShowAddFriend(false);
                setShowInviteModal(true);
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', error.message || 'Failed to add friend');
      }
    } finally {
      setAddingFriend(false);
    }
  };

  const handleQRScanFriend = async (userId: string, userName: string) => {
    try {
      await addFriendInstant(userId);
      Alert.alert('Success', `${userName} has been added as a friend!`);
      setShowQRScanner(false);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to add friend');
      setShowQRScanner(false);
    }
  };

  const handleQRScanGroup = async (data: string) => {
    try {
      let qrData;
      try {
        qrData = JSON.parse(data);
      } catch (parseError) {
        Alert.alert('Error', 'Invalid QR code format');
        setShowQRScanner(false);
        return;
      }

      if (!user?.id) {
        Alert.alert('Error', 'User not logged in');
        setShowQRScanner(false);
        return;
      }

      if (qrData.type === 'gymfriends_group_invitation' && qrData.groupId) {
        await groupsApi.joinGroupFromQR(qrData.groupId, user.id);
        Alert.alert('Success', 'You have joined the group!');
        setShowQRScanner(false);
        await handleRefresh();
      } else if (qrData.type === 'gymfriends_user' && qrData.userId) {
        // Handle friend QR code when in groups tab
        await addFriendInstant(qrData.userId);
        Alert.alert('Success', 'Friend added!');
        setShowQRScanner(false);
      } else {
        Alert.alert('Error', 'Invalid QR code type');
        setShowQRScanner(false);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to process QR code');
      setShowQRScanner(false);
    }
  };

  // Groups handlers
  const openSearchModal = async () => {
    setSearchQuery('');
    setSearchModalVisible(true);
    try {
      const publicGroups = await groupsApi.searchPublicGroups();
      setPublicGroups(publicGroups);
    } catch (error) {
      console.error('Error fetching public groups:', error);
    }
  };

  const handleGroupPress = (group: Group) => {
    setSelectedGroup(group);
  };

  const handleOpenChat = () => {
    if (!selectedGroup) return;
    const groupId = selectedGroup.id;
    const groupName = selectedGroup.name;
    setSelectedGroup(null); // Close the modal
    navigation.navigate('GroupChat', {
      groupId,
      groupName,
    });
  };

  const handleShowGroupQR = () => {
    if (!selectedGroup) return;
    setQrGroupData({ id: selectedGroup.id, name: selectedGroup.name });
    setSelectedGroup(null);
    setShowQRDisplay(true);
  };

  const handleCreateGroup = async (groupData: {
    name: string;
    description?: string;
    privacy: 'public' | 'private' | 'invite-only';
    locationType?: 'gym' | 'city' | 'crag';
    associatedGymId?: string;
    associatedCity?: string;
    associatedCrag?: string;
    invitedUserIds: string[];
  }) => {
    if (!user?.id) {
      throw new Error('User not logged in');
    }

    try {
      await groupsApi.createGroup(user.id, groupData);
      await handleRefresh();
    } catch (error) {
      throw error;
    }
  };

  const renderFriendCard = ({ item }: { item: User }) => {
    const currentGym = getFriendCurrentGym(item.id);
    const isAtGym = !!currentGym;

    return (
      <Card style={styles.friendCard}>
        <TouchableOpacity style={styles.friendCardContent}>
          <View style={styles.friendInfo}>
            {item.avatar ? (
              <Image source={{ uri: item.avatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.friendDetails}>
              <Text style={styles.friendName}>{item.name}</Text>
              <Text style={styles.friendEmail}>{item.email}</Text>
              {isAtGym && (
                <View style={styles.gymBadge}>
                  <Ionicons name="location" size={12} color="#007AFF" />
                  <Text style={styles.gymText}>{currentGym.name}</Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Card>
    );
  };

  const renderGroupCard = ({ item }: { item: Group }) => (
    <Card style={styles.groupCard}>
      <TouchableOpacity onPress={() => handleGroupPress(item)}>
        <View style={styles.groupCardContent}>
          <View style={styles.groupInfo}>
            <View style={styles.groupIcon}>
              <Ionicons name="people" size={24} color="#007AFF" />
            </View>
            <View style={styles.groupDetails}>
              <Text style={styles.groupName}>{item.name}</Text>
              {item.description && (
                <Text style={styles.groupDescription} numberOfLines={2}>
                  {item.description}
                </Text>
              )}
              <View style={styles.groupMeta}>
                <Text style={styles.memberCount}>{item.memberCount} members</Text>
                {item.locationName && (
                  <Text style={styles.locationName}> • {item.locationName}</Text>
                )}
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Card>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name={activeTab === 'friends' ? 'people-outline' : 'people-circle-outline'} size={64} color="#C7C7CC" />
      <Text style={styles.emptyStateText}>
        {activeTab === 'friends' ? 'No friends yet' : 'No groups yet'}
      </Text>
      <Text style={styles.emptyStateSubtext}>
        {activeTab === 'friends' 
          ? 'Add friends to see their workouts and gym activity'
          : 'Create or join a group to start connecting'}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      {/* Tab Selector */}
      <View style={[styles.tabContainer, { paddingTop: insets.top }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'friends' && styles.activeTab]}
          onPress={() => setActiveTab('friends')}
        >
          <Ionicons 
            name={activeTab === 'friends' ? 'people' : 'people-outline'} 
            size={20} 
            color={activeTab === 'friends' ? '#007AFF' : '#8E8E93'} 
          />
          <Text style={[styles.tabText, activeTab === 'friends' && styles.activeTabText]}>
            Friends
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'groups' && styles.activeTab]}
          onPress={() => setActiveTab('groups')}
        >
          <Ionicons 
            name={activeTab === 'groups' ? 'people-circle' : 'people-circle-outline'} 
            size={20} 
            color={activeTab === 'groups' ? '#007AFF' : '#8E8E93'} 
          />
          <Text style={[styles.tabText, activeTab === 'groups' && styles.activeTabText]}>
            Groups
          </Text>
        </TouchableOpacity>
      </View>

      {/* Friends Tab */}
      {activeTab === 'friends' && (
        <>
          {/* QR Code Actions */}
          <View style={styles.qrActionContainer}>
            <TouchableOpacity
              style={styles.qrActionButton}
              onPress={() => setShowQRDisplay(true)}
            >
              <Ionicons name="qr-code-outline" size={20} color="#007AFF" />
              <Text style={styles.qrActionText}>Show My Code</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.qrActionButton}
              onPress={() => setShowQRScanner(true)}
            >
              <Ionicons name="scan-outline" size={20} color="#007AFF" />
              <Text style={styles.qrActionText}>Scan Code</Text>
            </TouchableOpacity>
          </View>

          {/* Friends List */}
          <FlatList
            data={[...friendsAtGym, ...friendsNotAtGym]}
            renderItem={renderFriendCard}
            keyExtractor={(item) => item.id}
            contentContainerStyle={friends.length === 0 ? styles.emptyContainer : styles.listContainer}
            ListEmptyComponent={renderEmptyState}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
            }
            ListHeaderComponent={
              friends.length > 0 ? (
                <View style={styles.header}>
                  <Button
                    title="Add Friend"
                    onPress={() => setShowAddFriend(true)}
                    style={styles.addButton}
                  />
                </View>
              ) : null
            }
          />
        </>
      )}

      {/* Groups Tab */}
      {activeTab === 'groups' && (
        <>
          {/* QR Code Actions */}
          <View style={styles.qrActionContainer}>
            <TouchableOpacity
              style={styles.qrActionButton}
              onPress={() => setShowQRScanner(true)}
            >
              <Ionicons name="scan-outline" size={20} color="#007AFF" />
              <Text style={styles.qrActionText}>Scan QR Code</Text>
            </TouchableOpacity>
          </View>

          {/* Groups List */}
          <FlatList
            data={myGroups}
            renderItem={renderGroupCard}
            keyExtractor={(item) => item.id}
            contentContainerStyle={myGroups.length === 0 ? styles.emptyContainer : styles.listContainer}
            ListEmptyComponent={renderEmptyState}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
            }
            ListHeaderComponent={
              <View style={styles.header}>
                <Button
                  title="Create Group"
                  onPress={() => setShowCreateGroupModal(true)}
                  style={styles.addButton}
                />
                <Button
                  title="Search Groups"
                  onPress={openSearchModal}
                  style={styles.searchButton}
                  variant="outline"
                />
              </View>
            }
          />
        </>
      )}

      {/* Modals */}
      <Modal
        visible={showAddFriend}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddFriend(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Friend</Text>
            <TouchableOpacity onPress={() => setShowAddFriend(false)}>
              <Ionicons name="close" size={28} color="#000" />
            </TouchableOpacity>
          </View>
          <View style={styles.modalContent}>
            <Input
              placeholder="Enter friend's email"
              value={friendEmail}
              onChangeText={setFriendEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Button
              title={addingFriend ? 'Adding...' : 'Add Friend'}
              onPress={handleAddFriend}
              disabled={addingFriend || !friendEmail.trim()}
              style={styles.modalButton}
            />
          </View>
        </View>
      </Modal>

      {/* Group Detail Modal */}
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
                <Ionicons name="close" size={28} color="#000" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              {selectedGroup.description && (
                <Text style={styles.groupDescriptionFull}>{selectedGroup.description}</Text>
              )}
              <Text style={styles.groupMetaFull}>
                {selectedGroup.memberCount} members • {selectedGroup.privacy}
              </Text>
              {selectedGroup.role === 'admin' && (
                <TouchableOpacity
                  style={styles.groupActionButton}
                  onPress={handleShowGroupQR}
                >
                  <Ionicons name="qr-code-outline" size={20} color="#007AFF" />
                  <Text style={styles.groupActionText}>Show My Code</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.groupActionButton}
                onPress={handleOpenChat}
              >
                <Ionicons name="chatbubbles-outline" size={20} color="#007AFF" />
                <Text style={styles.groupActionText}>Go to Group Chat</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* Search Groups Modal */}
      <Modal
        visible={searchModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeSearchModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Search Groups</Text>
            <TouchableOpacity onPress={closeSearchModal}>
              <Ionicons name="close" size={28} color="#000" />
            </TouchableOpacity>
          </View>
          <View style={styles.modalContent}>
            <Input
              placeholder="Search groups..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchInput}
            />
            <FlatList
              data={publicGroups.filter(g => 
                g.name.toLowerCase().includes(searchQuery.toLowerCase())
              )}
              renderItem={renderGroupCard}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No groups found</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      <FriendInvitationModal
        visible={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onInvitationSent={() => {
          setShowInviteModal(false);
          setFriendEmail('');
        }}
      />

      <QRCodeDisplayModal
        visible={showQRDisplay}
        onClose={() => setShowQRDisplay(false)}
        groupId={qrGroupData?.id}
        groupName={qrGroupData?.name}
      />

      <QRCodeScannerModal
        visible={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onScan={activeTab === 'friends' ? handleQRScanFriend : handleQRScanGroup}
        mode={activeTab === 'friends' ? 'user' : 'any'}
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
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E7',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  qrActionContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E7',
  },
  qrActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    gap: 8,
  },
  qrActionText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  listContainer: {
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
  },
  header: {
    marginBottom: 16,
    gap: 12,
  },
  addButton: {
    marginBottom: 0,
  },
  searchButton: {
    marginTop: 0,
  },
  friendCard: {
    marginBottom: 12,
  },
  friendCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: 'white',
    fontSize: 20,
    fontWeight: '600',
  },
  friendDetails: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  friendEmail: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  gymBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  gymText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
  },
  groupCard: {
    marginBottom: 12,
  },
  groupCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  groupIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  groupDetails: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  groupDescription: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  groupMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberCount: {
    fontSize: 12,
    color: '#8E8E93',
  },
  locationName: {
    fontSize: 12,
    color: '#8E8E93',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E7',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalButton: {
    marginTop: 16,
  },
  searchInput: {
    marginBottom: 16,
  },
  groupDescriptionFull: {
    fontSize: 16,
    color: '#000',
    marginBottom: 16,
  },
  groupMetaFull: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 24,
  },
  groupActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
  },
  groupActionText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
});

export default ConnectionsScreen;
