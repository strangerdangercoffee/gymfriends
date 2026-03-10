import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useLocation } from '../context/LocationContext';
import Card from './Card';
import Button from './Button';
import LocationPermissionModal from './LocationPermissionModal';

interface OnboardingCheckInProps {
  onComplete: () => void;
}

const OnboardingCheckIn: React.FC<OnboardingCheckInProps> = ({ onComplete }) => {
  const { user, updateProfile } = useAuth();
  const {
    hasPermissions,
    requestPermissions,
    hasBackgroundPermission,
  } = useLocation();
  
  const [autoCheckIn, setAutoCheckIn] = useState(user?.privacySettings?.autoCheckIn ?? false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleToggleAutoCheckIn = async (value: boolean) => {
    setAutoCheckIn(value);
    
    if (value && !hasBackgroundPermission) {
      // Show location permission modal
      setShowLocationModal(true);
      return;
    }

    // Save the preference
    try {
      await updateProfile({
        privacySettings: {
          ...user?.privacySettings,
          autoCheckIn: value,
        },
      });
    } catch (error) {
      console.error('Error updating auto check-in preference:', error);
      setAutoCheckIn(!value); // Revert on error
    }
  };

  const handleLocationPermissionGranted = async () => {
    setShowLocationModal(false);
    // Save auto check-in preference
    try {
      await updateProfile({
        privacySettings: {
          ...user?.privacySettings,
          autoCheckIn: true,
        },
      });
    } catch (error) {
      console.error('Error updating auto check-in preference:', error);
    }
  };

  const handleContinue = async () => {
    setIsSaving(true);
    try {
      // Save the final preference
      await updateProfile({
        privacySettings: {
          ...user?.privacySettings,
          autoCheckIn: autoCheckIn,
        },
      });
      onComplete();
    } catch (error) {
      console.error('Error saving check-in preferences:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="checkmark-circle" size={60} color="#007AFF" />
          </View>
          <Text style={styles.title}>Check-In Options</Text>
          <Text style={styles.description}>
            Choose how you'd like to check in to your gyms
          </Text>
        </View>

        {/* Manual Check-In Card */}
        <Card style={styles.featureCard}>
          <View style={styles.featureHeader}>
            <View style={[styles.featureIcon, { backgroundColor: '#E3F2FD' }]}>
              <Ionicons name="hand-left-outline" size={24} color="#007AFF" />
            </View>
            <View style={styles.featureInfo}>
              <Text style={styles.featureTitle}>Manual Check-In</Text>
              <Text style={styles.featureDescription}>
                Check in manually when you arrive at the gym. Your friends will see you're there!
              </Text>
            </View>
          </View>
          <View style={styles.featureDetails}>
            <View style={styles.detailItem}>
              <Ionicons name="checkmark-circle" size={16} color="#34C759" />
              <Text style={styles.detailText}>Tap to check in from your profile</Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="checkmark-circle" size={16} color="#34C759" />
              <Text style={styles.detailText}>Update your friends in real-time</Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="checkmark-circle" size={16} color="#34C759" />
              <Text style={styles.detailText}>Check out when you leave</Text>
            </View>
          </View>
        </Card>

        {/* Auto Check-In Card */}
        <Card style={styles.featureCard}>
          <View style={styles.featureHeader}>
            <View style={[styles.featureIcon, { backgroundColor: '#E8F5E9' }]}>
              <Ionicons name="location" size={24} color="#34C759" />
            </View>
            <View style={styles.featureInfo}>
              <Text style={styles.featureTitle}>Auto Check-In</Text>
              <Text style={styles.featureDescription}>
                Automatically check in when you arrive at the gym (within 500 feet)
              </Text>
            </View>
          </View>
          
          <View style={styles.toggleContainer}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Enable Auto Check-In</Text>
              <Text style={styles.toggleDescription}>
                Requires location permissions
              </Text>
            </View>
            <Switch
              value={autoCheckIn}
              onValueChange={handleToggleAutoCheckIn}
              trackColor={{ false: '#E5E5E7', true: '#34C759' }}
              thumbColor="white"
            />
          </View>

          {autoCheckIn && (
            <View style={styles.featureDetails}>
              <View style={styles.detailItem}>
                <Ionicons name="checkmark-circle" size={16} color="#34C759" />
                <Text style={styles.detailText}>Automatic check-in when you arrive</Text>
              </View>
              <View style={styles.detailItem}>
                <Ionicons name="checkmark-circle" size={16} color="#34C759" />
                <Text style={styles.detailText}>Automatic check-out when you leave</Text>
              </View>
              <View style={styles.detailItem}>
                <Ionicons name="checkmark-circle" size={16} color="#34C759" />
                <Text style={styles.detailText}>Works in the background</Text>
              </View>
              {!hasBackgroundPermission && (
                <View style={styles.warningBox}>
                  <Ionicons name="warning-outline" size={16} color="#FF9500" />
                  <Text style={styles.warningText}>
                    Background location permission required
                  </Text>
                </View>
              )}
            </View>
          )}
        </Card>

        {/* Info Box */}
        <Card style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Ionicons name="information-circle-outline" size={20} color="#007AFF" />
            <Text style={styles.infoTitle}>You can change this anytime</Text>
          </View>
          <Text style={styles.infoText}>
            Update your check-in preferences in your Profile settings at any time.
          </Text>
        </Card>
      </ScrollView>

      {/* Continue Button */}
      <View style={styles.footer}>
        <Button
          title="Continue"
          onPress={handleContinue}
          loading={isSaving}
          style={styles.continueButton}
        />
      </View>

      {/* Location Permission Modal */}
      <LocationPermissionModal
        visible={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        onPermissionGranted={handleLocationPermissionGranted}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E3F2FD',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  featureCard: {
    marginBottom: 16,
    padding: 20,
  },
  featureHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  featureInfo: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  toggleInfo: {
    flex: 1,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  toggleDescription: {
    fontSize: 12,
    color: '#8E8E93',
  },
  featureDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#8E8E93',
    marginLeft: 8,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  warningText: {
    fontSize: 12,
    color: '#FF9500',
    marginLeft: 8,
    flex: 1,
  },
  infoCard: {
    marginTop: 8,
    padding: 16,
    backgroundColor: '#E3F2FD',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginLeft: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#007AFF',
    lineHeight: 18,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: '#F2F2F7',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E7',
  },
  continueButton: {
    width: '100%',
  },
});

export default OnboardingCheckIn;
