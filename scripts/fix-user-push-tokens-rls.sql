-- Ensure RLS allows authenticated users to insert/update/delete their own push tokens.
-- Run this in Supabase SQL Editor if you see: new row violates row-level security policy for table "user_push_tokens"

-- Drop existing policy if it exists (avoids duplicate policy errors)
DROP POLICY IF EXISTS "Users can manage their own push tokens" ON user_push_tokens;

-- Recreate: users can do everything on rows where they are the owner
CREATE POLICY "Users can manage their own push tokens"
  ON user_push_tokens
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
