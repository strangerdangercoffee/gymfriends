-- Add trip_announcement to area_feed_posts post_type and restrict visibility to friends of author
-- Run after add-area-id-to-area-feed-posts.sql

-- Drop existing post_type check (name may vary; try common pattern)
ALTER TABLE area_feed_posts DROP CONSTRAINT IF EXISTS area_feed_posts_post_type_check;

-- Re-add with trip_announcement
ALTER TABLE area_feed_posts
  ADD CONSTRAINT area_feed_posts_post_type_check CHECK (post_type IN (
    'belayer_request',
    'rally_pads_request',
    'lost_found',
    'discussion',
    'general',
    'trip_announcement'
  ));

-- RLS: trip_announcement visible only to friends of author; other types keep area/gym rules
DROP POLICY IF EXISTS "Users can view area feed posts" ON area_feed_posts;

CREATE POLICY "Users can view area feed posts"
  ON area_feed_posts FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND quarantined = false
    AND (
      -- Trip announcements: only friends of the author can see
      (post_type = 'trip_announcement' AND (
        EXISTS (
          SELECT 1 FROM user_friendships uf
          WHERE (uf.user_id = auth.uid() AND uf.friend_id = area_feed_posts.author_user_id)
             OR (uf.friend_id = auth.uid() AND uf.user_id = area_feed_posts.author_user_id)
        )
      ))
      OR
      -- Gym posts: follow or presence
      (gym_id IS NOT NULL AND (
        EXISTS (
          SELECT 1 FROM user_gym_follows
          WHERE user_gym_follows.gym_id = area_feed_posts.gym_id
          AND user_gym_follows.user_id = auth.uid()
        ) OR
        EXISTS (
          SELECT 1 FROM user_gym_presence
          WHERE user_gym_presence.gym_id = area_feed_posts.gym_id
          AND user_gym_presence.user_id = auth.uid()
          AND user_gym_presence.is_active = true
        )
      ))
      OR
      -- Area posts (non–trip_announcement): follow area or active visit
      (area_id IS NOT NULL AND post_type != 'trip_announcement' AND (
        EXISTS (
          SELECT 1 FROM user_area_follows
          WHERE user_area_follows.area_id = area_feed_posts.area_id
          AND user_area_follows.user_id = auth.uid()
        ) OR
        EXISTS (
          SELECT 1 FROM user_area_visits
          WHERE user_area_visits.area_id = area_feed_posts.area_id
          AND user_area_visits.user_id = auth.uid()
          AND user_area_visits.left_at IS NULL
          AND user_area_visits.last_seen_at > (NOW() - INTERVAL '24 hours')
        )
      ))
    )
  );

COMMENT ON COLUMN area_feed_posts.post_type IS 'Type of post: belayer_request, rally_pads_request, lost_found, discussion, general, trip_announcement (friend-only visibility)';
