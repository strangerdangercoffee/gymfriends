-- Batch comment counts for feed posts (one round-trip instead of N queries).

CREATE OR REPLACE FUNCTION public.post_comment_counts_for_feed(p_post_ids uuid[])
RETURNS TABLE (post_id uuid, comment_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT c.post_id, count(*)::bigint
  FROM post_comments c
  WHERE c.post_id = ANY(p_post_ids)
    AND c.deleted_at IS NULL
  GROUP BY c.post_id;
$$;

REVOKE ALL ON FUNCTION public.post_comment_counts_for_feed(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_comment_counts_for_feed(uuid[]) TO authenticated;

COMMENT ON FUNCTION public.post_comment_counts_for_feed(uuid[]) IS
  'Returns non-deleted comment counts per post_id for area feed loading.';
