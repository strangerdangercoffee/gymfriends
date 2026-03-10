-- Verify trigger setup for user profile creation
-- Run this to check if the trigger is properly installed

-- Check if the trigger function exists
SELECT 
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'handle_new_user';

-- Check if the trigger exists
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  tgenabled as enabled,
  pg_get_triggerdef(oid) as trigger_definition
FROM pg_trigger
WHERE tgname = 'on_auth_user_created';

-- Check function permissions
SELECT 
  p.proname as function_name,
  r.rolname as role_name,
  has_function_privilege(r.oid, p.oid, 'EXECUTE') as can_execute
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
CROSS JOIN pg_roles r
WHERE n.nspname = 'public' 
  AND p.proname = 'handle_new_user'
  AND r.rolname IN ('authenticated', 'anon', 'service_role', 'postgres');

-- Test: Check if we can see auth.users (this might fail due to permissions)
-- This is just to verify the function can access auth schema
DO $$
BEGIN
  RAISE NOTICE 'Testing trigger function access...';
  -- This will show if we can query auth.users
  PERFORM 1 FROM auth.users LIMIT 1;
  RAISE NOTICE '✓ Can access auth.users';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE WARNING '✗ Cannot access auth.users - this might be why trigger fails';
  WHEN OTHERS THEN
    RAISE WARNING '✗ Error accessing auth.users: %', SQLERRM;
END $$;
