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
import ContactsPickerModal from './ContactsPickerModal';
import { colors } from '../theme/colors';
import { type ContactPhoneRow } from '../utils/contactsInvite';

interface OnboardingInviteFriendsProps {
  onComplete: () => void;
  onSkip: () => void;
}

const OnboardingInviteFriends: React.FC<OnboardingInviteFriendsProps> = ({ onComplete, onSkip }) => {
  const { user } = useAuth();
  const [toInvite, setToInvite] = useState<ContactPhoneRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [contactsOpen, setContactsOpen] = useState(false);

  const handleContactPick = (row: ContactPhoneRow) => {
    if (toInvite.some((c) => c.normalized === row.normalized)) {
      Alert.alert('Already added', 'This contact is already in your invite list.');
      return;
    }
    setToInvite((prev) => [...prev, row]);
  };

  const handleRemove = (normalized: string) => {
    setToInvite((prev) => prev.filter((c) => c.normalized !== normalized));
  };

  const handleSendInvitations = async () => {
    if (!user || toInvite.length === 0) return;
    setIsLoading(true);
    let sent = 0;
    const errors: string[] = [];
    for (const contact of toInvite) {
      try {
        await invitationService.createInvitation({
          inviterId: user.id,
          inviterName: user.name,
          inviterEmail: user.email,
          inviteePhone: contact.normalized,
        });
        sent += 1;
      } catch (e: any) {
        if (e.message?.includes('already has an account')) {
          errors.push(`${contact.name}: already has an account`);
        } else {
          errors.push(`${contact.name}: ${e.message || 'Failed'}`);
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

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.iconWrap}>
          <Ionicons name="people" size={48} color={colors.primary} />
        </View>
        <Text style={styles.title}>Invite friends</Text>
        <Text style={styles.description}>
          Choose people from your contacts to invite. They'll be added as friends when they sign up.
        </Text>

        <TouchableOpacity
          style={styles.contactsCta}
          onPress={() => setContactsOpen(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="book-outline" size={22} color={colors.secondary} />
          <View style={styles.contactsCtaTextWrap}>
            <Text style={styles.contactsCtaTitle}>Choose from contacts</Text>
            <Text style={styles.contactsCtaSub}>Pick who you want to invite</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </TouchableOpacity>

        {toInvite.length > 0 ? (
          <>
            <Text style={styles.listLabel}>To invite ({toInvite.length})</Text>
            <FlatList
              data={toInvite}
              keyExtractor={(item) => item.normalized}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <View style={styles.listRow}>
                  <View style={styles.listRowText}>
                    <Text style={styles.listName}>{item.name}</Text>
                    <Text style={styles.listPhone}>{item.phoneDisplay}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleRemove(item.normalized)}
                    style={styles.removeButton}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Ionicons name="close-circle" size={22} color={colors.textMuted} />
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

        <TouchableOpacity style={styles.skipButton} onPress={onSkip} disabled={isLoading}>
          <Text style={styles.skipText}>I'll do this later</Text>
        </TouchableOpacity>
      </ScrollView>

      <ContactsPickerModal
        visible={contactsOpen}
        onClose={() => setContactsOpen(false)}
        onPick={handleContactPick}
        keepOpenAfterPick
        title="Choose contacts to invite"
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 24, paddingBottom: 40 },
  iconWrap: { alignItems: 'center', marginBottom: 24 },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  contactsCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.secondaryBorder,
    backgroundColor: colors.secondaryMuted,
    marginBottom: 16,
  },
  contactsCtaTextWrap: { flex: 1 },
  contactsCtaTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  contactsCtaSub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  listLabel: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8 },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  listRowText: { flex: 1 },
  listName: { fontSize: 15, fontWeight: '600', color: colors.text },
  listPhone: { fontSize: 13, color: colors.textMuted, marginTop: 1 },
  removeButton: { padding: 4 },
  primaryButton: { marginTop: 16, marginBottom: 24 },
  skipButton: { alignSelf: 'center', paddingVertical: 12 },
  skipText: { fontSize: 16, color: colors.textMuted, fontWeight: '500' },
});

export default OnboardingInviteFriends;
