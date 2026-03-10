-- Add friend_at_crag notification preference (yo ___ just rolled up to the crag)
ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS friend_at_crag BOOLEAN DEFAULT true;

COMMENT ON COLUMN notification_preferences.friend_at_crag IS 'Receive notifications when a friend arrives at a climbing area you are at';
