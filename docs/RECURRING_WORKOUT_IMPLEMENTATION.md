# Recurring Workout Implementation

## Overview
This implementation provides a rolling horizon system for recurring workouts where:
- **schedules** table stores recurring workout rules/templates
- **workout_history** table stores individual workout instances (what you see on calendar)
- System automatically generates workout instances from recurring patterns

## Database Schema Changes

### workout_history table additions:
```sql
ALTER TABLE workout_history 
ADD COLUMN schedule_id UUID REFERENCES schedules(id) ON DELETE SET NULL,
ADD COLUMN is_exception BOOLEAN DEFAULT FALSE;
```

## Core Components

### 1. WorkoutHistoryGenerator Service (`src/services/workoutHistoryGenerator.ts`)
- `generateWorkoutHistoryFromSchedule()` - Creates workout instances from a schedule
- `ensureHistoryGenerated()` - Ensures 90-day horizon of future workouts
- `regenerateScheduleHistory()` - Updates workout instances when schedule changes
- `deleteFutureWorkoutHistory()` - Removes future instances when schedule deleted

### 2. Updated API Functions (`src/services/api.ts`)
- `createSchedule()` - Now triggers workout history generation for recurring schedules
- `updateSchedule()` - Regenerates workout history when recurring schedule changes
- `deleteSchedule()` - Removes future workout history instances

### 3. Enhanced AppContext (`src/context/AppContext.tsx`)
- `refreshWorkoutHistory()` - Now ensures history generation before fetching
- Maintains 90-day horizon of future workouts automatically

### 4. Updated ScheduleScreen (`src/screens/ScheduleScreen.tsx`)
- Now displays workout_history entries instead of schedules directly
- Planned workouts = future workout_history entries
- Completed workouts = past workout_history entries with status='completed'
- Proper handling of recurring vs standalone workouts

## Data Flow

### Creating Recurring Workout:
1. User creates schedule with `isRecurring: true`
2. `createSchedule()` saves to schedules table
3. `generateWorkoutHistoryFromSchedule()` creates individual instances in workout_history
4. Calendar displays workout_history entries

### Viewing Calendar:
1. `refreshWorkoutHistory()` called
2. `ensureHistoryGenerated()` ensures 90-day horizon exists
3. Calendar queries workout_history (not schedules)
4. Displays both planned and completed workouts

### Editing Workout:
1. User edits workout_history entry
2. Sets `isException: true` to mark as modified from pattern
3. Original recurring schedule remains intact
4. Modified instance persists as exception

### Deleting Workout:
- **Single workout**: Deletes workout_history entry only
- **All future workouts**: Deletes entire recurring schedule + future instances
- **Entire series**: Deletes schedule + all associated workout_history

## Key Benefits

1. **Performance**: Calendar only queries workout_history (individual instances)
2. **Flexibility**: Can modify individual instances without affecting recurring pattern
3. **Consistency**: 90-day rolling horizon ensures future workouts always available
4. **Scalability**: Handles complex recurring patterns efficiently

## Migration Steps

1. Run database migration: `scripts/update-workout-history-recurring.sql`
2. Deploy new code with workout history generator
3. Existing schedules will generate workout_history entries on first access
4. Calendar will automatically start showing recurring workouts

## Future Enhancements

- Custom recurring patterns (e.g., "every 3 days")
- Bulk workout modifications
- Schedule templates
- Advanced exception handling

