import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WorkoutSession, RecurringPattern } from '../types';

interface WorkoutCreationModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (workout: Omit<WorkoutSession, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onDelete?: (workoutId: string, deleteAllRecurring?: boolean) => void;
  selectedDate: Date;
  selectedHour: number;
  selectedMinute: number;
  editingWorkout?: WorkoutSession | null;
}

const WorkoutCreationModal: React.FC<WorkoutCreationModalProps> = ({
  visible,
  onClose,
  onSave,
  onDelete,
  selectedDate,
  selectedHour,
  selectedMinute,
  editingWorkout,
}) => {
  const [title, setTitle] = useState('');
  const [workoutType, setWorkoutType] = useState<'cardio' | 'strength' | 'yoga' | 'running' | 'custom'>('cardio');
  const [notes, setNotes] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringPattern, setRecurringPattern] = useState<RecurringPattern>({
    type: 'weekly',
    interval: 1,
  });

  const [duration, setDuration] = useState(60); // Default 1 hour
  const [startTime, setStartTime] = useState(new Date());

  // Reset form and update based on editing mode when modal opens
  useEffect(() => {
    if (visible) {
      if (editingWorkout) {
        // Editing mode - populate form with existing workout data
        const start = new Date(editingWorkout.startTime);
        const end = new Date(editingWorkout.endTime);
        const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
        
        setStartTime(start);
        setDuration(durationMinutes);
        setTitle(editingWorkout.title);
        setNotes(editingWorkout.notes || '');
        setWorkoutType(editingWorkout.workoutType);
        setIsRecurring(editingWorkout.isRecurring);
        setRecurringPattern(editingWorkout.recurringPattern || { type: 'weekly', interval: 1 });
      } else {
        // Create mode - use selected time slot
        const newStartTime = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), selectedHour, selectedMinute);
        setStartTime(newStartTime);
        setDuration(60);
        setTitle('');
        setNotes('');
        setWorkoutType('cardio');
        setIsRecurring(false);
        setRecurringPattern({ type: 'weekly', interval: 1 });
      }
    }
  }, [visible, selectedDate, selectedHour, selectedMinute, editingWorkout]);

  const workoutTypes = [
    { key: 'cardio', label: 'Cardio', color: '#FF6B6B' },
    { key: 'strength', label: 'Strength', color: '#4ECDC4' },
    { key: 'yoga', label: 'Yoga', color: '#45B7D1' },
    { key: 'running', label: 'Running', color: '#96CEB4' },
    { key: 'custom', label: 'Custom', color: '#FFA07A' },
  ] as const;

  const durationOptions = [
    { label: '30 min', value: 30 },
    { label: '45 min', value: 45 },
    { label: '1 hour', value: 60 },
    { label: '1.5 hours', value: 90 },
    { label: '2 hours', value: 120 },
  ];

  const recurringOptions = [
    { key: 'daily', label: 'Daily' },
    { key: 'weekly', label: 'Weekly' },
    { key: 'custom', label: 'Custom' },
  ] as const;

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString([], { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const handleSave = () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a workout title');
      return;
    }

    const endTime = new Date(startTime.getTime() + duration * 60000);

    const workout: Omit<WorkoutSession, 'id' | 'createdAt' | 'updatedAt'> = {
      startTime,
      endTime,
      workoutType,
      title: title.trim(),
      notes: notes.trim() || undefined,
      isRecurring,
      recurringPattern: isRecurring ? recurringPattern : undefined,
      status: 'planned',
    };

    onSave(workout);
    onClose();
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose}>
            <Text style={styles.cancelButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>
            {editingWorkout ? 'Edit Workout' : 'Schedule Workout'}
          </Text>
          <TouchableOpacity onPress={handleSave}>
            <Text style={styles.saveButton}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Workout Title */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Workout Title</Text>
            <TextInput
              style={styles.textInput}
              value={title}
              onChangeText={setTitle}
              placeholder="Enter workout title"
              placeholderTextColor="#8E8E93"
            />
          </View>

          {/* Workout Type */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Workout Type</Text>
            <View style={styles.workoutTypeGrid}>
              {workoutTypes.map((type) => (
                <TouchableOpacity
                  key={type.key}
                  style={[
                    styles.workoutTypeButton,
                    workoutType === type.key && styles.workoutTypeButtonActive,
                    { borderColor: type.color }
                  ]}
                  onPress={() => setWorkoutType(type.key)}
                >
                  <View style={[styles.workoutTypeIndicator, { backgroundColor: type.color }]} />
                  <Text style={[
                    styles.workoutTypeText,
                    workoutType === type.key && styles.workoutTypeTextActive
                  ]}>
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Date & Time */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Date & Time</Text>
            <View style={styles.dateTimeContainer}>
              <View style={styles.dateTimeItem}>
                <Text style={styles.dateTimeLabel}>Date</Text>
                <Text style={styles.dateTimeValue}>{formatDate(startTime)}</Text>
              </View>
              <View style={styles.dateTimeItem}>
                <Text style={styles.dateTimeLabel}>Start Time</Text>
                <Text style={styles.dateTimeValue}>{formatTime(startTime)}</Text>
              </View>
            </View>
          </View>

          {/* Duration */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Duration</Text>
            <View style={styles.durationGrid}>
              {durationOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.durationButton,
                    duration === option.value && styles.durationButtonActive,
                  ]}
                  onPress={() => setDuration(option.value)}
                >
                  <Text style={[
                    styles.durationText,
                    duration === option.value && styles.durationTextActive,
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Recurring */}
          <View style={styles.section}>
            <View style={styles.recurringHeader}>
              <Text style={styles.sectionTitle}>Recurring</Text>
              <TouchableOpacity
                style={styles.toggleButton}
                onPress={() => setIsRecurring(!isRecurring)}
              >
                <View style={[
                  styles.toggle,
                  isRecurring && styles.toggleActive,
                ]}>
                  <View style={[
                    styles.toggleThumb,
                    isRecurring && styles.toggleThumbActive,
                  ]} />
                </View>
              </TouchableOpacity>
            </View>

            {isRecurring && (
              <View style={styles.recurringOptions}>
                <View style={styles.recurringTypeGrid}>
                  {recurringOptions.map((option) => (
                    <TouchableOpacity
                      key={option.key}
                      style={[
                        styles.recurringTypeButton,
                        recurringPattern.type === option.key && styles.recurringTypeButtonActive,
                      ]}
                      onPress={() => setRecurringPattern({ ...recurringPattern, type: option.key })}
                    >
                      <Text style={[
                        styles.recurringTypeText,
                        recurringPattern.type === option.key && styles.recurringTypeTextActive,
                      ]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* Notes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes (Optional)</Text>
            <TextInput
              style={[styles.textInput, styles.notesInput]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add any notes about your workout..."
              placeholderTextColor="#8E8E93"
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Delete Button (only when editing) */}
          {editingWorkout && onDelete && (
            <TouchableOpacity 
              style={styles.deleteButton}
              onPress={() => {
                if (editingWorkout.isRecurring) {
                  // For recurring workouts, ask if they want to delete just this one or all
                  Alert.alert(
                    'Delete Recurring Workout',
                    'This is a recurring workout. What would you like to delete?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'This Workout Only',
                        onPress: () => {
                          onDelete(editingWorkout.id, false);
                          onClose();
                        },
                      },
                      {
                        text: 'All Recurring Workouts',
                        style: 'destructive',
                        onPress: () => {
                          onDelete(editingWorkout.id, true);
                          onClose();
                        },
                      },
                    ]
                  );
                } else {
                  // For non-recurring workouts, simple delete confirmation
                  Alert.alert(
                    'Delete Workout',
                    'Are you sure you want to delete this workout?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => {
                          onDelete(editingWorkout.id, false);
                          onClose();
                        },
                      },
                    ]
                  );
                }
              }}
            >
              <Ionicons name="trash-outline" size={20} color="#FF3B30" />
              <Text style={styles.deleteButtonText}>Delete Workout</Text>
            </TouchableOpacity>
          )}

          <View style={styles.bottomSpacing} />
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  cancelButton: {
    fontSize: 16,
    color: '#007AFF',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 12,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#212529',
  },
  notesInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  workoutTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  workoutTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
  },
  workoutTypeButtonActive: {
    backgroundColor: '#F0F8FF',
  },
  workoutTypeIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  workoutTypeText: {
    fontSize: 14,
    color: '#6C757D',
  },
  workoutTypeTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  dateTimeContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  dateTimeItem: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  dateTimeLabel: {
    fontSize: 12,
    color: '#6C757D',
    marginBottom: 4,
  },
  dateTimeValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
  },
  durationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  durationButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    backgroundColor: '#FFFFFF',
  },
  durationButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  durationText: {
    fontSize: 14,
    color: '#6C757D',
  },
  durationTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  recurringHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleButton: {
    padding: 4,
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E9ECEF',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive: {
    backgroundColor: '#007AFF',
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleThumbActive: {
    transform: [{ translateX: 20 }],
  },
  recurringOptions: {
    marginTop: 12,
  },
  recurringTypeGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  recurringTypeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    backgroundColor: '#FFFFFF',
  },
  recurringTypeButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  recurringTypeText: {
    fontSize: 14,
    color: '#6C757D',
  },
  recurringTypeTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
    marginLeft: 8,
  },
  bottomSpacing: {
    height: 40,
  },
});

export default WorkoutCreationModal;


