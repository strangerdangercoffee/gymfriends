-- Add workout notification preferences to notification_preferences table
-- This script adds columns for workout-related notification preferences

ALTER TABLE notification_preferences
ADD COLUMN IF NOT EXISTS workout_invitations BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS workout_responses BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS workout_bails BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS workout_reminders BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS friend_at_gym BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS group_messages BOOLEAN DEFAULT true;

-- Add comments
COMMENT ON COLUMN notification_preferences.workout_invitations IS 'Receive notifications for workout invitations';
COMMENT ON COLUMN notification_preferences.workout_responses IS 'Receive notifications when someone responds to your workout invitation';
COMMENT ON COLUMN notification_preferences.workout_bails IS 'Receive notifications when someone bails from a workout';
COMMENT ON COLUMN notification_preferences.workout_reminders IS 'Receive notifications for workout reminders';
COMMENT ON COLUMN notification_preferences.friend_at_gym IS 'Receive notifications when a friend checks in at a gym';
COMMENT ON COLUMN notification_preferences.group_messages IS 'Receive notifications for new group chat messages';
