-- Migrate old workout types in schedules table to new workout types
-- This ensures that when workout history is generated, it uses valid workout types

-- Step 1: Update schedules table with old workout types to new equivalents
UPDATE schedules
SET workout_type = CASE
  WHEN workout_type = 'strength' THEN 'limit'  -- Strength training -> Limit (max strength)
  WHEN workout_type = 'yoga' THEN 'recovery'   -- Yoga -> Recovery (mobility, prehab)
  WHEN workout_type = 'running' THEN 'cardio'  -- Running -> Cardio (aerobic endurance)
  WHEN workout_type = 'climbing' THEN 'projecting' -- Climbing -> Projecting (performance)
  WHEN workout_type = 'crossfit' THEN 'power'  -- CrossFit -> Power (dynamic, explosive)
  WHEN workout_type = 'custom' THEN 'volume'   -- Custom -> Volume (general training)
  ELSE workout_type  -- Keep existing if already valid or NULL
END
WHERE workout_type IN ('strength', 'yoga', 'running', 'climbing', 'crossfit', 'custom');

-- Step 2: Report on the migration
DO $$
DECLARE
  updated_count INTEGER;
  valid_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM schedules
  WHERE workout_type IN ('limit', 'power', 'endurance', 'technique', 'volume', 'projecting', 'recovery', 'cardio');
  
  SELECT COUNT(*) INTO valid_count
  FROM schedules
  WHERE workout_type IS NULL OR workout_type IN ('limit', 'power', 'endurance', 'technique', 'volume', 'projecting', 'recovery', 'cardio');
  
  RAISE NOTICE 'Migrated schedules workout types. % schedules now have valid workout types out of % total schedules.', updated_count, valid_count;
END $$;

-- Step 3: Add a comment for documentation
COMMENT ON COLUMN schedules.workout_type IS 
  'Workout type: limit, power, endurance, technique, volume, projecting, recovery, cardio, or NULL';
