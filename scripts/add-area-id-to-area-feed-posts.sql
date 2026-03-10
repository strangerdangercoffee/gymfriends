-- Add area_id to area_feed_posts (gym_id XOR area_id; no crag_name in new logic)
-- Run after create-climbing-areas.sql and add-area-follows-visits-plans.sql

ALTER TABLE area_feed_posts
  ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES climbing_areas(id) ON DELETE CASCADE;

-- Drop old check (gym_id xor crag_name) and add new (gym_id xor area_id)
ALTER TABLE area_feed_posts DROP CONSTRAINT IF EXISTS area_feed_posts_gym_id_crag_name_check;
ALTER TABLE area_feed_posts DROP CONSTRAINT IF EXISTS area_feed_posts_check;

ALTER TABLE area_feed_posts
  ADD CONSTRAINT area_feed_posts_gym_xor_area_check CHECK (
    (gym_id IS NOT NULL AND area_id IS NULL) OR
    (gym_id IS NULL AND area_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_area_feed_posts_area_id ON area_feed_posts(area_id) WHERE deleted_at IS NULL;

-- Update RLS: allow view for posts with area_id when user follows area or has active visit
DROP POLICY IF EXISTS "Users can view area feed posts" ON area_feed_posts;

CREATE POLICY "Users can view area feed posts"
  ON area_feed_posts FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL AND
    quarantined = false AND
    (
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
      )) OR
      (area_id IS NOT NULL AND (
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

COMMENT ON COLUMN area_feed_posts.area_id IS 'Outdoor climbing area (gym_id XOR area_id)';
