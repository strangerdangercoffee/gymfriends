// CalendarGrid.tsx - Updated with proper drag functionality
import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CalendarDay, WorkoutSession } from '../types';

interface CalendarGridProps {
  currentDate: Date;
  workouts: WorkoutSession[];
  onTimeSlotPress: (date: Date, hour: number, minute: number) => void;
  onWorkoutPress: (workout: WorkoutSession) => void;
  viewType: 'week' | 'month';
}

const { width: screenWidth } = Dimensions.get('window');
const HOUR_HEIGHT = 60;
const TIME_SLOT_HEIGHT = 30;

const CalendarGrid: React.FC<CalendarGridProps> = ({
  currentDate,
  workouts,
  onTimeSlotPress,
  onWorkoutPress,
  viewType,
}) => {
  const [selectedDate, setSelectedDate] = useState<Date>(currentDate);
  const scrollViewRef = useRef<ScrollView>(null);

  // Simple time slot press handler
  const handleTimeSlotPress = (date: Date, hour: number, minute: number) => {
    onTimeSlotPress(date, hour, minute);
  };

  // Generate calendar days based on view type
  const calendarDays = useMemo(() => {
    const days: CalendarDay[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (viewType === 'week') {
      // Generate 7 days starting from the selected date
      const startOfWeek = new Date(selectedDate);
      startOfWeek.setDate(selectedDate.getDate() - selectedDate.getDay());
      
      for (let i = 0; i < 7; i++) {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + i);
        
        const dayWorkouts = workouts.filter(workout => {
          const workoutDate = new Date(workout.startTime);
          return workoutDate.toDateString() === date.toDateString();
        });

        days.push({
          date,
          isToday: date.toDateString() === today.toDateString(),
          hasWorkouts: dayWorkouts.length > 0,
          workouts: dayWorkouts,
          isWeekend: date.getDay() === 0 || date.getDay() === 6,
          isPast: date < today,
        });
      }
    } else {
      // Generate month view (simplified - showing current month)
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      
      // Start from the first day of the week containing the first day of the month
      const startDate = new Date(firstDay);
      startDate.setDate(firstDay.getDate() - firstDay.getDay());
      
      // Generate 42 days (6 weeks)
      for (let i = 0; i < 42; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        
        const dayWorkouts = workouts.filter(workout => {
          const workoutDate = new Date(workout.startTime);
          return workoutDate.toDateString() === date.toDateString();
        });

        days.push({
          date,
          isToday: date.toDateString() === today.toDateString(),
          hasWorkouts: dayWorkouts.length > 0,
          workouts: dayWorkouts,
          isWeekend: date.getDay() === 0 || date.getDay() === 6,
          isPast: date < today,
        });
      }
    }

    return days;
  }, [selectedDate, workouts, viewType]);

  // Generate time slots (6 AM to 10 PM)
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = 6; hour <= 22; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        slots.push({
          hour,
          minute,
          isSelected: false,
          hasWorkout: false,
        });
      }
    }
    return slots;
  }, []);

  const getDayStyle = (day: CalendarDay) => {
    const baseStyle = [styles.dayColumn];
    
    if (day.isToday) {
      baseStyle.push(styles.todayColumn);
    } else if (day.hasWorkouts) {
      baseStyle.push(styles.workoutDayColumn);
    } else if (day.isWeekend) {
      baseStyle.push(styles.weekendColumn);
    }
    
    if (day.isPast) {
      baseStyle.push(styles.pastDayColumn);
    }
    
    return baseStyle;
  };

  const getWorkoutStyle = (workout: WorkoutSession) => {
    const baseStyle = [styles.workoutBlock];
    
    // Add completed style if workout is completed
    if (workout.status === 'completed') {
      baseStyle.push(styles.completedWorkout);
    }
    
    switch (workout.workoutType) {
      case 'cardio':
        baseStyle.push(styles.cardioWorkout);
        break;
      case 'strength':
        baseStyle.push(styles.strengthWorkout);
        break;
      case 'yoga':
        baseStyle.push(styles.yogaWorkout);
        break;
      case 'running':
        baseStyle.push(styles.runningWorkout);
        break;
      case 'climbing':
        baseStyle.push(styles.climbingWorkout);
        break;
      case 'crossfit':
        baseStyle.push(styles.crossfitWorkout);
        break;
      default:
        baseStyle.push(styles.customWorkout);
    }
    
    return baseStyle;
  };

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

  const getWorkoutPosition = (workout: WorkoutSession) => {
    const startTime = new Date(workout.startTime);
    const endTime = new Date(workout.endTime);
    
    const startHour = startTime.getHours();
    const startMinute = startTime.getMinutes();
    const endHour = endTime.getHours();
    const endMinute = endTime.getMinutes();
    
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;
    const duration = endMinutes - startMinutes;
    
    // Calculate position from 6 AM (360 minutes)
    const topPosition = Math.max(0, (startMinutes - 360) * (HOUR_HEIGHT / 60));
    const height = duration * (HOUR_HEIGHT / 60);
    
    return {
      top: topPosition,
      height: Math.max(20, height), // Minimum height of 20px
    };
  };

  const renderTimeColumn = () => (
    <View style={styles.timeColumn}>
      {Array.from({ length: 17 }, (_, i) => {
        const hour = i + 6; // Start from 6 AM
        return (
          <View key={hour} style={styles.timeSlot}>
            <Text style={styles.timeLabel}>
              {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
            </Text>
          </View>
        );
      })}
    </View>
  );

  const renderDayColumn = (day: CalendarDay) => (
    <View key={day.date.toISOString()} style={getDayStyle(day)}>
      {/* Day Header */}
      <View style={styles.dayHeader}>
        <Text style={[
          styles.dayHeaderText,
          day.isToday && styles.todayText,
          day.isWeekend && styles.weekendText
        ]}>
          {day.date.getDate()}
        </Text>
        <Text style={[
          styles.dayHeaderSubtext,
          day.isToday && styles.todaySubtext
        ]}>
          {day.date.toLocaleDateString([], { weekday: 'short' })}
        </Text>
      </View>

      {/* Time Slots */}
      <View style={styles.dayContent}>
        {Array.from({ length: 17 }, (_, i) => {
          const hour = i + 6;
          return (
            <View key={hour} style={styles.hourSlot}>
              {/* First half-hour slot */}
              <TouchableOpacity
                style={styles.timeSlotButton}
                onPress={() => handleTimeSlotPress(day.date, hour, 0)}
                activeOpacity={0.7}
              />
              {/* Second half-hour slot */}
              <TouchableOpacity
                style={styles.timeSlotButton}
                onPress={() => handleTimeSlotPress(day.date, hour, 30)}
                activeOpacity={0.7}
              />
            </View>
          );
        })}

        {/* Workout Blocks */}
        {day.workouts.map((workout) => {
          const position = getWorkoutPosition(workout);
          return (
            <TouchableOpacity
              key={workout.id}
              style={[
                getWorkoutStyle(workout),
                {
                  top: position.top,
                  height: position.height,
                }
              ]}
              onPress={() => onWorkoutPress(workout)}
            >
              <View style={styles.workoutContent}>
                <View style={styles.workoutTextContainer}>
                  <Text style={styles.workoutTitle} numberOfLines={1}>
                    {workout.title}
                  </Text>
                  <Text style={styles.workoutTime} numberOfLines={1}>
                    {formatTime(new Date(workout.startTime))} - {formatTime(new Date(workout.endTime))}
                  </Text>
                </View>
                {workout.status === 'completed' && (
                  <View style={styles.completedBadge}>
                    <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Calendar Header */}
      <View style={styles.calendarHeader}>
        {viewType === 'week' ? (
          <View style={styles.weekHeader}>
            {calendarDays.slice(0, 7).map((day) => (
              <View key={day.date.toISOString()} style={styles.weekDayHeader}>
                <Text style={[
                  styles.weekDayText,
                  day.isToday && styles.todayText,
                  day.isWeekend && styles.weekendText
                ]}>
                  {day.date.toLocaleDateString([], { weekday: 'short' })}
                </Text>
                <Text style={[
                  styles.weekDayNumber,
                  day.isToday && styles.todayText,
                  day.isWeekend && styles.weekendText
                ]}>
                  {day.date.getDate()}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.monthHeader}>
            <Text style={styles.monthTitle}>
              {selectedDate.toLocaleDateString([], { month: 'long', year: 'numeric' })}
            </Text>
          </View>
        )}
      </View>

      {/* Calendar Grid */}
      <ScrollView 
        ref={scrollViewRef}
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.gridContainer}>
          {renderTimeColumn()}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.daysScrollView}
          >
            <View style={styles.daysContainer}>
              {calendarDays.map(renderDayColumn)}
            </View>
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  calendarHeader: {
    backgroundColor: '#F8F9FA',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E5E9',
    paddingVertical: 12,
  },
  weekHeader: {
    flexDirection: 'row',
    paddingHorizontal: 16,
  },
  weekDayHeader: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  weekDayText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6C757D',
    marginBottom: 2,
  },
  weekDayNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
  },
  monthHeader: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  gridContainer: {
    flexDirection: 'row',
  },
  timeColumn: {
    width: 60,
    backgroundColor: '#F8F9FA',
    borderRightWidth: 1,
    borderRightColor: '#E1E5E9',
  },
  timeSlot: {
    height: HOUR_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E5E9',
  },
  timeLabel: {
    fontSize: 11,
    color: '#6C757D',
    fontWeight: '500',
  },
  daysScrollView: {
    flex: 1,
  },
  daysContainer: {
    flexDirection: 'row',
  },
  dayColumn: {
    width: (screenWidth - 60) / 7, // 7 days in week view
    borderRightWidth: 1,
    borderRightColor: '#E1E5E9',
  },
  todayColumn: {
    backgroundColor: '#FFF3CD', // Light yellow for today
  },
  workoutDayColumn: {
    backgroundColor: '#D1ECF1', // Light blue for days with workouts
  },
  weekendColumn: {
    backgroundColor: '#F8F9FA', // Light gray for weekends
  },
  pastDayColumn: {
    opacity: 0.6,
  },
  dayHeader: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E5E9',
    backgroundColor: '#FFFFFF',
  },
  dayHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212529',
  },
  dayHeaderSubtext: {
    fontSize: 10,
    color: '#6C757D',
    marginTop: 2,
  },
  todayText: {
    color: '#856404',
    fontWeight: '700',
  },
  todaySubtext: {
    color: '#856404',
  },
  weekendText: {
    color: '#6C757D',
  },
  dayContent: {
    position: 'relative',
    minHeight: 17 * HOUR_HEIGHT, // 17 hours * 60px
  },
  hourSlot: {
    height: HOUR_HEIGHT,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E5E9',
  },
  timeSlotButton: {
    flex: 1,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F1F3F4',
  },
  workoutBlock: {
    position: 'absolute',
    left: 2,
    right: 2,
    borderRadius: 4,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  completedWorkout: {
    opacity: 0.85,
    borderWidth: 2,
    borderColor: '#28A745',
  },
  cardioWorkout: {
    backgroundColor: '#FF6B6B',
  },
  strengthWorkout: {
    backgroundColor: '#4ECDC4',
  },
  yogaWorkout: {
    backgroundColor: '#45B7D1',
  },
  runningWorkout: {
    backgroundColor: '#96CEB4',
  },
  climbingWorkout: {
    backgroundColor: '#A29BFE',
  },
  crossfitWorkout: {
    backgroundColor: '#FD79A8',
  },
  customWorkout: {
    backgroundColor: '#FECA57',
  },
  workoutContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flex: 1,
  },
  workoutTextContainer: {
    flex: 1,
  },
  workoutTitle: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 1,
  },
  workoutTime: {
    fontSize: 9,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  completedBadge: {
    marginLeft: 2,
  },
});

export default CalendarGrid;