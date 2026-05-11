import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { Gym } from '../types';
import Card from './Card';
import Button from './Button';
import Input from './Input';
import { colors } from '../theme/colors';
import {
  buildCragOptions,
  buildGymOptions,
  getCanonicalCityOptions,
  makeCanonicalCityKey,
} from '../utils/locationMatching';

interface CreateGroupModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (groupData: {
    name: string;
    description?: string;
    privacy: 'public' | 'private';
    locationType?: 'gym' | 'city' | 'crag';
    associatedGymId?: string;
    associatedCity?: string;
    associatedCrag?: string;
    invitedUserIds: string[];
    groupImageUri?: string;
  }) => Promise<void>;
}

const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  visible,
  onClose,
  onCreate,
}) => {
  const { friends, gyms, climbingAreas } = useApp();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [privacy, setPrivacy] = useState<'public' | 'private'>('private');
  const [locationType, setLocationType] = useState<'gym' | 'city' | 'crag' | undefined>(undefined);
  const [selectedGymId, setSelectedGymId] = useState<string>('');
  const [gymQuery, setGymQuery] = useState('');
  const [city, setCity] = useState('');
  const [selectedCityKey, setSelectedCityKey] = useState('');
  const [crag, setCrag] = useState('');
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [groupImageUri, setGroupImageUri] = useState<string | null>(null);

  const gymOptions = useMemo(() => buildGymOptions(gyms), [gyms]);
  const cityOptions = useMemo(() => getCanonicalCityOptions(), []);
  const cragOptions = useMemo(() => buildCragOptions(climbingAreas), [climbingAreas]);

  const filteredGymOptions = useMemo(() => {
    const q = gymQuery.trim().toLowerCase();
    if (!q) return gymOptions.slice(0, 20);
    return gymOptions.filter((option) => option.label.toLowerCase().includes(q)).slice(0, 20);
  }, [gymOptions, gymQuery]);

  const filteredCityOptions = useMemo(() => {
    const q = city.trim().toLowerCase();
    if (!q) return cityOptions.slice(0, 20);
    return cityOptions.filter((option) => option.label.toLowerCase().includes(q)).slice(0, 20);
  }, [cityOptions, city]);

  const filteredCragOptions = useMemo(() => {
    const q = crag.trim().toLowerCase();
    if (!q) return cragOptions.slice(0, 20);
    return cragOptions.filter((option) => option.label.toLowerCase().includes(q)).slice(0, 20);
  }, [cragOptions, crag]);

  const handleToggleFriend = (friendId: string) => {
    setSelectedFriends(prev =>
      prev.includes(friendId)
        ? prev.filter(id => id !== friendId)
        : [...prev, friendId]
    );
  };

  const handlePickGroupImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera roll permissions to add a group photo.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setGroupImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking group image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
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
      const matchedCity =
        locationType === 'city'
          ? cityOptions.find((option) => option.key === makeCanonicalCityKey(city.trim()))
          : undefined;
      if (locationType === 'city' && (!selectedCityKey || !matchedCity || matchedCity.key !== selectedCityKey)) {
        Alert.alert('Error', 'Please select a city from the suggestions');
        setIsCreating(false);
        return;
      }

      await onCreate({
        name: name.trim(),
        description: description.trim() || undefined,
        privacy,
        locationType,
        associatedGymId: locationType === 'gym' ? selectedGymId : undefined,
        associatedCity: locationType === 'city' ? matchedCity?.label : undefined,
        associatedCrag: locationType === 'crag' ? crag.trim() : undefined,
        invitedUserIds: selectedFriends,
        groupImageUri: groupImageUri || undefined,
      });
      
      // Reset form
      setName('');
      setDescription('');
      setPrivacy('private');
      setLocationType(undefined);
      setSelectedGymId('');
      setGymQuery('');
      setCity('');
      setSelectedCityKey('');
      setCrag('');
      setSelectedFriends([]);
      setGroupImageUri(null);
      
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
      setGymQuery('');
      setCity('');
      setSelectedCityKey('');
      setCrag('');
      setSelectedFriends([]);
      setGroupImageUri(null);
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
            <Ionicons name="close" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>Create Group</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Basic Information</Text>
            
            <TouchableOpacity onPress={handlePickGroupImage} style={styles.groupImageTouchable}>
              {groupImageUri ? (
                <Image source={{ uri: groupImageUri }} style={styles.groupImagePreview} />
              ) : (
                <View style={styles.groupImagePlaceholder}>
                  <Ionicons name="camera-outline" size={32} color={colors.textMuted} />
                  <Text style={styles.groupImagePlaceholderText}>Add group photo</Text>
                </View>
              )}
            </TouchableOpacity>
            
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
                {(['public', 'private'] as const).map((option) => (
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
                        'lock-closed-outline'
                      }
                      size={20}
                      color={privacy === option ? colors.primary : colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.privacyOptionText,
                        privacy === option && styles.privacyOptionTextActive,
                      ]}
                    >
                      {option.charAt(0).toUpperCase() + option.slice(1)}
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
                    if (type !== 'gym') {
                      setSelectedGymId('');
                      setGymQuery('');
                    }
                    if (type !== 'city') setCity('');
                    if (type !== 'city') setSelectedCityKey('');
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
                <Input
                  label="Gym Name *"
                  value={gymQuery}
                  onChangeText={(value) => {
                    setGymQuery(value);
                    setSelectedGymId('');
                  }}
                  placeholder="Start typing a gym..."
                  style={styles.input}
                />
                <ScrollView style={styles.suggestionList} nestedScrollEnabled>
                  {filteredGymOptions.map((option) => (
                    <TouchableOpacity
                      key={option.key}
                      style={[
                        styles.suggestionOption,
                        selectedGymId === option.key && styles.gymOptionActive,
                      ]}
                      onPress={() => {
                        setSelectedGymId(option.key);
                        setGymQuery(option.label);
                      }}
                    >
                      <Ionicons
                        name={selectedGymId === option.key ? 'radio-button-on' : 'radio-button-off'}
                        size={20}
                        color={selectedGymId === option.key ? colors.primary : colors.textMuted}
                      />
                      <Text
                        style={[
                          styles.suggestionOptionText,
                          selectedGymId === option.key && styles.gymOptionTextActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                {gyms.length === 0 && (
                  <Text style={styles.emptyText}>
                    No gyms found.
                  </Text>
                )}
              </View>
            )}

            {locationType === 'city' && (
              <View>
                <Input
                  label="City Name *"
                  value={city}
                  onChangeText={(value) => {
                    setCity(value);
                    setSelectedCityKey('');
                  }}
                  placeholder="Start typing a city..."
                  style={styles.input}
                />
                <ScrollView style={styles.suggestionList} nestedScrollEnabled>
                  {filteredCityOptions.map((option) => (
                    <TouchableOpacity
                      key={option.key}
                      style={styles.suggestionOption}
                      onPress={() => {
                        setCity(option.label);
                        setSelectedCityKey(option.key);
                      }}
                    >
                      <Ionicons name="location-outline" size={16} color={colors.textMuted} />
                      <Text style={styles.suggestionOptionText}>{option.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {locationType === 'crag' && (
              <View>
                <Input
                  label="Crag Name *"
                  value={crag}
                  onChangeText={setCrag}
                  placeholder="Start typing a crag..."
                  style={styles.input}
                />
                <ScrollView style={styles.suggestionList} nestedScrollEnabled>
                  {filteredCragOptions.map((option) => (
                    <TouchableOpacity
                      key={option.key}
                      style={styles.suggestionOption}
                      onPress={() => setCrag(option.label)}
                    >
                      <Ionicons name="trail-sign-outline" size={16} color={colors.textMuted} />
                      <Text style={styles.suggestionOptionText}>{option.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
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
                      color={selectedFriends.includes(friend.id) ? colors.primary : colors.textFaded}
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
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
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
    color: colors.text,
    marginBottom: 8,
  },
  groupImageTouchable: {
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  groupImagePreview: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  groupImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupImagePlaceholderText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 16,
  },
  input: {
    marginBottom: 16,
    color: colors.text,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
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
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  privacyOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  privacyOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textMuted,
    marginLeft: 6,
  },
  privacyOptionTextActive: {
    color: colors.primary,
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
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  locationTypeButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  locationTypeText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textMuted,
  },
  locationTypeTextActive: {
    color: colors.primary,
  },
  locationInput: {
    marginTop: 8,
  },
  gymOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  gymOptionTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  suggestionList: {
    maxHeight: 180,
    marginTop: -8,
    marginBottom: 8,
  },
  suggestionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  suggestionOptionText: {
    fontSize: 15,
    color: colors.text,
    marginLeft: 8,
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
    backgroundColor: colors.surface,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  friendOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
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
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  friendAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
  friendName: {
    fontSize: 16,
    color: colors.text,
  },
  friendNameActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
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
