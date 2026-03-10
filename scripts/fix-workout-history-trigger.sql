-- Fix for workout history trigger not executing
-- This script updates the existing setup to allow the trigger to work properly

-- Drop and recreate the function with SECURITY DEFINER
-- This allows the function to bypass RLS policies
DROP FUNCTION IF EXISTS create_workout_history_on_checkout() CASCADE;

CREATE OR REPLACE FUNCTION create_workout_history_on_checkout()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  duration_minutes INTEGER;
BEGIN
  -- Only create workout history when checking out (is_active changes from true to false)
  IF OLD.is_active = TRUE AND NEW.is_active = FALSE AND NEW.checked_out_at IS NOT NULL THEN
    -- Calculate duration in minutes
    duration_minutes := EXTRACT(EPOCH FROM (NEW.checked_out_at - NEW.checked_in_at)) / 60;
    
    -- Only create history if duration is at least 5 minutes
    IF duration_minutes >= 5 THEN
      -- Use INSERT with explicit security context bypass
      INSERT INTO workout_history (
        user_id,
        gym_id,
        start_time,
        end_time,
        duration,
        presence_id
      ) VALUES (
        NEW.user_id,
        NEW.gym_id,
        NEW.checked_in_at,
        NEW.checked_out_at,
        duration_minutes,
        NEW.id
      );
      
      RAISE NOTICE 'Created workout history for user % at gym % (duration: % minutes)', 
        NEW.user_id, NEW.gym_id, duration_minutes;
    ELSE
      RAISE NOTICE 'Skipped workout history creation: duration too short (% minutes)', duration_minutes;
    END IF;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the checkout
    RAISE WARNING 'Error creating workout history: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trigger_create_workout_history_on_checkout ON presence;
CREATE TRIGGER trigger_create_workout_history_on_checkout
  AFTER UPDATE ON presence
  FOR EACH ROW
  EXECUTE FUNCTION create_workout_history_on_checkout();

-- Verify the trigger was created
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM pg_trigger 
    WHERE tgname = 'trigger_create_workout_history_on_checkout'
  ) THEN
    RAISE NOTICE '✓ Trigger successfully created';
  ELSE
    RAISE WARNING '✗ Trigger creation failed';
  END IF;
END $$;

