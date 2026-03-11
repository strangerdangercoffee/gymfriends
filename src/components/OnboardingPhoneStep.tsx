import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { userApi } from '../services/api';
import { invitationService } from '../services/invitations';
import Button from './Button';
import Input from './Input';

interface OnboardingPhoneStepProps {
  onComplete: (phone?: string) => void;
  onSkip: () => void;
}

const normalizePhone = (value: string): string => value.replace(/\D/g, '');

const isValidPhone = (value: string): boolean => {
  const digits = normalizePhone(value);
  return digits.length >= 10 && digits.length <= 15;
};

const OnboardingPhoneStep: React.FC<OnboardingPhoneStepProps> = ({ onComplete, onSkip }) => {
  const { user, refreshUser } = useAuth();
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleContinue = async () => {
    if (!user?.id) return;
    const trimmed = phone.trim();
    if (!trimmed) {
      setError('Please enter your phone number');
      return;
    }
    if (!isValidPhone(trimmed)) {
      setError('Please enter a valid phone number (10–15 digits)');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      const normalized = normalizePhone(trimmed);
      await userApi.updateUser(user.id, { phone: normalized });
      await refreshUser();
      const pending = await invitationService.getPendingInvitations(normalized);
      for (const inv of pending) {
        try {
          await invitationService.acceptInvitation(inv.id, user.id);
        } catch {
          // ignore per-invitation errors
        }
      }
      onComplete(normalized);
    } catch (e: any) {
      setError(e.message || 'Failed to save phone number');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.iconWrap}>
        <Ionicons name="call" size={48} color="#007AFF" />
      </View>
      <Text style={styles.title}>Add your phone number</Text>
      <Text style={styles.description}>
        So friends can find you and we can link any invitations sent to this number to your account.
      </Text>
      <Input
        label="Phone number"
        placeholder="Enter your phone number"
        value={phone}
        onChangeText={(t) => { setPhone(t); setError(''); }}
        keyboardType="phone-pad"
        autoCapitalize="none"
        editable={!isLoading}
        style={styles.input}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <Button
        title={isLoading ? 'Saving...' : 'Continue'}
        onPress={handleContinue}
        loading={isLoading}
        disabled={!phone.trim() || isLoading}
        style={styles.primaryButton}
      />
      <TouchableOpacity style={styles.skipButton} onPress={onSkip} disabled={isLoading}>
        <Text style={styles.skipText}>Skip for now</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 24, paddingBottom: 40 },
  iconWrap: {
    alignItems: 'center',
    marginBottom: 24,
  },
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
  input: { marginBottom: 8 },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    marginBottom: 12,
  },
  primaryButton: { marginTop: 8, marginBottom: 16 },
  skipButton: { alignSelf: 'center', paddingVertical: 12 },
  skipText: { fontSize: 16, color: '#8E8E93', fontWeight: '500' },
});

export default OnboardingPhoneStep;
