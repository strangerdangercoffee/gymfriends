-- Open area_feed_posts to all authenticated users
-- Previously the SELECT policy required users to follow a gym/area or be present there.
-- Community feeds should be readable by any signed-in user, like a public bulletin board.

-- ── 1. Fix SELECT policy ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view area feed posts" ON area_feed_posts;

CREATE POLICY "Users can view area feed posts"
  ON area_feed_posts FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND quarantined = false
  );

COMMENT ON POLICY "Users can view area feed posts" ON area_feed_posts IS
  'Any authenticated user can read non-deleted, non-quarantined posts (public bulletin board).';

-- ── 2. Add traditional to climbing_type CHECK constraint ─────────────────────
-- The original constraint only allowed: lead, top_rope, bouldering, any.
-- We now also support traditional climbing.

ALTER TABLE area_feed_posts
  DROP CONSTRAINT IF EXISTS area_feed_posts_climbing_type_check;

ALTER TABLE area_feed_posts
  ADD CONSTRAINT area_feed_posts_climbing_type_check
  CHECK (climbing_type IN ('lead', 'top_rope', 'bouldering', 'traditional', 'any'));
