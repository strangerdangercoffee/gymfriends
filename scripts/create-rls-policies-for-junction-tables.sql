-- Create RLS policies for junction tables and workout invitation tables
-- This script enables Row Level Security and creates policies for:
-- user_friendships, user_gym_follows, user_gym_presence, workout_invitations, workout_invitation_responses

-- ============================================================================
-- 1. USER_FRIENDSHIPS
-- ============================================================================

ALTER TABLE user_friendships ENABLE ROW LEVEL SECURITY;

-- Users can view their own friendships (where they are user_id or friend_id)
CREATE POLICY "Users can view their own friendships"
    ON user_friendships FOR SELECT
    USING (
        auth.uid() = user_id OR 
        auth.uid() = friend_id
    );

-- Users can create friendships where they are the user_id (initiator)
CREATE POLICY "Users can create friendships"
    ON user_friendships FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update friendships where they are the user_id
CREATE POLICY "Users can update their own friendships"
    ON user_friendships FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete friendships where they are the user_id
CREATE POLICY "Users can delete their own friendships"
    ON user_friendships FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- 2. USER_GYM_FOLLOWS
-- ============================================================================

ALTER TABLE user_gym_follows ENABLE ROW LEVEL SECURITY;

-- Users can view all gym follows (for discovery and seeing who follows what)
CREATE POLICY "Users can view all gym follows"
    ON user_gym_follows FOR SELECT
    USING (true);

-- Users can create follows for themselves
CREATE POLICY "Users can create their own gym follows"
    ON user_gym_follows FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own follows
CREATE POLICY "Users can update their own gym follows"
    ON user_gym_follows FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own follows
CREATE POLICY "Users can delete their own gym follows"
    ON user_gym_follows FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- 3. USER_GYM_PRESENCE
-- ============================================================================

ALTER TABLE user_gym_presence ENABLE ROW LEVEL SECURITY;

-- Users can view all presence (to see who's at gyms)
CREATE POLICY "Users can view all gym presence"
    ON user_gym_presence FOR SELECT
    USING (true);

-- Users can create presence for themselves
CREATE POLICY "Users can create their own gym presence"
    ON user_gym_presence FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own presence
CREATE POLICY "Users can update their own gym presence"
    ON user_gym_presence FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own presence
CREATE POLICY "Users can delete their own gym presence"
    ON user_gym_presence FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- 4. WORKOUT_INVITATIONS
-- ============================================================================

ALTER TABLE workout_invitations ENABLE ROW LEVEL SECURITY;

-- Users can view invitations they created OR invitations they've been invited to
-- We use a security definer function to check responses without triggering RLS recursion
CREATE OR REPLACE FUNCTION check_user_has_invitation_response(invitation_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM workout_invitation_responses 
        WHERE invitation_id = invitation_uuid 
        AND user_id = user_uuid
    );
$$;

CREATE POLICY "Users can view their own invitations or invitations they're invited to"
    ON workout_invitations FOR SELECT
    USING (
        auth.uid() = inviter_id OR
        check_user_has_invitation_response(id, auth.uid())
    );

-- Users can create invitations where they are the inviter
CREATE POLICY "Users can create workout invitations"
    ON workout_invitations FOR INSERT
    WITH CHECK (auth.uid() = inviter_id);

-- Users can update invitations they created
CREATE POLICY "Users can update their own workout invitations"
    ON workout_invitations FOR UPDATE
    USING (auth.uid() = inviter_id)
    WITH CHECK (auth.uid() = inviter_id);

-- Users can delete invitations they created
CREATE POLICY "Users can delete their own workout invitations"
    ON workout_invitations FOR DELETE
    USING (auth.uid() = inviter_id);

-- ============================================================================
-- 5. WORKOUT_INVITATION_RESPONSES
-- ============================================================================

ALTER TABLE workout_invitation_responses ENABLE ROW LEVEL SECURITY;

-- Users can view responses to invitations they created OR their own responses
-- We use a security definer function to check invitations without triggering RLS recursion
CREATE OR REPLACE FUNCTION check_user_created_invitation(invitation_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM workout_invitations 
        WHERE id = invitation_uuid 
        AND inviter_id = user_uuid
    );
$$;

CREATE POLICY "Users can view relevant invitation responses"
    ON workout_invitation_responses FOR SELECT
    USING (
        auth.uid() = user_id OR
        check_user_created_invitation(invitation_id, auth.uid())
    );

-- Users can create responses for themselves
CREATE POLICY "Users can create their own invitation responses"
    ON workout_invitation_responses FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own responses
CREATE POLICY "Users can update their own invitation responses"
    ON workout_invitation_responses FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own responses
CREATE POLICY "Users can delete their own invitation responses"
    ON workout_invitation_responses FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON POLICY "Users can view their own friendships" ON user_friendships IS 
    'Allows users to see friendships where they are either the user_id or friend_id';

COMMENT ON POLICY "Users can view all gym follows" ON user_gym_follows IS 
    'Allows all users to see who follows which gyms (for discovery)';

COMMENT ON POLICY "Users can view all gym presence" ON user_gym_presence IS 
    'Allows all users to see who is currently at which gyms';

COMMENT ON POLICY "Users can view their own invitations or invitations they're invited to" ON workout_invitations IS 
    'Allows users to see invitations they created or invitations they have responded to';

COMMENT ON POLICY "Users can view relevant invitation responses" ON workout_invitation_responses IS 
    'Allows users to see their own responses or responses to invitations they created';

-- ============================================================================
-- GRANT PERMISSIONS ON HELPER FUNCTIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION check_user_has_invitation_response(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_user_created_invitation(UUID, UUID) TO authenticated;
