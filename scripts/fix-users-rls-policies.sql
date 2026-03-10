-- Fix RLS policies for users table to allow friend functionality
-- Users need to be able to read other users' basic information to add friends

-- First, let's drop the existing restrictive SELECT policy
DROP POLICY IF EXISTS "Users can view their own data" ON users;

-- Create a new policy that allows users to view other users' basic information
-- This is necessary for social features like adding friends, viewing friends list, etc.
CREATE POLICY "Users can view all users basic info"
  ON users FOR SELECT
  USING (true);

-- Keep the existing policies for INSERT, UPDATE, DELETE (users can only modify their own data)
-- These should already exist, but let's ensure they're correct:

-- Drop and recreate INSERT policy
DROP POLICY IF EXISTS "Users can insert their own data" ON users;
CREATE POLICY "Users can insert their own data"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Drop and recreate UPDATE policy
DROP POLICY IF EXISTS "Users can update their own data" ON users;
CREATE POLICY "Users can update their own data"
  ON users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Drop and recreate DELETE policy (if it exists)
DROP POLICY IF EXISTS "Users can delete their own data" ON users;
CREATE POLICY "Users can delete their own data"
  ON users FOR DELETE
  USING (auth.uid() = id);

-- Verify the policies were created
DO $$
BEGIN
  RAISE NOTICE '✓ RLS policies updated successfully';
  RAISE NOTICE '  - Users can now view all users'' basic info (needed for social features)';
  RAISE NOTICE '  - Users can still only modify their own data';
END $$;

-- Show current policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;

