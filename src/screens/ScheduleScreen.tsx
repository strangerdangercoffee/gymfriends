import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Schedule, ScheduleStackParamList, WorkoutSession, WorkoutHistory, CalendarView } from '../types';
import CalendarHeader from '../components/CalendarHeader';
import CalendarGrid from '../components/CalendarGrid';
import WorkoutCreationModal from '../components/WorkoutCreationModal';
import WorkoutHistoryModal from '../components/WorkoutHistoryModal';
import { generateSampleWorkouts, getCalendarView } from '../utils/calendarUtils';

type ScheduleScreenNavigationProp = StackNavigationProp<ScheduleStackParamList, 'ScheduleMain'>;

const ScheduleScreen: React.FC = () => {
  const navigation = useNavigation<ScheduleScreenNavigationProp>();
  const { schedules, workoutHistory, isLoading, deleteSchedule, deleteRecurringSchedule } = useApp();
  const { user } = useAuth();
  
  // Calendar state
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [currentView, setCurrentView] = useState<'today' | 'week' | 'month'>('week');
  const [showWorkoutModal, setShowWorkoutModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedWorkoutHistory, setSelectedWorkoutHistory] = useState<WorkoutHistory | null>(null);
  const [editingWorkout, setEditingWorkout] = useState<WorkoutSession | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedHour, setSelectedHour] = useState<number>(9);
  const [selectedMinute, setSelectedMinute] = useState<number>(0);

  // Convert workout history to WorkoutSession format for calendar display
  const historyAsWorkouts = useMemo(() => {
    return workoutHistory.map((history): WorkoutSession => ({
      id: history.id,
      startTime: new Date(history.startTime),
      endTime: new Date(history.endTime),
      workoutType: history.workoutType || 'custom',
      title: history.title || 'Completed Workout',
      notes: history.notes,
      isRecurring: false,
      gymId: history.gymId,
      status: 'completed',
      createdAt: history.createdAt,
      updatedAt: history.updatedAt,
    }));
  }, [workoutHistory]);

  // Generate sample workouts for demonstration (planned workouts)
  const sampleWorkouts = useMemo(() => generateSampleWorkouts(), []);
  
  // Combine sample workouts and completed workouts
  const allWorkouts = useMemo(() => {
    return [...sampleWorkouts, ...historyAsWorkouts];
  }, [sampleWorkouts, historyAsWorkouts]);
  
  // Get current calendar view
  const calendarView = useMemo(() => getCalendarView(currentView, currentDate), [currentView, currentDate]);

  // Handle time slot press - simple click opens workout modal for new workout
  const handleTimeSlotPress = (date: Date, hour: number, minute: number) => {
    setEditingWorkout(null); // Clear any editing workout
    setSelectedDate(date);
    setSelectedHour(hour);
    setSelectedMinute(minute);
    setShowWorkoutModal(true);
  };

  // Handle workout press
  const handleWorkoutPress = (workout: WorkoutSession) => {
    // If it's a completed workout, show history modal
    if (workout.status === 'completed') {
      const history = workoutHistory.find(h => h.id === workout.id);
      if (history) {
        setSelectedWorkoutHistory(history);
        setShowHistoryModal(true);
      }
    } else {
      // If it's a planned workout, open workout modal in edit mode
      setEditingWorkout(workout);
      setShowWorkoutModal(true);
    }
  };

  // Handle view change
  const handleViewChange = (view: 'today' | 'week' | 'month') => {
    setCurrentView(view);
  };

  // Handle date change
  const handleDateChange = (date: Date) => {
    setCurrentDate(date);
  };

  // Handle add workout
  const handleAddWorkout = () => {
    setSelectedDate(currentDate);
    setSelectedHour(9);
    setSelectedMinute(0);
    setShowWorkoutModal(true);
  };

  // Handle save workout
  const handleSaveWorkout = (workout: Omit<WorkoutSession, 'id' | 'createdAt' | 'updatedAt'>) => {
    // TODO: Save workout to backend
    console.log('Saving workout:', workout);
    
    // For now, just close the modal
    setShowWorkoutModal(false);
  };

  // Handle close modal
  const handleCloseModal = () => {
    setShowWorkoutModal(false);
    setEditingWorkout(null);
  };

  // Handle delete workout
  const handleDeleteWorkout = async (workoutId: string, deleteAllRecurring?: boolean) => {
    if (!user) return;

    try {
      if (deleteAllRecurring && editingWorkout) {
        // Delete all recurring instances
        await deleteRecurringSchedule(
          user.id,
          editingWorkout.workoutType || '',
          editingWorkout.recurringPattern,
          editingWorkout.startTime.toISOString()
        );
        Alert.alert('Success', 'All recurring workouts deleted successfully');
      } else {
        // Delete single workout
        await deleteSchedule(workoutId);
        Alert.alert('Success', 'Workout deleted successfully');
      }
    } catch (error) {
      console.error('Error deleting workout:', error);
      Alert.alert('Error', 'Failed to delete workout. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      {/* Calendar Header */}
      <CalendarHeader
        currentView={calendarView}
        onViewChange={handleViewChange}
        onDateChange={handleDateChange}
        onAddWorkout={handleAddWorkout}
      />

      {/* Calendar Grid */}
      <CalendarGrid
        currentDate={currentDate}
        workouts={allWorkouts}
        onTimeSlotPress={handleTimeSlotPress}
        onWorkoutPress={handleWorkoutPress}
        viewType={currentView}
      />

      {/* Workout Creation Modal */}
      <WorkoutCreationModal
        visible={showWorkoutModal}
        onClose={handleCloseModal}
        onSave={handleSaveWorkout}
        onDelete={handleDeleteWorkout}
        selectedDate={selectedDate}
        selectedHour={selectedHour}
        selectedMinute={selectedMinute}
        editingWorkout={editingWorkout}
      />

      {/* Workout History Modal */}
      <WorkoutHistoryModal
        visible={showHistoryModal}
        onClose={() => {
          setShowHistoryModal(false);
          setSelectedWorkoutHistory(null);
        }}
        workout={selectedWorkoutHistory}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
});

export default ScheduleScreen;