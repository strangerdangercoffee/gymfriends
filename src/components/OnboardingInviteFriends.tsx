import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { invitationService } from '../services/invitations';
import Button from './Button';
import Input from './Input';

interface OnboardingInviteFriendsProps {
  onComplete: () => void;
  onSkip: () => void;
}

const normalizePhone = (value: string): string => value.replace(/\D/g, '');

const isValidPhone = (value: string): boolean => {
  const digits = normalizePhone(value);
  return digits.length >= 10 && digits.length <= 15;
};

const OnboardingInviteFriends: React.FC<OnboardingInviteFriendsProps> = ({ onComplete, onSkip }) => {
  const { user } = useAuth();
  const [phoneInput, setPhoneInput] = useState('');
  const [toInvite, setToInvite] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleAdd = () => {
    const trimmed = phoneInput.trim();
    if (!trimmed) return;
    const normalized = normalizePhone(trimmed);
    if (!isValidPhone(trimmed)) {
      Alert.alert('Invalid number', 'Please enter a valid phone number (10–15 digits).');
      return;
    }
    if (toInvite.includes(normalized)) {
      Alert.alert('Already added', 'This number is already in the list.');
      return;
    }
    setToInvite((prev) => [...prev, normalized]);
    setPhoneInput('');
  };

  const handleRemove = (normalized: string) => {
    setToInvite((prev) => prev.filter((p) => p !== normalized));
  };

  const handleSendInvitations = async () => {
    if (!user || toInvite.length === 0) return;
    setIsLoading(true);
    let sent = 0;
    const errors: string[] = [];
    for (const phone of toInvite) {
      try {
        await invitationService.createInvitation({
          inviterId: user.id,
          inviterName: user.name,
          inviterEmail: user.email,
          inviteePhone: phone,
        });
        sent += 1;
      } catch (e: any) {
        if (e.message?.includes('already has an account')) {
          errors.push(`${phone}: already has an account`);
        } else {
          errors.push(`${phone}: ${e.message || 'Failed'}`);
        }
      }
    }
    setIsLoading(false);
    if (errors.length > 0) {
      Alert.alert(
        'Some invitations could not be sent',
        errors.slice(0, 3).join('\n') + (errors.length > 3 ? `\n...and ${errors.length - 3} more` : ''),
        [{ text: 'OK' }]
      );
    }
    if (sent > 0) {
      Alert.alert('Invitations sent', `Invitations sent to ${sent} ${sent === 1 ? 'person' : 'people'}.`, [
        { text: 'OK', onPress: onComplete },
      ]);
    } else {
      onComplete();
    }
  };

  const handleSkip = () => {
    onSkip();
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.iconWrap}>
        <Ionicons name="people" size={48} color="#007AFF" />
      </View>
      <Text style={styles.title}>Invite friends</Text>
      <Text style={styles.description}>
        Add phone numbers of people you'd like to invite. They'll be added as friends when they sign up.
      </Text>

      <View style={styles.addRow}>
        <Input
          placeholder="Phone number"
          value={phoneInput}
          onChangeText={setPhoneInput}
          keyboardType="phone-pad"
          autoCapitalize="none"
          style={styles.input}
        />
        <TouchableOpacity
          style={[styles.addButton, (!phoneInput.trim() || isLoading) && styles.addButtonDisabled]}
          onPress={handleAdd}
          disabled={!phoneInput.trim() || isLoading}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {toInvite.length > 0 ? (
        <>
          <Text style={styles.listLabel}>To invite ({toInvite.length})</Text>
          <FlatList
            data={toInvite}
            keyExtractor={(item) => item}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <View style={styles.listRow}>
                <Text style={styles.listPhone}>{item}</Text>
                <TouchableOpacity
                  onPress={() => handleRemove(item)}
                  style={styles.removeButton}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons name="close-circle" size={22} color="#8E8E93" />
                </TouchableOpacity>
              </View>
            )}
          />
          <Button
            title={isLoading ? 'Sending...' : `Send invitations (${toInvite.length})`}
            onPress={handleSendInvitations}
            loading={isLoading}
            disabled={isLoading}
            style={styles.primaryButton}
          />
        </>
      ) : null}

      <TouchableOpacity style={styles.skipButton} onPress={handleSkip} disabled={isLoading}>
        <Text style={styles.skipText}>I'll do this later</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 24, paddingBottom: 40 },
  iconWrap: { alignItems: 'center', marginBottom: 24 },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  input: { flex: 1 },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDisabled: { opacity: 0.5 },
  listLabel: { fontSize: 14, fontWeight: '600', color: '#000', marginBottom: 8 },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    marginBottom: 6,
  },
  listPhone: { fontSize: 16, color: '#000' },
  removeButton: { padding: 4 },
  primaryButton: { marginTop: 16, marginBottom: 24 },
  skipButton: { alignSelf: 'center', paddingVertical: 12 },
  skipText: { fontSize: 16, color: '#8E8E93', fontWeight: '500' },
});

export default OnboardingInviteFriends;
