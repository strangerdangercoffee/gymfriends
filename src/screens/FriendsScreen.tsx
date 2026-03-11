import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// Removed useFocusEffect import - using useEffect instead to reduce API calls
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { User, Gym } from '../types';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import FriendInvitationModal from '../components/FriendInvitationModal';
import OnboardingInviteFriends from '../components/OnboardingInviteFriends';
import QRCodeDisplayModal from '../components/QRCodeDisplayModal';
import QRCodeScannerModal from '../components/QRCodeScannerModal';

const FriendsScreen: React.FC = () => {
  const { friends, gyms, presence, isLoading, addFriend, addFriendInstant, refreshData } = useApp();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showQRDisplay, setShowQRDisplay] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [friendPhone, setFriendPhone] = useState('');
  const [addingFriend, setAddingFriend] = useState(false);
  const [inviteModalInitialPhone, setInviteModalInitialPhone] = useState('');
  const [showInviteFriendsModal, setShowInviteFriendsModal] = useState(false);

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
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Refresh data when screen comes into focus
  // OPTIMIZATION: Only refresh on initial mount, rely on real-time subscriptions for updates
  // Removed useFocusEffect refresh - real-time subscriptions handle updates automatically
  useEffect(() => {
    if (user?.id) {
      refreshData().catch((error) => {
        console.error('Error refreshing data:', error);
      });
    }
  }, [user?.id]); // Only refresh when user changes, not on every focus

  const handleAddFriend = async () => {
    if (!friendPhone.trim()) {
      Alert.alert('Error', 'Please enter a valid phone number');
      return;
    }

    setAddingFriend(true);
    try {
      await addFriend(friendPhone.trim());
      setFriendPhone('');
      setShowAddFriend(false);
      Alert.alert('Success', 'Friend added successfully!');
    } catch (error: any) {
      if (error.message.includes('not found')) {
        setInviteModalInitialPhone(friendPhone.trim());
        Alert.alert(
          'User Not Found',
          'No user found with this phone number. Would you like to invite them to join Gym Friends?',
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
        Alert.alert('Error', error.message || 'Failed to add friend. Please check the phone number.');
      }
    } finally {
      setAddingFriend(false);
    }
  };

  const handleQRScan = async (friendId: string, friendName: string) => {
    try {
      await addFriendInstant(friendId);
      setShowQRScanner(false);
      Alert.alert(
        'Friend Added!',
        `You and ${friendName} are now friends!`,
        [{ text: 'Awesome!', style: 'default' }]
      );
    } catch (error: any) {
      setShowQRScanner(false);
      if (error.message.includes('Already friends')) {
        Alert.alert('Already Friends', `You're already friends with ${friendName}!`);
      } else {
        Alert.alert('Error', 'Failed to add friend. Please try again.');
      }
    }
  };

  const renderFriendAtGym = ({ item }: { item: User }) => {
    const currentGym = getFriendCurrentGym(item.id);
    
    return (
      <Card style={styles.friendCard}>
        <View style={styles.friendHeader}>
          <View style={styles.friendInfo}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {item.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.friendDetails}>
              <Text style={styles.friendName}>{item.name}</Text>
              <View style={styles.locationInfo}>
                <Ionicons name="location" size={14} color="#34C759" />
                <Text style={styles.locationText}>
                  At {currentGym?.name || 'Unknown Gym'}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.statusIndicator}>
            <View style={styles.activeDot} />
          </View>
        </View>
      </Card>
    );
  };

  const renderFriendNotAtGym = ({ item }: { item: User }) => (
    <Card style={styles.friendCard}>
      <View style={styles.friendHeader}>
        <View style={styles.friendInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {item.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.friendDetails}>
            <Text style={styles.friendName}>{item.name}</Text>
            <Text style={styles.offlineText}>Not at gym</Text>
          </View>
        </View>
        <View style={styles.statusIndicator}>
          <View style={styles.inactiveDot} />
        </View>
      </View>
    </Card>
  );

  const renderAddFriendForm = () => (
    <Card style={styles.addFriendCard}>
      <Text style={styles.addFriendTitle}>Add Friend</Text>
      <Input
        label="Phone Number"
        placeholder="Enter friend's phone number"
        value={friendPhone}
        onChangeText={setFriendPhone}
        keyboardType="phone-pad"
        autoCapitalize="none"
        style={styles.addFriendInput}
      />
      <View style={styles.addFriendActions}>
        <Button
          title="Cancel"
          variant="outline"
          onPress={() => {
            setShowAddFriend(false);
            setFriendPhone('');
          }}
          style={styles.cancelButton}
        />
        <Button
          title="Add Friend"
          onPress={handleAddFriend}
          loading={addingFriend}
          style={styles.addButton}
        />
      </View>
    </Card>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="people-outline" size={64} color="#C7C7CC" />
      <Text style={styles.emptyTitle}>No friends yet</Text>
      <Text style={styles.emptySubtitle}>
        Add friends to see when they're at the gym
      </Text>
      <Button
        title="Add Friend"
        onPress={() => setShowAddFriend(true)}
        style={styles.addButton}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header Actions */}
      {/* QR Code Action Buttons */}
      <View style={styles.qrActionContainer}>
        <TouchableOpacity
          style={styles.qrActionButton}
          onPress={() => setShowQRDisplay(true)}
        >
          <View style={styles.qrIconContainer}>
            <Ionicons name="qr-code-outline" size={32} color="#007AFF" />
          </View>
          <Text style={styles.qrActionText}>Show My Code</Text>
          <Text style={styles.qrActionSubtext}>Let others scan</Text>
        </TouchableOpacity>

        <View style={styles.qrDivider} />

        <TouchableOpacity
          style={styles.qrActionButton}
          onPress={() => setShowQRScanner(true)}
        >
          <View style={styles.qrIconContainer}>
            <Ionicons name="scan-outline" size={32} color="#34C759" />
          </View>
          <Text style={styles.qrActionText}>Scan QR Code</Text>
          <Text style={styles.qrActionSubtext}>Add instantly</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.headerActions}>
        <Button
          title="Invite Friends"
          variant="outline"
          onPress={() => setShowInviteFriendsModal(true)}
          style={styles.headerButton}
        />
        <Button
          title="Add Friend"
          onPress={() => setShowAddFriend(true)}
          style={styles.headerButton}
        />
      </View>

      {/* Add Friend Form */}
      {showAddFriend && renderAddFriendForm()}

      {/* Modals */}
      <FriendInvitationModal
        visible={showInviteModal}
        onClose={() => {
          setShowInviteModal(false);
          setInviteModalInitialPhone('');
        }}
        onInvitationSent={() => {
          setShowInviteModal(false);
          setInviteModalInitialPhone('');
          refreshData();
        }}
        initialPhone={inviteModalInitialPhone}
      />

      <Modal
        visible={showInviteFriendsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowInviteFriendsModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: '#F2F2F7' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#E5E5E7' }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#000' }}>Invite friends</Text>
            <TouchableOpacity onPress={() => setShowInviteFriendsModal(false)} hitSlop={12}>
              <Ionicons name="close" size={28} color="#000" />
            </TouchableOpacity>
          </View>
          <OnboardingInviteFriends
            onComplete={() => {
              setShowInviteFriendsModal(false);
              refreshData();
            }}
            onSkip={() => setShowInviteFriendsModal(false)}
          />
        </View>
      </Modal>

      <QRCodeDisplayModal
        visible={showQRDisplay}
        onClose={() => setShowQRDisplay(false)}
      />

      <QRCodeScannerModal
        visible={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onScan={handleQRScan}
      />

      {/* Friends List */}
      {friends.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={[
            ...friendsAtGym.map(friend => ({ ...friend, isAtGym: true })),
            ...friendsNotAtGym.map(friend => ({ ...friend, isAtGym: false })),
          ]}
          renderItem={({ item }) => 
            item.isAtGym ? renderFriendAtGym({ item }) : renderFriendNotAtGym({ item })
          }
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#007AFF"
            />
          }
          ListHeaderComponent={
            friendsAtGym.length > 0 ? (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  At the Gym ({friendsAtGym.length})
                </Text>
              </View>
            ) : null
          }
          ListFooterComponent={
            friendsNotAtGym.length > 0 ? (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  Not at Gym ({friendsNotAtGym.length})
                </Text>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  qrActionContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  qrActionButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  qrIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  qrActionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  qrActionSubtext: {
    fontSize: 12,
    color: '#8E8E93',
  },
  qrDivider: {
    width: 1,
    backgroundColor: '#E5E5E7',
    marginVertical: 16,
  },
  headerActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  headerButton: {
    flex: 1,
  },
  addFriendCard: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  addFriendTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 16,
  },
  addFriendInput: {
    marginBottom: 16,
  },
  addFriendActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
  },
  addButton: {
    flex: 1,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  sectionHeader: {
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  friendCard: {
    marginBottom: 12,
  },
  friendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
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
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 14,
    color: '#34C759',
    marginLeft: 4,
    fontWeight: '500',
  },
  offlineText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  statusIndicator: {
    padding: 8,
  },
  activeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#34C759',
  },
  inactiveDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#C7C7CC',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 24,
  },
});

export default FriendsScreen;
