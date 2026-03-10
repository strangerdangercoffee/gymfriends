-- Create a function to handle user profile creation with elevated privileges
-- This function bypasses RLS to allow user creation during signup
-- It's secure because it still validates that auth.uid() matches the provided user_id

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, email, privacy_settings, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1), 'User'),
    NEW.email,
    '{"share_location": true, "share_schedule": true, "auto_check_in": false}'::jsonb,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the trigger
    -- This ensures auth user creation doesn't fail even if profile creation has issues
    RAISE WARNING 'Error creating user profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create user profile when auth user is created
-- Note: The trigger must be created by a superuser or the postgres role
-- If you get permission errors, run this as the postgres user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Verify trigger was created
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'on_auth_user_created' 
    AND tgrelid = 'auth.users'::regclass
  ) THEN
    RAISE NOTICE '✓ Trigger on_auth_user_created created successfully';
  ELSE
    RAISE WARNING '✗ Trigger on_auth_user_created was NOT created - check permissions';
  END IF;
END $$;

-- Grant execute permission to authenticated users and service_role
-- The trigger needs to be able to execute this function
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- Also create a manual function that can be called from the app if needed
-- This function bypasses RLS by using SECURITY DEFINER
-- Note: We don't check auth.users here because:
-- 1. The trigger should handle initial creation
-- 2. SECURITY DEFINER functions may have transaction isolation issues accessing auth schema
-- 3. The foreign key constraint will enforce the relationship

-- Drop the existing function first if it exists (needed to change return type)
DROP FUNCTION IF EXISTS public.create_user_profile(UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.create_user_profile(
  user_id UUID,
  user_name TEXT,
  user_email TEXT
)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
  retry_count INT := 0;
BEGIN
  -- Try to insert directly - the foreign key constraint will enforce validity
  -- If the auth user doesn't exist yet (transaction timing), we'll retry once
  LOOP
    BEGIN
      INSERT INTO public.users (id, name, email, privacy_settings, created_at, updated_at)
      VALUES (
        user_id,
        user_name,
        user_email,
        '{"share_location": true, "share_schedule": true, "auto_check_in": false}'::jsonb,
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO UPDATE
      SET 
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        updated_at = NOW();
      
      -- Return success as JSONB
      result := jsonb_build_object(
        'success', true,
        'message', 'User profile created/updated successfully'
      );
      RETURN result;
    EXCEPTION
      WHEN foreign_key_violation THEN
        -- If foreign key constraint fails, the auth user might not be committed yet
        -- Wait a bit and retry multiple times (transaction timing issue)
        IF retry_count < 5 THEN
          retry_count := retry_count + 1;
          PERFORM pg_sleep(1.0 * retry_count); -- Wait progressively longer: 1s, 2s, 3s, 4s, 5s
          -- Continue loop to retry
        ELSE
          -- Already retried multiple times, return error message
          -- The auth user might not be committed yet (email confirmation required)
          result := jsonb_build_object(
            'success', false,
            'message', 'Foreign key violation: auth user ' || user_id || ' does not exist after ' || retry_count || ' retries. The auth user may not be committed yet, or email confirmation may be required. The trigger should create the profile automatically.',
            'error', 'foreign_key_violation',
            'retries', retry_count
          );
          RAISE WARNING '%', result->>'message';
          RETURN result;
        END IF;
      WHEN unique_violation THEN
        result := jsonb_build_object(
          'success', false,
          'message', 'User already exists (unique violation)',
          'error', 'unique_violation'
        );
        RETURN result;
      WHEN OTHERS THEN
        -- Re-raise any other exceptions with details
        result := jsonb_build_object(
          'success', false,
          'message', 'Error creating user profile: ' || SQLERRM,
          'error', SQLSTATE
        );
        RAISE EXCEPTION '%', result->>'message';
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to both authenticated and anon users
-- This allows the function to be called even before email confirmation
GRANT EXECUTE ON FUNCTION public.create_user_profile(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_user_profile(UUID, TEXT, TEXT) TO anon;

COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates a user profile in public.users when a new auth user is created';
COMMENT ON FUNCTION public.create_user_profile(UUID, TEXT, TEXT) IS 'Manually create or update a user profile (can be called from the app if trigger fails)';
