# Workout History Feature

This document describes the implementation of the workout history feature that displays completed workouts on the calendar based on check-in/checkout events.

## Overview

When a user checks out from a gym, the system automatically creates a workout history entry that appears on the calendar as a completed workout. Users can click on these completed workouts to view details and edit information about what they did during the workout.

## Features

- **Automatic Workout History Creation**: When a user checks out from a gym, a database trigger automatically creates a workout history entry
- **Calendar Display**: Completed workouts appear on the calendar with a visual distinction from planned workouts
- **Workout Details Modal**: Users can click on completed workouts to view and edit:
  - Workout title
  - Workout type (cardio, strength, yoga, running, climbing, crossfit, custom)
  - Notes about the workout
  - Individual exercises with sets, reps, weight, duration, and distance
- **Visual Distinction**: Completed workouts have a green border and checkmark icon to distinguish them from planned workouts

## Implementation Details

### 1. Database Schema

A new `workout_history` table was created with the following structure:

```sql
CREATE TABLE workout_history (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  gym_id UUID,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  duration INTEGER NOT NULL, -- in minutes
  workout_type TEXT,
  title TEXT,
  notes TEXT,
  exercises JSONB DEFAULT '[]'::jsonb,
  presence_id UUID, -- Link to presence record
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Database Trigger**: A PostgreSQL trigger automatically creates workout history entries when a user checks out:

```sql
CREATE OR REPLACE FUNCTION create_workout_history_on_checkout()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_active = TRUE AND NEW.is_active = FALSE THEN
    -- Automatically create workout history entry
    INSERT INTO workout_history (...)
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 2. TypeScript Types

New types were added to support workout history:

```typescript
export interface WorkoutHistory {
  id: string;
  userId: string;
  gymId: string;
  startTime: string;
  endTime: string;
  duration: number; // Duration in minutes
  workoutType?: 'cardio' | 'strength' | 'yoga' | 'running' | 'climbing' | 'crossfit' | 'custom';
  title?: string;
  notes?: string;
  exercises?: WorkoutExercise[];
  presenceId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkoutExercise {
  id: string;
  name: string;
  sets?: number;
  reps?: number;
  weight?: number;
  duration?: number;
  distance?: number;
  notes?: string;
}
```

### 3. API Service

New API functions were added to `src/services/api.ts`:

- `workoutHistoryApi.getWorkoutHistory(userId, startDate?, endDate?)` - Fetch workout history
- `workoutHistoryApi.getWorkoutHistoryById(id)` - Get a specific workout
- `workoutHistoryApi.createWorkoutHistory(workoutData)` - Manually create workout history
- `workoutHistoryApi.updateWorkoutHistory(id, updates)` - Update workout details
- `workoutHistoryApi.deleteWorkoutHistory(id)` - Delete a workout
- `workoutHistoryApi.getWorkoutHistoryByPresenceId(presenceId)` - Find workout by presence record

### 4. App Context

The `AppContext` was updated to include workout history state and operations:

```typescript
export interface AppContextType {
  // ... existing fields
  workoutHistory: WorkoutHistory[];
  getWorkoutHistory: (userId: string, startDate?: Date, endDate?: Date) => Promise<WorkoutHistory[]>;
  updateWorkoutHistory: (id: string, updates: Partial<WorkoutHistory>) => Promise<void>;
  deleteWorkoutHistory: (id: string) => Promise<void>;
}
```

The checkout function was modified to automatically refresh workout history after checkout:

```typescript
const checkOut = async (gymId: string) => {
  await presenceApi.checkOut(user.id, gymId);
  await refreshWorkoutHistory(); // Automatically fetch new workout history
};
```

### 5. UI Components

#### WorkoutHistoryModal (`src/components/WorkoutHistoryModal.tsx`)

A new modal component that allows users to:
- View workout details (date, time, duration, gym)
- Edit workout title and type
- Add/edit/remove notes
- Add/edit/remove exercises
- Delete the workout

#### CalendarGrid Updates

The `CalendarGrid` component was updated to:
- Display completed workouts with a green border
- Show a checkmark icon on completed workouts
- Support new workout types (climbing, crossfit)
- Handle clicks on completed workouts differently from planned workouts

Visual distinction for completed workouts:
```typescript
completedWorkout: {
  opacity: 0.85,
  borderWidth: 2,
  borderColor: '#28A745', // Green border
}
```

#### ScheduleScreen Updates

The `ScheduleScreen` was updated to:
- Fetch and display workout history from context
- Convert workout history to `WorkoutSession` format for calendar display
- Open the appropriate modal based on workout status (planned vs completed)

```typescript
const historyAsWorkouts = workoutHistory.map(history => ({
  id: history.id,
  startTime: new Date(history.startTime),
  endTime: new Date(history.endTime),
  workoutType: history.workoutType || 'custom',
  title: history.title || 'Completed Workout',
  status: 'completed', // Key difference
  // ... other fields
}));
```

## User Flow

1. **Check-in**: User arrives at gym and checks in (manually or automatically via geofencing)
2. **Workout**: User completes their workout
3. **Check-out**: User leaves gym and checks out (manually or automatically)
4. **History Created**: Database trigger automatically creates a workout history entry with:
   - Start time from check-in
   - End time from checkout
   - Duration calculated automatically
   - Reference to the gym
5. **Calendar Display**: The completed workout appears on the calendar with:
   - Green border indicating completion
   - Checkmark icon
   - Default title "Completed Workout" (can be edited)
6. **View/Edit**: User can click on the completed workout to:
   - Add a custom title
   - Set the workout type
   - Add notes about the workout
   - Log specific exercises performed
   - Delete the workout if needed

## Database Migration

To enable this feature in your database, run the SQL migration script:

```bash
psql -h <host> -U <user> -d <database> -f scripts/add-workout-history-table.sql
```

This will:
- Create the `workout_history` table
- Add necessary indexes
- Set up Row Level Security policies
- Create the automatic trigger for workout history creation
- Enable real-time subscriptions for the table

## Testing

To test the feature:

1. Check in to a gym (manually or via auto check-in)
2. Wait at least 5 minutes (minimum duration for history creation)
3. Check out from the gym
4. Navigate to the Schedule screen
5. You should see a completed workout on the calendar with a green border
6. Click on the completed workout to view/edit details

## Future Enhancements

Potential improvements for this feature:

- Add statistics and analytics based on workout history
- Create workout templates from past workouts
- Share completed workouts with friends
- Add photos to workout history
- Export workout data
- Integration with fitness trackers
- Workout streaks and achievements
- Compare workouts over time
- Automatic workout type detection based on gym category

## Notes

- Workout history entries are automatically created only if the workout duration is at least 5 minutes
- The last 30 days of workout history are loaded by default when the app starts
- Workout history is linked to the presence record via `presence_id` for reference
- Users can manually create, edit, or delete workout history entries as needed

