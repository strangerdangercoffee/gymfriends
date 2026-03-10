-- Add notification preference for "Tell the homies" (friend trip announcements)

ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS friend_trip_announcements BOOLEAN DEFAULT true;

COMMENT ON COLUMN notification_preferences.friend_trip_announcements IS 'Receive notifications when a friend shares a trip plan (Tell the homies)';
