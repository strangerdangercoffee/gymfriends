-- ============================================================
-- Migration: Calendar Availability
-- Adds Google Calendar sync tables and friend schedule
-- visibility policies needed for the Find Time feature.
--
-- New tables:
--   • calendar_busy_blocks  — busy periods from GCal / manual
--   • google_calendar_tokens — OAuth tokens per user
--
-- New RLS policies:
--   • calendar_busy_blocks  — owner CRUD + friend read
--   • google_calendar_tokens — owner-only
--   • workout_history        — friend read (enables Find Time)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- Helper: updated_at trigger function
-- CREATE OR REPLACE is safe to run multiple times.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- ────────────────────────────────────────────────────────────
-- 1. calendar_busy_blocks
--    Stores external calendar events (Google Calendar) as
--    opaque busy windows. event_title is optional; apps should
--    omit or hash it if the user hasn't consented to sharing
--    event titles with friends.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS calendar_busy_blocks (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_time   timestamptz NOT NULL,
  end_time     timestamptz NOT NULL,
  source       text        NOT NULL DEFAULT 'google'
                           CHECK (source IN ('google', 'manual')),
  event_title  text,       -- null means "busy, no title shared"
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT calendar_busy_blocks_end_after_start CHECK (end_time > start_time)
);

-- Index for per-user time-range queries (the main access pattern)
CREATE INDEX IF NOT EXISTS calendar_busy_blocks_user_time_idx
  ON calendar_busy_blocks (user_id, start_time, end_time);

-- Trigger: keep updated_at current
DROP TRIGGER IF EXISTS trg_calendar_busy_blocks_updated_at ON calendar_busy_blocks;
CREATE TRIGGER trg_calendar_busy_blocks_updated_at
  BEFORE UPDATE ON calendar_busy_blocks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── RLS ─────────────────────────────────────────────────────

ALTER TABLE calendar_busy_blocks ENABLE ROW LEVEL SECURITY;

-- Owners: full access
DROP POLICY IF EXISTS "calendar_busy_blocks: owner all" ON calendar_busy_blocks;
CREATE POLICY "calendar_busy_blocks: owner all"
  ON calendar_busy_blocks
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Friends: read-only, only when the user has share_schedule = true
-- Friendship is symmetric (row exists in either direction).
DROP POLICY IF EXISTS "calendar_busy_blocks: friend read" ON calendar_busy_blocks;
CREATE POLICY "calendar_busy_blocks: friend read"
  ON calendar_busy_blocks
  FOR SELECT
  USING (
    -- the block's owner has share_schedule enabled
    EXISTS (
      SELECT 1 FROM users u
       WHERE u.id = calendar_busy_blocks.user_id
         AND (u.privacy_settings->>'share_schedule')::boolean IS NOT FALSE
    )
    -- and the requesting user is a friend of the owner
    AND EXISTS (
      SELECT 1 FROM user_friendships uf
       WHERE (uf.user_id  = auth.uid() AND uf.friend_id = calendar_busy_blocks.user_id)
          OR (uf.friend_id = auth.uid() AND uf.user_id  = calendar_busy_blocks.user_id)
    )
  );


-- ────────────────────────────────────────────────────────────
-- 2. google_calendar_tokens
--    Stores per-user Google OAuth tokens.  Only the owning
--    user may ever read or write this table — no friend policy.
--    Tokens should be treated as secrets; consider encrypting
--    access_token / refresh_token at the application layer
--    (e.g. via Supabase Vault) before storing.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS google_calendar_tokens (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token   text        NOT NULL,
  refresh_token  text,
  token_expiry   timestamptz,
  -- Which calendar to sync (default: the user's primary calendar)
  calendar_id    text        NOT NULL DEFAULT 'primary',
  -- Friendly label shown in the UI ("Personal", "Work", etc.)
  calendar_label text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Trigger: keep updated_at current
DROP TRIGGER IF EXISTS trg_google_calendar_tokens_updated_at ON google_calendar_tokens;
CREATE TRIGGER trg_google_calendar_tokens_updated_at
  BEFORE UPDATE ON google_calendar_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── RLS ─────────────────────────────────────────────────────

ALTER TABLE google_calendar_tokens ENABLE ROW LEVEL SECURITY;

-- Owner only — no exceptions
DROP POLICY IF EXISTS "google_calendar_tokens: owner all" ON google_calendar_tokens;
CREATE POLICY "google_calendar_tokens: owner all"
  ON google_calendar_tokens
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ────────────────────────────────────────────────────────────
-- 3. workout_history — friend read policy
--    The Find Time screen calls workoutHistoryApi.getWorkoutHistory
--    with a friend's user_id.  Without this policy those queries
--    return empty arrays, making everyone appear permanently free.
--
--    NOTE: if workout_history already has an owner-only SELECT
--    policy in your database, this policy adds friend visibility
--    on top of it (Postgres ORs permissive policies together).
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "workout_history: friend read" ON workout_history;
CREATE POLICY "workout_history: friend read"
  ON workout_history
  FOR SELECT
  USING (
    -- Always allow users to read their own records
    auth.uid() = user_id

    -- Friends may read when share_schedule is enabled
    OR (
      EXISTS (
        SELECT 1 FROM users u
         WHERE u.id = workout_history.user_id
           AND (u.privacy_settings->>'share_schedule')::boolean IS NOT FALSE
      )
      AND EXISTS (
        SELECT 1 FROM user_friendships uf
         WHERE (uf.user_id  = auth.uid() AND uf.friend_id = workout_history.user_id)
            OR (uf.friend_id = auth.uid() AND uf.user_id  = workout_history.user_id)
      )
    )
  );
