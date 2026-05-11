import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { invitationService, FriendInvitation } from '../services/invitations';
import { useAuth } from '../context/AuthContext';
import Card from './Card';
import Button from './Button';
import { colors } from '../theme/colors';

const PendingInvitations: React.FC = () => {
  const { user } = useAuth();
  const [invitations, setInvitations] = useState<FriendInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadInvitations();
    }
  }, [user]);

  const loadInvitations = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      const sentInvitations = await invitationService.getSentInvitations(user.id);
      setInvitations(sentInvitations);
    } catch (error) {
      console.error('Error loading invitations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    Alert.alert(
      'Cancel Invitation',
      'Are you sure you want to cancel this invitation?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await invitationService.cancelInvitation(invitationId, user!.id);
              await loadInvitations();
            } catch (error) {
              Alert.alert('Error', 'Failed to cancel invitation');
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: FriendInvitation['status']) => {
    switch (status) {
      case 'pending':
        return colors.secondary;
      case 'accepted':
        return colors.success;
      case 'declined':
        return colors.error;
      case 'expired':
        return colors.textMuted;
      default:
        return colors.textMuted;
    }
  };

  const getStatusIcon = (status: FriendInvitation['status']) => {
    switch (status) {
      case 'pending':
        return 'time-outline';
      case 'accepted':
        return 'checkmark-circle-outline';
      case 'declined':
        return 'close-circle-outline';
      case 'expired':
        return 'alert-circle-outline';
      default:
        return 'help-circle-outline';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString([], { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const renderInvitation = ({ item }: { item: FriendInvitation }) => {
    const contactInfo = item.inviteeEmail || item.inviteePhone || 'Unknown';
    const contactType = item.inviteeEmail ? 'email' : 'phone';
    
    return (
      <Card style={styles.invitationCard}>
        <View style={styles.invitationHeader}>
          <View style={styles.invitationInfo}>
            <View style={styles.contactRow}>
              <Ionicons
                name={contactType === 'email' ? 'mail' : 'chatbubble'}
                size={16}
                color={colors.textMuted}
                style={styles.contactIcon}
              />
              <Text style={styles.inviteeContact}>{contactInfo}</Text>
            </View>
            <Text style={styles.invitationDate}>
              Sent {formatDate(item.createdAt)}
            </Text>
          </View>
        <View style={styles.statusContainer}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Ionicons 
              name={getStatusIcon(item.status) as any} 
              size={12} 
              color={colors.text} 
            />
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        </View>
      </View>

      {item.status === 'pending' && (
        <View style={styles.invitationActions}>
          <Text style={styles.expiresText}>
            Expires {formatDate(item.expiresAt)}
          </Text>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => handleCancelInvitation(item.id)}
          >
            <Ionicons name="close" size={16} color={colors.error} />
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {item.status === 'accepted' && (
        <View style={styles.acceptedInfo}>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={styles.acceptedText}>
            Accepted {item.acceptedAt ? formatDate(item.acceptedAt) : ''}
          </Text>
        </View>
      )}
      </Card>
    );
  };

  if (isLoading) {
    return (
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Pending Invitations</Text>
        <Text style={styles.loadingText}>Loading...</Text>
      </Card>
    );
  }

  if (invitations.length === 0) {
    return null;
  }

  return (
    <Card style={styles.section}>
      <Text style={styles.sectionTitle}>Pending Invitations</Text>
      <Text style={styles.sectionSubtitle}>
        {invitations.length} invitation{invitations.length === 1 ? '' : 's'} sent
      </Text>
      
      <FlatList
        data={invitations}
        renderItem={renderInvitation}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
      />
    </Card>
  );
};

const styles = StyleSheet.create({
  section: {
    marginHorizontal: 16,
    marginVertical: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: 20,
  },
  invitationCard: {
    marginBottom: 12,
  },
  invitationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  invitationInfo: {
    flex: 1,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  contactIcon: {
    marginRight: 6,
  },
  inviteeContact: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  invitationDate: {
    fontSize: 14,
    color: colors.textMuted,
  },
  statusContainer: {
    marginLeft: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.text,
    marginLeft: 4,
    textTransform: 'capitalize',
  },
  invitationActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  expiresText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  cancelText: {
    fontSize: 12,
    color: colors.error,
    marginLeft: 4,
  },
  acceptedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  acceptedText: {
    fontSize: 12,
    color: colors.success,
    marginLeft: 4,
  },
});

export default PendingInvitations;

