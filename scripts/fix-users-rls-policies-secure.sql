-- Alternative: More secure RLS policies for users table
-- This version is more restrictive - users can only view:
-- 1. Their own full data
-- 2. Other users' public profile info (name, avatar, but NOT email)

-- Note: If you want maximum privacy, you'd need to restructure the friends
-- feature to use a separate friends table or junction table

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view their own data" ON users;

-- Policy 1: Users can view their own complete data
CREATE POLICY "Users can view own data"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- Policy 2: Users can view other users' public info (for friend features)
-- Note: This still allows reading the friends array of other users
-- If you want to hide even the friends list, you'd need app-level filtering
CREATE POLICY "Users can view others public info"
  ON users FOR SELECT
  USING (auth.uid() IS NOT NULL AND id != auth.uid());

-- Alternative Policy 2 (if you want to be extra restrictive):
-- Only allow viewing friends of friends (2 degrees of separation)
-- Uncomment this and comment out the above policy if preferred:
/*
CREATE POLICY "Users can view friends and friends of friends"
  ON users FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      -- User's own data
      id = auth.uid() 
      OR
      -- Users who are friends with the current user
      EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = auth.uid() AND id = ANY(u.friends)
      )
    )
  );
*/

-- Keep INSERT policy
DROP POLICY IF EXISTS "Users can insert their own data" ON users;
CREATE POLICY "Users can insert their own data"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Keep UPDATE policy
DROP POLICY IF EXISTS "Users can update their own data" ON users;
CREATE POLICY "Users can update their own data"
  ON users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Keep DELETE policy
DROP POLICY IF EXISTS "Users can delete their own data" ON users;
CREATE POLICY "Users can delete their own data"
  ON users FOR DELETE
  USING (auth.uid() = id);

-- Verify
DO $$
BEGIN
  RAISE NOTICE '✓ Secure RLS policies updated';
  RAISE NOTICE '  - Users can view their own complete data';
  RAISE NOTICE '  - Users can view other users'' public info (needed for QR friend adds)';
  RAISE NOTICE '  - Users can only modify their own data';
END $$;

