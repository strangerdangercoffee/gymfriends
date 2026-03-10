-- Create Belayer Request Responses Table
-- This script creates the table for tracking responses to belayer/rally pads requests

CREATE TABLE IF NOT EXISTS belayer_request_responses (
  response_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES area_feed_posts(post_id) ON DELETE CASCADE,
  responder_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('available', 'selected', 'declined', 'completed')) DEFAULT 'available',
  message TEXT, -- Optional message from responder
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(post_id, responder_user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_belayer_responses_post_id ON belayer_request_responses(post_id);
CREATE INDEX IF NOT EXISTS idx_belayer_responses_responder ON belayer_request_responses(responder_user_id);
CREATE INDEX IF NOT EXISTS idx_belayer_responses_status ON belayer_request_responses(status);
CREATE INDEX IF NOT EXISTS idx_belayer_responses_available ON belayer_request_responses(post_id, status) 
    WHERE status = 'available';

-- Trigger for updated_at
CREATE TRIGGER update_belayer_responses_updated_at
    BEFORE UPDATE ON belayer_request_responses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE belayer_request_responses ENABLE ROW LEVEL SECURITY;

-- Users can view responses to posts they can see
CREATE POLICY "Users can view responses to visible posts"
    ON belayer_request_responses FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM area_feed_posts
        WHERE area_feed_posts.post_id = belayer_request_responses.post_id
        AND area_feed_posts.deleted_at IS NULL
        AND area_feed_posts.quarantined = false
      )
    );

-- Users can create responses to posts
CREATE POLICY "Users can respond to belayer requests"
    ON belayer_request_responses FOR INSERT
    WITH CHECK (
      auth.uid() = responder_user_id AND
      EXISTS (
        SELECT 1 FROM area_feed_posts
        WHERE area_feed_posts.post_id = belayer_request_responses.post_id
        AND area_feed_posts.deleted_at IS NULL
        AND area_feed_posts.quarantined = false
      )
    );

-- Post authors can update response status (select/decline)
CREATE POLICY "Post authors can update response status"
    ON belayer_request_responses FOR UPDATE
    USING (
      EXISTS (
        SELECT 1 FROM area_feed_posts
        WHERE area_feed_posts.post_id = belayer_request_responses.post_id
        AND area_feed_posts.author_user_id = auth.uid()
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM area_feed_posts
        WHERE area_feed_posts.post_id = belayer_request_responses.post_id
        AND area_feed_posts.author_user_id = auth.uid()
      )
    );

-- Responders can update their own response (e.g., add message, decline)
CREATE POLICY "Responders can update their own response"
    ON belayer_request_responses FOR UPDATE
    USING (auth.uid() = responder_user_id)
    WITH CHECK (auth.uid() = responder_user_id);

COMMENT ON TABLE belayer_request_responses IS 'Responses to belayer/rally pads requests on area feeds';
COMMENT ON COLUMN belayer_request_responses.status IS 'Response status: available (responded), selected (chosen by inviter), declined, completed';
