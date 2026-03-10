-- Fix infinite recursion in workout_invitation RLS policies
-- This script uses SECURITY DEFINER functions to bypass RLS and break the circular dependency

-- ============================================================================
-- Step 1: Drop existing problematic policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own invitations or invitations they're invited to" ON workout_invitations;
DROP POLICY IF EXISTS "Users can view relevant invitation responses" ON workout_invitation_responses;

-- ============================================================================
-- Step 2: Create helper functions that bypass RLS using SECURITY DEFINER
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
-- Step 3: Recreate policies using the helper functions (no circular dependency)
-- ============================================================================

-- Users can view invitations they created OR invitations they've been invited to
-- Uses helper function to check responses without triggering RLS recursion
CREATE POLICY "Users can view their own invitations or invitations they're invited to"
    ON workout_invitations FOR SELECT
    USING (
        auth.uid() = inviter_id OR
        check_user_has_invitation_response(id, auth.uid())
    );

-- Users can view responses to invitations they created OR their own responses
-- Uses helper function to check invitations without triggering RLS recursion
CREATE POLICY "Users can view relevant invitation responses"
    ON workout_invitation_responses FOR SELECT
    USING (
        auth.uid() = user_id OR
        check_user_created_invitation(invitation_id, auth.uid())
    );

-- ============================================================================
-- Step 4: Grant execute permissions on the helper functions
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
