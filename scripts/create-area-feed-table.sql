-- Create Area Feed Posts Table (Gym/Crag Bulletin Board)
-- This script creates the table for gym and crag community feeds

CREATE TABLE IF NOT EXISTS area_feed_posts (
  post_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Location (either gym or crag)
  gym_id UUID REFERENCES gyms(id) ON DELETE CASCADE,
  crag_name TEXT, -- For outdoor crags not in gyms table
  
  post_type TEXT NOT NULL CHECK (post_type IN (
    'belayer_request', 
    'rally_pads_request', 
    'lost_found', 
    'discussion', 
    'general'
  )),
  
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  
  -- For belayer/rally pads requests
  climbing_type TEXT CHECK (climbing_type IN ('lead', 'top_rope', 'bouldering', 'any')),
  target_route TEXT, -- Route/boulder name
  target_grade TEXT, -- Grade they want to climb
  scheduled_time TIMESTAMPTZ, -- NULL for "now", set for scheduled requests
  urgency TEXT CHECK (urgency IN ('now', 'scheduled')) DEFAULT 'now',
  
  -- Moderation
  report_count INTEGER DEFAULT 0,
  quarantined BOOLEAN DEFAULT false,
  quarantined_at TIMESTAMPTZ,
  quarantined_reason TEXT,
  
  -- Metadata for flexible data storage
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ, -- Soft delete
  
  -- Ensure either gym_id or crag_name is set, but not both
  CHECK (
    (gym_id IS NOT NULL AND crag_name IS NULL) OR
    (gym_id IS NULL AND crag_name IS NOT NULL)
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_area_feed_posts_gym_id ON area_feed_posts(gym_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_area_feed_posts_crag_name ON area_feed_posts(crag_name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_area_feed_posts_author ON area_feed_posts(author_user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_area_feed_posts_type ON area_feed_posts(post_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_area_feed_posts_created_at ON area_feed_posts(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_area_feed_posts_quarantined ON area_feed_posts(quarantined) WHERE quarantined = true;
CREATE INDEX IF NOT EXISTS idx_area_feed_posts_active ON area_feed_posts(gym_id, created_at DESC) 
    WHERE deleted_at IS NULL AND quarantined = false;

-- Trigger for updated_at
CREATE TRIGGER update_area_feed_posts_updated_at
    BEFORE UPDATE ON area_feed_posts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE area_feed_posts ENABLE ROW LEVEL SECURITY;

-- Users can view non-quarantined posts in areas they follow or are at
CREATE POLICY "Users can view area feed posts"
    ON area_feed_posts FOR SELECT
    USING (
      deleted_at IS NULL AND
      quarantined = false AND
      (
        -- Can view posts for gyms they follow or are at
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
        -- Can view posts for any crag (public)
        (crag_name IS NOT NULL)
      )
    );

-- Users can create posts
CREATE POLICY "Users can create area feed posts"
    ON area_feed_posts FOR INSERT
    WITH CHECK (auth.uid() = author_user_id);

-- Users can update their own posts
CREATE POLICY "Users can update their own posts"
    ON area_feed_posts FOR UPDATE
    USING (auth.uid() = author_user_id)
    WITH CHECK (auth.uid() = author_user_id);

-- Users can soft-delete their own posts
CREATE POLICY "Users can delete their own posts"
    ON area_feed_posts FOR UPDATE
    USING (auth.uid() = author_user_id)
    WITH CHECK (deleted_at IS NOT NULL);

COMMENT ON TABLE area_feed_posts IS 'Community feed/bulletin board posts for gyms and crags';
COMMENT ON COLUMN area_feed_posts.post_type IS 'Type of post: belayer_request, rally_pads_request, lost_found, discussion, general';
COMMENT ON COLUMN area_feed_posts.scheduled_time IS 'Scheduled time for belayer requests, NULL for immediate requests';
COMMENT ON COLUMN area_feed_posts.report_count IS 'Number of reports this post has received';
COMMENT ON COLUMN area_feed_posts.quarantined IS 'Whether post has been quarantined due to reports';
