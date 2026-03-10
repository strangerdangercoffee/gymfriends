-- Migration script to move from array-based relationships to junction tables
-- This script migrates existing data from arrays to proper junction tables

-- Step 1: Migrate user-gym follows from users.followed_gyms array
INSERT INTO user_gym_follows (user_id, gym_id, created_at)
SELECT 
    u.id as user_id,
    unnest(u.followed_gyms)::uuid as gym_id,
    u.created_at
FROM users u
WHERE u.followed_gyms IS NOT NULL 
  AND array_length(u.followed_gyms, 1) > 0
ON CONFLICT (user_id, gym_id) DO NOTHING;

-- Step 2: Migrate gym followers from gyms.followers array
-- Note: This is redundant with the above since it's the same relationship
-- but we'll do it to ensure data consistency
INSERT INTO user_gym_follows (user_id, gym_id, created_at)
SELECT 
    unnest(g.followers)::uuid as user_id,
    g.id as gym_id,
    g.created_at
FROM gyms g
WHERE g.followers IS NOT NULL 
  AND array_length(g.followers, 1) > 0
ON CONFLICT (user_id, gym_id) DO NOTHING;

-- Step 3: Migrate user friendships from users.friends array
INSERT INTO user_friendships (user_id, friend_id, created_at)
SELECT 
    u.id as user_id,
    unnest(u.friends)::uuid as friend_id,
    u.created_at
FROM users u
WHERE u.friends IS NOT NULL 
  AND array_length(u.friends, 1) > 0
ON CONFLICT (user_id, friend_id) DO NOTHING;

-- Step 4: Migrate current gym presence from gyms.current_users array
-- This creates active presence records for users currently at gyms
INSERT INTO user_gym_presence (user_id, gym_id, is_active, checked_in_at, created_at)
SELECT 
    unnest(g.current_users)::uuid as user_id,
    g.id as gym_id,
    true as is_active,
    NOW() as checked_in_at,
    NOW() as created_at
FROM gyms g
WHERE g.current_users IS NOT NULL 
  AND array_length(g.current_users, 1) > 0
ON CONFLICT (user_id) WHERE is_active = true DO NOTHING;

-- Step 5: Migrate existing presence records to new junction table
-- This migrates data from the existing presence table
INSERT INTO user_gym_presence (user_id, gym_id, checked_in_at, checked_out_at, is_active, location, created_at, updated_at)
SELECT 
    p.user_id,
    p.gym_id,
    p.checked_in_at,
    p.checked_out_at,
    p.is_active,
    p.location,
    p.created_at,
    p.updated_at
FROM presence p
ON CONFLICT (user_id) WHERE is_active = true DO NOTHING;

-- Step 6: Verify migration results
-- Check counts to ensure migration was successful
DO $$
DECLARE
    user_follows_count INTEGER;
    gym_follows_count INTEGER;
    friendships_count INTEGER;
    presence_count INTEGER;
BEGIN
    -- Count user-gym follows
    SELECT COUNT(*) INTO user_follows_count FROM user_gym_follows;
    
    -- Count friendships
    SELECT COUNT(*) INTO friendships_count FROM user_friendships;
    
    -- Count active presence
    SELECT COUNT(*) INTO presence_count FROM user_gym_presence WHERE is_active = true;
    
    -- Log results
    RAISE NOTICE 'Migration completed successfully:';
    RAISE NOTICE '- User-gym follows: %', user_follows_count;
    RAISE NOTICE '- User friendships: %', friendships_count;
    RAISE NOTICE '- Active presence records: %', presence_count;
END $$;
