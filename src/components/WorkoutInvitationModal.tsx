import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WorkoutInvitationWithResponses, User } from '../types';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';

interface WorkoutInvitationModalProps {
  visible: boolean;
  onClose: () => void;
  invitation: WorkoutInvitationWithResponses | null;
  onRespond: (invitationId: string, response: 'accepted' | 'declined') => Promise<void>;
  onBail: (invitationId: string) => void; // Changed: no longer async, just opens the bail modal
}

const WorkoutInvitationModal: React.FC<WorkoutInvitationModalProps> = ({
  visible,
  onClose,
  invitation,
  onRespond,
  onBail,
}) => {
  const { user } = useAuth();
  const { friends } = useApp();
  const [isResponding, setIsResponding] = useState(false);

  if (!invitation || !user) return null;

  // Helper function to get user name from response
  const getUserName = (response: any): string => {
    // If it's the current user, return "You"
    if (response.userId === user.id) {
      return 'You';
    }
    // Use the user information from the response if available
    if (response.user && response.user.name) {
      return response.user.name;
    }
    // If it's the inviter, return their name
    if (response.userId === invitation.inviterId) {
      return invitation.inviter.name;
    }
    // Look up in friends list as fallback
    const friend = friends.find(f => f.id === response.userId);
    return friend ? friend.name : 'Friend';
  };

  const userResponse = invitation.responses.find(r => r.userId === user.id);
  const isInviter = invitation.inviterId === user.id;
  const hasAccepted = userResponse?.response === 'accepted';
  const hasDeclined = userResponse?.response === 'declined';
  const hasBailed = userResponse?.response === 'bailed';
  const isPending = userResponse?.response === 'pending';

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString([], { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleAccept = async () => {
    if (!isPending) return;
    
    setIsResponding(true);
    try {
      await onRespond(invitation.id, 'accepted');
      Alert.alert('Success', 'You accepted the workout invitation!');
    } catch (error) {
      Alert.alert('Error', 'Failed to accept invitation. Please try again.');
    } finally {
      setIsResponding(false);
    }
  };

  const handleDecline = async () => {
    if (!isPending) return;
    
    Alert.alert(
      'Decline Invitation',
      'Are you sure you want to decline this workout invitation?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            setIsResponding(true);
            try {
              await onRespond(invitation.id, 'declined');
              Alert.alert('Success', 'You declined the workout invitation.');
            } catch (error) {
              Alert.alert('Error', 'Failed to decline invitation. Please try again.');
            } finally {
              setIsResponding(false);
            }
          },
        },
      ]
    );
  };

  const handleBail = () => {
    if (!hasAccepted) return;
    
    console.log('[WorkoutInvitationModal] handleBail called for invitation:', invitation.id);
    // Call onBail which should open the bail modal in the parent component
    // This is synchronous - it just sets state to show the bail modal
    onBail(invitation.id);
  };

  const getStatusColor = (response: string) => {
    switch (response) {
      case 'accepted': return '#34C759';
      case 'declined': return '#FF3B30';
      case 'bailed': return '#FF9500';
      case 'pending': return '#8E8E93';
      default: return '#8E8E93';
    }
  };

  const getStatusText = (response: string) => {
    switch (response) {
      case 'accepted': return 'Accepted';
      case 'declined': return 'Declined';
      case 'bailed': return 'Bailed';
      case 'pending': return 'Pending';
      default: return 'Unknown';
    }
  };

  const acceptedResponses = invitation.responses.filter(r => r.response === 'accepted');
  const declinedResponses = invitation.responses.filter(r => r.response === 'declined');
  const bailedResponses = invitation.responses.filter(r => r.response === 'bailed');
  const pendingResponses = invitation.responses.filter(r => r.response === 'pending');

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancelButton}>Close</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Workout Invitation</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Invitation Details */}
          <View style={styles.section}>
            <View style={styles.invitationHeader}>
              <View style={styles.inviterInfo}>
                <View style={styles.inviterAvatar}>
                  {invitation.inviter.avatar ? (
                    <Image source={{ uri: invitation.inviter.avatar }} style={styles.avatarImage} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarText}>
                        {invitation.inviter.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.inviterDetails}>
                  <Text style={styles.inviterName}>{invitation.inviter.name}</Text>
                  <Text style={styles.invitationText}>invited you to a workout</Text>
                </View>
              </View>
            </View>

            <View style={styles.workoutDetails}>
              <Text style={styles.workoutTitle}>{invitation.title}</Text>
              {invitation.description && (
                <Text style={styles.workoutDescription}>{invitation.description}</Text>
              )}
              
              <View style={styles.workoutInfo}>
                <View style={styles.infoRow}>
                  <Ionicons name="location-outline" size={16} color="#8E8E93" />
                  <Text style={styles.infoText}>{invitation.gym.name}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="calendar-outline" size={16} color="#8E8E93" />
                  <Text style={styles.infoText}>{formatDate(invitation.startTime)}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="time-outline" size={16} color="#8E8E93" />
                  <Text style={styles.infoText}>
                    {formatTime(invitation.startTime)} - {formatTime(invitation.endTime)}
                  </Text>
                </View>
                {invitation.workoutType && (
                  <View style={styles.infoRow}>
                    <Ionicons name="fitness-outline" size={16} color="#8E8E93" />
                    <Text style={styles.infoText}>{invitation.workoutType}</Text>
                  </View>
                )}
                {invitation.isRecurring && (
                  <View style={styles.infoRow}>
                    <Ionicons name="repeat-outline" size={16} color="#8E8E93" />
                    <Text style={styles.infoText}>
                      Recurring ({invitation.recurringPattern})
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Response Status */}
          {!isInviter && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Response</Text>
              <View style={styles.responseStatus}>
                <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(userResponse?.response || 'pending') }]} />
                <Text style={styles.statusText}>
                  {getStatusText(userResponse?.response || 'pending')}
                </Text>
              </View>
            </View>
          )}

          {/* Participants */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Participants</Text>
            
            {acceptedResponses.length > 0 && (
              <View style={styles.participantGroup}>
                <Text style={styles.participantGroupTitle}>Going ({acceptedResponses.length})</Text>
                {acceptedResponses.map((response) => (
                  <View key={response.id} style={styles.participantItem}>
                    <View style={styles.participantInfo}>
                      <View style={[styles.statusDot, { backgroundColor: '#34C759' }]} />
                      <Text style={styles.participantName}>
                        {getUserName(response)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {declinedResponses.length > 0 && (
              <View style={styles.participantGroup}>
                <Text style={styles.participantGroupTitle}>Declined ({declinedResponses.length})</Text>
                {declinedResponses.map((response) => (
                  <View key={response.id} style={styles.participantItem}>
                    <View style={styles.participantInfo}>
                      <View style={[styles.statusDot, { backgroundColor: '#FF3B30' }]} />
                      <Text style={styles.participantName}>
                        {getUserName(response)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {bailedResponses.length > 0 && (
              <View style={styles.participantGroup}>
                <Text style={styles.participantGroupTitle}>Bailed ({bailedResponses.length})</Text>
                {bailedResponses.map((response) => (
                  <View key={response.id} style={styles.participantItem}>
                    <View style={styles.participantInfo}>
                      <View style={[styles.statusDot, { backgroundColor: '#FF9500' }]} />
                      <Text style={styles.participantName}>
                        {getUserName(response)}
                      </Text>
                    </View>
                    {response.bailReason && (
                      <Text style={styles.bailReason}>"{response.bailReason}"</Text>
                    )}
                  </View>
                ))}
              </View>
            )}

            {pendingResponses.length > 0 && (
              <View style={styles.participantGroup}>
                <Text style={styles.participantGroupTitle}>Pending ({pendingResponses.length})</Text>
                {pendingResponses.map((response) => (
                  <View key={response.id} style={styles.participantItem}>
                    <View style={styles.participantInfo}>
                      <View style={[styles.statusDot, { backgroundColor: '#8E8E93' }]} />
                      <Text style={styles.participantName}>
                        {getUserName(response)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Action Buttons */}
          {!isInviter && (
            <View style={styles.section}>
              {isPending && (
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.declineButton]}
                    onPress={handleDecline}
                    disabled={isResponding}
                  >
                    <Ionicons name="close" size={20} color="#FF3B30" />
                    <Text style={styles.declineButtonText}>Decline</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.actionButton, styles.acceptButton]}
                    onPress={handleAccept}
                    disabled={isResponding}
                  >
                    <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                    <Text style={styles.acceptButtonText}>Accept</Text>
                  </TouchableOpacity>
                </View>
              )}

              {hasAccepted && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.bailButton]}
                  onPress={handleBail}
                >
                  <Ionicons name="exit-outline" size={20} color="#FF9500" />
                  <Text style={styles.bailButtonText}>Bail from Workout</Text>
                </TouchableOpacity>
              )}

              {(hasDeclined || hasBailed) && (
                <View style={styles.statusMessage}>
                  <Text style={styles.statusMessageText}>
                    You have {hasDeclined ? 'declined' : 'bailed from'} this workout invitation.
                  </Text>
                </View>
              )}
            </View>
          )}

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
  headerSpacer: {
    width: 50,
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
    marginBottom: 12,
  },
  invitationHeader: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  inviterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inviterAvatar: {
    marginRight: 12,
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
  },
  inviterDetails: {
    flex: 1,
  },
  inviterName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  invitationText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  workoutDetails: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    marginTop: 12,
  },
  workoutTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  workoutDescription: {
    fontSize: 16,
    color: '#6C757D',
    marginBottom: 16,
    lineHeight: 22,
  },
  workoutInfo: {
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#6C757D',
  },
  responseStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  participantGroup: {
    marginBottom: 16,
  },
  participantGroupTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6C757D',
    marginBottom: 8,
  },
  participantItem: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    marginBottom: 4,
  },
  participantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  participantName: {
    fontSize: 14,
    color: '#1C1C1E',
  },
  bailReason: {
    fontSize: 12,
    color: '#8E8E93',
    fontStyle: 'italic',
    marginTop: 4,
    marginLeft: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  acceptButton: {
    backgroundColor: '#34C759',
    borderColor: '#34C759',
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  declineButton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FF3B30',
  },
  declineButtonText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  bailButton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FF9500',
  },
  bailButtonText: {
    color: '#FF9500',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  statusMessage: {
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  statusMessageText: {
    fontSize: 14,
    color: '#6C757D',
    textAlign: 'center',
  },
  bottomSpacing: {
    height: 40,
  },
});

export default WorkoutInvitationModal;
