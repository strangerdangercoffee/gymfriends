import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Gym, CreateScheduleForm, ScheduleStackParamList } from '../types';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';

type AddScheduleScreenNavigationProp = StackNavigationProp<ScheduleStackParamList, 'AddSchedule'>;

interface DaySchedule {
  day: string;
  selected: boolean;
  startTime: string;
  endTime: string;
}

const AddScheduleScreen: React.FC = () => {
  const navigation = useNavigation<AddScheduleScreenNavigationProp>();
  const { gyms, addSchedule } = useApp();
  const { user } = useAuth();
  const [selectedGym, setSelectedGym] = useState<Gym | null>(null);
  const [workoutType, setWorkoutType] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<'weekly' | 'custom'>('weekly');
  const [customInterval, setCustomInterval] = useState(1);
  const [daySchedules, setDaySchedules] = useState<DaySchedule[]>([
    { day: 'Monday', selected: false, startTime: '09:00', endTime: '10:00' },
    { day: 'Tuesday', selected: false, startTime: '09:00', endTime: '10:00' },
    { day: 'Wednesday', selected: false, startTime: '09:00', endTime: '10:00' },
    { day: 'Thursday', selected: false, startTime: '09:00', endTime: '10:00' },
    { day: 'Friday', selected: false, startTime: '09:00', endTime: '10:00' },
    { day: 'Saturday', selected: false, startTime: '09:00', endTime: '10:00' },
    { day: 'Sunday', selected: false, startTime: '09:00', endTime: '10:00' },
  ]);
  const [showGymModal, setShowGymModal] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [editingDayIndex, setEditingDayIndex] = useState(-1);
  const [tempStartTime, setTempStartTime] = useState('09:00');
  const [tempEndTime, setTempEndTime] = useState('10:00');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter to only show followed gyms
  const followedGyms = gyms.filter(gym => user?.followedGyms?.includes(gym.id));

  const handleDayToggle = (index: number) => {
    const newDaySchedules = [...daySchedules];
    newDaySchedules[index].selected = !newDaySchedules[index].selected;
    setDaySchedules(newDaySchedules);
  };

  const handleTimeEdit = (index: number) => {
    setEditingDayIndex(index);
    setTempStartTime(daySchedules[index].startTime);
    setTempEndTime(daySchedules[index].endTime);
    setShowTimeModal(true);
  };

  const handleTimeSave = () => {
    if (editingDayIndex >= 0) {
      const newDaySchedules = [...daySchedules];
      newDaySchedules[editingDayIndex].startTime = tempStartTime;
      newDaySchedules[editingDayIndex].endTime = tempEndTime;
      setDaySchedules(newDaySchedules);
    }
    setShowTimeModal(false);
    setEditingDayIndex(-1);
  };

  const handleSubmit = async () => {
    if (!selectedGym) {
      Alert.alert('Error', 'Please select a gym');
      return;
    }

    const selectedDays = daySchedules.filter(day => day.selected);
    if (selectedDays.length === 0) {
      Alert.alert('Error', 'Please select at least one day');
      return;
    }

    if (isRecurring && recurrenceType === 'custom' && customInterval < 1) {
      Alert.alert('Error', 'Custom interval must be at least 1 day');
      return;
    }

    setIsSubmitting(true);
    try {
      // Create schedules for each selected day
      for (const daySchedule of selectedDays) {
        const scheduleData: CreateScheduleForm = {
          gymId: selectedGym.id,
          startTime: createDateFromTime(daySchedule.startTime),
          endTime: createDateFromTime(daySchedule.endTime),
          isRecurring,
          recurringPattern: isRecurring ? (recurrenceType === 'weekly' ? 'weekly' : 'daily') : undefined,
          workoutType: workoutType.trim() || undefined,
        };

        await addSchedule(scheduleData);
      }

      Alert.alert('Success', 'Schedule created successfully!', [
        { text: 'OK', onPress: () => {
          navigation.goBack();
        }}
      ]);
    } catch (error) {
      console.error('Error creating schedule:', error);
      Alert.alert('Error', 'Failed to create schedule. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const createDateFromTime = (timeString: string): Date => {
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  };

  const resetForm = () => {
    setSelectedGym(null);
    setWorkoutType('');
    setIsRecurring(false);
    setRecurrenceType('weekly');
    setCustomInterval(1);
    setDaySchedules(daySchedules.map(day => ({ ...day, selected: false })));
  };

  const renderGymSelector = () => (
    <Card style={styles.section}>
      <Text style={styles.sectionTitle}>Select Gym</Text>
      <TouchableOpacity
        style={styles.gymSelector}
        onPress={() => setShowGymModal(true)}
      >
        <Text style={selectedGym ? styles.gymName : styles.placeholderText}>
          {selectedGym ? selectedGym.name : 'Choose a gym'}
        </Text>
        <Ionicons name="chevron-down" size={20} color="#8E8E93" />
      </TouchableOpacity>
    </Card>
  );

  const renderWorkoutType = () => (
    <Card style={styles.section}>
      <Text style={styles.sectionTitle}>Workout Type (Optional)</Text>
      <Input
        placeholder="e.g., Cardio, Strength Training, Yoga"
        value={workoutType}
        onChangeText={setWorkoutType}
        style={styles.input}
      />
    </Card>
  );

  const renderRecurrenceSettings = () => (
    <Card style={styles.section}>
      <Text style={styles.sectionTitle}>Recurrence</Text>
      
      <TouchableOpacity
        style={styles.recurrenceToggle}
        onPress={() => setIsRecurring(!isRecurring)}
      >
        <Text style={styles.recurrenceLabel}>Repeat Schedule</Text>
        <View style={[styles.toggle, isRecurring && styles.toggleActive]}>
          <View style={[styles.toggleThumb, isRecurring && styles.toggleThumbActive]} />
        </View>
      </TouchableOpacity>

      {isRecurring && (
        <View style={styles.recurrenceOptions}>
          <TouchableOpacity
            style={[
              styles.recurrenceOption,
              recurrenceType === 'weekly' && styles.recurrenceOptionActive
            ]}
            onPress={() => setRecurrenceType('weekly')}
          >
            <Text style={[
              styles.recurrenceOptionText,
              recurrenceType === 'weekly' && styles.recurrenceOptionTextActive
            ]}>
              Weekly
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.recurrenceOption,
              recurrenceType === 'custom' && styles.recurrenceOptionActive
            ]}
            onPress={() => setRecurrenceType('custom')}
          >
            <Text style={[
              styles.recurrenceOptionText,
              recurrenceType === 'custom' && styles.recurrenceOptionTextActive
            ]}>
              Every {customInterval} day{customInterval !== 1 ? 's' : ''}
            </Text>
          </TouchableOpacity>

          {recurrenceType === 'custom' && (
            <View style={styles.customIntervalContainer}>
              <Text style={styles.customIntervalLabel}>Every</Text>
              <TextInput
                style={styles.customIntervalInput}
                value={customInterval.toString()}
                onChangeText={(text) => setCustomInterval(parseInt(text) || 1)}
                keyboardType="numeric"
                maxLength={2}
              />
              <Text style={styles.customIntervalLabel}>day(s)</Text>
            </View>
          )}
        </View>
      )}
    </Card>
  );

  const renderDaySchedules = () => (
    <Card style={styles.section}>
      <Text style={styles.sectionTitle}>Select Days & Times</Text>
      <Text style={styles.sectionSubtitle}>
        Choose which days you'll be at the gym and set your workout times
      </Text>
      
      {daySchedules.map((daySchedule, index) => (
        <View key={daySchedule.day} style={styles.dayRow}>
          <TouchableOpacity
            style={styles.dayToggle}
            onPress={() => handleDayToggle(index)}
          >
            <View style={[
              styles.checkbox,
              daySchedule.selected && styles.checkboxActive
            ]}>
              {daySchedule.selected && (
                <Ionicons name="checkmark" size={16} color="white" />
              )}
            </View>
            <Text style={[
              styles.dayLabel,
              daySchedule.selected && styles.dayLabelActive
            ]}>
              {daySchedule.day}
            </Text>
          </TouchableOpacity>
          
          {daySchedule.selected && (
            <TouchableOpacity
              style={styles.timeButton}
              onPress={() => handleTimeEdit(index)}
            >
              <Text style={styles.timeText}>
                {daySchedule.startTime} - {daySchedule.endTime}
              </Text>
              <Ionicons name="chevron-down" size={16} color="#8E8E93" />
            </TouchableOpacity>
          )}
        </View>
      ))}
    </Card>
  );

  const renderGymModal = () => (
    <Modal
      visible={showGymModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowGymModal(false)}>
            <Ionicons name="close" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Select Gym</Text>
          <View style={{ width: 24 }} />
        </View>
        
        <ScrollView style={styles.modalContent}>
          {followedGyms.map((gym) => (
            <TouchableOpacity
              key={gym.id}
              style={styles.gymOption}
              onPress={() => {
                setSelectedGym(gym);
                setShowGymModal(false);
              }}
            >
              <Text style={styles.gymOptionName}>{gym.name}</Text>
              <Text style={styles.gymOptionAddress}>{gym.address}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );

  const renderTimeModal = () => (
    <Modal
      visible={showTimeModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowTimeModal(false)}>
            <Ionicons name="close" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Set Time</Text>
          <TouchableOpacity onPress={handleTimeSave}>
            <Text style={styles.saveButton}>Save</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.modalContent}>
          <View style={styles.timeInputContainer}>
            <Text style={styles.timeInputLabel}>Start Time</Text>
            <TextInput
              style={styles.timeInput}
              value={tempStartTime}
              onChangeText={setTempStartTime}
              placeholder="HH:MM"
              maxLength={5}
            />
          </View>
          
          <View style={styles.timeInputContainer}>
            <Text style={styles.timeInputLabel}>End Time</Text>
            <TextInput
              style={styles.timeInput}
              value={tempEndTime}
              onChangeText={setTempEndTime}
              placeholder="HH:MM"
              maxLength={5}
            />
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {renderGymSelector()}
        {renderWorkoutType()}
        {renderRecurrenceSettings()}
        {renderDaySchedules()}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="Create Schedule"
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={!selectedGym || daySchedules.filter(d => d.selected).length === 0}
          style={styles.submitButton}
        />
      </View>

      {renderGymModal()}
      {renderTimeModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 16,
  },
  gymSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E7',
  },
  gymName: {
    fontSize: 16,
    color: '#000',
  },
  placeholderText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  input: {
    marginTop: 8,
  },
  recurrenceToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  recurrenceLabel: {
    fontSize: 16,
    color: '#000',
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E5E5E7',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive: {
    backgroundColor: '#007AFF',
  },
  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'white',
    alignSelf: 'flex-start',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  recurrenceOptions: {
    gap: 12,
  },
  recurrenceOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E5E5E7',
  },
  recurrenceOptionActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  recurrenceOptionText: {
    fontSize: 16,
    color: '#000',
    textAlign: 'center',
  },
  recurrenceOptionTextActive: {
    color: 'white',
  },
  customIntervalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  customIntervalLabel: {
    fontSize: 16,
    color: '#8E8E93',
  },
  customIntervalInput: {
    width: 50,
    height: 40,
    borderWidth: 1,
    borderColor: '#E5E5E7',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 16,
    backgroundColor: 'white',
  },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  dayToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#E5E5E7',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  dayLabel: {
    fontSize: 16,
    color: '#8E8E93',
  },
  dayLabelActive: {
    color: '#000',
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E5E7',
  },
  timeText: {
    fontSize: 14,
    color: '#000',
    marginRight: 4,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E7',
  },
  submitButton: {
    backgroundColor: '#007AFF',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E7',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  saveButton: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  gymOption: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  gymOptionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  gymOptionAddress: {
    fontSize: 14,
    color: '#8E8E93',
  },
  timeInputContainer: {
    marginTop: 24,
  },
  timeInputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
    marginBottom: 8,
  },
  timeInput: {
    height: 50,
    borderWidth: 1,
    borderColor: '#E5E5E7',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: 'white',
  },
});

export default AddScheduleScreen;
