-- Create workout invitation tables
-- This script creates the tables needed for the workout invitation system

-- Main workout invitations table
CREATE TABLE IF NOT EXISTS workout_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inviter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    is_recurring BOOLEAN NOT NULL DEFAULT false,
    recurring_pattern VARCHAR(20) CHECK (recurring_pattern IN ('daily', 'weekly', 'monthly')),
    workout_type VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'completed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Workout invitation responses table
CREATE TABLE IF NOT EXISTS workout_invitation_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invitation_id UUID NOT NULL REFERENCES workout_invitations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    response VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (response IN ('pending', 'accepted', 'declined', 'bailed')),
    bailed_at TIMESTAMPTZ,
    bail_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure one response per user per invitation
    UNIQUE(invitation_id, user_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_workout_invitations_inviter_id ON workout_invitations(inviter_id);
CREATE INDEX IF NOT EXISTS idx_workout_invitations_schedule_id ON workout_invitations(schedule_id);
CREATE INDEX IF NOT EXISTS idx_workout_invitations_gym_id ON workout_invitations(gym_id);
CREATE INDEX IF NOT EXISTS idx_workout_invitations_status ON workout_invitations(status);
CREATE INDEX IF NOT EXISTS idx_workout_invitations_start_time ON workout_invitations(start_time);

CREATE INDEX IF NOT EXISTS idx_workout_invitation_responses_invitation_id ON workout_invitation_responses(invitation_id);
CREATE INDEX IF NOT EXISTS idx_workout_invitation_responses_user_id ON workout_invitation_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_invitation_responses_response ON workout_invitation_responses(response);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_workout_invitations_updated_at 
    BEFORE UPDATE ON workout_invitations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workout_invitation_responses_updated_at 
    BEFORE UPDATE ON workout_invitation_responses 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Note: RLS is disabled by default to avoid circular dependency issues
-- You can enable RLS later with proper policies if needed
-- ALTER TABLE workout_invitations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE workout_invitation_responses ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions (adjust based on your Supabase setup)
GRANT ALL ON workout_invitations TO authenticated;
GRANT ALL ON workout_invitation_responses TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE workout_invitations IS 'Stores workout invitations sent by users to their friends';
COMMENT ON TABLE workout_invitation_responses IS 'Stores individual user responses to workout invitations';

COMMENT ON COLUMN workout_invitations.inviter_id IS 'ID of the user who created the invitation';
COMMENT ON COLUMN workout_invitations.schedule_id IS 'ID of the schedule this invitation is based on';
COMMENT ON COLUMN workout_invitations.is_recurring IS 'Whether this invitation is for a recurring workout';
COMMENT ON COLUMN workout_invitations.status IS 'Current status of the invitation (active, cancelled, completed)';

COMMENT ON COLUMN workout_invitation_responses.response IS 'User response to the invitation (pending, accepted, declined, bailed)';
COMMENT ON COLUMN workout_invitation_responses.bailed_at IS 'Timestamp when user bailed from the workout';
COMMENT ON COLUMN workout_invitation_responses.bail_reason IS 'Optional reason provided when bailing from workout';
