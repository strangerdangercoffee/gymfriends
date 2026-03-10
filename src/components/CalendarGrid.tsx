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
  onDayPress?: (date: Date) => void;
  viewType: 'week' | 'month';
}

const { width: screenWidth } = Dimensions.get('window');
const { height: screenHeight } = Dimensions.get('window');
const HOUR_HEIGHT = 60;
const TIME_SLOT_HEIGHT = 30;

const CalendarGrid: React.FC<CalendarGridProps> = ({
  currentDate,
  workouts,
  onTimeSlotPress,
  onWorkoutPress,
  onDayPress,
  viewType,
}) => {
  const scrollViewRef = useRef<ScrollView>(null);

  // Calculate number of rows needed for month view
  const monthRows = useMemo(() => {
    if (viewType !== 'month') return 6; // Default for week view
    
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // Start from the first day of the week containing the first day of the month
    const startDate = new Date(firstDay);
    startDate.setDate(firstDay.getDate() - firstDay.getDay());
    
    // Calculate total days needed (from start date to last day of month)
    const totalDays = Math.ceil((lastDay.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const rows = Math.ceil(totalDays / 7);
    
    return rows;
  }, [currentDate, viewType]);

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
      // Generate 7 days starting from the current date
      const startOfWeek = new Date(currentDate);
      startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
      
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
    } else if (viewType === 'month') {
      // Generate month view - showing current month with surrounding days
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      
      // Start from the first day of the week containing the first day of the month
      const startDate = new Date(firstDay);
      startDate.setDate(firstDay.getDate() - firstDay.getDay());
      
      // Calculate exact number of days needed (only complete rows)
      const totalDays = Math.ceil((lastDay.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const rows = Math.ceil(totalDays / 7);
      const daysToShow = rows * 7; // Only show complete rows
      
      // Generate only the days needed for complete rows
      for (let i = 0; i < daysToShow; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        
        const dayWorkouts = workouts.filter(workout => {
          const workoutDate = new Date(workout.startTime);
          workoutDate.setHours(0, 0, 0, 0);
          const compareDate = new Date(date);
          compareDate.setHours(0, 0, 0, 0);
          return workoutDate.getTime() === compareDate.getTime();
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
  }, [currentDate, workouts, viewType]);

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
    if (workout.id.startsWith('trip-')) {
      baseStyle.push(styles.tripBlock);
      return baseStyle;
    }
    // Add completed style if workout is completed
    if (workout.status === 'completed') {
      baseStyle.push(styles.completedWorkout);
    }
    switch (workout.workoutType) {
      case 'limit':
        baseStyle.push(styles.limitWorkout);
        break;
      case 'power':
        baseStyle.push(styles.powerWorkout);
        break;
      case 'endurance':
        baseStyle.push(styles.enduranceWorkout);
        break;
      case 'technique':
        baseStyle.push(styles.techniqueWorkout);
        break;
      case 'volume':
        baseStyle.push(styles.volumeWorkout);
        break;
      case 'projecting':
        baseStyle.push(styles.projectingWorkout);
        break;
      case 'recovery':
        baseStyle.push(styles.recoveryWorkout);
        break;
      case 'cardio':
        baseStyle.push(styles.cardioWorkout);
        break;
      default:
        baseStyle.push(styles.customWorkout);
    }
    
    return baseStyle;
  };

  // Get workout background color for month view slots
  const getWorkoutColor = (workout: WorkoutSession): string => {
    if (workout.id.startsWith('trip-')) {
      return '#17A2B8'; // Teal for trip / performance window
    }
    if (workout.status === 'completed') {
      return '#28A745'; // Green for completed
    }
    switch (workout.workoutType) {
      case 'limit':
        return '#E74C3C'; // Max strength / recruitment
      case 'power':
        return '#F39C12'; // Dynamic, explosive
      case 'endurance':
        return '#D35400'; // PE + aerobic power
      case 'technique':
        return '#3498DB'; // Movement, footwork, skills
      case 'volume':
        return '#27AE60'; // ARC, base building
      case 'projecting':
        return '#8E44AD'; // Performance, tactics
      case 'recovery':
        return '#95A5A6'; // Mobility, yoga, prehab
      case 'cardio':
        return '#96CEB4'; // Aerobic endurance
      default:
        return '#FECA57';
    }
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
      {viewType === 'week' && (
        <View style={styles.calendarHeader}>
          <View style={styles.weekHeader}>
            {/* Spacer for time column */}
            <View style={styles.timeColumnSpacer} />
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
        </View>
      )}

      {/* Calendar Grid */}
      {viewType === 'week' ? (
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
      ) : (
        <View style={styles.monthContainer}>
          {/* Week day headers */}
          <View style={styles.monthWeekHeader}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <View key={day} style={styles.monthWeekDayHeader}>
                <Text style={styles.monthWeekDayText}>{day}</Text>
              </View>
            ))}
          </View>
          {/* Month grid */}
          <View style={styles.monthGrid}>
            {calendarDays.map((day) => {
              const isCurrentMonth = day.date.getMonth() === currentDate.getMonth();
              const workoutCount = day.workouts.length;
              
              return (
                <TouchableOpacity
                  key={day.date.toISOString()}
                  style={[
                    styles.monthDayCell,
                    {
                      height: (screenHeight - 300) / monthRows, // Dynamic height based on rows needed
                    },
                    !isCurrentMonth && styles.monthDayCellOtherMonth,
                    day.isToday && styles.monthDayCellToday,
                    workoutCount > 0 && styles.monthDayCellWithWorkouts,
                  ]}
                  onPress={() => onDayPress?.(day.date)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.monthDayNumber,
                      !isCurrentMonth && styles.monthDayNumberOtherMonth,
                      day.isToday && styles.monthDayNumberToday,
                    ]}
                  >
                    {day.date.getDate()}
                  </Text>
                  {day.workouts.length > 0 && (
                    <View style={styles.monthDayWorkoutsContainer}>
                      {day.workouts.slice(0, 3).map((workout, index) => (
                        <View
                          key={workout.id}
                          style={[
                            styles.monthDayWorkoutSlot,
                            { backgroundColor: getWorkoutColor(workout) },
                          ]}
                        >
                          <Text style={styles.monthDayWorkoutSlotText} numberOfLines={1}>
                            {workout.title}
                          </Text>
                        </View>
                      ))}
                      {day.workouts.length > 3 && (
                        <View style={styles.monthDayWorkoutMore}>
                          <Text style={styles.monthDayWorkoutMoreText}>
                            +{day.workouts.length - 3}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
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
    paddingHorizontal: 0,
  },
  timeColumnSpacer: {
    width: 45, // Match timeColumn width
  },
  weekDayHeader: {
    width: (screenWidth - 60) / 7, // Match dayColumn width
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
    width: 45,
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
    width: (screenWidth - 60) / 7, // Match dayColumn width
    borderRightWidth: 1,
    borderRightColor: '#E1E5E9',
  },
  monthContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    overflow: 'hidden', // Hide any overflow rows
  },
  monthWeekHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E5E9',
    paddingBottom: 8,
    marginBottom: 8,
  },
  monthWeekDayHeader: {
    flex: 1,
    alignItems: 'center',
  },
  monthWeekDayText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6C757D',
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    overflow: 'hidden', // Hide any overflow rows
  },
  monthDayCell: {
    width: (screenWidth - 33) / 7,
    // Height is set dynamically based on number of rows needed
    borderWidth: 1,
    borderColor: '#E1E5E9',
    padding: 4,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
  },
  monthDayCellOtherMonth: {
    backgroundColor: '#F8F9FA',
    opacity: 0.5,
  },
  monthDayCellToday: {
    backgroundColor: '#FFF3CD',
    borderColor: '#FFC107',
    borderWidth: 2,
  },
  monthDayCellWithWorkouts: {
    // Removed background color - workouts will show with their own colors
  },
  monthDayNumber: {
    fontSize: 14,
    fontWeight: '500',
    color: '#212529',
  },
  monthDayNumberOtherMonth: {
    color: '#ADB5BD',
  },
  monthDayNumberToday: {
    fontWeight: '700',
    color: '#856404',
  },
  monthDayWorkoutsContainer: {
    width: '100%',
    marginTop: 2,
    gap: 2,
  },
  monthDayWorkoutSlot: {
    width: '100%',
    height: 16,
    borderRadius: 3,
    paddingHorizontal: 3,
    paddingVertical: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginBottom: 1,
  },
  monthDayWorkoutSlotText: {
    fontSize: 8,
    fontWeight: '600',
    color: '#FFFFFF',
    lineHeight: 12,
  },
  monthDayWorkoutMore: {
    width: '100%',
    height: 14,
    borderRadius: 3,
    backgroundColor: '#6C757D',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  monthDayWorkoutMoreText: {
    fontSize: 8,
    fontWeight: '600',
    color: '#FFFFFF',
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
  todayText: {
    color: '#856404',
    fontWeight: '700',
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
  limitWorkout: {
    backgroundColor: '#E74C3C', // Max strength / recruitment
  },
  powerWorkout: {
    backgroundColor: '#F39C12', // Dynamic, explosive
  },
  enduranceWorkout: {
    backgroundColor: '#D35400', // PE + aerobic power
  },
  techniqueWorkout: {
    backgroundColor: '#3498DB', // Movement, footwork, skills
  },
  volumeWorkout: {
    backgroundColor: '#27AE60', // ARC, base building
  },
  projectingWorkout: {
    backgroundColor: '#8E44AD', // Performance, tactics
  },
  recoveryWorkout: {
    backgroundColor: '#95A5A6', // Mobility, yoga, prehab
  },
  cardioWorkout: {
    backgroundColor: '#96CEB4', // Aerobic endurance
  },
  customWorkout: {
    backgroundColor: '#FECA57',
  },
  tripBlock: {
    backgroundColor: '#17A2B8', // Trip / performance window
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