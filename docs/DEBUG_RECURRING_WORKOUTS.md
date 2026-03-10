# Debugging Recurring Workout Generation

## Issue
Recurring workouts are being created in the `schedules` table but not generating workout instances in `workout_history`.

## Debugging Steps

### 1. Check Console Logs
When you create a recurring workout, look for these console messages:
- `Creating recurring schedule {id}, generating workout history...`
- `Generating history from {startDate} to {endDate}`
- `Successfully generated {count} workout history entries`

### 2. Manual Testing
You can test the generation manually by calling the test function:

```javascript
// In browser console or React Native debugger
import { workoutHistoryGenerator } from './src/services/workoutHistoryGenerator';

// Replace 'your-user-id' with actual user ID
await workoutHistoryGenerator.testWorkoutHistoryGeneration('your-user-id');
```

### 3. Check Database Migration
Ensure the database migration has been run:

```sql
-- Run this in Supabase SQL editor
ALTER TABLE workout_history 
ADD COLUMN schedule_id UUID REFERENCES schedules(id) ON DELETE SET NULL,
ADD COLUMN is_exception BOOLEAN DEFAULT FALSE;
```

### 4. Verify Schedule Data
Check that your recurring schedule has the correct data:

```sql
SELECT id, user_id, is_recurring, recurring_pattern, start_time, end_time, workout_type, title
FROM schedules 
WHERE is_recurring = true 
ORDER BY created_at DESC 
LIMIT 5;
```

### 5. Check Workout History
See if any workout history entries were created:

```sql
SELECT id, user_id, start_time, end_time, workout_type, title, schedule_id, is_exception
FROM workout_history 
WHERE schedule_id IS NOT NULL
ORDER BY start_time DESC 
LIMIT 10;
```

## Common Issues

### Issue 1: Migration Not Run
**Symptoms**: Console error about unknown columns `schedule_id` or `is_exception`
**Solution**: Run the database migration script

### Issue 2: Date Calculation Logic
**Symptoms**: "No workout dates calculated" in console
**Solution**: Check the schedule's `start_time`, `end_time`, and `recurring_pattern`

### Issue 3: Permission Issues
**Symptoms**: Database insert errors
**Solution**: Check RLS policies on `workout_history` table

### Issue 4: Schedule Not Found
**Symptoms**: "Schedule not found" error
**Solution**: Verify the schedule was created successfully

## Expected Behavior

1. **Create recurring workout** → Schedule saved to `schedules` table
2. **Generation triggered** → Console logs show generation process
3. **Instances created** → Multiple entries in `workout_history` table
4. **Calendar shows workouts** → Future dates display workout instances

## Test Data

Create a test recurring workout with these settings:
- **Title**: "Test Recurring Workout"
- **Type**: "Cardio"
- **Recurring**: Yes
- **Pattern**: "Weekly"
- **Start Time**: Tomorrow at 9:00 AM
- **Duration**: 1 hour

This should generate workout instances for the next 90 days.

