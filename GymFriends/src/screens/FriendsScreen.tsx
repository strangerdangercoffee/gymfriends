import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { User, Gym } from '../types';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import FriendInvitationModal from '../components/FriendInvitationModal';

const FriendsScreen: React.FC = () => {
  const { friends, gyms, presence, isLoading, addFriend, refreshData } = useApp();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [friendEmail, setFriendEmail] = useState('');
  const [addingFriend, setAddingFriend] = useState(false);

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
        // User doesn't exist, show invitation option
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
        Alert.alert('Error', error.message || 'Failed to add friend. Please check the email address.');
      }
    } finally {
      setAddingFriend(false);
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
        label="Email Address"
        placeholder="Enter friend's email"
        value={friendEmail}
        onChangeText={setFriendEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        style={styles.addFriendInput}
      />
      <View style={styles.addFriendActions}>
        <Button
          title="Cancel"
          variant="outline"
          onPress={() => {
            setShowAddFriend(false);
            setFriendEmail('');
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
      <View style={styles.headerActions}>
        <Button
          title="Invite Friend"
          variant="outline"
          onPress={() => setShowInviteModal(true)}
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

      {/* Invitation Modal */}
      <FriendInvitationModal
        visible={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onInvitationSent={() => {
          setShowInviteModal(false);
          // Optionally refresh data or show success message
        }}
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
