import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useLocation } from '../context/LocationContext';
import { useApp } from '../context/AppContext';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import PendingInvitations from '../components/PendingInvitations';
import LocationPermissionModal from '../components/LocationPermissionModal';

const ProfileScreen: React.FC = () => {
  const { user, signOut, updateProfile } = useAuth();
  const { 
    hasPermissions, 
    requestPermissions, 
    isTracking, 
    startTracking, 
    stopTracking,
    hasBackgroundPermission,
    isGeofencingActive,
  } = useLocation();
  const { friends, gyms } = useApp();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [shareLocation, setShareLocation] = useState(user?.privacySettings?.shareLocation ?? true);
  const [shareSchedule, setShareSchedule] = useState(user?.privacySettings?.shareSchedule ?? true);
  const [autoCheckIn, setAutoCheckIn] = useState(user?.privacySettings?.autoCheckIn ?? false);
  const [showLocationPermissionModal, setShowLocationPermissionModal] = useState(false);

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

  const followedGyms = gyms.filter(gym => 
    user?.followedGyms?.includes(gym.id)
  );

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

  const renderStatsSection = () => (
    <Card style={styles.section}>
      <Text style={styles.sectionTitle}>Stats</Text>
      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{friends.length}</Text>
          <Text style={styles.statLabel}>Friends</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{followedGyms.length}</Text>
          <Text style={styles.statLabel}>Gyms</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>0</Text>
          <Text style={styles.statLabel}>Workouts</Text>
        </View>
      </View>
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
    </Card>
  );

  return (
    <>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {renderProfileSection()}
        {renderStatsSection()}
        <PendingInvitations />
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
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#8E8E93',
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
});

export default ProfileScreen;
