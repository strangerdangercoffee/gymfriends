-- Fix infinite recursion in workout_invitation RLS policies
-- This script drops the problematic policies and recreates them with helper functions
-- that bypass RLS to avoid circular dependencies

-- ============================================================================
-- Step 1: Drop existing policies and functions
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own invitations or invitations they're invited to" ON workout_invitations;
DROP POLICY IF EXISTS "Users can view relevant invitation responses" ON workout_invitation_responses;
DROP FUNCTION IF EXISTS check_user_has_invitation_response(UUID, UUID);
DROP FUNCTION IF EXISTS check_user_created_invitation(UUID, UUID);

-- ============================================================================
-- Step 2: Create helper functions that bypass RLS
-- ============================================================================

-- Function to check if a user has a response to an invitation
-- Uses SECURITY DEFINER to bypass RLS and avoid recursion
CREATE OR REPLACE FUNCTION check_user_has_invitation_response(invitation_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
    -- Bypass RLS for this query to avoid infinite recursion
    PERFORM set_config('row_security', 'off', true);
    RETURN EXISTS (
        SELECT 1 
        FROM workout_invitation_responses 
        WHERE invitation_id = invitation_uuid 
        AND user_id = user_uuid
    );
END;
$$;

-- Function to check if a user created an invitation
-- Uses SECURITY DEFINER to bypass RLS and avoid recursion
CREATE OR REPLACE FUNCTION check_user_created_invitation(invitation_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
    -- Bypass RLS for this query to avoid infinite recursion
    PERFORM set_config('row_security', 'off', true);
    RETURN EXISTS (
        SELECT 1 
        FROM workout_invitations 
        WHERE id = invitation_uuid 
        AND inviter_id = user_uuid
    );
END;
$$;

-- ============================================================================
-- Step 3: Recreate policies using the helper functions
-- ============================================================================

-- Users can view invitations they created OR invitations they've been invited to
CREATE POLICY "Users can view their own invitations or invitations they're invited to"
    ON workout_invitations FOR SELECT
    USING (
        auth.uid() = inviter_id OR
        check_user_has_invitation_response(id, auth.uid())
    );

-- Users can view responses to invitations they created OR their own responses
CREATE POLICY "Users can view relevant invitation responses"
    ON workout_invitation_responses FOR SELECT
    USING (
        auth.uid() = user_id OR
        check_user_created_invitation(invitation_id, auth.uid())
    );

-- ============================================================================
-- Grant execute permissions on the functions
-- ============================================================================

GRANT EXECUTE ON FUNCTION check_user_has_invitation_response(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_user_created_invitation(UUID, UUID) TO authenticated;
