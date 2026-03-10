-- Create junction tables for many-to-many relationships
-- This script creates proper junction tables to replace array-based relationships

-- Junction table for user-gym following relationship
CREATE TABLE IF NOT EXISTS user_gym_follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure one follow relationship per user-gym pair
    UNIQUE(user_id, gym_id)
);

-- Junction table for user-gym presence (current users at gym)
CREATE TABLE IF NOT EXISTS user_gym_presence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    checked_out_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    location JSONB, -- Store latitude/longitude if needed
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create a partial unique index to ensure one active presence per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_gym_presence_one_active_per_user 
ON user_gym_presence(user_id) WHERE is_active = true;

-- Junction table for user friendships
CREATE TABLE IF NOT EXISTS user_friendships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    friend_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure unique friendship pairs (no duplicates)
    UNIQUE(user_id, friend_id),
    
    -- Prevent self-friendship
    CHECK (user_id != friend_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_gym_follows_user_id ON user_gym_follows(user_id);
CREATE INDEX IF NOT EXISTS idx_user_gym_follows_gym_id ON user_gym_follows(gym_id);
CREATE INDEX IF NOT EXISTS idx_user_gym_follows_created_at ON user_gym_follows(created_at);

CREATE INDEX IF NOT EXISTS idx_user_gym_presence_user_id ON user_gym_presence(user_id);
CREATE INDEX IF NOT EXISTS idx_user_gym_presence_gym_id ON user_gym_presence(gym_id);
CREATE INDEX IF NOT EXISTS idx_user_gym_presence_is_active ON user_gym_presence(is_active);
CREATE INDEX IF NOT EXISTS idx_user_gym_presence_checked_in_at ON user_gym_presence(checked_in_at);

CREATE INDEX IF NOT EXISTS idx_user_friendships_user_id ON user_friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_user_friendships_friend_id ON user_friendships(friend_id);
CREATE INDEX IF NOT EXISTS idx_user_friendships_created_at ON user_friendships(created_at);

-- Create updated_at trigger for user_gym_presence
CREATE TRIGGER update_user_gym_presence_updated_at 
    BEFORE UPDATE ON user_gym_presence 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions
GRANT ALL ON user_gym_follows TO authenticated;
GRANT ALL ON user_gym_presence TO authenticated;
GRANT ALL ON user_friendships TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE user_gym_follows IS 'Junction table for user-gym following relationships';
COMMENT ON TABLE user_gym_presence IS 'Junction table for user-gym presence/check-in relationships';
COMMENT ON TABLE user_friendships IS 'Junction table for user friendship relationships';

COMMENT ON COLUMN user_gym_follows.user_id IS 'ID of the user who follows the gym';
COMMENT ON COLUMN user_gym_follows.gym_id IS 'ID of the gym being followed';

COMMENT ON COLUMN user_gym_presence.user_id IS 'ID of the user at the gym';
COMMENT ON COLUMN user_gym_presence.gym_id IS 'ID of the gym where user is present';
COMMENT ON COLUMN user_gym_presence.is_active IS 'Whether the user is currently at this gym';
COMMENT ON COLUMN user_gym_presence.location IS 'JSON object with latitude/longitude coordinates';

COMMENT ON COLUMN user_friendships.user_id IS 'ID of the user who has the friend';
COMMENT ON COLUMN user_friendships.friend_id IS 'ID of the friend user';
