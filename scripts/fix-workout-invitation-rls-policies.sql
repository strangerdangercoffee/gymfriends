-- Fix RLS policies for workout invitation tables
-- This script fixes the infinite recursion issue in the RLS policies

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view their own invitations" ON workout_invitations;
DROP POLICY IF EXISTS "Users can view relevant responses" ON workout_invitation_responses;

-- Create corrected RLS policies
-- Users can see invitations they created
CREATE POLICY "Users can view their own invitations" ON workout_invitations
    FOR SELECT USING (inviter_id = auth.uid());

-- Users can see invitations they were invited to
CREATE POLICY "Users can view invitations they were invited to" ON workout_invitations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 
            FROM workout_invitation_responses 
            WHERE invitation_id = workout_invitations.id 
            AND user_id = auth.uid()
        )
    );

-- Users can view their own responses
CREATE POLICY "Users can view their own responses" ON workout_invitation_responses
    FOR SELECT USING (user_id = auth.uid());

-- Users can view responses for invitations they created
CREATE POLICY "Users can view responses to their invitations" ON workout_invitation_responses
    FOR SELECT USING (
        EXISTS (
            SELECT 1 
            FROM workout_invitations 
            WHERE id = workout_invitation_responses.invitation_id 
            AND inviter_id = auth.uid()
        )
    );
