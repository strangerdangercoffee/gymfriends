-- Script to fix schedules missing workout history entries
-- This will create workout history entries for schedules that don't have any

-- For non-recurring schedules without workout history
INSERT INTO workout_history (
  user_id,
  gym_id,
  start_time,
  end_time,
  duration,
  workout_type,
  title,
  notes,
  status,
  schedule_id,
  is_exception,
  created_at,
  updated_at
)
SELECT 
  s.user_id,
  s.gym_id,
  s.start_time,
  s.end_time,
  EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 60 as duration, -- Duration in minutes
  s.workout_type,
  COALESCE(s.title, s.workout_type, 'Workout') as title,
  s.notes,
  'planned' as status,
  s.id as schedule_id,
  false as is_exception,
  NOW() as created_at,
  NOW() as updated_at
FROM schedules s
WHERE s.is_recurring = false
  AND NOT EXISTS (
    SELECT 1 
    FROM workout_history wh 
    WHERE wh.schedule_id = s.id
  );

-- Report what was created
DO $$
DECLARE
  created_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO created_count
  FROM workout_history
  WHERE schedule_id IN (
    SELECT id FROM schedules WHERE is_recurring = false
  )
  AND created_at >= NOW() - INTERVAL '1 minute';
  
  RAISE NOTICE 'Created % workout history entries for non-recurring schedules', created_count;
END $$;

-- Note: For recurring schedules, you would need to use the workoutHistoryGenerator
-- service function, not SQL, as it has complex date calculation logic