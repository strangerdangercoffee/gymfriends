-- Fix RLS policies for users table to allow new user signup
-- This ensures users can insert their own record during signup

-- Enable RLS if not already enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop any existing INSERT policies to avoid conflicts
DROP POLICY IF EXISTS "Users can insert their own data" ON users;

-- Create INSERT policy that allows users to insert their own record
-- This is critical for signup - the user must be able to insert with their own auth.uid()
-- The policy checks that:
-- 1. The user is authenticated (auth.uid() IS NOT NULL)
-- 2. The id being inserted matches the authenticated user's ID
-- Note: If this still fails, use the create_user_profile() function which bypasses RLS
CREATE POLICY "Users can insert their own data"
  ON users FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND 
    auth.uid() = id
  );

-- Alternative: More permissive policy that allows inserts if the ID matches any authenticated user
-- This can help with timing issues during signup
-- Uncomment if the above policy still causes issues:
/*
DROP POLICY IF EXISTS "Users can insert their own data" ON users;
CREATE POLICY "Users can insert their own data"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = id);
*/

-- Ensure SELECT policy exists (needed for reading the inserted data)
DROP POLICY IF EXISTS "Users can view their own data" ON users;
DROP POLICY IF EXISTS "Users can view all users basic info" ON users;
DROP POLICY IF EXISTS "Users can view own data" ON users;
DROP POLICY IF EXISTS "Users can view others public info" ON users;

-- Create a SELECT policy that allows users to view their own data
-- and also allows viewing other users for social features
CREATE POLICY "Users can view all users basic info"
  ON users FOR SELECT
  USING (true);

-- Ensure UPDATE policy exists
DROP POLICY IF EXISTS "Users can update their own data" ON users;
CREATE POLICY "Users can update their own data"
  ON users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Ensure DELETE policy exists
DROP POLICY IF EXISTS "Users can delete their own data" ON users;
CREATE POLICY "Users can delete their own data"
  ON users FOR DELETE
  USING (auth.uid() = id);

-- Verify the policies
DO $$
BEGIN
  RAISE NOTICE '✓ RLS policies for users table:';
  RAISE NOTICE '  - INSERT: Users can insert their own data (auth.uid() = id)';
  RAISE NOTICE '  - SELECT: Users can view all users basic info';
  RAISE NOTICE '  - UPDATE: Users can update their own data';
  RAISE NOTICE '  - DELETE: Users can delete their own data';
END $$;

-- Show current policies for verification
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'users'
ORDER BY cmd, policyname;
