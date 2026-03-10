import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { userAreaPlansApi, areaFeedApi, userApi } from '../services/api';
import { notificationService } from '../services/notifications';
import { UserAreaPlan } from '../types';
import Button from './Button';
import Input from './Input';
import Card from './Card';

interface PlanTripModalProps {
  visible: boolean;
  onClose: () => void;
  areaId: string;
  areaName: string;
  onSuccess?: (plan: UserAreaPlan) => void;
}

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
  const today = new Date();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'start' | 'end' | null>(null);

  const handleDateSelect = (dateString: string) => {
    if (datePickerMode === 'start') {
      setStartDate(dateString);
      setEndDate((prev) => (prev && prev < dateString ? dateString : prev));
    } else if (datePickerMode === 'end') {
      setEndDate(dateString);
    }
    setDatePickerMode(null);
  };

  const handleSubmit = async (tellHomies: boolean) => {
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

      if (tellHomies) {
        const title = `Trip to ${areaName}: ${startDate} – ${endDate}`;
        const content = notes.trim() || 'No details added.';
        try {
          await areaFeedApi.createFeedPost({
            authorUserId: user.id,
            areaId,
            postType: 'trip_announcement',
            title,
            content,
            urgency: 'now',
            metadata: { tripId: plan.id },
          });
        } catch (e) {
          console.warn('Failed to create trip announcement post', e);
        }

        try {
          const friends = await userApi.getUserFriends(user.id);
          const userName = user.name || 'A friend';
          const body = `${userName} is planning a trip to ${areaName}: ${startDate} – ${endDate}`;
          for (const friend of friends) {
            if (friend.id === user.id) continue;
            await notificationService.sendNotification(
              friend.id,
              {
                title: 'Trip plan',
                body,
                data: { type: 'friend_trip_announcement', tripId: plan.id, areaId, areaName, startDate, endDate },
              }
            );
          }
        } catch (e) {
          console.warn('Failed to send trip notifications to friends', e);
        }
      }

      Alert.alert('Success', tellHomies ? 'Trip saved and friends notified' : 'Trip planned');
      setStartDate('');
      setEndDate('');
      setNotes('');
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
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Plan a trip to {areaName}</Text>

          <Text style={styles.label}>Start date</Text>
          <TouchableOpacity
            style={styles.dateTouch}
            onPress={() => setDatePickerMode('start')}
          >
            <Ionicons name="calendar-outline" size={20} color="#007AFF" />
            <Text style={[styles.dateText, !startDate && styles.datePlaceholder]}>
              {displayDate(startDate)}
            </Text>
          </TouchableOpacity>

          <Text style={styles.label}>End date</Text>
          <TouchableOpacity
            style={styles.dateTouch}
            onPress={() => setDatePickerMode('end')}
          >
            <Ionicons name="calendar-outline" size={20} color="#007AFF" />
            <Text style={[styles.dateText, !endDate && styles.datePlaceholder]}>
              {displayDate(endDate)}
            </Text>
          </TouchableOpacity>

          <Input
            label="Notes (optional)"
            value={notes}
            onChangeText={setNotes}
            placeholder="e.g. target routes, birthday trip"
            multiline
          />

          <View style={styles.actions}>
            <Button title="Cancel" onPress={onClose} style={styles.cancelBtn} />
            <Button
              title={saving ? 'Saving...' : 'Save trip'}
              onPress={() => handleSubmit(false)}
              disabled={saving}
              style={styles.secondaryBtn}
            />
            <Button
              title={saving ? '...' : 'Tell the homies'}
              onPress={() => handleSubmit(true)}
              disabled={saving}
            />
          </View>
        </View>
      </View>

      {/* Date picker modal */}
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
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <Calendar
              current={datePickerMode === 'start' ? (startDate || formatDateYYYYMMDD(today)) : (endDate || startDate || formatDateYYYYMMDD(today))}
              minDate={datePickerMode === 'end' ? minDateEnd : formatDateYYYYMMDD(today)}
              onDayPress={(day) => handleDateSelect(day.dateString)}
              markedDates={
                datePickerMode === 'start' && startDate
                  ? { [startDate]: { selected: true, selectedColor: '#007AFF' } }
                  : datePickerMode === 'end' && endDate
                  ? { [endDate]: { selected: true, selectedColor: '#007AFF' } }
                  : {}
              }
              theme={{
                todayTextColor: '#007AFF',
                selectedDayBackgroundColor: '#007AFF',
                selectedDayTextColor: '#FFFFFF',
                arrowColor: '#007AFF',
              }}
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
    color: '#333',
  },
  dateTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#E5E5E7',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  dateText: { fontSize: 16, color: '#000' },
  datePlaceholder: { color: '#8E8E93' },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    flexWrap: 'wrap',
  },
  cancelBtn: { flex: 1, minWidth: 80 },
  secondaryBtn: { flex: 1, minWidth: 80 },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  pickerCard: {
    padding: 16,
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
  },
});

export default PlanTripModal;
