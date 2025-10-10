import { WorkoutSession, CalendarDay, CalendarView } from '../types';

// Generate sample workout data for testing
export const generateSampleWorkouts = (): WorkoutSession[] => {
  const now = new Date();
  const workouts: WorkoutSession[] = [];

  // Today's workouts
  const today = new Date(now);
  workouts.push({
    id: '1',
    startTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 7, 0),
    endTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 8, 0),
    workoutType: 'cardio',
    title: 'Morning Cardio',
    notes: 'Treadmill and cycling',
    isRecurring: false,
    status: 'planned',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });

  workouts.push({
    id: '2',
    startTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 18, 0),
    endTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 19, 30),
    workoutType: 'strength',
    title: 'Upper Body Strength',
    notes: 'Bench press, rows, and accessories',
    isRecurring: true,
    recurringPattern: {
      type: 'weekly',
      interval: 1,
      daysOfWeek: [1, 3, 5], // Mon, Wed, Fri
    },
    status: 'planned',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });

  // Tomorrow's workout
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  workouts.push({
    id: '3',
    startTime: new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 6, 30),
    endTime: new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 7, 30),
    workoutType: 'yoga',
    title: 'Morning Yoga',
    notes: 'Vinyasa flow',
    isRecurring: false,
    status: 'planned',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });

  // Next week's workout
  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);
  workouts.push({
    id: '4',
    startTime: new Date(nextWeek.getFullYear(), nextWeek.getMonth(), nextWeek.getDate(), 17, 0),
    endTime: new Date(nextWeek.getFullYear(), nextWeek.getMonth(), nextWeek.getDate(), 18, 0),
    workoutType: 'running',
    title: 'Evening Run',
    notes: '5K training run',
    isRecurring: false,
    status: 'planned',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });

  return workouts;
};

// Format time helper
export const formatTime = (date: Date): string => {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Format date helper
export const formatDate = (date: Date): string => {
  return date.toLocaleDateString([], { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  });
};

// Get calendar view based on type and current date
export const getCalendarView = (type: 'today' | 'week' | 'month', currentDate: Date): CalendarView => {
  const now = new Date(currentDate);
  
  if (type === 'today') {
    return {
      type: 'today',
      startDate: now,
      endDate: now,
    };
  } else if (type === 'week') {
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    return {
      type: 'week',
      startDate: startOfWeek,
      endDate: endOfWeek,
    };
  } else if (type === 'month') {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    return {
      type: 'month',
      startDate: startOfMonth,
      endDate: endOfMonth,
    };
  }
  
  return {
    type: 'today',
    startDate: now,
    endDate: now,
  };
};

// Generate calendar days for a given view
export const generateCalendarDays = (
  view: CalendarView,
  workouts: WorkoutSession[]
): CalendarDay[] => {
  const days: CalendarDay[] = [];
  
  if (view.type === 'today') {
    const today = view.startDate;
    const dayWorkouts = workouts.filter(workout => {
      const workoutDate = new Date(workout.startTime);
      return workoutDate.toDateString() === today.toDateString();
    });
    
    days.push({
      date: today,
      isToday: true,
      hasWorkouts: dayWorkouts.length > 0,
      workouts: dayWorkouts,
      isWeekend: today.getDay() === 0 || today.getDay() === 6,
      isPast: false,
    });
  } else if (view.type === 'week') {
    const startOfWeek = new Date(view.startDate);
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      
      const dayWorkouts = workouts.filter(workout => {
        const workoutDate = new Date(workout.startTime);
        return workoutDate.toDateString() === date.toDateString();
      });
      
      days.push({
        date,
        isToday: date.toDateString() === new Date().toDateString(),
        hasWorkouts: dayWorkouts.length > 0,
        workouts: dayWorkouts,
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        isPast: date < new Date() && date.toDateString() !== new Date().toDateString(),
      });
    }
  } else if (view.type === 'month') {
    const startOfMonth = new Date(view.startDate);
    const endOfMonth = new Date(view.endDate);
    
    // Start from the first Sunday of the month
    const startDate = new Date(startOfMonth);
    startDate.setDate(startDate.getDate() - startDate.getDay());
    
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
        isToday: date.toDateString() === new Date().toDateString(),
        hasWorkouts: dayWorkouts.length > 0,
        workouts: dayWorkouts,
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        isPast: date < new Date() && date.toDateString() !== new Date().toDateString(),
      });
    }
  }
  
  return days;
};

// Get workout style based on type
export const getWorkoutStyle = (workout: WorkoutSession) => {
  const baseStyle = {
    position: 'absolute' as const,
    left: 2,
    right: 2,
    borderRadius: 4,
    padding: 4,
    zIndex: 2,
  };

  switch (workout.workoutType) {
    case 'cardio':
      return [baseStyle, { backgroundColor: '#FF6B6B' }];
    case 'strength':
      return [baseStyle, { backgroundColor: '#4ECDC4' }];
    case 'yoga':
      return [baseStyle, { backgroundColor: '#45B7D1' }];
    case 'running':
      return [baseStyle, { backgroundColor: '#96CEB4' }];
    default:
      return [baseStyle, { backgroundColor: '#FFA07A' }];
  }
};

// Check if two dates are the same day
export const isSameDay = (date1: Date, date2: Date): boolean => {
  return date1.toDateString() === date2.toDateString();
};

// Get start of day
export const getStartOfDay = (date: Date): Date => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
};

// Get end of day
export const getEndOfDay = (date: Date): Date => {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
};


