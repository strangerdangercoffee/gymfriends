-- Create Post Reports Table (Community Moderation)
-- This script creates the table for tracking user reports on area feed posts

CREATE TABLE IF NOT EXISTS post_reports (
  report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES area_feed_posts(post_id) ON DELETE CASCADE,
  reporter_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(post_id, reporter_user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_post_reports_post_id ON post_reports(post_id);
CREATE INDEX IF NOT EXISTS idx_post_reports_reporter ON post_reports(reporter_user_id);
CREATE INDEX IF NOT EXISTS idx_post_reports_created_at ON post_reports(created_at DESC);

-- RLS Policies
ALTER TABLE post_reports ENABLE ROW LEVEL SECURITY;

-- Users can view reports they made
CREATE POLICY "Users can view their own reports"
    ON post_reports FOR SELECT
    USING (auth.uid() = reporter_user_id);

-- Admins can view all reports (future implementation)
-- For now, users can only see their own

-- Users can create reports
CREATE POLICY "Users can report posts"
    ON post_reports FOR INSERT
    WITH CHECK (
      auth.uid() = reporter_user_id AND
      EXISTS (
        SELECT 1 FROM area_feed_posts
        WHERE area_feed_posts.post_id = post_reports.post_id
        AND area_feed_posts.deleted_at IS NULL
      )
    );

COMMENT ON TABLE post_reports IS 'User reports on area feed posts for community moderation';
COMMENT ON COLUMN post_reports.reason IS 'Reason for reporting the post';
