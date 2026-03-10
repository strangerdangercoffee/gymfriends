-- Add RLS policies for workout_invitations and workout_invitation_responses
-- This script only creates the helper functions and workout invitation policies
-- It does not touch other tables or policies

-- ============================================================================
-- Step 1: Create helper functions that bypass RLS to prevent infinite recursion
-- ============================================================================

-- Function to check if a user has a response to an invitation
-- SECURITY DEFINER allows this to bypass RLS on workout_invitation_responses
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

-- Function to check if a user created an invitation
-- SECURITY DEFINER allows this to bypass RLS on workout_invitations
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

-- ============================================================================
-- Step 2: Enable RLS on workout invitation tables (if not already enabled)
-- ============================================================================

ALTER TABLE workout_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_invitation_responses ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Step 3: Drop existing policies if they exist (to avoid conflicts)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own invitations or invitations they're invited to" ON workout_invitations;
DROP POLICY IF EXISTS "Users can create workout invitations" ON workout_invitations;
DROP POLICY IF EXISTS "Users can update their own workout invitations" ON workout_invitations;
DROP POLICY IF EXISTS "Users can delete their own workout invitations" ON workout_invitations;

DROP POLICY IF EXISTS "Users can view relevant invitation responses" ON workout_invitation_responses;
DROP POLICY IF EXISTS "Users can create their own invitation responses" ON workout_invitation_responses;
DROP POLICY IF EXISTS "Users can update their own invitation responses" ON workout_invitation_responses;
DROP POLICY IF EXISTS "Users can delete their own invitation responses" ON workout_invitation_responses;

-- ============================================================================
-- Step 4: Create workout_invitations policies
-- ============================================================================

-- Users can view invitations they created OR invitations they've been invited to
-- Uses helper function to check responses without triggering RLS recursion
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
-- Step 5: Create workout_invitation_responses policies
-- ============================================================================

-- Users can view responses to invitations they created OR their own responses
-- Uses helper function to check invitations without triggering RLS recursion
CREATE POLICY "Users can view relevant invitation responses"
    ON workout_invitation_responses FOR SELECT
    USING (
        auth.uid() = user_id OR
        check_user_created_invitation(invitation_id, auth.uid())
    );

-- Users can create responses for themselves OR for invitations they created
-- (inviters need to create initial response records for invited users)
CREATE POLICY "Users can create their own invitation responses"
    ON workout_invitation_responses FOR INSERT
    WITH CHECK (
        auth.uid() = user_id OR
        check_user_created_invitation(invitation_id, auth.uid())
    );

-- Users can update their own responses
-- USING clause: checks if user can see/access the row to update it
-- WITH CHECK clause: validates the new values after update
CREATE POLICY "Users can update their own invitation responses"
    ON workout_invitation_responses FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own responses
CREATE POLICY "Users can delete their own invitation responses"
    ON workout_invitation_responses FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- Step 6: Grant execute permissions on the helper functions
-- ============================================================================

GRANT EXECUTE ON FUNCTION check_user_has_invitation_response(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_user_created_invitation(UUID, UUID) TO authenticated;

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON FUNCTION check_user_has_invitation_response(UUID, UUID) IS 
    'Helper function to check if a user has responded to an invitation. Uses SECURITY DEFINER to bypass RLS and prevent infinite recursion.';

COMMENT ON FUNCTION check_user_created_invitation(UUID, UUID) IS 
    'Helper function to check if a user created an invitation. Uses SECURITY DEFINER to bypass RLS and prevent infinite recursion.';

COMMENT ON POLICY "Users can view their own invitations or invitations they're invited to" ON workout_invitations IS 
    'Allows users to see invitations they created or invitations they have responded to';

COMMENT ON POLICY "Users can view relevant invitation responses" ON workout_invitation_responses IS 
    'Allows users to see their own responses or responses to invitations they created';
