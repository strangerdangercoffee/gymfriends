import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  ScrollView,
  Platform,
  Keyboard,
  KeyboardAvoidingView,
  InputAccessoryView,
  TextInput,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { userAreaPlansApi, tripInvitationsApi } from '../services/api';
import { notificationService } from '../services/notifications';
import { UserAreaPlan } from '../types';
import Button from './Button';
import Card from './Card';
import { colors, dateCalendarTheme } from '../theme/colors';

interface PlanTripModalProps {
  visible: boolean;
  onClose: () => void;
  areaId: string;
  areaName: string;
  onSuccess?: (plan: UserAreaPlan) => void;
}

const NOTES_INPUT_ACCESSORY_ID = 'planTripNotesAccessory';

function formatDateYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const PlanTripModal: React.FC<PlanTripModalProps> = ({
  visible,
  onClose,
  areaId,
  areaName,
  onSuccess,
}) => {
  const { user } = useAuth();
  const { friends } = useApp();
  const today = new Date();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'start' | 'end' | null>(null);
  const [selectedFriendIds, setSelectedFriendIds] = useState<Set<string>>(new Set());
  const [inviteMessage, setInviteMessage] = useState('');

  const toggleFriend = (friendId: string) => {
    setSelectedFriendIds((prev) => {
      const next = new Set(prev);
      if (next.has(friendId)) next.delete(friendId);
      else next.add(friendId);
      return next;
    });
  };

  const handleDateSelect = (dateString: string) => {
    if (datePickerMode === 'start') {
      setStartDate(dateString);
      setEndDate((prev) => (prev && prev < dateString ? dateString : prev));
    } else if (datePickerMode === 'end') {
      setEndDate(dateString);
    }
    setDatePickerMode(null);
  };

  const handleSubmit = async () => {
    if (!user?.id) return;
    if (!startDate.trim() || !endDate.trim()) {
      Alert.alert('Error', 'Please select start and end date');
      return;
    }
    if (endDate < startDate) {
      Alert.alert('Error', 'End date must be on or after start date');
      return;
    }
    setSaving(true);
    try {
      const plan = await userAreaPlansApi.create(
        user.id,
        areaId,
        startDate.trim(),
        endDate.trim(),
        notes.trim() || undefined
      );

      const inviterName = user.name || 'A friend';
      const dateRange = `${startDate.trim()} – ${endDate.trim()}`;
      let inviteCount = 0;
      let inviteErrors = 0;

      for (const friendId of selectedFriendIds) {
        if (friendId === user.id) continue;
        try {
          const inv = await tripInvitationsApi.create(
            plan.id,
            user.id,
            friendId,
            inviteMessage.trim() || undefined
          );
          inviteCount += 1;
          try {
            await notificationService.sendNotification(friendId, {
              title: `${inviterName} invited you on a trip`,
              body: `Open ${areaName} to respond or plan your dates · ${dateRange}`,
              data: {
                type: 'trip_invitation',
                areaId,
                areaName,
                tripId: plan.id,
                invitationId: inv.id !== 'pending' ? inv.id : undefined,
              },
            });
          } catch (e) {
            console.warn('Trip invite push failed', e);
          }
        } catch (e: any) {
          if (e?.code === '23505') {
            // unique violation — already invited
          } else {
            inviteErrors += 1;
          }
        }
      }

      const parts: string[] = ['Trip saved.'];
      if (inviteCount > 0) parts.push(`${inviteCount} friend(s) invited.`);
      if (inviteErrors > 0) parts.push('Some invites could not be sent.');
      Alert.alert('Success', parts.join(' '));

      setStartDate('');
      setEndDate('');
      setNotes('');
      setSelectedFriendIds(new Set());
      setInviteMessage('');
      onSuccess?.(plan);
      onClose();
    } catch (e) {
      Alert.alert('Error', 'Failed to save trip');
    } finally {
      setSaving(false);
    }
  };

  const displayDate = (s: string) => {
    if (!s) return 'Tap to select';
    const d = new Date(s + 'T12:00:00');
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const minDateEnd = startDate || formatDateYYYYMMDD(today);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Text style={styles.title}>Plan a trip to {areaName}</Text>

            <Text style={styles.label}>Start date</Text>
            <TouchableOpacity
              style={styles.dateTouch}
              onPress={() => {
                Keyboard.dismiss();
                setDatePickerMode('start');
              }}
            >
              <Ionicons name="calendar-outline" size={20} color={colors.primary} />
              <Text style={[styles.dateText, !startDate && styles.datePlaceholder]}>
                {displayDate(startDate)}
              </Text>
            </TouchableOpacity>

            <Text style={styles.label}>End date</Text>
            <TouchableOpacity
              style={styles.dateTouch}
              onPress={() => {
                Keyboard.dismiss();
                setDatePickerMode('end');
              }}
            >
              <Ionicons name="calendar-outline" size={20} color={colors.primary} />
              <Text style={[styles.dateText, !endDate && styles.datePlaceholder]}>
                {displayDate(endDate)}
              </Text>
            </TouchableOpacity>

            <Text style={styles.label}>Notes (optional)</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="e.g. target routes, birthday trip"
              placeholderTextColor={colors.textFaded}
              multiline
              textAlignVertical="top"
              inputAccessoryViewID={
                Platform.OS === 'ios' ? NOTES_INPUT_ACCESSORY_ID : undefined
              }
            />

            <Text style={styles.sectionTitle}>Invite friends</Text>
            <Text style={styles.sectionHint}>
              They’ll get a notification to open this area, accept or decline, or plan their own dates.
            </Text>
            <Text style={styles.label}>Message to invitees (optional)</Text>
            <TextInput
              style={styles.inviteMessageInput}
              value={inviteMessage}
              onChangeText={setInviteMessage}
              placeholder="e.g. Join for my birthday week"
              placeholderTextColor={colors.textFaded}
              multiline
              numberOfLines={2}
            />
            <ScrollView
              style={styles.friendList}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              {friends
                .filter((f) => f.id !== user?.id)
                .map((friend) => (
                  <TouchableOpacity
                    key={friend.id}
                    style={[
                      styles.friendRow,
                      selectedFriendIds.has(friend.id) && styles.friendRowSelected,
                    ]}
                    onPress={() => toggleFriend(friend.id)}
                  >
                    <Text style={styles.friendName}>{friend.name}</Text>
                    {selectedFriendIds.has(friend.id) ? (
                      <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                    ) : (
                      <Ionicons name="ellipse-outline" size={22} color={colors.textMuted} />
                    )}
                  </TouchableOpacity>
                ))}
              {friends.filter((f) => f.id !== user?.id).length === 0 && (
                <Text style={styles.noFriends}>Add friends in Connections to invite them.</Text>
              )}
            </ScrollView>

            {Platform.OS === 'android' && (
              <TouchableOpacity
                onPress={() => Keyboard.dismiss()}
                style={styles.doneKeyboardRow}
                hitSlop={{ top: 8, bottom: 8 }}
              >
                <Text style={styles.doneKeyboardText}>Done</Text>
              </TouchableOpacity>
            )}

            <View style={styles.actions}>
              <Button title="Cancel" onPress={onClose} style={styles.cancelBtn} />
              <Button
                title={saving ? 'Saving...' : 'Save trip'}
                onPress={handleSubmit}
                disabled={saving}
                style={styles.saveBtn}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID={NOTES_INPUT_ACCESSORY_ID}>
          <View style={styles.inputAccessory}>
            <TouchableOpacity
              onPress={() => Keyboard.dismiss()}
              style={styles.inputAccessoryDone}
              hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
            >
              <Text style={styles.inputAccessoryDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </InputAccessoryView>
      )}

      <Modal
        visible={datePickerMode !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setDatePickerMode(null)}
      >
        <View style={styles.pickerOverlay}>
          <Card style={styles.pickerCard}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>
                {datePickerMode === 'start' ? 'Start date' : 'End date'}
              </Text>
              <TouchableOpacity onPress={() => setDatePickerMode(null)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Calendar
              current={
                datePickerMode === 'start'
                  ? startDate || formatDateYYYYMMDD(today)
                  : endDate || startDate || formatDateYYYYMMDD(today)
              }
              minDate={datePickerMode === 'end' ? minDateEnd : formatDateYYYYMMDD(today)}
              onDayPress={(day) => handleDateSelect(day.dateString)}
              markedDates={
                datePickerMode === 'start' && startDate
                  ? { [startDate]: { selected: true, selectedColor: colors.primary } }
                  : datePickerMode === 'end' && endDate
                  ? { [endDate]: { selected: true, selectedColor: colors.primary } }
                  : {}
              }
              theme={dateCalendarTheme}
            />
          </Card>
        </View>
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
    color: colors.text,
  },
  sectionHint: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 12,
    lineHeight: 18,
  },
  inviteMessageInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    color: colors.text,
    minHeight: 56,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  friendList: {
    maxHeight: 180,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  friendRowSelected: {
    backgroundColor: colors.primaryMuted,
  },
  friendName: {
    fontSize: 16,
    color: colors.text,
  },
  noFriends: {
    fontSize: 14,
    color: colors.textMuted,
    padding: 16,
    textAlign: 'center',
  },
  notesInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    minHeight: 88,
    fontSize: 16,
    color: colors.text,
    marginBottom: 8,
  },
  doneKeyboardRow: {
    alignSelf: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  doneKeyboardText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  inputAccessory: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputAccessoryDone: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  inputAccessoryDoneText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.primary,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: colors.text,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
    color: colors.textSecondary,
  },
  dateTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  dateText: { fontSize: 16, color: colors.text },
  datePlaceholder: { color: colors.textMuted },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    flexWrap: 'wrap',
  },
  cancelBtn: { flex: 1, minWidth: 100 },
  saveBtn: { flex: 1, minWidth: 120 },
  pickerOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: 24,
  },
  pickerCard: {
    padding: 16,
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
});

export default PlanTripModal;
