-- Temporarily disable RLS on workout invitation tables
-- This allows the app to work while we figure out the proper RLS policies

-- Drop all existing policies first
DROP POLICY IF EXISTS "Users can view their own invitations" ON workout_invitations;
DROP POLICY IF EXISTS "Users can view invitations they were invited to" ON workout_invitations;
DROP POLICY IF EXISTS "Users can create invitations" ON workout_invitations;
DROP POLICY IF EXISTS "Users can update their own invitations" ON workout_invitations;
DROP POLICY IF EXISTS "Users can delete their own invitations" ON workout_invitations;

DROP POLICY IF EXISTS "Users can view their own responses" ON workout_invitation_responses;
DROP POLICY IF EXISTS "Users can view responses to their invitations" ON workout_invitation_responses;
DROP POLICY IF EXISTS "Users can create their own responses" ON workout_invitation_responses;
DROP POLICY IF EXISTS "Users can update their own responses" ON workout_invitation_responses;
DROP POLICY IF EXISTS "Users can delete their own responses" ON workout_invitation_responses;

-- Disable RLS temporarily
ALTER TABLE workout_invitations DISABLE ROW LEVEL SECURITY;
ALTER TABLE workout_invitation_responses DISABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT ALL ON workout_invitations TO authenticated;
GRANT ALL ON workout_invitation_responses TO authenticated;
