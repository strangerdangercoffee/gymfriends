-- Post comments for lost_found and general area feed posts
-- Any authenticated user can read and write comments on public posts.

CREATE TABLE IF NOT EXISTS post_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES area_feed_posts(post_id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ  -- soft delete
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id
  ON post_comments(post_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_post_comments_author
  ON post_comments(author_user_id)
  WHERE deleted_at IS NULL;

-- ── updated_at trigger ────────────────────────────────────────────────────────
CREATE TRIGGER update_post_comments_updated_at
  BEFORE UPDATE ON post_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read non-deleted comments
CREATE POLICY "Anyone can read comments"
  ON post_comments FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

-- Authenticated users can add comments
CREATE POLICY "Users can add comments"
  ON post_comments FOR INSERT
  TO authenticated
  WITH CHECK (author_user_id = auth.uid());

-- Authors can edit their own comments
CREATE POLICY "Authors can update comments"
  ON post_comments FOR UPDATE
  TO authenticated
  USING (author_user_id = auth.uid())
  WITH CHECK (author_user_id = auth.uid());

-- Authors can soft-delete their own comments
CREATE POLICY "Authors can delete comments"
  ON post_comments FOR DELETE
  TO authenticated
  USING (author_user_id = auth.uid());

COMMENT ON TABLE post_comments IS
  'User comments on area feed posts (lost_found, general). Open to all authenticated users.';
