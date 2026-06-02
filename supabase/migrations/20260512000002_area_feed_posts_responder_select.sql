-- Responders who do not follow the gym/area could not SELECT the parent area_feed_posts row,
-- so after responding the post vanished from their UI on refetch.
-- Allow viewing a post when the current user has any belayer_request_responses row for it.
-- Implemented via SECURITY DEFINER to avoid RLS mutual recursion between area_feed_posts and belayer_request_responses.

CREATE OR REPLACE FUNCTION public.current_user_responded_to_area_feed_post(p_post_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM belayer_request_responses r
    WHERE r.post_id = p_post_id
      AND r.responder_user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_responded_to_area_feed_post(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_responded_to_area_feed_post(uuid) TO authenticated;

DROP POLICY IF EXISTS "Users can view area feed posts" ON area_feed_posts;

CREATE POLICY "Users can view area feed posts"
  ON area_feed_posts FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND quarantined = false
    AND (
      author_user_id = auth.uid()
      OR public.current_user_responded_to_area_feed_post(area_feed_posts.post_id)
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
  'View: author; responders with a belayer_request_responses row; trip_announcement to friends; gym/area to followers or visit/presence.';

COMMENT ON FUNCTION public.current_user_responded_to_area_feed_post(uuid) IS
  'True if auth.uid() has any response row for this post (for area_feed_posts SELECT RLS).';
