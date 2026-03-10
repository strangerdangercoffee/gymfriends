-- Create Notification Preferences Table
-- This script creates the table for storing user notification preferences

CREATE TABLE IF NOT EXISTS notification_preferences (
  preference_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  
  -- Belayer/climbing partner notifications
  belayer_requests BOOLEAN DEFAULT true,
  belayer_responses BOOLEAN DEFAULT true,
  matching_partners BOOLEAN DEFAULT true,
  group_belayer_alerts BOOLEAN DEFAULT true, -- For group chat belayer requests
  
  -- Feed notifications
  feed_responses BOOLEAN DEFAULT true,
  feed_mentions BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);

-- Trigger for updated_at
CREATE TRIGGER update_notification_preferences_updated_at
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users can view their own preferences
CREATE POLICY "Users can view their own notification preferences"
    ON notification_preferences FOR SELECT
    USING (auth.uid() = user_id);

-- Users can manage their own preferences
CREATE POLICY "Users can manage their own notification preferences"
    ON notification_preferences FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE notification_preferences IS 'User preferences for push notifications related to belayer/climbing partner features';
COMMENT ON COLUMN notification_preferences.group_belayer_alerts IS 'Whether to receive notifications for belayer requests in group chats';
