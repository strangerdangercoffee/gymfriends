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
  Image,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { WorkoutSession, RecurringPattern, Gym } from '../types';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { groupsApi } from '../services/api';
import { colors, dateCalendarTheme } from '../theme/colors';
import Card from './Card';

interface WorkoutCreationModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (workout: Omit<WorkoutSession, 'id' | 'createdAt' | 'updatedAt'>, invitedFriends?: string[], invitedGroups?: string[]) => void;
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
  const { followedGyms, friends, schedules } = useApp();
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [workoutType, setWorkoutType] = useState<WorkoutSession['workoutType']>('limit');
  const [notes, setNotes] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringPattern, setRecurringPattern] = useState<RecurringPattern>({
    type: 'weekly',
    interval: 1,
  });
  const [selectedGymId, setSelectedGymId] = useState<string>('');
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [userGroups, setUserGroups] = useState<any[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  const [duration, setDuration] = useState(60); // Default 1 hour
  const [startTime, setStartTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Reset form and update based on editing mode when modal opens
  useEffect(() => {
    if (visible) {
      if (editingWorkout) {
        // Editing mode - populate form with existing workout data
        const start = new Date(editingWorkout.startTime);
        const end = new Date(editingWorkout.endTime);
        const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
        
        // FIX: Use isRecurring directly from workout history (set at creation time)
        // Still need to look up schedule for recurringPattern if it's recurring
        const scheduleId = (editingWorkout as any).scheduleId;
        const schedule = scheduleId ? schedules.find(s => s.id === scheduleId) : null;
        const isRecurring = editingWorkout.isRecurring ?? false;
        
        setStartTime(start);
        setDuration(durationMinutes);
        setTitle(editingWorkout.title);
        setNotes(editingWorkout.notes || '');
        setWorkoutType(editingWorkout.workoutType);
        setIsRecurring(isRecurring); // Use isRecurring from workout history
        setRecurringPattern(
          isRecurring && schedule?.recurringPattern 
            ? { type: schedule.recurringPattern as 'weekly' | 'daily' | 'custom', interval: 1 }
            : editingWorkout.recurringPattern || { type: 'weekly', interval: 1 }
        );
        setSelectedGymId(editingWorkout.gymId || '');
        setSelectedFriends([]); // Don't pre-select friends when editing
      } else {
        // Create mode - use selected time slot
        const newStartTime = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), selectedHour, selectedMinute);
        setStartTime(newStartTime);
        setDuration(60);
        setTitle('');
        setNotes('');
        setWorkoutType('limit');
        setIsRecurring(false);
        setRecurringPattern({ type: 'weekly', interval: 1 });
        // Set default gym to first followed gym
        setSelectedGymId(followedGyms.length > 0 ? followedGyms[0].id : '');
        setSelectedFriends([]);
        setSelectedGroups([]);
      }
    }
  }, [visible, selectedDate, selectedHour, selectedMinute, editingWorkout, followedGyms, schedules]);

  useEffect(() => {
    if (!visible) {
      setShowDatePicker(false);
      setShowTimePicker(false);
    }
  }, [visible]);

  // Fetch user's groups when modal opens
  useEffect(() => {
    if (visible && user?.id) {
      setLoadingGroups(true);
      groupsApi.getUserGroups(user.id)
        .then(groups => {
          setUserGroups(groups);
          setLoadingGroups(false);
        })
        .catch(error => {
          console.error('Error fetching groups:', error);
          setLoadingGroups(false);
        });
    } else {
      setUserGroups([]);
    }
  }, [visible, user?.id]);

  const workoutTypes = [
    { key: 'limit', label: 'Limit', color: colors.workoutTypes.limit },              // Max strength / recruitment
    { key: 'power', label: 'Power', color: colors.workoutTypes.power },              // Dynamic, explosive
    { key: 'endurance', label: 'Endurance', color: colors.workoutTypes.endurance },      // PE + aerobic power
    { key: 'technique', label: 'Technique', color: colors.workoutTypes.technique },      // Movement, footwork, skills
    { key: 'volume', label: 'Volume', color: colors.workoutTypes.volume },            // ARC, base building
    { key: 'projecting', label: 'Projecting', color: colors.workoutTypes.projecting },    // Performance, tactics
    { key: 'recovery', label: 'Recovery', color: colors.workoutTypes.recovery },        // Mobility, yoga, prehab
    { key: 'cardio', label: 'Cardio', color: colors.workoutTypes.cardio },           // Aerobic endurance
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
      day: 'numeric',
    });
  };

  const formatDateForInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  /** Parse YYYY-MM-DD as local calendar date (avoid UTC-off-by-one from `new Date("YYYY-MM-DD")`). */
  const parseLocalDateYYYYMMDD = (yyyyMmDd: string): Date => {
    const parts = yyyyMmDd.split('-').map((p) => parseInt(p, 10));
    const [y, m, d] = parts;
    if (parts.length !== 3 || [y, m, d].some((n) => Number.isNaN(n))) {
      return new Date();
    }
    return new Date(y, m - 1, d);
  };

  const handleSave = () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a workout title');
      return;
    }

    if (!selectedGymId) {
      Alert.alert('Error', 'Please select a gym location');
      return;
    }

    const endTime = new Date(startTime.getTime() + duration * 60000);

    const workout: Omit<WorkoutSession, 'id' | 'createdAt' | 'updatedAt'> = {
      startTime,
      endTime,
      workoutType,
      climbingType: 'any', // Default climbing type
      title: title.trim(),
      notes: notes.trim() || undefined,
      isRecurring,
      recurringPattern: isRecurring ? recurringPattern : undefined,
      status: 'planned',
      gymId: selectedGymId,
    };

    onSave(
      workout, 
      selectedFriends.length > 0 ? selectedFriends : undefined,
      selectedGroups.length > 0 ? selectedGroups : undefined
    );
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
      <View style={styles.modalRoot}>
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
              placeholderTextColor={colors.textMuted}
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
                  onPress={() => setWorkoutType(type.key as WorkoutSession['workoutType'])}
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

          {/* Gym Location */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Gym Location</Text>
            {followedGyms.length === 0 ? (
              <View style={styles.noGymsContainer}>
                <Text style={styles.noGymsText}>No gyms followed yet</Text>
                <Text style={styles.noGymsSubtext}>Follow some gyms to schedule workouts</Text>
              </View>
            ) : (
              <View style={styles.gymList}>
                {followedGyms.map((gym) => (
                  <TouchableOpacity
                    key={gym.id}
                    style={[
                      styles.gymItem,
                      selectedGymId === gym.id && styles.gymItemSelected
                    ]}
                    onPress={() => setSelectedGymId(gym.id)}
                  >
                    <View style={styles.gymItemContent}>
                      <View style={[
                        styles.gymIndicator,
                        selectedGymId === gym.id && styles.gymIndicatorSelected
                      ]} />
                      <View style={styles.gymInfo}>
                        <Text style={[
                          styles.gymName,
                          selectedGymId === gym.id && styles.gymNameSelected
                        ]}>
                          {gym.name}
                        </Text>
                        {gym.address && (
                          <Text style={styles.gymAddress}>{gym.address}</Text>
                        )}
                      </View>
                    </View>
                    {selectedGymId === gym.id && (
                      <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Date & Time */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Date & Time</Text>
            <View style={styles.dateTimeContainer}>
              <TouchableOpacity
                style={styles.dateTimeItem}
                onPress={() => setShowDatePicker(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.dateTimeLabel}>Date</Text>
                <View style={styles.dateTimeRow}>
                  <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                  <Text style={styles.dateTimeValue}>{formatDate(startTime)}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dateTimeItem}
                onPress={() => setShowTimePicker(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.dateTimeLabel}>Start Time</Text>
                <View style={styles.dateTimeRow}>
                  <Ionicons name="time-outline" size={18} color={colors.primary} />
                  <Text style={styles.dateTimeValue}>{formatTime(startTime)}</Text>
                </View>
              </TouchableOpacity>
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

          {/* Invite Friends */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Invite Friends (Optional)</Text>
            {friends.length === 0 ? (
              <View style={styles.noFriendsContainer}>
                <Text style={styles.noFriendsText}>No friends yet</Text>
                <Text style={styles.noFriendsSubtext}>Add friends to invite them to workouts</Text>
              </View>
            ) : (
              <View style={styles.friendsList}>
                {friends.map((friend) => (
                  <TouchableOpacity
                    key={friend.id}
                    style={[
                      styles.friendItem,
                      selectedFriends.includes(friend.id) && styles.friendItemSelected
                    ]}
                    onPress={() => {
                      if (selectedFriends.includes(friend.id)) {
                        setSelectedFriends(selectedFriends.filter(id => id !== friend.id));
                      } else {
                        setSelectedFriends([...selectedFriends, friend.id]);
                      }
                    }}
                  >
                    <View style={styles.friendItemContent}>
                      <View style={styles.friendAvatar}>
                        {friend.avatar ? (
                          <Image source={{ uri: friend.avatar }} style={styles.friendAvatarImage} />
                        ) : (
                          <View style={styles.friendAvatarPlaceholder}>
                            <Text style={styles.friendAvatarText}>
                              {friend.name.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.friendInfo}>
                        <Text style={[
                          styles.friendName,
                          selectedFriends.includes(friend.id) && styles.friendNameSelected
                        ]}>
                          {friend.name}
                        </Text>
                        <Text style={styles.friendEmail}>{friend.email}</Text>
                      </View>
                    </View>
                    {selectedFriends.includes(friend.id) && (
                      <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Invite Groups */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Invite Groups (Optional)</Text>
            {loadingGroups ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading groups...</Text>
              </View>
            ) : userGroups.length === 0 ? (
              <View style={styles.noFriendsContainer}>
                <Text style={styles.noFriendsText}>No groups yet</Text>
                <Text style={styles.noFriendsSubtext}>Join or create groups to invite them to workouts</Text>
              </View>
            ) : (
              <View style={styles.friendsList}>
                {userGroups.map((group) => (
                  <TouchableOpacity
                    key={group.id}
                    style={[
                      styles.friendItem,
                      selectedGroups.includes(group.id) && styles.friendItemSelected
                    ]}
                    onPress={() => {
                      if (selectedGroups.includes(group.id)) {
                        setSelectedGroups(selectedGroups.filter(id => id !== group.id));
                      } else {
                        setSelectedGroups([...selectedGroups, group.id]);
                      }
                    }}
                  >
                    <View style={styles.friendItemContent}>
                      <View style={styles.friendAvatar}>
                        <View style={[styles.friendAvatarPlaceholder, { backgroundColor: colors.secondary }]}>
                          <Ionicons name="people" size={20} color={colors.text} />
                        </View>
                      </View>
                      <View style={styles.friendInfo}>
                        <Text style={[
                          styles.friendName,
                          selectedGroups.includes(group.id) && styles.friendNameSelected
                        ]}>
                          {group.name}
                        </Text>
                        <Text style={styles.friendEmail}>
                          {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
                        </Text>
                      </View>
                    </View>
                    {selectedGroups.includes(group.id) && (
                      <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
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
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Delete Button (only when editing) */}
          {editingWorkout && onDelete && (
            <TouchableOpacity 
              style={styles.deleteButton}
              onPress={() => {
                // Check if this workout is part of a recurring schedule
                const isRecurringWorkout = editingWorkout.isRecurring ?? false;
                
                if (isRecurringWorkout) {
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
              <Ionicons name="trash-outline" size={20} color={colors.error} />
              <Text style={styles.deleteButtonText}>Delete Workout</Text>
            </TouchableOpacity>
          )}

          <View style={styles.bottomSpacing} />
        </ScrollView>
      </View>

      {/* Date calendar (react-native-calendars + shared theme) */}
      <Modal
        visible={showDatePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={styles.calendarModalOverlay}>
          <Card style={styles.calendarModal}>
            <View style={styles.calendarHeader}>
              <Text style={styles.calendarTitle}>Select Date</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(false)} hitSlop={12}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Calendar
              current={formatDateForInput(startTime)}
              {...(!editingWorkout ? { minDate: formatDateForInput(new Date()) } : {})}
              onDayPress={(day) => {
                const newDate = parseLocalDateYYYYMMDD(day.dateString);
                newDate.setHours(
                  startTime.getHours(),
                  startTime.getMinutes(),
                  startTime.getSeconds(),
                  startTime.getMilliseconds()
                );
                setStartTime(newDate);
                setShowDatePicker(false);
                setTimeout(() => setShowTimePicker(true), 300);
              }}
              markedDates={{
                [formatDateForInput(startTime)]: {
                  selected: true,
                  selectedColor: colors.primary,
                },
              }}
              theme={dateCalendarTheme}
            />
          </Card>
        </View>
      </Modal>

      {showTimePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={startTime}
          mode="time"
          display="default"
          is24Hour={false}
          accentColor={colors.primary}
          onChange={(event, date) => {
            setShowTimePicker(false);
            if (event.type === 'set' && date) {
              setStartTime(date);
            }
          }}
        />
      )}
      {showTimePicker && Platform.OS === 'ios' && (
        <Modal
          visible
          transparent
          animationType="slide"
          onRequestClose={() => setShowTimePicker(false)}
        >
          <View style={styles.timePickerModalOverlay}>
            <TouchableOpacity
              style={styles.timePickerBackdrop}
              activeOpacity={1}
              onPress={() => setShowTimePicker(false)}
            />
            <Card style={styles.timePickerModal}>
              <View style={styles.calendarHeader}>
                <Text style={styles.calendarTitle}>Start Time</Text>
                <TouchableOpacity onPress={() => setShowTimePicker(false)} hitSlop={12}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={startTime}
                mode="time"
                display="spinner"
                themeVariant="dark"
                accentColor={colors.primary}
                textColor={colors.text}
                onChange={(_, date) => {
                  if (date) setStartTime(date);
                }}
              />
              <TouchableOpacity
                style={styles.timePickerDoneRow}
                onPress={() => setShowTimePicker(false)}
              >
                <Text style={styles.timePickerDoneText}>Done</Text>
              </TouchableOpacity>
            </Card>
          </View>
        </Modal>
      )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cancelButton: {
    fontSize: 16,
    color: colors.primary,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
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
    color: colors.text,
    marginBottom: 12,
  },
  textInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
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
    backgroundColor: colors.surface,
  },
  workoutTypeButtonActive: {
    backgroundColor: colors.primaryMuted,
  },
  workoutTypeIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  workoutTypeText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  workoutTypeTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  dateTimeContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  dateTimeItem: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateTimeLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 4,
  },
  dateTimeValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  calendarModalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  calendarModal: {
    width: '100%',
    maxWidth: 400,
    padding: 20,
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  calendarTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textSecondary,
  },
  timePickerModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  timePickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  timePickerModal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 28,
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
  },
  timePickerDoneRow: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
  },
  timePickerDoneText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.primary,
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
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  durationButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  durationText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  durationTextActive: {
    color: colors.background,
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
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive: {
    backgroundColor: colors.primary,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.text,
    shadowColor: colors.background,
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
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  recurringTypeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  recurringTypeText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  recurringTypeTextActive: {
    color: colors.background,
    fontWeight: '600',
  },
  noGymsContainer: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noGymsText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 4,
  },
  noGymsSubtext: {
    fontSize: 14,
    color: colors.textMuted,
  },
  gymList: {
    gap: 8,
  },
  gymItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  gymItemSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  gymItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  gymIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.surfaceElevated,
    marginRight: 12,
  },
  gymIndicatorSelected: {
    backgroundColor: colors.primary,
  },
  gymInfo: {
    flex: 1,
  },
  gymName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  gymNameSelected: {
    color: colors.primary,
  },
  gymAddress: {
    fontSize: 14,
    color: colors.textMuted,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.error,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.error,
    marginLeft: 8,
  },
  bottomSpacing: {
    height: 40,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  noFriendsContainer: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noFriendsText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 4,
  },
  noFriendsSubtext: {
    fontSize: 14,
    color: colors.textMuted,
  },
  friendsList: {
    gap: 8,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  friendItemSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  friendItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  friendAvatar: {
    marginRight: 12,
  },
  friendAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  friendAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendAvatarText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '600',
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  friendNameSelected: {
    color: colors.primary,
  },
  friendEmail: {
    fontSize: 14,
    color: colors.textMuted,
  },
});

export default WorkoutCreationModal;


