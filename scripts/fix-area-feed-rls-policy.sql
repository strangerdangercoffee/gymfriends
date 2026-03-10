-- Fix Area Feed RLS Policy
-- This script updates the RLS policy to be less restrictive for viewing posts
-- The issue is that the original policy might be too complex or have issues with the EXISTS subqueries

-- Drop the existing SELECT policy
DROP POLICY IF EXISTS "Users can view area feed posts" ON area_feed_posts;

-- Create a simpler, more permissive SELECT policy
-- Users can view posts for:
-- 1. Gyms they follow (via user_gym_follows) - PRIMARY ACCESS METHOD
-- 2. Gyms they're currently at (via user_gym_presence)
-- 3. Any crag (public)
-- Note: Using a simpler approach that should work better with Supabase RLS
CREATE POLICY "Users can view area feed posts"
    ON area_feed_posts FOR SELECT
    TO authenticated
    USING (
      deleted_at IS NULL AND
      quarantined = false AND
      (
        -- Can view posts for gyms they follow (most common case)
        (gym_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM user_gym_follows
          WHERE user_gym_follows.gym_id = area_feed_posts.gym_id
          AND user_gym_follows.user_id = auth.uid()
        )) OR
        -- Can view posts for gyms they're currently at
        (gym_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM user_gym_presence
          WHERE user_gym_presence.gym_id = area_feed_posts.gym_id
          AND user_gym_presence.user_id = auth.uid()
          AND user_gym_presence.is_active = true
        )) OR
        -- Can view posts for any crag (public)
        (crag_name IS NOT NULL)
      )
    );

COMMENT ON POLICY "Users can view area feed posts" ON area_feed_posts IS 
'Allows authenticated users to view non-quarantined, non-deleted posts for gyms they follow or are at, or any crag posts';
