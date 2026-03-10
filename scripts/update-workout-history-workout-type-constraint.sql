-- Update workout_history workout_type CHECK constraint to use new workout types
-- Old types: cardio, strength, yoga, running, climbing, crossfit, custom
-- New types: limit, power, endurance, technique, volume, projecting, recovery, cardio

-- Step 1: Drop the existing constraint if it exists
ALTER TABLE workout_history 
DROP CONSTRAINT IF EXISTS workout_history_workout_type_check;

-- Step 2: Add the new constraint with updated workout types
ALTER TABLE workout_history
ADD CONSTRAINT workout_history_workout_type_check 
CHECK (
  workout_type IS NULL OR 
  workout_type = ANY (ARRAY['limit'::text, 'power'::text, 'endurance'::text, 'technique'::text, 'volume'::text, 'projecting'::text, 'recovery'::text, 'cardio'::text])
);

-- Step 3: Add a comment explaining the constraint
COMMENT ON CONSTRAINT workout_history_workout_type_check ON workout_history IS 
  'Ensures workout_type is one of: limit, power, endurance, technique, volume, projecting, recovery, cardio';

-- Step 4: Optional - Update any existing data that uses old workout types
-- This will convert old types to the closest new equivalent
UPDATE workout_history
SET workout_type = CASE
  WHEN workout_type = 'strength' THEN 'limit'  -- Strength training -> Limit (max strength)
  WHEN workout_type = 'yoga' THEN 'recovery'   -- Yoga -> Recovery (mobility, prehab)
  WHEN workout_type = 'running' THEN 'cardio'  -- Running -> Cardio (aerobic endurance)
  WHEN workout_type = 'climbing' THEN 'projecting' -- Climbing -> Projecting (performance)
  WHEN workout_type = 'crossfit' THEN 'power'  -- CrossFit -> Power (dynamic, explosive)
  WHEN workout_type = 'custom' THEN 'volume'   -- Custom -> Volume (general training)
  ELSE workout_type  -- Keep existing if already valid
END
WHERE workout_type IN ('strength', 'yoga', 'running', 'climbing', 'crossfit', 'custom');

-- Step 5: Report on the migration
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM workout_history
  WHERE workout_type IN ('limit', 'power', 'endurance', 'technique', 'volume', 'projecting', 'recovery', 'cardio');
  
  RAISE NOTICE 'Updated workout_history workout_type constraint. % rows now have valid workout types.', updated_count;
END $$;
