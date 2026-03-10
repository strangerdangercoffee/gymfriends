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
import { WorkoutInvitationWithResponses } from '../types';

interface WorkoutBailModalProps {
  visible: boolean;
  onClose: () => void;
  invitation: WorkoutInvitationWithResponses | null;
  onBail: (invitationId: string, reason?: string) => Promise<void>;
}

const WorkoutBailModal: React.FC<WorkoutBailModalProps> = ({
  visible,
  onClose,
  invitation,
  onBail,
}) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const commonReasons = [
    'Something came up',
    'Not feeling well',
    'Running late',
    'Change of plans',
    'Weather issues',
    'Other commitment',
  ];

  const handleBail = async () => {
    if (!invitation?.id) {
      Alert.alert('Error', 'Invalid invitation');
      return;
    }

    setIsSubmitting(true);
    try {
      console.log(`[WorkoutBailModal] Calling onBail for invitation ${invitation.id}`);
      await onBail(invitation.id, reason.trim() || undefined);
      console.log(`[WorkoutBailModal] Bail successful`);
      Alert.alert('Success', 'You have bailed from the workout. Other participants have been notified.');
      setReason('');
      onClose();
    } catch (error) {
      console.error('[WorkoutBailModal] Error bailing from workout:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to bail from workout. Please try again.';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setReason('');
    onClose();
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString([], { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric'
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose}>
            <Text style={styles.cancelButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Bail from Workout</Text>
          <TouchableOpacity 
            onPress={handleBail}
            disabled={isSubmitting}
          >
            <Text style={[styles.bailButton, isSubmitting && styles.bailButtonDisabled]}>
              {isSubmitting ? 'Bailing...' : 'Bail'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Workout Info */}
          {invitation && (
            <View style={styles.section}>
              <View style={styles.workoutInfo}>
                <Text style={styles.workoutTitle}>{invitation.title}</Text>
                <View style={styles.workoutDetails}>
                  <View style={styles.detailRow}>
                    <Ionicons name="location-outline" size={16} color="#8E8E93" />
                    <Text style={styles.detailText}>{invitation.gym.name}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Ionicons name="calendar-outline" size={16} color="#8E8E93" />
                    <Text style={styles.detailText}>
                      {formatDate(invitation.startTime)} at {formatTime(invitation.startTime)}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Reason Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Why are you bailing?</Text>
            <Text style={styles.sectionSubtitle}>
              Let your workout buddies know why you can't make it (optional)
            </Text>

            {/* Common Reasons */}
            <View style={styles.reasonsGrid}>
              {commonReasons.map((commonReason) => (
                <TouchableOpacity
                  key={commonReason}
                  style={[
                    styles.reasonButton,
                    reason === commonReason && styles.reasonButtonSelected
                  ]}
                  onPress={() => setReason(commonReason)}
                >
                  <Text style={[
                    styles.reasonButtonText,
                    reason === commonReason && styles.reasonButtonTextSelected
                  ]}>
                    {commonReason}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Custom Reason */}
            <View style={styles.customReasonSection}>
              <Text style={styles.customReasonLabel}>Or write your own reason:</Text>
              <TextInput
                style={styles.customReasonInput}
                value={reason}
                onChangeText={setReason}
                placeholder="Enter your reason..."
                placeholderTextColor="#8E8E93"
                multiline
                numberOfLines={3}
                maxLength={200}
              />
              <Text style={styles.characterCount}>
                {reason.length}/200 characters
              </Text>
            </View>
          </View>

          {/* Warning */}
          <View style={styles.section}>
            <View style={styles.warningBox}>
              <Ionicons name="information-circle-outline" size={20} color="#FF9500" />
              <View style={styles.warningContent}>
                <Text style={styles.warningTitle}>What happens when you bail?</Text>
                <Text style={styles.warningText}>
                  • Other participants will be notified that you bailed{'\n'}
                  • Your reason (if provided) will be shared with them{'\n'}
                  • You can still see the workout in your calendar{'\n'}
                  • You can re-join if plans change
                </Text>
              </View>
            </View>
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
    borderBottomColor: '#E9ECEF',
  },
  cancelButton: {
    fontSize: 16,
    color: '#007AFF',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
  },
  bailButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF9500',
  },
  bailButtonDisabled: {
    color: '#8E8E93',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 16,
  },
  workoutInfo: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  workoutTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 12,
  },
  workoutDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#6C757D',
  },
  reasonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  reasonButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    backgroundColor: '#FFFFFF',
  },
  reasonButtonSelected: {
    backgroundColor: '#FF9500',
    borderColor: '#FF9500',
  },
  reasonButtonText: {
    fontSize: 14,
    color: '#6C757D',
  },
  reasonButtonTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  customReasonSection: {
    marginTop: 8,
  },
  customReasonLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6C757D',
    marginBottom: 8,
  },
  customReasonInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#212529',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'right',
    marginTop: 4,
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: '#FFF3CD',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFEAA7',
  },
  warningContent: {
    flex: 1,
    marginLeft: 12,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#856404',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 13,
    color: '#856404',
    lineHeight: 18,
  },
  bottomSpacing: {
    height: 40,
  },
});

export default WorkoutBailModal;
