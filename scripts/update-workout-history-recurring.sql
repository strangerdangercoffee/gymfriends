-- Add recurring workout support to workout_history table
-- This enables the rolling horizon pattern for recurring workouts

-- Add new columns
ALTER TABLE workout_history 
ADD COLUMN schedule_id UUID REFERENCES schedules(id) ON DELETE SET NULL,
ADD COLUMN is_exception BOOLEAN DEFAULT FALSE,
ADD COLUMN status TEXT DEFAULT 'completed' CHECK (status IN ('planned', 'completed', 'cancelled'));

-- Add indexes for performance
CREATE INDEX idx_workout_history_schedule_id ON workout_history(schedule_id);
CREATE INDEX idx_workout_history_date_schedule ON workout_history(start_time, schedule_id);
CREATE INDEX idx_workout_history_status ON workout_history(status);

-- Add comments for documentation
COMMENT ON COLUMN workout_history.schedule_id IS 'References the recurring schedule that generated this workout instance. NULL for standalone workouts.';
COMMENT ON COLUMN workout_history.is_exception IS 'TRUE if this workout instance was modified from its original recurring pattern.';
COMMENT ON COLUMN workout_history.status IS 'Workout status: planned (scheduled), completed (done), cancelled (cancelled).';

-- Update RLS policies to allow schedule_id access
-- (assuming existing policies need to be updated)
