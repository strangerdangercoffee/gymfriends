-- Authors must be able to read their own area_feed_posts rows so INSERT ... RETURNING
-- (used by Supabase .insert().select()) succeeds even when they do not follow the gym/area yet.
-- Without this, creating a belayer request from an area you only browse (not follow) fails with:
--   new row violates row-level security policy for table "area_feed_posts"

DROP POLICY IF EXISTS "Users can view area feed posts" ON area_feed_posts;

CREATE POLICY "Users can view area feed posts"
  ON area_feed_posts FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND quarantined = false
    AND (
      author_user_id = auth.uid()
      OR
      (
        post_type = 'trip_announcement'
        AND EXISTS (
          SELECT 1 FROM user_friendships uf
          WHERE (uf.user_id = auth.uid() AND uf.friend_id = area_feed_posts.author_user_id)
             OR (uf.friend_id = auth.uid() AND uf.user_id = area_feed_posts.author_user_id)
        )
      )
      OR
      (
        gym_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM user_gym_follows
          WHERE user_gym_follows.gym_id = area_feed_posts.gym_id
            AND user_gym_follows.user_id = auth.uid()
        )
      )
      OR
      (
        gym_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM user_gym_presence
          WHERE user_gym_presence.gym_id = area_feed_posts.gym_id
            AND user_gym_presence.user_id = auth.uid()
            AND user_gym_presence.is_active = true
        )
      )
      OR
      (
        area_id IS NOT NULL
        AND post_type != 'trip_announcement'
        AND EXISTS (
          SELECT 1 FROM user_area_follows
          WHERE user_area_follows.area_id = area_feed_posts.area_id
            AND user_area_follows.user_id = auth.uid()
        )
      )
      OR
      (
        area_id IS NOT NULL
        AND post_type != 'trip_announcement'
        AND EXISTS (
          SELECT 1 FROM user_area_visits
          WHERE user_area_visits.area_id = area_feed_posts.area_id
            AND user_area_visits.user_id = auth.uid()
            AND user_area_visits.left_at IS NULL
            AND user_area_visits.last_seen_at > (NOW() - INTERVAL '24 hours')
        )
      )
    )
  );

COMMENT ON POLICY "Users can view area feed posts" ON area_feed_posts IS
  'View: own posts always; trip_announcement to friends; gym/area posts to followers or active presence/visit.';
