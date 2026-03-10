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
import { WorkoutHistory, WorkoutExercise, Gym } from '../types';
import { useApp } from '../context/AppContext';

interface WorkoutHistoryModalProps {
  visible: boolean;
  onClose: () => void;
  workout: WorkoutHistory | null;
}

const WorkoutHistoryModal: React.FC<WorkoutHistoryModalProps> = ({
  visible,
  onClose,
  workout,
}) => {
  const { updateWorkoutHistory, deleteWorkoutHistory, gyms } = useApp();
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [workoutType, setWorkoutType] = useState<WorkoutHistory['workoutType']>('limit');
  const [notes, setNotes] = useState('');
  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);

  useEffect(() => {
    if (workout) {
      setTitle(workout.title || '');
      setWorkoutType(workout.workoutType || 'limit');
      setNotes(workout.notes || '');
      setExercises(workout.exercises || []);
    }
  }, [workout]);

  const workoutTypes = [
    { key: 'limit', label: 'Limit', icon: 'barbell', color: '#E74C3C' },              // Max strength / recruitment
    { key: 'power', label: 'Power', icon: 'flash', color: '#F39C12' },                // Dynamic, explosive
    { key: 'endurance', label: 'Endurance', icon: 'pulse', color: '#D35400' },        // PE + aerobic power
    { key: 'technique', label: 'Technique', icon: 'footsteps', color: '#3498DB' },    // Movement, footwork, skills
    { key: 'volume', label: 'Volume', icon: 'repeat', color: '#27AE60' },            // ARC, base building
    { key: 'projecting', label: 'Projecting', icon: 'trending-up', color: '#8E44AD' }, // Performance, tactics
    { key: 'recovery', label: 'Recovery', icon: 'leaf', color: '#95A5A6' },           // Mobility, yoga, prehab
    { key: 'cardio', label: 'Cardio', icon: 'bicycle', color: '#96CEB4' },           // Aerobic endurance
  ] as const;

  const getGymName = () => {
    if (!workout?.gymId) return 'Unknown Gym';
    const gym = gyms.find(g => g.id === workout.gymId);
    return gym?.name || 'Unknown Gym';
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString([], { 
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${mins}m`;
  };

  const handleSave = async () => {
    if (!workout) return;

    try {
      await updateWorkoutHistory(workout.id, {
        title: title || undefined,
        workoutType,
        notes: notes || undefined,
        exercises,
      });
      setIsEditing(false);
      Alert.alert('Success', 'Workout updated successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to update workout');
    }
  };

  const handleDelete = () => {
    if (!workout) return;

    Alert.alert(
      'Delete Workout',
      'Are you sure you want to delete this workout? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteWorkoutHistory(workout.id);
              onClose();
              Alert.alert('Success', 'Workout deleted successfully');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete workout');
            }
          },
        },
      ]
    );
  };

  const addExercise = () => {
    setExercises([
      ...exercises,
      {
        id: Date.now().toString(),
        name: '',
        sets: undefined,
        reps: undefined,
        weight: undefined,
        duration: undefined,
        distance: undefined,
        notes: '',
      },
    ]);
  };

  const updateExercise = (id: string, updates: Partial<WorkoutExercise>) => {
    setExercises(exercises.map(ex => ex.id === id ? { ...ex, ...updates } : ex));
  };

  const removeExercise = (id: string) => {
    setExercises(exercises.filter(ex => ex.id !== id));
  };

  if (!workout) return null;

  const selectedType = workoutTypes.find(t => t.key === workoutType) || workoutTypes[0];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Ionicons name="close" size={28} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Workout Details</Text>
          <View style={styles.headerActions}>
            {isEditing ? (
              <TouchableOpacity onPress={handleSave} style={styles.headerButton}>
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.headerButton}>
                <Ionicons name="create-outline" size={24} color="#007AFF" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Date and Time */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Date & Time</Text>
            <View style={styles.card}>
              <View style={styles.infoRow}>
                <Ionicons name="calendar" size={20} color="#666" />
                <Text style={styles.infoText}>{formatDate(workout.startTime)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="time" size={20} color="#666" />
                <Text style={styles.infoText}>
                  {formatTime(workout.startTime)} - {formatTime(workout.endTime)}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="hourglass" size={20} color="#666" />
                <Text style={styles.infoText}>Duration: {formatDuration(workout.duration)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="location" size={20} color="#666" />
                <Text style={styles.infoText}>{getGymName()}</Text>
              </View>
            </View>
          </View>

          {/* Title */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Workout Title</Text>
            {isEditing ? (
              <TextInput
                style={styles.input}
                placeholder="E.g., Morning Cardio, Leg Day"
                value={title}
                onChangeText={setTitle}
              />
            ) : (
              <View style={styles.card}>
                <Text style={styles.displayText}>{title || 'No title'}</Text>
              </View>
            )}
          </View>

          {/* Workout Type */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Workout Type</Text>
            {isEditing ? (
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.typeScroll}
              >
                {workoutTypes.map((type) => (
                  <TouchableOpacity
                    key={type.key}
                    style={[
                      styles.typeButton,
                      workoutType === type.key && styles.typeButtonActive,
                      { borderColor: type.color }
                    ]}
                    onPress={() => setWorkoutType(type.key as WorkoutHistory['workoutType'])}
                  >
                    <Ionicons 
                      name={type.icon as any} 
                      size={24} 
                      color={workoutType === type.key ? type.color : '#666'} 
                    />
                    <Text style={[
                      styles.typeButtonText,
                      workoutType === type.key && { color: type.color }
                    ]}>
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <View style={[styles.card, { backgroundColor: selectedType.color + '20' }]}>
                <View style={styles.typeDisplay}>
                  <Ionicons name={selectedType.icon as any} size={32} color={selectedType.color} />
                  <Text style={[styles.typeDisplayText, { color: selectedType.color }]}>
                    {selectedType.label}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Notes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            {isEditing ? (
              <TextInput
                style={[styles.input, styles.notesInput]}
                placeholder="How did the workout go? Any achievements?"
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={4}
              />
            ) : (
              <View style={styles.card}>
                <Text style={styles.displayText}>{notes || 'No notes'}</Text>
              </View>
            )}
          </View>

          {/* Exercises */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Exercises</Text>
              {isEditing && (
                <TouchableOpacity onPress={addExercise} style={styles.addButton}>
                  <Ionicons name="add-circle" size={24} color="#007AFF" />
                  <Text style={styles.addButtonText}>Add Exercise</Text>
                </TouchableOpacity>
              )}
            </View>

            {exercises.length === 0 ? (
              <View style={styles.card}>
                <Text style={styles.emptyText}>No exercises logged</Text>
              </View>
            ) : (
              exercises.map((exercise) => (
                <View key={exercise.id} style={styles.exerciseCard}>
                  {isEditing ? (
                    <>
                      <View style={styles.exerciseHeader}>
                        <TextInput
                          style={[styles.input, styles.exerciseNameInput]}
                          placeholder="Exercise name"
                          value={exercise.name}
                          onChangeText={(text) => updateExercise(exercise.id, { name: text })}
                        />
                        <TouchableOpacity onPress={() => removeExercise(exercise.id)}>
                          <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                        </TouchableOpacity>
                      </View>
                      <View style={styles.exerciseDetails}>
                        <TextInput
                          style={styles.exerciseInput}
                          placeholder="Sets"
                          keyboardType="numeric"
                          value={exercise.sets?.toString() || ''}
                          onChangeText={(text) => updateExercise(exercise.id, { sets: text ? parseInt(text) : undefined })}
                        />
                        <TextInput
                          style={styles.exerciseInput}
                          placeholder="Reps"
                          keyboardType="numeric"
                          value={exercise.reps?.toString() || ''}
                          onChangeText={(text) => updateExercise(exercise.id, { reps: text ? parseInt(text) : undefined })}
                        />
                        <TextInput
                          style={styles.exerciseInput}
                          placeholder="Weight (lbs)"
                          keyboardType="numeric"
                          value={exercise.weight?.toString() || ''}
                          onChangeText={(text) => updateExercise(exercise.id, { weight: text ? parseFloat(text) : undefined })}
                        />
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={styles.exerciseName}>{exercise.name}</Text>
                      <View style={styles.exerciseStats}>
                        {exercise.sets && (
                          <Text style={styles.exerciseStat}>{exercise.sets} sets</Text>
                        )}
                        {exercise.reps && (
                          <Text style={styles.exerciseStat}>{exercise.reps} reps</Text>
                        )}
                        {exercise.weight && (
                          <Text style={styles.exerciseStat}>{exercise.weight} lbs</Text>
                        )}
                        {exercise.duration && (
                          <Text style={styles.exerciseStat}>{exercise.duration} min</Text>
                        )}
                        {exercise.distance && (
                          <Text style={styles.exerciseStat}>{exercise.distance} km</Text>
                        )}
                      </View>
                    </>
                  )}
                </View>
              ))
            )}
          </View>

          {/* Delete Button */}
          {!isEditing && (
            <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
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
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#007AFF',
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 16,
    color: '#000',
    marginLeft: 12,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#000',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  notesInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  displayText: {
    fontSize: 16,
    color: '#000',
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
  typeScroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  typeButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginRight: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
    minWidth: 100,
  },
  typeButtonActive: {
    backgroundColor: '#F8F9FA',
  },
  typeButtonText: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  typeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeDisplayText: {
    fontSize: 20,
    fontWeight: '600',
    marginLeft: 12,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginLeft: 4,
  },
  exerciseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  exerciseNameInput: {
    flex: 1,
    marginRight: 12,
    marginBottom: 0,
  },
  exerciseDetails: {
    flexDirection: 'row',
    gap: 8,
  },
  exerciseInput: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#000',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  exerciseStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  exerciseStat: {
    fontSize: 14,
    color: '#666',
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
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

export default WorkoutHistoryModal;

