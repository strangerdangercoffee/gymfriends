import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
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
  /** Pre-fill phone when opening from "add friend" not found flow */
  initialPhone?: string;
}

const FriendInvitationModal: React.FC<FriendInvitationModalProps> = ({
  visible,
  onClose,
  onInvitationSent,
  initialPhone = '',
}) => {
  const { user } = useAuth();
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (visible && initialPhone) {
      setPhone(initialPhone);
    } else if (!visible) {
      setPhone('');
    }
  }, [visible, initialPhone]);

  const isValidPhone = (value: string): boolean => {
    const digitsOnly = value.replace(/\D/g, '');
    return digitsOnly.length >= 10 && digitsOnly.length <= 15;
  };

  const formatPhoneNumber = (value: string): string => {
    const digitsOnly = value.replace(/\D/g, '');
    if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
      return digitsOnly.substring(1);
    }
    return digitsOnly;
  };

  const handleSendInvitation = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to send invitations');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('Error', 'Please enter a phone number');
      return;
    }
    if (!isValidPhone(phone.trim())) {
      Alert.alert('Error', 'Please enter a valid phone number (10–15 digits)');
      return;
    }

    setIsLoading(true);
    try {
      const invitationData: CreateInvitationData = {
        inviterId: user.id,
        inviterName: user.name,
        inviterEmail: user.email,
        inviteePhone: formatPhoneNumber(phone.trim()),
      };
      await invitationService.createInvitation(invitationData);

      Alert.alert(
        'Invitation Sent!',
        `We've sent an invitation to ${phone.trim()}. They'll be added as your friend when they sign up!`,
        [
          {
            text: 'OK',
            onPress: () => {
              setPhone('');
              onClose();
              onInvitationSent();
            },
          },
        ]
      );
    } catch (error: any) {
      if (error.message?.includes('already has an account')) {
        Alert.alert(
          'Already Has Account',
          'This person already has an account. Add them as a friend from the Friends tab.',
          [{ text: 'OK' }]
        );
      } else if (error.message?.includes('already sent')) {
        Alert.alert(
          'Invitation Already Sent',
          'You have already sent an invitation to this phone number.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', error.message || 'Failed to send invitation');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setPhone('');
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
                label="Friend's Phone Number"
                placeholder="Enter their phone number"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.contactInput}
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
                disabled={!phone.trim() || isLoading}
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
  contactInput: {
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
