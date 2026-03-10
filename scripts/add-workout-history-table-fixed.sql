-- Create workout_history table to store completed workouts from check-ins
CREATE TABLE IF NOT EXISTS workout_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  gym_id UUID REFERENCES gyms(id) ON DELETE SET NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  duration INTEGER NOT NULL, -- Duration in minutes
  workout_type TEXT CHECK (workout_type IN ('cardio', 'strength', 'yoga', 'running', 'climbing', 'crossfit', 'custom')),
  title TEXT,
  notes TEXT,
  exercises JSONB DEFAULT '[]'::jsonb, -- Array of workout exercises
  presence_id UUID REFERENCES presence(id) ON DELETE SET NULL, -- Link to presence record
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_workout_history_user_id ON workout_history(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_history_gym_id ON workout_history(gym_id);
CREATE INDEX IF NOT EXISTS idx_workout_history_start_time ON workout_history(start_time);
CREATE INDEX IF NOT EXISTS idx_workout_history_presence_id ON workout_history(presence_id);

-- Add Row Level Security policies
ALTER TABLE workout_history ENABLE ROW LEVEL SECURITY;

-- Users can view their own workout history
CREATE POLICY "Users can view their own workout history" 
  ON workout_history FOR SELECT 
  USING (auth.uid() = user_id);

-- Users can insert their own workout history (regular inserts from app)
CREATE POLICY "Users can insert their own workout history" 
  ON workout_history FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own workout history
CREATE POLICY "Users can update their own workout history" 
  ON workout_history FOR UPDATE 
  USING (auth.uid() = user_id);

-- Users can delete their own workout history
CREATE POLICY "Users can delete their own workout history" 
  ON workout_history FOR DELETE 
  USING (auth.uid() = user_id);

-- IMPORTANT: Allow service role to insert workout history (for triggers)
-- This policy allows the trigger to insert records when auth.uid() is NULL
CREATE POLICY "Service role can insert workout history" 
  ON workout_history FOR INSERT 
  WITH CHECK (true)
  USING (true);

-- Enable real-time for workout_history table
ALTER PUBLICATION supabase_realtime ADD TABLE workout_history;

-- Create a function to automatically create workout history on checkout
-- SECURITY DEFINER allows the function to bypass RLS when inserting
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
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically create workout history on checkout
DROP TRIGGER IF EXISTS trigger_create_workout_history_on_checkout ON presence;
CREATE TRIGGER trigger_create_workout_history_on_checkout
  AFTER UPDATE ON presence
  FOR EACH ROW
  EXECUTE FUNCTION create_workout_history_on_checkout();

-- Add a trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_workout_history_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_workout_history_updated_at ON workout_history;
CREATE TRIGGER trigger_update_workout_history_updated_at
  BEFORE UPDATE ON workout_history
  FOR EACH ROW
  EXECUTE FUNCTION update_workout_history_updated_at();

