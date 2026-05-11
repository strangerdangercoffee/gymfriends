import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { userApi } from '../services/api';
import { invitationService } from '../services/invitations';
import Button from './Button';
import Input from './Input';
import { colors } from '../theme/colors';

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

  const handleSavePhone = async () => {
    const trimmed = phone.trim();
    if (!trimmed) { setError('Please enter your phone number'); return; }
    if (!isValidPhone(trimmed)) { setError('Please enter a valid phone number (10–15 digits)'); return; }
    if (!user?.id) return;

    const normalizedPhone = normalizePhone(trimmed);
    setError('');
    setIsLoading(true);
    try {
      await userApi.updateUser(user.id, { phone: normalizedPhone });
      await refreshUser();
      const pending = await invitationService.getPendingInvitations(normalizedPhone);
      for (const inv of pending) {
        try { await invitationService.acceptInvitation(inv.id, user.id); } catch { /* ignore */ }
      }
      onComplete(normalizedPhone);
    } catch (e: any) {
      setError(e.message || 'Could not save phone number. Please try again.');
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
      <View style={styles.iconContainer}>
        <Ionicons
          name="call"
          size={48}
          color={colors.primary}
        />
      </View>

      <>
        <Text style={styles.title}>Add your phone number</Text>
        <Text style={styles.description}>
          Make it easier for friends to find you, add you to climbing groups, plan trips and sessions with you.
        </Text>

        <Input
          label="Phone number"
          placeholder="(555) 555-5555"
          value={phone}
          onChangeText={(t) => { setPhone(t); setError(''); }}
          keyboardType="phone-pad"
          autoCapitalize="none"
          editable={!isLoading}
          containerStyle={styles.input}
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Button
          title={isLoading ? 'Saving…' : 'Continue'}
          onPress={handleSavePhone}
          loading={isLoading}
          disabled={!phone.trim() || isLoading}
          style={styles.primaryButton}
        />
        <TouchableOpacity style={styles.skipButton} onPress={onSkip} disabled={isLoading}>
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
      </>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 24, paddingBottom: 40, paddingTop: 8 },
  iconContainer: {
    alignSelf: 'center',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 28,
  },
  input: { marginBottom: 8 },
  errorText: {
    fontSize: 14,
    color: colors.error,
    marginBottom: 12,
    textAlign: 'center',
  },
  primaryButton: { marginTop: 8, marginBottom: 16 },
  skipButton: { alignSelf: 'center', paddingVertical: 12 },
  skipText: { fontSize: 16, color: colors.textMuted, fontWeight: '500' },
});

export default OnboardingPhoneStep;
