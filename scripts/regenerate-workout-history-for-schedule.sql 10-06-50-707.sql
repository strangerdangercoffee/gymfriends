-- Regenerate workout history for a specific schedule
-- This script can be used to fix missing workout history entries

-- First, let's check the schedule details
SELECT 
    id,
    user_id,
    title,
    start_time,
    end_time,
    is_recurring,
    recurring_pattern,
    status,
    created_at
FROM schedules
WHERE id = '1449a8b1-ccb8-4198-93d6-310341a13d7b';

-- Check existing workout history for this schedule
SELECT 
    id,
    user_id,
    start_time,
    end_time,
    status,
    schedule_id
FROM workout_history
WHERE schedule_id = '1449a8b1-ccb8-4198-93d6-310341a13d7b'
ORDER BY start_time;

-- Note: The actual regeneration should be done via the app's workoutHistoryGenerator
-- This script is just for inspection. To regenerate, the app should call:
-- workoutHistoryGenerator.generateWorkoutHistoryFromSchedule(scheduleId, startDate, endDate)
