import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface LocationPermissionModalProps {
  visible: boolean;
  onClose: () => void;
  onRequestPermissions: () => Promise<void>;
  hasBackgroundPermission: boolean;
}

const LocationPermissionModal: React.FC<LocationPermissionModalProps> = ({
  visible,
  onClose,
  onRequestPermissions,
  hasBackgroundPermission,
}) => {
  const handleRequestPermissions = async () => {
    await onRequestPermissions();
  };

  const handleOpenSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="location" size={40} color="#007AFF" />
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.title}>
              Enable Auto Check-In
            </Text>

            <Text style={styles.description}>
              GymFriends can automatically check you in when you arrive at your gym, 
              so you never have to remember to do it manually!
            </Text>

            {/* Benefits Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Why enable this?</Text>
              
              <View style={styles.benefitItem}>
                <Ionicons name="checkmark-circle" size={24} color="#34C759" />
                <Text style={styles.benefitText}>
                  Automatically check in when within 500ft of your gym
                </Text>
              </View>

              <View style={styles.benefitItem}>
                <Ionicons name="checkmark-circle" size={24} color="#34C759" />
                <Text style={styles.benefitText}>
                  Let your friends know you're at the gym without lifting a finger
                </Text>
              </View>

              <View style={styles.benefitItem}>
                <Ionicons name="checkmark-circle" size={24} color="#34C759" />
                <Text style={styles.benefitText}>
                  Automatically check out when you leave
                </Text>
              </View>

              <View style={styles.benefitItem}>
                <Ionicons name="checkmark-circle" size={24} color="#34C759" />
                <Text style={styles.benefitText}>
                  Track your gym visits automatically
                </Text>
              </View>
            </View>

            {/* Privacy Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Privacy</Text>
              
              <View style={styles.privacyItem}>
                <Ionicons name="shield-checkmark" size={20} color="#007AFF" />
                <Text style={styles.privacyText}>
                  We only track your location to detect when you're at a gym
                </Text>
              </View>

              <View style={styles.privacyItem}>
                <Ionicons name="shield-checkmark" size={20} color="#007AFF" />
                <Text style={styles.privacyText}>
                  Your location data is never shared without your permission
                </Text>
              </View>

              <View style={styles.privacyItem}>
                <Ionicons name="shield-checkmark" size={20} color="#007AFF" />
                <Text style={styles.privacyText}>
                  You can disable this feature anytime in settings
                </Text>
              </View>
            </View>

            {/* Instructions Section */}
            {!hasBackgroundPermission && (
              <View style={styles.instructionsSection}>
                <Text style={styles.instructionsTitle}>
                  {Platform.OS === 'ios' ? 'iOS Instructions:' : 'Android Instructions:'}
                </Text>
                
                {Platform.OS === 'ios' ? (
                  <>
                    <Text style={styles.instructionStep}>
                      1. Tap "Enable" below
                    </Text>
                    <Text style={styles.instructionStep}>
                      2. Select "Always" or "Allow While Using App" when prompted
                    </Text>
                    <Text style={styles.instructionStep}>
                      3. On the next prompt, select "Change to Always Allow"
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.instructionStep}>
                      1. Tap "Enable" below
                    </Text>
                    <Text style={styles.instructionStep}>
                      2. Select "Allow all the time" when prompted
                    </Text>
                    <Text style={styles.instructionStep}>
                      3. Grant precise location access if asked
                    </Text>
                  </>
                )}
              </View>
            )}
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            {!hasBackgroundPermission ? (
              <>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleRequestPermissions}
                >
                  <Text style={styles.primaryButtonText}>Enable Auto Check-In</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={onClose}
                >
                  <Text style={styles.secondaryButtonText}>Maybe Later</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.successContainer}>
                  <Ionicons name="checkmark-circle" size={32} color="#34C759" />
                  <Text style={styles.successText}>
                    Auto check-in is enabled!
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={onClose}
                >
                  <Text style={styles.primaryButtonText}>Done</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.linkButton}
                  onPress={handleOpenSettings}
                >
                  <Text style={styles.linkButtonText}>Open Settings to Change</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingRight: 20,
  },
  benefitText: {
    fontSize: 15,
    color: '#333',
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  privacyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingRight: 20,
  },
  privacyText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 10,
    flex: 1,
    lineHeight: 18,
  },
  instructionsSection: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  instructionStep: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
    lineHeight: 20,
  },
  buttonContainer: {
    marginTop: 20,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 17,
    fontWeight: '500',
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  successText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
    marginLeft: 12,
  },
  linkButton: {
    padding: 12,
    alignItems: 'center',
  },
  linkButtonText: {
    color: '#007AFF',
    fontSize: 15,
    fontWeight: '500',
  },
});

export default LocationPermissionModal;


