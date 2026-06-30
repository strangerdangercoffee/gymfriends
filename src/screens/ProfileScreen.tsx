import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useLocation } from '../context/LocationContext';
import { useApp } from '../context/AppContext';
import { useNetwork } from '../context/NetworkContext';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import LocationPermissionModal from '../components/LocationPermissionModal';
import ClimbingProfileModal from '../components/ClimbingProfileModal';
import { ClimbingProfile, BelayCertification, NotificationPreferences, UserAreaPlan, TripInvitation } from '../types';
import { climbingProfileApi, notificationPreferencesApi, tripInvitationsApi, avatarsApi } from '../services/api';
import { invitationService } from '../services/invitations';
import { colors } from '../theme/colors';

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
  const { climbingAreas } = useApp();
  const { isOffline } = useNetwork();
  const [isEditing, setIsEditing] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [shareLocation, setShareLocation] = useState(user?.privacySettings?.shareLocation ?? true);
  const [shareSchedule, setShareSchedule] = useState(user?.privacySettings?.shareSchedule ?? true);
  const [autoCheckIn, setAutoCheckIn] = useState(user?.privacySettings?.autoCheckIn ?? false);
  const [showLocationPermissionModal, setShowLocationPermissionModal] = useState(false);
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

    const normalizedPhone = phone.trim() ? phone.replace(/\D/g, '') : undefined;
    if (normalizedPhone && normalizedPhone.length < 10) {
      Alert.alert('Error', 'Please enter a valid phone number (at least 10 digits)');
      return;
    }

    try {
      await updateProfile({
        name: name.trim(),
        phone: normalizedPhone || undefined,
        privacySettings: {
          shareLocation,
          shareSchedule,
          autoCheckIn,
        },
      });
      if (!isOffline && normalizedPhone) {
        const pending = await invitationService.getPendingInvitations(normalizedPhone);
        for (const inv of pending) {
          try {
            await invitationService.acceptInvitation(inv.id, user.id);
          } catch {
            // ignore per-invitation errors
          }
        }
      }
      setIsEditing(false);
      Alert.alert(
        'Success',
        isOffline
          ? 'Profile saved — will sync when back online.'
          : 'Profile updated successfully'
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  const handleCancelEdit = () => {
    setName(user?.name || '');
    setEmail(user?.email || '');
    setPhone(user?.phone || '');
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


  const handlePickAvatar = async () => {
    if (!user?.id) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant camera roll permissions.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setUploadingAvatar(true);
      try {
        const url = await avatarsApi.uploadUserAvatar(user.id, result.assets[0].uri);
        setAvatarUri(url);
        await updateProfile({ avatar: url });
      } catch {
        Alert.alert('Error', 'Failed to upload photo');
      } finally {
        setUploadingAvatar(false);
      }
    }
  };

  const renderProfileSection = () => (
    <Card style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Profile</Text>
        {!isEditing && (
          <TouchableOpacity onPress={() => setIsEditing(true)}>
            <Ionicons name="pencil-outline" size={20} color={colors.primary} />
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
          <Input
            label="Phone number"
            value={phone}
            onChangeText={setPhone}
            placeholder="Enter your phone number"
            keyboardType="phone-pad"
            autoCapitalize="none"
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
          <TouchableOpacity onPress={handlePickAvatar} disabled={uploadingAvatar} style={styles.avatarWrap}>
            {avatarUri || user?.avatar ? (
              <Image source={{ uri: avatarUri ?? user?.avatar ?? '' }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </Text>
              </View>
            )}
            <View style={styles.avatarEditBadge}>
              <Ionicons name={uploadingAvatar ? 'hourglass-outline' : 'camera-outline'} size={12} color={colors.background} />
            </View>
          </TouchableOpacity>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.name || 'Unknown User'}</Text>
            <Text style={styles.userEmail}>{user?.email || 'No email'}</Text>
            {user?.phone ? (
              <Text style={styles.userEmail}>{user.phone}</Text>
            ) : null}
          </View>
        </View>
      )}
    </Card>
  );

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

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
      setShareLocation(user.privacySettings?.shareLocation ?? true);
      setShareSchedule(user.privacySettings?.shareSchedule ?? true);
      setAutoCheckIn(user.privacySettings?.autoCheckIn ?? false);
    }
  }, [user?.id, user?.name, user?.email, user?.phone, user?.privacySettings]);

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

  const handleTripInvitationResponse = async (
    invitationId: string,
    status: 'accepted' | 'declined'
  ) => {
    const inv = tripInvitations.find((i) => i.id === invitationId);
    try {
      if (status === 'accepted' && inv?.trip && user?.id) {
        const { planAdded } = await tripInvitationsApi.acceptAndMirrorTrip(
          invitationId,
          user.id,
          inv.trip
        );
        setTripInvitations((prev) => prev.filter((i) => i.id !== invitationId));
        if (planAdded) {
          Alert.alert(
            'Accepted',
            'Trip added to your schedule. Open the area’s Friend calendar to see My trip.'
          );
        } else {
          Alert.alert(
            'Accepted',
            'You’re on the trip. If dates don’t show on your schedule, plan the area from Connections → Area feeds.'
          );
        }
      } else {
        await tripInvitationsApi.respond(invitationId, status);
        setTripInvitations((prev) => prev.filter((i) => i.id !== invitationId));
      }
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
          <Ionicons name="create-outline" size={20} color={colors.primary} />
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
      Alert.alert(
        'Success',
        isOffline
          ? 'Preferences saved — will sync when back online.'
          : 'Notification preferences updated'
      );
    } catch (error) {
      console.error('Error saving notification preferences:', error);
      Alert.alert('Error', 'Failed to update notification preferences');
    } finally {
      setLoadingPreferences(false);
    }
  };

  const renderNotificationSection = () => (
    <Card style={styles.section}>
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => setShowNotifications((v) => !v)}
        activeOpacity={0.7}
      >
        <Text style={styles.sectionTitle}>Notifications</Text>
        <Ionicons
          name={showNotifications ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.textMuted}
        />
      </TouchableOpacity>

      {showNotifications && <>
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
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={notificationPreferences.workoutInvitations ? colors.text : colors.textMuted}
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
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={notificationPreferences.workoutResponses ? colors.text : colors.textMuted}
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
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={notificationPreferences.workoutBails ? colors.text : colors.textMuted}
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
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={notificationPreferences.workoutReminders ? colors.text : colors.textMuted}
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
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={notificationPreferences.friendAtGym ? colors.text : colors.textMuted}
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
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={notificationPreferences.friendAtCrag ? colors.text : colors.textMuted}
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
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={notificationPreferences.friendTripAnnouncements ? colors.text : colors.textMuted}
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
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={notificationPreferences.groupMessages ? colors.text : colors.textMuted}
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
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={notificationPreferences.belayerRequests ? colors.text : colors.textMuted}
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
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={notificationPreferences.belayerResponses ? colors.text : colors.textMuted}
        />
      </View>

      <Button
        title="Save Notification Preferences"
        onPress={handleSaveNotificationPreferences}
        style={styles.saveButton}
        disabled={loadingPreferences}
      />
      </>}
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
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={shareLocation ? colors.text : colors.textMuted}
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
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={shareSchedule ? colors.text : colors.textMuted}
        />
      </View>

      <View style={[styles.settingItem, styles.autoCheckInItem]}>
        <View style={styles.settingInfo}>
          <View style={styles.settingTitleRow}>
            <Text style={styles.settingTitle}>Auto Check-In</Text>
            <Ionicons name="location" size={16} color={colors.primary} style={styles.locationIcon} />
          </View>
          <Text style={styles.settingDescription}>
            Automatically check in when within 500ft of your gym
          </Text>
          {isGeofencingActive && (
            <View style={styles.activeChip}>
              <Ionicons name="checkmark-circle" size={12} color={colors.primary} />
              <Text style={styles.activeChipText}>Active</Text>
            </View>
          )}
        </View>
        <Switch
          value={autoCheckIn}
          onValueChange={handleAutoCheckInToggle}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={autoCheckIn ? colors.text : colors.textMuted}
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
          style={[styles.statusBadge, { backgroundColor: hasPermissions ? colors.primary : colors.error }]}
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
          style={[styles.statusBadge, { backgroundColor: isTracking ? colors.primary : colors.textMuted }]}
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
          <Text style={[styles.settingTitle, { color: colors.error }]}>Sign Out</Text>
          <Text style={styles.settingDescription}>
            Sign out of your account
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textFaded} />
      </TouchableOpacity>

      <TouchableOpacity style={[styles.settingItem, styles.deleteAccountItem]} onPress={handleDeleteAccount}>
        <View style={styles.settingInfo}>
          <Text style={[styles.settingTitle, { color: colors.error }]}>Delete Account</Text>
          <Text style={styles.settingDescription}>
            Permanently delete your account and all data
          </Text>
        </View>
        <Ionicons name="trash-outline" size={20} color={colors.error} />
      </TouchableOpacity>
    </Card>
  );

  return (
    <>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Offline notice */}
        {isOffline && (
          <View style={styles.offlineNotice}>
            <Ionicons name="cloud-offline-outline" size={14} color={colors.textMuted} />
            <Text style={styles.offlineNoticeText}>
              Showing saved data — you're offline. Changes will sync when back online.
            </Text>
          </View>
        )}
        {renderProfileSection()}
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
    backgroundColor: colors.background,
  },
  offlineNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.surfaceElevated,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  offlineNoticeText: { fontSize: 12, color: colors.textMuted, flex: 1 },
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
    color: colors.text,
  },
  tripInviteRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tripInviteInfo: { marginBottom: 8 },
  tripInviteTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  tripInviteArea: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  tripInviteComment: { fontSize: 14, color: colors.textMuted, marginTop: 4, fontStyle: 'italic' },
  tripInviteActions: { flexDirection: 'row', gap: 12 },
  tripInviteBtn: { paddingVertical: 6, paddingHorizontal: 12 },
  tripInviteDecline: { fontSize: 14, color: colors.textMuted },
  tripInviteAccept: { fontSize: 14, color: colors.primary, fontWeight: '600' },
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
  avatarWrap: {
    width: 64,
    height: 64,
    marginRight: 16,
    position: 'relative',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImg: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.background,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: colors.textMuted,
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
    borderBottomColor: colors.border,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 14,
    color: colors.textMuted,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  autoCheckInItem: {
    borderBottomWidth: 0,
  },
  deleteAccountItem: {
    borderBottomWidth: 0,
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
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
    backgroundColor: colors.successMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  activeChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    marginLeft: 4,
  },
  emptyState: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  // Climbing profile styles
  climbingEditForm: {
    gap: 16,
  },
  climbingLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textMuted,
    marginBottom: 8,
  },
  climbingSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
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
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
  },
  preferenceButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  preferenceButtonText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  preferenceButtonTextActive: {
    color: colors.background,
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
    color: colors.textMuted,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  checkboxLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  certRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 8,
    marginBottom: 8,
  },
  certInfo: {
    flex: 1,
  },
  certGym: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  certType: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  addCertButton: {
    marginTop: 8,
  },
  addCertForm: {
    marginTop: 12,
    padding: 12,
    backgroundColor: colors.surfaceElevated,
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
    backgroundColor: colors.surface,
    borderRadius: 8,
    marginBottom: 8,
  },
  gymOptionSelected: {
    backgroundColor: colors.primaryMuted,
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
    borderBottomColor: colors.border,
  },
  climbingInfoLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textMuted,
  },
  climbingInfoValue: {
    fontSize: 14,
    color: colors.text,
  },
  certificationsList: {
    marginTop: 12,
  },
});

export default ProfileScreen;
