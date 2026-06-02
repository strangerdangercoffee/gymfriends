-- Belayer responses: INSERT policy used EXISTS(SELECT FROM area_feed_posts ...), which is still
-- subject to area_feed_posts RLS. Responders who do not follow the gym/area could not "see" the
-- post row, so EXISTS failed and INSERT violated RLS.
--
-- Fix: SECURITY DEFINER helper to test post existence + type without RLS, and allow SELECT on
-- rows where responder_user_id = auth.uid() so RETURNING / pre-check queries work.

CREATE OR REPLACE FUNCTION public.area_feed_post_accepts_belayer_responses(p_post_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM area_feed_posts p
    WHERE p.post_id = p_post_id
      AND p.deleted_at IS NULL
      AND p.quarantined = false
      AND p.post_type IN ('belayer_request', 'rally_pads_request')
  );
$$;

REVOKE ALL ON FUNCTION public.area_feed_post_accepts_belayer_responses(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.area_feed_post_accepts_belayer_responses(uuid) TO authenticated;

DROP POLICY IF EXISTS "Users can respond to belayer requests" ON belayer_request_responses;

CREATE POLICY "Users can respond to belayer requests"
  ON belayer_request_responses FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = responder_user_id
    AND public.area_feed_post_accepts_belayer_responses(post_id)
  );

DROP POLICY IF EXISTS "Users can view responses to visible posts" ON belayer_request_responses;

CREATE POLICY "Users can view responses to visible posts"
  ON belayer_request_responses FOR SELECT
  TO authenticated
  USING (
    responder_user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM area_feed_posts afp
      WHERE afp.post_id = belayer_request_responses.post_id
        AND afp.deleted_at IS NULL
        AND afp.quarantined = false
    )
  );

COMMENT ON FUNCTION public.area_feed_post_accepts_belayer_responses(uuid) IS
  'RLS-safe: true if post exists and accepts belayer/rally responses (used by belayer_request_responses INSERT).';
