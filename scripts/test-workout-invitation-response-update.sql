-- Test script to verify RLS policies allow users to update their own responses
-- Run this in Supabase SQL editor to check if the UPDATE policy is working

-- First, check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'workout_invitation_responses';

-- Check existing policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'workout_invitation_responses';

-- Test: Try to see if a user can update their own response
-- Replace 'USER_ID_HERE' with an actual user ID from your database
-- Replace 'INVITATION_ID_HERE' with an actual invitation ID
-- This should work if RLS policies are correct
/*
UPDATE workout_invitation_responses
SET response = 'bailed',
    bailed_at = NOW(),
    updated_at = NOW()
WHERE invitation_id = 'INVITATION_ID_HERE'
  AND user_id = 'USER_ID_HERE'
  AND user_id = auth.uid();
*/

-- Check if there are any responses that might be blocked
SELECT 
    wir.id,
    wir.invitation_id,
    wir.user_id,
    wir.response,
    auth.uid() as current_user_id,
    (auth.uid() = wir.user_id) as can_update
FROM workout_invitation_responses wir
WHERE wir.response = 'accepted'
LIMIT 10;
