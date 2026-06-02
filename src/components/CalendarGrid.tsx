// CalendarGrid.tsx - Updated with proper drag functionality
import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CalendarDay, WorkoutSession } from '../types';
import { colors } from '../theme/colors';
import {
  buildSpanSegmentsForWeek,
  isSpanningTripEvent,
  monthWeekSpanningPartition,
  type SpanSegment,
} from '../utils/calendarSpanUtils';

/** A Google Calendar / manual busy window to shade in the week view. */
export interface CalendarBusyBlock {
  id: string;
  startTime: Date;
  endTime: Date;
}

interface CalendarGridProps {
  currentDate: Date;
  workouts: WorkoutSession[];
  /** Optional GCal busy blocks — rendered as a vivid red tint in week view. */
  busyBlocks?: CalendarBusyBlock[];
  onTimeSlotPress: (date: Date, hour: number, minute: number) => void;
  onWorkoutPress: (workout: WorkoutSession) => void;
  onDayPress?: (date: Date) => void;
  viewType: 'week' | 'month';
  /** Friend calendar: max span rows per week; extra trips go to "+N more". */
  monthSpanMaxVisibleLanes?: number;
  /** Pull-to-refresh: fires when user drags down on the week scroll view. */
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const { width: screenWidth } = Dimensions.get('window');
const { height: screenHeight } = Dimensions.get('window');
const HOUR_HEIGHT = 60;
const TIME_SLOT_HEIGHT = 30;

/** Month trip spans: gap between bars equals gap below day number before first bar. */
const MONTH_TRIP_BAR_H = 16;
const MONTH_TRIP_GAP = 2;
const MONTH_TRIP_LANE_STEP = MONTH_TRIP_BAR_H + MONTH_TRIP_GAP;
const MONTH_CELL_PAD_TOP = 4;
const MONTH_DAY_NUM_LINE_H = 18;
const MONTH_DATE_BOTTOM = MONTH_CELL_PAD_TOP + MONTH_DAY_NUM_LINE_H;
const MONTH_FIRST_TRIP_TOP = MONTH_DATE_BOTTOM + MONTH_TRIP_GAP;

const CalendarGrid: React.FC<CalendarGridProps> = ({
  currentDate,
  workouts,
  busyBlocks = [],
  onTimeSlotPress,
  onWorkoutPress,
  onDayPress,
  viewType,
  monthSpanMaxVisibleLanes,
  onRefresh,
  isRefreshing = false,
}) => {
  const scrollViewRef = useRef<ScrollView>(null);
  const [monthOverflowModal, setMonthOverflowModal] = useState<WorkoutSession[] | null>(
    null
  );

  const spanningWorkouts = useMemo(
    () => workouts.filter(isSpanningTripEvent),
    [workouts]
  );

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
          if (isSpanningTripEvent(workout)) return false;
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
          if (isSpanningTripEvent(workout)) return false;
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

  const weekSpanSegments = useMemo(() => {
    if (viewType !== 'week' || calendarDays.length < 1) return [];
    return buildSpanSegmentsForWeek(calendarDays[0].date, spanningWorkouts);
  }, [viewType, calendarDays, spanningWorkouts]);

  const monthWeekLayouts = useMemo(() => {
    if (viewType !== 'month') return [];
    return Array.from({ length: monthRows }, (_, row) => {
      const sun = calendarDays[row * 7]?.date;
      if (!sun) {
        return {
          rowSegs: [] as SpanSegment[],
          overflowWorkouts: [] as WorkoutSession[],
          displayLanes: 0,
          spanH: 0,
        };
      }
      const { rowSegs, overflowWorkouts, displayLaneCount } =
        monthWeekSpanningPartition(sun, spanningWorkouts, monthSpanMaxVisibleLanes);
      const spanH =
        displayLaneCount > 0 ? displayLaneCount * MONTH_TRIP_LANE_STEP : 0;
      return {
        rowSegs,
        overflowWorkouts,
        displayLanes: displayLaneCount,
        spanH,
      };
    });
  }, [
    viewType,
    monthRows,
    calendarDays,
    spanningWorkouts,
    monthSpanMaxVisibleLanes,
  ]);

  const monthRowSpanHeights = useMemo(
    () => monthWeekLayouts.map((l) => l.spanH),
    [monthWeekLayouts]
  );

  const monthCellHeight = useMemo(() => {
    if (viewType !== 'month') return 72;
    const totalSpan = monthRowSpanHeights.reduce((a, b) => a + b, 0);
    const budget = Math.max(320, screenHeight - 260);
    const h = (budget - totalSpan) / Math.max(monthRows, 1);
    return Math.max(48, Math.min(120, h));
  }, [viewType, monthRows, monthRowSpanHeights, screenHeight]);

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
    if (
      workout.id.startsWith('cluster-f-') ||
      workout.id.startsWith('friend-trip-span-') ||
      workout.id.startsWith('friend-trip-')
    ) {
      baseStyle.push(styles.tripBlock);
      return baseStyle;
    }
    if (
      workout.id.startsWith('cluster-my-') ||
      workout.id.startsWith('trip-span-') ||
      workout.id.startsWith('my-trip-span-') ||
      workout.id.startsWith('my-trip-')
    ) {
      baseStyle.push(styles.myTripBlock);
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
    if (
      workout.id.startsWith('cluster-f-') ||
      workout.id.startsWith('friend-trip-span-') ||
      workout.id.startsWith('friend-trip-')
    ) {
      return '#17A2B8';
    }
    if (
      workout.id.startsWith('cluster-my-') ||
      workout.id.startsWith('trip-span-') ||
      workout.id.startsWith('my-trip-span-') ||
      workout.id.startsWith('my-trip-')
    ) {
      return '#6F42C1';
    }
    if (workout.status === 'completed') {
      return '#28A745'; // Green for completed
    }
    switch (workout.workoutType) {
      case 'limit':
        return colors.workoutTypes.limit; // Max strength / recruitment
      case 'power':
        return colors.workoutTypes.power; // Dynamic, explosive
      case 'endurance':
        return colors.workoutTypes.endurance; // PE + aerobic power
      case 'technique':
        return colors.workoutTypes.technique; // Movement, footwork, skills
      case 'volume':
        return colors.workoutTypes.volume; // ARC, base building
      case 'projecting':
        return colors.workoutTypes.projecting; // Performance, tactics
      case 'recovery':
        return colors.workoutTypes.recovery; // Mobility, yoga, prehab
      case 'cardio':
        return colors.workoutTypes.cardio; // Aerobic endurance
      default:
        return colors.workoutTypes.volume;
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

        {/* Google Calendar Busy Overlays — rendered behind workout blocks */}
        {busyBlocks
          .filter((b) => {
            const dayStr = day.date.toDateString();
            return (
              b.startTime.toDateString() === dayStr ||
              b.endTime.toDateString() === dayStr ||
              (b.startTime < day.date && b.endTime > day.date)
            );
          })
          .map((block) => {
            const position = getWorkoutPosition({
              startTime: block.startTime,
              endTime: block.endTime,
            } as any);
            const blockHeight = Math.max(position.height, 6);
            return (
              <View
                key={`gcal-busy-${block.id}`}
                pointerEvents="none"
                style={[
                  styles.busyBlockOverlay,
                  day.isPast && styles.busyBlockOverlayPast,
                  { top: position.top, height: blockHeight },
                ]}
              >
                {blockHeight >= 20 && (
                  <Text style={styles.busyBlockLabel} numberOfLines={1}>
                    Busy
                  </Text>
                )}
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
                    <Ionicons name="checkmark-circle" size={16} color={colors.text} />
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

      {viewType === 'week' && weekSpanSegments.length > 0 && (
        <View
          style={[
            styles.weekTripStrip,
            {
              height:
                Math.max(...weekSpanSegments.map((s) => s.lane)) * 22 + 28,
            },
          ]}
        >
          <View style={styles.timeColumnSpacer} />
          <View style={styles.weekTripStripInner}>
            {weekSpanSegments.map((seg) => (
              <TouchableOpacity
                key={seg.workout.id}
                activeOpacity={0.85}
                style={[
                  styles.weekTripBar,
                  {
                    left: `${(seg.startCol / 7) * 100}%`,
                    width: `${((seg.endCol - seg.startCol + 1) / 7) * 100}%`,
                    top: seg.lane * 22 + 4,
                    backgroundColor: getWorkoutColor(seg.workout),
                  },
                ]}
                onPress={() => onWorkoutPress(seg.workout)}
              >
                <Text style={styles.weekTripBarText} numberOfLines={1}>
                  {seg.workout.title}
                </Text>
              </TouchableOpacity>
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
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            ) : undefined
          }
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
          {Array.from({ length: monthRows }, (_, rowIdx) => {
            const weekDays = calendarDays.slice(rowIdx * 7, rowIdx * 7 + 7);
            if (!weekDays.length) return null;
            const layout = monthWeekLayouts[rowIdx];
            const rowSegs = layout?.rowSegs ?? [];
            const overflowWorkouts = layout?.overflowWorkouts ?? [];
            const spanH = monthRowSpanHeights[rowIdx] ?? 0;
            const lanes = layout?.displayLanes ?? 0;
            const baseLanes =
              rowSegs.length > 0
                ? Math.max(...rowSegs.map((s) => s.lane)) + 1
                : 0;
            return (
              <View key={`month-row-${rowIdx}`} style={styles.monthWeekBlock}>
                <View style={styles.monthGridRow}>
                  {weekDays.map((day) => {
                    const isCurrentMonth =
                      day.date.getMonth() === currentDate.getMonth();
                    const workoutCount = day.workouts.length;
                    return (
                      <TouchableOpacity
                        key={day.date.toISOString()}
                        style={[
                          styles.monthDayCell,
                          { height: monthCellHeight },
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
                        {lanes > 0 && (
                          <View
                            style={{ height: lanes * MONTH_TRIP_LANE_STEP }}
                          />
                        )}
                        {day.workouts.length > 0 && (
                          <View style={styles.monthDayWorkoutsContainer}>
                            {day.workouts.slice(0, 3).map((workout) => (
                              <View
                                key={workout.id}
                                style={[
                                  styles.monthDayWorkoutSlot,
                                  {
                                    backgroundColor: getWorkoutColor(workout),
                                  },
                                ]}
                              >
                                <Text
                                  style={styles.monthDayWorkoutSlotText}
                                  numberOfLines={1}
                                >
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
                {spanH > 0 && (
                  <View
                    pointerEvents="box-none"
                    style={[
                      styles.monthSpanOverlay,
                      { height: monthCellHeight },
                    ]}
                  >
                    {rowSegs.map((seg) => (
                      <TouchableOpacity
                        key={`${seg.workout.id}-r${rowIdx}`}
                        activeOpacity={0.85}
                        style={[
                          styles.monthSpanBar,
                          {
                            left: `${(seg.startCol / 7) * 100}%`,
                            width: `${((seg.endCol - seg.startCol + 1) / 7) * 100}%`,
                            top:
                              MONTH_FIRST_TRIP_TOP +
                              seg.lane * MONTH_TRIP_LANE_STEP,
                            backgroundColor: getWorkoutColor(seg.workout),
                          },
                        ]}
                        onPress={() => onWorkoutPress(seg.workout)}
                      >
                        <Text style={styles.monthSpanBarText} numberOfLines={1}>
                          {seg.workout.title}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    {overflowWorkouts.length > 0 && (
                      <TouchableOpacity
                        activeOpacity={0.85}
                        style={[
                          styles.monthSpanOverflowBar,
                          {
                            top:
                              MONTH_FIRST_TRIP_TOP +
                              baseLanes * MONTH_TRIP_LANE_STEP,
                          },
                        ]}
                        onPress={() =>
                          setMonthOverflowModal(overflowWorkouts)
                        }
                      >
                        <Text
                          style={styles.monthSpanOverflowBarText}
                          numberOfLines={1}
                        >
                          +{overflowWorkouts.length} more trip
                          {overflowWorkouts.length === 1 ? '' : 's'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      <Modal
        visible={monthOverflowModal != null}
        transparent
        animationType="fade"
        onRequestClose={() => setMonthOverflowModal(null)}
      >
        <View style={styles.overflowModalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setMonthOverflowModal(null)}
          />
          <View style={styles.overflowModalCard}>
            <Text style={styles.overflowModalTitle}>More trips this week</Text>
            <FlatList
              data={monthOverflowModal ?? []}
              keyExtractor={(item) => item.id}
              style={styles.overflowModalList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.overflowModalRow}
                  onPress={() => {
                    setMonthOverflowModal(null);
                    onWorkoutPress(item);
                  }}
                >
                  <Text style={styles.overflowModalRowTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  {item.spanningEndDate ? (
                    <Text style={styles.overflowModalRowSub}>
                      {item.startTime.toISOString().slice(0, 10)} –{' '}
                      {item.spanningEndDate}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              onPress={() => setMonthOverflowModal(null)}
              style={styles.overflowModalClose}
            >
              <Text style={styles.overflowModalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  calendarHeader: {
    backgroundColor: colors.surfaceElevated,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    color: colors.textMuted,
    marginBottom: 2,
  },
  weekDayNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
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
    backgroundColor: colors.surfaceElevated,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  timeSlot: {
    height: HOUR_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  timeLabel: {
    fontSize: 11,
    color: colors.textMuted,
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
    borderRightColor: colors.border,
    // Same as weekend columns — weekdays were previously transparent / darker
    backgroundColor: colors.surfaceElevated,
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
    borderBottomColor: colors.border,
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
    color: colors.textMuted,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    overflow: 'hidden',
  },
  monthWeekBlock: {
    width: '100%',
    position: 'relative',
  },
  monthGridRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
  },
  monthSpanOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 3,
  },
  monthSpanBar: {
    position: 'absolute',
    height: MONTH_TRIP_BAR_H,
    borderRadius: 4,
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  monthSpanBarText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  monthSpanOverflowBar: {
    position: 'absolute',
    left: '1%',
    width: '98%',
    height: MONTH_TRIP_BAR_H,
    borderRadius: 4,
    backgroundColor: colors.textMuted,
    paddingHorizontal: 6,
    justifyContent: 'center',
  },
  monthSpanOverflowBarText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.background,
    textAlign: 'center',
  },
  overflowModalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: 24,
  },
  overflowModalCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    maxHeight: '70%',
  },
  overflowModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  overflowModalList: {
    maxHeight: 320,
  },
  overflowModalRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  overflowModalRowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  overflowModalRowSub: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
  overflowModalClose: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 10,
  },
  overflowModalCloseText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  weekTripStrip: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  weekTripStripInner: {
    flex: 1,
    position: 'relative',
    marginRight: 4,
  },
  weekTripBar: {
    position: 'absolute',
    height: 18,
    borderRadius: 4,
    paddingHorizontal: 6,
    justifyContent: 'center',
  },
  weekTripBarText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  monthDayCell: {
    width: (screenWidth - 33) / 7,
    // Height is set dynamically based on number of rows needed
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
  },
  monthDayCellOtherMonth: {
    backgroundColor: colors.surfaceElevated,
    opacity: 0.5,
  },
  monthDayCellToday: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primary,
    borderWidth: 2,
  },
  monthDayCellWithWorkouts: {
    // Removed background color - workouts will show with their own colors
  },
  monthDayNumber: {
    fontSize: 14,
    lineHeight: MONTH_DAY_NUM_LINE_H,
    fontWeight: '500',
    color: colors.text,
  },
  monthDayNumberOtherMonth: {
    color: colors.textFaded,
  },
  monthDayNumberToday: {
    fontWeight: '700',
    color: colors.primary,
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
    color: colors.text,
    lineHeight: 12,
  },
  monthDayWorkoutMore: {
    width: '100%',
    height: 14,
    borderRadius: 3,
    backgroundColor: colors.textMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  monthDayWorkoutMoreText: {
    fontSize: 8,
    fontWeight: '600',
    color: colors.text,
  },
  todayColumn: {
    backgroundColor: colors.primaryMuted,
  },
  workoutDayColumn: {
    backgroundColor: colors.surfaceElevated,
  },
  weekendColumn: {
    backgroundColor: colors.surfaceElevated,
  },
  pastDayColumn: {
    opacity: 0.6,
  },
  todayText: {
    color: colors.primary,
    fontWeight: '700',
  },
  weekendText: {
    color: colors.textMuted,
  },
  dayContent: {
    position: 'relative',
    minHeight: 17 * HOUR_HEIGHT, // 17 hours * 60px
  },
  hourSlot: {
    height: HOUR_HEIGHT,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  timeSlotButton: {
    flex: 1,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  busyBlockOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'rgba(245, 80, 63, 0.35)',
    borderLeftWidth: 3,
    borderLeftColor: '#f5503f',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  busyBlockOverlayPast: {
    backgroundColor: 'rgba(245, 80, 63, 0.15)',
    borderLeftColor: 'rgba(245, 80, 63, 0.4)',
  },
  busyBlockLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#f5503f',
    paddingLeft: 5,
    letterSpacing: 0.3,
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
    backgroundColor: colors.workoutTypes.limit, // Max strength / recruitment
  },
  powerWorkout: {
    backgroundColor: colors.workoutTypes.power, // Dynamic, explosive
  },
  enduranceWorkout: {
    backgroundColor: colors.workoutTypes.endurance, // PE + aerobic power
  },
  techniqueWorkout: {
    backgroundColor: colors.workoutTypes.technique, // Movement, footwork, skills
  },
  volumeWorkout: {
    backgroundColor: colors.workoutTypes.volume, // ARC, base building
  },
  projectingWorkout: {
    backgroundColor: colors.workoutTypes.projecting, // Performance, tactics
  },
  recoveryWorkout: {
    backgroundColor: colors.workoutTypes.recovery, // Mobility, yoga, prehab
  },
  cardioWorkout: {
    backgroundColor: colors.workoutTypes.cardio, // Aerobic endurance
  },
  customWorkout: {
    backgroundColor: colors.workoutTypes.volume,
  },
  tripBlock: {
    backgroundColor: colors.workoutTypes.cardio, // Trip / performance window
  },
  myTripBlock: {
    backgroundColor: colors.workoutTypes.projecting,
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