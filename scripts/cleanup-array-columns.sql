-- Cleanup script to remove array columns after migration to junction tables
-- WARNING: Only run this after verifying the migration was successful!

-- Step 1: Remove array columns from users table
ALTER TABLE users DROP COLUMN IF EXISTS friends;
ALTER TABLE users DROP COLUMN IF EXISTS followed_gyms;

-- Step 2: Remove array columns from gyms table
ALTER TABLE gyms DROP COLUMN IF EXISTS followers;
ALTER TABLE gyms DROP COLUMN IF EXISTS current_users;

-- Step 3: Drop the old presence table (replaced by user_gym_presence)
-- WARNING: This will permanently delete the old presence data!
-- Make sure user_gym_presence has all the data you need before running this
-- DROP TABLE IF EXISTS presence;

-- Step 4: Update any views or functions that might reference the old columns
-- (Add any custom views or functions here that need updating)

-- Step 5: Verify cleanup
DO $$
BEGIN
    -- Check if array columns were removed
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name IN ('friends', 'followed_gyms')
    ) THEN
        RAISE NOTICE 'WARNING: Some array columns still exist in users table';
    ELSE
        RAISE NOTICE 'SUCCESS: Array columns removed from users table';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'gyms' AND column_name IN ('followers', 'current_users')
    ) THEN
        RAISE NOTICE 'WARNING: Some array columns still exist in gyms table';
    ELSE
        RAISE NOTICE 'SUCCESS: Array columns removed from gyms table';
    END IF;
END $$;
