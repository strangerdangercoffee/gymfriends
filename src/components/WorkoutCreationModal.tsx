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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WorkoutSession, RecurringPattern, Gym } from '../types';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { groupsApi } from '../services/api';

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
    { key: 'limit', label: 'Limit', color: '#E74C3C' },              // Max strength / recruitment
    { key: 'power', label: 'Power', color: '#F39C12' },              // Dynamic, explosive
    { key: 'endurance', label: 'Endurance', color: '#D35400' },      // PE + aerobic power
    { key: 'technique', label: 'Technique', color: '#3498DB' },      // Movement, footwork, skills
    { key: 'volume', label: 'Volume', color: '#27AE60' },            // ARC, base building
    { key: 'projecting', label: 'Projecting', color: '#8E44AD' },    // Performance, tactics
    { key: 'recovery', label: 'Recovery', color: '#95A5A6' },        // Mobility, yoga, prehab
    { key: 'cardio', label: 'Cardio', color: '#96CEB4' },           // Aerobic endurance
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
                      <Ionicons name="checkmark-circle" size={20} color="#007AFF" />
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
                      <Ionicons name="checkmark-circle" size={20} color="#007AFF" />
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
                        <View style={[styles.friendAvatarPlaceholder, { backgroundColor: '#A29BFE' }]}>
                          <Ionicons name="people" size={20} color="#FFF" />
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
                      <Ionicons name="checkmark-circle" size={20} color="#007AFF" />
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
  noGymsContainer: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  noGymsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6C757D',
    marginBottom: 4,
  },
  noGymsSubtext: {
    fontSize: 14,
    color: '#8E8E93',
  },
  gymList: {
    gap: 8,
  },
  gymItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  gymItemSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F8FF',
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
    backgroundColor: '#E9ECEF',
    marginRight: 12,
  },
  gymIndicatorSelected: {
    backgroundColor: '#007AFF',
  },
  gymInfo: {
    flex: 1,
  },
  gymName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  gymNameSelected: {
    color: '#007AFF',
  },
  gymAddress: {
    fontSize: 14,
    color: '#8E8E93',
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
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  noFriendsContainer: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  noFriendsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6C757D',
    marginBottom: 4,
  },
  noFriendsSubtext: {
    fontSize: 14,
    color: '#8E8E93',
  },
  friendsList: {
    gap: 8,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  friendItemSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F8FF',
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
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendAvatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  friendNameSelected: {
    color: '#007AFF',
  },
  friendEmail: {
    fontSize: 14,
    color: '#8E8E93',
  },
});

export default WorkoutCreationModal;


