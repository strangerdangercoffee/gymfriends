import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { invitationService, CreateInvitationData } from '../services/invitations';
import { useAuth } from '../context/AuthContext';
import Card from './Card';
import Input from './Input';
import Button from './Button';

interface FriendInvitationModalProps {
  visible: boolean;
  onClose: () => void;
  onInvitationSent: () => void;
}

const FriendInvitationModal: React.FC<FriendInvitationModalProps> = ({
  visible,
  onClose,
  onInvitationSent,
}) => {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSendInvitation = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to send invitations');
      return;
    }

    if (!email.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    if (!isValidEmail(email.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    try {
      const invitationData: CreateInvitationData = {
        inviterId: user.id,
        inviterName: user.name,
        inviterEmail: user.email,
        inviteeEmail: email.trim(),
      };

      await invitationService.createInvitation(invitationData);
      
      Alert.alert(
        'Invitation Sent!',
        `We've sent an invitation to ${email.trim()}. They'll be added as your friend when they sign up!`,
        [
          {
            text: 'OK',
            onPress: () => {
              setEmail('');
              onClose();
              onInvitationSent();
            },
          },
        ]
      );
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        Alert.alert(
          'User Already Exists',
          'This user already has an account. Try adding them as a friend directly.',
          [
            { text: 'OK' },
            {
              text: 'Add as Friend',
              onPress: () => {
                // This would trigger the regular add friend flow
                onClose();
              },
            },
          ]
        );
      } else if (error.message.includes('already sent')) {
        Alert.alert(
          'Invitation Already Sent',
          'You have already sent an invitation to this email address.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', error.message || 'Failed to send invitation');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleClose = () => {
    setEmail('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <Card style={styles.modal}>
            <View style={styles.header}>
              <Text style={styles.title}>Invite a Friend</Text>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            <View style={styles.content}>
              <Text style={styles.description}>
                Invite a friend to join Gym Friends! They'll be automatically added as your friend when they sign up.
              </Text>

              <Input
                label="Friend's Email"
                placeholder="Enter their email address"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.emailInput}
              />

              <View style={styles.features}>
                <Text style={styles.featuresTitle}>What they'll get:</Text>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#34C759" />
                  <Text style={styles.featureText}>Free access to Gym Friends</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#34C759" />
                  <Text style={styles.featureText}>Automatically added as your friend</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#34C759" />
                  <Text style={styles.featureText}>See when you're at the gym</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#34C759" />
                  <Text style={styles.featureText}>Coordinate workout schedules</Text>
                </View>
              </View>
            </View>

            <View style={styles.actions}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={handleClose}
                style={styles.cancelButton}
              />
              <Button
                title={isLoading ? 'Sending...' : 'Send Invitation'}
                onPress={handleSendInvitation}
                loading={isLoading}
                disabled={!email.trim() || isLoading}
                style={styles.sendButton}
              />
            </View>
          </Card>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 400,
  },
  modal: {
    padding: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E7',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  description: {
    fontSize: 16,
    color: '#8E8E93',
    lineHeight: 22,
    marginBottom: 20,
  },
  emailInput: {
    marginBottom: 20,
  },
  features: {
    marginBottom: 20,
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureText: {
    fontSize: 14,
    color: '#8E8E93',
    marginLeft: 8,
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
  },
  sendButton: {
    flex: 1,
  },
});

export default FriendInvitationModal;

