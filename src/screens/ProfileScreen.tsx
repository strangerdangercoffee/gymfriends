import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  Modal,
  TextInput,
  FlatList,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useLocation } from '../context/LocationContext';
import { useApp } from '../context/AppContext';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import LocationPermissionModal from '../components/LocationPermissionModal';
import ClimbingProfileModal from '../components/ClimbingProfileModal';
import { Gym, ClimbingProfile, BelayCertification, NotificationPreferences, UserAreaPlan, TripInvitation } from '../types';
import { climbingProfileApi, notificationPreferencesApi, tripInvitationsApi } from '../services/api';

const ProfileScreen: React.FC = () => {
  const { user, signOut, updateProfile, deleteAccount } = useAuth();
  const { 
    hasPermissions, 
    requestPermissions, 
    isTracking, 
    startTracking, 
    stopTracking,
    hasBackgroundPermission,
    isGeofencingActive,
  } = useLocation();
  const { friends, gyms, followedGyms, followGym, unfollowGym, checkIn, checkOut, presence, refreshData, climbingAreas } = useApp();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [shareLocation, setShareLocation] = useState(user?.privacySettings?.shareLocation ?? true);
  const [shareSchedule, setShareSchedule] = useState(user?.privacySettings?.shareSchedule ?? true);
  const [autoCheckIn, setAutoCheckIn] = useState(user?.privacySettings?.autoCheckIn ?? false);
  const [showLocationPermissionModal, setShowLocationPermissionModal] = useState(false);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Climbing profile state
  const [climbingProfile, setClimbingProfile] = useState<ClimbingProfile | null>(null);
  const [certifications, setCertifications] = useState<BelayCertification[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [showClimbingProfileModal, setShowClimbingProfileModal] = useState(false);
  const [tripInvitations, setTripInvitations] = useState<(TripInvitation & { trip?: UserAreaPlan })[]>([]);

  // Notification preferences state
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>({
    preferenceId: '',
    userId: user?.id || '',
    workoutInvitations: true,
    workoutResponses: true,
    workoutBails: true,
    workoutReminders: true,
    friendAtGym: true,
    friendAtCrag: true,
    groupMessages: true,
    belayerRequests: true,
    belayerResponses: true,
    matchingPartners: true,
    groupBelayerAlerts: true,
    feedResponses: true,
    feedMentions: true,
    friendTripAnnouncements: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const [loadingPreferences, setLoadingPreferences] = useState(false);

  const handleSaveProfile = async () => {
    if (!user) return;

    try {
      await updateProfile({
        name: name.trim(),
        privacySettings: {
          shareLocation,
          shareSchedule,
          autoCheckIn,
        },
      });
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  const handleCancelEdit = () => {
    setName(user?.name || '');
    setEmail(user?.email || '');
    setShareLocation(user?.privacySettings?.shareLocation ?? true);
    setShareSchedule(user?.privacySettings?.shareSchedule ?? true);
    setAutoCheckIn(user?.privacySettings?.autoCheckIn ?? false);
    setIsEditing(false);
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (error) {
              Alert.alert('Error', 'Failed to sign out');
            }
          }
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to permanently delete your account? This action cannot be undone and will remove all your data including workouts, friends, and gym preferences.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Continue', 
          style: 'destructive', 
          onPress: () => {
            // Show second confirmation
            Alert.alert(
              'Final Confirmation',
              'This is your final warning. Deleting your account will permanently remove ALL your data. Are you absolutely sure?',
              [
                { text: 'Cancel', style: 'cancel' },
                { 
                  text: 'Yes, Delete My Account', 
                  style: 'destructive', 
                  onPress: confirmDeleteAccount 
                },
              ]
            );
          }
        },
      ]
    );
  };

  const confirmDeleteAccount = async () => {
    if (!user) return;

    try {
      await deleteAccount();
      Alert.alert(
        'Account Deleted',
        'Your account and all associated data have been permanently deleted.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error deleting account:', error);
      Alert.alert(
        'Error',
        'Failed to delete account. Please try again or contact support.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleLocationPermission = async () => {
    if (hasPermissions) {
      Alert.alert(
        'Location Tracking',
        'Location tracking is currently enabled. Would you like to disable it?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Disable', 
            onPress: () => {
              stopTracking();
              setShareLocation(false);
            }
          },
        ]
      );
    } else {
      const granted = await requestPermissions();
      if (granted) {
        setShareLocation(true);
        Alert.alert('Success', 'Location permissions granted');
      } else {
        Alert.alert('Permission Denied', 'Location permissions are required for gym check-ins');
      }
    }
  };


  // Filter gyms by search (only climbing gyms are loaded)
  const searchFilteredGyms = gyms.filter(gym => {
    const matchesSearch = gym.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         gym.address.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // Helper function to check if user is currently at a specific gym
  const isUserAtGym = (gymId: string): boolean => {
    if (!user) return false;
    return presence.some(p => p.gymId === gymId && p.userId === user.id && p.isActive);
  };

  const handleFollowGym = async (gym: Gym) => {
    try {
      await followGym(gym.id);
      Alert.alert('Success', `Now following ${gym.name}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to follow gym');
    }
  };

  const handleUnfollowGym = async (gym: Gym) => {
    Alert.alert(
      'Unfollow Gym',
      `Are you sure you want to unfollow ${gym.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Unfollow', 
          style: 'destructive',
          onPress: async () => {
            try {
              await unfollowGym(gym.id);
            } catch (error) {
              Alert.alert('Error', 'Failed to unfollow gym');
            }
          }
        },
      ]
    );
  };

  const handleSearchGymFollow = async (gym: Gym) => {
    const isFollowing = user?.followedGyms?.includes(gym.id);
    if (isFollowing) {
      await handleUnfollowGym(gym);
    } else {
      await handleFollowGym(gym);
    }
  };

  const openSearchModal = () => {
    setSearchQuery('');
    setSearchModalVisible(true);
  };

  const closeSearchModal = () => {
    setSearchModalVisible(false);
    setSearchQuery('');
  };

  const handleCheckIn = async (gym: Gym) => {
    try {
      await checkIn(gym.id);
      Alert.alert('Success', `Checked in to ${gym.name}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to check in');
    }
  };

  const handleCheckOut = async (gym: Gym) => {
    try {
      await checkOut(gym.id);
      Alert.alert('Success', `Checked out of ${gym.name}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to check out');
    }
  };

  const renderProfileSection = () => (
    <Card style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Profile</Text>
        {!isEditing && (
          <TouchableOpacity onPress={() => setIsEditing(true)}>
            <Ionicons name="pencil-outline" size={20} color="#007AFF" />
          </TouchableOpacity>
        )}
      </View>

      {isEditing ? (
        <View style={styles.editForm}>
          <Input
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder="Enter your name"
            style={styles.input}
          />
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="Enter your email"
            keyboardType="email-address"
            autoCapitalize="none"
            editable={false}
            style={styles.input}
          />
          <View style={styles.formActions}>
            <Button
              title="Cancel"
              variant="outline"
              onPress={handleCancelEdit}
              style={styles.cancelButton}
            />
            <Button
              title="Save"
              onPress={handleSaveProfile}
              style={styles.saveButton}
            />
          </View>
        </View>
      ) : (
        <View style={styles.profileInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.name || 'Unknown User'}</Text>
            <Text style={styles.userEmail}>{user?.email || 'No email'}</Text>
          </View>
        </View>
      )}
    </Card>
  );

  const renderMyGymsSection = () => {
    const renderFollowedGymCard = ({ item }: { item: Gym }) => {
      const isAtGym = isUserAtGym(item.id);
      const currentUserCount = item.currentUsers?.length || 0;
      const followerCount = item.followers?.length || 0;

      return (
        <Card style={styles.gymCard}>
          <View style={styles.gymHeader}>
            <View style={styles.gymInfo}>
              <View style={[styles.gymIcon, { backgroundColor: '#FF9500' }]}>
                <Ionicons name="trending-up-outline" size={20} color="white" />
              </View>
              <View style={styles.gymDetails}>
                <Text style={styles.gymName}>{item.name}</Text>
                <Text style={styles.gymAddress}>{item.address}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.followButton}
              onPress={() => handleUnfollowGym(item)}
            >
              <Ionicons 
                name="heart" 
                size={20} 
                color="#FF3B30" 
              />
            </TouchableOpacity>
          </View>

          <View style={styles.gymStats}>
            <View style={styles.statItem}>
              <Ionicons name="people-outline" size={16} color="#8E8E93" />
              <Text style={styles.statText}>
                {currentUserCount} {currentUserCount === 1 ? 'person' : 'people'} here
              </Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="heart-outline" size={16} color="#8E8E93" />
              <Text style={styles.statText}>
                {followerCount} {followerCount === 1 ? 'follower' : 'followers'}
              </Text>
            </View>
          </View>

          <View style={styles.gymActions}>
            {isAtGym ? (
              <Button
                title="Check Out"
                variant="outline"
                onPress={() => handleCheckOut(item)}
                style={styles.checkOutButton}
              />
            ) : (
              <Button
                title="Check In"
                onPress={() => handleCheckIn(item)}
                style={styles.checkInButton}
              />
            )}
          </View>
        </Card>
      );
    };

    const renderSearchGymCard = ({ item }: { item: Gym }) => {
      const isFollowing = user?.followedGyms?.includes(item.id);
      const currentUserCount = item.currentUsers?.length || 0;
      const followerCount = item.followers?.length || 0;

      return (
        <Card style={styles.searchGymCard}>
          <View style={styles.gymHeader}>
            <View style={styles.gymInfo}>
              <View style={[styles.gymIcon, { backgroundColor: '#FF9500' }]}>
                <Ionicons name="trending-up-outline" size={20} color="white" />
              </View>
              <View style={styles.gymDetails}>
                <Text style={styles.gymName}>{item.name}</Text>
                <Text style={styles.gymAddress}>{item.address}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.followButton}
              onPress={() => handleSearchGymFollow(item)}
            >
              <Ionicons 
                name={isFollowing ? "heart" : "heart-outline"} 
                size={20} 
                color={isFollowing ? "#FF3B30" : "#8E8E93"} 
              />
            </TouchableOpacity>
          </View>

          <View style={styles.gymStats}>
            <View style={styles.statItem}>
              <Ionicons name="people-outline" size={16} color="#8E8E93" />
              <Text style={styles.statText}>
                {currentUserCount} {currentUserCount === 1 ? 'person' : 'people'} here
              </Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="heart-outline" size={16} color="#8E8E93" />
              <Text style={styles.statText}>
                {followerCount} {followerCount === 1 ? 'follower' : 'followers'}
              </Text>
            </View>
          </View>
        </Card>
      );
    };

    const renderEmptyState = () => (
      <View style={styles.emptyState}>
        <Ionicons name="fitness-outline" size={48} color="#C7C7CC" />
        <Text style={styles.emptyTitle}>No followed gyms</Text>
        <Text style={styles.emptySubtitle}>
          Tap "Find my gym" to search and follow climbing gyms
        </Text>
      </View>
    );

    const renderSearchEmptyState = () => (
      <View style={styles.emptyState}>
        <Ionicons name="search-outline" size={48} color="#C7C7CC" />
        <Text style={styles.emptyTitle}>No climbing gyms found</Text>
        <Text style={styles.emptySubtitle}>
          Try a different search term
        </Text>
      </View>
    );

    return (
      <View>
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Gyms</Text>
            <Button
              title="Find my gym"
              onPress={openSearchModal}
              style={styles.findGymButton}
            />
          </View>

          {followedGyms.length === 0 ? (
            renderEmptyState()
          ) : (
            <FlatList
              data={followedGyms}
              renderItem={renderFollowedGymCard}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={renderEmptyState}
            />
          )}
        </Card>

        {/* Search Modal */}
        <Modal
          visible={searchModalVisible}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={closeSearchModal}>
                <Ionicons name="close" size={24} color="#007AFF" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Find Climbing Gyms</Text>
              <View style={{ width: 24 }} />
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color="#8E8E93" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search climbing gyms by name or address..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
            </View>

            {/* Search Results */}
            <FlatList
              data={searchFilteredGyms}
              renderItem={renderSearchGymCard}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.searchListContainer}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={renderSearchEmptyState}
            />
          </View>
        </Modal>
      </View>
    );
  };

  const handleAutoCheckInToggle = async (value: boolean) => {
    if (value && !hasBackgroundPermission) {
      // Show permission modal if trying to enable without permissions
      setShowLocationPermissionModal(true);
    } else {
      setAutoCheckIn(value);
      // Save immediately
      if (user) {
        try {
          await updateProfile({
            privacySettings: {
              shareLocation,
              shareSchedule,
              autoCheckIn: value,
            },
          });
          Alert.alert(
            value ? 'Auto Check-In Enabled' : 'Auto Check-In Disabled',
            value 
              ? 'You will now be automatically checked in when you arrive at your gym!'
              : 'Auto check-in has been disabled.'
          );
        } catch (error) {
          Alert.alert('Error', 'Failed to update settings');
          setAutoCheckIn(!value); // Revert on error
        }
      }
    }
  };

  const handleRequestLocationPermissions = async () => {
    const granted = await requestPermissions();
    if (granted) {
      setAutoCheckIn(true);
      if (user) {
        await updateProfile({
          privacySettings: {
            shareLocation,
            shareSchedule,
            autoCheckIn: true,
          },
        });
      }
    }
  };

  const loadClimbingProfile = async () => {
    if (!user?.id) return;
    
    setLoadingProfile(true);
    try {
      const profile = await climbingProfileApi.getClimbingProfile(user.id);
      setClimbingProfile(profile);
      
      const certs = await climbingProfileApi.getBelayCertifications(user.id);
      setCertifications(certs);
    } catch (error) {
      console.error('Error loading climbing profile:', error);
    } finally {
      setLoadingProfile(false);
    }
  };

  // Load climbing profile on mount
  // Load notification preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      if (user) {
        try {
          setLoadingPreferences(true);
          const prefs = await notificationPreferencesApi.getNotificationPreferences(user.id);
          setNotificationPreferences(prefs);
        } catch (error) {
          console.error('Error loading notification preferences:', error);
        } finally {
          setLoadingPreferences(false);
        }
      }
    };
    loadPreferences();
  }, [user]);

  useEffect(() => {
    const load = async () => {
      if (user?.id) {
        try {
          const list = await tripInvitationsApi.getByInvitee(user.id);
          setTripInvitations(list);
        } catch {
          setTripInvitations([]);
        }
      }
    };
    load();
  }, [user?.id]);

  const handleTripInvitationResponse = async (invitationId: string, status: 'accepted' | 'declined') => {
    try {
      await tripInvitationsApi.respond(invitationId, status);
      setTripInvitations((prev) => prev.filter((i) => i.id !== invitationId));
    } catch {
      Alert.alert('Error', 'Failed to update invitation');
    }
  };

  React.useEffect(() => {
    loadClimbingProfile();
  }, [user?.id]);

  const renderClimbingProfileSection = () => (
    <Card style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Climbing Profile</Text>
        <TouchableOpacity onPress={() => setShowClimbingProfileModal(true)}>
          <Ionicons name="create-outline" size={20} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <View>
        {loadingProfile ? (
          <Text style={styles.emptySubtitle}>Loading...</Text>
        ) : climbingProfile ? (
          <>
            <View style={styles.climbingInfoRow}>
              <Text style={styles.climbingInfoLabel}>Lead Climbing:</Text>
              <Text style={styles.climbingInfoValue}>
                {climbingProfile.leadClimbing ? 'Yes' : 'No'}
                {climbingProfile.leadGradeMin && climbingProfile.leadGradeMax && 
                  ` (${climbingProfile.leadGradeMin}-${climbingProfile.leadGradeMax})`}
              </Text>
            </View>
            <View style={styles.climbingInfoRow}>
              <Text style={styles.climbingInfoLabel}>Top Rope:</Text>
              <Text style={styles.climbingInfoValue}>
                {climbingProfile.topRope ? 'Yes' : 'No'}
                {climbingProfile.topRopeGradeMin && climbingProfile.topRopeGradeMax && 
                  ` (${climbingProfile.topRopeGradeMin}-${climbingProfile.topRopeGradeMax})`}
              </Text>
            </View>
            <View style={styles.climbingInfoRow}>
              <Text style={styles.climbingInfoLabel}>Bouldering:</Text>
              <Text style={styles.climbingInfoValue}>
                {climbingProfile.bouldering ? 'Yes' : 'No'} 
                {climbingProfile.boulderMaxFlash && ` (Flash: ${climbingProfile.boulderMaxFlash})`}
                {climbingProfile.boulderMaxSend && ` (Send: ${climbingProfile.boulderMaxSend})`}
              </Text>
            </View>
            <View style={styles.climbingInfoRow}>
              <Text style={styles.climbingInfoLabel}>Trad Climbing:</Text>
              <Text style={styles.climbingInfoValue}>
                {climbingProfile.traditionalClimbing ? 'Yes' : 'No'} 
                {climbingProfile.traditionalGradeMax && ` (Max: ${climbingProfile.traditionalGradeMax})`}
                {climbingProfile.traditionalGradeMin && ` (Min: ${climbingProfile.traditionalGradeMin})`}
              </Text>
            </View>
            <View style={styles.climbingInfoRow}>
              <Text style={styles.climbingInfoLabel}>Open to New Partners:</Text>
              <Text style={styles.climbingInfoValue}>
                {climbingProfile.openToNewPartners ? 'Yes' : 'No'}
              </Text>
            </View>
            {certifications.length > 0 && (
              <View style={styles.certificationsList}>
                <Text style={styles.climbingSubtitle}>Belay Certifications:</Text>
                {certifications.map((cert) => (
                  <View key={cert.certificationId} style={styles.certRow}>
                    <Text style={styles.certGym}>{cert.gymName || 'Unknown Gym'}</Text>
                    <Text style={styles.certType}>
                      {cert.certificationType === 'both' ? 'Top Rope & Lead' :
                       cert.certificationType === 'lead' ? 'Lead' : 'Top Rope'}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </>
        ) : (
          <Text style={styles.emptySubtitle}>No climbing profile set up yet</Text>
        )}
      </View>
    </Card>
  );

  const renderTripInvitationsSection = () => {
    const pending = tripInvitations.filter((i) => i.status === 'invited');
    if (pending.length === 0) return null;
    const areaName = (areaId: string) => climbingAreas.find((a) => a.id === areaId)?.name ?? areaId;
    return (
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Trip invitations</Text>
        {pending.map((inv) => (
          <View key={inv.id} style={styles.tripInviteRow}>
            <View style={styles.tripInviteInfo}>
              <Text style={styles.tripInviteTitle}>
                {inv.trip ? `${inv.trip.startDate} – ${inv.trip.endDate}` : 'Trip'}
              </Text>
              {inv.trip && (
                <Text style={styles.tripInviteArea}>{areaName(inv.trip.areaId)}</Text>
              )}
              {inv.comment ? (
                <Text style={styles.tripInviteComment}>{inv.comment}</Text>
              ) : null}
            </View>
            <View style={styles.tripInviteActions}>
              <TouchableOpacity onPress={() => handleTripInvitationResponse(inv.id, 'declined')} style={styles.tripInviteBtn}>
                <Text style={styles.tripInviteDecline}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleTripInvitationResponse(inv.id, 'accepted')} style={styles.tripInviteBtn}>
                <Text style={styles.tripInviteAccept}>Accept</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </Card>
    );
  };

  const handleSaveNotificationPreferences = async () => {
    if (!user) return;
    try {
      setLoadingPreferences(true);
      await notificationPreferencesApi.updateNotificationPreferences(user.id, notificationPreferences);
      Alert.alert('Success', 'Notification preferences updated');
    } catch (error) {
      console.error('Error saving notification preferences:', error);
      Alert.alert('Error', 'Failed to update notification preferences');
    } finally {
      setLoadingPreferences(false);
    }
  };

  const renderNotificationSection = () => (
    <Card style={styles.section}>
      <Text style={styles.sectionTitle}>Notifications</Text>
      
      <View style={styles.settingItem}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>Workout Invitations</Text>
          <Text style={styles.settingDescription}>
            Receive notifications for workout invitations
          </Text>
        </View>
        <Switch
          value={notificationPreferences.workoutInvitations}
          onValueChange={(value) => 
            setNotificationPreferences({...notificationPreferences, workoutInvitations: value})
          }
          trackColor={{ false: '#E5E5E7', true: '#007AFF' }}
          thumbColor={notificationPreferences.workoutInvitations ? 'white' : '#8E8E93'}
        />
      </View>

      <View style={styles.settingItem}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>Workout Responses</Text>
          <Text style={styles.settingDescription}>
            Receive notifications when someone responds to your workout invitation
          </Text>
        </View>
        <Switch
          value={notificationPreferences.workoutResponses}
          onValueChange={(value) => 
            setNotificationPreferences({...notificationPreferences, workoutResponses: value})
          }
          trackColor={{ false: '#E5E5E7', true: '#007AFF' }}
          thumbColor={notificationPreferences.workoutResponses ? 'white' : '#8E8E93'}
        />
      </View>

      <View style={styles.settingItem}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>Workout Bails</Text>
          <Text style={styles.settingDescription}>
            Receive notifications when someone bails from a workout
          </Text>
        </View>
        <Switch
          value={notificationPreferences.workoutBails}
          onValueChange={(value) => 
            setNotificationPreferences({...notificationPreferences, workoutBails: value})
          }
          trackColor={{ false: '#E5E5E7', true: '#007AFF' }}
          thumbColor={notificationPreferences.workoutBails ? 'white' : '#8E8E93'}
        />
      </View>

      <View style={styles.settingItem}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>Workout Reminders</Text>
          <Text style={styles.settingDescription}>
            Receive notifications for workout reminders
          </Text>
        </View>
        <Switch
          value={notificationPreferences.workoutReminders}
          onValueChange={(value) => 
            setNotificationPreferences({...notificationPreferences, workoutReminders: value})
          }
          trackColor={{ false: '#E5E5E7', true: '#007AFF' }}
          thumbColor={notificationPreferences.workoutReminders ? 'white' : '#8E8E93'}
        />
      </View>

      <View style={styles.settingItem}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>Friend at Gym</Text>
          <Text style={styles.settingDescription}>
            Receive notifications when a friend checks in at a gym
          </Text>
        </View>
        <Switch
          value={notificationPreferences.friendAtGym}
          onValueChange={(value) => 
            setNotificationPreferences({...notificationPreferences, friendAtGym: value})
          }
          trackColor={{ false: '#E5E5E7', true: '#007AFF' }}
          thumbColor={notificationPreferences.friendAtGym ? 'white' : '#8E8E93'}
        />
      </View>

      <View style={styles.settingItem}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>Friend at crag</Text>
          <Text style={styles.settingDescription}>
            Receive notifications when a friend arrives at a climbing area you're at
          </Text>
        </View>
        <Switch
          value={notificationPreferences.friendAtCrag}
          onValueChange={(value) =>
            setNotificationPreferences({...notificationPreferences, friendAtCrag: value})
          }
          trackColor={{ false: '#E5E5E7', true: '#007AFF' }}
          thumbColor={notificationPreferences.friendAtCrag ? 'white' : '#8E8E93'}
        />
      </View>

      <View style={styles.settingItem}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>Friend trip announcements</Text>
          <Text style={styles.settingDescription}>
            When friends share a trip plan (Tell the homies)
          </Text>
        </View>
        <Switch
          value={notificationPreferences.friendTripAnnouncements}
          onValueChange={(value) =>
            setNotificationPreferences({...notificationPreferences, friendTripAnnouncements: value})
          }
          trackColor={{ false: '#E5E5E7', true: '#007AFF' }}
          thumbColor={notificationPreferences.friendTripAnnouncements ? 'white' : '#8E8E93'}
        />
      </View>

      <View style={styles.settingItem}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>Group Messages</Text>
          <Text style={styles.settingDescription}>
            Receive notifications for new group chat messages
          </Text>
        </View>
        <Switch
          value={notificationPreferences.groupMessages}
          onValueChange={(value) => 
            setNotificationPreferences({...notificationPreferences, groupMessages: value})
          }
          trackColor={{ false: '#E5E5E7', true: '#007AFF' }}
          thumbColor={notificationPreferences.groupMessages ? 'white' : '#8E8E93'}
        />
      </View>

      <View style={styles.settingItem}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>Belayer Requests</Text>
          <Text style={styles.settingDescription}>
            Receive notifications for belayer requests
          </Text>
        </View>
        <Switch
          value={notificationPreferences.belayerRequests}
          onValueChange={(value) => 
            setNotificationPreferences({...notificationPreferences, belayerRequests: value})
          }
          trackColor={{ false: '#E5E5E7', true: '#007AFF' }}
          thumbColor={notificationPreferences.belayerRequests ? 'white' : '#8E8E93'}
        />
      </View>

      <View style={styles.settingItem}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>Belayer Responses</Text>
          <Text style={styles.settingDescription}>
            Receive notifications for belayer responses
          </Text>
        </View>
        <Switch
          value={notificationPreferences.belayerResponses}
          onValueChange={(value) => 
            setNotificationPreferences({...notificationPreferences, belayerResponses: value})
          }
          trackColor={{ false: '#E5E5E7', true: '#007AFF' }}
          thumbColor={notificationPreferences.belayerResponses ? 'white' : '#8E8E93'}
        />
      </View>

      <Button
        title="Save Notification Preferences"
        onPress={handleSaveNotificationPreferences}
        style={styles.saveButton}
        disabled={loadingPreferences}
      />
    </Card>
  );

  const renderPrivacySection = () => (
    <Card style={styles.section}>
      <Text style={styles.sectionTitle}>Privacy Settings</Text>
      
      <View style={styles.settingItem}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>Share Location</Text>
          <Text style={styles.settingDescription}>
            Allow friends to see when you're at the gym
          </Text>
        </View>
        <Switch
          value={shareLocation}
          onValueChange={setShareLocation}
          trackColor={{ false: '#E5E5E7', true: '#007AFF' }}
          thumbColor={shareLocation ? 'white' : '#8E8E93'}
        />
      </View>

      <View style={styles.settingItem}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>Share Schedule</Text>
          <Text style={styles.settingDescription}>
            Allow friends to see your workout schedule
          </Text>
        </View>
        <Switch
          value={shareSchedule}
          onValueChange={setShareSchedule}
          trackColor={{ false: '#E5E5E7', true: '#007AFF' }}
          thumbColor={shareSchedule ? 'white' : '#8E8E93'}
        />
      </View>

      <View style={[styles.settingItem, styles.autoCheckInItem]}>
        <View style={styles.settingInfo}>
          <View style={styles.settingTitleRow}>
            <Text style={styles.settingTitle}>Auto Check-In</Text>
            <Ionicons name="location" size={16} color="#007AFF" style={styles.locationIcon} />
          </View>
          <Text style={styles.settingDescription}>
            Automatically check in when within 500ft of your gym
          </Text>
          {isGeofencingActive && (
            <View style={styles.activeChip}>
              <Ionicons name="checkmark-circle" size={12} color="#34C759" />
              <Text style={styles.activeChipText}>Active</Text>
            </View>
          )}
        </View>
        <Switch
          value={autoCheckIn}
          onValueChange={handleAutoCheckInToggle}
          trackColor={{ false: '#E5E5E7', true: '#34C759' }}
          thumbColor={autoCheckIn ? 'white' : '#8E8E93'}
        />
      </View>
    </Card>
  );

  const renderLocationSection = () => (
    <Card style={styles.section}>
      <Text style={styles.sectionTitle}>Location Services</Text>
      
      <View style={styles.settingItem}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>Location Permissions</Text>
          <Text style={styles.settingDescription}>
            {hasPermissions ? 'Granted' : 'Not granted'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.statusBadge, { backgroundColor: hasPermissions ? '#34C759' : '#FF3B30' }]}
          onPress={handleLocationPermission}
        >
          <Text style={styles.statusText}>
            {hasPermissions ? 'Granted' : 'Denied'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.settingItem}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>Location Tracking</Text>
          <Text style={styles.settingDescription}>
            {isTracking ? 'Active' : 'Inactive'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.statusBadge, { backgroundColor: isTracking ? '#34C759' : '#8E8E93' }]}
          onPress={() => {
            if (isTracking) {
              stopTracking();
            } else {
              startTracking();
            }
          }}
        >
          <Text style={styles.statusText}>
            {isTracking ? 'Active' : 'Inactive'}
          </Text>
        </TouchableOpacity>
      </View>
    </Card>
  );

  const renderAccountSection = () => (
    <Card style={styles.section}>
      <Text style={styles.sectionTitle}>Account</Text>
      
      <TouchableOpacity style={styles.settingItem} onPress={handleSignOut}>
        <View style={styles.settingInfo}>
          <Text style={[styles.settingTitle, { color: '#FF3B30' }]}>Sign Out</Text>
          <Text style={styles.settingDescription}>
            Sign out of your account
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
      </TouchableOpacity>

      <TouchableOpacity style={[styles.settingItem, styles.deleteAccountItem]} onPress={handleDeleteAccount}>
        <View style={styles.settingInfo}>
          <Text style={[styles.settingTitle, { color: '#FF3B30' }]}>Delete Account</Text>
          <Text style={styles.settingDescription}>
            Permanently delete your account and all data
          </Text>
        </View>
        <Ionicons name="trash-outline" size={20} color="#FF3B30" />
      </TouchableOpacity>
    </Card>
  );

  return (
    <>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {renderProfileSection()}
        {renderMyGymsSection()}
        {renderClimbingProfileSection()}
        {renderTripInvitationsSection()}
        {renderNotificationSection()}
        {renderPrivacySection()}
        {renderLocationSection()}
        {renderAccountSection()}
      </ScrollView>

      <LocationPermissionModal
        visible={showLocationPermissionModal}
        onClose={() => setShowLocationPermissionModal(false)}
        onRequestPermissions={handleRequestLocationPermissions}
        hasBackgroundPermission={hasBackgroundPermission}
      />

      <ClimbingProfileModal
        visible={showClimbingProfileModal}
        onClose={() => setShowClimbingProfileModal(false)}
        onSave={async () => {
          await loadClimbingProfile();
        }}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  section: {
    marginHorizontal: 16,
    marginVertical: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  tripInviteRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E7',
  },
  tripInviteInfo: { marginBottom: 8 },
  tripInviteTitle: { fontSize: 16, fontWeight: '600' },
  tripInviteArea: { fontSize: 14, color: '#8E8E93', marginTop: 2 },
  tripInviteComment: { fontSize: 14, color: '#333', marginTop: 4, fontStyle: 'italic' },
  tripInviteActions: { flexDirection: 'row', gap: 12 },
  tripInviteBtn: { paddingVertical: 6, paddingHorizontal: 12 },
  tripInviteDecline: { fontSize: 14, color: '#8E8E93' },
  tripInviteAccept: { fontSize: 14, color: '#007AFF', fontWeight: '600' },
  editForm: {
    gap: 16,
  },
  input: {
    marginBottom: 0,
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
  },
  saveButton: {
    flex: 1,
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '600',
    color: 'white',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: '#8E8E93',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 14,
    color: '#8E8E93',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  autoCheckInItem: {
    borderBottomWidth: 0,
  },
  deleteAccountItem: {
    borderBottomWidth: 0,
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  settingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationIcon: {
    marginLeft: 6,
  },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  activeChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2E7D32',
    marginLeft: 4,
  },
  // Gyms section styles
  findGymButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  gymCard: {
    marginBottom: 12,
  },
  searchGymCard: {
    marginBottom: 8,
  },
  gymHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  gymInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  gymIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  gymDetails: {
    flex: 1,
  },
  gymName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  gymAddress: {
    fontSize: 14,
    color: '#8E8E93',
  },
  followButton: {
    padding: 8,
  },
  gymStats: {
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
  gymActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  checkInButton: {
    minWidth: 120,
  },
  checkOutButton: {
    minWidth: 120,
  },
  emptyState: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
  // Modal styles
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
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E7',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
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
  // Climbing profile styles
  climbingEditForm: {
    gap: 16,
  },
  climbingLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
  },
  climbingSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 12,
  },
  preferenceRow: {
    marginBottom: 12,
  },
  preferenceButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  preferenceButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: '#F9F9F9',
    alignItems: 'center',
  },
  preferenceButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  preferenceButtonText: {
    fontSize: 14,
    color: '#666',
  },
  preferenceButtonTextActive: {
    color: '#FFF',
    fontWeight: '600',
  },
  gradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  gradeInput: {
    flex: 1,
  },
  gradeSeparator: {
    fontSize: 16,
    color: '#666',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#333',
  },
  certRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    marginBottom: 8,
  },
  certInfo: {
    flex: 1,
  },
  certGym: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  certType: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  addCertButton: {
    marginTop: 8,
  },
  addCertForm: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
  },
  gymPicker: {
    maxHeight: 150,
    marginBottom: 12,
  },
  gymOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFF',
    borderRadius: 8,
    marginBottom: 8,
  },
  gymOptionSelected: {
    backgroundColor: '#E3F2FD',
  },
  addCertButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  climbingInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  climbingInfoLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  climbingInfoValue: {
    fontSize: 14,
    color: '#000',
  },
  certificationsList: {
    marginTop: 12,
  },
});

export default ProfileScreen;
