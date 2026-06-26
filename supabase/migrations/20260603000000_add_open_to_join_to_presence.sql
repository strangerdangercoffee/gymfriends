-- Add open_to_join flag to user_gym_presence
-- Defaults to true so existing rows behave as "open to join"
ALTER TABLE user_gym_presence
  ADD COLUMN IF NOT EXISTS open_to_join boolean NOT NULL DEFAULT true;
