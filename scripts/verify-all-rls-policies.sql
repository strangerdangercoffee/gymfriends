-- Verify All RLS Policies for Climbing/Belayer Feature Tables
-- This script checks which tables have RLS enabled and lists their policies

-- Check area_feed_posts
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN (
  'area_feed_posts',
  'belayer_request_responses',
  'post_reports',
  'climbing_profiles',
  'belay_certifications',
  'notification_preferences'
)
ORDER BY tablename, policyname;

-- Check if RLS is enabled on each table
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename IN (
  'area_feed_posts',
  'belayer_request_responses',
  'post_reports',
  'climbing_profiles',
  'belay_certifications',
  'notification_preferences'
)
ORDER BY tablename;
