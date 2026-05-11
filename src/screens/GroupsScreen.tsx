import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  RefreshControl,
  ScrollView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// Removed useFocusEffect import - using useEffect instead to reduce API calls
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { groupsApi, avatarsApi } from '../services/api';
import Card from '../components/Card';
import Button from '../components/Button';
import QRCodeDisplayModal from '../components/QRCodeDisplayModal';
import QRCodeScannerModal from '../components/QRCodeScannerModal';
import CreateGroupModal from '../components/CreateGroupModal';
import { colors } from '../theme/colors';
import {
  buildCragOptions,
  buildGymOptions,
  getCanonicalCityOptions,
  makeCanonicalLocationKey,
} from '../utils/locationMatching';

interface Group {
  id: string;
  name: string;
  description?: string;
  privacy: 'public' | 'private';
  locationType?: 'gym' | 'city' | 'crag';
  locationName?: string;
  avatarUrl?: string;
  memberCount: number;
  role: 'admin' | 'moderator' | 'member';
}

const GroupsScreen: React.FC = () => {
  const { user } = useAuth();
  const { refreshData, gyms, climbingAreas } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLocationType, setSearchLocationType] = useState<'gym' | 'city' | 'crag' | undefined>(undefined);
  const [searchLocationValue, setSearchLocationValue] = useState('');
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [qrGroupData, setQrGroupData] = useState<{ id: string; name: string } | null>(null);
  const [showQRDisplay, setShowQRDisplay] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);

  // Mock data - replace with actual API calls later
  const [myGroups, setMyGroups] = useState<Group[]>([
    // This will be populated from API
  ]);

  const [publicGroups, setPublicGroups] = useState<Group[]>([
    // This will be populated from API when searching
  ]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshData();
      if (user?.id) {
        const groups = await groupsApi.getUserGroups(user.id);
        setMyGroups(groups);
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // OPTIMIZATION: Only refresh on initial mount, rely on real-time subscriptions for updates
  // Removed useFocusEffect refresh - real-time subscriptions handle updates automatically
  useEffect(() => {
    if (user?.id) {
      handleRefresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]); // Only refresh when user changes, not on every focus

  const openSearchModal = async () => {
    setSearchQuery('');
    setSearchLocationType(undefined);
    setSearchLocationValue('');
    setSearchModalVisible(true);
    try {
      const publicGroups = await groupsApi.searchPublicGroups();
      setPublicGroups(publicGroups);
    } catch (error) {
      console.error('Error fetching public groups:', error);
    }
  };

  const closeSearchModal = () => {
    setSearchModalVisible(false);
    setSearchQuery('');
    setSearchLocationType(undefined);
    setSearchLocationValue('');
  };

  const handleGroupPress = (group: Group) => {
    setSelectedGroup(group);
  };

  const handleCloseGroupDetail = () => {
    setSelectedGroup(null);
  };

  const handleJoinGroup = async (group: Group) => {
    try {
      // TODO: Implement join group API call
      // await groupsApi.joinGroup(group.id, user?.id);
      Alert.alert('Success', `Joined ${group.name}`);
      closeSearchModal();
      handleRefresh();
    } catch (error) {
      Alert.alert('Error', 'Failed to join group');
    }
  };

  const handleQRScan = async (data: string) => {
    try {
      // Parse QR code data
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

      // Handle group invitation QR code
      if (qrData.type === 'gymfriends_group_invitation' && qrData.groupId) {
        await groupsApi.joinGroupFromQR(qrData.groupId, user.id);
        Alert.alert('Success', `Joined ${qrData.groupName || 'group'} via QR code!`);
        setShowQRScanner(false);
        handleRefresh();
      } else if (qrData.type === 'gymfriends_user') {
        // User QR code - redirect to friends or show message
        Alert.alert(
          'User QR Code',
          'This QR code is for adding friends. Please use the Friends screen to scan user QR codes.'
        );
        setShowQRScanner(false);
      } else {
        Alert.alert('Error', 'Unknown QR code type');
        setShowQRScanner(false);
      }
    } catch (error: any) {
      setShowQRScanner(false);
      Alert.alert('Error', error.message || 'Failed to join group');
    }
  };

  const handleOpenChat = () => {
    if (!selectedGroup) return;
    // TODO: Navigate to group chat screen
    // navigation.navigate('GroupChat', { groupId: selectedGroup.id });
    Alert.alert('Coming Soon', 'Group chat will be available soon!');
  };

  const handleCreateGroup = async (groupData: {
    name: string;
    description?: string;
    privacy: 'public' | 'private';
    locationType?: 'gym' | 'city' | 'crag';
    associatedGymId?: string;
    associatedCity?: string;
    associatedCrag?: string;
    invitedUserIds: string[];
    groupImageUri?: string;
  }) => {
    if (!user?.id) {
      throw new Error('User not logged in');
    }

    try {
      const { groupImageUri, ...rest } = groupData;
      const group = await groupsApi.createGroup(user.id, rest);
      if (groupImageUri) {
        const avatarUrl = await avatarsApi.uploadGroupAvatar(group.group_id, groupImageUri);
        await groupsApi.updateGroup(group.group_id, { avatarUrl });
      }
      // Refresh groups after creation
      await handleRefresh();
    } catch (error) {
      throw error;
    }
  };

  const renderGroupCard = ({ item }: { item: Group }) => (
    <Card style={styles.groupCard}>
      <TouchableOpacity
        onPress={() => handleGroupPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.groupHeader}>
          <View style={styles.groupInfo}>
            {item.avatarUrl ? (
              <Image source={{ uri: item.avatarUrl }} style={styles.groupIconImage} />
            ) : (
              <View style={styles.groupIcon}>
                <Ionicons name="people" size={24} color="#007AFF" />
              </View>
            )}
            <View style={styles.groupDetails}>
              <Text style={styles.groupName}>{item.name}</Text>
              {item.description && (
                <Text style={styles.groupDescription} numberOfLines={2}>
                  {item.description}
                </Text>
              )}
              {item.locationName && (
                <View style={styles.locationInfo}>
                  <Ionicons name="location" size={14} color="#8E8E93" />
                  <Text style={styles.locationText}>{item.locationName}</Text>
                </View>
              )}
            </View>
          </View>
          {item.role === 'admin' && (
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>Admin</Text>
            </View>
          )}
        </View>

        <View style={styles.groupStats}>
          <View style={styles.statItem}>
            <Ionicons name="people-outline" size={16} color="#8E8E93" />
            <Text style={styles.statText}>
              {item.memberCount} {item.memberCount === 1 ? 'member' : 'members'}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons
              name={item.privacy === 'public' ? 'globe-outline' : 'lock-closed-outline'}
              size={16}
              color="#8E8E93"
            />
            <Text style={styles.statText} style={{ textTransform: 'capitalize' }}>
              {item.privacy}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Card>
  );

  const renderSearchGroupCard = ({ item }: { item: Group }) => (
    <Card style={styles.groupCard}>
      <View style={styles.groupHeader}>
        <View style={styles.groupInfo}>
          {item.avatarUrl ? (
            <Image source={{ uri: item.avatarUrl }} style={styles.groupIconImage} />
          ) : (
            <View style={styles.groupIcon}>
              <Ionicons name="people" size={24} color="#007AFF" />
            </View>
          )}
          <View style={styles.groupDetails}>
            <Text style={styles.groupName}>{item.name}</Text>
            {item.description && (
              <Text style={styles.groupDescription} numberOfLines={2}>
                {item.description}
              </Text>
            )}
            {item.locationName && (
              <View style={styles.locationInfo}>
                <Ionicons name="location" size={14} color="#8E8E93" />
                <Text style={styles.locationText}>{item.locationName}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={styles.groupStats}>
        <View style={styles.statItem}>
          <Ionicons name="people-outline" size={16} color="#8E8E93" />
          <Text style={styles.statText}>
            {item.memberCount} {item.memberCount === 1 ? 'member' : 'members'}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="globe-outline" size={16} color="#8E8E93" />
          <Text style={styles.statText}>Public</Text>
        </View>
      </View>

      <View style={styles.groupActions}>
        <Button
          title="Join Group"
          onPress={() => handleJoinGroup(item)}
          style={styles.joinButton}
        />
      </View>
    </Card>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="people-outline" size={64} color="#C7C7CC" />
      <Text style={styles.emptyTitle}>No groups yet</Text>
      <Text style={styles.emptySubtitle}>
        Search for public groups or get invited to join
      </Text>
    </View>
  );

  const renderSearchEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="search-outline" size={64} color="#C7C7CC" />
      <Text style={styles.emptyTitle}>No groups found</Text>
      <Text style={styles.emptySubtitle}>
        Try a different search term
      </Text>
    </View>
  );

  const cityOptions = useMemo(() => getCanonicalCityOptions(), []);
  const gymOptions = useMemo(() => buildGymOptions(gyms), [gyms]);
  const cragOptions = useMemo(() => buildCragOptions(climbingAreas), [climbingAreas]);

  const locationOptions = useMemo(() => {
    if (searchLocationType === 'gym') return gymOptions;
    if (searchLocationType === 'crag') return cragOptions;
    if (searchLocationType === 'city') return cityOptions;
    return [];
  }, [searchLocationType, gymOptions, cragOptions, cityOptions]);

  const filteredLocationOptions = useMemo(() => {
    const q = searchLocationValue.trim().toLowerCase();
    if (!q) return locationOptions.slice(0, 24);
    return locationOptions.filter((option) => option.label.toLowerCase().includes(q)).slice(0, 24);
  }, [locationOptions, searchLocationValue]);

  const filteredPublicGroups = publicGroups.filter((group) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesText =
      !query ||
      group.name.toLowerCase().includes(query) ||
      group.description?.toLowerCase().includes(query) ||
      group.locationName?.toLowerCase().includes(query);

    const selectedLocation = searchLocationValue.trim();
    const matchesLocation =
      !searchLocationType ||
      !selectedLocation ||
      (group.locationType === searchLocationType &&
        makeCanonicalLocationKey(group.locationName || '', searchLocationType) ===
          makeCanonicalLocationKey(selectedLocation, searchLocationType));

    return matchesText && matchesLocation;
  });

  return (
    <View style={styles.container}>
      {/* QR Code Action Button */}
      <View style={styles.qrActionContainer}>
        <TouchableOpacity
          style={styles.qrActionButton}
          onPress={() => setShowQRScanner(true)}
        >
          <View style={styles.qrIconContainer}>
            <Ionicons name="scan-outline" size={32} color="#34C759" />
          </View>
          <Text style={styles.qrActionText}>Scan QR Code</Text>
          <Text style={styles.qrActionSubtext}>Join instantly</Text>
        </TouchableOpacity>
      </View>

      {/* Header with Create and Search Buttons */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Groups</Text>
        <View style={styles.headerActions}>
          <Button
            title="Create"
            onPress={() => setShowCreateGroupModal(true)}
            style={styles.createButton}
          />
          <Button
            title="Search"
            onPress={openSearchModal}
            variant="outline"
            style={styles.searchButton}
          />
        </View>
      </View>

      {/* My Groups List */}
      <FlatList
        data={myGroups}
        renderItem={renderGroupCard}
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
        ListEmptyComponent={renderEmptyState}
      />

      {/* Group Detail Modal */}
      <Modal
        visible={selectedGroup !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseGroupDetail}
      >
        {selectedGroup && (
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={handleCloseGroupDetail}>
                <Ionicons name="close" size={24} color="#007AFF" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{selectedGroup.name}</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.modalContent}>
              {selectedGroup.description && (
                <Card style={styles.descriptionCard}>
                  <Text style={styles.descriptionText}>{selectedGroup.description}</Text>
                </Card>
              )}

              {/* Show My Code - Admin Only */}
              {selectedGroup.role === 'admin' && (
                <View style={styles.qrActionContainer}>
                  <TouchableOpacity
                    style={styles.qrActionButton}
                    onPress={() => {
                      // Store group data for QR code
                      setQrGroupData({ id: selectedGroup.id, name: selectedGroup.name });
                      // Close group detail modal and open QR code modal
                      setSelectedGroup(null);
                      setShowQRDisplay(true);
                    }}
                  >
                    <View style={styles.qrIconContainer}>
                      <Ionicons name="qr-code-outline" size={32} color="#007AFF" />
                    </View>
                    <Text style={styles.qrActionText}>Show Group Code</Text>
                    <Text style={styles.qrActionSubtext}>Invite others</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Chat Button */}
              <Button
                title="Open Group Chat"
                onPress={handleOpenChat}
                style={styles.chatButton}
              />
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* Search Modal */}
      <Modal
        visible={searchModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeSearchModal}>
              <Ionicons name="close" size={24} color="#007AFF" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Search Groups</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#8E8E93" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search groups by name or description..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
          </View>

          <View style={styles.filterTypeContainer}>
            {(['gym', 'city', 'crag'] as const).map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.filterTypeButton,
                  searchLocationType === type && styles.filterTypeButtonActive,
                ]}
                onPress={() => {
                  setSearchLocationType(type);
                  setSearchLocationValue('');
                }}
              >
                <Text
                  style={[
                    styles.filterTypeText,
                    searchLocationType === type && styles.filterTypeTextActive,
                  ]}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
            {searchLocationType && (
              <TouchableOpacity
                style={styles.clearFilterButton}
                onPress={() => {
                  setSearchLocationType(undefined);
                  setSearchLocationValue('');
                }}
              >
                <Text style={styles.clearFilterText}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>

          {searchLocationType && (
            <View style={styles.locationFilterContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder={`Filter by ${searchLocationType}...`}
                value={searchLocationValue}
                onChangeText={setSearchLocationValue}
              />
              <ScrollView style={styles.locationOptionList} nestedScrollEnabled>
                {filteredLocationOptions.map((option) => (
                  <TouchableOpacity
                    key={option.key}
                    style={styles.locationOption}
                    onPress={() => setSearchLocationValue(option.label)}
                  >
                    <Ionicons name="location-outline" size={16} color="#8E8E93" />
                    <Text style={styles.locationOptionText}>{option.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <FlatList
            data={filteredPublicGroups}
            renderItem={renderSearchGroupCard}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.searchListContainer}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={renderSearchEmptyState}
          />
        </View>
      </Modal>

      {/* QR Code Modals */}
      <QRCodeDisplayModal
        visible={showQRDisplay}
        onClose={() => {
          setShowQRDisplay(false);
          setQrGroupData(null);
        }}
        groupId={qrGroupData?.id}
        groupName={qrGroupData?.name}
      />

      <QRCodeScannerModal
        visible={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onScan={handleQRScan}
        mode="any"
      />

      {/* Create Group Modal */}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E7',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  createButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  groupCard: {
    marginBottom: 12,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  groupInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  groupIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  groupIconImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  groupDetails: {
    flex: 1,
  },
  groupName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  groupDescription: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  locationText: {
    fontSize: 12,
    color: '#8E8E93',
    marginLeft: 4,
  },
  roleBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  groupStats: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  statText: {
    fontSize: 14,
    color: '#8E8E93',
    marginLeft: 4,
  },
  groupActions: {
    marginTop: 8,
  },
  joinButton: {
    minWidth: 120,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 64,
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
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: colors.surface,
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
  descriptionCard: {
    marginBottom: 16,
  },
  descriptionText: {
    fontSize: 16,
    color: '#000',
    lineHeight: 24,
  },
  qrActionContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
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
  chatButton: {
    marginTop: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E5E7',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000',
  },
  searchListContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  filterTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  filterTypeButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterTypeButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  filterTypeText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
  },
  filterTypeTextActive: {
    color: colors.primary,
  },
  clearFilterButton: {
    marginLeft: 'auto',
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  clearFilterText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  locationFilterContainer: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  locationOptionList: {
    maxHeight: 160,
    marginTop: 8,
  },
  locationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  locationOptionText: {
    fontSize: 14,
    color: colors.text,
    marginLeft: 8,
  },
});

export default GroupsScreen;
