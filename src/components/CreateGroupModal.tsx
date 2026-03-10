import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Gym, User } from '../types';
import Card from './Card';
import Button from './Button';
import Input from './Input';

interface CreateGroupModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (groupData: {
    name: string;
    description?: string;
    privacy: 'public' | 'private' | 'invite-only';
    locationType?: 'gym' | 'city' | 'crag';
    associatedGymId?: string;
    associatedCity?: string;
    associatedCrag?: string;
    invitedUserIds: string[];
  }) => Promise<void>;
}

const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  visible,
  onClose,
  onCreate,
}) => {
  const { friends, gyms } = useApp();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [privacy, setPrivacy] = useState<'public' | 'private' | 'invite-only'>('private');
  const [locationType, setLocationType] = useState<'gym' | 'city' | 'crag' | undefined>(undefined);
  const [selectedGymId, setSelectedGymId] = useState<string>('');
  const [city, setCity] = useState('');
  const [crag, setCrag] = useState('');
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const followedGyms = gyms.filter(gym => 
    user?.followedGyms?.includes(gym.id)
  );

  const handleToggleFriend = (friendId: string) => {
    setSelectedFriends(prev =>
      prev.includes(friendId)
        ? prev.filter(id => id !== friendId)
        : [...prev, friendId]
    );
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }

    // Validate location if location type is selected
    if (locationType === 'gym' && !selectedGymId) {
      Alert.alert('Error', 'Please select a gym');
      return;
    }
    if (locationType === 'city' && !city.trim()) {
      Alert.alert('Error', 'Please enter a city name');
      return;
    }
    if (locationType === 'crag' && !crag.trim()) {
      Alert.alert('Error', 'Please enter a crag name');
      return;
    }

    setIsCreating(true);
    try {
      await onCreate({
        name: name.trim(),
        description: description.trim() || undefined,
        privacy,
        locationType,
        associatedGymId: locationType === 'gym' ? selectedGymId : undefined,
        associatedCity: locationType === 'city' ? city.trim() : undefined,
        associatedCrag: locationType === 'crag' ? crag.trim() : undefined,
        invitedUserIds: selectedFriends,
      });
      
      // Reset form
      setName('');
      setDescription('');
      setPrivacy('private');
      setLocationType(undefined);
      setSelectedGymId('');
      setCity('');
      setCrag('');
      setSelectedFriends([]);
      
      onClose();
      Alert.alert('Success', 'Group created successfully!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create group');
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    if (!isCreating) {
      // Reset form when closing
      setName('');
      setDescription('');
      setPrivacy('private');
      setLocationType(undefined);
      setSelectedGymId('');
      setCity('');
      setCrag('');
      setSelectedFriends([]);
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} disabled={isCreating}>
            <Ionicons name="close" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.title}>Create Group</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Basic Information</Text>
            
            <Input
              label="Group Name *"
              value={name}
              onChangeText={setName}
              placeholder="Enter group name"
              style={styles.input}
            />

            <Input
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="Enter group description (optional)"
              multiline
              numberOfLines={3}
              style={styles.input}
            />

            <View style={styles.privacyContainer}>
              <Text style={styles.label}>Privacy *</Text>
              <View style={styles.privacyOptions}>
                {(['public', 'private', 'invite-only'] as const).map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.privacyOption,
                      privacy === option && styles.privacyOptionActive,
                    ]}
                    onPress={() => setPrivacy(option)}
                  >
                    <Ionicons
                      name={
                        option === 'public' ? 'globe-outline' :
                        option === 'private' ? 'lock-closed-outline' :
                        'mail-outline'
                      }
                      size={20}
                      color={privacy === option ? '#007AFF' : '#8E8E93'}
                    />
                    <Text
                      style={[
                        styles.privacyOptionText,
                        privacy === option && styles.privacyOptionTextActive,
                      ]}
                    >
                      {option === 'invite-only' ? 'Invite Only' : option.charAt(0).toUpperCase() + option.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </Card>

          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Location (Optional)</Text>
            <Text style={styles.sectionSubtitle}>
              Associate this group with a specific location
            </Text>

            <View style={styles.locationTypeContainer}>
              {(['gym', 'city', 'crag'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.locationTypeButton,
                    locationType === type && styles.locationTypeButtonActive,
                  ]}
                  onPress={() => {
                    setLocationType(type);
                    // Clear other location fields
                    if (type !== 'gym') setSelectedGymId('');
                    if (type !== 'city') setCity('');
                    if (type !== 'crag') setCrag('');
                  }}
                >
                  <Text
                    style={[
                      styles.locationTypeText,
                      locationType === type && styles.locationTypeTextActive,
                    ]}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {locationType === 'gym' && (
              <View style={styles.locationInput}>
                <Text style={styles.label}>Select Gym *</Text>
                <ScrollView style={styles.gymList} nestedScrollEnabled>
                  {followedGyms.map((gym) => (
                    <TouchableOpacity
                      key={gym.id}
                      style={[
                        styles.gymOption,
                        selectedGymId === gym.id && styles.gymOptionActive,
                      ]}
                      onPress={() => setSelectedGymId(gym.id)}
                    >
                      <Ionicons
                        name={selectedGymId === gym.id ? 'radio-button-on' : 'radio-button-off'}
                        size={20}
                        color={selectedGymId === gym.id ? '#007AFF' : '#8E8E93'}
                      />
                      <Text
                        style={[
                          styles.gymOptionText,
                          selectedGymId === gym.id && styles.gymOptionTextActive,
                        ]}
                      >
                        {gym.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                {followedGyms.length === 0 && (
                  <Text style={styles.emptyText}>
                    No followed gyms. Follow a gym first to associate it with a group.
                  </Text>
                )}
              </View>
            )}

            {locationType === 'city' && (
              <Input
                label="City Name *"
                value={city}
                onChangeText={setCity}
                placeholder="e.g., San Francisco, CA"
                style={styles.input}
              />
            )}

            {locationType === 'crag' && (
              <Input
                label="Crag Name *"
                value={crag}
                onChangeText={setCrag}
                placeholder="e.g., Yosemite Valley"
                style={styles.input}
              />
            )}
          </Card>

          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Invite Friends</Text>
            <Text style={styles.sectionSubtitle}>
              Select friends to invite to this group ({selectedFriends.length} selected)
            </Text>

            {friends.length === 0 ? (
              <Text style={styles.emptyText}>You don't have any friends yet.</Text>
            ) : (
              <ScrollView style={styles.friendsList} nestedScrollEnabled>
                {friends.map((friend) => (
                  <TouchableOpacity
                    key={friend.id}
                    style={[
                      styles.friendOption,
                      selectedFriends.includes(friend.id) && styles.friendOptionActive,
                    ]}
                    onPress={() => handleToggleFriend(friend.id)}
                  >
                    <View style={styles.friendInfo}>
                      <View style={styles.friendAvatar}>
                        <Text style={styles.friendAvatarText}>
                          {friend.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.friendName,
                          selectedFriends.includes(friend.id) && styles.friendNameActive,
                        ]}
                      >
                        {friend.name}
                      </Text>
                    </View>
                    <Ionicons
                      name={selectedFriends.includes(friend.id) ? 'checkmark-circle' : 'ellipse-outline'}
                      size={24}
                      color={selectedFriends.includes(friend.id) ? '#007AFF' : '#C7C7CC'}
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </Card>

          <View style={styles.actions}>
            <Button
              title="Cancel"
              variant="outline"
              onPress={handleClose}
              disabled={isCreating}
              style={styles.cancelButton}
            />
            <Button
              title="Create Group"
              onPress={handleCreate}
              loading={isCreating}
              style={styles.createButton}
            />
          </View>

          <View style={styles.bottomSpacing} />
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E7',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  content: {
    flex: 1,
  },
  card: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 16,
  },
  input: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
    marginBottom: 8,
  },
  privacyContainer: {
    marginTop: 8,
  },
  privacyOptions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  privacyOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E7',
    backgroundColor: '#FFFFFF',
  },
  privacyOptionActive: {
    borderColor: '#007AFF',
    backgroundColor: '#E3F2FD',
  },
  privacyOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
    marginLeft: 6,
  },
  privacyOptionTextActive: {
    color: '#007AFF',
  },
  locationTypeContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  locationTypeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E7',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  locationTypeButtonActive: {
    borderColor: '#007AFF',
    backgroundColor: '#E3F2FD',
  },
  locationTypeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
  },
  locationTypeTextActive: {
    color: '#007AFF',
  },
  locationInput: {
    marginTop: 8,
  },
  gymList: {
    maxHeight: 200,
    marginTop: 8,
  },
  gymOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E5E7',
  },
  gymOptionActive: {
    borderColor: '#007AFF',
    backgroundColor: '#E3F2FD',
  },
  gymOptionText: {
    fontSize: 16,
    color: '#000',
    marginLeft: 8,
  },
  gymOptionTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  friendsList: {
    maxHeight: 300,
    marginTop: 8,
  },
  friendOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E5E7',
  },
  friendOptionActive: {
    borderColor: '#007AFF',
    backgroundColor: '#E3F2FD',
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  friendAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  friendAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  friendName: {
    fontSize: 16,
    color: '#000',
  },
  friendNameActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    color: '#8E8E93',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16,
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
  },
  createButton: {
    flex: 1,
  },
  bottomSpacing: {
    height: 32,
  },
});

export default CreateGroupModal;
