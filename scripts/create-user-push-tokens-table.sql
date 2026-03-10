-- Create User Push Tokens Table
-- This script creates the table for storing user push notification tokens

CREATE TABLE IF NOT EXISTS user_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL,
  device_id TEXT, -- Optional: to identify devices
  platform TEXT CHECK (platform IN ('ios', 'android', 'web')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- One token per user per device (or just one per user if you prefer)
  UNIQUE(user_id, expo_push_token)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user_id ON user_push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_token ON user_push_tokens(expo_push_token);

-- Trigger for updated_at
CREATE TRIGGER update_user_push_tokens_updated_at
    BEFORE UPDATE ON user_push_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE user_push_tokens ENABLE ROW LEVEL SECURITY;

-- Users can manage their own push tokens
CREATE POLICY "Users can manage their own push tokens"
  ON user_push_tokens FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Comments
COMMENT ON TABLE user_push_tokens IS 'Stores Expo push notification tokens for users';
COMMENT ON COLUMN user_push_tokens.expo_push_token IS 'Expo push notification token for the device';
COMMENT ON COLUMN user_push_tokens.platform IS 'Platform of the device (ios, android, web)';
